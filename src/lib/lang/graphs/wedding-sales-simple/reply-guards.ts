import type { SimpleWeddingKnowledgeContext } from "./knowledge";
import type { ReplyActionContract } from "./reply-contract";
import type { SimpleWeddingSalesState } from "./state";

export type ReplyGuardResult =
  | { ok: true }
  | {
      ok: false;
      reasons: string[];
    };

function mentionsNames(text: string) {
  return /\b(names?|couple'?s names?|bride'?s name|groom'?s name)\b/i.test(text);
}

function mentionsEmail(text: string) {
  return /\be-?mail\b/i.test(text);
}

function mentionsVenue(text: string) {
  return /\bvenue\b/i.test(text);
}

function mentionsCallTime(text: string) {
  return /\b(?:what time|time works|good time|call time|within that window|lock that in|lock in|9am|10am|11am|12pm|1pm|2pm)\b/i.test(
    text,
  );
}

function hasBookingConfirmation(text: string) {
  return /\b(?:you(?:'re| are) all set|booked|booking is confirmed|confirmed|i booked|invite is on the way|calendar invite (?:has been|is) sent)\b/i.test(
    text,
  );
}

function repeatsBookingLogistics(text: string) {
  return /\b(?:all set for|locked in|locked us in|booked|calendar invite|you(?:'ll| will) (?:get|see) the calendar invite|i locked us in)\b/i.test(
    text,
  );
}

function mentionsSpecificCallTime(text: string) {
  return /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(text);
}

function hasCrmStyleBookingConfirmation(text: string) {
  return /\b(?:i booked|booked) the call for\b/i.test(text);
}

function saysGuideUnavailable(text: string) {
  return /\b(?:do not|don't|don'?t|cannot|can't|cant|unable to|not able to|no)\b[^.\n]{0,80}\b(?:guide|image|price image|attachment)\b/i.test(
    text,
  );
}

function mentionsGuideAsset(text: string) {
  return /\b(?:collections? guide|guide image|price image)\b/i.test(text);
}

function hasMechanicalGuideCopy(text: string) {
  return /\b(?:image here too|here too\s*🎥|i(?:'|’)?m sending the collections guide image|i am sending the collections guide image)\b/i.test(
    text,
  );
}

function hasSignature(text: string) {
  return /\bTaras Mynd\b|\bFounder & Creative Director\b|\bMYNDFUL FILMS LLC\b/i.test(text);
}

function hasFounderGreetingOrCongratulation(text: string) {
  return /\b(?:hey there|thank you so much for reaching out|i(?:'|вЂ™)?m Taras|founder of Myndful Films|huge congratulations|such an exciting season of life)\b/i.test(
    text,
  );
}

function hasWeddingAvailabilityResult(text: string) {
  return /\b(?:date is available|is available in|date is not available|is not open for us|is open for us)\b/i.test(text);
}

function hasCalendarAvailabilityResult(text: string) {
  return /\b(?:works perfectly for a call|works for a call|works on my calendar|time is already taken)\b/i.test(text);
}

function paragraphCount(text: string) {
  return text.split(/\n{2,}/).filter((part) => part.trim()).length;
}

function containsForbiddenPhrase(text: string, phrases: string[]) {
  const normalized = text.toLowerCase();

  return phrases.find((phrase) => normalized.includes(phrase.toLowerCase()));
}

export function validateGeneratedReply(args: {
  reply: string;
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
  state: SimpleWeddingSalesState;
}): ReplyGuardResult {
  const reasons: string[] = [];
  const reply = args.reply.trim();

  if (!reply) {
    reasons.push("reply is empty");
  }

  const forbiddenPhrase = containsForbiddenPhrase(reply, args.contract.forbiddenPhrases ?? []);

  if (forbiddenPhrase) {
    reasons.push(`reply contains forbidden phrase: ${forbiddenPhrase}`);
  }

  if (
    args.contract.mustGreet &&
    args.contract.responseKey !== "utter_ask_wedding_details" &&
    args.contract.responseKey !== "utter_availability_available_ask_names" &&
    (!reply.includes(args.knowledge.persona.replyStyle.greetingOpening) ||
      !reply.includes(args.knowledge.persona.name) ||
      !reply.includes(args.knowledge.persona.company))
  ) {
    reasons.push("first-turn founder greeting is incomplete");
  }

  if (
    (args.state.replyMemory?.greeted || !args.contract.mustGreet) &&
    hasFounderGreetingOrCongratulation(reply)
  ) {
    reasons.push("reply repeated founder greeting/persona after greeting was not allowed");
  }

  if (args.contract.mustMentionPricing && !reply.includes(args.knowledge.pricing.startPrice)) {
    reasons.push("pricing was required but start price is missing");
  }

  if (hasMechanicalGuideCopy(reply)) {
    reasons.push("reply uses mechanical guide attachment wording");
  }

  if (
    args.contract.mustAnswerQuestions?.includes("raw_footage") &&
    !/\braw footage\b/i.test(reply)
  ) {
    reasons.push("raw footage question was required but missing");
  }

  if (
    (args.contract.requiredQuestion === "names" ||
      args.contract.requiredQuestion === "coupleNames") &&
    !mentionsNames(reply)
  ) {
    reasons.push("names question was required but missing");
  }

  if (args.contract.requiredQuestion === "email" && !mentionsEmail(reply)) {
    reasons.push("email question was required but missing");
  }

  if (args.contract.requiredQuestion === "venue" && !mentionsVenue(reply)) {
    reasons.push("venue question was required but missing");
  }

  if (args.contract.requiredQuestion === "callTime" && !mentionsCallTime(reply)) {
    reasons.push("call time question was required but missing");
  }

  if (!args.contract.bookingConfirmed && hasBookingConfirmation(reply)) {
    reasons.push("booking confirmation appeared before bookingConfirmed");
  }

  if (args.contract.bookingConfirmed && hasCrmStyleBookingConfirmation(reply)) {
    reasons.push("booking confirmation is CRM-style instead of persona-based");
  }

  if (args.contract.mustMentionCalendarAvailability && !hasCalendarAvailabilityResult(reply)) {
    reasons.push("calendar availability was required but missing");
  }

  if (!args.contract.mustMentionWeddingAvailability && hasWeddingAvailabilityResult(reply)) {
    reasons.push("stale wedding availability was repeated");
  }

  if (!args.contract.mustMentionCalendarAvailability && hasCalendarAvailabilityResult(reply)) {
    reasons.push("stale calendar availability was repeated");
  }

  if (
    args.contract.bookingConfirmed &&
    !args.contract.mustMentionBookingConfirmation &&
    hasBookingConfirmation(reply)
  ) {
    reasons.push("stale booking confirmation was repeated");
  }

  if (args.contract.responseKey === "utter_acknowledgement") {
    if (hasBookingConfirmation(reply) || repeatsBookingLogistics(reply)) {
      reasons.push("acknowledgement repeated booking confirmation");
    }

    if (args.state.customerEmail && reply.includes(args.state.customerEmail)) {
      reasons.push("acknowledgement repeated customer email");
    }

    if (mentionsSpecificCallTime(reply)) {
      reasons.push("acknowledgement repeated call time");
    }
  }

  if (
    (args.knowledge.guide.imageUrl || args.knowledge.guide.link) &&
    saysGuideUnavailable(reply)
  ) {
    reasons.push("reply says guide/image is unavailable even though it exists");
  }

  if (args.contract.mentionPolicy.guide.mode === "skip" && mentionsGuideAsset(reply)) {
    reasons.push("guide asset was mentioned without a guide obligation");
  }

  if (args.knowledge.channel === "instagram") {
    if (hasSignature(reply)) {
      reasons.push("instagram reply contains email signature");
    }

    if (reply.length > 900) {
      reasons.push("instagram reply is too long");
    }

    if (paragraphCount(reply) > 5) {
      reasons.push("instagram reply has too many paragraphs");
    }
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true };
}
