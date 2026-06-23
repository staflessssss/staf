import type {
  SemanticAnalysisV2,
  SemanticProvidedValueV2,
} from "../semantic-v2/schema";
import type { WeddingSalesState } from "../state";
import type {
  GroundedWeddingFact,
  GroundedWeddingUnderstanding,
} from "./schema";

const ACCEPT_CONFIDENCE = 0.85;

function normalizeEvidence(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function hasExactTurnEvidence(message: string | undefined, evidence: string) {
  const source = normalizeEvidence(message ?? "");
  const quoted = normalizeEvidence(evidence);
  return Boolean(quoted) && source.includes(quoted);
}

function isGroundedFact(fact: GroundedWeddingFact, state: WeddingSalesState) {
  if (fact.confidence < ACCEPT_CONFIDENCE) return false;
  if (!hasExactTurnEvidence(state.latestCustomerMessage, fact.evidence))
    return false;
  if (fact.field === "customerName" && fact.relation !== "speaker_self")
    return false;
  if (fact.field === "partnerName" && fact.relation !== "speaker_partner")
    return false;
  if (
    fact.relation === "third_party" &&
    (fact.field === "customerName" || fact.field === "partnerName")
  ) {
    return false;
  }
  return true;
}

function asProvidedValue(fact: GroundedWeddingFact): SemanticProvidedValueV2 {
  return {
    value: fact.value,
    normalizedValue: fact.normalizedValue,
    confidence: fact.confidence,
    evidence: fact.evidence,
    alternatives: [],
  };
}

function intentCategoryForFact(fact: GroundedWeddingFact) {
  return fact.mode === "correct"
    ? ("request_modification" as const)
    : fact.mode === "confirm"
      ? ("confirm" as const)
      : ("provide_info" as const);
}

export type GroundedWeddingAdaptation = {
  analysis: SemanticAnalysisV2;
  acceptedFacts: GroundedWeddingFact[];
  rejectedFacts: GroundedWeddingFact[];
};

function normalizeKnownQuestionTopic(args: {
  topicId: string | null;
  text: string;
  state: WeddingSalesState;
  acceptedFacts: GroundedWeddingFact[];
}) {
  const topic = args.topicId;
  const text = args.text.toLowerCase();

  if (/\b(?:raw footage|drone footage|coverage|included|include|comes with|film|clip)\b/.test(text)) {
    return "package_inclusions";
  }

  if (/\b(?:shooter|shoot|filmmaker|films?|filming|team)\b/.test(text)) {
    const location =
      args.acceptedFacts.find((fact) => fact.field === "location")?.normalizedValue ??
      args.acceptedFacts.find((fact) => fact.field === "location")?.value ??
      args.state.location ??
      "";
    const normalizedLocation = `${location} ${args.state.latestCustomerMessage ?? ""}`.toLowerCase();

    if (/\b(?:fl|florida|tampa|miami|orlando|safety harbor|fort lauderdale)\b/.test(normalizedLocation)) {
      return "team_florida";
    }

    if (/\b(?:nc|north carolina|sc|south carolina|ga|georgia|charlotte|raleigh|charleston)\b/.test(normalizedLocation)) {
      return "team_nc_sc_ga";
    }

    return "photographers";
  }

  if (
    topic &&
    topic !== "other" &&
    topic !== "unknown_service_request" &&
    topic !== "unknown_business_question"
  ) {
    return topic;
  }

  return topic;
}

export function adaptGroundedWeddingUnderstanding(args: {
  state: WeddingSalesState;
  understanding: GroundedWeddingUnderstanding;
}): GroundedWeddingAdaptation {
  const acceptedFacts = args.understanding.facts.filter((fact) =>
    isGroundedFact(fact, args.state),
  );
  const rejectedFacts = args.understanding.facts.filter(
    (fact) => !acceptedFacts.includes(fact),
  );
  const questions = args.understanding.questions.filter(
    (question) =>
      question.confidence >= 0.75 &&
      hasExactTurnEvidence(args.state.latestCustomerMessage, question.evidence),
  );
  const decisions = args.understanding.decisions.filter(
    (decision) =>
      decision.confidence >= 0.75 &&
      hasExactTurnEvidence(args.state.latestCustomerMessage, decision.evidence),
  );
  const customerName = acceptedFacts.find(
    (fact) => fact.field === "customerName",
  );
  const partnerName = acceptedFacts.find(
    (fact) => fact.field === "partnerName",
  );
  const correction = acceptedFacts.find((fact) => fact.mode === "correct");
  const confirmation = acceptedFacts.find((fact) => fact.mode === "confirm");
  const requestHuman = decisions.find(
    (decision) => decision.type === "request_human",
  );
  const declined = decisions.find(
    (decision) =>
      decision.type === "decline_options" || decision.type === "not_ready",
  );

  const intents: SemanticAnalysisV2["intents"] = [
    ...acceptedFacts.map((fact) => ({
      category: intentCategoryForFact(fact),
      confidence: fact.confidence,
      targetField: fact.field,
      evidence: fact.evidence,
    })),
    ...questions.map((question) => ({
      category: "ask_question" as const,
      confidence: question.confidence,
      targetField: null,
      evidence: question.evidence,
    })),
    ...decisions.map((decision) => ({
      category:
        decision.type === "request_human"
          ? ("request_human" as const)
          : decision.type === "decline_options" || decision.type === "not_ready"
            ? ("reject" as const)
            : ("confirm" as const),
      confidence: decision.confidence,
      targetField: decision.targetField,
      evidence: decision.evidence,
    })),
  ];

  if (intents.length === 0) {
    intents.push({
      category: "off_topic",
      confidence: 0.5,
      targetField: null,
      evidence: args.state.latestCustomerMessage?.slice(0, 500) ?? "",
    });
  }

  const clientType = args.understanding.clientType;
  const groundedClientType =
    clientType &&
    clientType.confidence >= 0.8 &&
    hasExactTurnEvidence(args.state.latestCustomerMessage, clientType.evidence)
      ? clientType
      : null;

  const analysis: SemanticAnalysisV2 = {
    schemaVersion: 2,
    intents,
    primaryIntent: intents[0].category,
    entities: acceptedFacts
      .filter(
        (fact) => fact.field !== "customerName" && fact.field !== "partnerName",
      )
      .map((fact) => ({
        field: fact.field,
        value: fact.value,
        normalizedValue: fact.normalizedValue,
        confidence: fact.confidence,
        evidence: fact.evidence,
        alternatives: [],
      })),
    providedInfo: {
      customerName: customerName ? asProvidedValue(customerName) : null,
      partnerName: partnerName ? asProvidedValue(partnerName) : null,
    },
    questions: questions.map((question) => ({
      topicId: normalizeKnownQuestionTopic({
        topicId: question.topicId,
        text: `${question.normalizedQuestion} ${question.evidence}`,
        state: args.state,
        acceptedFacts,
      }),
      normalizedQuestion: question.normalizedQuestion,
      confidence: question.confidence,
      evidence: question.evidence,
    })),
    objections: declined
      ? [
          {
            type:
              declined.type === "not_ready"
                ? ("not_ready_to_schedule" as const)
                : ("other" as const),
            confidence: declined.confidence,
            evidence: declined.evidence,
          },
        ]
      : [],
    pendingResolution: correction
      ? {
          field: correction.field,
          type: "correct",
          proposedValue: correction.normalizedValue ?? correction.value,
          confidence: correction.confidence,
          evidence: correction.evidence,
        }
      : confirmation
        ? {
            field: confirmation.field,
            type: "confirm",
            proposedValue: confirmation.normalizedValue ?? confirmation.value,
            confidence: confirmation.confidence,
            evidence: confirmation.evidence,
          }
        : null,
    clientType: groundedClientType,
    ambiguity: [
      ...args.understanding.unclear.map((item) => item.reason),
      ...rejectedFacts.map(
        (fact) => `Rejected ungrounded ${fact.field}: ${fact.evidence}`,
      ),
      ...(requestHuman ? ["Customer requested a human response."] : []),
    ],
  };

  return { analysis, acceptedFacts, rejectedFacts };
}

export const groundedWeddingTestHelpers = {
  hasExactTurnEvidence,
  isGroundedFact,
};
