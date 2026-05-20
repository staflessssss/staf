import type { WeddingSalesConfig } from "../config";
import { buildWeddingSalesConversationSummary } from "../memory";
import { buildWeddingSalesDialogPolicy, getWeddingSalesBehavioralStateUpdate } from "../policy";
import { composeHumanWeddingSalesResponse } from "../response-composer";
import type { WeddingSalesResponseIntent } from "../response-composer";
import type { WeddingSalesState } from "../state";

async function composeReplyUpdate(args: {
  intent: WeddingSalesResponseIntent;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
}) {
  const policy = buildWeddingSalesDialogPolicy(args);
  const responseDraft = await composeHumanWeddingSalesResponse({ ...args, policy });
  const behavioralUpdate = getWeddingSalesBehavioralStateUpdate({ ...args, policy });
  const nextState = {
    ...args.state,
    ...behavioralUpdate,
    responseDraft,
  };

  return {
    responseDraft,
    ...behavioralUpdate,
    conversationSummary: buildWeddingSalesConversationSummary({
      state: nextState,
      intent: args.intent,
    }),
  };
}

export function createWeddingSalesReplyNodes(config: WeddingSalesConfig) {
  return {
    askMissingInfo: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "ask_missing_info",
        config,
        state,
      }),
    askWeddingYear: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "ask_wedding_year",
        config,
        state,
      }),
    answerQuestion: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "answer_question",
        config,
        state,
      }),
    checkAvailability: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "availability_tool_missing",
        config,
        state,
      }),
    checkCalendar: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "calendar_time_missing",
        config,
        state,
      }),
    bookCall: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "booking_tool_missing",
        config,
        state,
      }),
    ignored: async () => ({
      responseDraft: "",
    }),
  };
}
