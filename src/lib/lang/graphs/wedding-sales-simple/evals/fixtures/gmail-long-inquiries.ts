import type { SimpleWeddingSalesReplayTurn } from "./instagram-short-dms";

export const gmailLongInquiryReplay: SimpleWeddingSalesReplayTurn[] = [
  {
    message:
      "Hi, we are Anna and Mark. We are getting married on June 14 2027 in Tampa at Oxford Exchange. Are you available, and what do your packages start at?",
    understanding: {
      customerMessageType: "availability_question",
      facts: {
        customerName: "Anna",
        partnerName: "Mark",
        weddingDate: "2027-06-14",
        weddingDateText: "June 14 2027",
        location: "Tampa",
        venue: "Oxford Exchange",
      },
      questionsAskedByCustomer: ["availability", "pricing"],
      confidence: 0.95,
    },
    expect: {
      nextStep: "ask_call_time",
      toolCalls: ["check_wedding_availability"],
      replyIncludes: [
        /I have date: June 14, 2027, location: Tampa, venue: Oxford Exchange/i,
        /collections start at/i,
        /good time for a quick call/i,
      ],
    },
  },
  {
    message: "June 24 at 1pm works. You can use anna@gmail.com.",
    understanding: {
      customerMessageType: "call_time_proposed",
      facts: {
        email: "anna@gmail.com",
        proposedCallTime: "2026-06-24T13:00:00-04:00",
      },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    expect: {
      nextStep: "reply_only",
      toolCalls: ["check_consultation_calendar", "book_consultation"],
      replyIncludes: [/booked the call/i],
    },
  },
];
