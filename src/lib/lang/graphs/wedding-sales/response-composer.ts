import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import type { WeddingSalesConfig } from "./config";
import { buildWeddingSalesDialogPolicy, type WeddingSalesDialogPolicy } from "./policy";
import type { WeddingSalesState } from "./state";

export type WeddingSalesResponseIntent =
  | "ask_missing_info"
  | "ask_wedding_year"
  | "availability_tool_missing"
  | "availability_available"
  | "availability_unavailable"
  | "answer_question"
  | "calendar_time_missing"
  | "calendar_available"
  | "calendar_busy"
  | "calendar_outside_window"
  | "booking_tool_missing"
  | "booking_confirmed"
  | "booking_failed";

type ComposeWeddingSalesResponseArgs = {
  intent: WeddingSalesResponseIntent;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
  summary?: string;
  policy?: WeddingSalesDialogPolicy;
};

const DEFAULT_RESPONSE_MODEL = "gpt-4.1-mini";
const DEFAULT_REFLECTION_MODEL = "gpt-4.1-mini";

function appendSignatureOnce(text: string, signature: string) {
  const body = text.trim();
  const trimmedSignature = signature.trim();

  if (!trimmedSignature || body.endsWith(trimmedSignature)) {
    return body;
  }

  return `${body}\n\n${trimmedSignature}`;
}

function getChannelFormatting(config: WeddingSalesConfig, state: WeddingSalesState) {
  return config.channelFormatting[state.channel] ?? config.channelFormatting.gmail;
}

function formatLink(args: {
  label: string;
  url?: string;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
}) {
  if (!args.url) {
    return args.label;
  }

  return getChannelFormatting(args.config, args.state).richLinks
    ? `<a href="${args.url}">${args.label}</a>`
    : `${args.label}: ${args.url}`;
}

function formatPortfolioLinks(config: WeddingSalesConfig, state: WeddingSalesState) {
  return config.portfolio
    .map((item) => formatLink({ label: item.label, url: item.url, config, state }))
    .filter(Boolean)
    .join("\n");
}

function formatGuideText(config: WeddingSalesConfig, state: WeddingSalesState) {
  if (config.guide.link) {
    return `You can review the collections guide here: ${formatLink({
      label: config.guide.fileName || "Collections Guide",
      url: config.guide.link,
      config,
      state,
    })}`;
  }

  if (getChannelFormatting(config, state).allowAttachments) {
    return "I am attaching the collections guide so you can review the full details.";
  }

  return "I can send over the collections guide with the full details.";
}

function formatWeddingDateForReply(value?: string) {
  if (!value) {
    return "your date";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatLocationSuffix(location?: string) {
  return location ? ` in ${location}` : "";
}

export function composeWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs) {
  const { intent, config, state, summary } = args;
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const weddingDate = formatWeddingDateForReply(state.weddingDate);
  const location = formatLocationSuffix(state.location);

  const response = (() => {
    switch (intent) {
      case "ask_missing_info":
        return [
          "Thank you so much for reaching out. I would love to hear more.",
          "Could you share both of your names and the date you are planning to get married? Once I have that, I can check availability and send the most helpful details.",
        ].join("\n\n");
      case "ask_wedding_year":
        return "Thank you so much. Just so I check the right date, could you share the wedding year?";
      case "availability_tool_missing":
        return "I have enough details to check the wedding date, but the availability tool is not configured yet.";
      case "availability_unavailable":
        return [
          `Thank you for sharing those details. I checked ${weddingDate}${location}, and it looks unavailable on my end.`,
          summary || "If you have flexibility, I can help look at alternative dates.",
        ].join("\n\n");
      case "availability_available": {
        const intro = `Amazing, thank you so much${state.names ? `, ${state.names}` : ""}. ${weddingDate}${location} is available for Myndful, so you reached out at a great time 🤍`;

        if (state.guideSent) {
          return [
            intro,
            "The next step is a quick consultation where I can hear more about your story and answer any questions.",
            "Would you be open to a 30-minute call Monday through Friday between 9 AM and 2 PM Eastern?",
          ].join("\n\n");
        }

        const links = formatPortfolioLinks(config, state);
        const reviews = config.reviews.url
          ? formatLink({
              label: config.reviews.label || "Google Reviews",
              url: config.reviews.url,
              config,
              state,
            })
          : config.reviews.label;

        return [
          intro,
          `Our collections start at ${config.pricing.startPrice}. ${formatGuideText(config, state)}`,
          links ? `Here are a few recent wedding films:\n${links}` : "",
          reviews ? `And here are reviews from couples: ${reviews}` : "",
          "Would you be open to a 30-minute consultation Monday through Friday between 9 AM and 2 PM Eastern?",
        ]
          .filter(Boolean)
          .join("\n\n");
      }
      case "answer_question":
        return [
          `Our collections start at ${config.pricing.startPrice}. Yes, we do travel for weddings.`,
          "Each collection includes travel miles, and if the venue is beyond the included mileage, I can check the exact travel details for your location before the call.",
        ].join("\n\n");
      case "calendar_time_missing":
        return state.calendarStatus === "busy"
          ? "That time was not available, so I cannot book it yet. Could you send another time Monday through Friday between 9 AM and 2 PM Eastern?"
          : "I can check that consultation time once I have the requested time.";
      case "calendar_available":
        return "That time looks available on the calendar. Would you like me to go ahead and book it for you?";
      case "calendar_busy":
        return "That time is already taken on the calendar, so I do not want to book the wrong slot. Could you send another time Monday through Friday between 9 AM and 2 PM Eastern?";
      case "calendar_outside_window":
        return `${summary || "Consultation calls are only available Monday through Friday between 9 AM and 2 PM Eastern."} Could you send another time in that window?`;
      case "booking_tool_missing":
        return "I can book the consultation once I have the confirmed time and booking tool configured.";
      case "booking_confirmed":
        return [
          "Perfect, you are all set. I just created the calendar invite for our consultation.",
          "I am really looking forward to hearing more about your day and answering any questions you both have 🤍",
        ].join("\n\n");
      case "booking_failed":
        return "I am sorry, I could not get the calendar invite fully confirmed on my end. Could you send one more time option Monday through Friday between 9 AM and 2 PM Eastern?";
    }
  })();

  return policy.includeSignature
    ? appendSignatureOnce(response, config.signature)
    : response.trim();
}

function shouldUseLlmComposer() {
  const explicitlyEnabled = process.env.WEDDING_SALES_LLM_COMPOSER === "true";
  const productionRuntime = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  return Boolean(process.env.OPENAI_API_KEY) && process.env.WEDDING_SALES_LLM_COMPOSER !== "false" && (explicitlyEnabled || productionRuntime);
}

function shouldUseReflection() {
  return shouldUseLlmComposer() && process.env.WEDDING_SALES_REFLECTION !== "false";
}

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildComposerFacts(args: ComposeWeddingSalesResponseArgs) {
  const { config, state, intent, summary } = args;
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);

  return {
    intent,
    customerMessage: state.latestCustomerMessage,
    previousAssistantResponse: state.responseDraft,
    leadState: {
      leadStage: state.leadStage,
      names: state.names,
      weddingDate: state.weddingDate,
      weddingDateText: state.weddingDateText,
      weddingYear: state.weddingYear,
      weddingYearKnown: state.weddingYearKnown,
      location: state.location,
      availability: state.availability,
      guideSent: state.guideSent,
      callProposed: state.callProposed,
      proposedCallTime: state.proposedCallTime,
      calendarStatus: state.calendarStatus,
      bookingConfirmed: state.bookingConfirmed,
    },
    behavioralMemory: {
      assistantReplyCount: state.assistantReplyCount,
      hasGreeted: state.hasGreeted,
      signatureSent: state.signatureSent,
      portfolioSent: state.portfolioSent,
      reviewsSent: state.reviewsSent,
      guideOffered: state.guideOffered,
      askedForNames: state.askedForNames,
      askedForWeddingYear: state.askedForWeddingYear,
      askedForCallTime: state.askedForCallTime,
      lastAssistantIntent: state.lastAssistantIntent,
    },
    toolSummary: summary,
    toolObservations: state.toolObservations
      .slice(-3)
      .map((observation) => ({
        toolName: observation.toolName,
        result: observation.result.slice(0, 1200),
      })),
    businessConfig: {
      startPrice: config.pricing.startPrice,
      guideAvailable: Boolean(config.guide.fileName || config.guide.link),
      portfolio: config.portfolio,
      reviews: config.reviews,
      bookingWindow: config.callBookingWindow,
      channel: state.channel,
      richLinks: getChannelFormatting(config, state).richLinks,
      allowAttachments: getChannelFormatting(config, state).allowAttachments,
    },
    dialogPolicy: policy,
  };
}

function buildComposerSystemPrompt(args: ComposeWeddingSalesResponseArgs) {
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const signatureInstruction = policy.includeSignature
    ? `End with this exact signature once:\n${args.config.signature || "(no signature configured)"}`
    : "Do not include an email signature or sign-off.";
  const greetingInstruction = policy.allowGreeting
    ? "A short natural greeting is allowed."
    : "Do not start with a greeting like Hi, Hello, Hey, or Hi Anna and Mark. Continue the existing thread naturally.";
  const modeInstruction = policy.replyMode === "scheduling_reply"
    ? "For scheduling and booking replies, answer directly in 1-2 short paragraphs. No greeting, no sign-off, no signature."
    : "Do not over-email-format mid-thread replies.";

  return [
    "You write final customer-facing replies for Myndful Films wedding leads.",
    "Sound like Taras, the warm founder of a premium wedding videography company. Be human, specific, and natural.",
    "This is a real ongoing email thread. Write only the next reply, not a generic bot status update.",
    "Never repeat the previous assistant response. Never restate the same availability intro, same guide pitch, or same call proposal unless the current customer message asks for it.",
    "Move the conversation forward from the customer's latest message. Answer their current question before adding the next step.",
    greetingInstruction,
    `Reply mode: ${policy.replyMode}. Maximum paragraphs: ${policy.maxParagraphs}. Link style: ${policy.linkStyle}.`,
    modeInstruction,
    policy.mustInclude.length ? `Must include:\n- ${policy.mustInclude.join("\n- ")}` : "",
    policy.mustNotRepeat.length ? `Strictly must not repeat:\n- ${policy.mustNotRepeat.join("\n- ")}` : "",
    policy.forbiddenPhrases.length ? `Forbidden phrases or concepts. Do not use these even if they seem natural:\n- ${policy.forbiddenPhrases.join("\n- ")}` : "",
    "Use the provided facts only. Do not invent availability, calendar status, prices, links, event IDs, or bookings.",
    "Never confirm that the wedding itself is booked, reserved, contracted, or retained. Only confirm consultation calls.",
    "If information is missing, ask a focused question. If a tool failed, apologize simply and ask for the next actionable option.",
    "Gmail can use HTML links. Instagram and Telegram must use plain URLs.",
    "Allowed emojis only: 🤍 ✨ 🎥. Use at most one emoji unless the customer is very enthusiastic.",
    "Avoid filler openings like 'Thanks for sharing' on every turn. Vary phrasing naturally.",
    "Write concise email paragraphs, usually 2-4 short paragraphs. Scheduling replies should usually be 1 paragraph.",
    signatureInstruction,
  ].filter(Boolean).join("\n");
}

function buildReflectionSystemPrompt(args: ComposeWeddingSalesResponseArgs) {
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);

  return [
    "You are the final quality reviewer for a Myndful Films sales email.",
    "Your job is to enforce dialog policy, remove robotic repetition, and keep the response warm and human.",
    "Return only valid JSON with this shape:",
    '{"status":"pass"|"rewrite","issues":["short issue"],"revisedText":"final reply if rewrite, otherwise empty string"}',
    "Rewrite only when needed. If rewriting, preserve all required facts and do not invent any new facts.",
    "Fail and rewrite if the draft repeats the previous assistant response, greets mid-thread, includes a forbidden signature, sounds like a bot status message, ignores the customer's latest question, or exceeds the paragraph limit.",
    policy.mustInclude.length ? `The final reply must include:\n- ${policy.mustInclude.join("\n- ")}` : "",
    policy.mustNotRepeat.length ? `The final reply must not repeat:\n- ${policy.mustNotRepeat.join("\n- ")}` : "",
    policy.forbiddenPhrases.length ? `Forbidden phrases/concepts:\n- ${policy.forbiddenPhrases.join("\n- ")}` : "",
  ].filter(Boolean).join("\n");
}

function stripSignatureLikeBlock(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const signatureStartIndex = lines.findIndex((line, index) => {
    const trimmed = line.trim();
    const nextLines = lines
      .slice(index + 1, index + 5)
      .map((nextLine) => nextLine.trim())
      .join("\n");

    if (/^Taras Mynd\b/i.test(trimmed)) {
      return true;
    }

    if (/^(warmly|best|thanks|thank you|looking forward),?\s*$/i.test(trimmed) && /Taras\b/i.test(nextLines)) {
      return true;
    }

    return /^(warmly|best|thanks|thank you|looking forward),?\s*Taras\b/i.test(trimmed);
  });

  return (signatureStartIndex === -1 ? text : lines.slice(0, signatureStartIndex).join("\n")).trim();
}

function stripGreetingLikeOpening(text: string) {
  return text
    .replace(/^\s*(hi|hello|hey)\s+[^,\n]+(?:\s+and\s+[^,\n]+)?[,]?\s*\n+/i, "")
    .replace(/^\s*(hi|hello|hey)\s+there[,]?\s*\n+/i, "")
    .trim();
}

function normalizeMarkdownLinksForRichEmail(text: string) {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

export function finalizeLlmWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs & { text: string }) {
  const formatting = getChannelFormatting(args.config, args.state);
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const withoutModelSignature = stripSignatureLikeBlock(args.text);
  const withoutThreadGreeting = !policy.allowGreeting
    ? stripGreetingLikeOpening(withoutModelSignature)
    : withoutModelSignature;
  const normalizedLinks = formatting.richLinks
    ? normalizeMarkdownLinksForRichEmail(withoutThreadGreeting)
    : withoutThreadGreeting;

  return policy.includeSignature
    ? appendSignatureOnce(normalizedLinks, args.config.signature)
    : normalizedLinks.trim();
}

export function parseWeddingSalesReflectionJson(text: string) {
  const trimmed = text.trim();
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(jsonText) as {
      status?: unknown;
      revisedText?: unknown;
      issues?: unknown;
    };

    return {
      status: parsed.status === "rewrite" ? "rewrite" : "pass",
      revisedText: typeof parsed.revisedText === "string" ? parsed.revisedText.trim() : "",
      issues: Array.isArray(parsed.issues) ? parsed.issues.filter((issue): issue is string => typeof issue === "string") : [],
    };
  } catch {
    return {
      status: "pass" as const,
      revisedText: "",
      issues: [],
    };
  }
}

async function reflectWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs & { draft: string }) {
  if (!shouldUseReflection()) {
    return args.draft;
  }

  try {
    const { text } = await generateText({
      model: openai(process.env.WEDDING_SALES_REFLECTION_MODEL || DEFAULT_REFLECTION_MODEL),
      system: buildReflectionSystemPrompt(args),
      prompt: [
        "Review this draft and either pass it or rewrite it.",
        "Facts and policy:",
        safeJson(buildComposerFacts(args)),
        "Draft:",
        args.draft,
      ].join("\n\n"),
      temperature: 0.2,
    });
    const review = parseWeddingSalesReflectionJson(text);

    if (review.status !== "rewrite" || !review.revisedText) {
      return args.draft;
    }

    return finalizeLlmWeddingSalesResponse({ ...args, text: review.revisedText });
  } catch (error) {
    console.warn("[wedding-sales] LLM response reflection failed; using composer draft.", error);
    return args.draft;
  }
}

export async function composeHumanWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs) {
  const fallback = composeWeddingSalesResponse(args);

  if (!shouldUseLlmComposer()) {
    return fallback;
  }

  try {
    const { text } = await generateText({
      model: openai(process.env.WEDDING_SALES_RESPONSE_MODEL || DEFAULT_RESPONSE_MODEL),
      system: buildComposerSystemPrompt(args),
      prompt: [
        "Create the next reply from these facts.",
        "If previousAssistantResponse is similar to what you are about to write, change the wording and move the conversation forward.",
        "Do not treat this as a fresh conversation unless assistantReplyCount is 0.",
        "Facts:",
        safeJson(buildComposerFacts(args)),
      ].join("\n\n"),
      temperature: 0.7,
      frequencyPenalty: 0.4,
      presencePenalty: 0.2,
    });

    const trimmed = text.trim();

    if (!trimmed) {
      return fallback;
    }

    const draft = finalizeLlmWeddingSalesResponse({ ...args, text: trimmed });

    return reflectWeddingSalesResponse({ ...args, draft });
  } catch (error) {
    console.warn("[wedding-sales] LLM response composer failed; using fallback.", error);
    return fallback;
  }
}
