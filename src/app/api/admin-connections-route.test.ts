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

test("admin connections route validates connected Instagram credentials", () => {
  const source = readFileSync(routePath, "utf8");

  assert.match(source, /getInstagramCredentialsValidationError/);
  assert.match(source, /parsed\.data\.type === ChannelType\.INSTAGRAM/);
  assert.match(source, /parsed\.data\.status === "CONNECTED"/);
});

test("admin connections route validates connection type enums before Prisma writes", () => {
  const source = readFileSync(routePath, "utf8");

  assert.match(source, /z\.discriminatedUnion\("scope"/);
  assert.match(source, /z\.nativeEnum\(ChannelType\)/);
  assert.match(source, /z\.nativeEnum\(IntegrationType\)/);
  assert.doesNotMatch(source, /as never/);
});

test("admin connections route never returns encrypted credentials", () => {
  const source = readFileSync(routePath, "utf8");

  assert.match(source, /safeConnectionSelect/);
  assert.doesNotMatch(source, /credentialsEnc: true/);
});
