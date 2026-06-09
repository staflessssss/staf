import { Annotation } from "@langchain/langgraph";

export type WeddingSalesChannel = "gmail" | "instagram" | "telegram";

export type WeddingSalesLeadStage =
  | "new"
  | "missing_names_or_date"
  | "waiting_wedding_year"
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
  channel: WeddingSalesChannel;
  leadStage: WeddingSalesLeadStage;
  names?: string;
  weddingDate?: string;
  weddingDateText?: string;
  weddingYear?: string;
  weddingYearKnown: boolean;
  location?: string;
  venue?: string;
  customerEmail?: string;
  availability?: "available" | "unavailable";
  guideSent: boolean;
  callProposed: boolean;
  proposedCallTime?: string;
  calendarStatus?: "available" | "busy";
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
};

export const WeddingSalesStateAnnotation = Annotation.Root({
  channel: Annotation<WeddingSalesChannel>(),
  leadStage: Annotation<WeddingSalesLeadStage>(),
  names: Annotation<string | undefined>(),
  weddingDate: Annotation<string | undefined>(),
  weddingDateText: Annotation<string | undefined>(),
  weddingYear: Annotation<string | undefined>(),
  weddingYearKnown: Annotation<boolean>(),
  location: Annotation<string | undefined>(),
  venue: Annotation<string | undefined>(),
  customerEmail: Annotation<string | undefined>(),
  availability: Annotation<"available" | "unavailable" | undefined>(),
  guideSent: Annotation<boolean>(),
  callProposed: Annotation<boolean>(),
  proposedCallTime: Annotation<string | undefined>(),
  calendarStatus: Annotation<"available" | "busy" | undefined>(),
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
});

export function createInitialWeddingSalesState(args: {
  channel: WeddingSalesChannel;
  message: string;
  customerEmail?: string;
  conversationContext?: string;
  previousState?: Partial<WeddingSalesState>;
}): WeddingSalesState {
  return {
    channel: args.channel,
    leadStage: args.previousState?.leadStage ?? "new",
    names: args.previousState?.names,
    weddingDate: args.previousState?.weddingDate,
    weddingDateText: args.previousState?.weddingDateText,
    weddingYear: args.previousState?.weddingYear,
    weddingYearKnown: args.previousState?.weddingYearKnown ?? false,
    location: args.previousState?.location,
    venue: args.previousState?.venue,
    customerEmail: args.previousState?.customerEmail ?? args.customerEmail,
    availability: args.previousState?.availability,
    guideSent: args.previousState?.guideSent ?? false,
    callProposed: args.previousState?.callProposed ?? false,
    proposedCallTime: args.previousState?.proposedCallTime,
    calendarStatus: args.previousState?.calendarStatus,
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
  };
}
