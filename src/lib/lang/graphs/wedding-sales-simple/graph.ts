import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

import { decideNextStep } from "./decide";
import { writeHumanReply } from "./reply";
import {
  createInitialSimpleWeddingSalesState,
  derivePendingUserAction,
  mergeTurnUnderstanding,
  type SimpleWeddingSalesChannel,
  type SimpleWeddingSalesState,
} from "./state";
import {
  markFlowDecisionSelection,
  runWeddingLeadFlowShadow,
  shouldActivateFlowDecision,
} from "./flow-runner";
import { maybeRunSimpleWeddingSalesTool } from "./tools";
import { understandTurn, type SimpleWeddingSalesUnderstandTurn } from "./understand";
import type { WeddingSalesConfig } from "../wedding-sales/config";
import {
  buildSimpleWeddingKnowledgeContext,
  type SimpleWeddingKnowledgeFeature,
  type SimpleWeddingKnowledgeContext,
} from "./knowledge";
import { buildReplyActionContract } from "./reply-contract";
import { updateSimpleWeddingReplyMemory } from "./reply-memory";
import { writeConstrainedWeddingReply } from "./reply-writer";
import { defaultWeddingSalesConfig } from "../wedding-sales/config";

function toolNameForStep(state: SimpleWeddingSalesState) {
  if (state.nextStep === "check_availability") {
    return "checkAvailability" as const;
  }

  if (state.nextStep === "check_calendar") {
    return "checkCalendar" as const;
  }

  if (state.nextStep === "book_call") {
    return "bookCall" as const;
  }

  return undefined;
}

function resolveCallBookingWindow(config?: Partial<WeddingSalesConfig>) {
  return {
    ...defaultWeddingSalesConfig.callBookingWindow,
    ...config?.callBookingWindow,
  };
}

export type InvokeWeddingSalesSimpleGraphInput = {
  channel: SimpleWeddingSalesChannel;
  message: string;
  tenantId?: string;
  agentId?: string;
  contactId?: string;
  customerEmail?: string;
  previousState?: Partial<SimpleWeddingSalesState>;
  config?: Partial<WeddingSalesConfig>;
  channelConfig?: unknown;
  knowledgeFeatures?: SimpleWeddingKnowledgeFeature[];
  knowledge?: SimpleWeddingKnowledgeContext;
  toolContext?: WeddingSalesToolContext | null;
  understand?: SimpleWeddingSalesUnderstandTurn;
};

function applyDecision(state: SimpleWeddingSalesState): SimpleWeddingSalesState {
  const decision = decideNextStep(state);
  const legacyState = {
    ...state,
    ...decision.statePatch,
    nextStep: decision.nextStep,
    missingField: decision.missingField,
    mode: decision.mode ?? state.mode,
    handoffReason: decision.handoffReason,
    decisionTrace: decision.trace,
  };
  const flowRunner = runWeddingLeadFlowShadow({
    state: legacyState,
    dialogueCommands: legacyState.dialogueCommands,
    pendingUserAction: legacyState.pendingUserAction ?? null,
    legacyDecision: decision.trace,
  });
  const useFlowRunnerDecision = shouldActivateFlowDecision(flowRunner);
  const selectedFlowRunner = markFlowDecisionSelection(flowRunner, useFlowRunnerDecision);
  const finalDecisionTrace =
    useFlowRunnerDecision && selectedFlowRunner
      ? {
          ...decision.trace,
          nextStep: selectedFlowRunner.predictedNextStep,
          responseKey: selectedFlowRunner.predictedResponseKey,
          replyType: selectedFlowRunner.legacyReplyType ?? decision.trace.replyType,
          reason: selectedFlowRunner.reason,
        }
      : decision.trace;

  return {
    ...legacyState,
    nextStep: finalDecisionTrace.nextStep,
    decisionTrace: finalDecisionTrace,
    flowRunner: selectedFlowRunner ?? state.flowRunner,
  };
}

function isToolStep(state: SimpleWeddingSalesState) {
  return (
    state.nextStep === "check_availability" ||
    state.nextStep === "check_calendar" ||
    state.nextStep === "book_call"
  );
}

export async function invokeWeddingSalesSimpleGraph(
  input: InvokeWeddingSalesSimpleGraphInput,
): Promise<SimpleWeddingSalesState> {
  const initialState = createInitialSimpleWeddingSalesState({
    tenantId: input.tenantId,
    agentId: input.agentId,
    contactId: input.contactId,
    channel: input.channel,
    message: input.message,
    customerEmail: input.customerEmail,
    callBookingWindow: resolveCallBookingWindow(input.config),
    previousState: input.previousState,
  });
  const understanding = await understandTurn(initialState, input.understand);
  let state = applyDecision(mergeTurnUnderstanding(initialState, understanding));

  for (let attempts = 0; attempts < 3 && isToolStep(state); attempts += 1) {
    const beforeCount = state.toolObservations.length;
    const toolCalled = toolNameForStep(state);
    state = await maybeRunSimpleWeddingSalesTool({
      state,
      toolContext: input.toolContext,
    });

    if (state.toolObservations.length === beforeCount) {
      state = {
        ...state,
        nextStep: "handoff",
        mode: "human_needed",
        handoffReason: "tool_error",
        decisionTrace: state.decisionTrace
          ? {
              ...state.decisionTrace,
              nextStep: "handoff",
              toolCalled,
              replyType: "handoff",
              reason: "selected tool step could not run",
            }
          : undefined,
      };
      break;
    }

    state = applyDecision(state);
    state = {
      ...state,
      decisionTrace: state.decisionTrace
        ? {
            ...state.decisionTrace,
            toolCalled,
          }
        : undefined,
    };
  }

  const knowledge =
    input.knowledge ??
    buildSimpleWeddingKnowledgeContext({
      channel: input.channel,
      channelConfig: input.channelConfig,
      features: input.knowledgeFeatures,
      config: input.config,
      state,
    });
  const contract = buildReplyActionContract({
    state,
    knowledge,
  });
  const reply = writeConstrainedWeddingReply({
    state,
    contract,
    knowledge,
  });
  const finalState: SimpleWeddingSalesState = reply.forceHandoff
    ? {
        ...state,
        nextStep: "handoff",
        mode: "human_needed",
        handoffReason: "tool_error",
        decisionTrace: state.decisionTrace
          ? {
              ...state.decisionTrace,
              nextStep: "handoff",
              replyType: "handoff",
              reason: "reply guard failed after all deterministic fallbacks",
            }
          : undefined,
      }
    : state;

  const updatedReplyMemory = updateSimpleWeddingReplyMemory({
    state: finalState,
    contract,
    knowledge,
    replyText: reply.text,
  });
  const finalDecisionTrace = finalState.decisionTrace
    ? {
        ...finalState.decisionTrace,
        responseKey: contract.responseKey ?? finalState.decisionTrace.responseKey,
      }
    : undefined;
  const returnedState = {
    ...finalState,
    decisionTrace: finalDecisionTrace,
    replyMemory: updatedReplyMemory,
    replyContract: contract,
    replyGuardResult: reply.guardResult,
    writer: {
      ...reply.writer,
      responseKey: contract.responseKey,
    },
    responseDraft: reply.text || writeHumanReply({
      state,
      config: input.config,
    }),
  };

  return {
    ...returnedState,
    pendingUserAction: derivePendingUserAction(returnedState),
  };
}

export { decideNextStep } from "./decide";
export { writeHumanReply } from "./reply";
export { type SimpleWeddingSalesState, type TurnUnderstanding } from "./state";
