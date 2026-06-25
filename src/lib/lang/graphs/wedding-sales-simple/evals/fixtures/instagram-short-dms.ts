import type { TurnUnderstanding } from "../../state";

export type SimpleWeddingSalesReplayTurn = {
  message: string;
  understanding: TurnUnderstanding;
  expect: {
    nextStep: string;
    toolCalls: string[];
    replyIncludes?: RegExp[];
    replyExcludes?: RegExp[];
  };
};

export const instagramBookingReplay: SimpleWeddingSalesReplayTurn[] = [
  {
    message: "Hi price?",
    understanding: {
      customerMessageType: "business_question",
      facts: {},
      questionsAskedByCustomer: ["pricing"],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_missing_info",
      toolCalls: [],
      replyIncludes: [/wedding films start at/i, /What date/i],
    },
  },
  {
    message: "June 14 2027",
    understanding: {
      customerMessageType: "answer_to_question",
      facts: {
        weddingDate: "2027-06-14",
        weddingDateText: "June 14 2027",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_missing_info",
      toolCalls: [],
      replyIncludes: [/city or area/i],
    },
  },
  {
    message: "Tampa",
    understanding: {
      customerMessageType: "answer_to_question",
      facts: {
        location: "Tampa",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_missing_info",
      toolCalls: ["check_wedding_availability"],
      replyIncludes: [/June 14, 2027.*available/i, /both of your names/i],
    },
  },
  {
    message: "Anna and Mark",
    understanding: {
      customerMessageType: "answer_to_question",
      facts: {
        customerName: "Anna",
        partnerName: "Mark",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_venue",
      toolCalls: [],
      replyIncludes: [/venue picked out/i],
    },
  },
  {
    message: "Oxford Exchange",
    understanding: {
      customerMessageType: "answer_to_question",
      facts: {
        venue: "Oxford Exchange",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_call_time",
      toolCalls: [],
      replyIncludes: [/What time works best/i],
    },
  },
  {
    message: "June 24 at 1pm",
    understanding: {
      customerMessageType: "call_time_proposed",
      facts: {
        proposedCallTime: "2026-06-24T13:00:00-04:00",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_email",
      toolCalls: ["check_consultation_calendar"],
      replyIncludes: [/works on my calendar/i, /best email/i],
    },
  },
  {
    message: "yes book it. my email is anna@gmail.com",
    understanding: {
      customerMessageType: "email_provided",
      facts: {
        email: "anna@gmail.com",
      },
      questionsAskedByCustomer: ["booking"],
      confidence: 0.95,
    },
    expect: {
      nextStep: "reply_only",
      toolCalls: ["book_consultation"],
      replyIncludes: [/all set/i, /calendar invite/i],
    },
  },
];

export const instagramEdgeCaseTurns: SimpleWeddingSalesReplayTurn[] = [
  {
    message: "Before we finish, can I speak directly with Taras?",
    understanding: {
      customerMessageType: "business_question",
      facts: {},
      questionsAskedByCustomer: ["identity"],
      confidence: 0.95,
    },
    expect: {
      nextStep: "reply_only",
      toolCalls: [],
      replyIncludes: [/speaking with me here.*I'm Taras/i],
    },
  },
];
