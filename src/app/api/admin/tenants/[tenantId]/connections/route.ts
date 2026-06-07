import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { ChannelType, IntegrationType } from "@prisma/client";
import { z } from "zod";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { getInstagramCredentialsValidationError } from "@/lib/channels/instagram";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

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

const safeConnectionSelect = {
  id: true,
  tenantId: true,
  type: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

    const item = await db.channelConnection.upsert({
      where: {
        tenantId_type: {
          tenantId,
          type: parsed.data.type,
        },
      },
      update: {
        status: parsed.data.status,
        credentialsEnc: encrypt(parsed.data.credentials),
        metadata,
      },
      create: {
        tenantId,
        type: parsed.data.type,
        status: parsed.data.status,
        credentialsEnc: encrypt(parsed.data.credentials),
        metadata,
      },
      select: safeConnectionSelect,
    });

    return NextResponse.json({ item }, { status: 201 });
  }

  const item = await db.integrationConnection.upsert({
    where: {
      tenantId_type: {
        tenantId,
        type: parsed.data.type,
      },
    },
    update: {
      status: parsed.data.status,
      credentialsEnc: encrypt(parsed.data.credentials),
      metadata,
    },
    create: {
      tenantId,
      type: parsed.data.type,
      status: parsed.data.status,
      credentialsEnc: encrypt(parsed.data.credentials),
      metadata,
    },
    select: safeConnectionSelect,
  });

  return NextResponse.json({ item }, { status: 201 });
}
