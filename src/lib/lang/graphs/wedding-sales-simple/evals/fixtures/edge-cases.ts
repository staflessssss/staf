import type { SimpleWeddingSalesReplayTurn } from "./instagram-short-dms";

export const dateChangeAfterAvailabilityReplay: SimpleWeddingSalesReplayTurn[] = [
  {
    message: "Are you available June 14 2027 in Tampa?",
    understanding: {
      customerMessageType: "availability_question",
      facts: {
        weddingDate: "2027-06-14",
        weddingDateText: "June 14 2027",
        location: "Tampa",
      },
      questionsAskedByCustomer: ["availability"],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_missing_info",
      toolCalls: ["check_wedding_availability"],
    },
  },
  {
    message: "Actually June 15 2027",
    understanding: {
      customerMessageType: "answer_to_question",
      facts: {
        weddingDate: "2027-06-15",
        weddingDateText: "June 15 2027",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_missing_info",
      toolCalls: ["check_wedding_availability"],
      replyIncludes: [/June 15, 2027 in Tampa.*date is available/i],
    },
  },
];

export const locationChangeAfterAvailabilityReplay: SimpleWeddingSalesReplayTurn[] = [
  {
    message: "Are you available June 14 2027 in Tampa?",
    understanding: {
      customerMessageType: "availability_question",
      facts: {
        weddingDate: "2027-06-14",
        weddingDateText: "June 14 2027",
        location: "Tampa",
      },
      questionsAskedByCustomer: ["availability"],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_missing_info",
      toolCalls: ["check_wedding_availability"],
    },
  },
  {
    message: "Actually Orlando",
    understanding: {
      customerMessageType: "answer_to_question",
      facts: {
        location: "Orlando",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_missing_info",
      toolCalls: ["check_wedding_availability"],
      replyIncludes: [/June 14, 2027 in Orlando.*date is available/i],
    },
  },
];

export const callTimeChangeReplay: SimpleWeddingSalesReplayTurn[] = [
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
    },
  },
  {
    message: "Actually 4pm",
    understanding: {
      customerMessageType: "call_time_proposed",
      facts: {
        proposedCallTime: "2026-06-24T16:00:00-04:00",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_email",
      toolCalls: ["check_consultation_calendar"],
      replyIncludes: [/16:00 works perfectly for a call/i],
    },
  },
];
