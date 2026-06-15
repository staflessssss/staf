import type { SemanticProvidedValueV2 } from "../semantic-v2/schema";
import type { WeddingSalesState } from "../state";
import type { WeddingSalesNameCollectionStatus } from "./schema";

type StructuredNameState = Pick<
  WeddingSalesState,
  | "customerName"
  | "partnerName"
  | "knownNames"
  | "nameCount"
  | "nameRolesUncertain"
  | "coupleDisplayName"
  | "nameCollectionStatus"
  | "names"
>;

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

function uniqueNames(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const name = cleanNamePart(value);
    const key = name?.toLowerCase();

    if (!name || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(name);
  }

  return result;
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
  if ((state as Partial<WeddingSalesState>).nameCount && (state as Partial<WeddingSalesState>).nameCount! >= 2) {
    return true;
  }

  if ((state as Partial<WeddingSalesState>).knownNames?.length && (state as Partial<WeddingSalesState>).knownNames!.length >= 2) {
    return true;
  }

  if (state.customerName && state.partnerName) {
    return true;
  }

  return Boolean(state.names && /\s+(?:and|&)\s+/i.test(state.names));
}

export function migrateWeddingSalesNames(state: Partial<WeddingSalesState>): StructuredNameState {
  let customerName = cleanNamePart(state.customerName);
  let partnerName = cleanNamePart(state.partnerName);
  let knownNames = uniqueNames(state.knownNames ?? []);

  if ((!customerName || !partnerName) && state.names) {
    const [first, second] = splitCoupleNames(state.names);

    customerName = customerName ?? first;
    partnerName = partnerName ?? second;
    knownNames = uniqueNames([...knownNames, first, second]);

    if (!customerName && !second) {
      customerName = first;
      knownNames = uniqueNames([...knownNames, first]);
    }
  }

  if ((!customerName || !partnerName) && knownNames.length >= 2) {
    customerName = customerName ?? knownNames[0];
    partnerName = partnerName ?? assignDistinctPartner(customerName, knownNames[1]);
  }

  knownNames = uniqueNames([...knownNames, customerName, partnerName]);

  const coupleDisplayName = displayName(customerName, partnerName);
  const nameCount = knownNames.length || undefined;

  return {
    customerName,
    partnerName,
    knownNames: knownNames.length ? knownNames : undefined,
    nameCount,
    nameRolesUncertain: state.nameRolesUncertain && knownNames.length >= 2 ? true : undefined,
    coupleDisplayName,
    nameCollectionStatus: state.nameCollectionStatus ?? statusFor(customerName, partnerName),
    names: coupleDisplayName ?? (knownNames.length >= 2 ? `${knownNames[0]} and ${knownNames[1]}` : knownNames[0]),
  };
}

export function mergeNameRoleFromSemanticV2(args: {
  state: WeddingSalesState;
  role: "customerName" | "partnerName";
  provided: SemanticProvidedValueV2;
}): StructuredNameState {
  const current = migrateWeddingSalesNames(args.state);
  const value = cleanNamePart(args.provided.normalizedValue ?? args.provided.value);

  const providedPair = splitCoupleNames(value);

  if (providedPair.length >= 2) {
    return mergeKnownCoupleNames({
      state: args.state,
      names: providedPair,
      rolesUncertain: true,
    });
  }

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
  const knownNames = uniqueNames([...(current.knownNames ?? []), customerName, partnerName]);

  return {
    customerName,
    partnerName,
    knownNames: knownNames.length ? knownNames : undefined,
    nameCount: knownNames.length || undefined,
    nameRolesUncertain: current.nameRolesUncertain,
    coupleDisplayName,
    nameCollectionStatus: statusFor(customerName, partnerName),
    names: coupleDisplayName,
  };
}

export function inferCoupleNamesFromRequestedAnswer(message: string | undefined) {
  if (!message) {
    return [];
  }

  const segments = message
    .split(/[\n.!?]/)
    .map((segment) =>
      segment
        .trim()
        .replace(/^(?:hi|hey|hello|hi there|hey there)\b[,\s!]*/i, "")
        .replace(/^(?:it'?s|it is|we are|we're|this is|our names are|names are)\b[,\s]*/i, ""),
    )
    .filter(Boolean);

  for (const segment of segments) {
    if (/\d|@/.test(segment)) {
      continue;
    }

    const match = segment.match(/\b([A-Za-z][A-Za-z'-]{1,40})\s*(?:and|&)\s*([A-Za-z][A-Za-z'-]{1,40})\b/i);
    const names = uniqueNames([match?.[1], match?.[2]]);

    if (names.length >= 2) {
      return names.slice(0, 2);
    }
  }

  return [];
}

export function mergeKnownCoupleNames(args: {
  state: WeddingSalesState;
  names: string[];
  rolesUncertain?: boolean;
}): StructuredNameState {
  const current = migrateWeddingSalesNames(args.state);
  const knownNames = uniqueNames([...(current.knownNames ?? []), ...args.names]);
  let customerName = current.customerName;
  let partnerName = current.partnerName;

  if (knownNames.length >= 2) {
    customerName = customerName ?? knownNames[0];
    partnerName = partnerName ?? assignDistinctPartner(customerName, knownNames[1]);
  } else if (knownNames.length === 1) {
    customerName = customerName ?? knownNames[0];
  }

  const finalKnownNames = uniqueNames([...knownNames, customerName, partnerName]);
  const coupleDisplayName = displayName(customerName, partnerName);

  return {
    customerName,
    partnerName,
    knownNames: finalKnownNames.length ? finalKnownNames : undefined,
    nameCount: finalKnownNames.length || undefined,
    nameRolesUncertain: args.rolesUncertain && finalKnownNames.length >= 2 ? true : current.nameRolesUncertain,
    coupleDisplayName,
    nameCollectionStatus: statusFor(customerName, partnerName),
    names: coupleDisplayName ?? (finalKnownNames.length >= 2 ? `${finalKnownNames[0]} and ${finalKnownNames[1]}` : finalKnownNames[0]),
  };
}
