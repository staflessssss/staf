import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = acceptInviteSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid invite payload." },
      { status: 400 },
    );
  }

  const requestIp = getRequestIp(request);
  const ipLimit = await checkRateLimit({
    scope: "invite-accept-ip",
    identifier: requestIp,
    limit: 30,
    windowSeconds: 15 * 60,
  });
  const inviteLimit = await checkRateLimit({
    scope: "invite-accept",
    identifier: `${requestIp}:${parsed.data.token}`,
    limit: 10,
    windowSeconds: 15 * 60,
  });

  if (!ipLimit.allowed || !inviteLimit.allowed) {
    return rateLimitResponse(ipLimit.allowed ? inviteLimit : ipLimit);
  }

  const invite = await db.inviteToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invite is invalid or expired." },
      { status: 400 },
    );
  }

  const existingUser = await db.user.findUnique({
    where: { email: invite.email },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "A user with this email already exists." },
      { status: 409 },
    );
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

  const user = await db.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: invite.email,
        hashedPassword,
        name: parsed.data.name,
        role: invite.role,
        tenantId: invite.tenantId,
      },
    });

    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return createdUser;
  });

  return NextResponse.json({
    ok: true,
    email: user.email,
    role: user.role,
  });
}
