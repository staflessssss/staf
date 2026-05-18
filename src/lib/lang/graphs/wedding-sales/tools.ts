import { IntegrationType, type Prisma } from "@prisma/client";

import type { RuntimeToolFeature, RuntimeToolStep } from "@/lib/agent-config";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

function includesAny(value: string, needles: string[]) {
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function findStep(
  toolFeatures: RuntimeToolFeature[],
  matcher: (feature: RuntimeToolFeature, step: RuntimeToolStep) => boolean,
) {
  for (const feature of toolFeatures) {
    for (const step of feature.steps) {
      if (matcher(feature, step)) {
        return step;
      }
    }
  }

  return null;
}

function toGoogleStepConfig(step: RuntimeToolStep) {
  return {
    action: step.action,
    params: step.params,
    metadata: step.integration.metadata as Prisma.JsonValue | null,
    credentialsEnc: step.integration.credentialsEnc ?? undefined,
  };
}

export function createWeddingSalesToolContextFromFeatures(args: {
  tenantId: string;
  toolFeatures: RuntimeToolFeature[];
  testMode?: boolean;
  defaultEmail?: string;
}): WeddingSalesToolContext | null {
  const weddingAvailability = findStep(
    args.toolFeatures,
    (feature, step) =>
      step.integration.type === IntegrationType.GOOGLE_SHEETS &&
      (includesAny(feature.name, ["wedding availability", "availability"]) ||
        includesAny(step.action, ["capacity availability"])),
  );
  const consultationCalendar = findStep(
    args.toolFeatures,
    (feature, step) =>
      step.integration.type === IntegrationType.GOOGLE_CALENDAR &&
      (includesAny(feature.name, ["check calendar", "check consultation calendar"]) ||
        includesAny(step.action, ["check calendar", "check consultation calendar", "check consultation"])),
  );
  const bookConsultation = findStep(
    args.toolFeatures,
    (feature, step) =>
      step.integration.type === IntegrationType.GOOGLE_CALENDAR &&
      (includesAny(feature.name, ["book"]) ||
        includesAny(step.action, ["book", "create consultation", "schedule consultation"])),
  );

  if (!weddingAvailability || !consultationCalendar || !bookConsultation) {
    return null;
  }

  return {
    tenantId: args.tenantId,
    testMode: args.testMode,
    defaultEmail: args.defaultEmail,
    weddingAvailability: toGoogleStepConfig(weddingAvailability),
    consultationCalendar: toGoogleStepConfig(consultationCalendar),
    bookConsultation: toGoogleStepConfig(bookConsultation),
  };
}
