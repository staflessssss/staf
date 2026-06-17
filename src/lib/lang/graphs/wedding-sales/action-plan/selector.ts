import type { SemanticAnalysisV2, WeddingSalesField } from "../semantic-v2/schema";
import type { WeddingSalesState } from "../state";
import { hasStructuredCoupleNames, migrateWeddingSalesNames } from "../state-v2/names";
import { wasSemanticFieldCommittedThisTurn } from "../state-v2/trace";
import {
  buildGuardrailTraceEntry,
  canBookConsultation,
  canCheckConsultationCalendar,
  canCheckWeddingAvailability,
  isOwnerContext,
} from "./guardrails";
import type {
  WeddingSalesAction,
  WeddingSalesActionGuardrailTrace,
  WeddingSalesActionPlan,
  WeddingSalesActionType,
} from "./schema";

const FIELD_QUESTION_ORDER: WeddingSalesField[] = [
  "customerName",
  "partnerName",
  "weddingDate",
  "weddingYear",
  "location",
  "venue",
  "callTime",
  "email",
];

const ACTIVE_SALES_CONTINUATION_TOPICS = new Set([
  "availability",
  "booking",
  "film_length",
  "final_film_delivery",
  "hidden_fees",
  "insurance",
  "music",
  "package_inclusions",
  "photographers",
  "portfolio",
  "pricing",
  "reviews",
  "style",
  "team_florida",
  "team_nc_sc_ga",
  "travel_fees",
  "venue_travel_details",
]);

function hasHighConfidenceQuestion(analysis: SemanticAnalysisV2) {
  return analysis.questions.some((question) => question.confidence >= 0.75);
}

function hasProvidedFieldInCurrentTurn(state: WeddingSalesState, field: WeddingSalesField) {
  if (field === "names") {
    return (
      wasSemanticFieldCommittedThisTurn(state, "customerName") ||
      wasSemanticFieldCommittedThisTurn(state, "partnerName") ||
      wasSemanticFieldCommittedThisTurn(state, "names")
    );
  }

  return wasSemanticFieldCommittedThisTurn(state, field);
}

function bestQuestionTopic(analysis: SemanticAnalysisV2) {
  return (
    analysis.questions
      .filter((question) => question.confidence >= 0.75)
      .sort((a, b) => b.confidence - a.confidence)[0]?.topicId ?? null
  );
}

function highConfidenceQuestionTopics(analysis: SemanticAnalysisV2) {
  const topics: string[] = [];

  for (const question of analysis.questions.filter((item) => item.confidence >= 0.75)) {
    if (question.topicId && !topics.includes(question.topicId)) {
      topics.push(question.topicId);
    }
  }

  return topics;
}

function hasUnknownBusinessQuestion(analysis: SemanticAnalysisV2) {
  return analysis.questions.some(
    (question) =>
      question.confidence >= 0.75 &&
      (!question.topicId ||
        question.topicId === "other" ||
        question.topicId === "unknown_service_request" ||
        question.topicId === "unknown_business_question"),
  );
}

function hasHighConfidenceObjection(analysis: SemanticAnalysisV2) {
  return analysis.objections.some((objection) => objection.confidence >= 0.75);
}

function isActiveSalesContinuationQuestion(state: WeddingSalesState, analysis: SemanticAnalysisV2) {
  const topic = bestQuestionTopic(analysis);
  const activeSalesStage = Boolean(
    state.weddingDate ||
      state.location ||
      state.availability ||
      state.callProposed ||
      state.proposedCallTime ||
      state.calendarStatus,
  );
  const hasCallContext = Boolean(state.proposedCallTime || state.calendarStatus || state.checkedCallDate);
  const asksAboutExistingCall = analysis.questions.some((question) => {
    if (question.confidence < 0.75) {
      return false;
    }

    const text = `${question.normalizedQuestion} ${question.evidence}`.toLowerCase();
    return (
      hasCallContext &&
      /\b(call|consultation|meeting|appointment|schedule|booking|book|reschedule)\b/.test(text)
    );
  });

  return Boolean(
    activeSalesStage &&
      ((topic && ACTIVE_SALES_CONTINUATION_TOPICS.has(topic)) || asksAboutExistingCall),
  );
}

function fieldWasAskedByPreviousPlan(state: WeddingSalesState, field: WeddingSalesField) {
  return state.lastActionPlan?.actions.some(
    (action) => action.type === "ask_missing_field" && action.field === field,
  ) ?? false;
}

function legacyAskedForField(state: WeddingSalesState, field: WeddingSalesField) {
  switch (field) {
    case "customerName":
    case "partnerName":
    case "names":
      return state.askedForNames;
    case "weddingYear":
      return state.askedForWeddingYear;
    case "location":
    case "venue":
      return state.askedForVenue;
    case "callTime":
      return state.askedForCallTime;
    case "email":
      return state.askedForEmail;
    default:
      return false;
  }
}

function askedCountForField(state: WeddingSalesState, field: WeddingSalesField) {
  return state.askedFieldCounts?.[field] ?? (legacyAskedForField(state, field) ? 1 : 0);
}

function shouldSuppressRepeatedMissingField(args: {
  state: WeddingSalesState;
  analysis: SemanticAnalysisV2;
  field: WeddingSalesField;
}) {
  if (hasProvidedFieldInCurrentTurn(args.state, args.field)) {
    return false;
  }

  const askedBefore = askedCountForField(args.state, args.field) > 0;
  const askedInPreviousPlan = fieldWasAskedByPreviousPlan(args.state, args.field);

  if (!askedBefore && !askedInPreviousPlan) {
    return false;
  }

  return askedInPreviousPlan || hasHighConfidenceQuestion(args.analysis) || hasHighConfidenceObjection(args.analysis);
}

function firstMissingField(state: WeddingSalesState): WeddingSalesField | null {
  const nameState = migrateWeddingSalesNames(state);
  const effectiveState = {
    ...state,
    ...nameState,
  };

  for (const field of FIELD_QUESTION_ORDER) {
    switch (field) {
      case "customerName":
        if (!effectiveState.customerName && !hasStructuredCoupleNames(effectiveState)) return field;
        break;
      case "partnerName":
        if (!effectiveState.partnerName && !hasStructuredCoupleNames(effectiveState)) return field;
        break;
      case "weddingDate":
        if (!state.weddingDate && !state.weddingDateText) return field;
        break;
      case "weddingYear":
        if (!state.weddingYearKnown) return field;
        break;
      case "location":
        if (!state.location) return field;
        break;
      case "venue":
        if (state.channel === "instagram" && state.availability === "available" && !state.venue) {
          return field;
        }
        break;
      case "callTime":
        if (state.availability === "available" && state.venue && !state.proposedCallTime) {
          return field;
        }
        break;
      case "email":
        if (state.calendarStatus === "available" && !state.customerEmail) {
          return field;
        }
        break;
    }
  }

  return null;
}

function firstAllowedMissingField(args: {
  state: WeddingSalesState;
  analysis: SemanticAnalysisV2;
}) {
  const missingField = firstMissingField(args.state);

  if (
    missingField &&
    shouldSuppressRepeatedMissingField({
      state: args.state,
      analysis: args.analysis,
      field: missingField,
    })
  ) {
    return null;
  }

  return missingField;
}

export function selectWeddingSalesFollowUpActionPlan(state: WeddingSalesState): WeddingSalesActionPlan {
  if (state.bookingConfirmed || state.bookedEventId || state.leadStage === "booked") {
    return buildPlan({
      responseGoal: "continue",
      actions: [
        action({
          type: "suppress_reply",
          reason: "consultation_already_booked_no_follow_up_needed",
        }),
      ],
    });
  }

  if (state.pendingChangeField && state.pendingChangeValue) {
    return buildPlan({
      responseGoal: "clarify",
      actions: [
        action({
          type: "request_confirmation",
          field: state.pendingChangeField,
          reason: "follow_up_pending_change_confirmation",
        }),
      ],
    });
  }

  if (state.calendarStatus === "available" && !state.customerEmail) {
    return buildPlan({
      responseGoal: "clarify",
      actions: [
        action({
          type: "ask_missing_field",
          field: "email",
          reason: "follow_up_continue_current_action_plan_email",
        }),
      ],
    });
  }

  if (
    state.availability === "available" &&
    state.venue &&
    (!state.proposedCallTime || state.calendarStatus === "busy")
  ) {
    return buildPlan({
      responseGoal: "clarify",
      actions: [
        action({
          type: "ask_missing_field",
          field: "callTime",
          reason: "follow_up_continue_current_action_plan_call_time",
        }),
      ],
    });
  }

  if (state.channel === "instagram" && state.availability === "available" && !state.venue) {
    return buildPlan({
      responseGoal: "clarify",
      actions: [
        action({
          type: "ask_missing_field",
          field: "venue",
          reason: "follow_up_continue_current_action_plan_venue",
        }),
      ],
    });
  }

  const missingField = firstMissingField(state);
  if (missingField) {
    return buildPlan({
      responseGoal: "clarify",
      actions: [
        action({
          type: "ask_missing_field",
          field: missingField,
          reason: "follow_up_continue_current_action_plan_missing_field",
        }),
      ],
    });
  }

  return buildPlan({
    responseGoal: "continue",
    actions: [
      action({
        type: "suppress_reply",
        reason: "follow_up_has_no_customer_safe_next_action",
      }),
    ],
  });
}

function action(args: {
  type: WeddingSalesActionType;
  reason: string;
  field?: WeddingSalesField | null;
  topicId?: string | null;
}): WeddingSalesAction {
  return {
    type: args.type,
    field: args.field ?? null,
    topicId: args.topicId ?? null,
    reason: args.reason,
  };
}

function buildPlan(args: {
  actions: WeddingSalesAction[];
  guardrailTrace?: WeddingSalesActionGuardrailTrace[];
  responseGoal: WeddingSalesActionPlan["responseGoal"];
}): WeddingSalesActionPlan {
  return {
    schemaVersion: 1,
    actions: args.actions,
    responseGoal: args.responseGoal,
    guardrailTrace: args.guardrailTrace ?? [],
  };
}

export function selectWeddingSalesActionPlan(args: {
  state: WeddingSalesState;
  analysis: SemanticAnalysisV2;
}): WeddingSalesActionPlan {
  const { state, analysis } = args;
  const guardrailTrace: WeddingSalesActionGuardrailTrace[] = [];

  if (state.pendingChangeField && state.pendingChangeValue) {
    return buildPlan({
      responseGoal: "clarify",
      actions: [
        action({
          type: "request_confirmation",
          field: state.pendingChangeField,
          reason: "pending_change_requires_customer_confirmation",
        }),
      ],
    });
  }

  if (isOwnerContext(state, analysis) && !isActiveSalesContinuationQuestion(state, analysis)) {
    return buildPlan({
      responseGoal: "handoff",
      actions: [
        action({
          type: "recommend_owner_handoff",
          reason: "message_is_not_a_new_lead_sales_question",
        }),
      ],
    });
  }

  if (hasUnknownBusinessQuestion(analysis) && !isActiveSalesContinuationQuestion(state, analysis)) {
    return buildPlan({
      responseGoal: "handoff",
      actions: [
        action({
          type: "recommend_owner_handoff",
          reason: "unknown_business_question_requires_owner",
        }),
      ],
    });
  }

  const bookResult = canBookConsultation({ state, analysis });
  guardrailTrace.push(buildGuardrailTraceEntry("book_consultation", bookResult));
  if (bookResult.allowed) {
    return buildPlan({
      responseGoal: "book_call",
      guardrailTrace,
      actions: [
        action({
          type: "book_consultation",
          reason: "email_call_time_and_available_calendar_are_committed",
        }),
      ],
    });
  }

  const calendarResult = canCheckConsultationCalendar({ state, analysis });
  guardrailTrace.push(
    buildGuardrailTraceEntry("check_consultation_calendar", calendarResult),
  );
  if (calendarResult.allowed) {
    return buildPlan({
      responseGoal: "run_tools_then_reply",
      guardrailTrace,
      actions: [
        action({
          type: "check_consultation_calendar",
          reason: "call_time_is_ready_and_wedding_date_is_available",
        }),
      ],
    });
  }

  const availabilityResult = canCheckWeddingAvailability({ state, analysis });
  guardrailTrace.push(
    buildGuardrailTraceEntry("check_wedding_availability", availabilityResult),
  );
  if (
    availabilityResult.allowed &&
    (state.leadStage === "ready_for_availability" || !state.availability)
  ) {
    const actions = [
      action({
        type: "check_wedding_availability",
        reason: "date_and_location_are_ready_for_capacity_check",
      }),
    ];

    if (wasSemanticFieldCommittedThisTurn(state, "callTime")) {
      actions.push(
        action({
          type: "check_consultation_calendar",
          reason: "call_time_already_provided_after_availability_check",
        }),
      );
    }

    return buildPlan({
      responseGoal: "run_tools_then_reply",
      guardrailTrace,
      actions,
    });
  }

  if (hasHighConfidenceObjection(analysis)) {
    return buildPlan({
      responseGoal: "answer_and_qualify",
      actions: [
        action({
          type: "acknowledge_objection",
          reason: "customer_expressed_objection_or_hesitation",
        }),
      ],
    });
  }

  if (hasHighConfidenceQuestion(analysis)) {
    const missingField = firstAllowedMissingField({ state, analysis });
    const questionTopics = highConfidenceQuestionTopics(analysis);
    return buildPlan({
      responseGoal: "answer_and_qualify",
      guardrailTrace,
      actions: [
        ...(questionTopics.length > 0
          ? questionTopics.map((topicId) =>
              action({
                type: "answer_question",
                topicId,
                reason: "customer_asked_current_business_question",
              }),
            )
          : [
              action({
                type: "answer_question",
                topicId: null,
                reason: "customer_asked_current_business_question",
              }),
            ]),
        ...(missingField
          ? [
              action({
                type: "ask_missing_field",
                field: missingField,
                reason: "continue_qualification_after_answer",
              }),
            ]
          : []),
      ],
    });
  }

  const missingField = firstAllowedMissingField({ state, analysis });
  if (missingField) {
    return buildPlan({
      responseGoal: "clarify",
      guardrailTrace,
      actions: [
        action({
          type: "ask_missing_field",
          field: missingField,
          reason: "next_required_qualification_field_missing",
        }),
      ],
    });
  }

  return buildPlan({
    responseGoal: "continue",
    guardrailTrace,
    actions: [
      action({
        type: "continue_conversation",
        reason: "no_tool_or_missing_field_action_required",
      }),
    ],
  });
}
