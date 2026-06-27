import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWeddingAgentDomainDecision,
} from "./wedding-agent-domain";
import type { SimpleWeddingSalesState } from "./state";

function state(update: Partial<SimpleWeddingSalesState>): SimpleWeddingSalesState {
  return update as SimpleWeddingSalesState;
}

test("domain maps available wedding date with missing names to ask names", () => {
  const result = buildWeddingAgentDomainDecision(
    state({
      availability: "available",
      nextStep: "ask_missing_info",
      missingField: "names",
    }),
  );

  assert.equal(result.nextDomainAction, "ask_names_after_available_date");
  assert.equal(result.currentRequestedSlot, "names");
  assert.equal(result.matchedRule, "availability_available_and_names_missing");
  assert.ok(result.allowedResponseKeys.includes("utter_availability_available_ask_names"));
});

test("domain maps travel interruption while asking call time to travel answer and resume", () => {
  const result = buildWeddingAgentDomainDecision(
    state({
      nextStep: "ask_call_time",
      replyObligations: ["travel"],
    }),
  );

  assert.equal(result.nextDomainAction, "answer_travel_resume_call_time");
  assert.equal(result.currentRequestedSlot, "callTime");
  assert.equal(result.matchedRule, "travel_faq_interruption_resume_call_time");
  assert.equal(result.resumeAfterInterruption, true);
  assert.ok(result.allowedResponseKeys.includes("utter_answer_travel_resume_call_time"));
});

test("domain maps venue collected with missing call time to ask call time", () => {
  const result = buildWeddingAgentDomainDecision(
    state({
      customerName: "Mark",
      partnerName: "Rachel",
      venue: "Evergreen Park",
      nextStep: "ask_call_time",
    }),
  );

  assert.equal(result.nextDomainAction, "ask_call_time");
  assert.equal(result.currentRequestedSlot, "callTime");
  assert.equal(result.matchedRule, "venue_collected_and_call_time_missing");
  assert.ok(result.allowedResponseKeys.includes("utter_venue_collected_ask_call_time"));
});

test("domain maps available calendar with missing email to ask email", () => {
  const result = buildWeddingAgentDomainDecision(
    state({
      calendarStatus: "available",
      checkedCallTime: "13:30",
      nextStep: "ask_email",
    }),
  );

  assert.equal(result.nextDomainAction, "ask_email_after_available_calendar");
  assert.equal(result.currentRequestedSlot, "email");
  assert.equal(result.matchedRule, "calendar_available_and_email_missing");
  assert.ok(result.allowedResponseKeys.includes("utter_calendar_available_ask_email"));
});
