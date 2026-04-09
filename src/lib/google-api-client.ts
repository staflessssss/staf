import { google } from "googleapis";

import { decrypt } from "@/lib/crypto";

type GoogleOAuthCredentials = {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
};

export function buildGoogleRedirectUri() {
  const publicBaseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";

  return `${publicBaseUrl}/api/google/callback`;
}

export function createGoogleOAuthClientFromEncryptedCredentials(credentialsEnc: string) {
  const credentials = JSON.parse(decrypt(credentialsEnc)) as GoogleOAuthCredentials;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = buildGoogleRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are missing.");
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials(credentials);

  return auth;
}

export function parseSpreadsheetId(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return "";
  }

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  return trimmed;
}
