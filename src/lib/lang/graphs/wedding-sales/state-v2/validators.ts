import type { SemanticEntityV2 } from "../semantic-v2/schema";

export function normalizeSemanticValue(entity: SemanticEntityV2) {
  return (entity.normalizedValue ?? entity.value).trim();
}

export function normalizeForComparison(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isValidIsoDate(value: string) {
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

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidSemanticFieldValue(entity: SemanticEntityV2) {
  const value = normalizeSemanticValue(entity);

  switch (entity.field) {
    case "email":
      return isValidEmail(value);
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
      return value.length >= 2;
  }
}
