import { after } from "next/server";

import { invokeAgent } from "@/lib/ai-runtime";
import { saveMessages } from "@/lib/agent-memory";
import { getChannelAdapter } from "@/lib/channels";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  processDueDelayedDeliveriesWithDeps,
  runBufferedDeliveryWhenDueWithDeps,
} from "@/lib/message-delivery-runtime";

const MAX_INLINE_BUFFER_DELAY_MS = 5_000;

function getDelayedDeliveryRuntimeDeps() {
  return {
    db,
    decrypt,
    getChannelAdapter,
    invokeAgent,
    saveMessages,
  };
}

function readBufferedDeliverySchedule(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const parsed = result as Record<string, unknown>;
  const deliveryId =
    parsed.status === "buffered_reply_scheduled" && typeof parsed.bufferedDeliveryId === "string"
      ? parsed.bufferedDeliveryId
      : null;
  const dueAt =
    parsed.status === "buffered_reply_scheduled" &&
    parsed.bufferedDueAt instanceof Date
      ? parsed.bufferedDueAt
      : parsed.status === "buffered_reply_scheduled" &&
          typeof parsed.bufferedDueAt === "string"
        ? new Date(parsed.bufferedDueAt)
        : null;

  if (!deliveryId || !dueAt || Number.isNaN(dueAt.getTime())) {
    return null;
  }

  return {
    deliveryId,
    dueAt,
  };
}

function getBufferedDeliveryExecutionPlan(args: {
  result: unknown;
  now?: () => Date;
  maxInlineDelayMs?: number;
}) {
  const target = readBufferedDeliverySchedule(args.result);

  if (!target) {
    return null;
  }

  const getNow = args.now ?? (() => new Date());
  const maxInlineDelayMs = args.maxInlineDelayMs ?? MAX_INLINE_BUFFER_DELAY_MS;
  const delayMs = target.dueAt.getTime() - getNow().getTime();

  return {
    ...target,
    mode: delayMs <= maxInlineDelayMs ? ("inline" as const) : ("background" as const),
  };
}

export async function ensureBufferedDeliveryExecution(result: unknown) {
  const plan = getBufferedDeliveryExecutionPlan({
    result,
  });

  if (!plan) {
    return null;
  }

  if (plan.mode === "inline") {
    await runBufferedDeliveryWhenDueWithDeps({
      deliveryId: plan.deliveryId,
      dueAt: plan.dueAt,
      deps: getDelayedDeliveryRuntimeDeps(),
    });

    return plan;
  }

  after(async () => {
    await runBufferedDeliveryWhenDueWithDeps({
      deliveryId: plan.deliveryId,
      dueAt: plan.dueAt,
      deps: getDelayedDeliveryRuntimeDeps(),
    });
  });

  return plan;
}

export function scheduleDelayedDeliverySweepBackground(limit = 10) {
  after(async () => {
    await processDueDelayedDeliveriesWithDeps(getDelayedDeliveryRuntimeDeps(), new Date(), limit);
  });
}

export const delayedDeliveryBackgroundTestHelpers = {
  readBufferedDeliverySchedule,
  getBufferedDeliveryExecutionPlan,
};
