import type { WeddingSalesState } from "../state";
import type { SemanticAnalysisV2, SemanticEntityV2, WeddingSalesField } from "./schema";

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

function hasCoupleNames(value?: string) {
  return Boolean(value && /\s+(?:and|&)\s+/i.test(value));
}

function evidenceAddsPartnerName(args: {
  field: WeddingSalesField;
  currentValue?: string;
  candidateValue: string;
  evidence: string;
}) {
  const evidence = args.evidence.toLowerCase();

  return (
    args.field === "names" &&
    Boolean(args.currentValue) &&
    !hasCoupleNames(args.currentValue) &&
    !hasCoupleNames(args.candidateValue) &&
    (
      evidence.includes("fianc") ||
      evidence.includes("partner") ||
      evidence.includes("groom") ||
      evidence.includes("bride") ||
      evidence.includes("his name") ||
      evidence.includes("her name") ||
      evidence.includes("their name")
    )
  );
}

function evidenceIsPresent(message: string, evidence: string) {
  return Boolean(evidence.trim()) && normalize(message).includes(normalize(evidence));
}

function isValidIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

function isValidEntity(entity: SemanticEntityV2) {
  const value = entity.normalizedValue ?? entity.value;

  switch (entity.field) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "weddingDate":
      return isValidIsoDate(value);
    case "weddingYear":
      return /^(?:19|20)\d{2}$/.test(value);
    case "names":
      return (
        value.length >= 2 &&
        !/\b(?:not ready|schedule|call|question|price|wedding date|venue|location)\b/i.test(value)
      );
    default:
      return value.trim().length >= 2;
  }
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
    const valid = isValidEntity(entity);
    const currentValue = committedValue(args.state, entity.field);
    const candidateValue = entity.normalizedValue ?? entity.value;
    const conflictsWithCommittedState = Boolean(
      currentValue &&
        normalize(currentValue) !== normalize(candidateValue) &&
        !evidenceAddsPartnerName({
          field: entity.field,
          currentValue,
          candidateValue,
          evidence: entity.evidence,
        }),
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
