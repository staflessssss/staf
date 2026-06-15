import type { WeddingSalesState } from "../state";
import { calculateEffectiveEntityConfidence } from "../semantic-v2/effective-confidence";
import type { SemanticAnalysisV2, SemanticProvidedValueV2, WeddingSalesField } from "../semantic-v2/schema";
import {
  hasStructuredCoupleNames,
  mergeNameRoleFromSemanticV2,
  migrateWeddingSalesNames,
} from "./names";
import type { WeddingSalesStateMutationTrace, WeddingSalesClientType } from "./schema";
import { normalizeForComparison } from "./validators";

const ACCEPT_ENTITY_THRESHOLD = 0.75;
const PENDING_ENTITY_THRESHOLD = 0.35;

function parseAgentAllowlist(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function isSemanticV2ExecutionEnabled(agentId?: string) {
  if (!agentId) {
    return false;
  }

  return parseAgentAllowlist(process.env.WEDDING_SALES_SEMANTIC_V2_EXECUTION_AGENT_IDS).has(agentId);
}

function clearPendingChange() {
  return {
    pendingChangeField: undefined,
    pendingChangeValue: undefined,
    pendingChangeDisplay: undefined,
    changeConfirmationRejected: undefined,
  } satisfies Partial<WeddingSalesState>;
}

function clearAvailabilityResult() {
  return {
    availability: undefined,
    availabilityRegion: undefined,
  } satisfies Partial<WeddingSalesState>;
}

function clearCheckedCallSlot() {
  return {
    calendarStatus: undefined,
    checkedCallDate: undefined,
    checkedCallTime: undefined,
    checkedCallStartTime: undefined,
    checkedCallEndTime: undefined,
  } satisfies Partial<WeddingSalesState>;
}

function clearBookingResult() {
  return {
    bookingConfirmed: false,
    bookedEventId: undefined,
  } satisfies Partial<WeddingSalesState>;
}

function isHighConfidenceClientType(analysis: SemanticAnalysisV2) {
  return analysis.clientType && analysis.clientType.confidence >= 0.8
    ? analysis.clientType.value
    : undefined;
}

function shouldRouteToOwnerContext(clientType?: WeddingSalesClientType) {
  return (
    clientType === "existing_client" ||
    clientType === "past_client" ||
    clientType === "planner" ||
    clientType === "vendor"
  );
}

function hasQuestionTopic(analysis: SemanticAnalysisV2, topicId: string) {
  return analysis.questions.some((question) => question.topicId === topicId && question.confidence >= 0.75);
}

function hasIntent(args: {
  analysis: SemanticAnalysisV2;
  category: SemanticAnalysisV2["intents"][number]["category"];
  field?: WeddingSalesField;
  minConfidence?: number;
}) {
  return args.analysis.intents.some(
    (intent) =>
      intent.category === args.category &&
      intent.confidence >= (args.minConfidence ?? 0.75) &&
      (!args.field || intent.targetField === args.field),
  );
}

function selectBestValue(args: {
  analysis: SemanticAnalysisV2;
  state: WeddingSalesState;
  field: WeddingSalesField;
}) {
  const effective = calculateEffectiveEntityConfidence(args).filter((entry) => entry.field === args.field);
  return effective
    .sort((a, b) => Number(b.valid) - Number(a.valid) || b.effectiveConfidence - a.effectiveConfidence)[0];
}

function isAccepted(entry: ReturnType<typeof selectBestValue>) {
  return Boolean(entry && entry.effectiveConfidence >= ACCEPT_ENTITY_THRESHOLD);
}

function isPendingCandidate(entry: ReturnType<typeof selectBestValue>) {
  return Boolean(
    entry &&
      entry.evidencePresent &&
      entry.effectiveConfidence >= PENDING_ENTITY_THRESHOLD,
  );
}

function evidenceIsPresent(message: string | undefined, evidence: string) {
  return Boolean(
    message &&
      evidence.trim() &&
      normalizeForComparison(message).includes(normalizeForComparison(evidence)),
  );
}

function isAcceptedProvidedInfo(provided: SemanticProvidedValueV2, message: string | undefined) {
  return Boolean(
    provided &&
      provided.confidence >= ACCEPT_ENTITY_THRESHOLD &&
      evidenceIsPresent(message, provided.evidence),
  );
}

function workingState(state: WeddingSalesState, update: Partial<WeddingSalesState>): WeddingSalesState {
  return {
    ...state,
    ...update,
  };
}

function deriveLeadStage(args: {
  state: WeddingSalesState;
  update: Partial<WeddingSalesState>;
  analysis: SemanticAnalysisV2;
  fallbackLeadStage?: WeddingSalesState["leadStage"];
  acceptedFields: Set<WeddingSalesField>;
  hasPendingConfirmation: boolean;
}) {
  const next = workingState(args.state, args.update);
  const clientType = args.update.clientType ?? args.state.clientType;

  if (shouldRouteToOwnerContext(clientType)) {
    return "ignored";
  }

  if (args.hasPendingConfirmation) {
    return "confirming_change";
  }

  if (args.acceptedFields.has("email") && next.calendarStatus === "available") {
    return "ready_to_book";
  }

  if (
    args.acceptedFields.has("callTime") &&
    (next.availability === "available" ||
      next.callProposed ||
      next.leadStage === "asking_call_time" ||
      next.leadStage === "checking_calendar" ||
      next.leadStage === "call_proposed")
  ) {
    return "checking_calendar";
  }

  if (
    hasIntent({ analysis: args.analysis, category: "express_objection" }) ||
    hasQuestionTopic(args.analysis, "travel_fees") ||
    hasQuestionTopic(args.analysis, "pricing") ||
    hasQuestionTopic(args.analysis, "final_film_delivery")
  ) {
    return "answering_question";
  }

  if (
    (args.acceptedFields.has("weddingDate") || args.acceptedFields.has("location")) &&
    next.weddingDate &&
    next.weddingYearKnown &&
    next.location
  ) {
    return "ready_for_availability";
  }

  if (next.availability === "available" && next.venue) {
    return next.proposedCallTime ? "checking_calendar" : "asking_call_time";
  }

  if (!hasStructuredCoupleNames(next) || !next.weddingDate) {
    return "missing_names_or_date";
  }

  if (!next.weddingYearKnown) {
    return "waiting_wedding_year";
  }

  if (!next.location) {
    return "missing_location_or_venue";
  }

  if (!next.venue && next.channel === "instagram" && next.availability === "available") {
    return "missing_location_or_venue";
  }

  return args.fallbackLeadStage ?? next.leadStage;
}

export function buildSemanticV2MutationFailureUpdate(
  state: WeddingSalesState,
  reason: string,
): Partial<WeddingSalesState> {
  return {
    semanticStateVersion: 2,
    consecutiveSemanticFailures: (state.consecutiveSemanticFailures ?? 0) + 1,
    lastStateMutationTrace: [
      {
        action: "rejected",
        reason,
      },
    ],
  };
}

export function applySemanticV2StateMutation(args: {
  state: WeddingSalesState;
  analysis: SemanticAnalysisV2;
  fallbackLeadStage?: WeddingSalesState["leadStage"];
}): Partial<WeddingSalesState> {
  const { state, analysis } = args;
  const trace: WeddingSalesStateMutationTrace = [];
  const migratedNames = migrateWeddingSalesNames(state);
  const update: Partial<WeddingSalesState> = {
    semanticStateVersion: 2,
    ...migratedNames,
    lastSemanticAnalysis: analysis,
    consecutiveSemanticFailures: 0,
  };
  const acceptedFields = new Set<WeddingSalesField>();
  let hasPendingConfirmation = false;
  const clientType = isHighConfidenceClientType(analysis);

  if (clientType) {
    update.clientType = clientType;
    trace.push({
      action: "accepted",
      field: undefined,
      value: clientType,
      reason: "high_confidence_client_type",
    });
  }

  for (const role of ["customerName", "partnerName"] as const) {
    const provided = analysis.providedInfo?.[role];

    if (!provided) {
      continue;
    }

    if (!isAcceptedProvidedInfo(provided, state.latestCustomerMessage)) {
      trace.push({
        action: "rejected",
        field: role,
        value: provided.value,
        reason: "provided_name_role_below_threshold_or_evidence_missing",
      });
      continue;
    }

    Object.assign(
      update,
      mergeNameRoleFromSemanticV2({
        state: workingState(state, update),
        role,
        provided,
      }),
    );
    acceptedFields.add(role);
    trace.push({
      action: "accepted",
      field: role,
      value: provided.value,
      reason: "semantic_v2_structured_name_role",
    });
  }

  if (
    state.pendingChangeField &&
    state.pendingChangeValue &&
    analysis.pendingResolution?.field === state.pendingChangeField
  ) {
    if (analysis.pendingResolution.type === "reject") {
      Object.assign(update, clearPendingChange(), {
        changeConfirmationRejected: true,
      });
      trace.push({
        action: "resolved",
        field: state.pendingChangeField,
        value: state.pendingChangeValue,
        reason: "pending_change_rejected",
      });
    }

    if (analysis.pendingResolution.type === "confirm") {
      if (state.pendingChangeField === "weddingDate") {
        Object.assign(update, clearPendingChange(), {
          weddingDate: state.pendingChangeValue,
          weddingYear: state.pendingChangeValue.slice(0, 4),
          weddingYearKnown: true,
          ...clearAvailabilityResult(),
          ...clearCheckedCallSlot(),
          callProposed: false,
          ...clearBookingResult(),
        });
      } else {
        Object.assign(update, clearPendingChange(), {
          location: state.pendingChangeValue,
          venue: undefined,
          ...clearAvailabilityResult(),
          ...clearCheckedCallSlot(),
          callProposed: false,
          ...clearBookingResult(),
        });
      }
      acceptedFields.add(state.pendingChangeField);
      trace.push({
        action: "resolved",
        field: state.pendingChangeField,
        value: state.pendingChangeValue,
        reason: "pending_change_confirmed",
      });
    }
  }

  const genericNames = selectBestValue({
    analysis,
    state: workingState(state, update),
    field: "names",
  });

  if (genericNames) {
    trace.push({
      action: "rejected",
      field: "names",
      value: genericNames.value,
      reason: "generic_names_entity_is_not_structured_name_authority",
    });
  }

  for (const field of ["weddingDate", "weddingYear", "location", "venue", "email", "callTime"] as const) {
    const entry = selectBestValue({
      analysis,
      state: workingState(state, update),
      field,
    });

    if (!entry) {
      continue;
    }

    if (!isAccepted(entry)) {
      if (
        (field === "weddingDate" || field === "location") &&
        entry.conflictsWithCommittedState &&
        isPendingCandidate(entry)
      ) {
        Object.assign(update, {
          pendingChangeField: field,
          pendingChangeValue: entry.value,
          pendingChangeDisplay: entry.value,
          changeConfirmationRejected: undefined,
        });
        hasPendingConfirmation = true;
        trace.push({
          action: "pending",
          field,
          value: entry.value,
          reason: entry.reasons.join(","),
        });
      } else {
        trace.push({
          action: "rejected",
          field,
          value: entry.value,
          reason: entry.reasons.join(","),
        });
      }
      continue;
    }

    switch (field) {
      case "weddingDate":
        update.weddingDate = entry.value;
        update.weddingYear = entry.value.slice(0, 4);
        update.weddingYearKnown = true;
        if (state.weddingDate && normalizeForComparison(state.weddingDate) !== normalizeForComparison(entry.value)) {
          Object.assign(update, clearAvailabilityResult(), clearCheckedCallSlot());
          update.callProposed = false;
          Object.assign(update, clearBookingResult());
        }
        Object.assign(update, clearPendingChange());
        break;
      case "weddingYear":
        update.weddingYear = entry.value;
        update.weddingYearKnown = true;
        break;
      case "location":
        update.location = entry.value;
        if (state.location && normalizeForComparison(state.location) !== normalizeForComparison(entry.value)) {
          update.venue = undefined;
          Object.assign(update, clearAvailabilityResult(), clearCheckedCallSlot());
          update.callProposed = false;
          Object.assign(update, clearBookingResult());
        }
        Object.assign(update, clearPendingChange());
        break;
      case "venue":
        update.venue = entry.value;
        break;
      case "email":
        update.customerEmail = entry.value.toLowerCase();
        break;
      case "callTime":
        {
          const callTimeValue = entry.value;

          if (state.proposedCallTime && normalizeForComparison(state.proposedCallTime) !== normalizeForComparison(callTimeValue)) {
            Object.assign(update, clearCheckedCallSlot(), clearBookingResult());
          }
          update.proposedCallTime = callTimeValue;
        }
        break;
    }

    acceptedFields.add(field);
    trace.push({
      action: "accepted",
      field,
      value: entry.value,
      reason: entry.reasons.join(","),
    });
  }

  const leadStage = deriveLeadStage({
    state,
    update,
    analysis,
    fallbackLeadStage: args.fallbackLeadStage,
    acceptedFields,
    hasPendingConfirmation,
  });

  update.leadStage = leadStage;
  update.lastStateMutationTrace = [
    ...trace,
    {
      action: "stage_selected",
      value: leadStage,
      reason: "semantic_v2_state_mutator",
    },
  ];

  return update;
}

export const weddingSalesStateV2TestHelpers = {
  buildSemanticV2MutationFailureUpdate,
};
