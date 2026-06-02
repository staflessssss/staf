import test from "node:test";
import assert from "node:assert/strict";

import { legalPages } from "./legal-content";

test("legal pages cover Meta app review requirements", () => {
  assert.deepEqual(Object.keys(legalPages).sort(), ["data-deletion", "privacy", "terms"]);

  const privacyText = legalPages.privacy.sections.flatMap((section) => section.body).join(" ");
  assert.match(privacyText, /Gmail/);
  assert.match(privacyText, /Instagram/);
  assert.match(privacyText, /Facebook/);
  assert.match(privacyText, /OAuth/);
  assert.match(privacyText, /messages/i);

  const deletionText = legalPages["data-deletion"].sections.flatMap((section) => section.body).join(" ");
  assert.match(deletionText, /contact@behalfy\.io/);
  assert.match(deletionText, /30 days/);
  assert.match(deletionText, /Instagram or Facebook data/);
});
