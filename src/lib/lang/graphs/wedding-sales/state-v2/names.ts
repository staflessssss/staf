import type { SemanticProvidedValueV2 } from "../semantic-v2/schema";
import type { WeddingSalesState } from "../state";
import type { WeddingSalesNameCollectionStatus } from "./schema";

type StructuredNameState = Pick<
  WeddingSalesState,
  "customerName" | "partnerName" | "coupleDisplayName" | "nameCollectionStatus" | "names"
>;

const PARTNER_EVIDENCE_PATTERN =
  /\b(?:fianc|fiance|partner|groom|bride|his name|her name|their name)\b/i;
const CUSTOMER_EVIDENCE_PATTERN =
  /\b(?:i am|i'm|im|my name is|this is|here)\b/i;

function cleanNamePart(value: string | undefined) {
  const normalized = value
    ?.trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z' -]+$/g, "")
    .replace(/\s+/g, " ");

  if (!normalized || normalized.length < 2) {
    return undefined;
  }

  return normalized;
}

function splitCoupleNames(value: string | undefined) {
  const parts = value
    ?.split(/\s+(?:and|&)\s+/i)
    .map(cleanNamePart)
    .filter((part): part is string => Boolean(part));

  if (!parts?.length) {
    return [];
  }

  return parts.slice(0, 2);
}

function displayName(customerName?: string, partnerName?: string) {
  if (customerName && partnerName) {
    return `${customerName} and ${partnerName}`;
  }

  return customerName ?? partnerName;
}

function assignDistinctPartner(customerName: string | undefined, partnerName: string | undefined) {
  if (!partnerName || !customerName) {
    return partnerName;
  }

  return customerName.toLowerCase() === partnerName.toLowerCase() ? undefined : partnerName;
}

function statusFor(customerName?: string, partnerName?: string): WeddingSalesNameCollectionStatus {
  if (customerName && partnerName) return "both";
  if (customerName) return "customer_only";
  if (partnerName) return "partner_only";
  return "none";
}

export function hasStructuredCoupleNames(state: Pick<WeddingSalesState, "customerName" | "partnerName" | "names">) {
  if (state.customerName && state.partnerName) {
    return true;
  }

  return Boolean(state.names && /\s+(?:and|&)\s+/i.test(state.names));
}

export function migrateWeddingSalesNames(state: Partial<WeddingSalesState>): StructuredNameState {
  let customerName = cleanNamePart(state.customerName);
  let partnerName = cleanNamePart(state.partnerName);

  if ((!customerName || !partnerName) && state.names) {
    const [first, second] = splitCoupleNames(state.names);

    customerName = customerName ?? first;
    partnerName = partnerName ?? second;

    if (!customerName && !second) {
      customerName = first;
    }
  }

  const coupleDisplayName = displayName(customerName, partnerName);

  return {
    customerName,
    partnerName,
    coupleDisplayName,
    nameCollectionStatus: state.nameCollectionStatus ?? statusFor(customerName, partnerName),
    names: coupleDisplayName,
  };
}

export function mergeNamesFromSemanticV2(args: {
  state: WeddingSalesState;
  candidate: string;
  evidence?: string;
}): StructuredNameState {
  const current = migrateWeddingSalesNames(args.state);
  const [first, second] = splitCoupleNames(args.candidate);
  const single = first;
  const evidence = args.evidence ?? "";
  let customerName = current.customerName;
  let partnerName = current.partnerName;

  if (first && second) {
    customerName = customerName ?? first;
    partnerName = partnerName ?? second;

    if (
      current.nameCollectionStatus !== "both" &&
      (!current.customerName || current.customerName.toLowerCase() === first.toLowerCase())
    ) {
      customerName = first;
      partnerName = second;
    }
  } else if (single) {
    if (PARTNER_EVIDENCE_PATTERN.test(evidence)) {
      partnerName = partnerName ?? single;
    } else if (CUSTOMER_EVIDENCE_PATTERN.test(evidence)) {
      customerName = customerName ?? single;
    } else if (!customerName) {
      customerName = single;
    } else if (!partnerName && customerName.toLowerCase() !== single.toLowerCase()) {
      partnerName = single;
    }
  }

  const coupleDisplayName = displayName(customerName, partnerName);

  return {
    customerName,
    partnerName,
    coupleDisplayName,
    nameCollectionStatus: statusFor(customerName, partnerName),
    names: coupleDisplayName,
  };
}

export function mergeNameRoleFromSemanticV2(args: {
  state: WeddingSalesState;
  role: "customerName" | "partnerName";
  provided: SemanticProvidedValueV2;
}): StructuredNameState {
  const current = migrateWeddingSalesNames(args.state);
  const value = cleanNamePart(args.provided.normalizedValue ?? args.provided.value);
  let customerName = current.customerName;
  let partnerName = current.partnerName;

  if (args.role === "customerName") {
    customerName = value ?? customerName;
    if (partnerName && customerName?.toLowerCase() === partnerName.toLowerCase()) {
      partnerName = undefined;
    }
  } else {
    partnerName = assignDistinctPartner(customerName, value) ?? partnerName;
  }

  const coupleDisplayName = displayName(customerName, partnerName);

  return {
    customerName,
    partnerName,
    coupleDisplayName,
    nameCollectionStatus: statusFor(customerName, partnerName),
    names: coupleDisplayName,
  };
}
