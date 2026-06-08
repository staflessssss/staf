import {
  AgentStatus,
  DelayedDeliveryStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireClientApiSession } from "@/lib/client-api-auth";
import { db } from "@/lib/db";

const agentStatusSchema = z.object({
  status: z.enum([AgentStatus.ACTIVE, AgentStatus.PAUSED]),
});

type AgentStatusRouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function PATCH(request: Request, context: AgentStatusRouteContext) {
  const session = await requireClientApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const tenantId = session.user.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "Client tenant is missing." }, { status: 403 });
  }

  const { agentId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = agentStatusSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid agent status." }, { status: 400 });
  }

  const existingAgent = await db.agent.findFirst({
    where: {
      id: agentId,
      tenantId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingAgent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (
    existingAgent.status !== AgentStatus.ACTIVE &&
    existingAgent.status !== AgentStatus.PAUSED
  ) {
    return NextResponse.json(
      { error: "This agent cannot be paused or resumed in its current state." },
      { status: 409 },
    );
  }

  const nextStatus = parsed.data.status;
  const now = new Date();

  try {
    const item = await db.$transaction(async (tx) => {
      const update = await tx.agent.updateMany({
        where: {
          id: existingAgent.id,
          tenantId,
          status: existingAgent.status,
        },
        data: { status: nextStatus },
      });

      if (update.count !== 1) {
        throw new Error("Agent status changed. Refresh and try again.");
      }

      if (nextStatus === AgentStatus.PAUSED) {
        await tx.delayedDelivery.updateMany({
          where: {
            agentId: existingAgent.id,
            status: {
              in: [
                DelayedDeliveryStatus.PENDING,
                DelayedDeliveryStatus.PROCESSING,
              ],
            },
          },
          data: {
            status: DelayedDeliveryStatus.CANCELED,
            canceledAt: now,
            error: "Canceled because the client paused the agent.",
          },
        });
      }

      return {
        id: existingAgent.id,
        status: nextStatus,
      };
    });

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update agent status.",
      },
      { status: 409 },
    );
  }
}
