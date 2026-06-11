import { analyzeWeddingSalesSemanticsV2 } from "@/lib/lang/graphs/wedding-sales/semantic-v2/analyzer";
import {
  evaluateSemanticV2Case,
  semanticV2EvalCases,
} from "@/lib/lang/graphs/wedding-sales/semantic-v2/evals";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for semantic-v2 evals.");
  }

  const results = [];

  for (const testCase of semanticV2EvalCases) {
    try {
      const analysis = await analyzeWeddingSalesSemanticsV2(testCase.state);
      results.push(evaluateSemanticV2Case({ testCase, analysis }));
    } catch (error) {
      results.push({
        id: testCase.id,
        passed: false,
        failures: [
          `analyzer error: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
    }
  }

  console.table(
    results.map((result) => ({
      case: result.id,
      status: result.passed ? "pass" : "fail",
      failures: result.failures.join(" | "),
    })),
  );

  if (results.some((result) => !result.passed)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
