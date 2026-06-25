import type { ReplyActionContract } from "@/lib/lang/graphs/wedding-sales-simple/reply-contract";

import type { NormalizedWeddingSalesOutboundMessage } from "./contracts";

export type NormalizedWeddingSalesAttachment = NonNullable<
  NormalizedWeddingSalesOutboundMessage["attachments"]
>[number];

export type InstagramDeliveryPart =
  | {
      kind: "sender_action";
      action: "mark_seen" | "typing_on" | "typing_off";
      delayMsBefore: number;
      reason: "read_receipt" | "typing";
    }
  | {
      kind: "text";
      text: string;
      delayMsBefore: number;
      typingMsBefore: number;
      reason:
        | "availability"
        | "pricing"
        | "guide"
        | "team"
        | "identity"
        | "portfolio"
        | "qualification_question"
        | "consultation"
        | "booking"
        | "handoff"
        | "single_reply";
    }
  | {
      kind: "attachment";
      attachment: NormalizedWeddingSalesAttachment;
      delayMsBefore: number;
      reason: "pricing_guide" | "portfolio" | "reviews";
    };

export type InstagramDeliveryPlan = {
  channel: "instagram";
  enabled: boolean;
  mode: "single_message" | "semantic_split";
  fallbackFrom?: "semantic_split";
  parts: InstagramDeliveryPart[];
  textPartCount: number;
  totalDelayMs: number;
  guardResult: DeliveryPlanGuardResult;
};

export type GmailDeliveryPlan = {
  channel: "gmail";
  enabled: false;
  mode: "email";
  subject?: string;
  body: string;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
};

export type SingleMessageDeliveryPlan = {
  channel: "instagram" | "gmail";
  enabled: boolean;
  mode: "single_message";
  fallbackFrom?: "semantic_split";
  parts: InstagramDeliveryPart[];
  textPartCount: 1;
  totalDelayMs: 0;
  guardResult: DeliveryPlanGuardResult;
};

export type ChannelDeliveryPlan =
  | InstagramDeliveryPlan
  | GmailDeliveryPlan
  | SingleMessageDeliveryPlan;

export type DeliveryPlanGuardResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing_required_question_in_delivery_plan"
        | "too_many_text_parts"
        | "too_many_total_parts"
        | "handoff_or_tool_error_must_be_single_message"
        | "booking_must_be_single_message"
        | "total_delay_exceeded";
    };

const MAX_TEXT_PARTS = 3;
const MAX_TOTAL_PARTS = 4;
const MAX_TOTAL_DELAY_MS = 12_000;

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function deterministicDelayMs(seed: string, min: number, max: number) {
  return min + (hashString(seed) % (max - min + 1));
}

function splitParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function typingDelayForText(seed: string, text: string) {
  if (text.length > 220) {
    return deterministicDelayMs(seed, 1800, 3200);
  }

  if (text.length > 120) {
    return deterministicDelayMs(seed, 1200, 2200);
  }

  return deterministicDelayMs(seed, 700, 1400);
}

function reasonForText(part: string, contract: ReplyActionContract): Extract<InstagramDeliveryPart, { kind: "text" }>["reason"] {
  const normalized = part.toLowerCase();

  if (contract.replyType === "handoff") {
    return "handoff";
  }

  if (contract.bookingConfirmed || contract.replyType === "booking_confirmed") {
    return "booking";
  }

  if (/price|pricing|wedding films start|\$\d|collection/.test(normalized)) {
    return "pricing";
  }

  if (/available|open|not open/.test(normalized)) {
    return "availability";
  }

  if (/calendar|consult|call|lock in|all set/.test(normalized)) {
    return "consultation";
  }

  if (/guide|image/.test(normalized)) {
    return "guide";
  }

  if (/filmmaker|shooter|team|jay/.test(normalized)) {
    return "team";
  }

  if (/speaking with me|i'm|i am/.test(normalized)) {
    return "identity";
  }

  if (/recent films|portfolio|galleries/.test(normalized)) {
    return "portfolio";
  }

  if (/[?]/.test(part) || contract.requiredQuestion) {
    return "qualification_question";
  }

  return "single_reply";
}

function replyAsksRequiredQuestion(text: string, requiredQuestion: ReplyActionContract["requiredQuestion"]) {
  if (!requiredQuestion) {
    return true;
  }

  switch (requiredQuestion) {
    case "names":
    case "coupleNames":
      return /\b(names?|couple'?s names?)\b/i.test(text);
    case "weddingDate":
      return /\b(date|when)\b/i.test(text);
    case "location":
      return /\b(city|area|where|location)\b/i.test(text);
    case "venue":
      return /\bvenue\b/i.test(text);
    case "callTime":
      return /\b(what time|time works|lock in|9am|10am|11am|12pm|1pm|2pm)\b/i.test(text);
    case "email":
      return /\be-?mail\b/i.test(text);
    default:
      return true;
  }
}

function splitSemanticTextParts(text: string, contract: ReplyActionContract) {
  const expandedParts = splitParagraphs(text).flatMap((paragraph) =>
    splitParagraphs(
      paragraph
        .replace(/\s+(Our\s+(?:\d+-hour\s+)?wedding films start)/i, "\n\n$1")
        .replace(/\s+(For\s+Florida\s+weddings,)/i, "\n\n$1")
        .replace(/\s+(And\s+what\s+are\s+both\s+of\s+your\s+names\?)/i, "\n\n$1"),
    ),
  );
  const parts = [...expandedParts];

  while (parts.length > MAX_TEXT_PARTS) {
    const firstReason = reasonForText(parts[0] ?? "", contract);
    const secondReason = reasonForText(parts[1] ?? "", contract);

    if (
      parts.length > 1 &&
      (firstReason === "single_reply" || firstReason === "identity") &&
      secondReason === "availability"
    ) {
      parts.splice(0, 2, `${parts[0]}\n\n${parts[1]}`);
      continue;
    }

    const questionIndex = parts.findIndex((part) => replyAsksRequiredQuestion(part, contract.requiredQuestion));

    if (questionIndex > 0) {
      parts.splice(questionIndex - 1, 2, `${parts[questionIndex - 1]}\n\n${parts[questionIndex]}`);
      continue;
    }

    const mergeIndex = parts.length - 2;
    parts.splice(mergeIndex, 2, `${parts[mergeIndex]}\n\n${parts[mergeIndex + 1]}`);
  }

  return parts;
}

function singleInstagramPlan(args: {
  channel: "instagram";
  enabled: boolean;
  outboundText: string;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
  contract: ReplyActionContract;
  guardResult?: DeliveryPlanGuardResult;
  fallbackFrom?: "semantic_split";
}): InstagramDeliveryPlan | SingleMessageDeliveryPlan {
  const textPart: InstagramDeliveryPart = {
    kind: "text",
    text: args.outboundText,
    delayMsBefore: 0,
    typingMsBefore: 0,
    reason: reasonForText(args.outboundText, args.contract),
  };

  return {
    channel: args.channel,
    enabled: args.enabled,
    mode: "single_message",
    fallbackFrom: args.fallbackFrom,
    parts: [
      textPart,
      ...(args.attachments ?? []).map<InstagramDeliveryPart>((attachment) => ({
        kind: "attachment",
        attachment,
        delayMsBefore: 0,
        reason: attachment.purpose,
      })),
    ],
    textPartCount: 1,
    totalDelayMs: 0,
    guardResult: args.guardResult ?? { ok: true },
  };
}

function validateInstagramPlan(args: {
  plan: InstagramDeliveryPlan;
  contract: ReplyActionContract;
}) : DeliveryPlanGuardResult {
  const textParts = args.plan.parts.filter(
    (part): part is Extract<InstagramDeliveryPart, { kind: "text" }> => part.kind === "text",
  );
  const allText = textParts.map((part) => part.text).join("\n");

  if (
    args.contract.replyType === "handoff" &&
    (args.plan.mode !== "single_message" || args.plan.textPartCount > 1)
  ) {
    return { ok: false, reason: "handoff_or_tool_error_must_be_single_message" };
  }

  if (
    args.contract.bookingConfirmed &&
    (args.plan.mode !== "single_message" || args.plan.textPartCount > 1)
  ) {
    return { ok: false, reason: "booking_must_be_single_message" };
  }

  if (args.contract.requiredQuestion && !replyAsksRequiredQuestion(allText, args.contract.requiredQuestion)) {
    return { ok: false, reason: "missing_required_question_in_delivery_plan" };
  }

  if (args.plan.textPartCount > MAX_TEXT_PARTS) {
    return { ok: false, reason: "too_many_text_parts" };
  }

  if (args.plan.parts.filter((part) => part.kind !== "sender_action").length > MAX_TOTAL_PARTS) {
    return { ok: false, reason: "too_many_total_parts" };
  }

  if (args.plan.totalDelayMs > MAX_TOTAL_DELAY_MS) {
    return { ok: false, reason: "total_delay_exceeded" };
  }

  return { ok: true };
}

function shouldSemanticSplit(args: {
  enabled: boolean;
  outboundText: string;
  contract: ReplyActionContract;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
}) {
  if (!args.enabled || args.contract.replyType === "handoff" || args.contract.bookingConfirmed) {
    return false;
  }

  if (args.contract.requiredToolResult === "failed") {
    return false;
  }

  const paragraphs = splitParagraphs(args.outboundText);
  const hasMixedObligations =
    args.contract.mustMentionWeddingAvailability ||
    args.contract.mustMentionPricing ||
    args.contract.mustMentionGuide ||
    args.contract.mustAnswerTeam ||
    args.contract.mustAnswerIdentity ||
    Boolean(args.contract.requiredQuestion) ||
    Boolean(args.attachments?.length);

  return paragraphs.length > 1 && hasMixedObligations && args.outboundText.length > 180;
}

function buildInstagramSemanticPlan(args: {
  outboundText: string;
  contract: ReplyActionContract;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
  seed: string;
}): InstagramDeliveryPlan {
  const candidateTextParts = splitSemanticTextParts(args.outboundText, args.contract);
  const parts: InstagramDeliveryPart[] = [
    {
      kind: "sender_action",
      action: "mark_seen",
      delayMsBefore: deterministicDelayMs(`${args.seed}:seen`, 300, 900),
      reason: "read_receipt",
    },
  ];

  candidateTextParts.forEach((text, index) => {
    parts.push({
      kind: "text",
      text,
      delayMsBefore: index === 0 ? 0 : deterministicDelayMs(`${args.seed}:between:${index}`, 900, 2200),
      typingMsBefore: typingDelayForText(`${args.seed}:typing:${index}`, text),
      reason: reasonForText(text, args.contract),
    });
  });

  for (const attachment of args.attachments ?? []) {
    parts.push({
      kind: "attachment",
      attachment,
      delayMsBefore: deterministicDelayMs(`${args.seed}:attachment:${attachment.url}`, 700, 1400),
      reason: attachment.purpose,
    });
  }

  const totalDelayMs = parts.reduce((total, part) => {
    if (part.kind === "text") {
      return total + part.delayMsBefore + part.typingMsBefore;
    }

    return total + part.delayMsBefore;
  }, 0);

  const plan: InstagramDeliveryPlan = {
    channel: "instagram",
    enabled: true,
    mode: "semantic_split",
    parts,
    textPartCount: candidateTextParts.length,
    totalDelayMs,
    guardResult: { ok: true },
  };
  const guardResult = validateInstagramPlan({
    plan,
    contract: args.contract,
  });

  return {
    ...plan,
    guardResult,
  };
}

function readInstagramSemanticDeliveryEnabled(channelConfig: unknown) {
  if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
    return false;
  }

  return (channelConfig as { enableInstagramSemanticDeliveryPlan?: unknown })
    .enableInstagramSemanticDeliveryPlan === true &&
    process.env.DISABLE_INSTAGRAM_SEMANTIC_DELIVERY_PLAN !== "true";
}

export function buildChannelDeliveryPlan(params: {
  channel: "instagram" | "gmail";
  outboundText: string;
  replyContract: ReplyActionContract;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
  conversationId: string;
  turnId: string;
  channelConfig?: unknown;
}): ChannelDeliveryPlan {
  if (params.channel === "gmail") {
    return {
      channel: "gmail",
      enabled: false,
      mode: "email",
      body: params.outboundText,
      attachments: params.attachments,
    };
  }

  const enabled = readInstagramSemanticDeliveryEnabled(params.channelConfig);

  if (
    !shouldSemanticSplit({
      enabled,
      outboundText: params.outboundText,
      contract: params.replyContract,
      attachments: params.attachments,
    })
  ) {
    return singleInstagramPlan({
      channel: "instagram",
      enabled,
      outboundText: params.outboundText,
      attachments: params.attachments,
      contract: params.replyContract,
    });
  }

  const semanticPlan = buildInstagramSemanticPlan({
    outboundText: params.outboundText,
    contract: params.replyContract,
    attachments: params.attachments,
    seed: `${params.conversationId}:${params.turnId}`,
  });

  if (!semanticPlan.guardResult.ok) {
    return singleInstagramPlan({
      channel: "instagram",
      enabled,
      outboundText: params.outboundText,
      attachments: params.attachments,
      contract: params.replyContract,
      guardResult: semanticPlan.guardResult,
      fallbackFrom: "semantic_split",
    });
  }

  return semanticPlan;
}
