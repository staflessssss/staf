import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_GRAPH_API_VERSION = "v21.0";

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
];

type InstagramStatePayload = {
  tenantId: string;
  redirectTo: string;
  issuedAt: number;
};

type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  user_id?: string;
};

export type InstagramProfile = {
  id: string;
  user_id?: string;
  username?: string;
  name?: string;
  account_type?: string;
};

function getStateSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for Instagram OAuth state.");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signState(payload: string) {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function normalizeInstagramRedirectTo(value: string | null | undefined) {
  const fallback = "/client/connections/instagram";
  const redirectTo = value?.trim() || fallback;

  if (
    !redirectTo.startsWith("/") ||
    redirectTo.startsWith("//") ||
    redirectTo.includes("\\")
  ) {
    return fallback;
  }

  try {
    const base = "https://behalfy.local";
    const target = new URL(redirectTo, base);

    if (target.origin !== base) {
      return fallback;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function getMetaOAuthConfig() {
  const clientId = process.env.INSTAGRAM_APP_ID?.trim() || "";
  const clientSecret =
    process.env.INSTAGRAM_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim() || "";
  const publicBaseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";
  const graphApiVersion =
    process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
  const configId = process.env.INSTAGRAM_LOGIN_CONFIG_ID?.trim() || "";

  if (!clientId || !clientSecret || !publicBaseUrl) {
    throw new Error("Instagram OAuth credentials or app base URL are missing. Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and APP_BASE_URL.");
  }

  return {
    clientId,
    clientSecret,
    configId,
    redirectUri: `${publicBaseUrl}/api/instagram/callback`,
    graphApiVersion,
    scopes: INSTAGRAM_SCOPES,
  };
}

export function buildInstagramConnectUrl(args: {
  tenantId: string;
  redirectTo: string;
}) {
  const config = getMetaOAuthConfig();
  const payload: InstagramStatePayload = {
    tenantId: args.tenantId,
    redirectTo: normalizeInstagramRedirectTo(args.redirectTo),
    issuedAt: Date.now(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const state = `${encodedPayload}.${signState(encodedPayload)}`;
  const url = new URL("https://www.instagram.com/oauth/authorize");

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(","));
  url.searchParams.set("state", state);
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");

  if (config.configId) {
    url.searchParams.set("config_id", config.configId);
  }

  return url.toString();
}

export function verifyInstagramState(state: string) {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("Invalid Instagram OAuth state.");
  }

  const expected = signState(encodedPayload);

  if (signature.length !== expected.length) {
    throw new Error("Instagram OAuth state signature mismatch.");
  }

  const isValid = timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));

  if (!isValid) {
    throw new Error("Instagram OAuth state signature mismatch.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as InstagramStatePayload;

  if (Date.now() - payload.issuedAt > 15 * 60 * 1000) {
    throw new Error("Instagram OAuth state expired.");
  }

  return payload;
}

async function getGraphJson<T>(url: URL): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload) {
    throw new Error("Meta Graph API request failed.");
  }

  return payload as T;
}

export async function exchangeInstagramCode(code: string) {
  const config = getMetaOAuthConfig();
  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code,
    }),
  });
  const shortLived = (await response.json().catch(() => null)) as MetaTokenResponse | null;

  if (!response.ok || !shortLived?.access_token) {
    throw new Error("Instagram token exchange failed.");
  }

  const longLivedUrl = new URL("https://graph.instagram.com/access_token");

  longLivedUrl.searchParams.set("grant_type", "ig_exchange_token");
  longLivedUrl.searchParams.set("client_secret", config.clientSecret);
  longLivedUrl.searchParams.set("access_token", shortLived.access_token);

  const longLived = await getGraphJson<MetaTokenResponse>(longLivedUrl);

  return {
    ...shortLived,
    ...longLived,
    access_token: longLived.access_token || shortLived.access_token,
    user_id: shortLived.user_id,
  };
}

export async function fetchInstagramProfile(accessToken: string) {
  const config = getMetaOAuthConfig();
  const url = new URL(`https://graph.instagram.com/${config.graphApiVersion}/me`);

  url.searchParams.set(
    "fields",
    "id,user_id,username,name,account_type",
  );
  url.searchParams.set("access_token", accessToken);

  return getGraphJson<InstagramProfile>(url);
}

export async function refreshInstagramLongLivedToken(accessToken: string) {
  const url = new URL("https://graph.instagram.com/refresh_access_token");

  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  return getGraphJson<MetaTokenResponse>(url);
}
