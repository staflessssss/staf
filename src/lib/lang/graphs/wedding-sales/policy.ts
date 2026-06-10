import { selectWeddingSalesPricing, type WeddingSalesConfig } from "./config";
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
  "ask_email",
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

function hasCoupleNames(names?: string) {
  return Boolean(names && /\s+(?:and|&)\s+/i.test(names));
}

function buildMustInclude(args: BuildWeddingSalesDialogPolicyArgs) {
  const { intent, config, state, summary } = args;

  switch (intent) {
    case "ask_missing_info":
      return [
        state.channel === "instagram"
          ? hasCoupleNames(state.names)
            ? ""
            : state.names
              ? "ask for the fiance name"
              : "ask for both names"
          : state.names ? "" : "ask for both names",
        state.weddingDate ? "" : "ask for exact wedding date",
      ].filter(Boolean);
    case "ask_location_or_venue":
      return [
        state.location ? "ask for the exact venue" : "ask for wedding city, venue, or location",
        "do not ask again for names or date",
      ];
    case "ask_wedding_year":
      return ["ask for the wedding year only", state.weddingDate ? `reference ${state.weddingDate}` : ""].filter(Boolean);
    case "availability_available":
      return [
        state.weddingDate ? `confirm ${state.weddingDate} is available` : "confirm the date is available",
        `starting price ${selectWeddingSalesPricing(config, state).startPrice}`,
        state.guideSent || state.guideOffered ? "" : "mention the collections guide",
        state.channel === "instagram" && !state.venue ? "ask for the exact venue before proposing a call" : "",
        state.channel === "instagram" && !state.venue ? "" : state.callProposed ? "" : "propose a consultation call",
      ].filter(Boolean);
    case "availability_unavailable":
      return [
        "say the requested wedding date looks already booked or unavailable",
        summary?.match(/\b\d{4}-\d{2}-\d{2}\b/) ? "offer the nearby replacement dates from the tool result" : "ask for another date if they have flexibility",
        "be warm and gentle, not final or bureaucratic",
      ];
    case "answer_question":
      return [
        "answer only the customer's current question",
        "if availability or their date is asked and availability is already known, answer from the current state without repeating the full availability intro",
        "if pricing is asked, say collections start at the configured starting price",
        "if travel is asked, say roundtrip travel coverage is included by collection and exact travel details can be covered on the call",
        "end with one natural next step toward consultation",
      ];
    case "ask_call_time":
      return ["acknowledge the venue if known", "ask for a quick consultation time", "mention Monday through Friday, 9 AM to 2 PM Eastern"];
    case "ask_email":
      return ["confirm the consultation time works", "ask for the best email for the calendar invite"];
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
    state.askedForVenue ? "asking for the venue or location" : "",
    state.askedForCallTime ? "generic request for any call time" : "",
    state.askedForEmail ? "asking for email" : "",
    state.responseDraft ? `previous assistant wording: ${state.responseDraft.slice(0, 320)}` : "",
  ].filter(Boolean);
}

export function buildWeddingSalesDialogPolicy(args: BuildWeddingSalesDialogPolicyArgs): WeddingSalesDialogPolicy {
  const { intent, config, state } = args;
  const scheduling = isSchedulingIntent(intent);
  const firstReply = isFirstAssistantReply(state);
  const fullEmail = firstReply || ["availability_available", "availability_unavailable"].includes(intent);
  const includeSignature = state.channel === "gmail" && fullEmail && !state.signatureSent && !scheduling;
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
      "still some time away",
      "aren't able to confirm availability just yet",
      "are not able to confirm availability just yet",
      "when the time is closer",
      "we'll be able to provide a clear update",
      "we will be able to provide a clear update",
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
    askedForVenue: Boolean(state.askedForVenue || intent === "ask_location_or_venue" || (intent === "availability_available" && state.channel === "instagram" && !state.venue)),
    askedForCallTime: Boolean(
      state.askedForCallTime ||
        (intent === "availability_available" && (state.channel !== "instagram" || Boolean(state.venue))) ||
        intent === "ask_call_time" ||
        intent === "calendar_time_missing",
    ),
    askedForEmail: Boolean(state.askedForEmail || intent === "ask_email"),
    lastAssistantIntent: intent,
  };
}
