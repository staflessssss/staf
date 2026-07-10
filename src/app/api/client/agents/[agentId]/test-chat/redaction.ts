import type { InvokeAgentResult, RuntimeHistoryMessage } from "@/lib/ai-runtime";

const HIDDEN_AGENT_STATE_TOOL_NAME = "__agent_state";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJsonRecord(value: string) {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function pickRecordFields(source: Record<string, unknown>, fields: string[]) {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    if (source[field] !== undefined) {
      acc[field] = source[field];
    }

    return acc;
  }, {});
}

function sanitizeAgentState(value: unknown) {
  const state = asRecord(value);

  if (!state) {
    return value;
  }

  return {
    ...pickRecordFields(state, [
      "channel",
      "leadStage",
      "names",
      "weddingDate",
      "weddingDateText",
      "weddingYear",
      "weddingYearKnown",
      "location",
      "venue",
      "customerEmail",
      "availability",
      "guideSent",
      "callProposed",
      "proposedCallTime",
      "calendarStatus",
      "bookingConfirmed",
      "bookedEventId",
      "conversationSummary",
      "assistantReplyCount",
      "hasGreeted",
      "signatureSent",
      "portfolioSent",
      "reviewsSent",
      "guideOffered",
      "askedForNames",
      "askedForWeddingYear",
      "askedForVenue",
      "askedForCallTime",
      "askedForEmail",
      "lastAssistantIntent",
      "pendingChangeField",
      "pendingChangeValue",
      "pendingChangeDisplay",
      "changeConfirmationRejected",
    ]),
    toolObservations: [],
    turnToolObservations: [],
  };
}

function sanitizeToolResult(value: unknown) {
  const result = asRecord(value);

  if (!result) {
    return value;
  }

  const sanitized = pickRecordFields(result, [
    "integration",
    "mode",
    "status",
    "action",
    "operation",
    "date",
    "time",
    "startTime",
    "endTime",
    "email",
    "coupleName",
    "weddingDate",
    "location",
    "channel",
    "available",
    "requestedDate",
    "region",
    "requestedRegion",
    "bookedCount",
    "capacity",
    "reason",
    "summary",
    "message",
    "result",
  ]);
  const leadLog = asRecord(result.leadLog);
  const telegramNotification = asRecord(result.telegramNotification);

  if (leadLog) {
    sanitized.leadLog = pickRecordFields(leadLog, ["status", "summary"]);
  }

  if (telegramNotification) {
    sanitized.telegramNotification = pickRecordFields(telegramNotification, ["status", "summary"]);
  }

  return sanitized;
}

function sanitizeHistoryEntryForClient(entry: RuntimeHistoryMessage): RuntimeHistoryMessage {
  if (entry.role !== "TOOL") {
    return entry;
  }

  const rawToolResult = entry.toolResult ?? parseJsonRecord(entry.content);

  if (entry.toolName === HIDDEN_AGENT_STATE_TOOL_NAME) {
    const stateWrapper = asRecord(rawToolResult);
    const sanitizedState = sanitizeAgentState(stateWrapper?.state ?? rawToolResult);
    const toolResult = { state: sanitizedState };

    return {
      ...entry,
      content: JSON.stringify(toolResult),
      toolResult,
    };
  }

  const toolResult = sanitizeToolResult(rawToolResult);

  return {
    ...entry,
    content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
    toolResult,
  };
}

export function sanitizeClientTestChatResponse(response: InvokeAgentResult): InvokeAgentResult {
  return {
    ...response,
    historyAppend: response.historyAppend?.map(sanitizeHistoryEntryForClient),
  };
}
