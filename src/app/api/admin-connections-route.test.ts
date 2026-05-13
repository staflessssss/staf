import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(
  process.cwd(),
  "src/app/api/admin/tenants/[tenantId]/connections/route.ts",
);

test("admin connections route requires an admin session for read and write access", () => {
  const source = readFileSync(routePath, "utf8");

  assert.match(source, /import \{ requireAdminApiSession \}/);
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function POST/);
  assert.equal(
    source.match(/const session = await requireAdminApiSession\(\);/g)?.length,
    2,
  );
  assert.equal(
    source.match(/if \(session instanceof NextResponse\) \{\s*return session;\s*\}/g)?.length,
    2,
  );
});
