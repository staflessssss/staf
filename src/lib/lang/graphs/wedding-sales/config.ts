import type { WeddingSalesChannel, WeddingSalesState } from "./state";

export type WeddingSalesConfig = {
  pricing: {
    startPrice: string;
    currency?: string;
    coverageHours?: number;
  };
  pricingByRegion?: Record<string, WeddingSalesPricingConfig>;
  guide: WeddingSalesGuideConfig;
  guidesByRegion?: Record<string, WeddingSalesGuideConfig>;
  portfolio: Array<{
    label: string;
    url: string;
  }>;
  reviews: {
    label: string;
    url: string;
  };
  coverage: {
    regions: string[];
    capacityPerDate: number;
    unavailableDates?: string[];
  };
  callBookingWindow: {
    timezone: string;
    businessDays: number[];
    startHour: number;
    endHour: number;
    durationMinutes: number;
  };
  signature: string;
  channelFormatting: Record<
    WeddingSalesChannel,
    {
      richLinks: boolean;
      allowAttachments: boolean;
      allowedEmojis: string[];
    }
  >;
};

export type WeddingSalesPricingConfig = {
  startPrice: string;
  currency?: string;
  coverageHours?: number;
};

export type WeddingSalesGuideConfig = {
  fileId?: string;
  fileName?: string;
  link?: string;
  imageUrl?: string;
};

export const defaultWeddingSalesConfig: WeddingSalesConfig = {
  pricing: {
    startPrice: "$3,490",
    currency: "USD",
    coverageHours: 8,
  },
  pricingByRegion: {
    FL: {
      startPrice: "$2,950",
      currency: "USD",
      coverageHours: 8,
    },
    NC_SC_GA: {
      startPrice: "$3,490",
      currency: "USD",
      coverageHours: 8,
    },
  },
  guide: {},
  portfolio: [],
  reviews: {
    label: "Google Reviews",
    url: "",
  },
  coverage: {
    regions: ["NC", "SC", "GA"],
    capacityPerDate: 2,
    unavailableDates: [],
  },
  callBookingWindow: {
    timezone: "America/New_York",
    businessDays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 14,
    durationMinutes: 30,
  },
  signature: "",
  channelFormatting: {
    gmail: {
      richLinks: true,
      allowAttachments: true,
      allowedEmojis: ["🤍", "✨", "🎥"],
    },
    instagram: {
      richLinks: false,
      allowAttachments: false,
      allowedEmojis: ["🤍", "✨", "🎥"],
    },
    telegram: {
      richLinks: false,
      allowAttachments: false,
      allowedEmojis: ["🤍", "✨", "🎥"],
    },
  },
};

export function resolveWeddingSalesRegion(state?: Pick<WeddingSalesState, "location" | "venue">) {
  const text = [state?.location, state?.venue].filter(Boolean).join(" ").toLowerCase();

  if (/\b(?:fl|florida|tampa|miami|orlando|st\.?\s*augustine|saint augustine|jacksonville)\b/i.test(text)) {
    return "FL";
  }

  if (/\b(?:nc|north carolina|sc|south carolina|ga|georgia|charlotte|raleigh|charleston|atlanta|savannah)\b/i.test(text)) {
    return "NC_SC_GA";
  }

  return undefined;
}

export function selectWeddingSalesPricing(
  config: WeddingSalesConfig,
  state?: Pick<WeddingSalesState, "location" | "venue">,
): WeddingSalesPricingConfig {
  const region = resolveWeddingSalesRegion(state);

  return (region ? config.pricingByRegion?.[region] : undefined) ?? config.pricing;
}

export function selectWeddingSalesGuide(
  config: WeddingSalesConfig,
  state?: Pick<WeddingSalesState, "location" | "venue">,
) {
  const region = resolveWeddingSalesRegion(state);

  return (region ? config.guidesByRegion?.[region] : undefined) ?? config.guide;
}
