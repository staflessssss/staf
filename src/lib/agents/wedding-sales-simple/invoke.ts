import {
  invokeWeddingSalesSimpleGraph,
  type InvokeWeddingSalesSimpleGraphInput,
} from "@/lib/lang/graphs/wedding-sales-simple/graph";
import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";
import {
  buildSimpleWeddingKnowledgeContext,
  type SimpleWeddingKnowledgeContext,
  type SimpleWeddingKnowledgeFeature,
} from "@/lib/lang/graphs/wedding-sales-simple/knowledge";
import type { WeddingSalesConfig } from "@/lib/lang/graphs/wedding-sales/config";

import type {
  NormalizedWeddingSalesIncomingMessage,
  NormalizedWeddingSalesOutboundMessage,
  WeddingSalesSimpleCanaryTarget,
  WeddingSalesSimpleRuntime,
  WeddingSalesSimpleSafetyLogEntry,
} from "./contracts";
import { buildWeddingSalesSimpleOutbound } from "./outbound";

export type WeddingSalesSimpleInvokeResult =
  | {
      status: "processed";
      outbound: NormalizedWeddingSalesOutboundMessage;
      state: SimpleWeddingSalesState;
    }
  | {
      status: "duplicate";
      outbound: null;
      state?: Partial<SimpleWeddingSalesState>;
    };

export type WeddingSalesSimpleInvokeDeps = {
  hasProcessedIncoming?: (args: {
    channel: "instagram" | "gmail";
    conversationId: string;
    incomingMessageId: string;
  }) => Promise<boolean> | boolean;
  markProcessedIncoming?: (args: {
    channel: "instagram" | "gmail";
    conversationId: string;
    incomingMessageId: string;
  }) => Promise<void> | void;
  loadState?: (
    incoming: NormalizedWeddingSalesIncomingMessage,
  ) => Promise<Partial<SimpleWeddingSalesState> | undefined> | Partial<SimpleWeddingSalesState> | undefined;
  saveState?: (args: {
    incoming: NormalizedWeddingSalesIncomingMessage;
    state: SimpleWeddingSalesState;
  }) => Promise<void> | void;
  recordSafetyLog?: (entry: WeddingSalesSimpleSafetyLogEntry) => Promise<void> | void;
  invokeGraph?: (
    input: InvokeWeddingSalesSimpleGraphInput,
  ) => Promise<SimpleWeddingSalesState> | SimpleWeddingSalesState;
};

export function resolveWeddingSalesRuntimeForCanary(args: {
  incoming: Pick<NormalizedWeddingSalesIncomingMessage, "tenantId" | "agentId" | "channel">;
  canaryTargets: WeddingSalesSimpleCanaryTarget[];
}): WeddingSalesSimpleRuntime {
  return args.canaryTargets.some(
    (target) =>
      target.tenantId === args.incoming.tenantId &&
      target.agentId === args.incoming.agentId &&
      target.channel === args.incoming.channel,
  )
    ? "wedding-sales-simple"
    : "legacy";
}

function getProcessedIdentity(incoming: NormalizedWeddingSalesIncomingMessage) {
  if (!incoming.incomingMessageId) {
    return null;
  }

  return {
    channel: incoming.channel,
    conversationId: incoming.conversationId,
    incomingMessageId: incoming.incomingMessageId,
  };
}

function stateForPersistence(state: SimpleWeddingSalesState): SimpleWeddingSalesState {
  if (state.mode !== "human_needed") {
    return state;
  }

  return {
    ...state,
    mode: "bot_paused",
  };
}

function outboundAttachments(args: {
  text: string;
  knowledge?: SimpleWeddingKnowledgeContext;
  state?: SimpleWeddingSalesState;
}): NormalizedWeddingSalesOutboundMessage["attachments"] {
  const knowledge = args.knowledge;

  if (
    !knowledge ||
    args.state?.replyContract?.mentionPolicy.guide.mode !== "send_attachment" ||
    !/\b(?:guide|collections?|price)\b/i.test(args.text)
  ) {
    return undefined;
  }

  const attachments: NormalizedWeddingSalesOutboundMessage["attachments"] = [];

  if (knowledge.guide.imageUrl) {
    attachments.push({
      type: "image",
      url: knowledge.guide.imageUrl,
      label: knowledge.guide.fileName ?? "Collections guide",
      purpose: "pricing_guide",
    });
  } else if (knowledge.guide.link) {
    attachments.push({
      type: "link",
      url: knowledge.guide.link,
      label: "Collections guide",
      purpose: "pricing_guide",
    });
  }

  return attachments.length > 0 ? attachments : undefined;
}

function knowledgeSummary(knowledge?: SimpleWeddingKnowledgeContext) {
  if (!knowledge) {
    return undefined;
  }

  return {
    hasPricing: Boolean(knowledge.pricing.startPrice),
    startPrice: knowledge.pricing.startPrice,
    hasGuideImage: Boolean(knowledge.guide.imageUrl),
    hasGuideLink: Boolean(knowledge.guide.link),
    personaName: knowledge.persona.name,
  };
}

export async function invokeWeddingSalesSimpleAdapter(args: {
  incoming: NormalizedWeddingSalesIncomingMessage;
  toolContext?: WeddingSalesToolContext | null;
  config?: Partial<WeddingSalesConfig>;
  channelConfig?: unknown;
  features?: SimpleWeddingKnowledgeFeature[];
  knowledge?: SimpleWeddingKnowledgeContext;
  deps?: WeddingSalesSimpleInvokeDeps;
}): Promise<WeddingSalesSimpleInvokeResult> {
  const deps = args.deps ?? {};
  const processedIdentity = getProcessedIdentity(args.incoming);

  if (processedIdentity && (await deps.hasProcessedIncoming?.(processedIdentity))) {
    return {
      status: "duplicate",
      outbound: null,
      state: await deps.loadState?.(args.incoming),
    };
  }

  const previousState = await deps.loadState?.(args.incoming);
  const invokeGraph = deps.invokeGraph ?? invokeWeddingSalesSimpleGraph;
  const graphState = await invokeGraph({
    tenantId: args.incoming.tenantId,
    agentId: args.incoming.agentId,
    contactId: args.incoming.contactId,
    channel: args.incoming.channel,
    message: args.incoming.text,
    customerEmail: args.incoming.senderEmail,
    previousState,
    toolContext: args.toolContext,
    config: args.config,
    channelConfig: args.channelConfig,
    knowledgeFeatures: args.features,
    knowledge: args.knowledge,
  });
  const knowledge =
    args.knowledge ??
    buildSimpleWeddingKnowledgeContext({
      channel: args.incoming.channel,
      channelConfig: args.channelConfig,
      features: args.features,
      config: args.config,
      state: graphState,
    });
  const outbound = buildWeddingSalesSimpleOutbound({
    incoming: args.incoming,
    state: graphState,
    attachments: outboundAttachments({
      text: graphState.responseDraft ?? "",
      knowledge,
      state: graphState,
    }),
    channelConfig: args.channelConfig,
  });
  const persistedState = stateForPersistence(graphState);

  await deps.recordSafetyLog?.({
    inboundText: args.incoming.text,
    outboundText: outbound.text,
    dialogueUnderstanding: graphState.dialogueUnderstanding,
    dialogueCommands: graphState.dialogueCommands,
    flowRunner: graphState.flowRunner,
    pendingUserActionBefore: previousState?.pendingUserAction,
    pendingUserActionAfter: persistedState.pendingUserAction,
    decisionTrace: graphState.decisionTrace,
    replyContract: graphState.replyContract,
    guardResult: graphState.replyGuardResult,
    writer: graphState.writer,
    attachments: outbound.attachments,
    channelDeliveryPlan: outbound.channelDeliveryPlan,
    deliveryPlanGuard:
      outbound.channelDeliveryPlan && "guardResult" in outbound.channelDeliveryPlan
        ? outbound.channelDeliveryPlan.guardResult
        : undefined,
    knowledgeSummary: knowledgeSummary(knowledge),
    toolCalls: graphState.toolObservations.map((observation) => observation.toolName),
    previousState,
    nextState: persistedState,
    runtime: "wedding-sales-simple",
  });

  await deps.saveState?.({
    incoming: args.incoming,
    state: persistedState,
  });

  if (processedIdentity) {
    await deps.markProcessedIncoming?.(processedIdentity);
  }

  return {
    status: "processed",
    outbound,
    state: persistedState,
  };
}

export const weddingSalesSimpleInvokeTestHelpers = {
  stateForPersistence,
  getProcessedIdentity,
};
