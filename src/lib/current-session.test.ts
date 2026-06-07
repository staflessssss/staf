import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const readSource = (path: string) => readFileSync(resolve(path), "utf8");

test("authorization guards revalidate JWT users against the database", () => {
  const currentSession = readSource("src/lib/current-session.ts");

  assert.match(currentSession, /db\.user\.findUnique/);
  assert.match(currentSession, /where: \{ id: session\.user\.id \}/);

  for (const path of [
    "src/lib/admin-api-auth.ts",
    "src/lib/client-api-auth.ts",
    "src/lib/admin-auth.ts",
    "src/lib/client-auth.ts",
  ]) {
    assert.match(readSource(path), /getCurrentSession\(\)/, path);
  }
});

test("OAuth routes use current database-backed client authorization", () => {
  for (const path of [
    "src/app/api/google/connect/route.ts",
    "src/app/api/google/callback/route.ts",
    "src/app/api/instagram/connect/route.ts",
    "src/app/api/instagram/callback/route.ts",
  ]) {
    const source = readSource(path);
    assert.match(source, /getCurrentSession\(\)/, path);
    assert.doesNotMatch(source, /\bauth\(\)/, path);
  }
});
