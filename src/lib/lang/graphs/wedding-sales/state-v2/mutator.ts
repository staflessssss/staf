import type { WeddingSalesRuntimeMode, WeddingSalesState } from "../state";
import { calculateEffectiveEntityConfidence } from "../semantic-v2/effective-confidence";
import type { SemanticAnalysisV2, SemanticProvidedValueV2, WeddingSalesField } from "../semantic-v2/schema";
import {
  hasStructuredCoupleNames,
  inferCoupleNamesFromRequestedAnswer,
  mergeKnownCoupleNames,
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

function isAgentDisabledForSemanticV2(agentId?: string) {
  return Boolean(
    agentId &&
      parseAgentAllowlist(process.env.WEDDING_SALES_SEMANTIC_V2_DISABLED_AGENT_IDS).has(agentId),
  );
}

export function isSemanticV2ExecutionEnabled(
  agentId?: string,
  runtimeMode?: WeddingSalesRuntimeMode,
) {
  if (!agentId) {
    return false;
  }

  if (runtimeMode === "unified_v2") {
    return !isAgentDisabledForSemanticV2(agentId);
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

function clearCalendarContext() {
  return {
    calendarContextDate: undefined,
    suggestedCallTimes: undefined,
  } satisfies Partial<WeddingSalesState>;
}

function normalizeBareCallTime(value: string) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(value.trim());
  if (!match) {
    return undefined;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3]?.toLowerCase();

  if (hour > 23 || minute > 59 || (meridiem && (hour < 1 || hour > 12))) {
    return undefined;
  }

  if (meridiem === "am" && hour === 12) {
    hour = 0;
  } else if (meridiem === "pm" && hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

function hasAcceptedSalesFlowField(fields: Set<WeddingSalesField>) {
  return [
    "customerName",
    "partnerName",
    "names",
    "weddingDate",
    "weddingYear",
    "location",
    "venue",
    "callTime",
    "email",
  ].some((field) => fields.has(field as WeddingSalesField));
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
  const analysis = normalizePendingResolutionIntoEntities(args.analysis);
  const effective = calculateEffectiveEntityConfidence({
    ...args,
    analysis,
  }).filter((entry) => entry.field === args.field);
  return effective
    .sort((a, b) => Number(b.valid) - Number(a.valid) || b.effectiveConfidence - a.effectiveConfidence)[0];
}

function normalizePendingResolutionIntoEntities(analysis: SemanticAnalysisV2): SemanticAnalysisV2 {
  const pending = analysis.pendingResolution;

  if (
    !pending ||
    pending.type !== "correct" ||
    !pending.proposedValue ||
    pending.confidence < PENDING_ENTITY_THRESHOLD
  ) {
    return analysis;
  }

  const alreadyHasFieldEntity = analysis.entities.some(
    (entity) =>
      entity.field === pending.field &&
      normalizeForComparison(entity.evidence) === normalizeForComparison(pending.evidence),
  );

  if (alreadyHasFieldEntity) {
    return analysis;
  }

  return {
    ...analysis,
    entities: [
      ...analysis.entities,
      {
        field: pending.field,
        value: pending.proposedValue,
        normalizedValue: pending.proposedValue,
        confidence: pending.confidence,
        evidence: pending.evidence,
        alternatives: [],
      },
    ],
  };
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

function evidenceContainsYear(evidence: string) {
  return (
    /\b(?:19|20)\d{2}\b/.test(evidence) ||
    /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(evidence)
  );
}

const MONTH_INDEX: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function extractMonthDay(value: string) {
  const monthNameMatch = /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(value);
  if (monthNameMatch) {
    const month = MONTH_INDEX[monthNameMatch[1].toLowerCase()];
    const day = Number(monthNameMatch[2]);
    if (month && day >= 1 && day <= 31) {
      return {
        display: `${monthNameMatch[1]} ${day}`,
        month,
        day: String(day).padStart(2, "0"),
      };
    }
  }

  const numericMatch = /\b(\d{1,2})[./-](\d{1,2})\b/.exec(value);
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        display: `${month}/${day}`,
        month: String(month).padStart(2, "0"),
        day: String(day).padStart(2, "0"),
      };
    }
  }

  return undefined;
}

function buildIsoDateFromPartial(partialDate: string | undefined, year: string) {
  const monthDay = partialDate ? extractMonthDay(partialDate) : undefined;
  if (!monthDay) {
    return undefined;
  }

  const iso = `${year}-${monthDay.month}-${monthDay.day}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(monthDay.month) ||
    date.getUTCDate() !== Number(monthDay.day)
  ) {
    return undefined;
  }

  return iso;
}

function isAcceptedProvidedInfo(provided: SemanticProvidedValueV2, message: string | undefined) {
  return Boolean(
    provided &&
      provided.confidence >= ACCEPT_ENTITY_THRESHOLD &&
      evidenceIsPresent(message, provided.evidence),
  );
}

function wasNameFieldRequested(state: WeddingSalesState) {
  return Boolean(
    state.askedForNames ||
      state.lastActionPlan?.actions.some(
        (action) =>
          action.type === "ask_missing_field" &&
          (action.field === "names" ||
            action.field === "customerName" ||
            action.field === "partnerName"),
      ),
  );
}

function wasDateFieldRequested(state: WeddingSalesState) {
  return Boolean(
    state.lastActionPlan?.actions.some(
      (action) =>
        action.type === "ask_missing_field" &&
        (action.field === "weddingDate" ||
          action.field === "weddingYear" ||
          action.field === "names" ||
          action.field === "customerName" ||
          action.field === "partnerName"),
    ),
  );
}

function isSchedulingMessage(value: string) {
  return (
    /\b(?:call|consultation|meeting|appointment|schedule|book|booking)\b/i.test(value) ||
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(value)
  );
}

function isWeddingDateContext(value: string) {
  return /\b(?:wedding|married|marry|get married|getting married)\b/i.test(value);
}

function collectRequestedCoupleNames(args: {
  state: WeddingSalesState;
  analysis: SemanticAnalysisV2;
}) {
  if (!wasNameFieldRequested(args.state)) {
    return [];
  }

  for (const entity of args.analysis.entities) {
    if (entity.field !== "names" || entity.confidence < PENDING_ENTITY_THRESHOLD) {
      continue;
    }

    const names =
      inferCoupleNamesFromRequestedAnswer(entity.value).length >= 2
        ? inferCoupleNamesFromRequestedAnswer(entity.value)
        : inferCoupleNamesFromRequestedAnswer(entity.evidence);

    if (names.length >= 2) {
      return names;
    }
  }

  return inferCoupleNamesFromRequestedAnswer(args.state.latestCustomerMessage);
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

  if (shouldRouteToOwnerContext(clientType) && !hasAcceptedSalesFlowField(args.acceptedFields)) {
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

  if (!hasStructuredCoupleNames(next) || (!next.weddingDate && !next.weddingDateText)) {
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

  const requestedCoupleNames = collectRequestedCoupleNames({ state, analysis });

  if (
    requestedCoupleNames.length >= 2 &&
    !hasStructuredCoupleNames(workingState(state, update))
  ) {
    Object.assign(
      update,
      mergeKnownCoupleNames({
        state: workingState(state, update),
        names: requestedCoupleNames,
        rolesUncertain: true,
      }),
    );
    acceptedFields.add("names");
    trace.push({
      action: "accepted",
      field: "names",
      value: requestedCoupleNames.join(" and "),
      reason: "requested_names_answer_grounded_as_known_couple_names",
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
        if (!state.weddingYearKnown && !evidenceContainsYear(entry.evidence)) {
          update.weddingDateText = extractMonthDay(entry.evidence || entry.value)?.display ?? entry.value;
          update.weddingYearKnown = false;
          trace.push({
            action: "partial",
            field,
            value: entry.value,
            reason: "wedding_date_missing_explicit_year",
          });
          continue;
        }

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
        {
          const weddingDate = buildIsoDateFromPartial(
            workingState(state, update).weddingDateText,
            entry.value,
          );
          if (weddingDate) {
            update.weddingDate = weddingDate;
            update.weddingDateText = undefined;
            acceptedFields.add("weddingDate");
            Object.assign(update, clearPendingChange());
          }
        }
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
          const bareCallTime = normalizeBareCallTime(callTimeValue);
          const resolvedCallTime =
            bareCallTime && state.calendarContextDate
              ? `${state.calendarContextDate}T${bareCallTime}:00`
              : callTimeValue;

          if (state.proposedCallTime && normalizeForComparison(state.proposedCallTime) !== normalizeForComparison(resolvedCallTime)) {
            Object.assign(update, clearCheckedCallSlot(), clearBookingResult());
          }
          if (!bareCallTime) {
            Object.assign(update, clearCalendarContext());
          }
          update.proposedCallTime = resolvedCallTime;
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

  if (
    !workingState(state, update).weddingDate &&
    !workingState(state, update).weddingDateText &&
    (wasDateFieldRequested(state) || isWeddingDateContext(state.latestCustomerMessage ?? "")) &&
    !isSchedulingMessage(state.latestCustomerMessage ?? "")
  ) {
    const monthDay = extractMonthDay(state.latestCustomerMessage ?? "");
    if (monthDay) {
      const knownYear = workingState(state, update).weddingYear;
      const weddingDate = knownYear
        ? buildIsoDateFromPartial(monthDay.display, knownYear)
        : undefined;

      if (weddingDate) {
        update.weddingDate = weddingDate;
        update.weddingDateText = undefined;
        update.weddingYearKnown = true;
        acceptedFields.add("weddingDate");
        trace.push({
          action: "accepted",
          field: "weddingDate",
          value: weddingDate,
          reason: "deterministic_partial_date_grounding",
        });
      } else {
        update.weddingDateText = monthDay.display;
        update.weddingYearKnown = false;
        trace.push({
          action: "partial",
          field: "weddingDate",
          value: monthDay.display,
          reason: "deterministic_partial_date_grounding",
        });
      }
    }
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
