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
import { buildReplyActionContract } from "@/lib/lang/graphs/wedding-sales-simple/reply-contract";
import { updateSimpleWeddingReplyMemory } from "@/lib/lang/graphs/wedding-sales-simple/reply-memory";
import { writeConstrainedWeddingReply } from "@/lib/lang/graphs/wedding-sales-simple/reply-writer";
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
    args.state?.replyContract?.mentionPolicy.guide.mode !== "send_attachment"
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

function reconcileFreshAvailabilityGuide(args: {
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}): SimpleWeddingSalesState {
  const hasGuide = Boolean(args.knowledge.guide.imageUrl || args.knowledge.guide.link);
  const shouldReconcile =
    hasGuide &&
    args.state.availability === "available" &&
    args.state.decisionTrace?.toolCalled === "checkAvailability" &&
    args.state.decisionTrace.replyType === "availability_available" &&
    args.state.decisionTrace.responseKey === "utter_availability_available_ask_names" &&
    args.state.replyContract?.mentionPolicy.guide.mode === "skip";

  if (!shouldReconcile) {
    return args.state;
  }

  const contract = buildReplyActionContract({
    state: args.state,
    knowledge: args.knowledge,
  });

  if (contract.mentionPolicy.guide.mode !== "send_attachment") {
    return args.state;
  }

  const stateWithContract = {
    ...args.state,
    replyContract: contract,
  };
  const reply = writeConstrainedWeddingReply({
    state: stateWithContract,
    contract,
    knowledge: args.knowledge,
  });
  const reconciledState = {
    ...stateWithContract,
    responseDraft: reply.text,
    replyGuardResult: reply.guardResult,
    writer: reply.writer,
    writerCatalog: reply.writerCatalog,
  };

  return {
    ...reconciledState,
    replyMemory: updateSimpleWeddingReplyMemory({
      state: reconciledState,
      contract,
      knowledge: args.knowledge,
      replyText: reply.text,
      writer: reply.writer,
    }),
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
  const finalGraphState = reconcileFreshAvailabilityGuide({
    state: graphState,
    knowledge,
  });
  const outbound = buildWeddingSalesSimpleOutbound({
    incoming: args.incoming,
    state: finalGraphState,
    attachments: outboundAttachments({
      text: finalGraphState.responseDraft ?? "",
      knowledge,
      state: finalGraphState,
    }),
    channelConfig: args.channelConfig,
  });
  const persistedState = stateForPersistence(finalGraphState);

  await deps.recordSafetyLog?.({
    inboundText: args.incoming.text,
    outboundText: outbound.text,
    dialogueUnderstanding: finalGraphState.dialogueUnderstanding,
    dialogueCommands: finalGraphState.dialogueCommands,
    weddingLeadForm: finalGraphState.weddingLeadForm,
    flowRunner: finalGraphState.flowRunner,
    domainDecision: finalGraphState.domainDecision,
    pendingUserActionBefore: previousState?.pendingUserAction,
    pendingUserActionAfter: persistedState.pendingUserAction,
    decisionTrace: finalGraphState.decisionTrace,
    replyContract: finalGraphState.replyContract,
    guardResult: finalGraphState.replyGuardResult,
    writer: finalGraphState.writer,
    writerCatalog: finalGraphState.writerCatalog,
    attachments: outbound.attachments,
    channelDeliveryPlan: outbound.channelDeliveryPlan,
    deliveryPlanGuard:
      outbound.channelDeliveryPlan && "guardResult" in outbound.channelDeliveryPlan
        ? outbound.channelDeliveryPlan.guardResult
        : undefined,
    knowledgeSummary: knowledgeSummary(knowledge),
    toolCalls: finalGraphState.toolObservations.map((observation) => observation.toolName),
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
