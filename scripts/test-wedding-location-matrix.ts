import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { decideNextStep, invokeWeddingSalesSimpleGraph } from "@/lib/lang/graphs/wedding-sales-simple/graph";
import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";
import { understandTurnHeuristically } from "@/lib/lang/graphs/wedding-sales-simple/understand";
import { resolveWeddingSalesRegion } from "@/lib/lang/graphs/wedding-sales/config";
import type { WeddingSalesConfig } from "@/lib/lang/graphs/wedding-sales/config";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

type LocationCase = {
  id: string;
  location: string;
  expectedRegion: "FL" | "NC_SC_GA" | null;
  expectClarification?: boolean;
};

type LocationCasesFile = {
  cases: LocationCase[];
};

const casesPath = path.join(process.cwd(), "tests", "wedding-sales-simple", "location-cases.yml");

function parseCases(): LocationCasesFile {
  return JSON.parse(readFileSync(casesPath, "utf8")) as LocationCasesFile;
}

function config(): Partial<WeddingSalesConfig> {
  return {
    guide: {
      imageUrl: "https://example.com/myndful-guide.png",
    },
    pricingByRegion: {
      FL: {
        startPrice: "$2,800",
        currency: "USD",
        coverageHours: 8,
      },
      NC_SC_GA: {
        startPrice: "$3,600",
        currency: "USD",
        coverageHours: 8,
      },
    },
  };
}

function toolContext(): WeddingSalesToolContext {
  return {
    tenantId: "tenant-location-matrix",
    testMode: true,
    weddingAvailability: {
      action: "capacity availability",
      params: {},
    },
    consultationCalendar: {
      action: "check calendar",
      params: {},
    },
    bookConsultation: {
      action: "book call",
      params: {},
    },
  };
}

async function assertKnownLocation(locationCase: LocationCase) {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: `Hii! I need a videographer for a wedding in ${locationCase.location} on Oct 3 2026`,
    config: config(),
    toolContext: toolContext(),
    understand: (state) => understandTurnHeuristically(state),
  });
  const label = locationCase.id;

  assert.equal(result.availabilityRegion, locationCase.expectedRegion, `${label}: normalized region`);
  assert.equal(result.decisionTrace?.toolCalled, "checkAvailability", `${label}: tool call`);
  assert.notEqual(result.nextStep, "handoff", `${label}: must not handoff`);
  assert.notEqual(result.mode, "human_needed", `${label}: must not escalate`);
  assert.doesNotMatch(result.responseDraft ?? "", /not open|not available|unavailable/i, `${label}: no false unavailable`);

  if (locationCase.expectedRegion !== "FL") {
    assert.doesNotMatch(result.responseDraft ?? "", /Jay|Tampa/i, `${label}: no FL team copy`);
  }
}

async function assertUnknownLocation(locationCase: LocationCase) {
  const resolvedRegion = resolveWeddingSalesRegion({ location: locationCase.location });
  assert.equal(resolvedRegion, undefined, `${locationCase.id}: resolver should not guess`);

  const result = decideNextStep({
    channel: "instagram",
    latestCustomerMessage: `Hii! I need a videographer for a wedding in ${locationCase.location} on Oct 3 2026`,
    isFirstTurn: true,
    weddingDate: "2026-10-03",
    weddingDateDisplay: "October 3, 2026",
    location: locationCase.location,
    availability: "unknown",
    availabilityContextDate: "2026-10-03",
    availabilityCheck: {
      date: "2026-10-03",
      location: locationCase.location,
      status: "unknown",
      checkedAt: "2026-06-30T00:00:00.000Z",
    },
    bookingConfirmed: false,
    mode: "bot_active",
    unclearAttemptCount: 0,
    questionsAskedByCustomer: [],
    pendingUserAction: null,
    toolObservations: [
      {
        toolName: "check_wedding_availability",
        result: JSON.stringify({
          status: "needs_region",
          supportedRegions: ["FL", "NC/SC/GA"],
        }),
      },
    ],
  } as SimpleWeddingSalesState);

  assert.equal(result.nextStep, "ask_missing_info", `${locationCase.id}: asks clarification`);
  assert.equal(result.missingField, "location", `${locationCase.id}: asks location`);
  assert.notEqual(result.nextStep, "handoff", `${locationCase.id}: must not handoff`);
  assert.equal(result.trace.replyType, "missing_info", `${locationCase.id}: missing info reply`);
}

async function main() {
  const results: string[] = [];

  for (const locationCase of parseCases().cases) {
    const resolvedRegion = resolveWeddingSalesRegion({ location: locationCase.location });
    assert.equal(resolvedRegion ?? null, locationCase.expectedRegion, `${locationCase.id}: resolver`);

    if (locationCase.expectedRegion) {
      await assertKnownLocation(locationCase);
    } else if (locationCase.expectClarification) {
      await assertUnknownLocation(locationCase);
    }

    results.push(locationCase.id);
  }

  console.log(`${results.length} wedding location matrix cases passed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
