import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function listRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return listRouteFiles(fullPath);
    }

    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

test("all client API routes require client sessions before handler logic", () => {
  const routeFiles = listRouteFiles(resolve(process.cwd(), "src/app/api/client"));

  assert.ok(routeFiles.length > 0);

  for (const routeFile of routeFiles) {
    const source = readFileSync(routeFile, "utf8");
    const routePath = routeFile.replace(`${process.cwd()}\\`, "");
    const methods = [...source.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)];

    assert.ok(methods.length > 0, routePath);
    assert.match(source, /import \{ requireClientApiSession \}/, routePath);

    for (const method of methods) {
      const methodSource = source.slice(source.indexOf(`export async function ${method[1]}`));
      const guardIndex = methodSource.indexOf("const session = await requireClientApiSession();");

      assert.ok(guardIndex >= 0, routePath);

      assert.match(
        source,
        new RegExp(`export async function ${method[1]}[\\s\\S]*?const session = await requireClientApiSession\\(\\);`),
        routePath,
      );

      for (const riskyOperation of [
        ".json()",
        "db.",
        "invokeAgent(",
      ]) {
        const riskyIndex = methodSource.indexOf(riskyOperation);

        if (riskyIndex >= 0) {
          assert.ok(
            guardIndex < riskyIndex,
            `${routePath} should require a client session before ${riskyOperation}`,
          );
        }
      }
    }

    assert.equal(
      source.match(/const session = await requireClientApiSession\(\);/g)?.length,
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
