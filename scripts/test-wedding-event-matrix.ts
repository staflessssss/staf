import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { invokeWeddingSalesSimpleGraph } from "@/lib/lang/graphs/wedding-sales-simple/graph";
import type {
  SimpleWeddingSalesQuestion,
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesState,
  TurnUnderstanding,
} from "@/lib/lang/graphs/wedding-sales-simple/state";
import type { WeddingSalesConfig } from "@/lib/lang/graphs/wedding-sales/config";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

type EventPriority = "P0" | "P1" | "P2";
type EventStateName =
  | "first_turn"
  | "collecting_names"
  | "collecting_venue"
  | "collecting_call_time"
  | "collecting_email"
  | "after_availability_checked"
  | "pending_booking_confirmation"
  | "after_booking_confirmed"
  | "bot_paused_handoff";

type EventUnderstanding = {
  customerMessageType: TurnUnderstanding["customerMessageType"];
  facts?: Partial<TurnUnderstanding["facts"]>;
  questionsAskedByCustomer?: SimpleWeddingSalesQuestion[];
  confidence?: number;
};

type EventExpected = {
  responseKey?: SimpleWeddingSalesResponseKey;
  responseKeyOneOf?: SimpleWeddingSalesResponseKey[];
  nextStep?: SimpleWeddingSalesState["nextStep"];
  toolCalled?: string;
  toolNotCalled?: string;
  shouldNotBook?: boolean;
  shouldClarifyOrResume?: boolean;
  shouldAskLockInAgain?: boolean;
  bookingConfirmed?: boolean;
  bookingNotRepeated?: boolean;
  pendingUserAction?: Record<string, unknown> | null;
  pendingUserActionStill?: Record<string, unknown>;
  resumedSlot?: string;
  oldAvailabilityInvalidated?: boolean;
  slotChanged?: Record<string, unknown>;
};

type EventVariant =
  | string
  | {
      text: string;
      states?: EventStateName[];
      understanding?: EventUnderstanding;
      expected?: EventExpected;
    };

type EventCase = {
  id: string;
  priority: EventPriority;
  variants: EventVariant[];
  understanding?: EventUnderstanding;
  expectedByState?: Partial<Record<EventStateName, EventExpected>>;
};

type EventCasesFile = {
  events: EventCase[];
};

type StatePresetsFile = {
  presets: Record<
    string,
    {
      description?: string;
      state?: Partial<SimpleWeddingSalesState>;
    }
  >;
};

type EventResult = {
  eventId: string;
  stateName: EventStateName;
  variantIndex: number;
  message: string;
  responseText: string;
  responseKey?: string;
  replyType?: string;
  nextStep?: string;
  pendingUserAction?: SimpleWeddingSalesState["pendingUserAction"];
  bookingConfirmed?: boolean;
  handoffReason?: string;
  requiredQuestion?: string;
  weddingDate?: string;
  location?: string;
  venue?: string;
  availabilityCheck?: SimpleWeddingSalesState["availabilityCheck"];
  toolCalls: string[];
};

const rootDir = process.cwd();
const casesPath = path.join(rootDir, "tests", "wedding-sales-simple", "event-cases.yml");
const presetsPath = path.join(rootDir, "tests", "wedding-sales-simple", "state-presets.yml");

function parseArgs() {
  const priorityArg = process.argv.find((arg) => arg.startsWith("--priority="));
  const priority = priorityArg?.split("=")[1] as EventPriority | undefined;

  if (priority && !["P0", "P1", "P2"].includes(priority)) {
    throw new Error(`Unsupported priority "${priority}". Use P0, P1, or P2.`);
  }

  return { priority };
}

function parseJsonFile<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf8");

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `${filePath} must be JSON-compatible YAML for this lightweight runner: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function defaultConfig(): Partial<WeddingSalesConfig> {
  return {
    guide: {
      imageUrl: "https://example.com/myndful-fl-guide.png",
      fileName: "Collections guide",
    },
    pricing: {
      startPrice: "$2,800",
      currency: "USD",
      coverageHours: 8,
      promotionText: "Also, we are running a 20% discount through June 30.",
    },
    pricingByRegion: {
      FL: {
        startPrice: "$2,800",
        currency: "USD",
        coverageHours: 8,
        promotionText: "Also, we are running a 20% discount through June 30.",
      },
      NC_SC_GA: {
        startPrice: "$3,600",
        currency: "USD",
        coverageHours: 8,
        promotionText: "Also, we are running a 20% discount through June 30.",
      },
    },
    portfolio: [
      {
        label: "Recent wedding films",
        url: "https://example.com/recent-films",
      },
    ],
  } as Partial<WeddingSalesConfig>;
}

function makeToolContext(): WeddingSalesToolContext {
  return {
    tenantId: "tenant-event-matrix",
    testMode: true,
    weddingAvailability: {
      action: "capacity availability",
      params: {},
    },
    consultationCalendar: {
      action: "check calendar",
      params: {
        checkConflictsBeforeBooking: false,
      },
    },
    bookConsultation: {
      action: "book call",
      params: {
        checkConflictsBeforeBooking: false,
      },
    },
  };
}

function normalizeVariant(variant: EventVariant) {
  return typeof variant === "string"
    ? { text: variant, states: undefined, understanding: undefined, expected: undefined }
    : variant;
}

function buildUnderstanding(input?: EventUnderstanding): TurnUnderstanding {
  return {
    customerMessageType: input?.customerMessageType ?? "answer_to_question",
    facts: input?.facts ?? {},
    questionsAskedByCustomer: input?.questionsAskedByCustomer ?? [],
    confidence: input?.confidence ?? 0.95,
  };
}

function getSlot(result: EventResult, slot: string) {
  if (slot === "weddingDate") {
    return result.weddingDate;
  }
  if (slot === "location") {
    return result.location;
  }
  if (slot === "venue") {
    return result.venue;
  }
  return undefined;
}

function resultSummary(result: EventResult) {
  return [
    `message: ${result.message}`,
    `responseKey: ${result.responseKey ?? "<none>"}`,
    `replyType: ${result.replyType ?? "<none>"}`,
    `nextStep: ${result.nextStep ?? "<none>"}`,
    `pendingUserAction: ${JSON.stringify(result.pendingUserAction ?? null)}`,
    `bookingConfirmed: ${String(result.bookingConfirmed ?? false)}`,
    `handoffReason: ${result.handoffReason ?? "<none>"}`,
    `requiredQuestion: ${result.requiredQuestion ?? "<none>"}`,
    `toolCalls: ${result.toolCalls.join(", ") || "<none>"}`,
    `slots: ${JSON.stringify({
      weddingDate: result.weddingDate,
      location: result.location,
      venue: result.venue,
      availabilityCheck: result.availabilityCheck,
    })}`,
    `outbound: ${JSON.stringify(result.responseText)}`,
  ].join("\n");
}

function assertContains(label: string, actual: string, expected: string) {
  assert.match(actual, new RegExp(escapeRegExp(expected), "i"), `${label}: expected text to contain "${expected}"`);
}

function assertNotContains(label: string, actual: string, forbidden: string) {
  assert.doesNotMatch(actual, new RegExp(escapeRegExp(forbidden), "i"), `${label}: forbidden text "${forbidden}"`);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertEventResult(result: EventResult, expected: EventExpected) {
  const label = `${result.eventId} x ${result.stateName} variant ${result.variantIndex + 1}`;

  try {
    if (expected.responseKey) {
      assert.equal(result.responseKey, expected.responseKey, `${label}: responseKey`);
    }

    if (expected.responseKeyOneOf?.length) {
      assert.ok(
        result.responseKey && expected.responseKeyOneOf.includes(result.responseKey as SimpleWeddingSalesResponseKey),
        `${label}: expected responseKey one of ${expected.responseKeyOneOf.join(", ")}`,
      );
    }

    if (expected.nextStep) {
      assert.equal(result.nextStep, expected.nextStep, `${label}: nextStep`);
    }

    if (expected.toolCalled) {
      assert.ok(result.toolCalls.includes(expected.toolCalled), `${label}: expected tool ${expected.toolCalled}`);
    }

    if (expected.toolNotCalled) {
      assert.ok(!result.toolCalls.includes(expected.toolNotCalled), `${label}: forbidden tool ${expected.toolNotCalled}`);
    }

    if (expected.shouldNotBook) {
      assert.ok(!result.toolCalls.includes("book_consultation"), `${label}: must not book`);
    }

    if (expected.bookingConfirmed !== undefined) {
      assert.equal(result.bookingConfirmed, expected.bookingConfirmed, `${label}: bookingConfirmed`);
    }

    if (expected.bookingNotRepeated) {
      assert.notEqual(result.responseKey, "utter_booking_confirmed", `${label}: must not repeat booking confirmation`);
      assertNotContains(label, result.responseText, "calendar invite");
      assertNotContains(label, result.responseText, "locked in");
    }

    if ("pendingUserAction" in expected) {
      if (expected.pendingUserAction === null) {
        assert.equal(result.pendingUserAction, null, `${label}: pendingUserAction`);
      } else {
        for (const [key, value] of Object.entries(expected.pendingUserAction ?? {})) {
          assert.equal(
            (result.pendingUserAction as Record<string, unknown> | undefined)?.[key],
            value,
            `${label}: pendingUserAction.${key}`,
          );
        }
      }
    }

    if (expected.pendingUserActionStill) {
      for (const [key, value] of Object.entries(expected.pendingUserActionStill)) {
        assert.equal(
          (result.pendingUserAction as Record<string, unknown> | undefined)?.[key],
          value,
          `${label}: pendingUserActionStill.${key}`,
        );
      }
    }

    if (expected.resumedSlot) {
      assert.equal(result.requiredQuestion, expected.resumedSlot, `${label}: resumedSlot`);
    }

    if (expected.shouldClarifyOrResume) {
      assert.ok(
        Boolean(result.requiredQuestion) || result.replyType === "clarification" || result.nextStep === "handoff",
        `${label}: expected clarification, resume slot, or handoff`,
      );
    }

    if (expected.shouldAskLockInAgain) {
      assert.equal(result.pendingUserAction?.type, "booking_confirmation", `${label}: pending booking should stay active`);
      assertContains(label, result.responseText, "lock");
    }

    if (expected.oldAvailabilityInvalidated) {
      assert.notDeepEqual(
        {
          date: result.availabilityCheck?.date,
          location: result.availabilityCheck?.location,
        },
        {
          date: "2026-08-15",
          location: "Orlando",
        },
        `${label}: old availability check should not remain current`,
      );
    }

    for (const [slot, value] of Object.entries(expected.slotChanged ?? {})) {
      assert.equal(getSlot(result, slot), value, `${label}: slotChanged.${slot}`);
    }
  } catch (error) {
    throw new Error(`${label} failed:\n${error instanceof Error ? error.message : String(error)}\n\n${resultSummary(result)}`);
  }
}

async function runEventVariant(args: {
  eventCase: EventCase;
  stateName: EventStateName;
  previousState: Partial<SimpleWeddingSalesState>;
  variant: ReturnType<typeof normalizeVariant>;
  variantIndex: number;
}) {
  const understanding = buildUnderstanding(args.variant.understanding ?? args.eventCase.understanding);
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: args.variant.text,
    tenantId: "tenant-event-matrix",
    agentId: "agent-event-matrix",
    contactId: "contact-event-matrix",
    previousState: args.previousState,
    config: defaultConfig(),
    toolContext: makeToolContext(),
    understand: () => understanding,
  });

  return {
    eventId: args.eventCase.id,
    stateName: args.stateName,
    variantIndex: args.variantIndex,
    message: args.variant.text,
    responseText: result.responseDraft ?? "",
    responseKey: result.decisionTrace?.responseKey,
    replyType: result.decisionTrace?.replyType,
    nextStep: result.nextStep,
    pendingUserAction: result.pendingUserAction,
    bookingConfirmed: result.bookingConfirmed,
    handoffReason: result.handoffReason,
    requiredQuestion: result.replyContract?.requiredQuestion,
    weddingDate: result.weddingDate,
    location: result.location,
    venue: result.venue,
    availabilityCheck: result.availabilityCheck,
    toolCalls: result.toolObservations.map((observation) => observation.toolName),
  } satisfies EventResult;
}

async function main() {
  const { priority } = parseArgs();

  if (!existsSync(casesPath)) {
    throw new Error(`Event cases file not found: ${casesPath}`);
  }
  if (!existsSync(presetsPath)) {
    throw new Error(`State presets file not found: ${presetsPath}`);
  }

  const eventCases = parseJsonFile<EventCasesFile>(casesPath);
  const presets = parseJsonFile<StatePresetsFile>(presetsPath);
  const results: EventResult[] = [];
  const selectedEvents = priority
    ? eventCases.events.filter((eventCase) => eventCase.priority === priority)
    : eventCases.events;

  for (const eventCase of selectedEvents) {
    for (const [variantIndex, rawVariant] of eventCase.variants.entries()) {
      const variant = normalizeVariant(rawVariant);
      const expectedByState = eventCase.expectedByState ?? {};
      const states = variant.states ?? (Object.keys(expectedByState) as EventStateName[]);

      for (const stateName of states) {
        const expected = {
          ...expectedByState[stateName],
          ...variant.expected,
        };
        if (Object.keys(expected).length === 0) {
          continue;
        }

        const preset = presets.presets[stateName];
        if (!preset) {
          throw new Error(`State preset not found: ${stateName}`);
        }

        const eventResult = await runEventVariant({
          eventCase,
          stateName,
          previousState: preset.state ?? {},
          variant,
          variantIndex,
        });
        assertEventResult(eventResult, expected);
        results.push(eventResult);
      }
    }
  }

  console.log(
    `${results.length} wedding event matrix cases passed across ${selectedEvents.length} event groups${
      priority ? ` (${priority})` : ""
    }.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
