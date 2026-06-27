import {
  defaultWeddingSalesConfig,
  normalizeWeddingSalesRegionKey,
  resolveWeddingSalesRegion,
  selectWeddingSalesGuide,
  selectWeddingSalesPricing,
  type WeddingSalesConfig,
} from "../wedding-sales/config";
import { buildWeddingSalesConfigFromChannelConfig } from "../wedding-sales/config-from-agent";
import type {
  SimpleWeddingSalesChannel,
  SimpleWeddingSalesQuestion,
  SimpleWeddingSalesState,
} from "./state";

export type SimpleWeddingKnowledgeFeature = {
  name?: string | null;
  description?: string | null;
  knowledgeContent?: string | null;
};

export type SimpleWeddingKnowledgeContext = {
  channel: SimpleWeddingSalesChannel;
  persona: {
    name: string;
    company: string;
    voice: string;
    replyStyle: {
      greetingOpening: string;
      greetingIntroduction: string;
      greetingCelebration: string;
      namesAcknowledgement: string;
      venueAcknowledgement: string;
      calendarAlternativesIntro: string;
      calendarAlternativesQuestion: string;
    };
  };
  pricing: {
    startPrice: string;
    currency?: string;
    coverageHours?: number;
    region?: string;
    promotionText?: string;
    packages: Array<{
      name: string;
      price: string;
      summary?: string;
    }>;
  };
  guide: {
    imageUrl?: string;
    link?: string;
    fileId?: string;
    fileName?: string;
    portfolioLinks: Array<{
      label: string;
      url: string;
    }>;
    reviewsLink?: {
      label: string;
      url: string;
    };
  };
  scheduling: {
    timezone: string;
    callWindow: string;
  };
  faq: {
    rawFootage: {
      answerPolicy: "covered";
      answer: string;
    };
  };
  boundaries: string[];
};

function mergeConfig(config?: Partial<WeddingSalesConfig>): WeddingSalesConfig {
  return {
    ...defaultWeddingSalesConfig,
    ...config,
    pricing: {
      ...defaultWeddingSalesConfig.pricing,
      ...config?.pricing,
    },
    pricingByRegion: {
      ...defaultWeddingSalesConfig.pricingByRegion,
      ...config?.pricingByRegion,
    },
    guide: {
      ...defaultWeddingSalesConfig.guide,
      ...config?.guide,
    },
    guidesByRegion: {
      ...defaultWeddingSalesConfig.guidesByRegion,
      ...config?.guidesByRegion,
    },
    callBookingWindow: {
      ...defaultWeddingSalesConfig.callBookingWindow,
      ...config?.callBookingWindow,
    },
  };
}

function featureText(features: SimpleWeddingKnowledgeFeature[], pattern: RegExp) {
  return features.find((feature) =>
    pattern.test(`${feature.name ?? ""}\n${feature.description ?? ""}`),
  )?.knowledgeContent ?? "";
}

function readPackages(features: SimpleWeddingKnowledgeFeature[]) {
  const pricingText = featureText(features, /collections|pricing/i);

  return Array.from(
    pricingText.matchAll(
      /\b(Classic|Premium|Exclusive)\s+Collection\s+[?–-]\s*(\$\d[\d,]*)(?::|\s+-)?\s*([^.]*)/gi,
    ),
  ).map((match) => ({
    name: `${match[1]} Collection`,
    price: match[2],
    summary: match[3]?.trim() || undefined,
  }));
}

function formatBusinessDays(days: number[]) {
  const labels: Record<number, string> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
  };
  const knownDays = days.map((day) => labels[day]).filter(Boolean);

  if (knownDays.length === 5 && days.every((day) => day >= 1 && day <= 5)) {
    return "Monday-Friday";
  }

  return knownDays.join(", ");
}

function formatHour(hour: number) {
  if (hour === 0) {
    return "12am";
  }

  if (hour < 12) {
    return `${hour}am`;
  }

  if (hour === 12) {
    return "12pm";
  }

  return `${hour - 12}pm`;
}

function publicDriveUrl(fileId?: string) {
  const trimmed = fileId?.trim();

  return trimmed
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(trimmed)}`
    : undefined;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string, fallback: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readOptionalString(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function coverageRegionLabel(knowledge: Pick<SimpleWeddingKnowledgeContext, "pricing">) {
  return knowledge.pricing.region ?? "your area";
}

function readPersonaIdentity(channelConfig: unknown) {
  const root = asRecord(channelConfig);
  const prompting = asRecord(root?.prompting);
  const persona = typeof prompting?.persona === "string" ? prompting.persona : "";
  const identity = /\b(?:you are|i(?:'|’)m)\s+([A-Z][\p{L}'’-]+)(?:\s+[A-Z][\p{L}'’-]+)*,?\s+(?:the\s+)?founder of\s+([^.?\n]+)/iu.exec(
    persona,
  );

  return {
    name: identity?.[1]?.trim() || "Taras",
    company: identity?.[2]?.trim() || "Myndful Films",
    prompting,
  };
}

export function buildSimpleWeddingKnowledgeContext(input: {
  channelConfig?: unknown;
  features?: SimpleWeddingKnowledgeFeature[];
  channel: SimpleWeddingSalesChannel;
  state?: Pick<SimpleWeddingSalesState, "location" | "venue" | "availabilityRegion">;
  config?: Partial<WeddingSalesConfig>;
}): SimpleWeddingKnowledgeContext {
  const config = input.channelConfig
    ? buildWeddingSalesConfigFromChannelConfig(input.channelConfig as never)
    : mergeConfig(input.config);
  const features = input.features ?? [];
  const pricing = selectWeddingSalesPricing(config, input.state);
  const guide = selectWeddingSalesGuide(config, input.state);
  const region =
    resolveWeddingSalesRegion(input.state) ??
    normalizeWeddingSalesRegionKey(input.state?.availabilityRegion);
  const root = asRecord(input.channelConfig);
  const pricingConfig = asRecord(root?.pricing);
  const selectedRegionPricing =
    region && root
      ? asRecord(asRecord(root.pricingByRegion)?.[region])
      : undefined;
  const promotionText =
    readOptionalString(selectedRegionPricing, "promotionText") ??
    readOptionalString(pricingConfig, "promotionText");
  const callWindow = `${formatBusinessDays(config.callBookingWindow.businessDays)}, ${formatHour(
    config.callBookingWindow.startHour,
  )}-${formatHour(config.callBookingWindow.endHour)} ${config.callBookingWindow.timezone}`;
  const voice =
    featureText(features, /founder|identity|voice/i) ||
    "Taras Mynd is the founder of Myndful Films. Write warm, human, founder-led messages that never sound robotic.";
  const identity = readPersonaIdentity(input.channelConfig);
  const replyStyle = asRecord(identity.prompting?.replyStyle);

  return {
    channel: input.channel,
    persona: {
      name: identity.name,
      company: identity.company,
      voice,
      replyStyle: {
        greetingOpening: readString(
          replyStyle,
          "greetingOpening",
          "Hey there! Thank you so much for reaching out 🤍✨",
        ),
        greetingIntroduction: readString(
          replyStyle,
          "greetingIntroduction",
          "I’m {{name}}, the founder of {{company}}.",
        ),
        greetingCelebration: readString(
          replyStyle,
          "greetingCelebration",
          "Huge congratulations on your engagement - such an exciting season of life!",
        ),
        namesAcknowledgement: readString(
          replyStyle,
          "namesAcknowledgement",
          "So nice to meet you both!",
        ),
        venueAcknowledgement: readString(
          replyStyle,
          "venueAcknowledgement",
          "{{venue}} sounds like a wonderful choice.",
        ),
        calendarAlternativesIntro: readString(
          replyStyle,
          "calendarAlternativesIntro",
          "That time is already taken, but I could do",
        ),
        calendarAlternativesQuestion: readString(
          replyStyle,
          "calendarAlternativesQuestion",
          "Would one of those work for you? ✨",
        ),
      },
    },
    pricing: {
      startPrice: pricing.startPrice,
      currency: pricing.currency,
      coverageHours: pricing.coverageHours,
      region,
      promotionText,
      packages: readPackages(features),
    },
    guide: {
      imageUrl: guide.imageUrl ?? publicDriveUrl(guide.fileId),
      link: guide.link,
      fileId: guide.fileId,
      fileName: guide.fileName,
      portfolioLinks: config.portfolio,
      reviewsLink: config.reviews.url ? config.reviews : undefined,
    },
    scheduling: {
      timezone: config.callBookingWindow.timezone,
      callWindow,
    },
    faq: {
      rawFootage: {
        answerPolicy: "covered",
        answer:
          featureText(features, /raw footage|raw files|unedited footage/i) ||
          "Raw footage can be added depending on the collection and what they are looking for. Discuss the cleanest option on the call. Do not calculate custom fees in chat.",
      },
    },
    boundaries: [
      "Do not confirm booking unless bookingConfirmed is true.",
      "Do not invent availability, calendar status, prices, links, event IDs, or bookings.",
      "Do not say the guide or price image is unavailable when guide.imageUrl or guide.link exists.",
      "Instagram replies must not include an email signature.",
    ],
  };
}

export function getPostBookingFaqAnswer(input: {
  question: SimpleWeddingSalesQuestion;
  knowledge: SimpleWeddingKnowledgeContext;
}): { exists: true; answer: string } | { exists: false; reason: "unsupported_topic" | "missing_knowledge" } {
  const { question, knowledge } = input;

  if (question === "delivery_timeline") {
    return {
      exists: true,
      answer:
        "Final films are typically delivered in about 4 months, and sneak peeks usually come around 2 weeks after the wedding 🤍",
    };
  }

  if (question === "sneak_peek") {
    return {
      exists: true,
      answer: "Sneak peeks usually come around 2 weeks after the wedding 🤍",
    };
  }

  if (question === "raw_footage") {
    const configured = knowledge.faq.rawFootage.answer;

    return {
      exists: true,
      answer: /do not calculate custom fees/i.test(configured)
        ? "Yes - raw footage can be added depending on the collection and what you're looking for. We can talk through the cleanest option on the call 🤍"
        : configured,
    };
  }

  if (question === "travel") {
    const region = coverageRegionLabel(knowledge);

    return {
      exists: true,
      answer: `Yes, we do travel. Our collections include travel coverage for ${region}, and if the venue is beyond the included mileage, we can go over the exact travel details on the call 🤍`,
    };
  }

  return {
    exists: false,
    reason:
      question === "music_choice" || question === "style" || question === "coi"
        ? "missing_knowledge"
        : "unsupported_topic",
  };
}
