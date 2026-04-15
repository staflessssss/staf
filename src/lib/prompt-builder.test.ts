import test from "node:test";
import assert from "node:assert/strict";

import { buildSystemPrompt } from "@/lib/prompt-builder";

test("buildSystemPrompt includes multilingual behavior, knowledge, and tools", () => {
  const prompt = buildSystemPrompt({
    name: "Studio Concierge",
    persona: "A premium front-desk operator",
    tone: "calm",
    languagePreference: "Russian",
    channel: { type: "INSTAGRAM" },
    knowledgeBlocks: [
      {
        name: "Services",
        description: "What the studio offers",
        knowledgeContent: "Wedding films and highlight edits.",
      },
    ],
    toolBlocks: [
      {
        name: "Calendar check",
        description: "Verify availability",
        steps: [{ integrationType: "GOOGLE_CALENDAR", action: "check calendar" }],
      },
    ],
  });

  assert.match(prompt, /Agent identity: Studio Concierge/);
  assert.match(prompt, /Preferred default response language: Russian/);
  assert.match(prompt, /Channel: Instagram/);
  assert.match(prompt, /Opening rule: In the first reply of a new conversation, warmly greet the customer, introduce yourself by name/i);
  assert.match(prompt, /Knowledge/);
  assert.match(prompt, /Tools/);
  assert.match(prompt, /Google Calendar: check calendar/);
});
