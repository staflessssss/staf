import {
  defaultWeddingSalesConfig,
  normalizeWeddingSalesRegionKey,
  resolveWeddingSalesRegion,
  selectWeddingSalesGuide,
  selectWeddingSalesPricing,
  type WeddingSalesConfig,
} from "../wedding-sales/config";
import { buildWeddingSalesConfigFromChannelConfig } from "../wedding-sales/config-from-agent";
import type { SimpleWeddingSalesChannel, SimpleWeddingSalesState } from "./state";

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
  };
  pricing: {
    startPrice: string;
    currency?: string;
    coverageHours?: number;
    region?: string;
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
  const callWindow = `${formatBusinessDays(config.callBookingWindow.businessDays)}, ${formatHour(
    config.callBookingWindow.startHour,
  )}-${formatHour(config.callBookingWindow.endHour)} ${config.callBookingWindow.timezone}`;
  const voice =
    featureText(features, /founder|identity|voice/i) ||
    "Taras Mynd is the founder of Myndful Films. Write warm, human, founder-led messages that never sound robotic.";

  return {
    channel: input.channel,
    persona: {
      name: "Taras",
      company: "Myndful Films",
      voice,
    },
    pricing: {
      startPrice: pricing.startPrice,
      currency: pricing.currency,
      coverageHours: pricing.coverageHours,
      region,
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
    boundaries: [
      "Do not confirm booking unless bookingConfirmed is true.",
      "Do not invent availability, calendar status, prices, links, event IDs, or bookings.",
      "Do not say the guide or price image is unavailable when guide.imageUrl or guide.link exists.",
      "Instagram replies must not include an email signature.",
    ],
  };
}

