import type { WeddingSalesState } from "../state";
import type { SemanticAnalysisV2 } from "../semantic-v2/schema";
import { wasSemanticFieldCommittedThisTurn } from "../state-v2/trace";
import type {
  WeddingSalesActionGuardrailTrace,
  WeddingSalesActionType,
} from "./schema";

const OWNER_CONTEXT_TYPES = new Set([
  "existing_client",
  "past_client",
  "planner",
  "vendor",
]);

function hasPendingChange(state: WeddingSalesState) {
  return Boolean(state.pendingChangeField && state.pendingChangeValue);
}

function hasQuestion(analysis: SemanticAnalysisV2) {
  return analysis.questions.some((question) => question.confidence >= 0.75);
}

function hasObjection(analysis: SemanticAnalysisV2) {
  return analysis.objections.some((objection) => objection.confidence >= 0.75);
}

function hasSchedulingObjection(analysis: SemanticAnalysisV2) {
  return analysis.objections.some(
    (objection) =>
      objection.confidence >= 0.75 &&
      (objection.type === "not_ready_to_schedule" ||
        objection.type === "needs_more_information" ||
        objection.type === "wants_to_think"),
  );
}

export function isOwnerContext(state: WeddingSalesState, analysis: SemanticAnalysisV2) {
  const clientType = state.clientType ?? analysis.clientType?.value;
  return Boolean(clientType && OWNER_CONTEXT_TYPES.has(clientType));
}

export function canCheckWeddingAvailability(args: {
  state: WeddingSalesState;
  analysis: SemanticAnalysisV2;
}) {
  const { state, analysis } = args;

  if (hasPendingChange(state)) {
    return { allowed: false, reason: "unresolved_pending_change" };
  }

  if (isOwnerContext(state, analysis)) {
    return { allowed: false, reason: "owner_context_requires_handoff" };
  }

  if (hasObjection(analysis)) {
    return { allowed: false, reason: "active_objection_suppresses_tool" };
  }

  if (!state.weddingDate || !state.weddingYearKnown) {
    return { allowed: false, reason: "missing_committed_wedding_date" };
  }

  if (!state.location) {
    return { allowed: false, reason: "missing_region_or_location" };
  }

  return { allowed: true, reason: "requirements_satisfied" };
}

export function canCheckConsultationCalendar(args: {
  state: WeddingSalesState;
  analysis: SemanticAnalysisV2;
}) {
  const { state, analysis } = args;

  if (hasPendingChange(state)) {
    return { allowed: false, reason: "unresolved_pending_change" };
  }

  if (hasSchedulingObjection(analysis)) {
    return { allowed: false, reason: "scheduling_objection" };
  }

  if (!state.proposedCallTime) {
    return { allowed: false, reason: "missing_explicit_call_time" };
  }

  const hasKnownCalendarStatus = state.calendarStatus === "available" || state.calendarStatus === "busy";
  const hasCheckedSlot = Boolean(state.checkedCallDate && state.checkedCallTime);

  if (
    hasKnownCalendarStatus &&
    !hasCheckedSlot &&
    !state.customerEmail &&
    !wasSemanticFieldCommittedThisTurn(state, "callTime")
  ) {
    return { allowed: false, reason: "calendar_status_known_but_checked_slot_missing" };
  }

  if (
    hasKnownCalendarStatus &&
    hasCheckedSlot &&
    !wasSemanticFieldCommittedThisTurn(state, "callTime")
  ) {
    return { allowed: false, reason: "calendar_status_already_known" };
  }

  if (state.availability !== "available") {
    return { allowed: false, reason: "wedding_availability_not_confirmed" };
  }

  return { allowed: true, reason: "requirements_satisfied" };
}

export function canBookConsultation(args: {
  state: WeddingSalesState;
  analysis: SemanticAnalysisV2;
}) {
  const { state, analysis } = args;

  if (hasPendingChange(state)) {
    return { allowed: false, reason: "unresolved_pending_change" };
  }

  if (hasSchedulingObjection(analysis)) {
    return { allowed: false, reason: "scheduling_objection" };
  }

  if (state.bookingConfirmed || state.bookedEventId) {
    return { allowed: false, reason: "booking_already_confirmed" };
  }

  if (state.calendarStatus !== "available") {
    return { allowed: false, reason: "calendar_not_confirmed_available" };
  }

  if (!state.customerEmail) {
    return { allowed: false, reason: "missing_validated_email" };
  }

  if (!state.proposedCallTime) {
    return { allowed: false, reason: "missing_committed_call_time" };
  }

  if (!state.checkedCallDate || !state.checkedCallTime) {
    return { allowed: false, reason: "missing_checked_calendar_slot" };
  }

  return { allowed: true, reason: "requirements_satisfied" };
}

export function buildGuardrailTraceEntry(
  action: WeddingSalesActionType,
  result: { allowed: boolean; reason: string },
): WeddingSalesActionGuardrailTrace {
  return {
    action,
    allowed: result.allowed,
    reason: result.reason,
  };
}

export const weddingSalesActionGuardrailTestHelpers = {
  hasQuestion,
  hasObjection,
};
