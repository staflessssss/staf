import type { SemanticAnalysisV2, WeddingSalesField } from "../semantic-v2/schema";

export type WeddingSalesClientType =
  | "new_lead"
  | "existing_client"
  | "past_client"
  | "planner"
  | "vendor"
  | "unknown";

export type WeddingSalesPendingConfirmation = {
  field: WeddingSalesField;
  value: string;
  displayValue?: string;
  reason: string;
};

export type WeddingSalesNameCollectionStatus =
  | "none"
  | "customer_only"
  | "partner_only"
  | "both"
  | "ambiguous"
  | "pending";

export type WeddingSalesStateMutationTraceEntry = {
  field?: WeddingSalesField;
  action:
    | "accepted"
    | "rejected"
    | "pending"
    | "resolved"
    | "cleared"
    | "stage_selected";
  value?: string;
  reason: string;
};

export type WeddingSalesStateMutationTrace = WeddingSalesStateMutationTraceEntry[];

export type WeddingSalesSemanticStateFields = {
  semanticStateVersion?: 2;
  clientType?: WeddingSalesClientType;
  customerName?: string;
  partnerName?: string;
  knownNames?: string[];
  nameCount?: number;
  nameRolesUncertain?: boolean;
  coupleDisplayName?: string;
  nameCollectionStatus?: WeddingSalesNameCollectionStatus;
  pendingConfirmations?: WeddingSalesPendingConfirmation[];
  askedFieldCounts?: Partial<Record<WeddingSalesField, number>>;
  answeredFaqTopics?: string[];
  consecutiveSemanticFailures?: number;
  lastSemanticAnalysis?: SemanticAnalysisV2;
  lastStateMutationTrace?: WeddingSalesStateMutationTrace;
};
