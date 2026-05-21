import { END, START, StateGraph } from "@langchain/langgraph";

import { buildLangGraphThreadId, getLangGraphPostgresSaver } from "@/lib/lang/checkpointing";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

import { defaultWeddingSalesConfig, type WeddingSalesConfig } from "./config";
import { analyzeWeddingSalesMessage } from "./nodes/analyze";
import { createWeddingSalesReplyNodes } from "./nodes/reply";
import { createWeddingSalesToolNodes } from "./nodes/tools";
import {
  createInitialWeddingSalesState,
  WeddingSalesStateAnnotation,
  type WeddingSalesChannel,
  type WeddingSalesState,
} from "./state";

type WeddingSalesRoute =
  | "ask_missing_info"
  | "ask_wedding_year"
  | "answer_question"
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
  toolContext?: WeddingSalesToolContext | null;
  checkpoint?: boolean;
};

export function routeWeddingSalesState(state: WeddingSalesState): WeddingSalesRoute {
  switch (state.leadStage) {
    case "ignored":
      return "ignored";
    case "waiting_wedding_year":
      return "ask_wedding_year";
    case "answering_question":
      return "answer_question";
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
  toolContext?: WeddingSalesToolContext | null;
  checkpointer?: Awaited<ReturnType<typeof getLangGraphPostgresSaver>>;
} = {}) {
  const { config, toolContext, checkpointer } = args;
  const resolvedConfig = mergeWeddingSalesConfig(config);
  const replyNodes = createWeddingSalesReplyNodes(resolvedConfig);
  const toolNodes = createWeddingSalesToolNodes({
    config: resolvedConfig,
    toolContext,
  });

  const workflow = new StateGraph(WeddingSalesStateAnnotation)
    .addNode("analyze", analyzeWeddingSalesMessage)
    .addNode("ask_missing_info", replyNodes.askMissingInfo)
    .addNode("ask_wedding_year", replyNodes.askWeddingYear)
    .addNode("answer_question", replyNodes.answerQuestion)
    .addNode("check_availability", toolNodes.checkAvailability)
    .addNode("check_calendar", toolNodes.checkCalendar)
    .addNode("book_call", toolNodes.bookCall)
    .addNode("ignored", replyNodes.ignored)
    .addEdge(START, "analyze")
    .addConditionalEdges("analyze", routeWeddingSalesState, {
      ask_missing_info: "ask_missing_info",
      ask_wedding_year: "ask_wedding_year",
      answer_question: "answer_question",
      check_availability: "check_availability",
      check_calendar: "check_calendar",
      book_call: "book_call",
      ignored: "ignored",
    })
    .addEdge("ask_missing_info", END)
    .addEdge("ask_wedding_year", END)
    .addEdge("answer_question", END)
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
    toolContext: input.toolContext,
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

  const graphInput =
    configurable && !input.previousState
      ? {
          channel: input.channel,
          latestCustomerMessage: input.message,
          toolObservations: [],
          turnToolObservations: [],
        }
      : initialState;

  return graph.invoke(graphInput, configurable ? { configurable } : undefined);
}
