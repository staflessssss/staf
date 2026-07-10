import { Prisma } from "@prisma/client";

export type MyndfulServiceRegion = "FL" | "NC_SC_GA";

export type MyndfulGuideConfig = {
  pricingByRegion: Partial<
    Record<
      MyndfulServiceRegion,
      {
        startPrice?: string;
      }
    >
  >;
  guidesByRegion: Partial<
    Record<
      MyndfulServiceRegion,
      {
        fileId?: string;
        fileName?: string;
        imageUrl?: string;
      }
    >
  >;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function normalizeMyndfulServiceRegion(value: unknown): MyndfulServiceRegion | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase().replace(/[ /-]+/g, "_");
  return normalized === "FL" ? "FL" : normalized === "NC_SC_GA" ? "NC_SC_GA" : null;
}

export function buildMyndfulGuideConfig(channelConfig: Prisma.JsonValue | unknown): MyndfulGuideConfig {
  const config = asObject(channelConfig);
  const pricingByRegion: MyndfulGuideConfig["pricingByRegion"] = {};
  const guidesByRegion: MyndfulGuideConfig["guidesByRegion"] = {};

  for (const [rawRegion, rawPricing] of Object.entries(asObject(config?.pricingByRegion) ?? {})) {
    const region = normalizeMyndfulServiceRegion(rawRegion);
    const pricing = asObject(rawPricing);
    if (region && typeof pricing?.startPrice === "string" && pricing.startPrice.trim()) {
      pricingByRegion[region] = { startPrice: pricing.startPrice.trim() };
    }
  }

  for (const [rawRegion, rawGuide] of Object.entries(asObject(config?.priceAttachmentsByRegion) ?? {})) {
    const region = normalizeMyndfulServiceRegion(rawRegion);
    const guide = asObject(rawGuide);
    if (!region || !guide) {
      continue;
    }

    const fileId = typeof guide.fileId === "string" ? guide.fileId.trim() : "";
    const fileName = typeof guide.fileName === "string" ? guide.fileName.trim() : "";
    const imageUrl = typeof guide.imageUrl === "string" ? guide.imageUrl.trim() : "";
    if (fileId || imageUrl) {
      guidesByRegion[region] = {
        ...(fileId ? { fileId } : {}),
        ...(fileName ? { fileName } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      };
    }
  }

  return { pricingByRegion, guidesByRegion };
}

export function getMyndfulGuide(config: MyndfulGuideConfig, region: MyndfulServiceRegion) {
  return config.guidesByRegion[region] ?? null;
}
