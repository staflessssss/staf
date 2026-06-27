import type {
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesState,
} from "./state";

export type WeddingAgentDomainSlot =
  | "weddingDate"
  | "location"
  | "names"
  | "venue"
  | "callTime"
  | "email"
  | "bookingConfirmation";

export type WeddingAgentDomainAction =
  | "start_wedding_lead_qualification"
  | "check_wedding_availability"
  | "ask_names_after_available_date"
  | "ask_venue"
  | "ask_call_time"
  | "answer_travel_resume_call_time"
  | "check_consultation_calendar"
  | "ask_email_after_available_calendar"
  | "ask_booking_confirmation"
  | "book_call"
  | "booking_confirmed"
  | "acknowledgement"
  | "handoff"
  | "reply_only";

export type WeddingAgentDomainRule =
  | "generic_lead_inquiry"
  | "date_and_location_present_availability_missing"
  | "availability_available_and_names_missing"
  | "availability_available_and_venue_missing"
  | "venue_collected_and_call_time_missing"
  | "travel_faq_interruption_resume_call_time"
  | "call_time_present_calendar_missing"
  | "calendar_available_and_email_missing"
  | "calendar_available_email_known_needs_confirmation"
  | "booking_confirmation_affirmative"
  | "booking_tool_confirmed"
  | "customer_acknowledgement"
  | "handoff_required"
  | "legacy_or_reply_only";

export type WeddingAgentDomainDecision = {
  activeFlow: "wedding_lead_qualification";
  currentRequestedSlot?: WeddingAgentDomainSlot;
  nextDomainAction: WeddingAgentDomainAction;
  matchedRule: WeddingAgentDomainRule;
  allowedResponseKeys: SimpleWeddingSalesResponseKey[];
  resumeAfterInterruption: boolean;
};

export const WeddingAgentDomain = {
  persona: {
    name: "Taras",
    businessName: "Myndful Films",
    role: "founder",
    voice: "warm, calm, helpful, concise, human",
  },
  goal: {
    primary: "qualify the wedding lead and book a consultation call",
    secondary: [
      "answer business questions from configured knowledge",
      "check wedding availability",
      "send pricing/collections guide when relevant",
      "avoid unsupported promises",
    ],
  },
  flow: {
    id: "wedding_lead_qualification",
    requiredSlots: [
      "weddingDate",
      "location",
      "names",
      "venue",
      "callTime",
      "email",
      "bookingConfirmation",
    ] as const satisfies readonly WeddingAgentDomainSlot[],
  },
  slotOrder: [
    "weddingDate",
    "location",
    "names",
    "venue",
    "callTime",
    "email",
    "bookingConfirmation",
  ] as const satisfies readonly WeddingAgentDomainSlot[],
  actions: {
    checkAvailability: {
      whenSlotsPresent: ["weddingDate", "location"] as const,
      requiredBeforeClaimingAvailability: true,
    },
    checkCalendar: {
      whenSlotsPresent: ["callTime"] as const,
      requiredBeforeSayingTimeWorks: true,
    },
    bookCall: {
      when: "bookingConfirmationAffirmative",
      requiredSlots: ["callTime", "email"] as const,
    },
  },
  interruptionPolicy: {
    pricing: {
      answerFromKnowledge: true,
      sendGuideIfAvailable: true,
      resumeRequestedSlot: true,
    },
    travel: {
      answerFromKnowledge: true,
      useRegionContext: true,
      resumeRequestedSlot: true,
    },
    raw_footage: {
      answerFromKnowledge: true,
      resumeRequestedSlot: true,
    },
    identity: {
      answerFromKnowledge: true,
      resumeRequestedSlot: true,
    },
    unknownSpecificBusinessQuestion: {
      handoff: true,
      pauseBot: true,
    },
  },
  responseKeysByAction: {
    start_wedding_lead_qualification: ["utter_ask_wedding_details"],
    check_wedding_availability: [],
    ask_names_after_available_date: [
      "utter_availability_available_ask_names",
      "utter_ask_names_after_details",
      "utter_ask_names",
    ],
    ask_venue: ["utter_ask_venue"],
    ask_call_time: ["utter_venue_collected_ask_call_time", "utter_ask_call_time"],
    answer_travel_resume_call_time: ["utter_answer_travel_resume_call_time"],
    check_consultation_calendar: [],
    ask_email_after_available_calendar: ["utter_calendar_available_ask_email", "utter_ask_email"],
    ask_booking_confirmation: ["utter_ask_booking_confirmation"],
    book_call: [],
    booking_confirmed: ["utter_booking_confirmed"],
    acknowledgement: ["utter_acknowledgement"],
    handoff: ["utter_handoff_ack"],
    reply_only: [],
  } as const satisfies Record<WeddingAgentDomainAction, readonly SimpleWeddingSalesResponseKey[]>,
} as const;

function hasNames(state: Pick<SimpleWeddingSalesState, "customerName" | "partnerName">) {
  return Boolean(state.customerName && state.partnerName);
}

function currentRequestedSlot(state: SimpleWeddingSalesState): WeddingAgentDomainSlot | undefined {
  if (state.nextStep === "ask_missing_info") {
    if (state.missingField === "names") {
      return "names";
    }

    return state.missingField;
  }

  if (state.nextStep === "ask_venue") {
    return "venue";
  }

  if (state.nextStep === "ask_call_time") {
    return state.replyContract?.mentionPolicy.consultation.mode === "ask_booking_confirmation"
      ? "bookingConfirmation"
      : "callTime";
  }

  if (state.nextStep === "ask_email") {
    return "email";
  }

  return undefined;
}

function actionFromDecision(state: SimpleWeddingSalesState): {
  action: WeddingAgentDomainAction;
  rule: WeddingAgentDomainRule;
} {
  const decision = state.decisionTrace;

  if (state.nextStep === "handoff" || decision?.replyType === "handoff") {
    return { action: "handoff", rule: "handoff_required" };
  }

  if (
    state.replyObligations?.includes("travel") &&
    state.nextStep === "ask_call_time"
  ) {
    return {
      action: "answer_travel_resume_call_time",
      rule: "travel_faq_interruption_resume_call_time",
    };
  }

  if (state.nextStep === "ask_missing_info" && state.missingField === "names") {
    return {
      action: "ask_names_after_available_date",
      rule: state.availability === "available"
        ? "availability_available_and_names_missing"
        : "legacy_or_reply_only",
    };
  }

  if (state.nextStep === "ask_venue") {
    return { action: "ask_venue", rule: "availability_available_and_venue_missing" };
  }

  if (state.nextStep === "ask_call_time") {
    return state.customerEmail && !state.customerConfirmedCallSlot && state.calendarStatus === "available"
      ? {
          action: "ask_booking_confirmation",
          rule: "calendar_available_email_known_needs_confirmation",
        }
      : {
          action: "ask_call_time",
          rule: state.venue && hasNames(state)
            ? "venue_collected_and_call_time_missing"
            : "legacy_or_reply_only",
        };
  }

  if (state.nextStep === "ask_email") {
    return {
      action: "ask_email_after_available_calendar",
      rule: "calendar_available_and_email_missing",
    };
  }

  if (state.nextStep === "book_call") {
    return { action: "book_call", rule: "booking_confirmation_affirmative" };
  }

  if (decision?.toolCalled === "checkAvailability") {
    return { action: "check_wedding_availability", rule: "date_and_location_present_availability_missing" };
  }

  if (decision?.toolCalled === "checkCalendar") {
    return { action: "check_consultation_calendar", rule: "call_time_present_calendar_missing" };
  }

  if (decision?.toolCalled === "bookCall") {
    return { action: "booking_confirmed", rule: "booking_tool_confirmed" };
  }

  if (decision?.replyType === "acknowledgement_only") {
    return { action: "acknowledgement", rule: "customer_acknowledgement" };
  }

  if (state.dialogueCommands?.some((command) => command.type === "start_flow")) {
    return { action: "start_wedding_lead_qualification", rule: "generic_lead_inquiry" };
  }

  return { action: "reply_only", rule: "legacy_or_reply_only" };
}

export function buildWeddingAgentDomainDecision(
  state: SimpleWeddingSalesState,
): WeddingAgentDomainDecision {
  const { action, rule } = actionFromDecision(state);
  const requestedSlot = currentRequestedSlot(state);

  return {
    activeFlow: WeddingAgentDomain.flow.id,
    currentRequestedSlot: requestedSlot,
    nextDomainAction: action,
    matchedRule: rule,
    allowedResponseKeys: [...WeddingAgentDomain.responseKeysByAction[action]],
    resumeAfterInterruption: Boolean(
      state.replyObligations?.some((obligation) =>
        ["pricing", "travel", "raw_footage", "identity"].includes(obligation),
      ) && requestedSlot,
    ),
  };
}
