import type { WeddingSalesChannel } from "./state";

export type WeddingSalesConfig = {
  pricing: {
    startPrice: string;
    currency?: string;
  };
  guide: {
    fileId?: string;
    fileName?: string;
    link?: string;
  };
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

export const defaultWeddingSalesConfig: WeddingSalesConfig = {
  pricing: {
    startPrice: "$2,750",
    currency: "USD",
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
