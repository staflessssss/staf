import assert from "node:assert/strict";
import test from "node:test";

import {
  conversationMemoryTestHelpers,
  mergeConversationMemory,
  type ConversationMemoryExtraction,
} from "@/lib/conversation-memory";

function completeMemorySet() {
  return {
    contactRole: null,
    customerName: null,
    partnerName: null,
    weddingDate: null,
    location: null,
    serviceRegion: null,
    venue: null,
    venueStatus: null,
    proposedCallTime: null,
    customerEmail: null,
    bookingConfirmed: null,
    pricingShown: null,
    guideSent: null,
    booked: null,
  };
}

test("structured memory output requires every nullable field", () => {
  const valid = conversationMemoryTestHelpers.memoryExtractionOutputSchema.safeParse({
    memorySet: completeMemorySet(),
    memoryClear: [],
    confidence: 0.9,
  });
  const missingField = completeMemorySet() as Record<string, unknown>;
  delete missingField.customerName;
  const invalid = conversationMemoryTestHelpers.memoryExtractionOutputSchema.safeParse({
    memorySet: missingField,
    memoryClear: [],
    confidence: 0.9,
  });
  const invalidDate = conversationMemoryTestHelpers.memoryExtractionOutputSchema.safeParse({
    memorySet: {
      ...completeMemorySet(),
      weddingDate: "October 16, 2026",
    },
    memoryClear: [],
    confidence: 0.9,
  });

  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
  assert.equal(invalidDate.success, false);
});

test("normalization treats null as no update", () => {
  const output = conversationMemoryTestHelpers.memoryExtractionOutputSchema.parse({
    memorySet: {
      ...completeMemorySet(),
      contactRole: "third_party",
      customerName: "Analeigh Brooks",
      partnerName: "Jackson Ellerbee",
    },
    memoryClear: [],
    confidence: 0.94,
  });

  assert.deepEqual(
    conversationMemoryTestHelpers.normalizeMemoryExtractionOutput(output),
    {
      status: "success",
      memorySet: {
        contactRole: "third_party",
        customerName: "Analeigh Brooks",
        partnerName: "Jackson Ellerbee",
      },
      memoryClear: [],
      confidence: 0.94,
    },
  );
});

test("memory clear is the only operation that removes an existing value", () => {
  const keepVenue: ConversationMemoryExtraction = {
    status: "success",
    memorySet: {},
    memoryClear: [],
    confidence: 0.95,
  };
  const clearVenue: ConversationMemoryExtraction = {
    status: "success",
    memorySet: { venueStatus: "not_finalized" },
    memoryClear: ["venue"],
    confidence: 0.95,
  };
  const current = {
    venue: "The Bradford",
    venueStatus: "known" as const,
  };

  assert.deepEqual(mergeConversationMemory(current, keepVenue), current);
  assert.deepEqual(mergeConversationMemory(current, clearVenue), {
    venueStatus: "not_finalized",
  });
});

test("failed and low-confidence extraction cannot mutate CRM memory", () => {
  const current = {
    weddingDate: "2026-10-16",
    location: "Raleigh, NC",
  };
  const failed: ConversationMemoryExtraction = {
    status: "schema_error",
    memorySet: { weddingDate: "2026-10-17" },
    memoryClear: ["location"],
    confidence: 1,
  };
  const lowConfidence: ConversationMemoryExtraction = {
    status: "success",
    memorySet: { weddingDate: "2026-10-17" },
    memoryClear: ["location"],
    confidence: 0.69,
  };

  assert.deepEqual(mergeConversationMemory(current, failed), current);
  assert.deepEqual(mergeConversationMemory(current, lowConfidence), current);
});

test("extractor errors are classified and API keys are redacted", () => {
  const timeout = conversationMemoryTestHelpers.classifyMemoryExtractionError(
    new Error("Request timed out"),
  );
  const schema = conversationMemoryTestHelpers.classifyMemoryExtractionError(
    new Error("Invalid schema for response_format using sk-secret-value"),
  );

  assert.equal(timeout.status, "timeout");
  assert.equal(schema.status, "schema_error");
  assert.doesNotMatch(schema.error?.message ?? "", /sk-secret-value/);
});

test("assistant promises cannot mark guide delivery or booking as successful", () => {
  const claimed: ConversationMemoryExtraction = {
    status: "success",
    memorySet: {
      pricingShown: true,
      guideSent: true,
      booked: true,
    },
    memoryClear: [],
    confidence: 0.95,
  };

  const grounded = conversationMemoryTestHelpers.groundOperationalMemory(claimed, [
    { role: "assistant", content: "I sent the guide and booked your consultation." },
  ]);

  assert.deepEqual(grounded.memorySet, {});
});

test("successful tool results authoritatively update operational memory", () => {
  const extraction: ConversationMemoryExtraction = {
    status: "success",
    memorySet: {},
    memoryClear: [],
    confidence: 0.95,
  };
  const grounded = conversationMemoryTestHelpers.groundOperationalMemory(extraction, [
    {
      role: "tool",
      toolName: "send_collections_guide",
      content: JSON.stringify({ status: "ready_to_attach" }),
    },
    {
      role: "tool",
      toolName: "Book consultation call",
      content: JSON.stringify({ status: "booked" }),
    },
  ]);

  assert.deepEqual(grounded.memorySet, {
    pricingShown: true,
    guideSent: true,
    bookingConfirmed: true,
    booked: true,
  });
});

test("blocked tools cannot update operational memory", () => {
  const extraction: ConversationMemoryExtraction = {
    status: "success",
    memorySet: { guideSent: true, booked: true },
    memoryClear: [],
    confidence: 0.95,
  };
  const grounded = conversationMemoryTestHelpers.groundOperationalMemory(extraction, [
    {
      role: "tool",
      toolName: "send_collections_guide",
      content: JSON.stringify({ status: "blocked_precondition" }),
    },
    {
      role: "tool",
      toolName: "Book consultation call",
      content: JSON.stringify({ status: "needs_email" }),
    },
  ]);

  assert.deepEqual(grounded.memorySet, {});
});

test("explicit delivery evidence overrides a ready attachment tool result", () => {
  const extraction: ConversationMemoryExtraction = {
    status: "success",
    memorySet: { guideSent: true, pricingShown: true },
    memoryClear: [],
    confidence: 0.95,
  };
  const grounded = conversationMemoryTestHelpers.groundOperationalMemory(
    extraction,
    [
      {
        role: "tool",
        toolName: "send_collections_guide",
        content: JSON.stringify({ status: "ready_to_attach" }),
      },
    ],
    { guideDelivered: false },
  );

  assert.deepEqual(grounded.memorySet, {});
});
