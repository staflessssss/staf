import { ChannelType, ConnectionStatus, IntegrationType } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { upsertChannelConnection, upsertIntegrationConnection } from "@/lib/connection-store";
import { fetchGoogleProfile, exchangeGoogleCode, verifyGoogleState } from "@/lib/google-oauth";

function buildRedirect(baseUrl: URL, redirectTo: string, params: Record<string, string>) {
  const target = new URL(redirectTo, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }

  return target;
}

export async function GET(request: Request) {
  const baseUrl = new URL(request.url);
  const code = baseUrl.searchParams.get("code");
  const state = baseUrl.searchParams.get("state");
  const oauthError = baseUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      buildRedirect(baseUrl, "/client/connections/gmail", { error: "google-denied" }),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      buildRedirect(baseUrl, "/client/connections/gmail", { error: "google-missing-code" }),
    );
  }

  try {
    const statePayload = verifyGoogleState(state);
    const session = await auth();

    if (
      !session?.user ||
      session.user.role !== "CLIENT" ||
      !session.user.tenantId ||
      session.user.tenantId !== statePayload.tenantId
    ) {
      return NextResponse.redirect(
        buildRedirect(baseUrl, "/login", { callbackUrl: statePayload.redirectTo }),
      );
    }

    const tokens = await exchangeGoogleCode(code);
    const profile = await fetchGoogleProfile(tokens.access_token);
    const credentials = JSON.stringify(tokens);
    const metadata = {
      provider: "google",
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
      scopes: tokens.scope?.split(" ").filter(Boolean) ?? [],
      connectedAt: new Date().toISOString(),
    };

    await upsertChannelConnection({
      tenantId: statePayload.tenantId,
      type: ChannelType.GMAIL,
      status: ConnectionStatus.CONNECTED,
      credentials,
      metadata: {
        ...metadata,
        channel: "gmail",
      },
    });

    for (const integrationType of [
      IntegrationType.GOOGLE_CALENDAR,
      IntegrationType.GOOGLE_SHEETS,
      IntegrationType.GOOGLE_DRIVE,
    ]) {
      await upsertIntegrationConnection({
        tenantId: statePayload.tenantId,
        type: integrationType,
        status: ConnectionStatus.CONNECTED,
        credentials,
        metadata: {
          ...metadata,
          via: "google_workspace_oauth",
        },
      });
    }

    return NextResponse.redirect(
      buildRedirect(baseUrl, statePayload.redirectTo, { saved: "channel" }),
    );
  } catch {
    return NextResponse.redirect(
      buildRedirect(baseUrl, "/client/connections/gmail", { error: "google-oauth" }),
    );
  }
}
