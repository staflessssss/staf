import { END, START, StateGraph } from "@langchain/langgraph";

import { defaultWeddingSalesConfig, type WeddingSalesConfig } from "./config";
import { analyzeWeddingSalesMessage } from "./nodes/analyze";
import { createWeddingSalesReplyNodes } from "./nodes/reply";
import {
  createInitialWeddingSalesState,
  WeddingSalesStateAnnotation,
  type WeddingSalesChannel,
  type WeddingSalesState,
} from "./state";

type WeddingSalesRoute =
  | "ask_missing_info"
  | "ask_wedding_year"
  | "check_availability"
  | "check_calendar"
  | "book_call"
  | "ignored";

export type InvokeWeddingSalesGraphInput = {
  channel: WeddingSalesChannel;
  message: string;
  previousState?: Partial<WeddingSalesState>;
  config?: Partial<WeddingSalesConfig>;
};

export function routeWeddingSalesState(state: WeddingSalesState): WeddingSalesRoute {
  switch (state.leadStage) {
    case "ignored":
      return "ignored";
    case "waiting_wedding_year":
      return "ask_wedding_year";
    case "ready_for_availability":
      return "check_availability";
    case "checking_calendar":
    case "call_proposed":
      return "check_calendar";
    case "ready_to_book":
      return "book_call";
    default:
      return "ask_missing_info";
  }
}

function mergeWeddingSalesConfig(config?: Partial<WeddingSalesConfig>): WeddingSalesConfig {
  return {
    ...defaultWeddingSalesConfig,
    ...config,
    pricing: {
      ...defaultWeddingSalesConfig.pricing,
      ...config?.pricing,
    },
    guide: {
      ...defaultWeddingSalesConfig.guide,
      ...config?.guide,
    },
    reviews: {
      ...defaultWeddingSalesConfig.reviews,
      ...config?.reviews,
    },
    coverage: {
      ...defaultWeddingSalesConfig.coverage,
      ...config?.coverage,
    },
    callBookingWindow: {
      ...defaultWeddingSalesConfig.callBookingWindow,
      ...config?.callBookingWindow,
    },
    channelFormatting: {
      ...defaultWeddingSalesConfig.channelFormatting,
      ...config?.channelFormatting,
    },
  };
}

export function buildWeddingSalesGraph(config?: Partial<WeddingSalesConfig>) {
  const resolvedConfig = mergeWeddingSalesConfig(config);
  const replyNodes = createWeddingSalesReplyNodes(resolvedConfig);

  return new StateGraph(WeddingSalesStateAnnotation)
    .addNode("analyze", analyzeWeddingSalesMessage)
    .addNode("ask_missing_info", replyNodes.askMissingInfo)
    .addNode("ask_wedding_year", replyNodes.askWeddingYear)
    .addNode("check_availability", replyNodes.checkAvailability)
    .addNode("check_calendar", replyNodes.checkCalendar)
    .addNode("book_call", replyNodes.bookCall)
    .addNode("ignored", replyNodes.ignored)
    .addEdge(START, "analyze")
    .addConditionalEdges("analyze", routeWeddingSalesState, {
      ask_missing_info: "ask_missing_info",
      ask_wedding_year: "ask_wedding_year",
      check_availability: "check_availability",
      check_calendar: "check_calendar",
      book_call: "book_call",
      ignored: "ignored",
    })
    .addEdge("ask_missing_info", END)
    .addEdge("ask_wedding_year", END)
    .addEdge("check_availability", END)
    .addEdge("check_calendar", END)
    .addEdge("book_call", END)
    .addEdge("ignored", END)
    .compile();
}

export async function invokeWeddingSalesGraph(input: InvokeWeddingSalesGraphInput) {
  const graph = buildWeddingSalesGraph(input.config);
  const initialState = createInitialWeddingSalesState({
    channel: input.channel,
    message: input.message,
    previousState: input.previousState,
  });

  return graph.invoke(initialState);
}
