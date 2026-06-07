import { ChannelType, ConnectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { upsertChannelConnection } from "@/lib/connection-store";
import { getCurrentSession } from "@/lib/current-session";
import {
  exchangeInstagramCode,
  fetchInstagramProfile,
  getMetaOAuthConfig,
  normalizeInstagramRedirectTo,
  subscribeInstagramWebhooks,
  verifyInstagramState,
} from "@/lib/instagram-oauth";

function buildRedirect(baseUrl: URL, redirectTo: string, params: Record<string, string>) {
  const target = new URL(normalizeInstagramRedirectTo(redirectTo), baseUrl);

  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }

  return target;
}

function getInstagramOAuthErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.startsWith("Instagram token exchange failed")) {
    return "instagram-token-exchange";
  }

  if (message.startsWith("Instagram long-lived token exchange failed")) {
    return "instagram-token-refresh";
  }

  if (message.startsWith("Instagram profile fetch failed")) {
    return "instagram-profile";
  }

  if (message.startsWith("Instagram OAuth credentials")) {
    return "instagram-config";
  }

  return "instagram-oauth";
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
    const session = await getCurrentSession();

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

    const token = await exchangeInstagramCode(code);
    const profile = await fetchInstagramProfile(token.access_token, token.user_id).catch((error) => {
      if (!token.user_id) {
        throw error;
      }

      console.error("[instagram-oauth] profile fetch failed; saving token user_id only", {
        error: error instanceof Error ? error.message : "unknown",
      });

      return {
        id: token.user_id,
        user_id: token.user_id,
        username: undefined,
        account_type: undefined,
      };
    });
    const graphApiVersion = getMetaOAuthConfig().graphApiVersion;
    const igUserId = profile.user_id ?? token.user_id ?? profile.id;
    const igScopedUserId = profile.id !== igUserId ? profile.id : null;

    if (!igUserId) {
      return NextResponse.redirect(
        buildRedirect(baseUrl, statePayload.redirectTo, { error: "instagram-no-account" }),
      );
    }

    const webhookSubscription = await subscribeInstagramWebhooks({
      accessToken: token.access_token,
      igUserId,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Instagram webhook subscription failed.";

      console.error("[instagram-oauth] webhook subscription failed", {
        error: message,
      });

      return {
        status: "subscription_failed",
        fields: [],
        error: message,
      };
    });

    const credentials = JSON.stringify({
      accessToken: token.access_token,
      instagramUserAccessToken: token.access_token,
      igUserId,
      igScopedUserId,
      graphApiVersion,
    });
    const metadata = {
      provider: "meta",
      source: "instagram_login",
      igUserId,
      igScopedUserId,
      igBusinessAccountId: null,
      instagramUsername: profile.username ?? null,
      instagramAccountType: profile.account_type ?? null,
      graphApiVersion,
      scopes: ["instagram_business_basic", "instagram_business_manage_messages"],
      tokenExpiresIn: token.expires_in ?? null,
      tokenLifetime: token.tokenLifetime ?? null,
      tokenExchangeWarning: token.tokenExchangeWarning ?? null,
      webhookSubscriptionStatus: webhookSubscription.status,
      webhookSubscriptionError: "error" in webhookSubscription ? webhookSubscription.error : null,
      webhookSubscribedAt: webhookSubscription.status === "subscribed" ? new Date().toISOString() : null,
      webhookSubscribedFields: webhookSubscription.fields,
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
  } catch (error) {
    console.error("[instagram-oauth] callback failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.redirect(
      buildRedirect(baseUrl, "/client/connections/instagram", {
        error: getInstagramOAuthErrorCode(error),
      }),
    );
  }
}
