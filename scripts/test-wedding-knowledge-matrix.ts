import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { invokeWeddingSalesSimpleGraph } from "@/lib/lang/graphs/wedding-sales-simple/graph";
import type {
  SimpleWeddingSalesHandoffReason,
  SimpleWeddingSalesQuestion,
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesState,
} from "@/lib/lang/graphs/wedding-sales-simple/state";
import type { WeddingSalesConfig } from "@/lib/lang/graphs/wedding-sales/config";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

type MatrixStateName =
  | "first_turn"
  | "during_slot_collection"
  | "pending_booking_confirmation"
  | "after_booking_confirmed";

type KnowledgeCase = {
  id: string;
  question: SimpleWeddingSalesQuestion;
  questionExamples: string[];
  states?: MatrixStateName[];
  expected?: {
    answeredQuestion?: SimpleWeddingSalesQuestion;
    responseKeyOneOf?: SimpleWeddingSalesResponseKey[];
    handoffReason?: SimpleWeddingSalesHandoffReason;
    mustContain?: string[];
    forbidden?: string[];
  };
};

type KnowledgeCasesFile = {
  cases: KnowledgeCase[];
};

type StatePresetsFile = {
  presets: Record<
    MatrixStateName,
    {
      description?: string;
      state?: Partial<SimpleWeddingSalesState>;
    }
  >;
};

type MatrixResult = {
  caseId: string;
  stateName: MatrixStateName;
  exampleIndex: number;
  message: string;
  responseText: string;
  responseKey?: string;
  replyType?: string;
  nextStep?: string;
  pendingUserAction?: SimpleWeddingSalesState["pendingUserAction"];
  bookingConfirmed?: boolean;
  handoffReason?: string;
  requiredQuestion?: string;
  toolCalls: string[];
};

const rootDir = process.cwd();
const casesPath = path.join(rootDir, "tests", "wedding-sales-simple", "knowledge-cases.yml");
const presetsPath = path.join(rootDir, "tests", "wedding-sales-simple", "state-presets.yml");
const matrixStates: MatrixStateName[] = [
  "first_turn",
  "during_slot_collection",
  "pending_booking_confirmation",
  "after_booking_confirmed",
];

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
    tenantId: "tenant-knowledge-matrix",
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

function resultSummary(result: MatrixResult) {
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

function shouldResumeNamesQuestion(stateName: MatrixStateName, knowledgeCase: KnowledgeCase) {
  return (
    stateName === "during_slot_collection" &&
    knowledgeCase.expected?.handoffReason === undefined &&
    knowledgeCase.question !== "availability"
  );
}

function shouldPreservePendingBooking(stateName: MatrixStateName, knowledgeCase: KnowledgeCase) {
  return (
    stateName === "pending_booking_confirmation" &&
    knowledgeCase.expected?.handoffReason === undefined &&
    knowledgeCase.question !== "availability"
  );
}

function assertMatrixResult(result: MatrixResult, knowledgeCase: KnowledgeCase) {
  const label = `${result.caseId} × ${result.stateName} example ${result.exampleIndex + 1}`;

  try {
    if (knowledgeCase.expected?.responseKeyOneOf?.length) {
      assert.ok(
        result.responseKey && knowledgeCase.expected.responseKeyOneOf.includes(result.responseKey as SimpleWeddingSalesResponseKey),
        `${label}: expected responseKey one of ${knowledgeCase.expected.responseKeyOneOf.join(", ")}`,
      );
    }

    if (knowledgeCase.expected?.handoffReason) {
      assert.equal(result.nextStep, "handoff", `${label}: nextStep`);
      assert.equal(result.handoffReason, knowledgeCase.expected.handoffReason, `${label}: handoffReason`);
    }

    for (const expected of knowledgeCase.expected?.mustContain ?? []) {
      assertContains(label, result.responseText, expected);
    }

    for (const forbidden of knowledgeCase.expected?.forbidden ?? []) {
      assertNotContains(label, result.responseText, forbidden);
    }

    if (knowledgeCase.expected?.answeredQuestion) {
      assert.ok(
        result.responseText.trim().length > 0,
        `${label}: expected non-empty answer for ${knowledgeCase.expected.answeredQuestion}`,
      );
    }

    if (shouldResumeNamesQuestion(result.stateName, knowledgeCase)) {
      assert.equal(result.requiredQuestion, "names", `${label}: should resume names question`);
      assertNotContains(label, result.responseText, "What is your wedding date?");
      assert.ok(!result.toolCalls.includes("book_consultation"), `${label}: must not book while resuming slot`);
    }

    if (shouldPreservePendingBooking(result.stateName, knowledgeCase)) {
      assert.equal(
        result.pendingUserAction?.type,
        "booking_confirmation",
        `${label}: should preserve pending booking confirmation`,
      );
      assertContains(label, result.responseText, "lock");
      assert.ok(!result.toolCalls.includes("book_consultation"), `${label}: must not book from FAQ interruption`);
    }

    if (result.stateName === "after_booking_confirmed") {
      assert.ok(!result.toolCalls.includes("book_consultation"), `${label}: must not book after booking was confirmed`);
      assert.notEqual(result.responseKey, "utter_booking_confirmed", `${label}: must not repeat booking_confirmed`);
      assertNotContains(label, result.responseText, "calendar invite");
      assertNotContains(label, result.responseText, "locked in");
    }

    assert.ok(!result.toolCalls.includes("book_consultation"), `${label}: FAQ matrix must not book consultation`);
  } catch (error) {
    throw new Error(`${label} failed:\n${error instanceof Error ? error.message : String(error)}\n\n${resultSummary(result)}`);
  }
}

async function runMatrixCase(args: {
  knowledgeCase: KnowledgeCase;
  stateName: MatrixStateName;
  previousState: Partial<SimpleWeddingSalesState>;
  message: string;
  exampleIndex: number;
}) {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: args.message,
    tenantId: "tenant-knowledge-matrix",
    agentId: "agent-knowledge-matrix",
    contactId: "contact-knowledge-matrix",
    previousState: args.previousState,
    config: defaultConfig(),
    toolContext: makeToolContext(),
    understand: () => ({
      customerMessageType:
        args.knowledgeCase.question === "availability"
          ? "availability_question"
          : "business_question",
      facts: {},
      questionsAskedByCustomer: [args.knowledgeCase.question],
      confidence: 0.96,
    }),
  });

  return {
    caseId: args.knowledgeCase.id,
    stateName: args.stateName,
    exampleIndex: args.exampleIndex,
    message: args.message,
    responseText: result.responseDraft ?? "",
    responseKey: result.decisionTrace?.responseKey,
    replyType: result.decisionTrace?.replyType,
    nextStep: result.nextStep,
    pendingUserAction: result.pendingUserAction,
    bookingConfirmed: result.bookingConfirmed,
    handoffReason: result.handoffReason,
    requiredQuestion: result.replyContract?.requiredQuestion,
    toolCalls: result.toolObservations.map((observation) => observation.toolName),
  } satisfies MatrixResult;
}

async function main() {
  if (!existsSync(casesPath)) {
    throw new Error(`Knowledge cases file not found: ${casesPath}`);
  }
  if (!existsSync(presetsPath)) {
    throw new Error(`State presets file not found: ${presetsPath}`);
  }

  const knowledgeCases = parseJsonFile<KnowledgeCasesFile>(casesPath);
  const presets = parseJsonFile<StatePresetsFile>(presetsPath);
  const results: MatrixResult[] = [];

  for (const knowledgeCase of knowledgeCases.cases) {
    const states = knowledgeCase.states ?? matrixStates;

    for (const stateName of states) {
      const preset = presets.presets[stateName];
      if (!preset) {
        throw new Error(`State preset not found: ${stateName}`);
      }

      for (const [exampleIndex, message] of knowledgeCase.questionExamples.entries()) {
        const matrixResult = await runMatrixCase({
          knowledgeCase,
          stateName,
          previousState: preset.state ?? {},
          message,
          exampleIndex,
        });
        assertMatrixResult(matrixResult, knowledgeCase);
        results.push(matrixResult);
      }
    }
  }

  console.log(
    `${results.length} wedding knowledge matrix cases passed across ${knowledgeCases.cases.length} knowledge topics.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
