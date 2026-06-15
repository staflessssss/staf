import type { WeddingSalesState } from "../state";
import { isValidSemanticFieldValue } from "../state-v2/validators";
import type { SemanticAnalysisV2, WeddingSalesField } from "./schema";

export type EffectiveEntityConfidence = {
  field: WeddingSalesField;
  value: string;
  evidence: string;
  llmConfidence: number;
  effectiveConfidence: number;
  evidencePresent: boolean;
  valid: boolean;
  conflictsWithCommittedState: boolean;
  reasons: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function evidenceIsPresent(message: string, evidence: string) {
  return Boolean(evidence.trim()) && normalize(message).includes(normalize(evidence));
}

function committedValue(state: WeddingSalesState, field: WeddingSalesField) {
  switch (field) {
    case "email":
      return state.customerEmail;
    case "callTime":
      return state.proposedCallTime;
    default:
      return state[field];
  }
}

function hasAuthorizedConflict(args: {
  analysis: SemanticAnalysisV2;
  state: WeddingSalesState;
  field: WeddingSalesField;
  candidateValue: string;
}) {
  if (
    args.analysis.pendingResolution?.field === args.field &&
    args.analysis.pendingResolution.type === "correct" &&
    args.analysis.pendingResolution.confidence >= 0.7
  ) {
    return true;
  }

  return (
    args.analysis.pendingResolution?.field === args.field &&
    args.analysis.pendingResolution.type === "confirm" &&
    args.analysis.pendingResolution.confidence >= 0.7 &&
    args.state.pendingChangeField === args.field &&
    Boolean(args.state.pendingChangeValue) &&
      normalize(args.state.pendingChangeValue ?? "") === normalize(args.candidateValue)
  );
}

function confirmsAlternateWeddingDate(args: {
  analysis: SemanticAnalysisV2;
  state: WeddingSalesState;
  field: WeddingSalesField;
}) {
  return (
    args.field === "weddingDate" &&
    args.state.availability === "unavailable" &&
    args.analysis.intents.some(
      (intent) =>
        intent.category === "confirm" &&
        intent.targetField === "weddingDate" &&
        intent.confidence >= 0.85,
    )
  );
}

function isReplaceableSchedulingField(field: WeddingSalesField) {
  return field === "callTime";
}

function isSchedulingObjection(analysis: SemanticAnalysisV2) {
  return analysis.objections.some(
    (objection) =>
      objection.type === "not_ready_to_schedule" && objection.confidence >= 0.65,
  );
}

export function calculateEffectiveEntityConfidence(args: {
  analysis: SemanticAnalysisV2;
  state: WeddingSalesState;
}): EffectiveEntityConfidence[] {
  const message = args.state.latestCustomerMessage ?? "";

  return args.analysis.entities.map((entity) => {
    const reasons: string[] = [];
    const evidencePresent = evidenceIsPresent(message, entity.evidence);
    const valid = isValidSemanticFieldValue(entity);
    const currentValue = committedValue(args.state, entity.field);
    const candidateValue =
      entity.field === "callTime"
        ? entity.value.trim()
        : entity.normalizedValue ?? entity.value;
    const conflictsWithCommittedState = Boolean(
      currentValue &&
        normalize(currentValue) !== normalize(candidateValue),
    );
    let effectiveConfidence = entity.confidence;

    if (evidencePresent) {
      effectiveConfidence += 0.08;
      reasons.push("evidence_present");
    } else {
      effectiveConfidence -= 0.35;
      reasons.push("evidence_missing");
    }

    if (valid) {
      effectiveConfidence += 0.07;
      reasons.push("deterministic_validation_passed");
    } else {
      effectiveConfidence -= 0.55;
      reasons.push("deterministic_validation_failed");
    }

    if (
      conflictsWithCommittedState &&
      !isReplaceableSchedulingField(entity.field) &&
      !hasAuthorizedConflict({
        analysis: args.analysis,
        state: args.state,
        field: entity.field,
        candidateValue,
      }) &&
      !confirmsAlternateWeddingDate({
        analysis: args.analysis,
        state: args.state,
        field: entity.field,
      })
    ) {
      effectiveConfidence = Math.min(effectiveConfidence, 0.45);
      reasons.push("conflicts_without_explicit_correction");
    }

    if (entity.field === "callTime" && isSchedulingObjection(args.analysis)) {
      effectiveConfidence = Math.min(effectiveConfidence, 0.2);
      reasons.push("suppressed_by_scheduling_objection");
    }

    return {
      field: entity.field,
      value: candidateValue,
      evidence: entity.evidence,
      llmConfidence: entity.confidence,
      effectiveConfidence: Math.max(0, Math.min(1, effectiveConfidence)),
      evidencePresent,
      valid,
      conflictsWithCommittedState,
      reasons,
    };
  });
}
