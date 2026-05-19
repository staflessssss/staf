import type { WeddingSalesConfig } from "../config";
import { composeHumanWeddingSalesResponse } from "../response-composer";
import type { WeddingSalesState } from "../state";

export function createWeddingSalesReplyNodes(config: WeddingSalesConfig) {
  return {
    askMissingInfo: async (state: WeddingSalesState) => ({
      responseDraft: await composeHumanWeddingSalesResponse({
        intent: "ask_missing_info",
        config,
        state,
      }),
    }),
    askWeddingYear: async (state: WeddingSalesState) => ({
      responseDraft: await composeHumanWeddingSalesResponse({
        intent: "ask_wedding_year",
        config,
        state,
      }),
    }),
    checkAvailability: async (state: WeddingSalesState) => ({
      responseDraft: await composeHumanWeddingSalesResponse({
        intent: "availability_tool_missing",
        config,
        state,
      }),
    }),
    checkCalendar: async (state: WeddingSalesState) => ({
      responseDraft: await composeHumanWeddingSalesResponse({
        intent: "calendar_time_missing",
        config,
        state,
      }),
    }),
    bookCall: async (state: WeddingSalesState) => ({
      responseDraft: await composeHumanWeddingSalesResponse({
        intent: "booking_tool_missing",
        config,
        state,
      }),
    }),
    ignored: async () => ({
      responseDraft: "",
    }),
  };
}
