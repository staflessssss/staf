import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminStatusRouteSource = readFileSync(
  "src/app/api/admin/tenants/[tenantId]/agents/[agentId]/status/route.ts",
  "utf8",
);

test("admin agent status route updates only operational status", () => {
  assert.match(adminStatusRouteSource, /requireAdminApiSession/);
  assert.match(adminStatusRouteSource, /tenantId/);
  assert.match(adminStatusRouteSource, /AgentStatus\.ACTIVE/);
  assert.match(adminStatusRouteSource, /AgentStatus\.PAUSED/);
  assert.match(adminStatusRouteSource, /data: \{ status: nextStatus \}/);
  assert.doesNotMatch(adminStatusRouteSource, /agentDraftSchema/);
  assert.doesNotMatch(adminStatusRouteSource, /tone:/);
});

test("admin pausing an agent cancels pending and processing delayed deliveries", () => {
  assert.match(adminStatusRouteSource, /delayedDelivery\.updateMany/);
  assert.match(adminStatusRouteSource, /DelayedDeliveryStatus\.PENDING/);
  assert.match(adminStatusRouteSource, /DelayedDeliveryStatus\.PROCESSING/);
  assert.match(adminStatusRouteSource, /DelayedDeliveryStatus\.CANCELED/);
});
