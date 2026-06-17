import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

import type { WeddingSalesConfig } from "../config";
import { createWeddingSalesReplyNodes } from "../nodes/reply";
import { createWeddingSalesToolNodes } from "../nodes/tools";
import type { WeddingSalesRuntimeMode, WeddingSalesState } from "../state";
import type { WeddingSalesAction } from "./schema";
import { replyActionForMissingField } from "./response-context";

type WeddingSalesStatePatch = Partial<WeddingSalesState>;
type WeddingSalesToolObservation = WeddingSalesState["toolObservations"][number];

const ACTION_RUNTIME_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const ACTION_RUNTIME_DISABLED_VALUES = new Set(["0", "false", "no", "off"]);

function parseAgentAllowlist(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function isAgentDisabledForActionRuntimeV2(agentId?: string) {
  return Boolean(
    agentId &&
      parseAgentAllowlist(process.env.WEDDING_SALES_ACTION_RUNTIME_V2_DISABLED_AGENT_IDS).has(agentId),
  );
}

export function isWeddingSalesActionRuntimeV2Enabled(
  agentId?: string,
  runtimeMode?: WeddingSalesRuntimeMode,
) {
  if (!agentId) return false;

  if (runtimeMode === "unified_v2") {
    return !isAgentDisabledForActionRuntimeV2(agentId);
  }

  const flag = process.env.WEDDING_SALES_ACTION_RUNTIME_V2?.trim().toLowerCase();
  if (flag && ACTION_RUNTIME_DISABLED_VALUES.has(flag)) return false;

  const allowlist = parseAgentAllowlist(
    process.env.WEDDING_SALES_ACTION_RUNTIME_V2_AGENT_IDS,
  );

  if (allowlist.size === 0) return false;
  if (flag && !ACTION_RUNTIME_ENABLED_VALUES.has(flag)) return false;

  return allowlist.has(agentId);
}

function mergePatchIntoWorkingState(
  current: WeddingSalesState,
  patch: WeddingSalesStatePatch,
): WeddingSalesState {
  return {
    ...current,
    ...patch,
    toolObservations: patch.toolObservations
      ? [...current.toolObservations, ...patch.toolObservations]
      : current.toolObservations,
    turnToolObservations: patch.turnToolObservations ?? current.turnToolObservations,
  };
}

function mergePatchIntoResult(
  current: WeddingSalesStatePatch,
  patch: WeddingSalesStatePatch,
): WeddingSalesStatePatch {
  return {
    ...current,
    ...patch,
    toolObservations: patch.toolObservations
      ? [
          ...((current.toolObservations as WeddingSalesToolObservation[] | undefined) ?? []),
          ...patch.toolObservations,
        ]
      : current.toolObservations,
    turnToolObservations: patch.turnToolObservations ?? current.turnToolObservations,
  };
}

function isToolAction(action: WeddingSalesAction) {
  return (
    action.type === "check_wedding_availability" ||
    action.type === "check_consultation_calendar" ||
    action.type === "book_consultation"
  );
}

export function createWeddingSalesActionPlanExecutor(args: {
  config: WeddingSalesConfig;
  toolContext?: WeddingSalesToolContext | null;
}) {
  const replyNodes = createWeddingSalesReplyNodes(args.config);
  const toolNodes = createWeddingSalesToolNodes(args);

  async function runAction(
    action: WeddingSalesAction,
    state: WeddingSalesState,
  ): Promise<WeddingSalesStatePatch> {
    switch (action.type) {
      case "check_wedding_availability":
        return toolNodes.checkAvailability(state);
      case "check_consultation_calendar":
        return toolNodes.checkCalendar(state);
      case "book_consultation":
        return toolNodes.bookCall(state);
      case "request_confirmation":
        return replyNodes.confirmChange(state);
      case "answer_question":
      case "acknowledge_objection":
      case "continue_conversation":
        return replyNodes.answerQuestion(state);
      case "request_clarification":
        return {
          responseDraft: "I want to make sure I understand you correctly. Could you say that one more way?",
          assistantReplyCount: state.assistantReplyCount + 1,
          lastAssistantIntent: "request_clarification",
        };
      case "ask_missing_field":
        return replyNodes[replyActionForMissingField(action.field)](state);
      case "recommend_owner_handoff":
        return replyNodes.ignored();
      default:
        return replyNodes.askMissingInfo(state);
    }
  }

  return async function executeActionPlan(
    state: WeddingSalesState,
  ): Promise<WeddingSalesStatePatch> {
    const plan = state.lastActionPlan;
    if (!plan) return {};

    let workingState = state;
    let resultPatch: WeddingSalesStatePatch = {};
    let replyComposed = false;

    for (const action of plan.actions) {
      if (replyComposed && !isToolAction(action)) continue;

      const patch = await runAction(action, workingState);
      workingState = mergePatchIntoWorkingState(workingState, patch);
      resultPatch = mergePatchIntoResult(resultPatch, patch);

      if (
        action.type === "check_wedding_availability" &&
        workingState.availability !== "available"
      ) {
        break;
      }

      if (!isToolAction(action)) {
        replyComposed = true;
      }
    }

    return resultPatch;
  };
}

export const weddingSalesActionExecutorTestHelpers = {
  mergePatchIntoResult,
  mergePatchIntoWorkingState,
  parseAgentAllowlist,
};
