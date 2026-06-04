import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_GRAPH_API_VERSION = "v25.0";

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
];

const INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_seen",
  "message_reactions",
  "messaging_postbacks",
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
  tokenExchangeWarning?: string;
  tokenLifetime?: "short_lived" | "long_lived";
};

type MetaErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
  error_message?: string;
  error_type?: string;
  code?: number;
};

export type InstagramProfile = {
  id: string;
  user_id?: string;
  username?: string;
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

function formatMetaError(payload: MetaErrorPayload | null | undefined, fallback: string) {
  const error = payload?.error;
  const message = error?.message ?? payload?.error_message;
  const type = error?.type ?? payload?.error_type;
  const code = error?.code ?? payload?.code;
  const subcode = error?.error_subcode;
  const details = [
    message ? `message=${message}` : null,
    type ? `type=${type}` : null,
    code ? `code=${code}` : null,
    subcode ? `subcode=${subcode}` : null,
  ].filter(Boolean);

  return details.length > 0 ? `${fallback}: ${details.join("; ")}` : fallback;
}

async function getGraphJson<T>(url: URL, errorLabel = "Meta Graph API request failed"): Promise<T> {
  const response = await fetch(url);
  const payload = (await response.json().catch(() => null)) as MetaErrorPayload | null;

  if (!response.ok || !payload) {
    throw new Error(formatMetaError(payload, errorLabel));
  }

  return payload as T;
}

async function postGraphJson<T>(url: URL, errorLabel = "Meta Graph API request failed"): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as MetaErrorPayload | null;

  if (!response.ok || !payload) {
    throw new Error(formatMetaError(payload, errorLabel));
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
  const shortLived = (await response.json().catch(() => null)) as
    | (MetaTokenResponse & MetaErrorPayload)
    | null;

  if (!response.ok || !shortLived?.access_token) {
    throw new Error(formatMetaError(shortLived, "Instagram token exchange failed"));
  }

  const longLivedUrl = new URL("https://graph.instagram.com/access_token");

  longLivedUrl.searchParams.set("grant_type", "ig_exchange_token");
  longLivedUrl.searchParams.set("client_secret", config.clientSecret);
  longLivedUrl.searchParams.set("access_token", shortLived.access_token);

  const longLived = await getGraphJson<MetaTokenResponse>(
    longLivedUrl,
    "Instagram long-lived token exchange failed",
  ).catch((error) => {
    console.error("[instagram-oauth] long-lived token exchange failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return null;
  });

  if (!longLived?.access_token) {
    return {
      ...shortLived,
      access_token: shortLived.access_token,
      user_id: shortLived.user_id,
      tokenExchangeWarning: "instagram-token-refresh",
      tokenLifetime: "short_lived" as const,
    };
  }

  return {
    ...shortLived,
    ...longLived,
    access_token: longLived.access_token,
    user_id: shortLived.user_id,
    tokenLifetime: "long_lived" as const,
  };
}

export async function fetchInstagramProfile(accessToken: string, userId?: string) {
  const config = getMetaOAuthConfig();
  const url = new URL(`https://graph.instagram.com/${config.graphApiVersion}/me`);

  url.searchParams.set(
    "fields",
    "id,user_id,username,account_type",
  );
  url.searchParams.set("access_token", accessToken);

  const profile = await getGraphJson<InstagramProfile>(url, "Instagram profile fetch failed").catch(
    async (error) => {
      if (!userId) {
        throw error;
      }

      console.error("[instagram-oauth] /me profile fetch failed; retrying by user_id", {
        error: error instanceof Error ? error.message : "unknown",
      });

      const fallbackUrl = new URL(`https://graph.instagram.com/${config.graphApiVersion}/${userId}`);
      fallbackUrl.searchParams.set("fields", "id,username,account_type");
      fallbackUrl.searchParams.set("access_token", accessToken);

      return getGraphJson<InstagramProfile>(fallbackUrl, "Instagram profile fetch failed");
    },
  );

  return {
    ...profile,
    user_id: profile.user_id ?? userId,
  };
}

export async function refreshInstagramLongLivedToken(accessToken: string) {
  const url = new URL("https://graph.instagram.com/refresh_access_token");

  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  return getGraphJson<MetaTokenResponse>(url, "Instagram token refresh failed");
}

export async function subscribeInstagramWebhooks(args: {
  accessToken: string;
  igUserId: string;
}) {
  const config = getMetaOAuthConfig();
  const url = new URL(
    `https://graph.instagram.com/${config.graphApiVersion}/${args.igUserId}/subscribed_apps`,
  );

  url.searchParams.set("subscribed_fields", INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS.join(","));
  url.searchParams.set("access_token", args.accessToken);

  const result = await postGraphJson<{ success?: boolean }>(
    url,
    "Instagram webhook subscription failed",
  );

  if (result.success !== true) {
    throw new Error("Instagram webhook subscription failed.");
  }

  return {
    status: "subscribed",
    fields: INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS,
  };
}
