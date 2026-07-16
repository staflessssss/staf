import assert from "node:assert/strict";
import test from "node:test";

import { MessageRole } from "@prisma/client";

import {
  renderConversationHistory,
  renderConversationMemoryContext,
} from "@/lib/conversation-context";

test("configured conversation history is not silently truncated to twelve messages", () => {
  const history = Array.from({ length: 20 }, (_, index) => ({
    role: MessageRole.USER,
    content: index === 0 ? "January 23, 2027 in Jacksonville, Florida" : `message ${index + 1}`,
  }));

  const rendered = renderConversationHistory(history);

  assert.match(rendered, /January 23, 2027 in Jacksonville, Florida/);
  assert.match(rendered, /message 20/);
});

test("CRM context tells the model not to re-ask stable booking facts", () => {
  const rendered = renderConversationMemoryContext({
    customerName: "Kimberly Obrero",
    partnerName: "Steven Stanton",
    weddingDate: "2027-01-23",
    location: "Jacksonville, Florida",
    customerEmail: "kim.obrero@gmail.com",
    proposedCallTime: "2026-07-17T10:00:00-04:00",
  });

  assert.match(rendered, /weddingDate: 2027-01-23/);
  assert.match(rendered, /location: Jacksonville, Florida/);
  assert.match(rendered, /customerEmail: kim\.obrero@gmail\.com/);
  assert.match(rendered, /do not ask the customer to repeat them/i);
});
