import assert from "node:assert/strict";
import test from "node:test";

import { AgentEventStatus, AgentEventType } from "@prisma/client";

import {
  isQualifiedLeadMemory,
  mapToolExecutionToAgentEvents,
} from "@/lib/agent-events";

test("maps display and canonical availability tools to one business event", () => {
  for (const toolName of ["check_wedding_availability", "Check wedding availability"]) {
    const events = mapToolExecutionToAgentEvents({
      toolName,
      toolResult: { steps: [{ result: { status: "available", available: true } }] },
    });

    assert.deepEqual(events.map((event) => event.type), [AgentEventType.AVAILABILITY_CHECKED]);
    assert.equal(events[0]?.status, AgentEventStatus.SUCCEEDED);
    assert.equal(events[0]?.metadata?.available, true);
  }
});

test("records blocked guide requests without treating them as successful sends", () => {
  const events = mapToolExecutionToAgentEvents({
    toolName: "send_collections_guide",
    toolResult: { status: "blocked_precondition" },
  });

  assert.equal(events[0]?.type, AgentEventType.PRICING_GUIDE_SENT);
  assert.equal(events[0]?.status, AgentEventStatus.BLOCKED);
});

test("counts a guide only when an attachment is ready", () => {
  const ready = mapToolExecutionToAgentEvents({
    toolName: "send_collections_guide",
    toolResult: { status: "ready_to_attach", attachment: { url: "https://example.com/guide.png" } },
  });
  const unavailable = mapToolExecutionToAgentEvents({
    toolName: "send_collections_guide",
    toolResult: { status: "not_configured" },
  });

  assert.equal(ready[0]?.status, AgentEventStatus.SUCCEEDED);
  assert.equal(unavailable[0]?.status, AgentEventStatus.FAILED);
});

test("successful consultation booking also qualifies the lead", () => {
  const events = mapToolExecutionToAgentEvents({
    toolName: "Book consultation call",
    toolResult: { steps: [{ result: { status: "booked" } }] },
  });

  assert.deepEqual(events.map((event) => event.type), [
    AgentEventType.CONSULTATION_BOOKED,
    AgentEventType.LEAD_QUALIFIED,
  ]);
});

test("booking and calendar precondition failures are not successful outcomes", () => {
  const booking = mapToolExecutionToAgentEvents({
    toolName: "book_consultation",
    toolResult: { status: "needs_email" },
  });
  const calendar = mapToolExecutionToAgentEvents({
    toolName: "check_consultation_calendar",
    toolResult: { status: "needs_time" },
  });

  assert.deepEqual(booking.map((event) => event.type), [AgentEventType.CONSULTATION_BOOKED]);
  assert.equal(booking[0]?.status, AgentEventStatus.BLOCKED);
  assert.equal(calendar[0]?.status, AgentEventStatus.BLOCKED);
});

test("distinguishes handoff requests from owner responses", () => {
  assert.equal(
    mapToolExecutionToAgentEvents({
      toolName: "owner_handoff_request",
      toolResult: { status: "owner_handoff_requested" },
    })[0]?.type,
    AgentEventType.HANDOFF_REQUESTED,
  );
  assert.equal(
    mapToolExecutionToAgentEvents({
      toolName: "owner_handoff_response",
      toolResult: { status: "sent" },
    })[0]?.type,
    AgentEventType.HANDOFF_RESOLVED,
  );
});

test("lead qualification requires date, location, and both names", () => {
  assert.equal(
    isQualifiedLeadMemory({
      weddingDate: "2026-10-18",
      location: "Raleigh, NC",
      customerName: "Sarah",
      partnerName: "Daniel",
    }),
    true,
  );
  assert.equal(
    isQualifiedLeadMemory({
      weddingDate: "2026-10-18",
      location: "Raleigh, NC",
      customerName: "Sarah",
    }),
    false,
  );
});
