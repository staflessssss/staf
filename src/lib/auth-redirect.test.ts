import assert from "node:assert/strict";
import test from "node:test";

import { normalizeInternalRedirect } from "@/lib/auth-redirect";

test("internal redirect normalization blocks external redirect forms", () => {
  assert.equal(normalizeInternalRedirect("/client/connections"), "/client/connections");
  assert.equal(normalizeInternalRedirect("https://attacker.example"), "/client");
  assert.equal(normalizeInternalRedirect("//attacker.example"), "/client");
  assert.equal(normalizeInternalRedirect("/\\attacker.example"), "/client");
});
