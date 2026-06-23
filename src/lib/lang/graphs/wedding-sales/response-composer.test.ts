import assert from "node:assert/strict";
import test from "node:test";

import { defaultWeddingSalesConfig } from "./config";
import {
  composeHumanWeddingSalesResponse,
  composeWeddingSalesResponse,
  finalizeLlmWeddingSalesResponse,
  parseWeddingSalesReflectionJson,
  weddingSalesResponseComposerTestHelpers,
} from "./response-composer";
import type { WeddingSalesState } from "./state";

const baseState: WeddingSalesState = {
  channel: "gmail",
  leadStage: "availability_checked",
  names: "Anna and Mark",
  weddingDate: "2027-06-14",
  weddingDateText: "June 14",
  weddingYear: "2027",
  weddingYearKnown: true,
  location: "Charlotte",
  availability: "available",
  guideSent: false,
  callProposed: false,
  bookingConfirmed: false,
  toolObservations: [],
  turnToolObservations: [],
  assistantReplyCount: 0,
  hasGreeted: false,
  signatureSent: false,
  portfolioSent: false,
  reviewsSent: false,
  guideOffered: false,
  askedForNames: false,
  askedForWeddingYear: false,
  askedForVenue: false,
  askedForCallTime: false,
  askedForEmail: false,
};

const config = {
  ...defaultWeddingSalesConfig,
  guide: {
    fileName: "Collections Guide",
    link: "https://example.com/guide",
  },
  portfolio: [
    {
      label: "Callista and Kevin",
      url: "https://example.com/film",
    },
  ],
  reviews: {
    label: "Google Reviews",
    url: "https://example.com/reviews",
  },
  signature: "Taras Mynd\nMYNDFUL FILMS",
};

const instagramFirstContactOpening = [
  "Hey there! Thank you so much for reaching out 🤍✨",
  "",
  "I’m Taras, the founder of Myndful Films. Huge congratulations on your engagement, such an exciting season of life",
].join("\n");

test("wedding sales composer formats rich gmail links and one signature", () => {
  const response = composeWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: baseState,
  });

  assert.match(response, /June 14, 2027 in Charlotte/);
  assert.match(response, /<a href="https:\/\/example.com\/film">Callista and Kevin<\/a>/);
  assert.match(response, /<a href="https:\/\/example.com\/reviews">Google Reviews<\/a>/);
  assert.equal(response.match(/Taras Mynd/g)?.length, 1);
});

test("wedding sales composer avoids resending guide assets after guide was sent", () => {
  const response = composeWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: {
      ...baseState,
      guideSent: true,
    },
  });

  assert.doesNotMatch(response, /collections guide/i);
  assert.doesNotMatch(response, /Callista and Kevin/);
  assert.match(response, /quick consultation/i);
});

test("wedding sales composer answers FAQ from Myndful business facts", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      latestCustomerMessage: "What is your style and how long does editing take?",
      callProposed: true,
    },
  });

  assert.match(response, /cinematic documentary/i);
  assert.match(response, /photographer/i);
  assert.match(response, /quick consultation/i);
  assert.doesNotMatch(response, /we do travel/i);
});

test("wedding sales composer answers business location and continues with planned year question", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "waiting_wedding_year",
      latestCustomerMessage: "Where are you located?",
      weddingDate: undefined,
      weddingDateText: "November 20",
      weddingYear: undefined,
      weddingYearKnown: false,
      location: undefined,
      availability: undefined,
      semanticStateVersion: 2,
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "clarify",
        guardrailTrace: [],
        actions: [
          {
            type: "answer_question",
            field: null,
            topicId: "business_location",
            reason: "known_business_location_question",
          },
          {
            type: "ask_missing_field",
            field: "weddingYear",
            topicId: null,
            reason: "continue_sales_flow_after_known_business_location_answer",
          },
        ],
      },
    },
  });

  assert.match(response, /Tampa, FL/i);
  assert.match(response, /Charlotte/i);
  assert.match(response, /What year is November 20/i);
});

test("wedding sales composer gives travel answer without guessing fees", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      latestCustomerMessage: "Do you charge a travel fee for our venue?",
      callProposed: true,
    },
  });

  assert.match(response, /roundtrip travel coverage/i);
  assert.match(response, /Classic Collection/i);
  assert.match(response, /Premium Collection/i);
  assert.match(response, /Exclusive Collection/i);
  assert.match(response, /small travel fee/i);
  assert.match(response, /call/i);
  assert.doesNotMatch(response, /no travel fee/i);
  assert.doesNotMatch(response, /\$0\.65/i);
});

test("wedding sales composer does not add a name question outside the v2 action plan", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 2,
      names: "Mia and Ethan",
      customerName: "Mia",
      partnerName: "Ethan",
      coupleDisplayName: "Mia and Ethan",
      nameCollectionStatus: "both",
      latestCustomerMessage: "Do you charge travel fees?",
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "answer_and_qualify",
        actions: [
          {
            type: "answer_question",
            field: null,
            topicId: "travel_fees",
            reason: "customer_asked_current_business_question",
          },
        ],
        guardrailTrace: [],
      },
    },
  });

  assert.match(response, /roundtrip travel coverage/i);
  assert.doesNotMatch(response, /fianc/i);
  assert.doesNotMatch(response, /both of your names/i);
});

test("instagram style gate rejects unplanned v2 qualification questions", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    semanticStateVersion: 2,
    names: "Mia and Ethan",
    customerName: "Mia",
    partnerName: "Ethan",
    coupleDisplayName: "Mia and Ethan",
    nameCollectionStatus: "both",
    latestCustomerMessage: "Do you charge travel fees?",
    assistantReplyCount: 2,
    hasGreeted: true,
    lastActionPlan: {
      schemaVersion: 1,
      responseGoal: "answer_and_qualify",
      actions: [
        {
          type: "answer_question",
          field: null,
          topicId: "travel_fees",
          reason: "customer_asked_current_business_question",
        },
      ],
      guardrailTrace: [],
    },
  };
  const fallback = "Our collections include roundtrip travel coverage.\n\nWe can go over exact travel details on the call.";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "answer_question", config, state },
    "Our collections include roundtrip travel coverage. What is your fiance's name?",
    fallback,
  );

  assert.equal(response, fallback);
});

test("instagram style gate allows only the v2 planned missing-field question", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    semanticStateVersion: 2,
    names: "Mia and Ethan",
    customerName: "Mia",
    partnerName: "Ethan",
    coupleDisplayName: "Mia and Ethan",
    nameCollectionStatus: "both",
    latestCustomerMessage: "Do you charge travel fees?",
    assistantReplyCount: 2,
    hasGreeted: true,
    lastActionPlan: {
      schemaVersion: 1,
      responseGoal: "answer_and_qualify",
      actions: [
        {
          type: "answer_question",
          field: null,
          topicId: "travel_fees",
          reason: "customer_asked_current_business_question",
        },
        {
          type: "ask_missing_field",
          field: "venue",
          topicId: null,
          reason: "venue_is_the_next_missing_field",
        },
      ],
      guardrailTrace: [],
    },
  };

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "answer_question", config, state },
    "Our collections include roundtrip travel coverage. What is the exact venue?",
    "fallback",
  );

  assert.match(response, /exact venue/i);
});

test("wedding sales composer asks the action-plan partnerName field without recomputing names", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 2,
      names: "Bob",
      customerName: "Bob",
      nameCollectionStatus: "customer_only",
      weddingDate: "2026-10-23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh, NC",
      assistantReplyCount: 2,
      hasGreeted: true,
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "clarify",
        actions: [
          {
            type: "ask_missing_field",
            field: "partnerName",
            topicId: null,
            reason: "partner_name_missing",
          },
        ],
        guardrailTrace: [],
      },
    },
  });

  assert.match(response, /fianc/i);
  assert.doesNotMatch(response, /wedding date/i);
  assert.doesNotMatch(response, /both of your names/i);
});

test("wedding sales composer does not ask legacy missing-info questions when v2 plan has no planned field", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 2,
      names: undefined,
      customerName: undefined,
      partnerName: undefined,
      weddingDate: undefined,
      weddingDateText: undefined,
      assistantReplyCount: 1,
      hasGreeted: true,
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "continue",
        actions: [
          {
            type: "continue_conversation",
            field: null,
            topicId: null,
            reason: "no_customer_facing_question_planned",
          },
        ],
        guardrailTrace: [],
      },
    },
  });

  assert.equal(response, "");
});

test("wedding sales human composer sanitizes fallback questions when v2 plan has no planned field", async () => {
  const originalComposerFlag = process.env.WEDDING_SALES_LLM_COMPOSER;
  process.env.WEDDING_SALES_LLM_COMPOSER = "false";

  try {
    const response = await composeHumanWeddingSalesResponse({
      intent: "answer_question",
      config,
      state: {
        ...baseState,
        channel: "instagram",
        semanticStateVersion: 2,
        leadStage: "answering_question",
        names: undefined,
        customerName: undefined,
        partnerName: undefined,
        weddingDate: undefined,
        weddingDateText: undefined,
        location: undefined,
        latestCustomerMessage: "What is your style?",
        assistantReplyCount: 1,
        hasGreeted: true,
        lastActionPlan: {
          schemaVersion: 1,
          responseGoal: "answer_and_qualify",
          actions: [
            {
              type: "answer_question",
              field: null,
              topicId: "style",
              reason: "customer_asked_current_business_question",
            },
          ],
          guardrailTrace: [],
        },
      },
    });

    assert.match(response, /cinematic documentary/i);
    assert.doesNotMatch(response, /\?/);
    assert.doesNotMatch(response, /fianc|both of your names|wedding date|venue|location/i);
  } finally {
    if (originalComposerFlag === undefined) {
      delete process.env.WEDDING_SALES_LLM_COMPOSER;
    } else {
      process.env.WEDDING_SALES_LLM_COMPOSER = originalComposerFlag;
    }
  }
});

test("wedding sales human composer keeps required calendar busy follow-up under v2 action authority", async () => {
  const originalComposerFlag = process.env.WEDDING_SALES_LLM_COMPOSER;
  process.env.WEDDING_SALES_LLM_COMPOSER = "false";

  try {
    const response = await composeHumanWeddingSalesResponse({
      intent: "calendar_busy",
      config,
      summary: "Consultation slot 12:30 is busy. Nearby openings: 11:30, 12:00, 13:00.",
      state: {
        ...baseState,
        channel: "instagram",
        semanticStateVersion: 2,
        leadStage: "checking_calendar",
        names: "Samantha and Collin",
        customerName: "Samantha",
        partnerName: "Collin",
        weddingDate: "2027-03-06",
        weddingYear: "2027",
        weddingYearKnown: true,
        location: "Fort Lauderdale",
        venue: "The Ritz",
        availability: "available",
        proposedCallTime: "Wednesday June 24 at 12:30",
        calendarStatus: "busy",
        calendarContextDate: "2026-06-24",
        suggestedCallTimes: ["11:30", "12:00", "13:00"],
        latestCustomerMessage: "Wednesday June 24 at 12:30",
        assistantReplyCount: 5,
        hasGreeted: true,
        askedForCallTime: true,
        lastActionPlan: {
          schemaVersion: 1,
          responseGoal: "run_tools_then_reply",
          actions: [
            {
              type: "check_consultation_calendar",
              field: null,
              topicId: null,
              reason: "call_time_is_ready_and_wedding_date_is_available",
            },
          ],
          guardrailTrace: [
            {
              action: "check_consultation_calendar",
              allowed: true,
              reason: "requirements_satisfied",
            },
          ],
        },
      },
    });

    assert.notEqual(response, "");
    assert.match(response, /June 24, 2026/);
    assert.match(response, /11:30/);
    assert.match(response, /12:00/);
    assert.match(response, /13:00/);
    assert.match(response, /\?/);
  } finally {
    if (originalComposerFlag === undefined) {
      delete process.env.WEDDING_SALES_LLM_COMPOSER;
    } else {
      process.env.WEDDING_SALES_LLM_COMPOSER = originalComposerFlag;
    }
  }
});


test("wedding sales composer uses plain links for instagram", () => {
  const response = composeWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: {
      ...baseState,
      channel: "instagram",
    },
  });

  assert.doesNotMatch(response, /<a href=/);
  assert.match(response, /\$3,490/);
  assert.match(response, /8-hour collections/i);
  assert.match(response, /venue/i);
  assert.doesNotMatch(response, /Taras Mynd/);
  assert.doesNotMatch(response, /MYNDFUL FILMS/);
});

test("instagram pricing answer stays short and does not add unasked travel details", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "answering_question",
      names: undefined,
      weddingDate: undefined,
      weddingDateText: undefined,
      location: undefined,
      availability: undefined,
      latestCustomerMessage: "What’s your price?",
    },
  });

  assert.match(response, /\$2,950/);
  assert.match(response, /\$3,490/);
  assert.match(response, /What are both of your names/i);
  assert.match(response, /wedding date/i);
  assert.doesNotMatch(response, /travel/i);
  assert.doesNotMatch(response, /tailored|next steps/i);
});

test("wedding sales composer uses Florida start price for Florida leads", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "answering_question",
      location: "Tampa, FL",
      latestCustomerMessage: "What’s your price?",
    },
  });

  assert.match(response, /\$2,950/);
  assert.doesNotMatch(response, /\$3,490/);
  assert.match(response, /8-hour collections/i);
});

test("instagram booking question after a busy calendar check asks for another time", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 2,
      leadStage: "checking_calendar",
      names: "Mia and Ethan",
      customerName: "Mia",
      partnerName: "Ethan",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte, NC",
      venue: "Evergreen Park",
      availability: "available",
      proposedCallTime: "tomorrow at 11",
      calendarStatus: "busy",
      latestCustomerMessage: "What’s next step? Are we booking?",
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "answer_and_qualify",
        guardrailTrace: [],
        actions: [
          {
            type: "answer_question",
            field: null,
            topicId: "booking",
            reason: "customer_asked_current_business_question",
          },
        ],
      },
    },
  });

  assert.match(response, /already taken/i);
  assert.match(response, /What other time works/i);
});

test("instagram missing calendar time does not claim the slot is taken", () => {
  const response = composeWeddingSalesResponse({
    intent: "calendar_time_missing",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 2,
      leadStage: "checking_calendar",
      names: "Bob and Marie",
      customerName: "Bob",
      partnerName: "Marie",
      weddingDate: "2026-10-23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh, NC",
      venue: "Evergreen Park",
      availability: "available",
      proposedCallTime: "sometime tomorrow",
      calendarStatus: undefined,
      latestCustomerMessage: "Can we call sometime tomorrow?",
    },
  });

  assert.doesNotMatch(response, /taken|busy|not available/i);
  assert.match(response, /What time works/i);
});

test("instagram availability copy says we have the date available", () => {
  const response = composeWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      names: "Bob and Marie",
      customerName: "Bob",
      partnerName: "Marie",
      weddingDate: "2026-10-23",
      weddingDateText: "October 23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh, NC",
      availability: "available",
      guideSent: false,
      callProposed: false,
      assistantReplyCount: 1,
      hasGreeted: true,
    },
  });

  assert.match(response, /Awesome Bob! We have October 23, 2026 available/i);
  assert.doesNotMatch(response, /You and Marie have/i);
});

test("instagram team follow-up answers shooter question without repeating venue prompt", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 2,
      leadStage: "missing_location_or_venue",
      names: "Bob and Marie",
      customerName: "Bob",
      partnerName: "Marie",
      weddingDate: "2026-10-23",
      weddingDateText: "October 23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh, North Carolina, USA",
      availability: "available",
      guideSent: true,
      askedForVenue: true,
      responseDraft:
        "Our lead filmmakers for North Carolina, South Carolina, and Georgia are Dima and Marie in Charlotte.\n\nCould you share your wedding venue?",
      latestCustomerMessage: "Are you going to be a shooter?",
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "answer_and_qualify",
        guardrailTrace: [],
        actions: [
          {
            type: "answer_question",
            field: null,
            topicId: "team_nc_sc_ga",
            reason: "customer_asked_current_business_question",
          },
          {
            type: "ask_missing_field",
            field: "venue",
            topicId: null,
            reason: "venue_is_the_next_missing_field",
          },
        ],
      },
    },
  });

  assert.match(response, /I personally won’t be the lead shooter/i);
  assert.match(response, /Dima and Marie/i);
  assert.doesNotMatch(response, /venue/i);
});

test("instagram FAQ answers package inclusions and shooter in the same turn", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 3,
      leadStage: "asking_call_time",
      names: "Bob and Marie",
      customerName: "Bob",
      partnerName: "Marie",
      weddingDate: "2026-10-23",
      weddingDateText: "October 23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh, NC",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      latestCustomerMessage: "Do you include raw footage? Who is the shooter?",
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "answer_and_qualify",
        guardrailTrace: [],
        actions: [
          {
            type: "answer_question",
            field: null,
            topicId: "package_inclusions",
            reason: "customer_asked_current_business_question",
          },
          {
            type: "answer_question",
            field: null,
            topicId: "team_nc_sc_ga",
            reason: "customer_asked_current_business_question",
          },
          {
            type: "ask_missing_field",
            field: "callTime",
            topicId: null,
            reason: "continue_sales_flow_after_answers",
          },
        ],
      },
    },
  });

  assert.match(response, /raw footage/i);
  assert.match(response, /Dima and Marie/i);
  assert.equal((response.match(/What time works best/g) ?? []).length, 1);
});

test("instagram mixed availability and FAQ turn includes availability guide and all answers", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 3,
      leadStage: "availability_checked",
      names: "Cindy and Paul",
      customerName: "Cindy",
      partnerName: "Paul",
      weddingDate: "2026-10-18",
      weddingDateText: "October 18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor FL",
      venue: "Harborside Chapel",
      availability: "available",
      guideSent: true,
      guideOffered: true,
      callProposed: true,
      latestCustomerMessage:
        "I’m Cindy and my fiancé is Paul. Our wedding is 10/18/26 at Harborside Chapel in Safety Harbor FL. Also do you include raw footage and who is the shooter?",
      turnToolObservations: [
        {
          toolName: "check_wedding_availability",
          result: "Wedding date check: 2026-10-18 is available for FL (0/1 booked).",
        },
      ],
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "run_tools_then_reply",
        guardrailTrace: [],
        actions: [
          {
            type: "check_wedding_availability",
            field: null,
            topicId: null,
            reason: "date_and_location_are_ready_for_capacity_check",
          },
          {
            type: "answer_question",
            field: null,
            topicId: "package_inclusions",
            reason: "answer_customer_question_after_required_tool",
          },
          {
            type: "answer_question",
            field: null,
            topicId: "team_florida",
            reason: "answer_customer_question_after_required_tool",
          },
        ],
      },
    },
  });

  assert.match(response, /available/i);
  assert.match(response, /\$2,950/i);
  assert.match(response, /guide/i);
  assert.match(response, /raw footage/i);
  assert.match(response, /Jay/i);
  assert.match(response, /What time works best/i);
});

test("instagram FAQ resolves shooter answer from saved location when no action-plan topic is present", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 3,
      leadStage: "asking_call_time",
      names: "Bob and Marie",
      customerName: "Bob",
      partnerName: "Marie",
      weddingDate: "2026-10-23",
      weddingDateText: "October 23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh, NC",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      latestCustomerMessage: "Who is the shooter?",
      lastActionPlan: undefined,
    },
  });

  assert.match(response, /Dima and Marie/i);
});

test("instagram FAQ uses first-person Florida team wording", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 3,
      leadStage: "asking_call_time",
      names: "Rachel and Mike",
      customerName: "Rachel",
      partnerName: "Mike",
      weddingDate: "2026-11-08",
      weddingDateText: "November 8",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Tampa, FL",
      venue: "The Vault",
      availability: "available",
      guideSent: true,
      callProposed: true,
      latestCustomerMessage: "Who is the shooter?",
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "answer_and_qualify",
        guardrailTrace: [],
        actions: [
          {
            type: "answer_question",
            field: null,
            topicId: "team_florida",
            reason: "customer_asked_current_business_question",
          },
        ],
      },
    },
  });

  assert.match(response, /Jay/i);
  assert.match(response, /I’ll confirm the exact team details/i);
  assert.doesNotMatch(response, /Taras and the Myndful Films team/i);
});

test("instagram guard rejects calendar availability claims before the calendar tool runs", () => {
  const unsafe = weddingSalesResponseComposerTestHelpers.claimsUncheckedCalendarAvailability(
    {
      intent: "answer_question",
      config,
      state: {
        ...baseState,
        channel: "instagram",
        semanticStateVersion: 3,
        leadStage: "asking_call_time",
        names: "Cindy and Paul",
        customerName: "Cindy",
        partnerName: "Paul",
        weddingDate: "2026-10-18",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Charlotte, NC",
        venue: "The Ivy Place",
        availability: "available",
        callProposed: true,
        proposedCallTime: undefined,
        calendarStatus: undefined,
        latestCustomerMessage: "Friday 10am",
      },
    },
    "Friday at 10 AM Eastern works perfectly. Looking forward to our call.",
  );

  assert.equal(unsafe, true);
});

test("instagram guard allows calendar availability language after calendar check", () => {
  const unsafe = weddingSalesResponseComposerTestHelpers.claimsUncheckedCalendarAvailability(
    {
      intent: "ask_email",
      config,
      state: {
        ...baseState,
        channel: "instagram",
        semanticStateVersion: 3,
        leadStage: "waiting_customer_email",
        names: "Cindy and Paul",
        customerName: "Cindy",
        partnerName: "Paul",
        weddingDate: "2026-10-18",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Charlotte, NC",
        venue: "The Ivy Place",
        availability: "available",
        callProposed: true,
        proposedCallTime: "Friday 10am",
        calendarStatus: "available",
        latestCustomerMessage: "Friday 10am",
      },
    },
    "Friday at 10 AM Eastern works perfectly. What email should I use for the invite?",
  );

  assert.equal(unsafe, false);
});

test("instagram human composer keeps deterministic fallback when the LLM composer is disabled", async () => {
  const originalComposerFlag = process.env.WEDDING_SALES_LLM_COMPOSER;
  process.env.WEDDING_SALES_LLM_COMPOSER = "false";

  try {
    const response = await composeHumanWeddingSalesResponse({
      intent: "ask_missing_info",
      config,
      state: {
        ...baseState,
        channel: "instagram",
        leadStage: "missing_names_or_date",
        names: "Mark and Julie",
        weddingDate: undefined,
        weddingDateText: undefined,
        assistantReplyCount: 1,
        hasGreeted: true,
      },
    });

    assert.equal(response, "What’s your wedding date? ✨");
  } finally {
    if (originalComposerFlag === undefined) {
      delete process.env.WEDDING_SALES_LLM_COMPOSER;
    } else {
      process.env.WEDDING_SALES_LLM_COMPOSER = originalComposerFlag;
    }
  }
});

test("instagram v3 action-plan replies use grounded voice outside the old availability subset", () => {
  const shouldUseGroundedVoice = weddingSalesResponseComposerTestHelpers.shouldUseGroundedInstagramVoice({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 3,
      leadStage: "missing_names_or_date",
      names: undefined,
      weddingDate: undefined,
      weddingDateText: undefined,
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "qualify",
        actions: [
          {
            type: "ask_missing_field",
            field: "names",
            topicId: null,
            reason: "continue_qualification_after_new_inquiry",
          },
        ],
        guardrailTrace: [],
      },
    },
  });

  assert.equal(shouldUseGroundedVoice, true);
});

test("instagram v3 handoff-only plans stay customer-silent instead of using grounded voice", () => {
  const shouldUseGroundedVoice = weddingSalesResponseComposerTestHelpers.shouldUseGroundedInstagramVoice({
    intent: "handoff",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      semanticStateVersion: 3,
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "handoff",
        actions: [
          {
            type: "recommend_owner_handoff",
            field: null,
            topicId: null,
            reason: "unknown_business_question_requires_owner",
          },
        ],
        guardrailTrace: [],
      },
    },
  });

  assert.equal(shouldUseGroundedVoice, false);
});

test("instagram v3 fallback avoids old stock availability wording when grounded voice is unavailable", async () => {
  const originalComposerFlag = process.env.WEDDING_SALES_LLM_COMPOSER;
  process.env.WEDDING_SALES_LLM_COMPOSER = "false";

  try {
    const response = await composeHumanWeddingSalesResponse({
      intent: "answer_question",
      config,
      state: {
        ...baseState,
        channel: "instagram",
        semanticStateVersion: 3,
        leadStage: "availability_checked",
        names: "Cindy and Paul",
        customerName: "Cindy",
        partnerName: "Paul",
        weddingDate: "2026-10-18",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Safety Harbor FL",
        venue: "Harborside Chapel",
        availability: "available",
        guideSent: true,
        callProposed: true,
        latestCustomerMessage: "Do you include raw footage and who is the shooter?",
        turnToolObservations: [
          {
            toolName: "check_wedding_availability",
            result: JSON.stringify({ status: "available", region: "FL" }),
          },
        ],
        lastActionPlan: {
          schemaVersion: 1,
          responseGoal: "run_tools_then_reply",
          actions: [
            {
              type: "check_wedding_availability",
              field: null,
              topicId: null,
              reason: "date_and_location_are_ready_for_capacity_check",
            },
            {
              type: "answer_question",
              field: null,
              topicId: "package_inclusions",
              reason: "answer_customer_question_after_required_tool",
            },
            {
              type: "answer_question",
              field: null,
              topicId: "team_florida",
              reason: "answer_customer_question_after_required_tool",
            },
          ],
          guardrailTrace: [],
        },
      },
    });

    assert.doesNotMatch(response, /^Awesome Cindy! We have/i);
    assert.match(response, /I checked October 18, 2026 in Safety Harbor FL/i);
    assert.match(response, /\$2,950/i);
    assert.match(response, /raw footage/i);
    assert.match(response, /Jay is our lead filmmaker in Tampa/i);
    assert.match(response, /What time works best/i);
  } finally {
    if (originalComposerFlag === undefined) {
      delete process.env.WEDDING_SALES_LLM_COMPOSER;
    } else {
      process.env.WEDDING_SALES_LLM_COMPOSER = originalComposerFlag;
    }
  }
});

test("instagram human composer keeps the first-contact introduction when the LLM composer is disabled", async () => {
  const originalComposerFlag = process.env.WEDDING_SALES_LLM_COMPOSER;
  process.env.WEDDING_SALES_LLM_COMPOSER = "false";

  try {
    const response = await composeHumanWeddingSalesResponse({
      intent: "availability_available",
      config,
      state: {
        ...baseState,
        channel: "instagram",
        assistantReplyCount: 0,
        hasGreeted: false,
      },
    });

    assert.ok(response.startsWith(instagramFirstContactOpening));
    assert.match(response, /available/i);
    assert.match(response, /\$3,490/);
  } finally {
    if (originalComposerFlag === undefined) {
      delete process.env.WEDDING_SALES_LLM_COMPOSER;
    } else {
      process.env.WEDDING_SALES_LLM_COMPOSER = originalComposerFlag;
    }
  }
});

test("instagram wedding-year fallback acknowledges newly captured names instead of repeating verbatim", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_wedding_year",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "waiting_wedding_year",
      names: "Olivia and Daniel",
      weddingDate: undefined,
      weddingDateText: "June 14",
      weddingYear: undefined,
      weddingYearKnown: false,
      askedForWeddingYear: true,
      latestCustomerMessage: "My fiance is Daniel",
      assistantReplyCount: 2,
      hasGreeted: true,
    },
  });

  assert.match(response, /Olivia and Daniel/);
  assert.match(response, /What year is June 14/i);
  assert.doesNotMatch(response, /Thank you so much\. Just so I check the right date/i);
});

test("instagram missing-name follow-up avoids repeating the same full prompt", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: "Olivia",
      weddingDate: "2027-06-14",
      weddingDateText: "June 14",
      askedForNames: true,
      assistantReplyCount: 2,
      hasGreeted: true,
    },
  });

  assert.match(response, /missed it/i);
  assert.match(response, /what’s your fiancé’s first name/i);
  assert.doesNotMatch(response, /That way I can check our availability/i);
});

test("instagram delayed follow-up softens missing names and date prompt", () => {
  const originalActionRuntime = process.env.WEDDING_SALES_ACTION_RUNTIME_V2;
  const originalComposerFlag = process.env.WEDDING_SALES_LLM_COMPOSER;
  process.env.WEDDING_SALES_ACTION_RUNTIME_V2 = "true";
  process.env.WEDDING_SALES_LLM_COMPOSER = "false";

  try {
    const response = composeWeddingSalesResponse({
      intent: "ask_missing_info",
      config,
      state: {
        ...baseState,
        channel: "instagram",
        agentId: "cmq6m9uk2000duxospuaod8al",
        runtimeEvent: "follow_up",
        runtimeMode: "unified_v2",
        semanticStateVersion: 2,
        leadStage: "missing_names_or_date",
        names: undefined,
        weddingDate: undefined,
        weddingDateText: undefined,
        askedForNames: true,
        assistantReplyCount: 1,
        hasGreeted: true,
        lastActionPlan: {
          schemaVersion: 1,
          actions: [
            {
              type: "ask_missing_field",
              field: "customerName",
              topicId: null,
              reason: "follow_up_continue_current_action_plan_missing_field",
            },
          ],
          responseGoal: "clarify",
          guardrailTrace: [],
        },
      },
    });

    assert.match(response, /Whenever you get a chance/i);
    assert.match(response, /both of your names and your wedding date/i);
    assert.doesNotMatch(response, /^What are both of your names/i);
  } finally {
    if (originalActionRuntime === undefined) {
      delete process.env.WEDDING_SALES_ACTION_RUNTIME_V2;
    } else {
      process.env.WEDDING_SALES_ACTION_RUNTIME_V2 = originalActionRuntime;
    }

    if (originalComposerFlag === undefined) {
      delete process.env.WEDDING_SALES_LLM_COMPOSER;
    } else {
      process.env.WEDDING_SALES_LLM_COMPOSER = originalComposerFlag;
    }
  }
});

test("instagram delayed follow-up softens every planned missing-field prompt", () => {
  const originalActionRuntime = process.env.WEDDING_SALES_ACTION_RUNTIME_V2;
  const originalComposerFlag = process.env.WEDDING_SALES_LLM_COMPOSER;
  process.env.WEDDING_SALES_ACTION_RUNTIME_V2 = "true";
  process.env.WEDDING_SALES_LLM_COMPOSER = "false";

  try {
    const cases = [
      { field: "venue", expected: /send over the venue/i },
      { field: "callTime", expected: /send over a time that works/i },
      { field: "email", expected: /send over the best email/i },
      { field: "weddingDate", expected: /send over your wedding date/i },
    ] as const;

    for (const item of cases) {
      const response = composeWeddingSalesResponse({
        intent: "ask_missing_info",
        config,
        state: {
          ...baseState,
          channel: "instagram",
          agentId: "cmq6m9uk2000duxospuaod8al",
          runtimeEvent: "follow_up",
          runtimeMode: "unified_v2",
          semanticStateVersion: 2,
          leadStage: "missing_names_or_date",
          lastActionPlan: {
            schemaVersion: 1,
            actions: [
              {
                type: "ask_missing_field",
                field: item.field,
                topicId: null,
                reason: "follow_up_continue_current_action_plan_missing_field",
              },
            ],
            responseGoal: "clarify",
            guardrailTrace: [],
          },
        },
      });

      assert.match(response, /Whenever you get a chance/i);
      assert.match(response, item.expected);
    }
  } finally {
    if (originalActionRuntime === undefined) {
      delete process.env.WEDDING_SALES_ACTION_RUNTIME_V2;
    } else {
      process.env.WEDDING_SALES_ACTION_RUNTIME_V2 = originalActionRuntime;
    }

    if (originalComposerFlag === undefined) {
      delete process.env.WEDDING_SALES_LLM_COMPOSER;
    } else {
      process.env.WEDDING_SALES_LLM_COMPOSER = originalComposerFlag;
    }
  }
});

test("instagram first missing-info reply asks for both names when no name is known", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: undefined,
      weddingDate: undefined,
      weddingDateText: undefined,
      askedForNames: false,
      assistantReplyCount: 0,
      hasGreeted: false,
    },
  });

  assert.ok(response.startsWith(instagramFirstContactOpening));
  assert.equal((response.match(/[🤍✨🎥]/gu) ?? []).length, 2);
  assert.match(response, /both of your names/i);
  assert.match(response, /wedding date/i);
  assert.doesNotMatch(response, /sharing your fiancé’s name and the date/i);
});

test("instagram later missing-info replies do not repeat the first-contact introduction", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: "Rachel",
      weddingDate: undefined,
      weddingDateText: undefined,
      assistantReplyCount: 1,
      hasGreeted: true,
    },
  });

  assert.doesNotMatch(response, /Thank you so much for reaching out/i);
  assert.doesNotMatch(response, /I’m Taras, the founder/i);
  assert.match(response, /fianc/i);
  assert.match(response, /wedding date/i);
});

test("instagram first missing-info reply asks only for fiance name when customer name is known", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: "Rachel",
      weddingDate: undefined,
      weddingDateText: undefined,
      askedForNames: false,
      assistantReplyCount: 0,
      hasGreeted: false,
    },
  });

  assert.match(response, /fiancé’s name/i);
  assert.match(response, /wedding date/i);
  assert.doesNotMatch(response, /both of your names/i);
});

test("unavailable-date follow-up answers pricing without repeating availability check copy", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "answering_question",
      names: "Priya and Arjun",
      weddingDate: "2026-09-19",
      weddingDateText: "September 19",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Atlanta",
      availability: "unavailable",
      latestCustomerMessage: "What do your packages start at and do you travel?",
    },
  });

  assert.match(response, /\$3,490/);
  assert.match(response, /travel/i);
  assert.doesNotMatch(response, /unavailable/i);
  assert.doesNotMatch(response, /I checked/i);
});

test("unavailable wedding date reply softly offers nearby dates without deferring confirmation", () => {
  const response = composeWeddingSalesResponse({
    intent: "availability_unavailable",
    config,
    summary:
      "Wedding date check: 2026-10-11 is unavailable for NC (1/1 booked). Offer these nearby dates right away: 2026-10-10, 2026-10-12.",
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "availability_checked",
      names: "Rick and Julie",
      weddingDate: "2026-10-11",
      weddingDateText: "October 11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte, NC",
      availability: "unavailable",
      latestCustomerMessage: "Charlotte, NC in Evergreen Park",
    },
  });

  assert.match(response, /already booked|unavailable/i);
  assert.match(response, /October 10, 2026/);
  assert.match(response, /October 12, 2026/);
  assert.doesNotMatch(response, /still some time away/i);
  assert.doesNotMatch(response, /closer/i);
  assert.doesNotMatch(response, /can't confirm|cannot confirm|able to confirm/i);
});

test("wedding sales composer confirms consultation booking warmly without wedding-booking language", () => {
  const response = composeWeddingSalesResponse({
    intent: "booking_confirmed",
    config,
    state: {
      ...baseState,
      leadStage: "booked",
      bookingConfirmed: true,
    },
  });

  assert.match(response, /calendar invite/i);
  assert.match(response, /consultation/i);
  assert.match(response, /looking forward/i);
  assert.doesNotMatch(response, /wedding.*booked/i);
  assert.doesNotMatch(response, /date.*reserved/i);
  assert.equal(response.match(/Taras Mynd/g)?.length ?? 0, 0);
});

test("wedding sales composer labels test-mode booking without claiming a live invite was sent", () => {
  const response = composeWeddingSalesResponse({
    intent: "booking_confirmed",
    summary: "This consultation slot could be booked without triggering live calendar or lead side effects.",
    testMode: true,
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "booked",
      bookingConfirmed: true,
      proposedCallTime: "Monday at 11am",
      customerEmail: "rachel@example.com",
    },
  });

  assert.match(response, /test mode/i);
  assert.match(response, /would send a calendar invite/i);
  assert.doesNotMatch(response, /I've sent/i);
  assert.doesNotMatch(response, /sent a calendar invite/i);
});

test("LLM wedding sales finalizer removes model-added duplicate signatures", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: baseState,
    text: [
      "Hi Anna and Mark,",
      "",
      "June 14, 2027 is available, and I would love to hear more about your plans.",
      "",
      "Warmly,",
      "Taras Mynd",
      "Founder & Creative Director / MYNDFUL FILMS LLC",
      "www.myndfulfilms.co",
    ].join("\n"),
  });

  assert.equal(response.match(/Taras Mynd/g)?.length, 1);
  assert.match(response, /MYNDFUL FILMS$/);
});

test("LLM wedding sales finalizer strips greetings and signatures from scheduling replies", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "calendar_busy",
    config,
    state: {
      ...baseState,
      responseDraft: "Would you be open to a 30-minute consultation?",
    },
    text: [
      "Hi Anna and Mark,",
      "",
      "Monday at 10 AM Eastern is already booked, but 9 AM, 9:30 AM, or 10:30 AM are open. Would one of those work?",
      "",
      "Warmly,",
      "Taras",
    ].join("\n"),
  });

  assert.doesNotMatch(response, /^Hi\b/i);
  assert.doesNotMatch(response, /Taras/i);
  assert.match(response, /^Monday at 10 AM Eastern/i);
});

test("LLM wedding sales finalizer enforces the exact Instagram first-contact introduction", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: undefined,
      weddingDate: undefined,
      weddingDateText: undefined,
      assistantReplyCount: 0,
      hasGreeted: false,
    },
    text: [
      "Hi! I’m Taras and it is lovely to meet you.",
      "",
      "Could you share both of your names and the exact wedding date?",
    ].join("\n"),
  });

  assert.ok(response.startsWith(instagramFirstContactOpening));
  assert.equal(response.match(/I’m Taras/g)?.length, 1);
  assert.match(response, /both of your names and the exact wedding date/i);
});

test("LLM wedding sales finalizer removes a duplicate model greeting joined to the first question", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: undefined,
      weddingDate: undefined,
      weddingDateText: undefined,
      assistantReplyCount: 0,
      hasGreeted: false,
    },
    text: "Thank you so much for reaching out 🤍✨ Congratulations on your engagement! To help us get started, could you please share both of your names and the exact date of your wedding?",
  });

  assert.ok(response.startsWith(instagramFirstContactOpening));
  assert.equal(response.match(/Thank you so much for reaching out/g)?.length, 1);
  assert.equal(response.match(/Congratulations on your engagement/gi)?.length, 1);
  assert.match(response, /To help us get started, could you please share both of your names/i);
});

test("instagram style gate falls back from robotic or overly long model copy", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    leadStage: "missing_names_or_date",
    names: undefined,
    weddingDate: undefined,
    weddingDateText: undefined,
    assistantReplyCount: 1,
    hasGreeted: true,
  };
  const fallback = "What are both of your names, and what’s your wedding date?";
  const robotic = "To help us get started, could you please share both of your names and the exact date of your wedding? This will allow me to provide the best information tailored to your special day.";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "ask_missing_info", config, state },
    robotic,
    fallback,
  );

  assert.equal(response, fallback);
});

test("instagram style gate catches robotic phrases with typographic apostrophes", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    leadStage: "missing_names_or_date",
    names: "Anna and Mark",
    weddingDate: undefined,
    weddingDateText: undefined,
    assistantReplyCount: 1,
    hasGreeted: true,
  };
  const fallback = "What’s your wedding date? ✨";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "ask_missing_info", config, state },
    "Lovely to meet you! What’s your wedding date? That’ll help me check availability.",
    fallback,
  );

  assert.equal(response, fallback);
});

test("instagram style gate removes an unasked travel answer from a pricing reply", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    leadStage: "answering_question",
    latestCustomerMessage: "What’s your price?",
    assistantReplyCount: 1,
    hasGreeted: true,
  };
  const fallback = "Our collections start at $2,950.\n\nWhat’s your wedding date?";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "answer_question", config, state },
    "Our collections start at $2,750. Travel miles are included depending on the collection.",
    fallback,
  );

  assert.equal(response, fallback);
});

test("instagram style gate removes an unasked pricing answer from a travel reply", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    leadStage: "answering_question",
    latestCustomerMessage: "Do you charge for travel?",
    assistantReplyCount: 1,
    hasGreeted: true,
  };
  const fallback = "Our collections include roundtrip travel coverage.\n\nWe can go over the exact travel details on the call.";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "answer_question", config, state },
    "Travel miles are included with each collection. Collections start at $2,750. What city is the wedding in?",
    fallback,
  );

  assert.equal(response, fallback);
});

test("instagram style gate keeps FAQ replies on the next missing qualification question", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    leadStage: "answering_question",
    names: undefined,
    weddingDate: undefined,
    weddingDateText: undefined,
    location: undefined,
    latestCustomerMessage: "What’s your price?",
    assistantReplyCount: 1,
    hasGreeted: true,
  };
  const fallback = "Our collections start at $2,950.\n\nWhat’s your wedding date?";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "answer_question", config, state },
    "Collections start at $2,750. What venue are you considering?",
    fallback,
  );

  assert.equal(response, fallback);
});

test("instagram style gate requires venue question after availability price guide reply", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    leadStage: "availability_checked",
    location: "Fort Lauderdale",
    venue: undefined,
    availability: "available",
    assistantReplyCount: 3,
    hasGreeted: true,
  };
  const fallback = "Awesome Samantha! March 6, 2027 is available.\n\nOur 8-hour collections start at $2,950.\n\nWhat’s the exact venue in Fort Lauderdale?";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "availability_available", config, state },
    "Awesome Samantha! March 6, 2027 is available.\n\nOur 8-hour collections start at $2,950 — let me send you the guide so you can see everything ✨",
    fallback,
  );

  assert.equal(response, fallback);
});

test("instagram style gate requires call question after availability reply when venue is known", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    leadStage: "availability_checked",
    location: "Fort Lauderdale",
    venue: "Ritz",
    availability: "available",
    assistantReplyCount: 3,
    hasGreeted: true,
  };
  const fallback = "The Ritz sounds lovely.\n\nWhen would be a good time for a quick call?";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "availability_available", config, state },
    "March 6, 2027 is available, and our collections start at $2,950.",
    fallback,
  );

  assert.equal(response, fallback);
});

test("instagram style gate keeps only one clear question per reply", () => {
  const state: WeddingSalesState = {
    ...baseState,
    channel: "instagram",
    leadStage: "asking_call_time",
    venue: "Evergreen Park",
    assistantReplyCount: 3,
    hasGreeted: true,
  };
  const fallback = "Evergreen Park sounds lovely 🤍\n\nWhen would be a good time for a quick call?";

  const response = weddingSalesResponseComposerTestHelpers.enforceInstagramResponseStyle(
    { intent: "ask_call_time", config, state },
    "Do mornings or afternoons work best? When would you like to connect?",
    fallback,
  );

  assert.equal(response, fallback);
});

test("LLM wedding sales finalizer converts markdown links for rich Gmail replies", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: baseState,
    text: "Here is a recent film: [Callista and Kevin](https://example.com/film)",
  });

  assert.match(response, /<a href="https:\/\/example.com\/film">Callista and Kevin<\/a>/);
});

test("LLM wedding sales finalizer adds one brand emoji to warm availability replies", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: baseState,
    text: "June 14, 2027 is available, and I would love to hear more about your plans.",
  });

  assert.match(response, /🤍/);
  assert.equal((response.match(/[🤍✨🎥]/gu) ?? []).length, 1);
});

test("LLM wedding sales finalizer keeps routine scheduling replies emoji-free", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "calendar_busy",
    config,
    state: {
      ...baseState,
      responseDraft: "Would you be open to a 30-minute consultation?",
    },
    text: "Monday at 10 AM Eastern is already taken, but 10:30 AM is open. Would that work?",
  });

  assert.equal((response.match(/[🤍✨🎥]/gu) ?? []).length, 0);
});

test("wedding sales reflection parser accepts JSON wrapped in model prose", () => {
  const review = parseWeddingSalesReflectionJson([
    "Here is the review:",
    '{"status":"rewrite","issues":["repeated greeting"],"revisedText":"Monday at 10 AM works. Want me to book it?"}',
  ].join("\n"));

  assert.equal(review.status, "rewrite");
  assert.deepEqual(review.issues, ["repeated greeting"]);
  assert.equal(review.revisedText, "Monday at 10 AM works. Want me to book it?");
});

test("wedding sales reflection parser fails open on invalid JSON", () => {
  const review = parseWeddingSalesReflectionJson("not json");

  assert.equal(review.status, "pass");
  assert.equal(review.revisedText, "");
  assert.deepEqual(review.issues, []);
});
