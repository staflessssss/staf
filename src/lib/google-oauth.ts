import { createHmac, timingSafeEqual } from "crypto";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
];

type GoogleStatePayload = {
  tenantId: string;
  redirectTo: string;
  issuedAt: number;
};

export function normalizeGoogleRedirectTo(value: string | null | undefined) {
  const fallback = "/client/connections/gmail";
  const redirectTo = value?.trim() || fallback;

  if (
    !redirectTo.startsWith("/") ||
    redirectTo.startsWith("//") ||
    redirectTo.includes("\\")
  ) {
    return fallback;
  }

  try {
    const base = "https://stafless.local";
    const target = new URL(redirectTo, base);

    if (target.origin !== base) {
      return fallback;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

function getStateSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for Google OAuth state.");
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

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const publicBaseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";

  if (!clientId || !clientSecret || !publicBaseUrl) {
    throw new Error("Google OAuth credentials or app base URL are missing.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${publicBaseUrl}/api/google/callback`,
    scopes: GOOGLE_SCOPES,
  };
}

export function buildGoogleConnectUrl(args: {
  tenantId: string;
  redirectTo: string;
}) {
  const config = getGoogleOAuthConfig();
  const payload: GoogleStatePayload = {
    tenantId: args.tenantId,
    redirectTo: normalizeGoogleRedirectTo(args.redirectTo),
    issuedAt: Date.now(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const state = `${encodedPayload}.${signState(encodedPayload)}`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return url.toString();
}

export function verifyGoogleState(state: string) {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("Invalid Google OAuth state.");
  }

  const expected = signState(encodedPayload);

  if (signature.length !== expected.length) {
    throw new Error("Google OAuth state signature mismatch.");
  }

  const isValid = timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));

  if (!isValid) {
    throw new Error("Google OAuth state signature mismatch.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as GoogleStatePayload;

  if (Date.now() - payload.issuedAt > 15 * 60 * 1000) {
    throw new Error("Google OAuth state expired.");
  }

  return payload;
}

export async function exchangeGoogleCode(code: string) {
  const config = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.access_token) {
    throw new Error("Google token exchange failed.");
  }

  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.email) {
    throw new Error("Google profile lookup failed.");
  }

  return payload as {
    email: string;
    name?: string;
    picture?: string;
  };
}
