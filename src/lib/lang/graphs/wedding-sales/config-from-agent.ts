import type { Prisma } from "@prisma/client";

import { defaultWeddingSalesConfig, type WeddingSalesConfig } from "./config";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseMarkdownLinks(text: string) {
  return Array.from(text.matchAll(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g)).map((match) => ({
    label: match[1].trim(),
    url: match[2].trim(),
  }));
}

function parsePortfolioAndReviews(text: string) {
  const links = parseMarkdownLinks(text);
  const reviews = links.find((link) => /review/i.test(link.label));

  return {
    portfolio: links.filter((link) => !/review/i.test(link.label)),
    reviews: reviews ?? defaultWeddingSalesConfig.reviews,
  };
}

function readCapacityRules(channelConfig: Record<string, unknown>) {
  const functionBlocks = Array.isArray(channelConfig.functionBlocks)
    ? channelConfig.functionBlocks
    : [];

  for (const block of functionBlocks) {
    const blockObject = asObject(block);
    const steps = Array.isArray(blockObject.steps) ? blockObject.steps : [];

    for (const step of steps) {
      const params = asObject(asObject(step).params);
      const capacityRules = Array.isArray(params.capacityRules) ? params.capacityRules : null;

      if (capacityRules) {
        return capacityRules
          .map((rule) => {
            const ruleObject = asObject(rule);
            return {
              region: asString(ruleObject.region),
              aliases: Array.isArray(ruleObject.aliases)
                ? ruleObject.aliases.map(asString).filter(Boolean)
                : [],
              capacity:
                typeof ruleObject.capacity === "number" && Number.isFinite(ruleObject.capacity)
                  ? ruleObject.capacity
                  : 1,
            };
          })
          .filter((rule) => rule.region);
      }
    }
  }

  return [];
}

function readBookingWindow(channelConfig: Record<string, unknown>) {
  const functionBlocks = Array.isArray(channelConfig.functionBlocks)
    ? channelConfig.functionBlocks
    : [];

  for (const block of functionBlocks) {
    const blockObject = asObject(block);
    const blockName = asString(blockObject.name).toLowerCase();
    const steps = Array.isArray(blockObject.steps) ? blockObject.steps : [];

    if (!blockName.includes("calendar") && !blockName.includes("book")) {
      continue;
    }

    for (const step of steps) {
      const params = asObject(asObject(step).params);

      return {
        timezone: asString(params.timeZone) || defaultWeddingSalesConfig.callBookingWindow.timezone,
        businessDays: Array.isArray(params.businessDays)
          ? params.businessDays.filter((day): day is number => typeof day === "number")
          : defaultWeddingSalesConfig.callBookingWindow.businessDays,
        startHour:
          typeof params.businessWindowStartHour === "number"
            ? params.businessWindowStartHour
            : defaultWeddingSalesConfig.callBookingWindow.startHour,
        endHour:
          typeof params.businessWindowEndHour === "number"
            ? params.businessWindowEndHour
            : defaultWeddingSalesConfig.callBookingWindow.endHour,
        durationMinutes:
          typeof params.slotDurationMinutes === "number"
            ? params.slotDurationMinutes
            : defaultWeddingSalesConfig.callBookingWindow.durationMinutes,
      };
    }
  }

  return defaultWeddingSalesConfig.callBookingWindow;
}

export function buildWeddingSalesConfigFromChannelConfig(
  channelConfigValue: Prisma.JsonValue | null | undefined,
): WeddingSalesConfig {
  const channelConfig = asObject(channelConfigValue);
  const textBlock =
    asString(channelConfig.collectionsGuideTextBlock) ||
    asString(channelConfig.pricingTextBlock);
  const { portfolio, reviews } = parsePortfolioAndReviews(textBlock);
  const capacityRules = readCapacityRules(channelConfig);
  const channelBehavior = asObject(channelConfig.channelBehavior);

  return {
    ...defaultWeddingSalesConfig,
    pricing: {
      startPrice: "$2,750",
      currency: "USD",
    },
    guide: {
      fileId: asString(channelConfig.priceAttachmentFileId) || undefined,
      fileName: asString(channelConfig.priceAttachmentFileName) || undefined,
      imageUrl:
        asString(channelConfig.priceAttachmentPublicUrl) ||
        asString(channelConfig.priceAttachmentImageUrl) ||
        asString(channelConfig.collectionsGuideImageUrl) ||
        undefined,
      link: undefined,
    },
    portfolio,
    reviews,
    coverage: {
      regions: capacityRules.map((rule) => rule.region),
      capacityPerDate: Math.max(...capacityRules.map((rule) => rule.capacity), 1),
      unavailableDates: [],
    },
    callBookingWindow: readBookingWindow(channelConfig),
    signature: asString(channelConfig.signatureText) || defaultWeddingSalesConfig.signature,
    channelFormatting: {
      ...defaultWeddingSalesConfig.channelFormatting,
      gmail: {
        ...defaultWeddingSalesConfig.channelFormatting.gmail,
        richLinks: channelBehavior.useRichFormatting !== false,
        allowAttachments: channelBehavior.allowAttachments !== false,
      },
    },
  };
}

export const weddingSalesConfigFromAgentTestHelpers = {
  parseMarkdownLinks,
  parsePortfolioAndReviews,
};
