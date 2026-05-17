import { MessageRole } from "@prisma/client";

import { invokeAgent, type RuntimeHistoryMessage } from "@/lib/ai-runtime";
import {
  evaluateWeddingSalesCase,
  weddingSalesStressCases,
  type WeddingSalesEvalResult,
  type WeddingSalesEvalRuntime,
} from "@/lib/lang/graphs/wedding-sales/evals/stress-cases";

function readRuntime(): WeddingSalesEvalRuntime {
  const runtime = process.env.WEDDING_SALES_EVAL_RUNTIME;

  if (runtime === "langgraph_wedding_sales") {
    return runtime;
  }

  return "legacy";
}

function mapHistory(history: NonNullable<(typeof weddingSalesStressCases)[number]["input"]["history"]>): RuntimeHistoryMessage[] {
  return history.map((entry) => ({
    role: entry.role === "ASSISTANT" ? MessageRole.ASSISTANT : MessageRole.USER,
    content: entry.content,
  }));
}

async function runLegacyCase(args: {
  tenantId: string;
  agentId: string;
  testCase: (typeof weddingSalesStressCases)[number];
}) {
  return invokeAgent({
    tenantId: args.tenantId,
    agentId: args.agentId,
    allowDraftAgent: true,
    testMode: true,
    channel: "GMAIL",
    contactId: args.testCase.input.contactId,
    contactEmail: args.testCase.input.contactId,
    message: args.testCase.input.message,
    historyMessages: mapHistory(args.testCase.input.history ?? []),
  });
}

async function main() {
  const tenantId = process.env.WEDDING_SALES_EVAL_TENANT_ID;
  const agentId = process.env.WEDDING_SALES_EVAL_AGENT_ID;
  const runtime = readRuntime();

  if (!tenantId || !agentId) {
    console.log(
      "Skipping wedding_sales evals: set WEDDING_SALES_EVAL_TENANT_ID and WEDDING_SALES_EVAL_AGENT_ID to run against a local agent.",
    );
    return;
  }

  const results: WeddingSalesEvalResult[] = [];

  for (const testCase of weddingSalesStressCases) {
    if (runtime === "langgraph_wedding_sales") {
      results.push({
        caseId: testCase.id,
        runtime,
        passed: false,
        failures: ["LangGraph runtime is not wired to the eval runner yet."],
        skipped: true,
      });
      continue;
    }

    const result = await runLegacyCase({ tenantId, agentId, testCase });
    results.push(
      evaluateWeddingSalesCase({
        testCase,
        runtime,
        response: result.message,
        usedTooling: result.usedTooling,
      }),
    );
  }

  const failed = results.filter((result) => !result.passed && !result.skipped);

  console.table(
    results.map((result) => ({
      case: result.caseId,
      runtime: result.runtime,
      status: result.skipped ? "skipped" : result.passed ? "pass" : "fail",
      failures: result.failures.join(" | "),
    })),
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
