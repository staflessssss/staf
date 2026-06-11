import type { WeddingSalesState } from "../state";
import type { SemanticAnalysisV2 } from "../semantic-v2/schema";
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

function hasFreshCallTime(analysis: SemanticAnalysisV2) {
  return analysis.entities.some(
    (entity) => entity.field === "callTime" && entity.confidence >= 0.75,
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

  if (
    (state.calendarStatus === "available" || state.calendarStatus === "busy") &&
    !hasFreshCallTime(analysis)
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
