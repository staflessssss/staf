import assert from "node:assert/strict";
import test from "node:test";

import { invokeWeddingSalesSimpleGraph } from "./graph";
import type { TurnUnderstanding } from "./state";
import { understandTurnHeuristically } from "./understand";

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
const unavailableToolContext = {
  ...toolContext,
  testMode: false,
};

async function withRephraserEnv<T>(
  env: Record<string, string | undefined>,
  run: () => Promise<T>,
) {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key]);

    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

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
  assert.match(
    result.decisionTrace?.reason ?? "",
    /names are the next qualification field|invariant: reply_only cannot override/i,
  );
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_wedding_availability"],
  );
  assert.match(result.responseDraft ?? "", /June 14, 2027 in Tampa.*date is available/i);
  assert.match(result.responseDraft ?? "", /wedding films start at/i);
  assert.match(result.responseDraft ?? "", /both of your names/i);
});

test("simple wedding sales runtime logs rephraser shadow without changing outbound text", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Mike and Sarah",
    previousState: {
      weddingDate: "2027-06-15",
      location: "Tampa",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-15",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
      replyMemory: {
        turnIndex: 1,
      },
    },
    understand: () =>
      understanding({
        facts: {
          customerName: "Mike",
          partnerName: "Sarah",
        },
      }),
    rephrase: () => "Love it — what venue are you two planning for? 🤍",
  });

  assert.equal(result.nextStep, "ask_venue");
  assert.equal(result.writer?.mode, "response_catalog");
  assert.equal(result.writer?.rephraser?.mode, "shadow");
  assert.equal(result.writer?.rephraser?.eligible, true);
  assert.equal(result.writer?.rephraser?.guardOk, true);
  assert.equal(result.writer?.rephraser?.wouldUse, true);
  assert.equal(
    result.writer?.rephraser?.draftText,
    "Love it — what venue are you two planning for? 🤍",
  );
  assert.notEqual(result.responseDraft, result.writer?.rephraser?.draftText);
  assert.match(result.responseDraft ?? "", /venue|taking place/i);
});

test("simple wedding sales runtime sends active rephrase for allowlisted contact when guard passes", async () => {
  await withRephraserEnv(
    {
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE: "true",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS: "contact-1",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS: "agent-1",
    },
    async () => {
      const draft = "Love it - what venue are you two planning for?";
      const result = await invokeWeddingSalesSimpleGraph({
        channel: "instagram",
        agentId: "agent-1",
        contactId: "contact-1",
        message: "Mike and Sarah",
        previousState: {
          agentId: "agent-1",
          contactId: "contact-1",
          weddingDate: "2027-06-15",
          location: "Tampa",
          availability: "available",
          availabilityCheck: {
            date: "2027-06-15",
            location: "Tampa",
            status: "available",
            checkedAt: "2026-06-24T00:00:00.000Z",
          },
          replyMemory: {
            turnIndex: 1,
          },
        },
        understand: () =>
          understanding({
            facts: {
              customerName: "Mike",
              partnerName: "Sarah",
            },
          }),
        rephrase: () => draft,
      });

      assert.equal(result.nextStep, "ask_venue");
      assert.equal(result.writer?.mode, "contextual_rephrase");
      assert.equal(result.writer?.rephraser?.mode, "active");
      assert.equal(result.writer?.rephraser?.activeAllowed, true);
      assert.equal(result.writer?.rephraser?.guardOk, true);
      assert.equal(result.writer?.rephraser?.usedAsOutbound, true);
      assert.equal(result.writer?.rephraser?.fallbackToCatalog, false);
      assert.equal(result.responseDraft, draft);
      assert.equal(result.replyMemory?.lastOutboundText, draft);
      assert.equal(result.replyMemory?.responseVariations?.at(-1)?.responseKey, "utter_ask_venue");
    },
  );
});

test("simple wedding sales runtime falls back to catalog when active rephrase guard fails", async () => {
  await withRephraserEnv(
    {
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE: "true",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS: "contact-1",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS: undefined,
    },
    async () => {
      const result = await invokeWeddingSalesSimpleGraph({
        channel: "instagram",
        contactId: "contact-1",
        message: "Mike and Sarah",
        previousState: {
          contactId: "contact-1",
          weddingDate: "2027-06-15",
          location: "Tampa",
          availability: "available",
          availabilityCheck: {
            date: "2027-06-15",
            location: "Tampa",
            status: "available",
            checkedAt: "2026-06-24T00:00:00.000Z",
          },
        },
        understand: () =>
          understanding({
            facts: {
              customerName: "Mike",
              partnerName: "Sarah",
            },
          }),
        rephrase: () => "Love it.",
      });

      assert.equal(result.nextStep, "ask_venue");
      assert.equal(result.writer?.mode, "response_catalog");
      assert.equal(result.writer?.rephraser?.mode, "active");
      assert.equal(result.writer?.rephraser?.activeAllowed, true);
      assert.equal(result.writer?.rephraser?.guardOk, false);
      assert.equal(result.writer?.rephraser?.usedAsOutbound, false);
      assert.equal(result.writer?.rephraser?.fallbackToCatalog, true);
      assert.ok(
        result.writer?.rephraser?.guardErrors?.some((error) =>
          /venue question was required/i.test(error),
        ),
      );
      assert.notEqual(result.responseDraft, "Love it.");
      assert.match(result.responseDraft ?? "", /venue|taking place/i);
    },
  );
});

test("simple wedding sales runtime does not send active rephrase for non-allowlisted contact", async () => {
  await withRephraserEnv(
    {
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE: "true",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS: "contact-1",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS: undefined,
    },
    async () => {
      const result = await invokeWeddingSalesSimpleGraph({
        channel: "instagram",
        contactId: "contact-2",
        message: "Mike and Sarah",
        previousState: {
          contactId: "contact-2",
          weddingDate: "2027-06-15",
          location: "Tampa",
          availability: "available",
          availabilityCheck: {
            date: "2027-06-15",
            location: "Tampa",
            status: "available",
            checkedAt: "2026-06-24T00:00:00.000Z",
          },
        },
        understand: () =>
          understanding({
            facts: {
              customerName: "Mike",
              partnerName: "Sarah",
            },
          }),
        rephrase: () => "Love it - what venue are you two planning for?",
      });

      assert.equal(result.nextStep, "ask_venue");
      assert.equal(result.writer?.mode, "response_catalog");
      assert.equal(result.writer?.rephraser?.mode, "shadow");
      assert.equal(result.writer?.rephraser?.activeAllowed, false);
      assert.equal(result.writer?.rephraser?.fallbackReason, "contact_not_allowlisted");
      assert.equal(result.writer?.rephraser?.usedAsOutbound, false);
      assert.equal(result.responseDraft, result.writer?.rephraser?.baseText);
    },
  );
});

test("simple wedding sales runtime does not run active rephrase for excluded pricing availability reply", async () => {
  await withRephraserEnv(
    {
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE: "true",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS: "contact-1",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS: undefined,
    },
    async () => {
      const result = await invokeWeddingSalesSimpleGraph({
        channel: "instagram",
        contactId: "contact-1",
        message: "Are you available June 15 2027 in Tampa? How much?",
        toolContext,
        understand: () =>
          understanding({
            customerMessageType: "availability_question",
            facts: {
              weddingDate: "2027-06-15",
              weddingDateText: "June 15 2027",
              location: "Tampa",
            },
            questionsAskedByCustomer: ["availability", "pricing"],
          }),
        rephrase: () => "I changed the availability and price.",
      });

      assert.equal(result.decisionTrace?.toolCalled, "checkAvailability");
      assert.equal(result.writer?.mode, "deterministic_fallback");
      assert.equal(result.writer?.rephraser, undefined);
      assert.doesNotMatch(result.responseDraft ?? "", /I changed the availability and price/i);
      assert.match(result.responseDraft ?? "", /June 15, 2027 in Tampa.*date is available/i);
    },
  );
});

test("simple wedding sales runtime hands off instead of treating unknown availability as available", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Okay",
    previousState: {
      weddingDate: "2027-06-14",
      location: "Tampa",
      availability: "unknown",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "unknown",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        facts: {},
      }),
  });

  assert.equal(result.availability, "unknown");
  assert.equal(result.nextStep, "handoff");
  assert.equal(result.mode, "human_needed");
  assert.equal(result.handoffReason, "tool_error");
  assert.equal(result.decisionTrace?.replyType, "availability_unknown");
  assert.doesNotMatch(result.responseDraft ?? "", /date is available|open/i);
});

test("simple wedding sales runtime does not send price guide for availability-only checks", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Tampa, Florida",
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
      },
      portfolio: [
        {
          label: "Recent Film",
          url: "https://galleries.example/recent",
        },
      ],
    },
    previousState: {
      weddingDate: "2026-10-17",
      weddingDateText: "17/10/2026",
    },
    understand: () =>
      understanding({
        facts: {
          location: "Tampa, Florida",
        },
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.decisionTrace?.toolCalled, "checkAvailability");
  assert.doesNotMatch(result.responseDraft ?? "", /collections guide image/i);
  assert.doesNotMatch(result.responseDraft ?? "", /recent films|galleries\.example/i);
});

test("simple wedding sales runtime handles availability pricing and shooter question in one DM", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Are you available June 15 2027 in Tampa? How much? Who would shoot our wedding?",
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
      },
      portfolio: [
        {
          label: "Recent Film",
          url: "https://galleries.example/recent",
        },
      ],
    },
    understand: () =>
      understanding({
        customerMessageType: "availability_question",
        facts: {
          weddingDate: "2027-06-15",
          weddingDateText: "June 15 2027",
          location: "Tampa",
        },
        questionsAskedByCustomer: ["availability", "pricing", "team"],
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.missingField, "names");
  assert.equal(result.decisionTrace?.toolCalled, "checkAvailability");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_wedding_availability"],
  );
  assert.match(result.responseDraft ?? "", /June 15, 2027 in Tampa.*date is available/i);
  assert.match(result.responseDraft ?? "", /wedding films start at/i);
  assert.match(result.responseDraft ?? "", /collections guide image/i);
  assert.match(result.responseDraft ?? "", /Jay.*lead filmmaker.*Tampa/i);
  assert.match(result.responseDraft ?? "", /both of your names/i);
  assert.doesNotMatch(result.responseDraft ?? "", /recent films|galleries\.example/i);
});

test("simple wedding sales runtime keeps names question after availability pricing and team mixed message", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Hi! Are you available June 15 2027 in Tampa? How much? Who would shoot our wedding?",
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "new_lead",
        facts: {
          weddingDate: "2027-06-15",
          weddingDateText: "June 15 2027",
          location: "Tampa",
        },
        questionsAskedByCustomer: ["availability", "pricing", "identity", "team"],
      }),
  });

  assert.equal(result.availability, "available");
  assert.equal(result.customerName, undefined);
  assert.equal(result.partnerName, undefined);
  assert.equal(result.decisionTrace?.toolCalled, "checkAvailability");
  assert.ok(result.decisionTrace?.missingFields.includes("names"));
  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.missingField, "names");
  assert.equal(result.replyContract?.requiredQuestion, "names");
  assert.equal(result.replyContract?.mayAskQuestion, true);
  assert.equal(result.replyContract?.mustMentionWeddingAvailability, true);
  assert.equal(result.replyContract?.mustMentionPricing, true);
  assert.equal(result.replyContract?.mustAnswerTeam, true);
  assert.equal(result.replyContract?.mustAnswerIdentity, false);
  assert.ok(result.replyObligations?.includes("pricing"));
  assert.ok(result.replyObligations?.includes("guide"));
  assert.ok(result.replyObligations?.includes("team"));
  assert.equal(result.replyObligations?.includes("identity"), false);
  assert.match(
    result.decisionTrace?.reason ?? "",
    /invariant: reply_only cannot override missing qualification fields/i,
  );
  assert.match(result.responseDraft ?? "", /June 15, 2027 in Tampa.*date is available/i);
  assert.match(result.responseDraft ?? "", /\$2,950|wedding films start/i);
  assert.match(result.responseDraft ?? "", /Jay.*lead filmmaker.*Tampa/i);
  assert.doesNotMatch(result.responseDraft ?? "", /speaking with me here/i);
  assert.match(result.responseDraft ?? "", /both of your names|your names|couple'?s names/i);
});

test("simple wedding sales runtime keeps large mixed Instagram reply compact and preserves follow-up state", async () => {
  const first = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message:
      "Are you available June 15 2027 in Tampa? How much? Who would shoot our wedding? Can you send recent films too?",
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
      },
      portfolio: [
        {
          label: "Recent Film",
          url: "https://galleries.example/recent",
        },
      ],
    },
    understand: () =>
      understanding({
        customerMessageType: "availability_question",
        facts: {
          weddingDate: "2027-06-15",
          weddingDateText: "June 15 2027",
          location: "Tampa",
        },
        questionsAskedByCustomer: ["availability", "pricing", "team", "portfolio"],
      }),
  });

  assert.equal(first.nextStep, "ask_missing_info");
  assert.equal(first.missingField, "names");
  assert.equal(first.decisionTrace?.toolCalled, "checkAvailability");
  assert.deepEqual(
    first.toolObservations.map((observation) => observation.toolName),
    ["check_wedding_availability"],
  );
  assert.match(first.responseDraft ?? "", /June 15, 2027 in Tampa.*date is available/i);
  assert.match(first.responseDraft ?? "", /wedding films start at/i);
  assert.match(first.responseDraft ?? "", /collections guide image/i);
  assert.match(first.responseDraft ?? "", /Jay.*lead filmmaker.*Tampa/i);
  assert.match(first.responseDraft ?? "", /recent films.*Recent Film: https:\/\/galleries\.example\/recent/i);
  assert.match(first.responseDraft ?? "", /both of your names/i);
  assert.equal(first.replyGuardResult?.ok, true);
  assert.ok((first.responseDraft ?? "").length <= 900);
  assert.ok((first.responseDraft ?? "").split(/\n{2,}/).filter((part) => part.trim()).length <= 5);

  const second = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Mike and Sarah",
    previousState: first,
    toolContext,
    understand: () =>
      understanding({
        facts: {
          customerName: "Mike",
          partnerName: "Sarah",
        },
      }),
  });

  assert.equal(second.nextStep, "ask_venue");
  assert.deepEqual(second.toolObservations, []);
  assert.doesNotMatch(second.responseDraft ?? "", /June 15, 2027 in Tampa.*date is available/i);
  assert.doesNotMatch(second.responseDraft ?? "", /wedding films start|collections guide/i);
  assert.doesNotMatch(second.responseDraft ?? "", /Jay.*lead filmmaker|recent films|galleries\.example/i);
  assert.doesNotMatch(second.responseDraft ?? "", /I want to make sure I understand/i);
  assert.match(second.responseDraft ?? "", /venue/i);
});

test("simple wedding sales runtime does not add portfolio when mixed message only asks availability pricing and team", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Are you available June 15 2027 in Tampa? How much? Who would shoot our wedding?",
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
      },
      portfolio: [
        {
          label: "Recent Film",
          url: "https://galleries.example/recent",
        },
      ],
    },
    understand: () =>
      understanding({
        customerMessageType: "availability_question",
        facts: {
          weddingDate: "2027-06-15",
          weddingDateText: "June 15 2027",
          location: "Tampa",
        },
        questionsAskedByCustomer: ["availability", "pricing", "team"],
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.decisionTrace?.toolCalled, "checkAvailability");
  assert.match(result.responseDraft ?? "", /June 15, 2027 in Tampa.*date is available/i);
  assert.match(result.responseDraft ?? "", /wedding films start at/i);
  assert.match(result.responseDraft ?? "", /Jay.*lead filmmaker.*Tampa/i);
  assert.match(result.responseDraft ?? "", /both of your names/i);
  assert.doesNotMatch(result.responseDraft ?? "", /recent films|galleries\.example/i);
});

test("simple wedding sales runtime does not invent team answer when mixed message asks portfolio but not shooter", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Are you available June 15 2027 in Tampa? How much? Can you send recent films?",
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
      },
      portfolio: [
        {
          label: "Recent Film",
          url: "https://galleries.example/recent",
        },
      ],
    },
    understand: () =>
      understanding({
        customerMessageType: "availability_question",
        facts: {
          weddingDate: "2027-06-15",
          weddingDateText: "June 15 2027",
          location: "Tampa",
        },
        questionsAskedByCustomer: ["availability", "pricing", "portfolio"],
      }),
  });

  assert.equal(result.nextStep, "ask_missing_info");
  assert.equal(result.decisionTrace?.toolCalled, "checkAvailability");
  assert.match(result.responseDraft ?? "", /June 15, 2027 in Tampa.*date is available/i);
  assert.match(result.responseDraft ?? "", /wedding films start at/i);
  assert.match(result.responseDraft ?? "", /recent films.*Recent Film: https:\/\/galleries\.example\/recent/i);
  assert.match(result.responseDraft ?? "", /both of your names/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Jay.*lead filmmaker|team details|point of contact/i);
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
  assert.match(result.responseDraft ?? "", /works on my calendar/i);
  assert.doesNotMatch(result.responseDraft ?? "", /June 14, 2027|date is available/i);
  assert.match(result.responseDraft ?? "", /best email/i);
});

test("simple wedding sales runtime retries call time outside consult window without calendar tool", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Tomorrow at 3pm works for a call",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-14",
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "Tomorrow at 3pm",
        },
      }),
  });

  assert.equal(result.nextStep, "ask_call_time");
  assert.equal(result.decisionTrace?.replyType, "call_time_out_of_window");
  assert.equal(result.replyContract?.requiredQuestion, "callTime");
  assert.equal(result.replyContract?.requiredToolResult, "out_of_window");
  assert.equal(result.replyContract?.questionPolicy.mode, "invalid_answer_retry");
  assert.equal(result.replyGuardResult?.ok, true);
  assert.deepEqual(result.toolObservations, []);
  assert.equal(result.proposedCallTime, undefined);
  assert.equal(result.callTimeContext?.rejected?.value, "Tomorrow at 3pm");
  assert.deepEqual(
    result.callTimeContext?.options.map((option) => option.label),
    ["1pm", "2pm"],
  );
  assert.match(result.responseDraft ?? "", /3pm.*outside my consult window/i);
  assert.match(result.responseDraft ?? "", /9am-2pm Eastern/i);
  assert.match(result.responseDraft ?? "", /1pm or 2pm work/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Got it\. I can help with that/i);
});

test("simple wedding sales runtime still checks calendar for call time inside consult window", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Tomorrow at 1pm works for a call",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-14",
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "Tomorrow at 1pm",
        },
      }),
  });

  assert.notEqual(result.decisionTrace?.replyType, "call_time_out_of_window");
  assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
});

test("simple wedding sales runtime keeps relative date context when customer chooses a bare call time", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "1pm works too",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 3pm",
      consultationCheck: {
        proposedTime: "tomorrow at 3pm",
        status: "unknown",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "1pm",
        },
      }),
  });

  assert.equal(result.proposedCallTime, "tomorrow at 1pm");
  assert.equal(result.nextStep, "ask_email");
  assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
  assert.doesNotMatch(result.responseDraft ?? "", /don't want to guess/i);
});

test("simple wedding sales runtime asks again instead of repeating calendar checks for unparseable call time", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "1pm",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "1pm",
      consultationCheck: {
        proposedTime: "1pm",
        status: "unknown",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {},
      }),
  });

  assert.equal(result.nextStep, "ask_call_time");
  assert.equal(result.consultationCheck?.status, "unknown");
  assert.deepEqual(result.toolObservations, []);
  assert.match(result.responseDraft ?? "", /what time|time would be best|consults/i);
  assert.doesNotMatch(result.responseDraft ?? "", /don't want to guess/i);
});

test("simple wedding sales runtime resolves a bare numeric call time from rejected time context", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "2 works",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      callTimeContext: {
        requiredQuestion: "callTime",
        dateContext: "tomorrow",
        rejected: {
          value: "tomorrow at 3pm",
          reason: "out_of_window",
        },
        options: [
          {
            label: "1pm",
            hour: 13,
            minute: 0,
          },
          {
            label: "2pm",
            hour: 14,
            minute: 0,
          },
        ],
        source: "out_of_window_suggestions",
      },
      replyMemory: {
        lastRequiredQuestion: "callTime",
        questionMemory: {
          lastRequiredQuestion: "callTime",
          lastQuestionText:
            "3pm is just outside my consult window - I do calls Monday-Friday, 9am-2pm Eastern. Would 1pm or 2pm work?",
        },
      },
      consultationCheck: {
        proposedTime: "tomorrow at 3pm",
        status: "unknown",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "answer_to_question",
        facts: {},
      }),
  });

  assert.equal(result.proposedCallTime, "tomorrow at 2pm");
  assert.equal(result.nextStep, "ask_email");
  assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
});

test("simple wedding sales runtime maps parsed outside business hours to out-of-window", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Tomorrow 2:30pm",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 2:30pm",
      consultationCheck: {
        proposedTime: "tomorrow at 2:30pm",
        status: "outside_business_hours",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
      replyMemory: {
        lastRequiredQuestion: "callTime",
        questionMemory: {
          lastRequiredQuestion: "callTime",
          lastQuestionText:
            "Either works - I just need one specific time to check the calendar. Would you prefer 1pm or 2pm?",
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {},
      }),
  });

  assert.equal(result.nextStep, "ask_call_time");
  assert.equal(result.decisionTrace?.replyType, "call_time_out_of_window");
  assert.doesNotMatch(result.decisionTrace?.reason ?? "", /could not parse/i);
  assert.equal(result.proposedCallTime, undefined);
  assert.equal(result.callTimeContext?.rejected?.value, "tomorrow at 2:30pm");
  assert.match(result.responseDraft ?? "", /2:30pm.*outside my consult window/i);
});

test("simple wedding sales runtime does not guess when customer accepts multiple call times", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Either works",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      callTimeContext: {
        requiredQuestion: "callTime",
        dateContext: "tomorrow",
        rejected: {
          value: "tomorrow at 3pm",
          reason: "out_of_window",
        },
        options: [
          {
            label: "1pm",
            hour: 13,
            minute: 0,
          },
          {
            label: "2pm",
            hour: 14,
            minute: 0,
          },
        ],
        source: "out_of_window_suggestions",
      },
      replyMemory: {
        lastRequiredQuestion: "callTime",
        questionMemory: {
          lastRequiredQuestion: "callTime",
          lastQuestionText:
            "3pm is just outside my consult window - I do calls Monday-Friday, 9am-2pm Eastern. Would 1pm or 2pm work?",
        },
      },
      consultationCheck: {
        proposedTime: "tomorrow at 3pm",
        status: "unknown",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "answer_to_question",
        facts: {},
      }),
  });

  assert.equal(result.nextStep, "ask_call_time");
  assert.equal(result.decisionTrace?.replyType, "call_time_ambiguous");
  assert.notEqual(result.proposedCallTime, "tomorrow at 3pm");
  assert.equal(result.proposedCallTime, undefined);
  assert.equal(result.replyContract?.questionPolicy.mode, "invalid_answer_retry");
  assert.deepEqual(result.toolObservations, []);
  assert.match(result.responseDraft ?? "", /one specific time/i);
  assert.match(result.responseDraft ?? "", /1pm or 2pm/i);
});

test("simple wedding sales runtime matches offered call time options before normal parsing", async () => {
  const cases = [
    {
      options: [
        { label: "1pm", hour: 13, minute: 0 },
        { label: "2pm", hour: 14, minute: 0 },
      ],
      answer: "2 works",
      expected: "tomorrow at 2pm",
    },
    {
      options: [
        { label: "10am", hour: 10, minute: 0 },
        { label: "12pm", hour: 12, minute: 0 },
      ],
      answer: "10 works",
      expected: "tomorrow at 10am",
    },
    {
      options: [
        { label: "10am", hour: 10, minute: 0 },
        { label: "12pm", hour: 12, minute: 0 },
      ],
      answer: "12 works",
      expected: "tomorrow at 12pm",
    },
    {
      options: [
        { label: "9:30am", hour: 9, minute: 30 },
        { label: "11:30am", hour: 11, minute: 30 },
      ],
      answer: "11:30 works",
      expected: "tomorrow at 11:30am",
    },
  ];

  for (const testCase of cases) {
    const result = await invokeWeddingSalesSimpleGraph({
      channel: "instagram",
      message: testCase.answer,
      toolContext,
      previousState: {
        customerName: "Mike",
        partnerName: "Sarah",
        weddingDate: "2027-06-15",
        location: "Tampa",
        venue: "Evergreen Park",
        availability: "available",
        availabilityContextDate: "2027-06-15",
        callTimeContext: {
          requiredQuestion: "callTime",
          dateContext: "tomorrow",
          rejected: {
            value: "tomorrow at 3pm",
            reason: "out_of_window",
          },
          options: testCase.options,
          source: "out_of_window_suggestions",
        },
        replyMemory: {
          lastRequiredQuestion: "callTime",
          questionMemory: {
            lastRequiredQuestion: "callTime",
            lastQuestionText: `Would ${testCase.options.map((option) => option.label).join(" or ")} work?`,
          },
        },
      },
      understand: () =>
        understanding({
          customerMessageType: "answer_to_question",
          facts: {},
        }),
    });

    assert.equal(result.proposedCallTime, testCase.expected);
    assert.notEqual(result.proposedCallTime, "tomorrow at 3pm");
    assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
    assert.deepEqual(
      result.toolObservations.map((observation) => observation.toolName),
      ["check_consultation_calendar"],
    );
  }
});

test("simple wedding sales runtime treats yes after available calendar as email step when email is missing", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "yes",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 2pm",
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "tomorrow at 2pm",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
      checkedCallDate: "2026-06-25",
      checkedCallTime: "14:00",
      checkedCallStartTime: "2026-06-25T14:00:00-04:00",
    },
    understand: () =>
      understanding({
        customerMessageType: "booking_confirmation",
        facts: {},
      }),
  });

  assert.equal(result.nextStep, "ask_email");
  assert.equal(result.bookingConfirmed, false);
  assert.deepEqual(result.toolObservations, []);
  assert.match(result.responseDraft ?? "", /best email/i);
});

test("simple wedding sales runtime can book after yes when email and available calendar are known", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "yes",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      customerEmail: "mike@example.com",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 2pm",
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "tomorrow at 2pm",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
      checkedCallDate: "2026-06-25",
      checkedCallTime: "14:00",
      checkedCallStartTime: "2026-06-25T14:00:00-04:00",
      replyMemory: {
        pendingBookingConfirmation: {
          proposedCallTime: "tomorrow at 2pm",
          email: "mike@example.com",
          checkedCallDate: "2026-06-25",
          checkedCallTime: "14:00",
          checkedCallStartTime: "2026-06-25T14:00:00-04:00",
          askedAtTurnId: "turn-5",
          askedAt: "2026-06-24T00:00:00.000Z",
          source: "ask_booking_confirmation",
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "booking_confirmation",
        facts: {},
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.bookingConfirmed, true);
  assert.equal(result.decisionTrace?.toolCalled, "bookCall");
  assert.equal(result.answerContext?.source, "pending_booking_confirmation");
  assert.equal(result.answerContext?.applied, true);
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["book_consultation"],
  );
});

test("simple wedding sales runtime does not treat bare yes as booking without pending lock-in question", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "yes",
    toolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      customerEmail: "mike@example.com",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 2pm",
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "tomorrow at 2pm",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
      checkedCallDate: "2026-06-25",
      checkedCallTime: "14:00",
      checkedCallStartTime: "2026-06-25T14:00:00-04:00",
    },
    understand: () =>
      understanding({
        customerMessageType: "booking_confirmation",
        facts: {},
      }),
  });

  assert.equal(result.nextStep, "ask_call_time");
  assert.equal(result.bookingConfirmed, false);
  assert.equal(result.answerContext?.applied, false);
  assert.deepEqual(result.toolObservations, []);
  assert.match(result.responseDraft ?? "", /lock in 2:00 PM/i);
});

test("simple wedding sales runtime does not retry failed booking attempts in the same turn", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "yes book it",
    toolContext: unavailableToolContext,
    previousState: {
      customerName: "Mike",
      partnerName: "Sarah",
      customerEmail: "mike@example.com",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 2pm",
      calendarStatus: "available",
      customerConfirmedCallSlot: true,
      consultationCheck: {
        proposedTime: "tomorrow at 2pm",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
      checkedCallDate: "2026-06-25",
      checkedCallTime: "14:00",
      checkedCallStartTime: "2026-06-25T14:00:00-04:00",
    },
    understand: () =>
      understanding({
        customerMessageType: "booking_confirmation",
        questionsAskedByCustomer: ["booking"],
        facts: {},
      }),
  });

  assert.equal(result.nextStep, "handoff");
  assert.equal(result.mode, "human_needed");
  assert.equal(result.bookingConfirmed, false);
  assert.equal(result.bookingAttempt?.status, "failed");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["book_consultation"],
  );
});

test("simple wedding sales runtime asks for explicit confirmation after email when calendar is available", async () => {
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

  assert.equal(result.nextStep, "ask_call_time");
  assert.equal(result.bookingConfirmed, false);
  assert.equal(result.decisionTrace?.toolCalled, undefined);
  assert.deepEqual(result.toolObservations, []);
  assert.match(result.responseDraft ?? "", /lock in 1:00 PM/i);
  assert.doesNotMatch(result.responseDraft ?? "", /works perfectly for a call/i);
  assert.equal(
    result.replyMemory?.pendingBookingConfirmation?.proposedCallTime,
    "2026-06-24T13:00:00-04:00",
  );
  assert.equal(result.replyMemory?.pendingBookingConfirmation?.email, "anna@example.com");
});

test("simple wedding sales runtime books when bare yes answers the pending lock-in question", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Yes",
    toolContext,
    previousState: {
      customerName: "Anna",
      partnerName: "Mark",
      customerEmail: "anna@example.com",
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
      replyMemory: {
        pendingBookingConfirmation: {
          proposedCallTime: "2026-06-24T13:00:00-04:00",
          email: "anna@example.com",
          checkedCallDate: "2026-06-24",
          checkedCallTime: "13:00",
          checkedCallStartTime: "2026-06-24T13:00:00-04:00",
          checkedCallEndTime: "2026-06-24T13:30:00-04:00",
          askedAtTurnId: "turn-8",
          askedAt: "2026-06-23T00:00:00.000Z",
          source: "ask_booking_confirmation",
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "answer_to_question",
        facts: {},
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.bookingConfirmed, true);
  assert.equal(result.decisionTrace?.toolCalled, "bookCall");
  assert.equal(result.answerContext?.source, "pending_booking_confirmation");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["book_consultation"],
  );
  assert.equal(result.replyMemory?.pendingBookingConfirmation, undefined);
  assert.match(result.responseDraft ?? "", /all set for 1:00 PM/i);
});

test("simple wedding sales runtime books when yes please answers the pending lock-in question", async () => {
  for (const message of ["Yes please", "Yes, please"]) {
    const result = await invokeWeddingSalesSimpleGraph({
      channel: "instagram",
      message,
      toolContext,
      previousState: {
        customerName: "Anna",
        partnerName: "Mark",
        customerEmail: "anna@example.com",
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
        callTimeContext: {
          requiredQuestion: "callTime",
          dateContext: "tomorrow",
          source: "out_of_window_suggestions",
          options: [
            { label: "1pm", hour: 13, minute: 0 },
            { label: "2pm", hour: 14, minute: 0 },
          ],
        },
        replyMemory: {
          pendingBookingConfirmation: {
            proposedCallTime: "2026-06-24T13:00:00-04:00",
            email: "anna@example.com",
            checkedCallDate: "2026-06-24",
            checkedCallTime: "13:00",
            checkedCallStartTime: "2026-06-24T13:00:00-04:00",
            checkedCallEndTime: "2026-06-24T13:30:00-04:00",
            askedAtTurnId: "turn-8",
            askedAt: "2026-06-23T00:00:00.000Z",
            source: "ask_booking_confirmation",
          },
          questionMemory: {
            lastRequiredQuestion: "callTime",
            lastQuestionText: "Perfect, got it. Want me to lock in 1:00 PM?",
          },
        },
      },
      understand: () =>
        understanding({
          customerMessageType: "answer_to_question",
          facts: {},
        }),
    });

    assert.equal(result.nextStep, "reply_only", message);
    assert.equal(result.bookingConfirmed, true, message);
    assert.equal(result.decisionTrace?.toolCalled, "bookCall", message);
    assert.equal(result.flowRunner?.mode, "active", message);
    assert.equal(result.flowRunner?.branch, "booking_confirmation_affirmative", message);
    assert.equal(result.flowRunner?.usedAsFinalDecision, true, message);
    assert.equal(result.answerContext?.source, "pending_booking_confirmation", message);
    assert.equal(result.pendingUserAction, null, message);
    assert.equal(result.callTimeContext, undefined, message);
    assert.doesNotMatch(result.responseDraft ?? "", /Want me to lock in/i, message);
  }
});

test("simple wedding sales runtime clears pending booking confirmation when customer changes time", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Actually 2pm",
    toolContext,
    previousState: {
      customerName: "Anna",
      partnerName: "Mark",
      customerEmail: "anna@example.com",
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
      replyMemory: {
        lastRequiredQuestion: "callTime",
        questionMemory: {
          lastRequiredQuestion: "callTime",
          lastQuestionText: "Want me to lock in 1:00 PM?",
        },
        pendingBookingConfirmation: {
          proposedCallTime: "2026-06-24T13:00:00-04:00",
          email: "anna@example.com",
          checkedCallDate: "2026-06-24",
          checkedCallTime: "13:00",
          checkedCallStartTime: "2026-06-24T13:00:00-04:00",
          checkedCallEndTime: "2026-06-24T13:30:00-04:00",
          askedAtTurnId: "turn-8",
          askedAt: "2026-06-23T00:00:00.000Z",
          source: "ask_booking_confirmation",
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "2pm",
        },
      }),
  });

  assert.equal(result.customerConfirmedCallSlot, false);
  assert.equal(result.bookingConfirmed, false);
  assert.equal(result.calendarStatus, "available");
  assert.equal(result.replyMemory?.pendingBookingConfirmation?.checkedCallTime, "14:00");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
});

test("simple wedding sales runtime books after email when the call slot was already confirmed", async () => {
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
      customerConfirmedCallSlot: true,
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
  assert.match(result.responseDraft ?? "", /all set for 1:00 PM/i);
  assert.match(result.responseDraft ?? "", /calendar invite.*anna@example\.com/i);
  assert.doesNotMatch(result.responseDraft ?? "", /booked the call/i);
});

test("simple wedding sales runtime answers travel question after booking without repeating booking confirmation", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Do you travel outside Tampa too?",
    toolContext,
    previousState: {
      customerName: "Mark",
      partnerName: "Rachel",
      customerEmail: "bonkopoly@gmail.com",
      weddingDate: "2027-06-15",
      weddingDateText: "June 15 2027",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      availabilityCheck: {
        date: "2027-06-15",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-25T16:50:21.160Z",
      },
      proposedCallTime: "tomorrow at 2pm",
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "tomorrow at 2pm",
        status: "available",
        checkedAt: "2026-06-25T16:52:57.034Z",
      },
      checkedCallDate: "2026-06-26",
      checkedCallTime: "14:00",
      checkedCallStartTime: "2026-06-26T14:00:00-04:00",
      checkedCallEndTime: "2026-06-26T14:30:00-04:00",
      customerConfirmedCallSlot: true,
      bookingConfirmed: true,
      bookingAttempt: {
        status: "booked",
        attemptedAt: "2026-06-25T16:53:44.500Z",
      },
      replyMemory: {
        lastRequiredQuestion: "callTime",
        lastReplyType: "booking_confirmed",
        lastOutboundText:
          "Perfect - you're all set for 2:00 PM ✨\n\nYou should see the calendar invite come through at bonkopoly@gmail.com.",
        questionMemory: {
          lastRequiredQuestion: "callTime",
          lastQuestionText: "Perfect, got it. Want me to lock in 2:00 PM?",
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {
          proposedCallTime: "tomorrow at 2pm",
        },
        questionsAskedByCustomer: ["travel"],
        confidence: 0.95,
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.decisionTrace?.replyType, "reply_only");
  assert.notEqual(result.decisionTrace?.replyType, "booking_confirmed");
  assert.deepEqual(result.replyObligations, ["travel"]);
  assert.equal(result.replyContract?.mustAnswerTravel, true);
  assert.equal(result.answerContext?.applied, false);
  assert.match(result.answerContext?.reason ?? "", /explicit business question/i);
  assert.match(result.responseDraft ?? "", /travel outside Tampa/i);
  assert.match(result.responseDraft ?? "", /roundtrip travel coverage/i);
  assert.doesNotMatch(result.responseDraft ?? "", /don't want to guess|send that one more time/i);
  assert.doesNotMatch(result.responseDraft ?? "", /all set|calendar invite/i);
  assert.deepEqual(result.toolObservations, []);
});

test("simple wedding sales runtime does not apply stale call-time context to FAQ questions", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Do you travel outside Tampa too?",
    toolContext,
    previousState: {
      customerName: "Mark",
      partnerName: "Rachel",
      customerEmail: "bonkopoly@gmail.com",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 2pm",
      callTimeContext: {
        requiredQuestion: "callTime",
        dateContext: "tomorrow",
        source: "out_of_window_suggestions",
        rejected: {
          value: "tomorrow at 3pm",
          reason: "out_of_window",
        },
        options: [
          { label: "1pm", hour: 13, minute: 0 },
          { label: "2pm", hour: 14, minute: 0 },
        ],
      },
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "tomorrow at 2pm",
        status: "available",
        checkedAt: "2026-06-25T16:52:57.034Z",
      },
      customerConfirmedCallSlot: true,
      bookingConfirmed: true,
      replyMemory: {
        lastRequiredQuestion: "callTime",
        questionMemory: {
          lastRequiredQuestion: "callTime",
          lastQuestionText:
            "Either works - I just need one specific time to check the calendar. Would you prefer 1pm or 2pm?",
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {
          proposedCallTime: "tomorrow at 1pm",
        },
        questionsAskedByCustomer: ["travel"],
        confidence: 0.95,
      }),
  });

  assert.equal(result.proposedCallTime, "tomorrow at 2pm");
  assert.equal(result.answerContext?.applied, false);
  assert.match(result.answerContext?.reason ?? "", /explicit business question/i);
  assert.deepEqual(result.replyObligations, ["travel"]);
  assert.equal(result.replyContract?.mustAnswerTravel, true);
  assert.deepEqual(result.toolObservations, []);
  assert.match(result.responseDraft ?? "", /travel outside Tampa/i);
});

test("simple wedding sales runtime does not treat bare yes after booking as pending booking confirmation", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Yes",
    toolContext,
    previousState: {
      customerName: "Mark",
      partnerName: "Rachel",
      customerEmail: "bonkopoly@gmail.com",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 2pm",
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "tomorrow at 2pm",
        status: "available",
        checkedAt: "2026-06-25T16:52:57.034Z",
      },
      checkedCallDate: "2026-06-26",
      checkedCallTime: "14:00",
      checkedCallStartTime: "2026-06-26T14:00:00-04:00",
      checkedCallEndTime: "2026-06-26T14:30:00-04:00",
      customerConfirmedCallSlot: true,
      bookingConfirmed: true,
      bookingAttempt: {
        status: "booked",
        attemptedAt: "2026-06-25T16:53:44.500Z",
      },
      replyMemory: {
        lastReplyType: "booking_confirmed",
        lastOutboundText:
          "Perfect - you're all set for 2:00 PM ✨\n\nYou should see the calendar invite come through at bonkopoly@gmail.com.",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "booking_confirmation",
        facts: {},
        questionsAskedByCustomer: [],
        confidence: 0.95,
      }),
  });

  assert.equal(result.bookingConfirmed, true);
  assert.deepEqual(result.toolObservations, []);
  assert.notEqual(result.answerContext?.source, "pending_booking_confirmation");
  assert.equal(result.replyMemory?.pendingBookingConfirmation, undefined);
});

test("simple wedding sales runtime treats thank you after booking as acknowledgement only", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Thank you",
    toolContext,
    previousState: {
      customerName: "Mark",
      partnerName: "Rachel",
      customerEmail: "bonkopoly@gmail.com",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "Monday at 1pm",
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "Monday at 1pm",
        status: "available",
        checkedAt: "2026-06-26T14:37:15.722Z",
      },
      checkedCallDate: "2026-06-29",
      checkedCallTime: "13:00",
      checkedCallStartTime: "2026-06-29T13:00:00-04:00",
      checkedCallEndTime: "2026-06-29T13:30:00-04:00",
      customerConfirmedCallSlot: true,
      bookingConfirmed: true,
      bookingAttempt: {
        status: "booked",
        attemptedAt: "2026-06-26T14:39:12.672Z",
      },
      bookedEventId: "event-1",
      callTimeContext: {
        requiredQuestion: "callTime",
        dateContext: "tomorrow",
        source: "out_of_window_suggestions",
        options: [
          { label: "1pm", hour: 13, minute: 0 },
          { label: "2pm", hour: 14, minute: 0 },
        ],
      },
      replyMemory: {
        lastReplyType: "booking_confirmed",
        questionMemory: {
          lastRequiredQuestion: "callTime",
          lastQuestionText: "Perfect, got it. Want me to lock in 1:00 PM?",
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "answer_to_question",
        facts: {},
        questionsAskedByCustomer: [],
        confidence: 0.95,
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.decisionTrace?.replyType, "acknowledgement_only");
  assert.equal(result.flowRunner?.mode, "active");
  assert.equal(result.flowRunner?.branch, "acknowledgement_only");
  assert.equal(result.flowRunner?.usedAsFinalDecision, true);
  assert.equal(result.dialogueUnderstanding?.messageAct, "acknowledgement_only");
  assert.equal(result.answerContext, undefined);
  assert.equal(result.pendingUserAction, null);
  assert.match(result.responseDraft ?? "", /Of course/i);
  assert.doesNotMatch(result.responseDraft ?? "", /missing what you mean|Want me to lock in|calendar invite/i);
  assert.deepEqual(result.toolObservations, []);
});

test("simple wedding sales runtime answers raw footage after booking without booking-confirmed repeat", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Great, thank you. And yes, do you offer raw footage?",
    toolContext,
    previousState: {
      customerName: "Mark",
      partnerName: "Rachel",
      customerEmail: "bonkopoly@gmail.com",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      proposedCallTime: "tomorrow at 2pm",
      calendarStatus: "available",
      consultationCheck: {
        proposedTime: "tomorrow at 2pm",
        status: "available",
        checkedAt: "2026-06-25T16:52:57.034Z",
      },
      checkedCallDate: "2026-06-26",
      checkedCallTime: "14:00",
      customerConfirmedCallSlot: true,
      bookingConfirmed: true,
      replyMemory: {
        lastReplyType: "booking_confirmed",
        pendingBookingConfirmation: {
          proposedCallTime: "tomorrow at 2pm",
          email: "bonkopoly@gmail.com",
          checkedCallDate: "2026-06-26",
          checkedCallTime: "14:00",
          askedAt: "2026-06-25T16:52:57.034Z",
          source: "ask_booking_confirmation",
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {},
        questionsAskedByCustomer: ["raw_footage"],
        confidence: 0.95,
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.notEqual(result.decisionTrace?.replyType, "booking_confirmed");
  assert.equal(result.flowRunner?.mode, "active");
  assert.equal(result.flowRunner?.branch, "faq_raw_footage");
  assert.equal(result.flowRunner?.usedAsFinalDecision, true);
  assert.deepEqual(result.replyObligations, ["raw_footage"]);
  assert.equal(result.dialogueUnderstanding?.messageAct, "mixed_ack_and_question");
  assert.equal(result.dialogueUnderstanding?.shouldSuppressOldContext, true);
  assert.equal(result.answerContext?.applied, false);
  assert.match(result.responseDraft ?? "", /raw footage/i);
  assert.doesNotMatch(result.responseDraft ?? "", /all set|calendar invite/i);
  assert.doesNotMatch(result.responseDraft ?? "", /don't want to guess|send that one more time/i);
  assert.deepEqual(result.toolObservations, []);
});

test("simple wedding sales runtime answers raw footage after owner handoff resume without repeating owner reply", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Great, thank you. And yes, do you offer raw footage?",
    toolContext,
    previousState: {
      mode: "bot_active",
      customerName: "Mark",
      partnerName: "Rachel",
      customerEmail: "bonkopoly@gmail.com",
      weddingDate: "2027-06-15",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityContextDate: "2027-06-15",
      bookingConfirmed: true,
      replyMemory: {
        lastOutboundText: "I checked with Taras and he can talk through the details with you.",
        manualIntervention: {
          lastOwnerReplyText: "I checked with Taras and he can talk through the details with you.",
          lastOwnerReplyAt: "2026-06-25T17:00:00.000Z",
          source: "telegram_owner",
          manualReplies: [
            {
              text: "I checked with Taras and he can talk through the details with you.",
              source: "telegram_owner",
              sentAt: "2026-06-25T17:00:00.000Z",
            },
          ],
        },
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {},
        questionsAskedByCustomer: ["raw_footage"],
        confidence: 0.95,
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.deepEqual(result.replyObligations, ["raw_footage"]);
  assert.match(result.responseDraft ?? "", /raw footage/i);
  assert.doesNotMatch(result.responseDraft ?? "", /checked with Taras/i);
  assert.doesNotMatch(result.responseDraft ?? "", /all set|calendar invite/i);
  assert.equal(result.dialogueUnderstanding?.shouldSuppressOldContext, true);
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

test("simple wedding sales runtime does not resend the same price guide after follow-up availability checks", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Actually, they may move the wedding to June 15 2027.",
    previousState: {
      customerName: "Emily",
      partnerName: "Daniel",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "Evergreen Park",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
      responseDraft:
        "Our 8-hour wedding films start at $2,950 for Florida.\n\nI’m sending the collections guide image here too 🎥",
    },
    toolContext,
    understand: () =>
      understanding({
        customerMessageType: "answer_to_question",
        facts: {
          weddingDate: "2027-06-15",
          weddingDateText: "June 15 2027",
        },
      }),
  });

  assert.equal(result.availabilityCheck?.date, "2027-06-15");
  assert.match(result.responseDraft ?? "", /I checked June 15, 2027 in Tampa too/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Our 8-hour wedding films start/i);
  assert.doesNotMatch(result.responseDraft ?? "", /collections guide image/i);
});

test("simple wedding sales runtime handles the live Instagram canary transcript without clarification or repeated CTA", async () => {
  const first = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "1. Hi! Are you available June 14 2027 in Tampa? How much?",
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

  assert.equal(first.replyGuardResult?.ok, true);
  assert.match(first.responseDraft ?? "", /June 14, 2027 in Tampa.*date is available/i);
  assert.match(first.responseDraft ?? "", /both of your names/i);

  const second = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "2. Mike and Sarah",
    previousState: first,
    toolContext,
    understand: () =>
      understanding({
        customerMessageType: "unclear",
        facts: {
          customerName: "Mike",
          partnerName: "Sarah",
        },
        confidence: 0.2,
      }),
  });

  assert.equal(second.nextStep, "ask_venue");
  assert.equal(second.decisionTrace?.replyType, "ask_venue");
  assert.equal(second.flowRunner?.mode, "active");
  assert.equal(second.flowRunner?.branch, "names_collected");
  assert.equal(second.flowRunner?.usedAsFinalDecision, true);
  assert.doesNotMatch(second.responseDraft ?? "", /make sure I understand/i);
  assert.doesNotMatch(second.responseDraft ?? "", /both of your names/i);
  assert.match(second.responseDraft ?? "", /venue/i);

  const third = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Our names Mike and Sarah",
    previousState: second,
    toolContext,
    understand: () =>
      understanding({
        facts: {
          customerName: "Mike",
          partnerName: "Sarah",
        },
      }),
  });

  assert.equal(third.nextStep, "ask_venue");
  assert.doesNotMatch(third.responseDraft ?? "", /both of your names/i);
  assert.match(third.responseDraft ?? "", /venue/i);

  const fourth = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Evergreen Park",
    previousState: third,
    toolContext,
    understand: () =>
      understanding({
        facts: {
          venue: "Evergreen Park",
        },
      }),
  });

  assert.equal(fourth.nextStep, "ask_call_time");
  assert.equal(fourth.flowRunner?.mode, "active");
  assert.equal(fourth.flowRunner?.branch, "venue_collected");
  assert.equal(fourth.flowRunner?.usedAsFinalDecision, true);
  assert.match(fourth.responseDraft ?? "", /Evergreen Park gives us a good starting point/i);
  assert.match(fourth.responseDraft ?? "", /quick consult/i);
  assert.match(fourth.responseDraft ?? "", /What time works best/i);

  const fifth = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Actually, we may move the wedding to June 15 2027",
    previousState: fourth,
    toolContext,
    understand: () =>
      understanding({
        customerMessageType: "answer_to_question",
        facts: {
          weddingDate: "2027-06-15",
          weddingDateText: "June 15 2027",
        },
      }),
  });

  assert.equal(fifth.nextStep, "ask_call_time");
  assert.equal(fifth.availabilityCheck?.date, "2027-06-15");
  assert.match(fifth.responseDraft ?? "", /June 15, 2027 in Tampa.*date is available/i);
  assert.doesNotMatch(fifth.responseDraft ?? "", /Evergreen Park gives us a good starting point/i);
  assert.doesNotMatch(fifth.responseDraft ?? "", /sounds like such a beautiful setting/i);
  assert.match(fifth.responseDraft ?? "", /Same next step from here/i);
});

test("simple wedding sales runtime resolves a selected suggested call time", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "10:30 works",
    previousState: {
      customerName: "Emily",
      partnerName: "Daniel",
      weddingDate: "2027-06-15",
      location: "Orlando",
      venue: "Evergreen Park",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-15",
        location: "Orlando",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
      proposedCallTime: "2026-06-24T10:00:00-04:00",
      calendarStatus: "busy",
      calendarContextDate: "2026-06-24",
      suggestedCallTimes: ["09:00", "09:30", "10:30"],
      consultationCheck: {
        proposedTime: "2026-06-24T10:00:00-04:00",
        status: "unavailable",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
    },
    toolContext,
    understand: (state) => understandTurnHeuristically(state),
  });

  assert.equal(result.proposedCallTime, "2026-06-24T10:30:00");
  assert.equal(result.calendarStatus, "available");
  assert.equal(result.checkedCallTime, "10:30");
  assert.equal(result.nextStep, "ask_email");
  assert.match(result.responseDraft ?? "", /10:30 AM works on my calendar/i);
  assert.match(result.responseDraft ?? "", /best email/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Got it\. I can help/i);
});

test("simple wedding sales runtime answers where the consultation call will happen", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Where we will call?",
    previousState: {
      customerName: "Emily",
      partnerName: "Daniel",
      weddingDate: "2027-06-15",
      location: "Orlando",
      venue: "Evergreen Park",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-15",
        location: "Orlando",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
      proposedCallTime: "2026-06-24T10:30:00",
      calendarStatus: "available",
      checkedCallDate: "2026-06-24",
      checkedCallTime: "10:30",
      consultationCheck: {
        proposedTime: "2026-06-24T10:30:00",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
    },
    understand: (state) => understandTurnHeuristically(state),
  });

  assert.equal(result.nextStep, "ask_email");
  assert.match(result.responseDraft ?? "", /calendar invite with the call details/i);
  assert.match(result.responseDraft ?? "", /best email/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Got it\. I can help/i);
});

test("simple wedding sales runtime answers as Taras instead of handing off to Taras", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Before we finish, can I speak directly with Taras?",
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        questionsAskedByCustomer: ["identity"],
        confidence: 0.2,
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.mode, "bot_active");
  assert.equal(result.handoffReason, undefined);
  assert.equal(result.decisionTrace?.replyType, "identity_answer");
  assert.match(result.responseDraft ?? "", /speaking with me here.*I'm Taras/i);
});

test("simple wedding sales runtime answers shooter question as team knowledge instead of identity", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Who will be shooter? You?",
    previousState: {
      weddingDate: "2026-10-17",
      location: "Tampa, Florida",
      availability: "available",
      availabilityCheck: {
        date: "2026-10-17",
        location: "Tampa, Florida",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "answer_to_question",
        facts: {},
        questionsAskedByCustomer: ["identity", "team"],
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.decisionTrace?.replyType, "team_answer");
  assert.match(result.responseDraft ?? "", /Jay.*lead filmmaker.*Tampa/i);
  assert.doesNotMatch(result.responseDraft ?? "", /speaking with me here/i);
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

test("simple wedding sales runtime does not hand off when call time is actionable despite other classification", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Can we call tomorrow at 10 am?",
    toolContext,
    previousState: {
      customerName: "Rick",
      partnerName: "Dakota",
      weddingDate: "2026-10-17",
      location: "Tampa, Florida",
      venue: "Evergreen Park",
      availability: "available",
      availabilityCheck: {
        date: "2026-10-17",
        location: "Tampa, Florida",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "tomorrow at 10 am",
        },
        questionsAskedByCustomer: ["other"],
      }),
  });

  assert.notEqual(result.nextStep, "handoff");
  assert.equal(result.mode, "bot_active");
  assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
});

test("simple wedding sales runtime handles call time and shooter question in one DM", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Can we call tomorrow at 10am? Also who shoots the wedding?",
    toolContext,
    config: {
      portfolio: [
        {
          label: "Recent Film",
          url: "https://galleries.example/recent",
        },
      ],
    },
    previousState: {
      customerName: "Rick",
      partnerName: "Dakota",
      weddingDate: "2026-10-17",
      location: "Tampa, Florida",
      venue: "Evergreen Park",
      availability: "available",
      availabilityCheck: {
        date: "2026-10-17",
        location: "Tampa, Florida",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "tomorrow at 10am",
        },
        questionsAskedByCustomer: ["team"],
      }),
  });

  assert.notEqual(result.nextStep, "handoff");
  assert.equal(result.mode, "bot_active");
  assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
  assert.match(result.responseDraft ?? "", /10(?:\:00)?\s*(?:am|AM).*works on my calendar/i);
  assert.match(result.responseDraft ?? "", /Jay.*lead filmmaker.*Tampa/i);
  assert.doesNotMatch(result.responseDraft ?? "", /recent films|galleries\.example/i);
});

test("simple wedding sales runtime handles call time and explicit portfolio request in one DM", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Can we call tomorrow at 10am? Also can you send recent films?",
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
      },
      portfolio: [
        {
          label: "Recent Film",
          url: "https://galleries.example/recent",
        },
      ],
    },
    previousState: {
      customerName: "Rick",
      partnerName: "Dakota",
      weddingDate: "2026-10-17",
      location: "Tampa, Florida",
      venue: "Evergreen Park",
      availability: "available",
      availabilityCheck: {
        date: "2026-10-17",
        location: "Tampa, Florida",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "tomorrow at 10am",
        },
        questionsAskedByCustomer: ["portfolio"],
      }),
  });

  assert.notEqual(result.nextStep, "handoff");
  assert.equal(result.mode, "bot_active");
  assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
  assert.match(result.responseDraft ?? "", /10(?:\:00)?\s*(?:am|AM).*works on my calendar/i);
  assert.match(result.responseDraft ?? "", /recent films.*Recent Film: https:\/\/galleries\.example\/recent/i);
  assert.doesNotMatch(result.responseDraft ?? "", /wedding films start|collections guide/i);
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

test("simple wedding sales runtime rejects proposed consultation time outside configured business days", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Can we call Saturday at 1pm?",
    toolContext,
    config: {
      callBookingWindow: {
        startHour: 9,
        endHour: 14,
        durationMinutes: 30,
        businessDays: [1, 2, 3, 4, 5],
        timezone: "America/New_York",
      },
    },
    previousState: {
      customerName: "Rick",
      partnerName: "Dakota",
      weddingDate: "2026-10-17",
      location: "Tampa, Florida",
      venue: "Evergreen Park",
      availability: "available",
      availabilityCheck: {
        date: "2026-10-17",
        location: "Tampa, Florida",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "Saturday at 1pm",
        },
      }),
  });

  assert.equal(result.nextStep, "ask_call_time");
  assert.equal(result.decisionTrace?.replyType, "call_time_out_of_window");
  assert.deepEqual(result.toolObservations, []);
  assert.match(result.responseDraft ?? "", /Monday-Friday, 9am-2pm/i);
});

test("simple wedding sales runtime uses configured consultation hours before calendar checks", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Can we call tomorrow at 3pm?",
    toolContext,
    config: {
      callBookingWindow: {
        startHour: 10,
        endHour: 16,
        durationMinutes: 30,
        businessDays: [1, 2, 3, 4, 5],
        timezone: "America/New_York",
      },
    },
    previousState: {
      customerName: "Rick",
      partnerName: "Dakota",
      weddingDate: "2026-10-17",
      location: "Tampa, Florida",
      venue: "Evergreen Park",
      availability: "available",
      availabilityCheck: {
        date: "2026-10-17",
        location: "Tampa, Florida",
        status: "available",
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
    },
    understand: () =>
      understanding({
        customerMessageType: "call_time_proposed",
        facts: {
          proposedCallTime: "tomorrow at 3pm",
        },
      }),
  });

  assert.equal(result.decisionTrace?.toolCalled, "checkCalendar");
  assert.deepEqual(
    result.toolObservations.map((observation) => observation.toolName),
    ["check_consultation_calendar"],
  );
});

test("simple wedding sales runtime does not hand off from sentiment alone", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "This is ridiculous, why are you asking so many questions?",
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {},
        questionsAskedByCustomer: [],
      }),
  });

  assert.notEqual(result.nextStep, "handoff");
  assert.equal(result.mode, "bot_active");
  assert.equal(result.handoffReason, undefined);
});

test("simple wedding sales runtime hands off a business question outside configured knowledge", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "Can you also arrange a live band for us?",
    understand: () =>
      understanding({
        customerMessageType: "business_question",
        facts: {},
        questionsAskedByCustomer: ["other"],
        confidence: 0.95,
      }),
  });

  assert.equal(result.nextStep, "handoff");
  assert.equal(result.mode, "human_needed");
  assert.equal(result.handoffReason, "unanswered_business_question");
  assert.equal(result.decisionTrace?.replyType, "handoff");
});

test("simple wedding sales runtime asks for clarification before handing off", async () => {
  const result = await invokeWeddingSalesSimpleGraph({
    channel: "instagram",
    message: "the other thing maybe",
    understand: () =>
      understanding({
        customerMessageType: "unclear",
        facts: {},
        questionsAskedByCustomer: [],
        confidence: 0.2,
      }),
  });

  assert.equal(result.nextStep, "reply_only");
  assert.equal(result.mode, "bot_active");
  assert.equal(result.unclearAttemptCount, 1);
  assert.equal(result.decisionTrace?.replyType, "clarification");
  assert.match(result.responseDraft ?? "", /tell me a little more/i);
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
  assert.match(result.responseDraft ?? "", /10:00 AM or 11:00 AM instead/i);
  assert.match(result.responseDraft ?? "", /Would one of those work for you/i);
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
