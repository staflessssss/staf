import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesDialogueCommand,
  SimpleWeddingSalesFlowRunnerTrace,
  SimpleWeddingSalesNextStep,
  SimpleWeddingSalesPendingUserAction,
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesState,
} from "./state";

export type FlowRunnerBranch = SimpleWeddingSalesFlowRunnerTrace["branch"];

const ACTIVE_FLOW_BRANCHES = new Set<FlowRunnerBranch>([
  "start_wedding_lead_qualification",
  "booking_confirmation_affirmative",
  "faq_raw_footage",
  "acknowledgement_only",
  "names_collected",
  "venue_collected",
]);

function hasCommand(
  commands: SimpleWeddingSalesDialogueCommand[],
  predicate: (command: SimpleWeddingSalesDialogueCommand) => boolean,
) {
  return commands.some(predicate);
}

function isOnlyAcknowledgement(commands: SimpleWeddingSalesDialogueCommand[]) {
  return commands.length === 1 && commands[0]?.type === "acknowledgement_only";
}

function knownFaqCommand(commands: SimpleWeddingSalesDialogueCommand[]) {
  return commands.find(
    (command) =>
      command.type === "answer_question" &&
      command.question === "raw_footage",
  ) as Extract<SimpleWeddingSalesDialogueCommand, { type: "answer_question" }> | undefined;
}

function hasSlotCommand(commands: SimpleWeddingSalesDialogueCommand[], slot: string) {
  return hasCommand(
    commands,
    (command) => command.type === "set_slot" && command.slot === slot,
  );
}

function buildTrace(args: {
  branch: FlowRunnerBranch;
  predictedNextStep: SimpleWeddingSalesNextStep;
  predictedResponseKey: SimpleWeddingSalesResponseKey;
  legacyDecision?: SimpleWeddingSalesDecisionTrace;
  legacyReplyType?: SimpleWeddingSalesDecisionTrace["replyType"];
  reason: string;
  shouldCallTool?: boolean;
  toolName?: SimpleWeddingSalesFlowRunnerTrace["toolName"];
  preserveFlow?: boolean;
}): SimpleWeddingSalesFlowRunnerTrace {
  const legacyReplyType = args.legacyReplyType ?? args.legacyDecision?.replyType;

  return {
    mode: "shadow",
    branch: args.branch,
    predictedNextStep: args.predictedNextStep,
    predictedResponseKey: args.predictedResponseKey,
    legacyReplyType,
    reason: args.reason,
    shouldCallTool: args.shouldCallTool,
    toolName: args.toolName,
    preserveFlow: args.preserveFlow,
    matchedLegacy: Boolean(
      !args.legacyDecision ||
        args.legacyDecision.nextStep === args.predictedNextStep ||
        args.legacyDecision.replyType === legacyReplyType ||
        args.legacyDecision.responseKey === args.predictedResponseKey,
    ),
    usedAsFinalDecision: false,
    fallbackToLegacy: true,
  };
}

export function shouldActivateFlowDecision(
  decision: SimpleWeddingSalesFlowRunnerTrace | undefined,
) {
  return Boolean(decision?.matchedLegacy && ACTIVE_FLOW_BRANCHES.has(decision.branch));
}

export function markFlowDecisionSelection(
  decision: SimpleWeddingSalesFlowRunnerTrace | undefined,
  useAsFinalDecision: boolean,
): SimpleWeddingSalesFlowRunnerTrace | undefined {
  if (!decision) {
    return undefined;
  }

  return {
    ...decision,
    mode: useAsFinalDecision ? "active" : "shadow",
    usedAsFinalDecision: useAsFinalDecision,
    fallbackToLegacy: !useAsFinalDecision,
  };
}

export function runWeddingLeadFlowShadow(input: {
  state: SimpleWeddingSalesState;
  dialogueCommands?: SimpleWeddingSalesDialogueCommand[];
  pendingUserAction: SimpleWeddingSalesPendingUserAction;
  legacyDecision?: SimpleWeddingSalesDecisionTrace;
}): SimpleWeddingSalesFlowRunnerTrace | undefined {
  const commands = input.dialogueCommands ?? [];

  if (
    hasCommand(
      commands,
      (command) =>
        command.type === "start_flow" &&
        command.flow === "wedding_lead_qualification",
    )
  ) {
    return buildTrace({
      branch: "start_wedding_lead_qualification",
      predictedNextStep: "ask_missing_info",
      predictedResponseKey: "utter_ask_wedding_details",
      legacyDecision: input.legacyDecision,
      legacyReplyType: "missing_info",
      preserveFlow: false,
      reason: "generic wedding lead inquiry starts qualification flow",
    });
  }

  if (
    input.pendingUserAction?.type === "booking_confirmation" &&
    hasCommand(
      commands,
      (command) =>
        command.type === "answer_pending_action" &&
        command.action === "booking_confirmation" &&
        command.value === "affirmative",
    )
  ) {
    return buildTrace({
      branch: "booking_confirmation_affirmative",
      predictedNextStep: "book_call",
      predictedResponseKey: "utter_booking_confirmed",
      legacyDecision: input.legacyDecision,
      legacyReplyType: "booking_confirmed",
      shouldCallTool: true,
      toolName: "book_consultation",
      reason: "active booking confirmation was affirmed",
    });
  }

  const faqCommand = knownFaqCommand(commands);

  if (faqCommand) {
    return buildTrace({
      branch: "faq_raw_footage",
      predictedNextStep: "reply_only",
      predictedResponseKey: "utter_answer_raw_footage",
      legacyDecision: input.legacyDecision,
      legacyReplyType: "reply_only",
      preserveFlow: true,
      reason: "customer asked a known business question",
    });
  }

  if (isOnlyAcknowledgement(commands)) {
    return buildTrace({
      branch: "acknowledgement_only",
      predictedNextStep: "reply_only",
      predictedResponseKey: "utter_acknowledgement",
      legacyDecision: input.legacyDecision,
      legacyReplyType: "acknowledgement_only",
      preserveFlow: true,
      reason: "customer only acknowledged the previous message",
    });
  }

  if (
    hasSlotCommand(commands, "venue") &&
    input.state.availability === "available" &&
    !input.state.proposedCallTime
  ) {
    return buildTrace({
      branch: "venue_collected",
      predictedNextStep: "ask_call_time",
      predictedResponseKey: "utter_venue_collected_ask_call_time",
      legacyDecision: input.legacyDecision,
      legacyReplyType: "ask_call_time",
      preserveFlow: true,
      reason: "venue was collected and the next qualification slot is call time",
    });
  }

  if (
    hasSlotCommand(commands, "customerName") &&
    hasSlotCommand(commands, "partnerName") &&
    !input.state.venue
  ) {
    return buildTrace({
      branch: "names_collected",
      predictedNextStep: "ask_venue",
      predictedResponseKey: "utter_ask_venue",
      legacyDecision: input.legacyDecision,
      legacyReplyType: "ask_venue",
      preserveFlow: true,
      reason: "couple names were collected and the next qualification slot is venue",
    });
  }

  return undefined;
}
