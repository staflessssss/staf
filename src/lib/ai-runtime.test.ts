import test from "node:test";
import assert from "node:assert/strict";

import { invokeAgent } from "@/lib/ai-runtime";

test("invokeAgent sandbox mentions runtime tooling when configured", async () => {
  const result = await invokeAgent({
    tenantId: "tenant-1",
    channel: "INSTAGRAM",
    contactId: "sandbox-contact",
    message: "Is July 14 available?",
    promptPreview: "preview",
    languagePreference: "English",
    knowledgeBlocks: [
      {
        name: "Services",
        description: "Wedding films",
        knowledgeContent: "We focus on weddings.",
      },
    ],
    toolBlocks: [
      {
        name: "Calendar check",
        description: "Verify date availability",
        steps: [{ action: "check calendar", integrationType: "GOOGLE_CALENDAR" }],
      },
    ],
  });

  assert.match(result.message, /default business voice in English/i);
  assert.match(result.message, /shared runtime configuration/i);
  assert.match(result.message, /configured tools/i);
  assert.deepEqual(result.usedTooling, ["Calendar check"]);
});

test("invokeAgent sandbox stays multilingual-first without tools", async () => {
  const result = await invokeAgent({
    tenantId: "tenant-1",
    channel: "TELEGRAM",
    contactId: "sandbox-contact",
    message: "Please book me in and capture this lead.",
  });

  assert.match(result.message, /multilingual-first/i);
  assert.match(result.message, /No runtime tool needed/i);
  assert.deepEqual(result.usedTooling, []);
});
