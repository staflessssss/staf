import { ChannelType, ConnectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { upsertChannelConnection } from "@/lib/connection-store";
import {
  exchangeInstagramCode,
  fetchInstagramPages,
  getMetaOAuthConfig,
  subscribeInstagramPageToWebhooks,
  normalizeInstagramRedirectTo,
  verifyInstagramState,
} from "@/lib/instagram-oauth";

function buildRedirect(baseUrl: URL, redirectTo: string, params: Record<string, string>) {
  const target = new URL(normalizeInstagramRedirectTo(redirectTo), baseUrl);

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
      buildRedirect(baseUrl, "/client/connections/instagram", { error: "instagram-denied" }),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      buildRedirect(baseUrl, "/client/connections/instagram", { error: "instagram-missing-code" }),
    );
  }

  try {
    const statePayload = verifyInstagramState(state);
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

    const userToken = await exchangeInstagramCode(code);
    const pages = await fetchInstagramPages(userToken.access_token);

    if (pages.length === 0) {
      return NextResponse.redirect(
        buildRedirect(baseUrl, statePayload.redirectTo, { error: "instagram-no-page" }),
      );
    }

    if (pages.length > 1) {
      return NextResponse.redirect(
        buildRedirect(baseUrl, statePayload.redirectTo, { error: "instagram-multiple-pages" }),
      );
    }

    const page = pages[0];
    const graphApiVersion = getMetaOAuthConfig().graphApiVersion;
    const subscriptionResult = await subscribeInstagramPageToWebhooks(page)
      .then(() => ({ ok: true as const, error: null }))
      .catch((error) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : "instagram_subscription_failed",
      }));

    const credentials = JSON.stringify({
      pageAccessToken: page.access_token,
      pageId: page.id,
      igBusinessAccountId: page.instagram_business_account?.id,
      graphApiVersion,
    });
    const metadata = {
      provider: "meta",
      source: "instagram_oauth",
      pageId: page.id,
      pageName: page.name ?? null,
      igBusinessAccountId: page.instagram_business_account?.id ?? null,
      instagramUsername: page.instagram_business_account?.username ?? null,
      graphApiVersion,
      scopes: userToken.token_type ? [] : [],
      webhookSubscriptionStatus: subscriptionResult.ok ? "subscribed" : "manual_or_dashboard_required",
      webhookSubscriptionError: subscriptionResult.error,
      webhookSubscribedAt: subscriptionResult.ok ? new Date().toISOString() : null,
      connectedAt: new Date().toISOString(),
    };

    await upsertChannelConnection({
      tenantId: statePayload.tenantId,
      type: ChannelType.INSTAGRAM,
      status: ConnectionStatus.CONNECTED,
      credentials,
      metadata,
    });

    return NextResponse.redirect(
      buildRedirect(baseUrl, statePayload.redirectTo, { saved: "channel" }),
    );
  } catch {
    return NextResponse.redirect(
      buildRedirect(baseUrl, "/client/connections/instagram", { error: "instagram-oauth" }),
    );
  }
}
