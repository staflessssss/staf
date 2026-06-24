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
  return /\b(?:what time|time works|good time|call time|within that window|9am|10am|11am|12pm|1pm|2pm)\b/i.test(
    text,
  );
}

function hasBookingConfirmation(text: string) {
  return /\b(?:you(?:'re| are) all set|booked|booking is confirmed|confirmed|i booked|invite is on the way|calendar invite (?:has been|is) sent)\b/i.test(
    text,
  );
}

function saysGuideUnavailable(text: string) {
  return /\b(?:do not|don't|don'?t|cannot|can't|cant|unable to|not able to|no)\b[^.\n]{0,80}\b(?:guide|image|price image|attachment)\b/i.test(
    text,
  );
}

function hasSignature(text: string) {
  return /\bTaras Mynd\b|\bFounder & Creative Director\b|\bMYNDFUL FILMS LLC\b/i.test(text);
}

function hasWeddingAvailabilityResult(text: string) {
  return /\b(?:date is available|date is not available|is not open for us|is open for us)\b/i.test(text);
}

function hasCalendarAvailabilityResult(text: string) {
  return /\b(?:works perfectly for a call|works for a call|time is already taken)\b/i.test(text);
}

function paragraphCount(text: string) {
  return text.split(/\n{2,}/).filter((part) => part.trim()).length;
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

  if (
    args.contract.mustGreet &&
    (!/thank you so much for reaching out/i.test(reply) ||
      !/\bTaras\b/.test(reply) ||
      !reply.includes("🤍") ||
      !reply.includes("✨"))
  ) {
    reasons.push("first-turn founder greeting is incomplete");
  }

  if (args.contract.mustMentionPricing && !reply.includes(args.knowledge.pricing.startPrice)) {
    reasons.push("pricing was required but start price is missing");
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

  if (
    (args.knowledge.guide.imageUrl || args.knowledge.guide.link) &&
    saysGuideUnavailable(reply)
  ) {
    reasons.push("reply says guide/image is unavailable even though it exists");
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
