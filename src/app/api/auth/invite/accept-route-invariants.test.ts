import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const routeSource = () =>
  readFileSync(resolve("src/app/api/auth/invite/accept/route.ts"), "utf8");

test("invite acceptance validates payload before rate limits or database access", () => {
  const source = routeSource();
  const parseIndex = source.indexOf("acceptInviteSchema.safeParse(json)");
  const rateLimitIndex = source.indexOf("checkRateLimit({");
  const inviteLookupIndex = source.indexOf("db.inviteToken.findUnique");

  assert.ok(parseIndex > 0);
  assert.ok(rateLimitIndex > parseIndex);
  assert.ok(inviteLookupIndex > rateLimitIndex);
});

test("invite acceptance enforces invite lifecycle before creating a user", () => {
  const source = routeSource();
  const inviteInvalidIndex = source.indexOf("!invite || invite.usedAt || invite.expiresAt < new Date()");
  const existingUserIndex = source.indexOf("db.user.findUnique");
  const createUserIndex = source.indexOf("tx.user.create");

  assert.ok(inviteInvalidIndex > 0);
  assert.ok(existingUserIndex > inviteInvalidIndex);
  assert.ok(createUserIndex > existingUserIndex);
  assert.match(source, /status: 400/);
  assert.match(source, /status: 409/);
});

test("invite acceptance atomically creates the tenant-bound user and consumes the token", () => {
  const source = routeSource();

  assert.match(source, /db\.\$transaction\(async \(tx\) =>/);
  assert.match(source, /role: invite\.role/);
  assert.match(source, /tenantId: invite\.tenantId/);
  assert.match(source, /tx\.inviteToken\.update\(/);
  assert.match(source, /data: \{ usedAt: new Date\(\) \}/);
});
