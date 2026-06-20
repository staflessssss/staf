import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const readSource = (path: string) => readFileSync(resolve(path), "utf8");

test("admin tenant routes delegate business rules to the shared tenant admin service", () => {
  const tenantsRoute = readSource("src/app/api/admin/tenants/route.ts");
  const tenantRoute = readSource("src/app/api/admin/tenants/[tenantId]/route.ts");
  const inviteRoute = readSource("src/app/api/admin/tenants/[tenantId]/invite/route.ts");

  assert.match(tenantsRoute, /createTenantWithDeps\(db, json\)/);
  assert.doesNotMatch(tenantsRoute, /slugify/);
  assert.doesNotMatch(tenantsRoute, /z\.object/);

  assert.match(tenantRoute, /updateTenantWithDeps\(db, tenantId, json\)/);
  assert.doesNotMatch(tenantRoute, /z\.object/);

  assert.match(inviteRoute, /createInviteWithDeps\(db, tenantId, json\)/);
  assert.doesNotMatch(inviteRoute, /1000 \* 60 \* 60 \* 24 \* 7/);
  assert.doesNotMatch(inviteRoute, /z\.object/);
});

test("tenant server actions reuse shared tenant admin service logic", () => {
  const source = readSource("src/lib/tenant-actions.ts");

  assert.match(source, /createTenantWithDeps\(db,/);
  assert.match(source, /createInviteWithDeps\(db, tenantId,/);
  assert.doesNotMatch(source, /db\.inviteToken\.create/);
  assert.doesNotMatch(source, /1000 \* 60 \* 60 \* 24 \* 7/);
});
