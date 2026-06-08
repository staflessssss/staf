import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "src/app/api/client/agents/[agentId]/status/route.ts",
  "utf8",
);

test("client agent status route is tenant scoped and only accepts active or paused", () => {
  assert.match(source, /requireClientApiSession/);
  assert.match(source, /tenantId/);
  assert.match(source, /AgentStatus\.ACTIVE/);
  assert.match(source, /AgentStatus\.PAUSED/);
});

test("pausing an agent cancels pending and processing delayed deliveries", () => {
  assert.match(source, /delayedDelivery\.updateMany/);
  assert.match(source, /DelayedDeliveryStatus\.PENDING/);
  assert.match(source, /DelayedDeliveryStatus\.PROCESSING/);
  assert.match(source, /DelayedDeliveryStatus\.CANCELED/);
});

test("runtime checks that the agent is still active immediately before delivery", () => {
  const runtimeSource = readFileSync("src/lib/ai-runtime.ts", "utf8");
  const deliveryRuntimeSource = readFileSync(
    "src/lib/message-delivery-runtime.ts",
    "utf8",
  );

  assert.match(runtimeSource, /agentStillActive/);
  assert.match(runtimeSource, /reply_suppressed_agent_paused/);
  assert.match(deliveryRuntimeSource, /buffered_reply_suppressed_agent_paused/);
  assert.match(deliveryRuntimeSource, /follow_up_suppressed_agent_paused/);
  assert.match(deliveryRuntimeSource, /business_auto_resume_suppressed_agent_paused/);
  assert.match(deliveryRuntimeSource, /markDeliverySentIfProcessing/);
});
