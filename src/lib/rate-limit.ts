import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

type RateLimitRow = {
  count: number;
  windowStartedAt: Date;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkRateLimit(args: {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const now = new Date();
  const resetBefore = new Date(now.getTime() - args.windowSeconds * 1_000);
  const key = `${args.scope}:${hashKey(args.identifier)}`;

  try {
    const rows = await db.$queryRaw<RateLimitRow[]>(Prisma.sql`
      INSERT INTO "RateLimitBucket" ("key", "count", "windowStartedAt", "updatedAt")
      VALUES (${key}, 1, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."windowStartedAt" <= ${resetBefore} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "windowStartedAt" = CASE
          WHEN "RateLimitBucket"."windowStartedAt" <= ${resetBefore} THEN ${now}
          ELSE "RateLimitBucket"."windowStartedAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "windowStartedAt"
    `);
    const row = rows[0];
    const count = row?.count ?? 1;
    const windowStartedAt = row?.windowStartedAt ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (windowStartedAt.getTime() + args.windowSeconds * 1_000 - now.getTime()) / 1_000,
      ),
    );

    return {
      allowed: count <= args.limit,
      limit: args.limit,
      remaining: Math.max(0, args.limit - count),
      retryAfterSeconds,
    };
  } catch (error) {
    console.error("[rate-limit] database check failed; blocking request", {
      scope: args.scope,
      error: error instanceof Error ? error.message : "unknown",
    });

    return {
      allowed: false,
      limit: args.limit,
      remaining: 0,
      retryAfterSeconds: 60,
    };
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

export async function cleanupExpiredRateLimits(olderThan = new Date(Date.now() - 24 * 60 * 60 * 1_000)) {
  return db.rateLimitBucket.deleteMany({
    where: {
      updatedAt: { lt: olderThan },
    },
  });
}
