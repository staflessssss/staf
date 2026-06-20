import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const readSource = (path: string) => readFileSync(resolve(path), "utf8");

test("admin clients list stays protected and client-centric", () => {
  const source = readSource("src/app/admin/clients/page.tsx");

  assert.match(source, /requireAdminSession\(\)/);
  assert.match(source, /db\.tenant\.findMany/);
  assert.match(source, /channelConnections/);
  assert.match(source, /integrationConnections/);
  assert.match(source, /agents/);
  assert.match(source, /href=\{`\/admin\/clients\/\$\{client\.id\}`\}/);
  assert.doesNotMatch(source, /\/admin\/tenants\/\$\{client\.id\}/);
});

test("admin client detail exposes tenant readiness and invite-relevant account context", () => {
  const source = readSource("src/app/admin/clients/[clientId]/page.tsx");

  assert.match(source, /requireAdminSession\(\)/);
  assert.match(source, /where: \{ id: clientId \}/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /channelConnections/);
  assert.match(source, /integrationConnections/);
  assert.match(source, /users: \{ orderBy: \{ createdAt: "desc" \} \}/);
  assert.match(source, /availableChannels\.length > 0/);
  assert.match(source, /\/admin\/clients\/\$\{client\.id\}\/agents\/new/);
  assert.match(source, /One connected channel can only belong to one agent/);
});
