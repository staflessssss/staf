import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { NormalizedWeddingSalesOutboundMessage } from "@/lib/agents/wedding-sales-simple/contracts";
import { buildChannelDeliveryPlan } from "@/lib/agents/wedding-sales-simple/delivery-plan";
import { buildSimpleWeddingKnowledgeContext } from "@/lib/lang/graphs/wedding-sales-simple/knowledge";
import { buildReplyActionContract } from "@/lib/lang/graphs/wedding-sales-simple/reply-contract";
import { updateSimpleWeddingReplyMemory } from "@/lib/lang/graphs/wedding-sales-simple/reply-memory";
import { writeConstrainedWeddingReply } from "@/lib/lang/graphs/wedding-sales-simple/reply-writer";
import { decideNextStep } from "@/lib/lang/graphs/wedding-sales-simple/decide";
import {
  createInitialSimpleWeddingSalesState,
  mergeTurnUnderstanding,
  type SimpleWeddingSalesState,
  type TurnUnderstanding,
} from "@/lib/lang/graphs/wedding-sales-simple/state";
import { understandTurnHeuristically, weddingSalesSimpleUnderstandTestHelpers } from "@/lib/lang/graphs/wedding-sales-simple/understand";
import { resolveWeddingSalesRegion, type WeddingSalesConfig } from "@/lib/lang/graphs/wedding-sales/config";

type FirstTurnCase = {
  id: string;
  message: string;
  expectedDate?: string;
  expectedLocation?: string;
  expectedRegion: "FL" | "NC_SC_GA" | "unknown";
  expectToolCall?: "check_wedding_availability";
  expectNoTool?: boolean;
  expectToolStatus?: "needs_region";
  forcedToolStatus?: "available" | "unavailable" | "needs_region" | "tool_error";
  expectAvailability?: "available" | "unavailable";
  expectGuide?: boolean;
  expectClarification?: boolean;
  expectAskDetails?: boolean;
  expectTeamAnswer?: boolean;
  expectToolError?: boolean;
  expectedResponseKey?: string;
  forbidTeam?: boolean;
  llmQuestions?: TurnUnderstanding["questionsAskedByCustomer"];
};

type CasesFile = {
  cases: FirstTurnCase[];
};

type MatrixResult = {
  scenario: string;
  userMessage: string;
  extractedDate?: string;
  extractedLocation?: string;
  resolvedRegion: "FL" | "NC_SC_GA" | "unknown";
  toolCalls: string[];
  toolResult?: string;
  mode: SimpleWeddingSalesState["mode"];
  nextStep: SimpleWeddingSalesState["nextStep"];
  handoffReason?: SimpleWeddingSalesState["handoffReason"];
  escalated: boolean;
  humanReviewRequired: boolean;
  responseKey?: string;
  outboundText: string;
  attachments: Array<{ type: string; purpose?: string; url: string }>;
  guardResult: unknown;
  passed: boolean;
  failures: string[];
};

const casesPath = path.join(process.cwd(), "tests", "wedding-sales-simple", "first-turn-lead-cases.yml");
const reportDir = path.join(process.cwd(), "reports", "wedding-dialogues", "latest");

function parseCases(): CasesFile {
  return JSON.parse(readFileSync(casesPath, "utf8")) as CasesFile;
}

function testConfig(): Partial<WeddingSalesConfig> {
  return {
    pricing: {
      startPrice: "$2,800",
      currency: "USD",
      coverageHours: 8,
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
    guide: {
      imageUrl: "https://example.com/fl-guide.png",
      fileName: "Collections guide",
    },
    guidesByRegion: {
      FL: {
        imageUrl: "https://example.com/fl-guide.png",
        fileName: "FL Collections guide",
      },
      NC_SC_GA: {
        imageUrl: "https://example.com/nc-sc-ga-guide.png",
        fileName: "NC SC GA Collections guide",
      },
    },
  };
}

function applyDecision(state: SimpleWeddingSalesState): SimpleWeddingSalesState {
  const decision = decideNextStep(state);

  return {
    ...state,
    ...decision.statePatch,
    nextStep: decision.nextStep,
    missingField: decision.missingField,
    mode: decision.mode ?? state.mode,
    handoffReason: decision.handoffReason,
    decisionTrace: decision.trace,
  };
}

function statusPayload(args: {
  status: NonNullable<SimpleWeddingSalesState["availabilityToolStatus"]>;
  region: "FL" | "NC_SC_GA" | "unknown";
  date?: string;
}) {
  if (args.status === "needs_region") {
    return {
      status: "needs_region",
      supportedRegions: ["FL", "NC/SC/GA"],
      summary: "This capacity availability function needs a region that matches one configured capacity rule.",
    };
  }

  if (args.status === "tool_error") {
    return {
      status: "missing_credentials",
      summary: "Forced test tool error.",
    };
  }

  return {
    status: args.status,
    date: args.date,
    requestedDate: args.date,
    region: args.region === "NC_SC_GA" ? "NC/SC/GA" : args.region,
    requestedRegion: args.region === "NC_SC_GA" ? "NC/SC/GA" : args.region,
    available: args.status === "available",
    summary: `Forced test availability ${args.status}.`,
  };
}

function forceAvailabilityResult(
  state: SimpleWeddingSalesState,
  status: NonNullable<SimpleWeddingSalesState["availabilityToolStatus"]>,
): SimpleWeddingSalesState {
  const region = (resolveWeddingSalesRegion(state) ?? "unknown") as "FL" | "NC_SC_GA" | "unknown";
  const availability =
    status === "available"
      ? "available"
      : status === "unavailable"
        ? "unavailable"
        : "unknown";
  const result = statusPayload({
    status,
    region,
    date: state.weddingDate,
  });

  return {
    ...state,
    availability,
    serviceRegion: region,
    availabilityToolStatus: status,
    availabilityRegion: region === "unknown" ? undefined : region,
    availabilityContextDate: state.weddingDate,
    availabilityCheck: state.weddingDate
      ? {
          date: state.weddingDate,
          location: state.location,
          status: availability,
          checkedAt: "2026-06-30T00:00:00.000Z",
        }
      : undefined,
    toolObservations: [
      ...state.toolObservations,
      {
        toolName: "check_wedding_availability",
        result: JSON.stringify(result),
      },
    ],
  };
}

function buildUnderstanding(state: SimpleWeddingSalesState, testCase: FirstTurnCase): TurnUnderstanding {
  if (!testCase.llmQuestions) {
    return understandTurnHeuristically(state);
  }

  const heuristic = understandTurnHeuristically(state);

  return weddingSalesSimpleUnderstandTestHelpers.normalizeLlmUnderstanding(state, {
    customerMessageType: heuristic.customerMessageType,
    facts: {
      customerName: heuristic.facts.customerName ?? null,
      partnerName: heuristic.facts.partnerName ?? null,
      weddingDate: heuristic.facts.weddingDate ?? null,
      weddingDateText: heuristic.facts.weddingDateText ?? null,
      location: heuristic.facts.location ?? null,
      venue: heuristic.facts.venue ?? null,
      email: heuristic.facts.email ?? null,
      proposedCallTime: heuristic.facts.proposedCallTime ?? null,
      senderRole: heuristic.facts.senderRole ?? null,
    },
    questionsAskedByCustomer: testCase.llmQuestions,
    confidence: 0.9,
  });
}

function attachmentList(
  state: SimpleWeddingSalesState,
  knowledge: ReturnType<typeof buildSimpleWeddingKnowledgeContext>,
): NonNullable<NormalizedWeddingSalesOutboundMessage["attachments"]> {
  if (state.replyContract?.mentionPolicy.guide.mode !== "send_attachment") {
    return [];
  }

  if (knowledge.guide.imageUrl) {
    return [
      {
        type: "image" as const,
        url: knowledge.guide.imageUrl,
        label: knowledge.guide.fileName ?? "Collections guide",
        purpose: "pricing_guide" as const,
      },
    ];
  }

  if (knowledge.guide.link) {
    return [
      {
        type: "link" as const,
        url: knowledge.guide.link,
        label: "Collections guide",
        purpose: "pricing_guide" as const,
      },
    ];
  }

  return [];
}

function runCase(testCase: FirstTurnCase): MatrixResult {
  const failures: string[] = [];
  let state = createInitialSimpleWeddingSalesState({
    channel: "instagram",
    message: testCase.message,
    tenantId: "tenant-first-turn-matrix",
    agentId: "agent-first-turn-matrix",
    contactId: testCase.id,
  });
  const understanding = buildUnderstanding(state, testCase);
  state = applyDecision(mergeTurnUnderstanding(state, understanding));

  const expectedRegion = testCase.expectedRegion === "unknown" ? undefined : testCase.expectedRegion;
  const resolvedRegion = resolveWeddingSalesRegion(state) ?? "unknown";
  const shouldForceTool =
    Boolean(testCase.forcedToolStatus) ||
    state.nextStep === "check_availability";

  if (shouldForceTool) {
    const status =
      testCase.forcedToolStatus ??
      testCase.expectToolStatus ??
      (expectedRegion ? "available" : "needs_region");
    state = forceAvailabilityResult(state, status);
    state = applyDecision(state);
    state = {
      ...state,
      decisionTrace: state.decisionTrace
        ? {
            ...state.decisionTrace,
            toolCalled: "checkAvailability",
          }
        : undefined,
    };
  }

  const config = testConfig();
  const knowledge = buildSimpleWeddingKnowledgeContext({
    channel: "instagram",
    config,
    state,
  });
  const contract = buildReplyActionContract({ state, knowledge });
  state = {
    ...state,
    replyContract: contract,
    decisionTrace: state.decisionTrace
      ? {
          ...state.decisionTrace,
          responseKey: contract.responseKey ?? state.decisionTrace.responseKey,
        }
      : state.decisionTrace,
  };
  const reply = writeConstrainedWeddingReply({
    state,
    knowledge,
    contract,
  });
  state = {
    ...state,
    responseDraft: reply.text,
    replyGuardResult: reply.guardResult,
    writer: reply.writer,
    writerCatalog: reply.writerCatalog,
  };
  state = {
    ...state,
    replyMemory: updateSimpleWeddingReplyMemory({
      state,
      contract,
      knowledge,
      replyText: reply.text,
      writer: reply.writer,
    }),
  };
  const attachments = attachmentList(state, knowledge);
  const deliveryPlan = buildChannelDeliveryPlan({
    channel: "instagram",
    outboundText: reply.text,
    replyContract: contract,
    attachments,
    conversationId: testCase.id,
    turnId: "turn-1",
    channelConfig: {
      delivery: {
        enableInstagramSemanticDeliveryPlan: true,
      },
    },
  });

  const toolCalls = state.toolObservations.map((entry) => entry.toolName);
  const toolResult = state.toolObservations.at(-1)?.result;
  const responseKey = state.replyContract?.responseKey ?? state.decisionTrace?.responseKey;
  const escalated =
    state.mode === "human_needed" ||
    state.mode === "bot_paused" ||
    state.nextStep === "handoff";
  const humanReviewRequired = state.availabilityToolStatus === "tool_error";

  if (testCase.expectedDate) {
    if (state.weddingDate !== testCase.expectedDate) {
      failures.push(`date expected ${testCase.expectedDate}, got ${state.weddingDate ?? "none"}`);
    }
  }

  if (testCase.expectedLocation) {
    if (!new RegExp(testCase.expectedLocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(state.location ?? "")) {
      failures.push(`location expected ${testCase.expectedLocation}, got ${state.location ?? "none"}`);
    }
  }

  if ((state.serviceRegion ?? resolvedRegion) !== testCase.expectedRegion) {
    failures.push(`region expected ${testCase.expectedRegion}, got ${state.serviceRegion ?? resolvedRegion}`);
  }

  if (testCase.expectNoTool && toolCalls.length > 0) {
    failures.push(`expected no tool calls, got ${toolCalls.join(", ")}`);
  }

  if (testCase.expectToolCall && !toolCalls.includes(testCase.expectToolCall)) {
    failures.push(`expected tool call ${testCase.expectToolCall}`);
  }

  if (testCase.expectAvailability && state.availability !== testCase.expectAvailability) {
    failures.push(`availability expected ${testCase.expectAvailability}, got ${state.availability ?? "none"}`);
  }

  if (testCase.expectClarification) {
    if (state.nextStep !== "ask_missing_info" || state.missingField !== "location") {
      failures.push(`expected region/location clarification, got ${state.nextStep}/${state.missingField ?? "none"}`);
    }

    if (!/FL or NC\/SC\/GA|city or area|confirm/i.test(reply.text)) {
      failures.push("clarification text missing supported region prompt");
    }
  }

  if (testCase.expectAskDetails && !/date and location|date are you|wedding date|city/i.test(reply.text)) {
    failures.push("expected date/location qualification question");
  }

  if (testCase.expectGuide && !attachments.some((attachment) => attachment.purpose === "pricing_guide")) {
    failures.push("expected pricing guide attachment");
  }

  if (testCase.expectedResponseKey && responseKey !== testCase.expectedResponseKey) {
    failures.push(`responseKey expected ${testCase.expectedResponseKey}, got ${responseKey ?? "none"}`);
  }

  if (testCase.expectTeamAnswer && state.decisionTrace?.replyType !== "team_answer" && !contract.mustAnswerTeam) {
    failures.push("expected team answer");
  }

  if (
    testCase.expectTeamAnswer &&
    testCase.expectedRegion === "unknown" &&
    /\b(?:Jay|Tampa|Florida weddings|lead filmmaker in Tampa)\b/i.test(reply.text)
  ) {
    failures.push("unknown-region team answer mentioned Jay/Tampa");
  }

  if (
    testCase.expectTeamAnswer &&
    testCase.expectedRegion === "unknown" &&
    (reply.text.match(/\b(?:what\s+(?:wedding\s+)?date|date\s+(?:and|or)\s+(?:city|location)|city\s+(?:and|or)\s+date)\b/gi)?.length ?? 0) > 1
  ) {
    failures.push("unknown-region team answer asked for date/city more than once");
  }

  if (testCase.forbidTeam && /Jay|lead filmmaker in Tampa|Florida weddings/i.test(reply.text)) {
    failures.push("forbidden team/Tampa copy appeared");
  }

  if (
    (state.availabilityToolStatus === "needs_region" || state.availabilityToolStatus === "tool_error") &&
    /not open|not available|unavailable|fully booked/i.test(reply.text)
  ) {
    failures.push("false unavailable language appeared for non-final tool status");
  }

  if (!testCase.expectToolError && !/hi|hello|thanks so much|thank you/i.test(reply.text)) {
    failures.push("first-turn greeting missing");
  }

  if (!testCase.expectTeamAnswer && !testCase.expectToolError && state.mode !== "bot_active") {
    failures.push(`normal first-turn lead changed mode to ${state.mode}`);
  }

  const normalFirstTurnLead = !testCase.expectToolError;

  if (normalFirstTurnLead && escalated) {
    failures.push("normal first-turn lead escalated");
  }

  if (normalFirstTurnLead && state.mode === "bot_paused") {
    failures.push("normal first-turn lead paused the bot");
  }

  if (normalFirstTurnLead && responseKey === "utter_handoff_ack") {
    failures.push("normal first-turn lead used handoff acknowledgement");
  }

  if (reply.writer.mode === "deterministic_fallback" && !testCase.expectToolError && !testCase.expectTeamAnswer) {
    failures.push("unexpected deterministic fallback writer");
  }

  if (testCase.expectToolError && state.availabilityToolStatus !== "tool_error") {
    failures.push(`expected tool_error, got ${state.availabilityToolStatus ?? "none"}`);
  }

  if (testCase.expectToolError) {
    if (escalated) {
      failures.push("first-turn tool_error escalated instead of staying resumable");
    }

    if (state.mode !== "bot_active") {
      failures.push(`first-turn tool_error changed mode to ${state.mode}`);
    }

    if (responseKey === "utter_handoff_ack") {
      failures.push("first-turn tool_error used handoff acknowledgement");
    }

    if (!humanReviewRequired) {
      failures.push("first-turn tool_error did not mark human review required");
    }

    if (!/having trouble checking availability|double-check availability/i.test(reply.text)) {
      failures.push("first-turn tool_error did not send soft availability check copy");
    }

    if (!/Raleigh/i.test(reply.text)) {
      failures.push("first-turn tool_error did not mention Raleigh");
    }

    if (!/October 3, 2026/i.test(reply.text)) {
      failures.push("first-turn tool_error did not mention October 3, 2026");
    }

    if (!/don(?:'|’|`)t want to guess|do not want to guess/i.test(reply.text)) {
      failures.push("first-turn tool_error did not say it would not guess");
    }

    if (!/\$3,600/.test(reply.text) || !/NC\/SC\/GA/i.test(reply.text)) {
      failures.push("first-turn tool_error did not mention NC/SC/GA pricing");
    }

    if (!/\b(names?|both of your names)\b/i.test(reply.text)) {
      failures.push("first-turn tool_error did not ask names");
    }

    if (!attachments.some((attachment) => attachment.purpose === "pricing_guide")) {
      failures.push("first-turn tool_error did not include pricing guide attachment");
    }
  }

  const guardOk = state.replyGuardResult?.ok ?? false;

  if (!guardOk) {
    failures.push(`reply guard failed: ${JSON.stringify(state.replyGuardResult)}`);
  }

  const result: MatrixResult = {
    scenario: testCase.id,
    userMessage: testCase.message,
    extractedDate: state.weddingDate,
    extractedLocation: state.location,
    resolvedRegion: (state.serviceRegion ?? resolvedRegion) as MatrixResult["resolvedRegion"],
    toolCalls,
    toolResult,
    mode: state.mode,
    nextStep: state.nextStep,
    handoffReason: state.handoffReason,
    escalated,
    humanReviewRequired,
    responseKey,
    outboundText: reply.text,
    attachments,
    guardResult: state.replyGuardResult,
    passed: failures.length === 0,
    failures,
  };

  void deliveryPlan;

  return result;
}

function escapeHtml(value: string | undefined) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeReports(results: MatrixResult[]) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(path.join(reportDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);

  const markdown = [
    "# Wedding First-Turn Lead Matrix",
    "",
    `Passed: ${results.filter((result) => result.passed).length}/${results.length}`,
    "",
    "| Scenario | User message | Date | Location | Region | Tool | Mode | Next step | Handoff | Escalated | Human review | Response key | Attachments | Guard | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...results.map((result) =>
      [
        result.scenario,
        result.userMessage.replace(/\|/g, "\\|"),
        result.extractedDate ?? "",
        result.extractedLocation ?? "",
        result.resolvedRegion,
        result.toolCalls.join(", "),
        result.mode,
        result.nextStep,
        result.handoffReason ?? "",
        result.escalated ? "yes" : "no",
        result.humanReviewRequired ? "yes" : "no",
        result.responseKey ?? "",
        result.attachments.map((attachment) => attachment.purpose ?? attachment.type).join(", "),
        (JSON.stringify(result.guardResult) ?? "").replace(/\|/g, "\\|"),
        result.passed ? "PASS" : `FAIL: ${result.failures.join("; ").replace(/\|/g, "\\|")}`,
      ].join(" | "),
    ),
    "",
    "## Outbound Text",
    "",
    ...results.flatMap((result) => [
      `### ${result.scenario}`,
      "",
      "```text",
      result.outboundText,
      "```",
      "",
    ]),
  ].join("\n");
  writeFileSync(path.join(reportDir, "report.md"), markdown);

  const htmlRows = results
    .map((result) => `
      <tr class="${result.passed ? "pass" : "fail"}">
        <td>${escapeHtml(result.scenario)}</td>
        <td>${escapeHtml(result.userMessage)}</td>
        <td>${escapeHtml(result.extractedDate ?? "")}</td>
        <td>${escapeHtml(result.extractedLocation ?? "")}</td>
        <td>${escapeHtml(result.resolvedRegion)}</td>
        <td>${escapeHtml(result.toolCalls.join(", "))}</td>
        <td>${escapeHtml(result.toolResult ?? "")}</td>
        <td>${escapeHtml(result.mode)}</td>
        <td>${escapeHtml(result.nextStep)}</td>
        <td>${escapeHtml(result.handoffReason ?? "")}</td>
        <td>${result.escalated ? "yes" : "no"}</td>
        <td>${result.humanReviewRequired ? "yes" : "no"}</td>
        <td>${escapeHtml(result.responseKey ?? "")}</td>
        <td><pre>${escapeHtml(result.outboundText)}</pre></td>
        <td>${escapeHtml(result.attachments.map((attachment) => `${attachment.type}:${attachment.purpose ?? ""}`).join(", "))}</td>
        <td>${escapeHtml(JSON.stringify(result.guardResult))}</td>
        <td>${result.passed ? "PASS" : escapeHtml(result.failures.join("; "))}</td>
      </tr>`)
    .join("\n");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Wedding First-Turn Lead Matrix</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #171717; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
    th { background: #f4f4f4; position: sticky; top: 0; }
    tr.pass { background: #f6fff6; }
    tr.fail { background: #fff6f6; }
    pre { white-space: pre-wrap; margin: 0; max-width: 420px; }
  </style>
</head>
<body>
  <h1>Wedding First-Turn Lead Matrix</h1>
  <p>Passed: ${results.filter((result) => result.passed).length}/${results.length}</p>
  <table>
    <thead>
      <tr>
        <th>Scenario</th>
        <th>User message</th>
        <th>Date</th>
        <th>Location</th>
        <th>Region</th>
        <th>Tool calls</th>
        <th>Tool result</th>
        <th>Mode</th>
        <th>Next step</th>
        <th>Handoff</th>
        <th>Escalated</th>
        <th>Human review</th>
        <th>Response key</th>
        <th>Outbound text</th>
        <th>Attachments</th>
        <th>Guard</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>${htmlRows}</tbody>
  </table>
</body>
</html>
`;
  writeFileSync(path.join(reportDir, "index.html"), html);
}

function main() {
  const results = parseCases().cases.map((testCase) => {
    try {
      return runCase(testCase);
    } catch (error) {
      return {
        scenario: testCase.id,
        userMessage: testCase.message,
        resolvedRegion: "unknown",
        toolCalls: [],
        mode: "bot_active",
        nextStep: "reply_only",
        escalated: false,
        humanReviewRequired: false,
        outboundText: "",
        attachments: [],
        guardResult: undefined,
        passed: false,
        failures: [error instanceof Error ? error.stack ?? error.message : String(error)],
      } satisfies MatrixResult;
    }
  });
  writeReports(results);
  const failed = results.filter((result) => !result.passed);

  if (failed.length > 0) {
    for (const result of failed) {
      console.error(`${result.scenario}: ${result.failures.join("; ")}`);
    }

    console.error(`Wedding first-turn matrix failed: ${failed.length}/${results.length}. See ${reportDir}`);
    process.exitCode = 1;
    return;
  }

  console.log(`${results.length} wedding first-turn lead matrix cases passed. Report: ${reportDir}`);
}

main();
