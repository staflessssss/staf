import { Annotation } from "@langchain/langgraph";

export type WeddingSalesChannel = "gmail" | "instagram" | "telegram";

export type WeddingSalesLeadStage =
  | "new"
  | "missing_names_or_date"
  | "waiting_wedding_year"
  | "ready_for_availability"
  | "availability_checked"
  | "call_proposed"
  | "checking_calendar"
  | "ready_to_book"
  | "booked"
  | "ignored";

export type WeddingSalesState = {
  channel: WeddingSalesChannel;
  leadStage: WeddingSalesLeadStage;
  names?: string;
  weddingDate?: string;
  weddingYearKnown: boolean;
  location?: string;
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
  latestCustomerMessage?: string;
  responseDraft?: string;
};

export const WeddingSalesStateAnnotation = Annotation.Root({
  channel: Annotation<WeddingSalesChannel>(),
  leadStage: Annotation<WeddingSalesLeadStage>(),
  names: Annotation<string | undefined>(),
  weddingDate: Annotation<string | undefined>(),
  weddingYearKnown: Annotation<boolean>(),
  location: Annotation<string | undefined>(),
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
  latestCustomerMessage: Annotation<string | undefined>(),
  responseDraft: Annotation<string | undefined>(),
});

export function createInitialWeddingSalesState(args: {
  channel: WeddingSalesChannel;
  message: string;
  previousState?: Partial<WeddingSalesState>;
}): WeddingSalesState {
  return {
    channel: args.channel,
    leadStage: args.previousState?.leadStage ?? "new",
    names: args.previousState?.names,
    weddingDate: args.previousState?.weddingDate,
    weddingYearKnown: args.previousState?.weddingYearKnown ?? false,
    location: args.previousState?.location,
    availability: args.previousState?.availability,
    guideSent: args.previousState?.guideSent ?? false,
    callProposed: args.previousState?.callProposed ?? false,
    proposedCallTime: args.previousState?.proposedCallTime,
    calendarStatus: args.previousState?.calendarStatus,
    bookingConfirmed: args.previousState?.bookingConfirmed ?? false,
    bookedEventId: args.previousState?.bookedEventId,
    toolObservations: [],
    latestCustomerMessage: args.message,
    responseDraft: undefined,
  };
}
