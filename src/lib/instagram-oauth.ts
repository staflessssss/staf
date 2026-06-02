import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_GRAPH_API_VERSION = "v21.0";

const INSTAGRAM_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "instagram_manage_messages",
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
};

export type MetaPageWithInstagram = {
  id: string;
  name?: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
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
  const clientId =
    process.env.META_APP_ID?.trim() || process.env.INSTAGRAM_APP_ID?.trim() || "";
  const clientSecret =
    process.env.META_APP_SECRET?.trim() || process.env.INSTAGRAM_APP_SECRET?.trim() || "";
  const publicBaseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";
  const graphApiVersion =
    process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;

  if (!clientId || !clientSecret || !publicBaseUrl) {
    throw new Error("Meta OAuth credentials or app base URL are missing.");
  }

  return {
    clientId,
    clientSecret,
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
  const url = new URL(`https://www.facebook.com/${config.graphApiVersion}/dialog/oauth`);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(","));
  url.searchParams.set("state", state);

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
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("client_secret", config.clientSecret);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("code", code);

  const shortLived = await getGraphJson<MetaTokenResponse>(url);

  if (!shortLived.access_token) {
    throw new Error("Meta token exchange failed.");
  }

  const longLivedUrl = new URL(`https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`);

  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", config.clientId);
  longLivedUrl.searchParams.set("client_secret", config.clientSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", shortLived.access_token);

  const longLived = await getGraphJson<MetaTokenResponse>(longLivedUrl);

  return longLived.access_token ? longLived : shortLived;
}

export async function fetchInstagramPages(userAccessToken: string) {
  const config = getMetaOAuthConfig();
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/me/accounts`);

  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}",
  );
  url.searchParams.set("access_token", userAccessToken);

  const payload = await getGraphJson<{ data?: MetaPageWithInstagram[] }>(url);

  return (payload.data ?? []).filter(
    (page) => page.access_token && page.instagram_business_account?.id,
  );
}

export async function subscribeInstagramPageToWebhooks(page: MetaPageWithInstagram) {
  const config = getMetaOAuthConfig();
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${page.id}/subscribed_apps`);
  const response = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({
      subscribed_fields: "messages,messaging_postbacks,messaging_seen",
      access_token: page.access_token,
    }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error("Meta webhook page subscription failed.");
  }

  return payload;
}
