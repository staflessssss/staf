import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesDialogueCommand,
  SimpleWeddingSalesFlowRunnerTrace,
  SimpleWeddingSalesNextStep,
  SimpleWeddingSalesPendingUserAction,
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesState,
} from "./state";

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
      (command.question === "raw_footage" || command.question === "travel"),
  ) as Extract<SimpleWeddingSalesDialogueCommand, { type: "answer_question" }> | undefined;
}

function hasSlotCommand(commands: SimpleWeddingSalesDialogueCommand[], slot: string) {
  return hasCommand(
    commands,
    (command) => command.type === "set_slot" && command.slot === slot,
  );
}

function buildTrace(args: {
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
      predictedNextStep: "reply_only",
      predictedResponseKey:
        faqCommand.question === "raw_footage"
          ? "utter_answer_raw_footage"
          : "utter_answer_travel",
      legacyDecision: input.legacyDecision,
      legacyReplyType: "reply_only",
      preserveFlow: true,
      reason: "customer asked a known business question",
    });
  }

  if (isOnlyAcknowledgement(commands)) {
    return buildTrace({
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
      predictedNextStep: "ask_call_time",
      predictedResponseKey: "utter_ask_call_time",
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
