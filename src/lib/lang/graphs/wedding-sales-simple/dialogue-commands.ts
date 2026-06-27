import type { DialogueUnderstanding } from "./dialogue-understanding";
import type {
  SimpleWeddingSalesDialogueCommand,
  SimpleWeddingSalesPendingUserAction,
  SimpleWeddingSalesQuestion,
  SimpleWeddingSalesState,
  TurnUnderstanding,
} from "./state";

const ANSWERABLE_QUESTIONS = new Set<SimpleWeddingSalesQuestion>([
  "pricing",
  "portfolio",
  "travel",
  "raw_footage",
  "delivery_timeline",
  "sneak_peek",
  "music_choice",
  "style",
  "coi",
  "package_inclusions",
  "team",
]);

function answerQuestionCommand(
  question: SimpleWeddingSalesQuestion,
): SimpleWeddingSalesDialogueCommand | undefined {
  if (question === "package_inclusions") {
    return { type: "answer_question", question: "pricing" };
  }

  if (!ANSWERABLE_QUESTIONS.has(question)) {
    return undefined;
  }

  if (
    question === "pricing" ||
    question === "team" ||
    question === "portfolio" ||
    question === "travel" ||
    question === "raw_footage" ||
    question === "delivery_timeline" ||
    question === "sneak_peek" ||
    question === "music_choice" ||
    question === "style" ||
    question === "coi"
  ) {
    return { type: "answer_question", question };
  }

  return undefined;
}

export function buildDialogueCommands(input: {
  understanding: DialogueUnderstanding;
  extractedFacts: TurnUnderstanding["facts"];
  pendingUserAction: SimpleWeddingSalesPendingUserAction;
  state?: SimpleWeddingSalesState;
  latestCustomerMessage?: string;
}): SimpleWeddingSalesDialogueCommand[] {
  const commands: SimpleWeddingSalesDialogueCommand[] = [];
  const { extractedFacts } = input;
  const latestCustomerMessage = input.latestCustomerMessage ?? input.state?.latestCustomerMessage ?? "";
  const normalizedMessage = latestCustomerMessage.toLowerCase();

  if (input.understanding.messageAct === "generic_lead_inquiry") {
    commands.push({
      type: "start_flow",
      flow: "wedding_lead_qualification",
      reason: "generic_lead_inquiry",
    });
  }

  if (extractedFacts.customerName) {
    commands.push({ type: "set_slot", slot: "customerName", value: extractedFacts.customerName });
  }

  if (extractedFacts.partnerName) {
    commands.push({ type: "set_slot", slot: "partnerName", value: extractedFacts.partnerName });
  }

  if (extractedFacts.weddingDate) {
    commands.push({ type: "set_slot", slot: "weddingDate", value: extractedFacts.weddingDate });
  }

  if (extractedFacts.weddingDateText) {
    commands.push({ type: "set_slot", slot: "weddingDateText", value: extractedFacts.weddingDateText });
  }

  if (extractedFacts.location) {
    commands.push({ type: "set_slot", slot: "location", value: extractedFacts.location });
  }

  if (extractedFacts.venue) {
    commands.push({ type: "set_slot", slot: "venue", value: extractedFacts.venue });
  }

  if (extractedFacts.proposedCallTime) {
    commands.push({ type: "set_slot", slot: "proposedCallTime", value: extractedFacts.proposedCallTime });
  }

  if (extractedFacts.email) {
    commands.push({ type: "set_slot", slot: "customerEmail", value: extractedFacts.email });
  }

  if (
    input.pendingUserAction?.type === "booking_confirmation" &&
    input.understanding.pendingAnswer.type !== "none" &&
    input.understanding.pendingAnswer.appliesTo === "booking_confirmation"
  ) {
    commands.push({
      type: "answer_pending_action",
      action: "booking_confirmation",
      value: input.understanding.pendingAnswer.type,
    });
  }

  if (
    input.understanding.messageAct === "acknowledgement_only" ||
    input.understanding.conversationalFiller.some((phrase) =>
      phrase.includes("thank") || phrase.includes("thanks"),
    )
  ) {
    commands.push({ type: "acknowledgement_only" });
  }

  if (input.state?.bookingConfirmed) {
    if (/\b(?:reschedule|move|change|switch|another time|different time|different day|new time)\b/.test(normalizedMessage)) {
      commands.push({ type: "reschedule_request" });
    }

    if (/\b(?:cancel|call off|remove|delete)\b/.test(normalizedMessage)) {
      commands.push({ type: "cancel_request" });
    }

    if (/\b(?:what time|when)\b[\s\S]{0,80}\b(?:call|consult|meeting)|\bcall\b[\s\S]{0,80}\b(?:time|again)\b/.test(normalizedMessage)) {
      commands.push({ type: "ask_booking_details", detail: "time" });
    }

    if (/\b(?:what email|which email|email)\b[\s\S]{0,80}\b(?:invite|calendar|use|sent|come through)\b/.test(normalizedMessage)) {
      commands.push({ type: "ask_booking_details", detail: "email" });
    }

    if (/\b(?:invite|calendar invite|where is the invite|did you send)\b/.test(normalizedMessage)) {
      commands.push({ type: "ask_booking_details", detail: "invite" });
    }
  }

  for (const question of input.understanding.explicitQuestions) {
    const command = answerQuestionCommand(question);

    if (command && !commands.some((existing) => JSON.stringify(existing) === JSON.stringify(command))) {
      commands.push(command);
    }
  }

  return commands;
}

export function hasDialogueCommand(
  commands: SimpleWeddingSalesDialogueCommand[] | undefined,
  predicate: (command: SimpleWeddingSalesDialogueCommand) => boolean,
) {
  return Boolean(commands?.some(predicate));
}
