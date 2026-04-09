import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

type InviteRouteContext = {
  params: Promise<{ tenantId: string }>;
};

const createInviteSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request, context: InviteRouteContext) {
  const { tenantId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite payload." }, { status: 400 });
  }

  const invite = await db.inviteToken.create({
    data: {
      tenantId,
      email: parsed.data.email,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  return NextResponse.json({ item: invite }, { status: 201 });
}
