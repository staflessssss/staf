import {
  invokeWeddingSalesSimpleGraph,
  type InvokeWeddingSalesSimpleGraphInput,
} from "@/lib/lang/graphs/wedding-sales-simple/graph";
import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

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
      state?: SimpleWeddingSalesState;
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

export async function invokeWeddingSalesSimpleAdapter(args: {
  incoming: NormalizedWeddingSalesIncomingMessage;
  toolContext?: WeddingSalesToolContext | null;
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
  });
  const outbound = buildWeddingSalesSimpleOutbound({
    incoming: args.incoming,
    state: graphState,
  });
  const persistedState = stateForPersistence(graphState);

  await deps.recordSafetyLog?.({
    inboundText: args.incoming.text,
    outboundText: outbound.text,
    decisionTrace: graphState.decisionTrace,
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
