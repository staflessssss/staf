import assert from "node:assert/strict";
import test from "node:test";

import { encrypt } from "@/lib/crypto";

import { defaultWeddingSalesConfig } from "../config";
import { weddingSalesToolNodeTestHelpers } from "../nodes/tools";
import { createInitialWeddingSalesState } from "../state";
import { createWeddingSalesActionPlanExecutor, isWeddingSalesActionRuntimeV2Enabled } from "./executor";
import type { WeddingSalesActionPlan } from "./schema";

function plan(actions: WeddingSalesActionPlan["actions"]): WeddingSalesActionPlan {
  return {
    schemaVersion: 1,
    actions,
    responseGoal: "run_tools_then_reply",
    guardrailTrace: [],
  };
}

function testToolContext() {
  return {
    tenantId: "tenant-1",
    testMode: true,
    weddingAvailability: {
      action: "capacity availability",
      params: {},
    },
    consultationCalendar: {
      action: "check calendar",
      params: {
        businessDays: [1, 2, 3, 4, 5],
        businessWindowStartHour: 9,
        businessWindowEndHour: 14,
        slotDurationMinutes: 30,
        checkConflictsBeforeBooking: false,
      },
    },
    bookConsultation: {
      action: "book call",
      params: {
        businessDays: [1, 2, 3, 4, 5],
        businessWindowStartHour: 9,
        businessWindowEndHour: 14,
        slotDurationMinutes: 30,
        inviteEmailSource: "customer_email",
        bookingDateSource: "time_text",
        bookingTimeSource: "time_text",
        checkConflictsBeforeBooking: false,
      },
      credentialsEnc: encrypt(JSON.stringify({ access_token: "test-token" })),
    },
  };
}

test("action runtime is enabled only for explicitly allowlisted agents", () => {
  const previousFlag = process.env.WEDDING_SALES_ACTION_RUNTIME_V2;
  const previousAllowlist = process.env.WEDDING_SALES_ACTION_RUNTIME_V2_AGENT_IDS;

  process.env.WEDDING_SALES_ACTION_RUNTIME_V2 = "true";
  process.env.WEDDING_SALES_ACTION_RUNTIME_V2_AGENT_IDS = "agent-a, agent-b";

  assert.equal(isWeddingSalesActionRuntimeV2Enabled("agent-a"), true);
  assert.equal(isWeddingSalesActionRuntimeV2Enabled("agent-c"), false);

  process.env.WEDDING_SALES_ACTION_RUNTIME_V2 = "false";
  assert.equal(isWeddingSalesActionRuntimeV2Enabled("agent-a"), false);

  process.env.WEDDING_SALES_ACTION_RUNTIME_V2 = previousFlag;
  process.env.WEDDING_SALES_ACTION_RUNTIME_V2_AGENT_IDS = previousAllowlist;
});

test("tool request builders use validated state instead of the latest raw customer text", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Actually not Tampa, it will be in Charlotte NC",
    previousState: {
      names: "Rick and Rachel",
      weddingDate: "2026-11-08",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte, NC",
      venue: "Evergreen Park",
      proposedCallTime: "Monday at 10am",
      customerEmail: "rachel@example.com",
    },
  });

  assert.equal(
    weddingSalesToolNodeTestHelpers.buildAvailabilityToolRequest(state),
    "Check wedding availability for wedding date 2026-11-08 in Charlotte, NC at Evergreen Park",
  );
  assert.equal(
    weddingSalesToolNodeTestHelpers.buildCalendarToolRequest(state),
    "Check consultation calendar for Monday at 10am with Rick and Rachel",
  );
  assert.equal(
    weddingSalesToolNodeTestHelpers.buildBookingToolRequest(state),
    "Book consultation call for Monday at 10am with Rick and Rachel at rachel@example.com",
  );
});

test("action executor runs availability then calendar from validated state", async () => {
  const execute = createWeddingSalesActionPlanExecutor({
    config: defaultWeddingSalesConfig,
    toolContext: testToolContext(),
  });
  const result = await execute(
    createInitialWeddingSalesState({
      channel: "instagram",
      message: "October 18 works, can we do a call Monday at 11am?",
      previousState: {
        leadStage: "ready_for_availability",
        names: "Sarah and Michael",
        weddingDate: "2026-10-18",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Charlotte",
        venue: "Evergreen Park",
        proposedCallTime: "Monday at 11am",
        lastActionPlan: plan([
          {
            type: "check_wedding_availability",
            field: null,
            topicId: null,
            reason: "date_and_location_are_ready_for_capacity_check",
          },
          {
            type: "check_consultation_calendar",
            field: null,
            topicId: null,
            reason: "call_time_already_provided_after_availability_check",
          },
        ]),
      },
    }),
  );

  assert.equal(result.availability, "available");
  assert.deepEqual(
    result.toolObservations?.map((observation) => observation.toolName),
    ["check_wedding_availability", "check_consultation_calendar"],
  );
  assert.deepEqual(
    result.turnToolObservations?.map((observation) => observation.toolName),
    ["check_wedding_availability", "check_consultation_calendar"],
  );
  assert.match(result.responseDraft ?? "", /time|email/i);
});

test("action executor books only when booking requirements are already committed", async () => {
  const execute = createWeddingSalesActionPlanExecutor({
    config: defaultWeddingSalesConfig,
    toolContext: testToolContext(),
  });
  const result = await execute(
    createInitialWeddingSalesState({
      channel: "instagram",
      message: "sarah@example.com",
      previousState: {
        leadStage: "ready_to_book",
        names: "Sarah and Michael",
        weddingDate: "2026-10-18",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Charlotte",
        venue: "Evergreen Park",
        availability: "available",
        calendarStatus: "available",
        proposedCallTime: "Monday at 11am",
        customerEmail: "sarah@example.com",
        lastActionPlan: plan([
          {
            type: "book_consultation",
            field: null,
            topicId: null,
            reason: "email_call_time_and_available_calendar_are_committed",
          },
        ]),
      },
    }),
  );

  assert.equal(result.bookingConfirmed, true);
  assert.equal(result.leadStage, "booked");
  assert.equal(result.turnToolObservations?.at(-1)?.toolName, "book_consultation");
  assert.match(result.responseDraft ?? "", /test mode/i);
});

test("action executor stops chained tools when wedding availability is unavailable", async () => {
  const execute = createWeddingSalesActionPlanExecutor({
    config: {
      ...defaultWeddingSalesConfig,
      coverage: {
        ...defaultWeddingSalesConfig.coverage,
        unavailableDates: ["2026-10-17"],
      },
    },
    toolContext: testToolContext(),
  });
  const result = await execute(
    createInitialWeddingSalesState({
      channel: "instagram",
      message: "Actually October 17 2026 is our date, sorry",
      previousState: {
        leadStage: "ready_for_availability",
        names: "Emily and Jake",
        weddingDate: "2026-10-17",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Charlotte, NC",
        venue: "Evergreen Park",
        proposedCallTime: "tomorrow at 11am",
        lastActionPlan: plan([
          {
            type: "check_wedding_availability",
            field: null,
            topicId: null,
            reason: "date_and_location_are_ready_for_capacity_check",
          },
          {
            type: "check_consultation_calendar",
            field: null,
            topicId: null,
            reason: "call_time_already_provided_after_availability_check",
          },
        ]),
      },
    }),
  );

  assert.equal(result.availability, "unavailable");
  assert.equal(result.calendarStatus, undefined);
  assert.deepEqual(
    result.turnToolObservations?.map((observation) => observation.toolName),
    ["check_wedding_availability"],
  );
  assert.match(result.responseDraft ?? "", /unavailable|booked/i);
});

test("action executor composes a single reply for answer plus qualification plans", async () => {
  const execute = createWeddingSalesActionPlanExecutor({
    config: defaultWeddingSalesConfig,
    toolContext: testToolContext(),
  });
  const result = await execute(
    createInitialWeddingSalesState({
      channel: "instagram",
      message: "What's your price?",
      previousState: {
        leadStage: "answering_question",
        lastActionPlan: plan([
          {
            type: "answer_question",
            field: null,
            topicId: "pricing",
            reason: "customer_asked_current_business_question",
          },
          {
            type: "ask_missing_field",
            field: "names",
            topicId: null,
            reason: "continue_qualification_after_answer",
          },
        ]),
      },
    }),
  );

  assert.equal(result.assistantReplyCount, 1);
  assert.match(result.responseDraft ?? "", /names/i);
  assert.match(result.responseDraft ?? "", /wedding date/i);
});

test("action executor returns safe clarification for semantic v2 failures", async () => {
  const execute = createWeddingSalesActionPlanExecutor({
    config: defaultWeddingSalesConfig,
    toolContext: testToolContext(),
  });
  const result = await execute(
    createInitialWeddingSalesState({
      channel: "instagram",
      message: "???",
      previousState: {
        leadStage: "answering_question",
        lastActionPlan: plan([
          {
            type: "request_clarification",
            field: null,
            topicId: null,
            reason: "semantic_v2_execution_failed",
          },
        ]),
      },
    }),
  );

  assert.equal(result.assistantReplyCount, 1);
  assert.match(result.responseDraft ?? "", /understand you correctly/i);
  assert.equal(result.toolObservations, undefined);
});
