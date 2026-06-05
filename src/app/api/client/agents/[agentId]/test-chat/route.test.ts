import assert from "node:assert/strict";
import test from "node:test";

import { MessageRole } from "@prisma/client";

import { sanitizeClientTestChatResponse } from "./redaction";

test("client test chat redacts raw tool params while preserving safe trace and hidden state", () => {
  const sanitized = sanitizeClientTestChatResponse({
    message: "Done",
    promptPreview: "langgraph_wedding_sales",
    usedTooling: ["check_wedding_availability"],
    historyAppend: [
      {
        role: MessageRole.TOOL,
        content: "{}",
        toolName: "check_wedding_availability",
        toolResult: {
          integration: "GOOGLE_SHEETS",
          mode: "live",
          status: "available",
          spreadsheetId: "secret-sheet-id",
          params: { spreadsheetId: "secret-sheet-id" },
          request: "customer private message",
          summary: "Wedding date is available.",
        },
      },
      {
        role: MessageRole.TOOL,
        content: "{}",
        toolName: "__wedding_sales_state",
        toolResult: {
          state: {
            channel: "instagram",
            leadStage: "availability_checked",
            names: "Rachel and Mike",
            toolObservations: [
              {
                toolName: "check_wedding_availability",
                result: JSON.stringify({ params: { spreadsheetId: "secret-sheet-id" } }),
              },
            ],
            turnToolObservations: [
              {
                toolName: "check_wedding_availability",
                result: JSON.stringify({ params: { spreadsheetId: "secret-sheet-id" } }),
              },
            ],
          },
        },
      },
    ],
  });

  const visibleTool = sanitized.historyAppend?.[0];
  const hiddenStateTool = sanitized.historyAppend?.[1];

  assert.deepEqual(visibleTool?.toolResult, {
    integration: "GOOGLE_SHEETS",
    mode: "live",
    status: "available",
    summary: "Wedding date is available.",
  });
  assert.doesNotMatch(visibleTool?.content ?? "", /secret-sheet-id/);
  assert.doesNotMatch(visibleTool?.content ?? "", /customer private message/);
  assert.doesNotMatch(hiddenStateTool?.content ?? "", /secret-sheet-id/);
  assert.match(hiddenStateTool?.content ?? "", /Rachel and Mike/);
});
