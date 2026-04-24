import test from "node:test";
import assert from "node:assert/strict";

import { delayedDeliveryBackgroundTestHelpers } from "@/lib/delayed-delivery-background";

test("readBufferedDeliverySchedule returns delivery metadata for buffered replies", () => {
  const parsed = delayedDeliveryBackgroundTestHelpers.readBufferedDeliverySchedule({
    status: "buffered_reply_scheduled",
    bufferedDeliveryId: "delivery-1",
    bufferedDueAt: "2026-04-23T17:10:00.000Z",
  });

  assert.deepEqual(parsed, {
    deliveryId: "delivery-1",
    dueAt: new Date("2026-04-23T17:10:00.000Z"),
  });
});

test("readBufferedDeliverySchedule ignores non-buffered results", () => {
  const parsed = delayedDeliveryBackgroundTestHelpers.readBufferedDeliverySchedule({
    status: "waiting_for_schedule_window",
    conversationId: "conv-1",
  });

  assert.equal(parsed, null);
});

test("getBufferedDeliveryExecutionPlan chooses inline execution for short buffer windows", () => {
  const plan = delayedDeliveryBackgroundTestHelpers.getBufferedDeliveryExecutionPlan({
    result: {
      status: "buffered_reply_scheduled",
      bufferedDeliveryId: "delivery-1",
      bufferedDueAt: "2026-04-23T17:10:03.000Z",
    },
    now: () => new Date("2026-04-23T17:10:00.000Z"),
  });

  assert.deepEqual(plan, {
    deliveryId: "delivery-1",
    dueAt: new Date("2026-04-23T17:10:03.000Z"),
    mode: "inline",
  });
});

test("getBufferedDeliveryExecutionPlan keeps longer buffer windows in background mode", () => {
  const plan = delayedDeliveryBackgroundTestHelpers.getBufferedDeliveryExecutionPlan({
    result: {
      status: "buffered_reply_scheduled",
      bufferedDeliveryId: "delivery-1",
      bufferedDueAt: "2026-04-23T17:10:08.000Z",
    },
    now: () => new Date("2026-04-23T17:10:00.000Z"),
  });

  assert.deepEqual(plan, {
    deliveryId: "delivery-1",
    dueAt: new Date("2026-04-23T17:10:08.000Z"),
    mode: "background",
  });
});
