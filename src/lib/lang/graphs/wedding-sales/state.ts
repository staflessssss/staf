import { Annotation } from "@langchain/langgraph";

import type { WeddingSalesActionPlan } from "./action-plan/schema";
import type { SemanticAnalysisV2, WeddingSalesField } from "./semantic-v2/schema";
import type {
  WeddingSalesClientType,
  WeddingSalesNameCollectionStatus,
  WeddingSalesPendingConfirmation,
  WeddingSalesStateMutationTrace,
} from "./state-v2/schema";

export type WeddingSalesChannel = "gmail" | "instagram" | "telegram";

export type WeddingSalesLeadStage =
  | "new"
  | "missing_names_or_date"
  | "waiting_wedding_year"
  | "confirming_change"
  | "ready_for_availability"
  | "availability_checked"
  | "answering_question"
  | "missing_location_or_venue"
  | "asking_call_time"
  | "call_proposed"
  | "checking_calendar"
  | "waiting_customer_email"
  | "ready_to_book"
  | "booked"
  | "ignored";

export type WeddingSalesState = {
  tenantId?: string;
  agentId?: string;
  contactId?: string;
  channel: WeddingSalesChannel;
  leadStage: WeddingSalesLeadStage;
  names?: string;
  customerName?: string;
  partnerName?: string;
  coupleDisplayName?: string;
  nameCollectionStatus?: WeddingSalesNameCollectionStatus;
  weddingDate?: string;
  weddingDateText?: string;
  weddingYear?: string;
  weddingYearKnown: boolean;
  location?: string;
  venue?: string;
  customerEmail?: string;
  availability?: "available" | "unavailable";
  availabilityRegion?: string;
  guideSent: boolean;
  callProposed: boolean;
  proposedCallTime?: string;
  calendarStatus?: "available" | "busy";
  checkedCallDate?: string;
  checkedCallTime?: string;
  checkedCallStartTime?: string;
  checkedCallEndTime?: string;
  bookingConfirmed: boolean;
  bookedEventId?: string;
  toolObservations: Array<{
    toolName: string;
    result: string;
  }>;
  turnToolObservations: Array<{
    toolName: string;
    result: string;
  }>;
  conversationSummary?: string;
  conversationContext?: string;
  latestCustomerMessage?: string;
  responseDraft?: string;
  assistantReplyCount: number;
  hasGreeted: boolean;
  signatureSent: boolean;
  portfolioSent: boolean;
  reviewsSent: boolean;
  guideOffered: boolean;
  askedForNames: boolean;
  askedForWeddingYear: boolean;
  askedForVenue: boolean;
  askedForCallTime: boolean;
  askedForEmail: boolean;
  lastAssistantIntent?: string;
  pendingChangeField?: "weddingDate" | "location";
  pendingChangeValue?: string;
  pendingChangeDisplay?: string;
  changeConfirmationRejected?: boolean;
  semanticStateVersion?: 2;
  clientType?: WeddingSalesClientType;
  pendingConfirmations?: WeddingSalesPendingConfirmation[];
  askedFieldCounts?: Partial<Record<WeddingSalesField, number>>;
  answeredFaqTopics?: string[];
  consecutiveSemanticFailures?: number;
  lastSemanticAnalysis?: SemanticAnalysisV2;
  lastStateMutationTrace?: WeddingSalesStateMutationTrace;
  lastActionPlan?: WeddingSalesActionPlan;
};

export const WeddingSalesStateAnnotation = Annotation.Root({
  tenantId: Annotation<string | undefined>(),
  agentId: Annotation<string | undefined>(),
  contactId: Annotation<string | undefined>(),
  channel: Annotation<WeddingSalesChannel>(),
  leadStage: Annotation<WeddingSalesLeadStage>(),
  names: Annotation<string | undefined>(),
  customerName: Annotation<string | undefined>(),
  partnerName: Annotation<string | undefined>(),
  coupleDisplayName: Annotation<string | undefined>(),
  nameCollectionStatus: Annotation<WeddingSalesNameCollectionStatus | undefined>(),
  weddingDate: Annotation<string | undefined>(),
  weddingDateText: Annotation<string | undefined>(),
  weddingYear: Annotation<string | undefined>(),
  weddingYearKnown: Annotation<boolean>(),
  location: Annotation<string | undefined>(),
  venue: Annotation<string | undefined>(),
  customerEmail: Annotation<string | undefined>(),
  availability: Annotation<"available" | "unavailable" | undefined>(),
  availabilityRegion: Annotation<string | undefined>(),
  guideSent: Annotation<boolean>(),
  callProposed: Annotation<boolean>(),
  proposedCallTime: Annotation<string | undefined>(),
  calendarStatus: Annotation<"available" | "busy" | undefined>(),
  checkedCallDate: Annotation<string | undefined>(),
  checkedCallTime: Annotation<string | undefined>(),
  checkedCallStartTime: Annotation<string | undefined>(),
  checkedCallEndTime: Annotation<string | undefined>(),
  bookingConfirmed: Annotation<boolean>(),
  bookedEventId: Annotation<string | undefined>(),
  toolObservations: Annotation<Array<{ toolName: string; result: string }>>({
    reducer: (current, update) => [...(current ?? []), ...(update ?? [])],
    default: () => [],
  }),
  turnToolObservations: Annotation<Array<{ toolName: string; result: string }>>({
    reducer: (_current, update) => update ?? [],
    default: () => [],
  }),
  conversationSummary: Annotation<string | undefined>(),
  conversationContext: Annotation<string | undefined>(),
  latestCustomerMessage: Annotation<string | undefined>(),
  responseDraft: Annotation<string | undefined>(),
  assistantReplyCount: Annotation<number>(),
  hasGreeted: Annotation<boolean>(),
  signatureSent: Annotation<boolean>(),
  portfolioSent: Annotation<boolean>(),
  reviewsSent: Annotation<boolean>(),
  guideOffered: Annotation<boolean>(),
  askedForNames: Annotation<boolean>(),
  askedForWeddingYear: Annotation<boolean>(),
  askedForVenue: Annotation<boolean>(),
  askedForCallTime: Annotation<boolean>(),
  askedForEmail: Annotation<boolean>(),
  lastAssistantIntent: Annotation<string | undefined>(),
  pendingChangeField: Annotation<"weddingDate" | "location" | undefined>(),
  pendingChangeValue: Annotation<string | undefined>(),
  pendingChangeDisplay: Annotation<string | undefined>(),
  changeConfirmationRejected: Annotation<boolean | undefined>(),
  semanticStateVersion: Annotation<2 | undefined>(),
  clientType: Annotation<WeddingSalesClientType | undefined>(),
  pendingConfirmations: Annotation<WeddingSalesPendingConfirmation[] | undefined>(),
  askedFieldCounts: Annotation<Partial<Record<WeddingSalesField, number>> | undefined>(),
  answeredFaqTopics: Annotation<string[] | undefined>(),
  consecutiveSemanticFailures: Annotation<number | undefined>(),
  lastSemanticAnalysis: Annotation<SemanticAnalysisV2 | undefined>(),
  lastStateMutationTrace: Annotation<WeddingSalesStateMutationTrace | undefined>(),
  lastActionPlan: Annotation<WeddingSalesActionPlan | undefined>(),
});

export function createInitialWeddingSalesState(args: {
  tenantId?: string;
  agentId?: string;
  contactId?: string;
  channel: WeddingSalesChannel;
  message: string;
  customerEmail?: string;
  conversationContext?: string;
  previousState?: Partial<WeddingSalesState>;
}): WeddingSalesState {
  return {
    tenantId: args.tenantId ?? args.previousState?.tenantId,
    agentId: args.agentId ?? args.previousState?.agentId,
    contactId: args.contactId ?? args.previousState?.contactId,
    channel: args.channel,
    leadStage: args.previousState?.leadStage ?? "new",
    names: args.previousState?.names,
    customerName: args.previousState?.customerName,
    partnerName: args.previousState?.partnerName,
    coupleDisplayName: args.previousState?.coupleDisplayName,
    nameCollectionStatus: args.previousState?.nameCollectionStatus,
    weddingDate: args.previousState?.weddingDate,
    weddingDateText: args.previousState?.weddingDateText,
    weddingYear: args.previousState?.weddingYear,
    weddingYearKnown: args.previousState?.weddingYearKnown ?? false,
    location: args.previousState?.location,
    venue: args.previousState?.venue,
    customerEmail: args.previousState?.customerEmail ?? args.customerEmail,
    availability: args.previousState?.availability,
    availabilityRegion: args.previousState?.availabilityRegion,
    guideSent: args.previousState?.guideSent ?? false,
    callProposed: args.previousState?.callProposed ?? false,
    proposedCallTime: args.previousState?.proposedCallTime,
    calendarStatus: args.previousState?.calendarStatus,
    checkedCallDate: args.previousState?.checkedCallDate,
    checkedCallTime: args.previousState?.checkedCallTime,
    checkedCallStartTime: args.previousState?.checkedCallStartTime,
    checkedCallEndTime: args.previousState?.checkedCallEndTime,
    bookingConfirmed: args.previousState?.bookingConfirmed ?? false,
    bookedEventId: args.previousState?.bookedEventId,
    toolObservations: [],
    turnToolObservations: [],
    conversationSummary: args.previousState?.conversationSummary,
    conversationContext: args.conversationContext ?? args.previousState?.conversationContext,
    latestCustomerMessage: args.message,
    responseDraft: args.previousState?.responseDraft,
    assistantReplyCount: args.previousState?.assistantReplyCount ?? 0,
    hasGreeted: args.previousState?.hasGreeted ?? false,
    signatureSent: args.previousState?.signatureSent ?? false,
    portfolioSent: args.previousState?.portfolioSent ?? false,
    reviewsSent: args.previousState?.reviewsSent ?? false,
    guideOffered: args.previousState?.guideOffered ?? false,
    askedForNames: args.previousState?.askedForNames ?? false,
    askedForWeddingYear: args.previousState?.askedForWeddingYear ?? false,
    askedForVenue: args.previousState?.askedForVenue ?? false,
    askedForCallTime: args.previousState?.askedForCallTime ?? false,
    askedForEmail: args.previousState?.askedForEmail ?? false,
    lastAssistantIntent: args.previousState?.lastAssistantIntent,
    pendingChangeField: args.previousState?.pendingChangeField,
    pendingChangeValue: args.previousState?.pendingChangeValue,
    pendingChangeDisplay: args.previousState?.pendingChangeDisplay,
    changeConfirmationRejected: args.previousState?.changeConfirmationRejected,
    semanticStateVersion: args.previousState?.semanticStateVersion,
    clientType: args.previousState?.clientType,
    pendingConfirmations: args.previousState?.pendingConfirmations,
    askedFieldCounts: args.previousState?.askedFieldCounts,
    answeredFaqTopics: args.previousState?.answeredFaqTopics,
    consecutiveSemanticFailures: args.previousState?.consecutiveSemanticFailures,
    lastSemanticAnalysis: args.previousState?.lastSemanticAnalysis,
    lastStateMutationTrace: args.previousState?.lastStateMutationTrace,
    lastActionPlan: args.previousState?.lastActionPlan,
  };
}
