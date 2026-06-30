import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildChannelDeliveryPlan } from "@/lib/agents/wedding-sales-simple/delivery-plan";
import { buildSimpleWeddingKnowledgeContext } from "@/lib/lang/graphs/wedding-sales-simple/knowledge";
import { buildReplyActionContract, type ReplyActionContract } from "@/lib/lang/graphs/wedding-sales-simple/reply-contract";
import { updateSimpleWeddingReplyMemory } from "@/lib/lang/graphs/wedding-sales-simple/reply-memory";
import { writeConstrainedWeddingReply } from "@/lib/lang/graphs/wedding-sales-simple/reply-writer";
import { decideNextStep } from "@/lib/lang/graphs/wedding-sales-simple/decide";
import {
  createInitialSimpleWeddingSalesState,
  derivePendingUserAction,
  mergeTurnUnderstanding,
  type SimpleWeddingSalesState,
} from "@/lib/lang/graphs/wedding-sales-simple/state";
import { understandTurnHeuristically } from "@/lib/lang/graphs/wedding-sales-simple/understand";
import {
  markFlowDecisionSelection,
  runWeddingLeadFlowShadow,
  shouldActivateFlowDecision,
} from "@/lib/lang/graphs/wedding-sales-simple/flow-runner";
import { buildWeddingAgentDomainDecision } from "@/lib/lang/graphs/wedding-sales-simple/wedding-agent-domain";
import { resolveWeddingSalesRegion, type WeddingSalesConfig } from "@/lib/lang/graphs/wedding-sales/config";

type ToolName =
  | "check_wedding_availability"
  | "check_consultation_calendar"
  | "book_consultation";

type ForcedTool = {
  status: "available" | "unavailable" | "tool_error" | "busy" | "booked";
  date?: string;
  time?: string;
  eventId?: string;
};

type JourneyExpectation = {
  weddingDate?: string;
  locationContains?: string;
  customerNameEmpty?: boolean;
  noFakeName?: boolean;
  serviceRegion?: "FL" | "NC_SC_GA" | "unknown";
  availabilityToolStatus?: SimpleWeddingSalesState["availabilityToolStatus"];
  availability?: SimpleWeddingSalesState["availability"];
  namesCaptured?: boolean;
  venueCaptured?: boolean;
  emailCaptured?: boolean;
  callTimeCaptured?: boolean;
  booked?: boolean;
  responseKey?: string;
  nextStep?: string;
  missingField?: string;
  mode?: string;
  handoffReason?: string;
  escalated?: boolean;
  humanReviewRequired?: boolean;
  toolCalled?: ToolName;
  toolCallCount?: number;
  bookConsultationCallCount?: number;
  guideSentCount?: number;
  attachmentCount?: number;
  expectNoTool?: boolean;
  attachmentsInclude?: string;
  outboundContains?: string | string[];
  outboundContainsAny?: string[];
  outboundNotContains?: string | string[];
  customerName?: string;
  partnerName?: string;
  customerEmail?: string;
  asksFor?: "names" | "venue" | "callTime" | "email" | "bookingConfirmation" | "weddingDate" | "location";
  noStaleDate?: string;
  noStaleLocation?: string;
  noFakeDiscount?: boolean;
  noInventedPackage?: boolean;
  noToolErrorCopyOnHumanRequest?: boolean;
  noDuplicateBooking?: boolean;
  noDuplicateGuide?: boolean;
  noDuplicateBookingConfirmation?: boolean;
  noOfferedBusyTime?: string;
  noHandoff?: boolean;
  noBotPaused?: boolean;
  noEscalated?: boolean;
  noFalseUnavailable?: boolean;
  noDuplicateQuestion?: boolean;
};

type JourneyTurn = {
  user: string;
  forceTools?: Partial<Record<ToolName, ForcedTool>>;
  expect?: JourneyExpectation;
};

type JourneyCase = {
  id: string;
  title?: string;
  turns: JourneyTurn[];
};

type JourneyCasesFile = {
  cases: JourneyCase[];
};

type JourneyReportRow = {
  scenario: string;
  title?: string;
  turn: number;
  user: string;
  slotsBefore: Record<string, unknown>;
  slotsAfter: Record<string, unknown>;
  extractedSlots: Record<string, unknown>;
  toolCalls: ToolName[];
  cumulativeToolCalls: ToolName[];
  toolResults: Array<{ toolName: ToolName; result: string }>;
  responseKey?: string;
  nextStep?: string;
  missingField?: string;
  mode: SimpleWeddingSalesState["mode"];
  handoffReason?: string;
  escalated: boolean;
  humanReviewRequired: boolean;
  outboundText: string;
  attachments: Array<{ type: string; purpose?: string; url: string }>;
  passed: boolean;
  failures: string[];
};

const casesPath = path.join(process.cwd(), "tests", "wedding-sales-simple", "journey-cases.yml");
const reportDir = path.join(process.cwd(), "reports", "wedding-journeys", "latest");

function parseCases(): JourneyCasesFile {
  return JSON.parse(readFileSync(casesPath, "utf8")) as JourneyCasesFile;
}

function testConfig(): Partial<WeddingSalesConfig> {
  const config = {
    pricing: {
      startPrice: "$2,800",
      currency: "USD",
      coverageHours: 8,
    },
    pricingByRegion: {
      FL: {
        startPrice: "$2,800",
        currency: "USD",
        coverageHours: 8,
        promotionText: "Also, we are running a 20% discount through June 30.",
      },
      NC_SC_GA: {
        startPrice: "$3,600",
        currency: "USD",
        coverageHours: 8,
        promotionText: "Also, we are running a 20% discount through June 30.",
      },
    },
    guide: {
      imageUrl: "https://example.com/fl-guide.png",
      fileName: "Collections guide",
    },
    guidesByRegion: {
      FL: {
        imageUrl: "https://example.com/fl-guide.png",
        fileName: "FL Collections guide",
      },
      NC_SC_GA: {
        imageUrl: "https://example.com/nc-sc-ga-guide.png",
        fileName: "NC SC GA Collections guide",
      },
    },
  };

  return config as Partial<WeddingSalesConfig>;
}

function slotsSnapshot(state?: Partial<SimpleWeddingSalesState>) {
  return {
    customerName: state?.customerName,
    partnerName: state?.partnerName,
    weddingDate: state?.weddingDate,
    weddingDateDisplay: state?.weddingDateDisplay,
    location: state?.location,
    serviceRegion: state?.serviceRegion,
    availability: state?.availability,
    availabilityToolStatus: state?.availabilityToolStatus,
    venue: state?.venue,
    proposedCallTime: state?.proposedCallTime,
    checkedCallDate: state?.checkedCallDate,
    checkedCallTime: state?.checkedCallTime,
    calendarStatus: state?.calendarStatus,
    customerEmail: state?.customerEmail,
    pendingUserAction: state?.pendingUserAction,
    bookingConfirmed: state?.bookingConfirmed,
  };
}

function toolNameForStep(state: SimpleWeddingSalesState): "checkAvailability" | "checkCalendar" | "bookCall" | undefined {
  if (state.nextStep === "check_availability") {
    return "checkAvailability";
  }

  if (state.nextStep === "check_calendar") {
    return "checkCalendar";
  }

  if (state.nextStep === "book_call") {
    return "bookCall";
  }

  return undefined;
}

function applyDecision(state: SimpleWeddingSalesState): SimpleWeddingSalesState {
  const decision = decideNextStep(state);
  const legacyState = {
    ...state,
    ...decision.statePatch,
    nextStep: decision.nextStep,
    missingField: decision.missingField,
    mode: decision.mode ?? state.mode,
    handoffReason: decision.handoffReason,
    decisionTrace: decision.trace,
  };
  const flowRunner = runWeddingLeadFlowShadow({
    state: legacyState,
    dialogueCommands: legacyState.dialogueCommands,
    pendingUserAction: legacyState.pendingUserAction ?? null,
    legacyDecision: decision.trace,
  });
  const useFlowRunnerDecision = shouldActivateFlowDecision(flowRunner);
  const selectedFlowRunner = markFlowDecisionSelection(flowRunner, useFlowRunnerDecision);
  const finalDecisionTrace =
    useFlowRunnerDecision && selectedFlowRunner
      ? {
          ...decision.trace,
          nextStep: selectedFlowRunner.predictedNextStep,
          responseKey: selectedFlowRunner.predictedResponseKey ?? decision.trace.responseKey,
          replyType: selectedFlowRunner.legacyReplyType ?? decision.trace.replyType,
          reason: selectedFlowRunner.reason,
        }
      : decision.trace;

  return {
    ...legacyState,
    nextStep: finalDecisionTrace.nextStep,
    decisionTrace: finalDecisionTrace,
    flowRunner: selectedFlowRunner ?? state.flowRunner,
  };
}

function selectDomainResponseKey(args: {
  contract: ReplyActionContract;
  domainDecision: ReturnType<typeof buildWeddingAgentDomainDecision>;
}) {
  const currentResponseKey = args.contract.responseKey;

  if (currentResponseKey && args.domainDecision.allowedResponseKeys.includes(currentResponseKey)) {
    return currentResponseKey;
  }

  if (currentResponseKey) {
    return currentResponseKey;
  }

  return args.domainDecision.allowedResponseKeys[0];
}

function applyDomainResponseKey(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
}) {
  const initialDomainState = {
    ...args.state,
    replyContract: args.contract,
  };
  const initialDomainDecision = buildWeddingAgentDomainDecision(initialDomainState);
  const selectedResponseKey = selectDomainResponseKey({
    contract: args.contract,
    domainDecision: initialDomainDecision,
  });

  if (!selectedResponseKey) {
    return {
      state: {
        ...initialDomainState,
        domainDecision: initialDomainDecision,
      },
      contract: args.contract,
    };
  }

  const contract = {
    ...args.contract,
    responseKey: selectedResponseKey,
  };
  const decisionTrace = args.state.decisionTrace
    ? {
        ...args.state.decisionTrace,
        responseKey: selectedResponseKey,
      }
    : undefined;
  const domainState = {
    ...args.state,
    decisionTrace,
    replyContract: contract,
  };

  return {
    state: {
      ...domainState,
      domainDecision: buildWeddingAgentDomainDecision(domainState),
    },
    contract,
  };
}

function normalizedRegion(state: SimpleWeddingSalesState) {
  return (resolveWeddingSalesRegion(state) ?? state.serviceRegion ?? "unknown") as "FL" | "NC_SC_GA" | "unknown";
}

function regionDisplay(region: string) {
  return region === "NC_SC_GA" ? "NC/SC/GA" : region;
}

function availabilityResult(args: {
  status: ForcedTool["status"];
  state: SimpleWeddingSalesState;
  region: "FL" | "NC_SC_GA" | "unknown";
}) {
  if (args.status === "tool_error") {
    return {
      status: "missing_credentials",
      summary: "Forced journey matrix tool error.",
    };
  }

  if (args.status === "unavailable") {
    return {
      status: "unavailable",
      date: args.state.weddingDate,
      requestedDate: args.state.weddingDate,
      region: regionDisplay(args.region),
      requestedRegion: regionDisplay(args.region),
      available: false,
      suggestedDates: ["2026-10-10", "2026-10-17"],
    };
  }

  return {
    status: "available",
    date: args.state.weddingDate,
    requestedDate: args.state.weddingDate,
    region: regionDisplay(args.region),
    requestedRegion: regionDisplay(args.region),
    available: true,
  };
}

function forceAvailability(state: SimpleWeddingSalesState, forced: ForcedTool): SimpleWeddingSalesState {
  const region = normalizedRegion(state);
  const availabilityStatus = forced.status === "unavailable"
    ? "unavailable"
    : forced.status === "tool_error"
      ? "unknown"
      : "available";
  const availabilityToolStatus =
    forced.status === "tool_error"
      ? "tool_error"
      : region === "unknown"
        ? "needs_region"
        : availabilityStatus === "unavailable"
          ? "unavailable"
          : "available";
  const result = JSON.stringify(availabilityResult({ status: forced.status, state, region }));

  return {
    ...state,
    availability: availabilityStatus,
    mode: forced.status === "tool_error" ? state.mode : "bot_active",
    handoffReason: forced.status === "tool_error" ? state.handoffReason : undefined,
    serviceRegion: region,
    availabilityToolStatus,
    availabilityRegion: region === "unknown" ? undefined : region,
    availabilityContextDate: state.weddingDate,
    availabilityCheck: state.weddingDate
      ? {
          date: state.weddingDate,
          location: state.location,
          status: availabilityStatus,
          checkedAt: "2026-06-30T00:00:00.000Z",
        }
      : undefined,
    suggestedWeddingDates: forced.status === "unavailable" ? ["2026-10-10", "2026-10-17"] : undefined,
    toolObservations: [
      ...state.toolObservations,
      {
        toolName: "check_wedding_availability",
        result,
      },
    ],
  };
}

function forceCalendar(state: SimpleWeddingSalesState, forced: ForcedTool): SimpleWeddingSalesState {
  const checkedCallDate = forced.date ?? state.checkedCallDate ?? "2026-10-05";
  const checkedCallTime = forced.time ?? state.checkedCallTime ?? "10:00";
  const status = forced.status === "busy" ? "busy" : "available";
  const result = JSON.stringify({
    status,
    date: checkedCallDate,
    time: checkedCallTime,
    startTime: `${checkedCallDate}T${checkedCallTime}:00-04:00`,
    endTime: `${checkedCallDate}T10:30:00-04:00`,
    suggestedTimes: ["10:00", "11:00"],
  });

  return {
    ...state,
    calendarStatus: status,
    calendarContextDate: checkedCallDate,
    checkedCallDate,
    checkedCallTime,
    checkedCallStartTime: `${checkedCallDate}T${checkedCallTime}:00-04:00`,
    checkedCallEndTime: `${checkedCallDate}T10:30:00-04:00`,
    suggestedCallTimes: status === "busy" ? ["10:00", "11:00"] : undefined,
    consultationCheck: {
      proposedTime: state.proposedCallTime ?? checkedCallTime,
      status: status === "available" ? "available" : "unavailable",
      checkedAt: "2026-06-30T00:00:00.000Z",
    },
    toolObservations: [
      ...state.toolObservations,
      {
        toolName: "check_consultation_calendar",
        result,
      },
    ],
  };
}

function forceBooking(state: SimpleWeddingSalesState, forced: ForcedTool): SimpleWeddingSalesState {
  const booked = forced.status === "booked";
  const result = JSON.stringify({
    status: booked ? "booked" : "failed",
    eventId: forced.eventId,
  });

  return {
    ...state,
    bookingConfirmed: booked,
    pendingUserAction: booked ? null : state.pendingUserAction,
    callTimeContext: booked ? undefined : state.callTimeContext,
    callTimeAmbiguousChoice: booked ? false : state.callTimeAmbiguousChoice,
    bookingAttempt: {
      status: booked ? "booked" : "failed",
      attemptedAt: "2026-06-30T00:00:00.000Z",
    },
    bookedEventId: forced.eventId,
    toolObservations: [
      ...state.toolObservations,
      {
        toolName: "book_consultation",
        result,
      },
    ],
  };
}

function applyForcedTools(state: SimpleWeddingSalesState, forceTools: JourneyTurn["forceTools"]) {
  if (!forceTools) {
    return state;
  }

  let nextState = state;
  const toolCalled = toolNameForStep(nextState);

  if (forceTools.check_wedding_availability) {
    nextState = forceAvailability(nextState, forceTools.check_wedding_availability);
    nextState = applyDecision(nextState);
    nextState = {
      ...nextState,
      decisionTrace: nextState.decisionTrace
        ? {
            ...nextState.decisionTrace,
            toolCalled: "checkAvailability",
          }
        : undefined,
    };
  }

  if (forceTools.check_consultation_calendar) {
    nextState = forceCalendar(nextState, forceTools.check_consultation_calendar);
    nextState = applyDecision(nextState);
    nextState = {
      ...nextState,
      decisionTrace: nextState.decisionTrace
        ? {
            ...nextState.decisionTrace,
            toolCalled: "checkCalendar",
          }
        : undefined,
    };
  }

  if (forceTools.book_consultation) {
    nextState = forceBooking(nextState, forceTools.book_consultation);
    nextState = applyDecision(nextState);
    nextState = {
      ...nextState,
      decisionTrace: nextState.decisionTrace
        ? {
            ...nextState.decisionTrace,
            toolCalled: "bookCall",
          }
        : undefined,
    };
  }

  if (!nextState.decisionTrace?.toolCalled && toolCalled) {
    return {
      ...nextState,
      decisionTrace: nextState.decisionTrace
        ? {
            ...nextState.decisionTrace,
            toolCalled,
          }
        : undefined,
    };
  }

  return nextState;
}

function attachmentList(
  state: SimpleWeddingSalesState,
  knowledge: ReturnType<typeof buildSimpleWeddingKnowledgeContext>,
): Array<{ type: "image" | "link"; purpose: "pricing_guide"; url: string; label?: string }> {
  if (state.replyContract?.mentionPolicy.guide.mode !== "send_attachment") {
    return [];
  }

  if (knowledge.guide.imageUrl) {
    return [
      {
        type: "image",
        url: knowledge.guide.imageUrl,
        label: knowledge.guide.fileName ?? "Collections guide",
        purpose: "pricing_guide",
      },
    ];
  }

  if (knowledge.guide.link) {
    return [
      {
        type: "link",
        url: knowledge.guide.link,
        label: "Collections guide",
        purpose: "pricing_guide",
      },
    ];
  }

  return [];
}

function asList(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function hasNames(state: SimpleWeddingSalesState) {
  return Boolean(state.customerName && state.partnerName);
}

function asksFor(state: SimpleWeddingSalesState, ask: NonNullable<JourneyExpectation["asksFor"]>) {
  if (ask === "bookingConfirmation") {
    return state.pendingUserAction?.type === "booking_confirmation" ||
      state.replyContract?.mentionPolicy.consultation.mode === "ask_booking_confirmation";
  }

  if (ask === "weddingDate") {
    return state.replyContract?.requiredQuestion === "weddingDate";
  }

  return state.replyContract?.requiredQuestion === ask;
}

function duplicateQuestionCount(text: string) {
  return text.match(/\b(?:what\s+(?:wedding\s+)?date|date\s+(?:and|or)\s+(?:city|location)|city\s+(?:and|or)\s+date)\b/gi)?.length ?? 0;
}

function countTool(row: JourneyReportRow, toolName: ToolName) {
  return row.cumulativeToolCalls.filter((entry) => entry === toolName).length;
}

function countGuideMentions(state: SimpleWeddingSalesState, row: JourneyReportRow) {
  const memorySent = state.replyMemory?.mentioned?.guide ? 1 : 0;
  const currentAttachments = row.attachments.filter((attachment) => attachment.purpose === "pricing_guide").length;

  return Math.max(memorySent, currentAttachments);
}

function assertTurn(args: {
  state: SimpleWeddingSalesState;
  row: JourneyReportRow;
  expect?: JourneyExpectation;
}) {
  const failures: string[] = [];
  const { state, row, expect } = args;

  if (!expect) {
    return failures;
  }

  const responseKey = state.replyContract?.responseKey ?? state.decisionTrace?.responseKey;

  if (expect.weddingDate && state.weddingDate !== expect.weddingDate) {
    failures.push(`weddingDate expected ${expect.weddingDate}, got ${state.weddingDate ?? "none"}`);
  }

  if (expect.locationContains && !new RegExp(expect.locationContains, "i").test(state.location ?? "")) {
    failures.push(`location expected to contain ${expect.locationContains}, got ${state.location ?? "none"}`);
  }

  if (expect.customerNameEmpty && state.customerName) {
    failures.push(`customerName expected empty, got ${state.customerName}`);
  }

  if (expect.noFakeName) {
    const fakeNames = new Set(["interested", "info", "more info", "details", "wedding videography"]);
    const names = [state.customerName, state.partnerName]
      .filter(Boolean)
      .map((value) => value!.trim().toLowerCase());
    const fake = names.find((name) => fakeNames.has(name));

    if (fake) {
      failures.push(`fake name captured: ${fake}`);
    }
  }

  if (expect.serviceRegion && state.serviceRegion !== expect.serviceRegion) {
    failures.push(`serviceRegion expected ${expect.serviceRegion}, got ${state.serviceRegion ?? "none"}`);
  }

  if (expect.availabilityToolStatus && state.availabilityToolStatus !== expect.availabilityToolStatus) {
    failures.push(`availabilityToolStatus expected ${expect.availabilityToolStatus}, got ${state.availabilityToolStatus ?? "none"}`);
  }

  if (expect.availability && state.availability !== expect.availability) {
    failures.push(`availability expected ${expect.availability}, got ${state.availability ?? "none"}`);
  }

  if (expect.namesCaptured !== undefined && hasNames(state) !== expect.namesCaptured) {
    failures.push(`namesCaptured expected ${expect.namesCaptured}, got ${hasNames(state)}`);
  }

  if (expect.customerName && state.customerName !== expect.customerName) {
    failures.push(`customerName expected ${expect.customerName}, got ${state.customerName ?? "none"}`);
  }

  if (expect.partnerName && state.partnerName !== expect.partnerName) {
    failures.push(`partnerName expected ${expect.partnerName}, got ${state.partnerName ?? "none"}`);
  }

  if (expect.customerEmail && state.customerEmail !== expect.customerEmail) {
    failures.push(`customerEmail expected ${expect.customerEmail}, got ${state.customerEmail ?? "none"}`);
  }

  if (expect.venueCaptured !== undefined && Boolean(state.venue) !== expect.venueCaptured) {
    failures.push(`venueCaptured expected ${expect.venueCaptured}, got ${Boolean(state.venue)}`);
  }

  if (expect.emailCaptured !== undefined && Boolean(state.customerEmail) !== expect.emailCaptured) {
    failures.push(`emailCaptured expected ${expect.emailCaptured}, got ${Boolean(state.customerEmail)}`);
  }

  if (expect.callTimeCaptured !== undefined && Boolean(state.proposedCallTime || state.checkedCallTime) !== expect.callTimeCaptured) {
    failures.push(`callTimeCaptured expected ${expect.callTimeCaptured}, got ${Boolean(state.proposedCallTime || state.checkedCallTime)}`);
  }

  if (expect.booked !== undefined && state.bookingConfirmed !== expect.booked) {
    failures.push(`booked expected ${expect.booked}, got ${state.bookingConfirmed}`);
  }

  if (expect.responseKey && responseKey !== expect.responseKey) {
    failures.push(`responseKey expected ${expect.responseKey}, got ${responseKey ?? "none"}`);
  }

  if (expect.nextStep && state.nextStep !== expect.nextStep) {
    failures.push(`nextStep expected ${expect.nextStep}, got ${state.nextStep ?? "none"}`);
  }

  if (expect.missingField && state.missingField !== expect.missingField) {
    failures.push(`missingField expected ${expect.missingField}, got ${state.missingField ?? "none"}`);
  }

  if (expect.mode && state.mode !== expect.mode) {
    failures.push(`mode expected ${expect.mode}, got ${state.mode}`);
  }

  if (expect.handoffReason && state.handoffReason !== expect.handoffReason) {
    failures.push(`handoffReason expected ${expect.handoffReason}, got ${state.handoffReason ?? "none"}`);
  }

  if (expect.escalated !== undefined && row.escalated !== expect.escalated) {
    failures.push(`escalated expected ${expect.escalated}, got ${row.escalated}`);
  }

  if (expect.humanReviewRequired !== undefined && row.humanReviewRequired !== expect.humanReviewRequired) {
    failures.push(`humanReviewRequired expected ${expect.humanReviewRequired}, got ${row.humanReviewRequired}`);
  }

  if (expect.toolCalled && !row.toolCalls.includes(expect.toolCalled)) {
    failures.push(`expected tool call ${expect.toolCalled}`);
  }

  if (expect.expectNoTool && row.toolCalls.length > 0) {
    failures.push(`expected no tool calls, got ${row.toolCalls.join(", ")}`);
  }

  if (expect.toolCallCount !== undefined && row.toolCalls.length !== expect.toolCallCount) {
    failures.push(`toolCallCount expected ${expect.toolCallCount}, got ${row.toolCalls.length}`);
  }

  if (
    expect.bookConsultationCallCount !== undefined &&
    countTool(row, "book_consultation") !== expect.bookConsultationCallCount
  ) {
    failures.push(`bookConsultationCallCount expected ${expect.bookConsultationCallCount}, got ${countTool(row, "book_consultation")}`);
  }

  if (expect.guideSentCount !== undefined && countGuideMentions(state, row) !== expect.guideSentCount) {
    failures.push(`guideSentCount expected ${expect.guideSentCount}, got ${countGuideMentions(state, row)}`);
  }

  if (expect.attachmentCount !== undefined && row.attachments.length !== expect.attachmentCount) {
    failures.push(`attachmentCount expected ${expect.attachmentCount}, got ${row.attachments.length}`);
  }

  if (expect.attachmentsInclude && !row.attachments.some((attachment) => attachment.purpose === expect.attachmentsInclude)) {
    failures.push(`expected attachment purpose ${expect.attachmentsInclude}`);
  }

  for (const text of asList(expect.outboundContains)) {
    if (!row.outboundText.toLowerCase().includes(text.toLowerCase())) {
      failures.push(`outbound expected to contain "${text}"`);
    }
  }

  if (
    expect.outboundContainsAny?.length &&
    !expect.outboundContainsAny.some((text) =>
      row.outboundText.toLowerCase().includes(text.toLowerCase()),
    )
  ) {
    failures.push(`outbound expected to contain any of: ${expect.outboundContainsAny.join(", ")}`);
  }

  for (const text of asList(expect.outboundNotContains)) {
    if (row.outboundText.toLowerCase().includes(text.toLowerCase())) {
      failures.push(`outbound expected not to contain "${text}"`);
    }
  }

  if (expect.asksFor && !asksFor(state, expect.asksFor)) {
    failures.push(`expected ask for ${expect.asksFor}, got ${state.replyContract?.requiredQuestion ?? state.pendingUserAction?.type ?? "none"}`);
  }

  if (expect.noHandoff && (state.nextStep === "handoff" || state.mode !== "bot_active" || state.handoffReason)) {
    failures.push(`expected no handoff, got ${state.nextStep}/${state.mode}/${state.handoffReason ?? "none"}`);
  }

  if (expect.noBotPaused && state.mode === "bot_paused") {
    failures.push("expected no bot_paused");
  }

  if (expect.noEscalated && row.escalated) {
    failures.push("expected no escalated state");
  }

  if (
    expect.noFalseUnavailable &&
    state.availability !== "unavailable" &&
    /\b(?:not open|not available|unavailable|fully booked)\b/i.test(row.outboundText)
  ) {
    failures.push("false unavailable language appeared");
  }

  if (expect.noDuplicateQuestion && duplicateQuestionCount(row.outboundText) > 1) {
    failures.push("duplicate date/city question appeared");
  }

  if (expect.noStaleDate && row.outboundText.toLowerCase().includes(expect.noStaleDate.toLowerCase())) {
    failures.push(`stale date appeared: ${expect.noStaleDate}`);
  }

  if (expect.noStaleLocation && row.outboundText.toLowerCase().includes(expect.noStaleLocation.toLowerCase())) {
    failures.push(`stale location appeared: ${expect.noStaleLocation}`);
  }

  if (expect.noFakeDiscount && /\b(?:extra|another|additional|special)\s+\d{1,2}%|\$1,000|\$1000\b/i.test(row.outboundText)) {
    failures.push("fake discount or requested low price appeared");
  }

  if (expect.noInventedPackage && /\b(?:budget|starter|basic)\s+(?:package|collection)\b/i.test(row.outboundText)) {
    failures.push("invented package appeared");
  }

  if (
    expect.noToolErrorCopyOnHumanRequest &&
    /\b(?:Good question|double-check availability|wrong answer)\b/i.test(row.outboundText)
  ) {
    failures.push("tool-error copy appeared on human request");
  }

  if (expect.noDuplicateBooking && countTool(row, "book_consultation") > 1) {
    failures.push(`duplicate booking tool calls: ${countTool(row, "book_consultation")}`);
  }

  if (expect.noDuplicateGuide && countGuideMentions(state, row) > 1) {
    failures.push(`duplicate guide sends: ${countGuideMentions(state, row)}`);
  }

  if (expect.noDuplicateBookingConfirmation) {
    const confirmationQuestionCount =
      row.outboundText.match(/\b(?:lock in|would you still like me to lock|want me to lock)\b/gi)?.length ?? 0;

    if (confirmationQuestionCount > 1) {
      failures.push(`duplicate booking confirmation question appeared ${confirmationQuestionCount} times`);
    }
  }

  if (expect.noOfferedBusyTime) {
    const normalizedBusyTime = expect.noOfferedBusyTime.toLowerCase();
    const offeredAlternatives = /but\s+([\s\S]{0,80}?)(?:instead|is open|are open|would)/i.exec(row.outboundText)?.[1]?.toLowerCase() ?? "";

    if (offeredAlternatives.includes(normalizedBusyTime)) {
      failures.push(`busy time offered as alternative: ${expect.noOfferedBusyTime}`);
    }
  }

  return failures;
}

function runTurn(args: {
  scenario: JourneyCase;
  state: SimpleWeddingSalesState | undefined;
  turn: JourneyTurn;
  index: number;
  cumulativeToolCalls: ToolName[];
}): { state: SimpleWeddingSalesState; row: JourneyReportRow } {
  const slotsBefore = slotsSnapshot(args.state);
  let state = createInitialSimpleWeddingSalesState({
    channel: "instagram",
    message: args.turn.user,
    tenantId: "tenant-journey-matrix",
    agentId: "agent-journey-matrix",
    contactId: args.scenario.id,
    previousState: args.state,
  });
  const understanding = understandTurnHeuristically(state);
  state = applyDecision(mergeTurnUnderstanding(state, understanding));
  state = applyForcedTools(state, args.turn.forceTools);

  const knowledge = buildSimpleWeddingKnowledgeContext({
    channel: "instagram",
    config: testConfig(),
    state,
  });
  const baseContract = buildReplyActionContract({ state, knowledge });
  const domainApplied = applyDomainResponseKey({ state, contract: baseContract });
  state = domainApplied.state;
  const contract = domainApplied.contract;
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract });
  state = {
    ...state,
    responseDraft: reply.text,
    replyGuardResult: reply.guardResult,
    writer: {
      ...reply.writer,
      responseKey: contract.responseKey ?? reply.writer.responseKey,
    },
    writerCatalog: reply.writerCatalog,
    replyContract: contract,
    decisionTrace: state.decisionTrace
      ? {
          ...state.decisionTrace,
          responseKey: contract.responseKey ?? state.decisionTrace.responseKey,
        }
      : undefined,
  };
  state = {
    ...state,
    replyMemory: updateSimpleWeddingReplyMemory({
      state,
      contract,
      knowledge,
      replyText: reply.text,
      writer: state.writer!,
    }),
  };
  state = {
    ...state,
    pendingUserAction: derivePendingUserAction(state),
  };
  const attachments = attachmentList(state, knowledge);
  const deliveryPlan = buildChannelDeliveryPlan({
    channel: "instagram",
    outboundText: reply.text,
    replyContract: contract,
    attachments,
    conversationId: args.scenario.id,
    turnId: `${args.scenario.id}-${args.index}`,
    channelConfig: {
      delivery: {
        enableInstagramSemanticDeliveryPlan: true,
      },
    },
  });

  void deliveryPlan;

  const toolCalls = state.toolObservations.map((entry) => entry.toolName as ToolName);
  const cumulativeToolCalls = [...args.cumulativeToolCalls, ...toolCalls];
  const row: JourneyReportRow = {
    scenario: args.scenario.id,
    title: args.scenario.title,
    turn: args.index,
    user: args.turn.user,
    slotsBefore,
    slotsAfter: slotsSnapshot(state),
    extractedSlots: understanding.facts,
    toolCalls,
    cumulativeToolCalls,
    toolResults: state.toolObservations.map((entry) => ({
      toolName: entry.toolName as ToolName,
      result: entry.result,
    })),
    responseKey: state.replyContract?.responseKey ?? state.decisionTrace?.responseKey,
    nextStep: state.nextStep,
    missingField: state.missingField,
    mode: state.mode,
    handoffReason: state.handoffReason,
    escalated: state.mode !== "bot_active" || state.nextStep === "handoff",
    humanReviewRequired: state.availabilityToolStatus === "tool_error" || state.mode === "human_needed",
    outboundText: reply.text,
    attachments,
    passed: true,
    failures: [],
  };
  row.failures = assertTurn({ state, row, expect: args.turn.expect });
  row.passed = row.failures.length === 0;

  return { state, row };
}

function runScenario(scenario: JourneyCase): JourneyReportRow[] {
  let state: SimpleWeddingSalesState | undefined;
  const rows: JourneyReportRow[] = [];
  let cumulativeToolCalls: ToolName[] = [];

  scenario.turns.forEach((turn, index) => {
    const result = runTurn({
      scenario,
      state,
      turn,
      index: index + 1,
      cumulativeToolCalls,
    });
    state = result.state;
    cumulativeToolCalls = result.row.cumulativeToolCalls;
    rows.push(result.row);
  });

  return rows;
}

function escapeHtml(value: string | undefined) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeReports(rows: JourneyReportRow[]) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(path.join(reportDir, "results.json"), `${JSON.stringify(rows, null, 2)}\n`);
  const scenarioIds = [...new Set(rows.map((row) => row.scenario))];
  const finalRows = scenarioIds
    .map((scenario) => [...rows].reverse().find((row) => row.scenario === scenario))
    .filter((row): row is JourneyReportRow => Boolean(row));
  const finalStates = {
    booked: finalRows.filter((row) => row.slotsAfter.bookingConfirmed === true).length,
    humanReview: finalRows.filter((row) => row.humanReviewRequired || row.mode === "human_needed").length,
    unavailable: finalRows.filter((row) => row.slotsAfter.availability === "unavailable").length,
    waitingClarification: finalRows.filter((row) =>
      !row.escalated &&
      row.slotsAfter.bookingConfirmed !== true &&
      row.slotsAfter.availability !== "unavailable" &&
      Boolean(row.missingField || row.nextStep?.startsWith("ask_")),
    ).length,
    abandoned: finalRows.filter((row) =>
      !row.escalated &&
      row.slotsAfter.bookingConfirmed !== true &&
      row.slotsAfter.availability !== "unavailable" &&
      !row.missingField &&
      !row.nextStep?.startsWith("ask_"),
    ).length,
  };
  const failuresByScenario = scenarioIds
    .map((scenario) => ({
      scenario,
      failures: rows.filter((row) => row.scenario === scenario && !row.passed),
    }))
    .filter((entry) => entry.failures.length > 0);

  const markdown = [
    "# Wedding Full-Journey Matrix",
    "",
    `Passed turns: ${rows.filter((row) => row.passed).length}/${rows.length}`,
    `Passed scenarios: ${scenarioIds.filter((scenario) => rows.filter((row) => row.scenario === scenario).every((row) => row.passed)).length}/${scenarioIds.length}`,
    "",
    "## Scenario Summary",
    "",
    `Total scenarios: ${scenarioIds.length}`,
    `Total turns: ${rows.length}`,
    `Final booked: ${finalStates.booked}`,
    `Final human review: ${finalStates.humanReview}`,
    `Final unavailable: ${finalStates.unavailable}`,
    `Final waiting clarification: ${finalStates.waitingClarification}`,
    `Final abandoned: ${finalStates.abandoned}`,
    "",
    "## Failures By Scenario",
    "",
    ...(failuresByScenario.length
      ? failuresByScenario.map((entry) =>
          `- ${entry.scenario}: ${entry.failures.map((row) => `turn ${row.turn}: ${row.failures.join("; ")}`).join(" | ")}`,
        )
      : ["None"]),
    "",
    "| Scenario | Turn | User | Date | Location | Region | Tool | Response key | Next step | Mode | Handoff | Attachments | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      [
        row.scenario,
        String(row.turn),
        row.user.replace(/\|/g, "\\|"),
        String(row.slotsAfter.weddingDate ?? ""),
        String(row.slotsAfter.location ?? ""),
        String(row.slotsAfter.serviceRegion ?? ""),
        row.toolCalls.join(", "),
        row.responseKey ?? "",
        row.nextStep ?? "",
        row.mode,
        row.handoffReason ?? "",
        row.attachments.map((attachment) => attachment.purpose ?? attachment.type).join(", "),
        row.passed ? "PASS" : `FAIL: ${row.failures.join("; ").replace(/\|/g, "\\|")}`,
      ].join(" | "),
    ),
    "",
    "## Transcripts",
    "",
    ...rows.flatMap((row) => [
      `### ${row.scenario} / Turn ${row.turn}`,
      "",
      `User: ${row.user}`,
      "",
      "```text",
      row.outboundText,
      "```",
      "",
      "```json",
      JSON.stringify({
        extractedSlots: row.extractedSlots,
        slotsAfter: row.slotsAfter,
        toolCalls: row.toolCalls,
        responseKey: row.responseKey,
        nextStep: row.nextStep,
        mode: row.mode,
        handoffReason: row.handoffReason,
        escalated: row.escalated,
        humanReviewRequired: row.humanReviewRequired,
        attachments: row.attachments.map((attachment) => attachment.purpose ?? attachment.type),
        result: row.passed ? "PASS" : row.failures,
      }, null, 2),
      "```",
      "",
    ]),
  ].join("\n");
  writeFileSync(path.join(reportDir, "report.md"), markdown);

  const htmlRows = rows.map((row) => `
    <tr class="${row.passed ? "pass" : "fail"}">
      <td>${escapeHtml(row.scenario)}</td>
      <td>${row.turn}</td>
      <td>${escapeHtml(row.user)}</td>
      <td><pre>${escapeHtml(JSON.stringify(row.slotsBefore, null, 2))}</pre></td>
      <td><pre>${escapeHtml(JSON.stringify(row.slotsAfter, null, 2))}</pre></td>
      <td>${escapeHtml(row.toolCalls.join(", "))}</td>
      <td>${escapeHtml(row.responseKey ?? "")}</td>
      <td>${escapeHtml(row.nextStep ?? "")}</td>
      <td>${escapeHtml(row.mode)}</td>
      <td>${escapeHtml(row.handoffReason ?? "")}</td>
      <td>${row.escalated ? "yes" : "no"}</td>
      <td>${row.humanReviewRequired ? "yes" : "no"}</td>
      <td><pre>${escapeHtml(row.outboundText)}</pre></td>
      <td>${escapeHtml(row.attachments.map((attachment) => `${attachment.type}:${attachment.purpose ?? ""}`).join(", "))}</td>
      <td>${row.passed ? "PASS" : escapeHtml(row.failures.join("; "))}</td>
    </tr>
  `.trimEnd()).join("\n");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Wedding Full-Journey Matrix</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #171717; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
    th { background: #f4f4f4; position: sticky; top: 0; }
    tr.pass { background: #f6fff6; }
    tr.fail { background: #fff6f6; }
    pre { white-space: pre-wrap; margin: 0; max-width: 420px; }
  </style>
</head>
<body>
  <h1>Wedding Full-Journey Matrix</h1>
  <p>Passed turns: ${rows.filter((row) => row.passed).length}/${rows.length}</p>
  <p>Total scenarios: ${scenarioIds.length}; booked: ${finalStates.booked}; human review: ${finalStates.humanReview}; unavailable: ${finalStates.unavailable}; waiting clarification: ${finalStates.waitingClarification}; abandoned: ${finalStates.abandoned}</p>
  <table>
    <thead>
      <tr>
        <th>Scenario</th>
        <th>Turn</th>
        <th>User</th>
        <th>Slots before</th>
        <th>Slots after</th>
        <th>Tool calls</th>
        <th>Response key</th>
        <th>Next step</th>
        <th>Mode</th>
        <th>Handoff</th>
        <th>Escalated</th>
        <th>Human review</th>
        <th>Outbound</th>
        <th>Attachments</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>${htmlRows}</tbody>
  </table>
</body>
</html>
`;
  writeFileSync(path.join(reportDir, "index.html"), html);
}

function main() {
  const rows = parseCases().cases.flatMap((scenario) => {
    try {
      return runScenario(scenario);
    } catch (error) {
      return [{
        scenario: scenario.id,
        title: scenario.title,
        turn: 0,
        user: "",
        slotsBefore: {},
        slotsAfter: {},
        extractedSlots: {},
        toolCalls: [],
        cumulativeToolCalls: [],
        toolResults: [],
        mode: "bot_active",
        escalated: false,
        humanReviewRequired: false,
        outboundText: "",
        attachments: [],
        passed: false,
        failures: [error instanceof Error ? error.stack ?? error.message : String(error)],
      } satisfies JourneyReportRow];
    }
  });
  writeReports(rows);
  const failed = rows.filter((row) => !row.passed);

  if (failed.length > 0) {
    for (const row of failed) {
      console.error(`${row.scenario} turn ${row.turn}: ${row.failures.join("; ")}`);
    }

    console.error(`Wedding journey matrix failed: ${failed.length}/${rows.length}. See ${reportDir}`);
    process.exitCode = 1;
    return;
  }

  console.log(`${rows.length} wedding journey turns passed across ${new Set(rows.map((row) => row.scenario)).size} scenarios. Report: ${reportDir}`);
}

main();
