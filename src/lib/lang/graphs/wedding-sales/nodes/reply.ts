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
    askLocationOrVenue: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "ask_location_or_venue",
        config,
        state,
      }),
    askWeddingYear: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "ask_wedding_year",
        config,
        state,
      }),
    confirmChange: async (state: WeddingSalesState) => {
      const responseDraft = state.changeConfirmationRejected
        ? "Got it, I’ll keep the previous details. What should I update instead?"
        : state.pendingChangeField === "location"
          ? `Just to confirm, do you mean ${state.pendingChangeDisplay ?? state.pendingChangeValue} is the updated wedding location?`
          : `Just to confirm, is ${state.pendingChangeDisplay ?? state.pendingChangeValue} your updated wedding date?`;

      return {
        responseDraft,
        assistantReplyCount: state.assistantReplyCount + 1,
        lastAssistantIntent: "confirm_change",
        conversationSummary: buildWeddingSalesConversationSummary({
          state: {
            ...state,
            responseDraft,
            assistantReplyCount: state.assistantReplyCount + 1,
            lastAssistantIntent: "confirm_change",
          },
          intent: "ask_missing_info",
        }),
      };
    },
    answerQuestion: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "answer_question",
        config,
        state,
      }),
    askCallTime: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "ask_call_time",
        config,
        state,
      }),
    askEmail: async (state: WeddingSalesState) =>
      composeReplyUpdate({
        intent: "ask_email",
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
