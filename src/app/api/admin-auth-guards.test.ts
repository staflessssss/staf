import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function listRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return listRouteFiles(fullPath);
    }

    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

test("all admin API routes require admin sessions before handler logic", () => {
  const routeFiles = listRouteFiles(resolve(process.cwd(), "src/app/api/admin"));

  assert.ok(routeFiles.length > 0);

  for (const routeFile of routeFiles) {
    const source = readFileSync(routeFile, "utf8");
    const routePath = routeFile.replace(`${process.cwd()}\\`, "");
    const methods = [...source.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)];

    assert.ok(methods.length > 0, routePath);
    assert.match(source, /import \{ requireAdminApiSession \}/, routePath);

    for (const method of methods) {
      assert.match(
        source,
        new RegExp(`export async function ${method[1]}[\\s\\S]*?const session = await requireAdminApiSession\\(\\);`),
        routePath,
      );
    }

    assert.equal(
      source.match(/const session = await requireAdminApiSession\(\);/g)?.length,
      methods.length,
      routePath,
    );
    assert.equal(
      source.match(/if \(session instanceof NextResponse\) \{\s*return session;\s*\}/g)?.length,
      methods.length,
      routePath,
    );
  }
});
