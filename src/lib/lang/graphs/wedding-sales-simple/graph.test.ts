import assert from "node:assert/strict";
import test from "node:test";

import { invokeWeddingSalesSimpleGraph } from "./graph";
import type { TurnUnderstanding } from "./state";

function understanding(update: Partial<TurnUnderstanding>): TurnUnderstanding {
  return {
    customerMessageType: "answer_to_question",
    facts: {},
    questionsAskedByCustomer: [],
    confidence: 0.95,
    ...update,
  };
}

const toolContext = {
  tenantId: "tenant-1",
  testMode: true,
  weddingAvailability: {
    action: "capacity availability",
    params: {},
  },
  consultationCalendar: {
    action: "check calendar",
    params: {
      checkConflictsBeforeBooking: false,
    },
  },
  bookConsultation: {
    action: "book call",
    params: {
      checkConflictsBeforeBooking: false,
    },
  },
};

test("simple wedding sales runtime checks availability before asking for names", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Hi! Are you available for June 14 2027 in Tampa? Also how much are packages?",
    toolContext,
    understand: () =>
      understanding({
        customerMessageType: "availability_question",
        facts: {
          weddingDate: "2027-06-14",
          weddingDateText: "June 14 2027",
          location: "Tampa",
        },
        questionsAskedByCustomer: ["availability", "pricing"],
      }),
  });

  assert.equal(result.weddingDate, "2027-06-14");
  assert.equal(result.location, "Tampa");
  assert.equal(result.availability, "available");
  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.missingField, "names");
  assert.equal(result.decisionTrace?.toolCalled, "checkAvailability");
  assert.equal(result.decisionTrace?.replyType, "availability_available");
  assert.match(result.decisionTrace?.reason ?? "", /names are the next qualification field/i);
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_wedding_availability"],
  );
  assert.match(result.responseDraft ?? "", /June 14, 2027 in Tampa.*date is available/i);
  assert.match(result.responseDraft ?? "", /wedding films start at/i);
  assert.match(result.responseDraft ?? "", /both of your names/i);
});

test("simple wedding sales runtime greets once and does not repeat availability after names", async () => {
  const first = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Hi! Are you available for June 14 2027 in Tampa? How much are your packages?",
    understand: () =>
      understanding({
        customerMessageType: "new_lead",
        facts: { weddingDate: "2027-06-14", location: "Tampa" },
        questionsAskedByCustomer: ["availability", "pricing"],
      }),
    toolContext,
  });

  assert.match(first.responseDraft ?? "", /^Hey there! Thank you so much for reaching out 🤍✨/i);
  assert.match(first.responseDraft ?? "", /I’m Taras, the founder of Myndful Films/i);
  assert.match(first.responseDraft ?? "", /June 14, 2027 in Tampa.*date is available/i);
  assert.doesNotMatch(first.responseDraft ?? "", /open for us/i);

  const second = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Mike and Sarah",
    previousState: first,
    understand: () =>
      understanding({
        facts: { customerName: "Mike", partnerName: "Sarah" },
      }),
    toolContext,
  });

  assert.doesNotMatch(second.responseDraft ?? "", /^Hey there!/i);
  assert.doesNotMatch(second.responseDraft ?? "", /is open for us/i);
  assert.doesNotMatch(second.responseDraft ?? "", /both of your names/i);
  assert.match(second.responseDraft ?? "", /venue/i);
});

test("simple wedding sales runtime answers pricing but asks for date before tools", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "How much are your packages?",
    toolContext,
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        questionsAskedByCustomer: ["pricing"],
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.missingField, "weddingDate");
  assert.equal(result.decisionTrace?.replyType, "pricing_answer");
  assert.deepEqual(result.toolObservations, []);
  assert.match(result.responseDraft ?? "", /wedding films start at/i);
  assert.match(result.responseDraft ?? "", /What date are you looking at/i);
});

test("simple wedding sales runtime checks consultation time and asks for email", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "June 24 at 1pm works for a call",
    toolContext,
    previousState: {
      customerName: "Anna",
      partnerName: "Mark",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "Oxford Exchange",
      availability: "available",
      availabilityContextDate: "2027-06-14",
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "2026-06-24T13:00:00-04:00",
        },
      }),
  });

  assert.equal(result.nextStep, "ask_email");
  assert.equal(result.calendarStatus, "available");
  assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
  assert.match(result.responseDraft ?? "", /works perfectly for a call/i);
  assert.doesNotMatch(result.responseDraft ?? "", /June 14, 2027|date is available/i);
  assert.match(result.responseDraft ?? "", /best email/i);
});

test("simple wedding sales runtime books after email when calendar is available", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "anna@example.com",
    toolContext,
    previousState: {
      customerName: "Anna",
      partnerName: "Mark",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "Oxford Exchange",
      availability: "available",
      availabilityContextDate: "2027-06-14",
      proposedCallTime: "2026-06-24T13:00:00-04:00",
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "2026-06-24T13:00:00-04:00",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
      checkedCallDate: "2026-06-24",
      checkedCallTime: "13:00",
      checkedCallStartTime: "2026-06-24T13:00:00-04:00",
      checkedCallEndTime: "2026-06-24T13:30:00-04:00",
    },
    understand: () =>
      understanding({
        customerMessageType: "email_provided",
        facts: {
          email: "anna@example.com",
        },
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.bookingConfirmed, true);
  assert.equal(result.decisionTrace?.toolCalled, "bookCall");
  assert.equal(result.decisionTrace?.replyType, "booking_confirmed");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["book_consultation"],
  );
  assert.match(result.responseDraft ?? "", /I booked the call/i);
  assert.doesNotMatch(result.responseDraft ?? "", /works perfectly for a call/i);
});

test("simple wedding sales replies avoid known robotic phrases", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "How much are packages?",
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        questionsAskedByCustomer: ["pricing"],
      }),
  });

  assert.doesNotMatch(result.responseDraft ?? "", /please provide/i);
  assert.doesNotMatch(result.responseDraft ?? "", /to better assist you/i);
  assert.doesNotMatch(result.responseDraft ?? "", /tailored to your special day/i);
});

test("simple wedding sales runtime does not recheck availability for the same date and location", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Great, how much are packages?",
    toolContext,
    previousState: {
      weddingDate: "2027-06-14",
      location: "Tampa",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        questionsAskedByCustomer: ["pricing"],
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.missingField, "names");
  assert.deepEqual(result.toolObservations, []);
  assert.equal(result.decisionTrace?.toolCalled, undefined);
  assert.match(result.responseDraft ?? "", /wedding films start at/i);
});

test("simple wedding sales runtime rechecks availability when the customer changes date", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Actually it is June 15 2027",
    toolContext,
    previousState: {
      weddingDate: "2027-06-14",
      location: "Tampa",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "answer_to_question",
        facts: {
          weddingDate: "2027-06-15",
          weddingDateText: "June 15 2027",
        },
      }),
  });

  assert.equal(result.weddingDate, "2027-06-15");
  assert.equal(result.availabilityCheck?.date, "2027-06-15");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_wedding_availability"],
  );
});

test("simple wedding sales runtime routes explicit human requests to handoff", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Can I talk to a real person?",
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        questionsAskedByCustomer: ["other"],
      }),
  });

  assert.equal(result.nextStep, "handoff");
  assert.equal(result.mode, "human_needed");
  assert.equal(result.handoffReason, "customer_requests_human");
  assert.equal(result.decisionTrace?.replyType, "handoff");
  assert.match(result.responseDraft ?? "", /someone take a look/i);
});

test("simple wedding sales runtime routes missing tool execution to handoff", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Are you available June 14 2027 in Tampa?",
    understand: () =>
      understanding({
        customerMessageType: "availability_question",
        facts: {
          weddingDate: "2027-06-14",
          weddingDateText: "June 14 2027",
          location: "Tampa",
        },
        questionsAskedByCustomer: ["availability"],
      }),
  });

  assert.equal(result.nextStep, "handoff");
  assert.equal(result.mode, "human_needed");
  assert.equal(result.handoffReason, "tool_error");
  assert.equal(result.decisionTrace?.toolCalled, "checkAvailability");
});

test("simple wedding sales runtime formats Gmail with a compact recap", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "gmail",
    message: "Hi, we are Anna and Mark. Are you available June 14 2027 in Tampa?",
    toolContext,
    understand: () =>
      understanding({
        customerMessageType: "availability_question",
        facts: {
          customerName: "Anna",
          partnerName: "Mark",
          weddingDate: "2027-06-14",
          weddingDateText: "June 14 2027",
          location: "Tampa",
        },
        questionsAskedByCustomer: ["availability"],
      }),
  });

  assert.match(result.responseDraft ?? "", /June 14, 2027 in Tampa.*date is available/i);
  assert.match(result.responseDraft ?? "", /Do you already have a venue picked out/i);
});

test("simple wedding sales runtime keeps early email but still asks for call time", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "anna@example.com",
    previousState: {
      customerName: "Anna",
      partnerName: "Mark",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "Oxford Exchange",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "email_provided",
        facts: {
          email: "anna@example.com",
        },
      }),
  });

  assert.equal(result.customerEmail, "anna@example.com");
  assert.equal(result.nextStep, "ask_call_time");
  assert.deepEqual(result.toolObservations, []);
});

test("simple wedding sales runtime checks availability before calendar when call time arrives early", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "June 14 2027 in Tampa, June 24 at 1pm works for a call",
    toolContext,
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          weddingDate: "2027-06-14",
          weddingDateText: "June 14 2027",
          location: "Tampa",
          proposedCallTime: "2026-06-24T13:00:00-04:00",
        },
        questionsAskedByCustomer: ["availability"],
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.missingField, "names");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_wedding_availability"],
  );
  assert.equal(result.consultationCheck, undefined);
});

test("simple wedding sales runtime asks for date when availability question has no date", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Are you available?",
    toolContext,
    understand: () =>
      understanding({
        customerMessageType: "availability_question",
        facts: {},
        questionsAskedByCustomer: ["availability"],
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.missingField, "weddingDate");
  assert.deepEqual(result.toolObservations, []);
});

test("simple wedding sales runtime routes angry customers to handoff", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "This is ridiculous, why are you asking so many questions?",
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {},
        questionsAskedByCustomer: ["other"],
      }),
  });

  assert.equal(result.nextStep, "handoff");
  assert.equal(result.mode, "human_needed");
  assert.equal(result.handoffReason, "angry_customer");
});

test("simple wedding sales runtime routes repeated unclear messages to handoff", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "idk maybe that thing",
    previousState: {
      unclearAttemptCount: 1,
    },
    understand: () =>
      understanding({
        customerMessageType: "unclear",
        facts: {},
        questionsAskedByCustomer: [],
        confidence: 0.8,
      }),
  });

  assert.equal(result.nextStep, "handoff");
  assert.equal(result.mode, "human_needed");
  assert.equal(result.handoffReason, "unclear_after_2_attempts");
});

test("simple wedding sales runtime asks another time when checked calendar slot is busy", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Does 3pm work?",
    previousState: {
      customerName: "Anna",
      partnerName: "Mark",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "Oxford Exchange",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
      proposedCallTime: "2026-06-24T15:00:00-04:00",
      calendarStatus: "busy",
      consultationCheck: {
        proposedTime: "2026-06-24T15:00:00-04:00",
        status: "unavailable",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
      suggestedCallTimes: ["10:00", "11:00"],
    },
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {},
        questionsAskedByCustomer: [],
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.decisionTrace?.replyType, "calendar_busy");
  assert.match(result.responseDraft ?? "", /10:00, 11:00 could work/i);
});

test("simple wedding sales runtime asks for couple names when sender is mother of bride", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Can we talk tomorrow? I'm mother of bride",
    previousState: {
      weddingDate: "2027-06-14",
      location: "Tampa",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {
          senderRole: "mother",
        },
        questionsAskedByCustomer: ["booking"],
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.missingField, "names");
  assert.match(result.responseDraft ?? "", /couple's names/i);
  assert.doesNotMatch(result.responseDraft ?? "", /both of your names/i);
});

test("simple wedding sales runtime mentions guide image availability when price image exists", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Yes send me here price image",
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        fileName: "price-fl.png",
      },
    },
    previousState: {
      weddingDate: "2027-06-14",
      location: "Tampa",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {},
        questionsAskedByCustomer: ["pricing"],
      }),
  });

  assert.match(result.responseDraft ?? "", /\$2,950/i);
  assert.match(result.responseDraft ?? "", /guide image/i);
  assert.doesNotMatch(result.responseDraft ?? "", /don'?t have|cannot|can't|unable/i);
});

test("simple wedding sales runtime does not book or confirm a call without email", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "10am works for us",
    toolContext,
    previousState: {
      customerName: "Anna",
      partnerName: "Mark",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "The Don Cesar",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "2026-06-24T10:00:00-04:00",
        },
      }),
  });

  assert.equal(result.nextStep, "ask_email");
  assert.equal(result.bookingConfirmed, false);
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
  assert.match(result.responseDraft ?? "", /best email/i);
  assert.doesNotMatch(result.responseDraft ?? "", /booked|confirmed|all set/i);
});
