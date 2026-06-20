import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultRedirectForRole,
  normalizeInternalRedirect,
} from "@/lib/auth-redirect";

test("role redirects keep admin and client surfaces separate by default", () => {
  assert.equal(getDefaultRedirectForRole("ADMIN"), "/admin");
  assert.equal(getDefaultRedirectForRole("CLIENT"), "/client");
  assert.equal(getDefaultRedirectForRole(null), "/client");
  assert.equal(getDefaultRedirectForRole(undefined), "/client");
  assert.equal(getDefaultRedirectForRole("OWNER"), "/client");
});

test("internal redirect normalization blocks external redirect forms", () => {
  assert.equal(normalizeInternalRedirect("/client/connections"), "/client/connections");
  assert.equal(normalizeInternalRedirect(""), "/client");
  assert.equal(normalizeInternalRedirect("   "), "/client");
  assert.equal(normalizeInternalRedirect("https://attacker.example"), "/client");
  assert.equal(normalizeInternalRedirect("//attacker.example"), "/client");
  assert.equal(normalizeInternalRedirect("/\\attacker.example"), "/client");
  assert.equal(normalizeInternalRedirect("\\attacker.example"), "/client");
  assert.equal(
    normalizeInternalRedirect("https://attacker.example", "/admin"),
    "/admin",
  );
});
