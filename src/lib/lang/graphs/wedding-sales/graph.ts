import { END, START, StateGraph } from "@langchain/langgraph";

import { buildLangGraphThreadId, getLangGraphPostgresSaver } from "@/lib/lang/checkpointing";

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
  tenantId?: string;
  agentId?: string;
  contactId?: string;
  previousState?: Partial<WeddingSalesState>;
  config?: Partial<WeddingSalesConfig>;
  checkpoint?: boolean;
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

export function buildWeddingSalesGraph(args: {
  config?: Partial<WeddingSalesConfig>;
  checkpointer?: Awaited<ReturnType<typeof getLangGraphPostgresSaver>>;
} = {}) {
  const { config, checkpointer } = args;
  const resolvedConfig = mergeWeddingSalesConfig(config);
  const replyNodes = createWeddingSalesReplyNodes(resolvedConfig);

  const workflow = new StateGraph(WeddingSalesStateAnnotation)
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
    .addEdge("ignored", END);

  return workflow.compile(checkpointer ? { checkpointer } : undefined);
}

export async function invokeWeddingSalesGraph(input: InvokeWeddingSalesGraphInput) {
  const checkpointer = input.checkpoint ? await getLangGraphPostgresSaver() : null;
  const graph = buildWeddingSalesGraph({
    config: input.config,
    checkpointer,
  });
  const initialState = createInitialWeddingSalesState({
    channel: input.channel,
    message: input.message,
    previousState: input.previousState,
  });

  const configurable =
    input.checkpoint && input.tenantId && input.agentId && input.contactId
      ? {
          thread_id: buildLangGraphThreadId({
            tenantId: input.tenantId,
            agentId: input.agentId,
            contactId: input.contactId,
          }),
        }
      : undefined;

  return graph.invoke(initialState, configurable ? { configurable } : undefined);
}
