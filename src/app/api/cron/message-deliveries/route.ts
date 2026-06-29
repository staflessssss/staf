import { NextRequest, NextResponse } from "next/server";

import { processDueDelayedDeliveriesWithDeps } from "@/lib/message-delivery-runtime";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getChannelAdapter } from "@/lib/channels";
import { invokeAgent } from "@/lib/ai-runtime";
import { saveMessages } from "@/lib/agent-memory";
import { renewDueGmailWatches } from "@/lib/gmail-watch";
import { cleanupExpiredRateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const hostname = request.nextUrl.hostname;
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    (hostname === "localhost" || hostname === "127.0.0.1");

  if (configuredSecret) {
    return request.headers.get("authorization") === `Bearer ${configuredSecret.trim()}`;
  }

  return isLocalDev;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "");
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 25;
  const results = await processDueDelayedDeliveriesWithDeps(
    {
      db,
      decrypt,
      getChannelAdapter,
      invokeAgent,
      saveMessages,
    },
    new Date(),
    limit,
  );
  const gmailWatchRenewal = await renewDueGmailWatches();
  const rateLimitCleanup = await cleanupExpiredRateLimits();

  return NextResponse.json({
    ok: true,
    processed: results.length,
    gmailWatchRenewal,
    expiredRateLimitBucketsDeleted: rateLimitCleanup.count,
    results,
  });
}
