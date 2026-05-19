import type { WeddingSalesConfig } from "./config";
import type { WeddingSalesResponseIntent } from "./response-composer";
import type { WeddingSalesState } from "./state";

export type WeddingSalesReplyMode = "full_email" | "thread_reply" | "scheduling_reply";

export type WeddingSalesDialogPolicy = {
  replyMode: WeddingSalesReplyMode;
  allowGreeting: boolean;
  includeSignature: boolean;
  maxParagraphs: number;
  linkStyle: "html" | "plain";
  mustInclude: string[];
  mustNotRepeat: string[];
  forbiddenPhrases: string[];
};

type BuildWeddingSalesDialogPolicyArgs = {
  intent: WeddingSalesResponseIntent;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
  summary?: string;
};

const schedulingIntents = new Set<WeddingSalesResponseIntent>([
  "calendar_available",
  "calendar_busy",
  "calendar_outside_window",
  "calendar_time_missing",
  "booking_confirmed",
  "booking_failed",
]);

function isSchedulingIntent(intent: WeddingSalesResponseIntent) {
  return schedulingIntents.has(intent);
}

function isFirstAssistantReply(state: WeddingSalesState) {
  return (state.assistantReplyCount ?? 0) === 0 && !state.responseDraft;
}

function buildMustInclude(args: BuildWeddingSalesDialogPolicyArgs) {
  const { intent, config, state, summary } = args;

  switch (intent) {
    case "ask_missing_info":
      return [
        state.names ? "" : "ask for both names",
        state.weddingDate ? "" : "ask for exact wedding date",
        state.location ? "" : "ask for venue, city, or location if natural",
      ].filter(Boolean);
    case "ask_wedding_year":
      return ["ask for the wedding year only", state.weddingDate ? `reference ${state.weddingDate}` : ""].filter(Boolean);
    case "availability_available":
      return [
        state.weddingDate ? `confirm ${state.weddingDate} is available` : "confirm the date is available",
        `starting price ${config.pricing.startPrice}`,
        state.guideSent || state.guideOffered ? "" : "mention the collections guide",
        state.callProposed ? "" : "propose a consultation call",
      ].filter(Boolean);
    case "availability_unavailable":
      return [summary || "say the wedding date is unavailable", "offer alternative dates if they have flexibility"];
    case "calendar_available":
      return ["say the proposed consultation time is available", "ask for permission to book it"];
    case "calendar_busy":
      return [summary || "say the proposed consultation time is not available", "ask for another time or offer suggested alternatives if provided"];
    case "calendar_outside_window":
      return [summary || "say calls are only available Monday through Friday between 9 AM and 2 PM Eastern", "ask for another time in that window"];
    case "booking_confirmed":
      return ["confirm the consultation calendar invite was created", "sound warm and human"];
    case "booking_failed":
      return ["say the calendar invite could not be fully confirmed", "ask for one more time option"];
    case "availability_tool_missing":
      return ["explain that availability cannot be checked yet"];
    case "calendar_time_missing":
      return ["ask for a consultation time"];
    case "booking_tool_missing":
      return ["explain that booking cannot be completed yet"];
  }
}

function buildMustNotRepeat(state: WeddingSalesState) {
  return [
    state.portfolioSent ? "portfolio links" : "",
    state.reviewsSent ? "review link" : "",
    state.guideOffered ? "collections guide explanation" : "",
    state.callProposed ? "full wedding availability intro" : "",
    state.askedForNames ? "asking for names" : "",
    state.askedForWeddingYear ? "asking for wedding year" : "",
    state.askedForCallTime ? "generic request for any call time" : "",
    state.responseDraft ? `previous assistant wording: ${state.responseDraft.slice(0, 320)}` : "",
  ].filter(Boolean);
}

export function buildWeddingSalesDialogPolicy(args: BuildWeddingSalesDialogPolicyArgs): WeddingSalesDialogPolicy {
  const { intent, config, state } = args;
  const scheduling = isSchedulingIntent(intent);
  const firstReply = isFirstAssistantReply(state);
  const fullEmail = firstReply || ["availability_available", "availability_unavailable"].includes(intent);
  const includeSignature = fullEmail && !state.signatureSent && !scheduling;
  const allowGreeting = firstReply && !state.hasGreeted && !scheduling;

  return {
    replyMode: scheduling ? "scheduling_reply" : fullEmail ? "full_email" : "thread_reply",
    allowGreeting,
    includeSignature,
    maxParagraphs: scheduling ? 2 : fullEmail ? 4 : 2,
    linkStyle: config.channelFormatting[state.channel]?.richLinks ? "html" : "plain",
    mustInclude: buildMustInclude(args),
    mustNotRepeat: buildMustNotRepeat(state),
    forbiddenPhrases: [
      ...(allowGreeting ? [] : ["Hi", "Hello", "Hey", "Hi Anna and Mark", "Hi there"]),
      ...(includeSignature ? [] : ["Warmly,", "Best,", "Taras Mynd", "Founder & Creative Director"]),
      "As I mentioned",
      "As previously stated",
      "I already said",
      "wedding is booked",
      "date is reserved",
      "retainer is confirmed",
    ],
  };
}

export function getWeddingSalesBehavioralStateUpdate(args: {
  intent: WeddingSalesResponseIntent;
  policy: WeddingSalesDialogPolicy;
  state: WeddingSalesState;
}): Partial<WeddingSalesState> {
  const { intent, policy, state } = args;

  return {
    assistantReplyCount: (state.assistantReplyCount ?? 0) + 1,
    hasGreeted: Boolean(state.hasGreeted || policy.allowGreeting),
    signatureSent: Boolean(state.signatureSent || policy.includeSignature),
    portfolioSent: Boolean(state.portfolioSent || intent === "availability_available"),
    reviewsSent: Boolean(state.reviewsSent || intent === "availability_available"),
    guideOffered: Boolean(state.guideOffered || intent === "availability_available"),
    askedForNames: Boolean(state.askedForNames || intent === "ask_missing_info"),
    askedForWeddingYear: Boolean(state.askedForWeddingYear || intent === "ask_wedding_year"),
    askedForCallTime: Boolean(state.askedForCallTime || intent === "availability_available" || intent === "calendar_time_missing"),
    lastAssistantIntent: intent,
  };
}
