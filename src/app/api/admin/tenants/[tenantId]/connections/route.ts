import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { ChannelType, IntegrationType } from "@prisma/client";
import { z } from "zod";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { getInstagramCredentialsValidationError } from "@/lib/channels/instagram";
import { db } from "@/lib/db";
import {
  safeConnectionSelect,
  upsertChannelConnectionWithDeps,
  upsertIntegrationConnectionWithDeps,
} from "@/lib/connection-store";
import { encrypt } from "@/lib/crypto";

type ConnectionsRouteContext = {
  params: Promise<{ tenantId: string }>;
};

const connectionBaseSchema = z.object({
  status: z.enum(["PENDING", "CONNECTED", "ERROR", "REVOKED"]),
  credentials: z.string().min(2),
  metadata: z.unknown().optional(),
});

const createConnectionSchema = z.discriminatedUnion("scope", [
  connectionBaseSchema.extend({
    scope: z.literal("channel"),
    type: z.nativeEnum(ChannelType),
  }),
  connectionBaseSchema.extend({
    scope: z.literal("integration"),
    type: z.nativeEnum(IntegrationType),
  }),
]);

export async function GET(_: Request, context: ConnectionsRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const { tenantId } = await context.params;
  const [channelConnections, integrationConnections] = await Promise.all([
    db.channelConnection.findMany({
      where: { tenantId },
      orderBy: { type: "asc" },
      select: safeConnectionSelect,
    }),
    db.integrationConnection.findMany({
      where: { tenantId },
      orderBy: { type: "asc" },
      select: safeConnectionSelect,
    }),
  ]);

  return NextResponse.json({
    tenantId,
    channelConnections,
    integrationConnections,
  });
}

export async function POST(request: Request, context: ConnectionsRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const { tenantId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = createConnectionSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: `Invalid connection payload for tenant ${tenantId}` },
      { status: 400 },
    );
  }

  const metadata = (parsed.data.metadata ?? undefined) as
    | Prisma.InputJsonValue
    | undefined;

  if (parsed.data.scope === "channel") {
    if (parsed.data.type === ChannelType.INSTAGRAM && parsed.data.status === "CONNECTED") {
      const credentialsError = getInstagramCredentialsValidationError(parsed.data.credentials);

      if (credentialsError) {
        return NextResponse.json(
          { error: credentialsError },
          { status: 400 },
        );
      }
    }

    const item = await upsertChannelConnectionWithDeps(
      db,
      encrypt,
      {
        tenantId,
        type: parsed.data.type,
        status: parsed.data.status,
        credentials: parsed.data.credentials,
        metadata,
      },
      safeConnectionSelect,
    );

    return NextResponse.json({ item }, { status: 201 });
  }

  const item = await upsertIntegrationConnectionWithDeps(
    db,
    encrypt,
    {
      tenantId,
      type: parsed.data.type,
      status: parsed.data.status,
      credentials: parsed.data.credentials,
      metadata,
    },
    safeConnectionSelect,
  );

  return NextResponse.json({ item }, { status: 201 });
}
