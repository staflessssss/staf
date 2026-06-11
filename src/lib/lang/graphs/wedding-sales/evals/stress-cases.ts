export type WeddingSalesEvalRuntime = "legacy" | "langgraph_wedding_sales";

export type WeddingSalesEvalCase = {
  id: string;
  title: string;
  input: {
    contactId: string;
    message: string;
    history?: Array<{
      role: "USER" | "ASSISTANT";
      content: string;
    }>;
  };
  assertions: Array<{
    id: string;
    description: string;
    mustInclude?: string[];
    mustNotInclude?: string[];
    mustNotStartWith?: string[];
    mustNotRepeatFromHistory?: string[];
    usedToolingIncludes?: string[];
    usedToolingExcludes?: string[];
  }>;
};

export type WeddingSalesEvalResult = {
  caseId: string;
  runtime: WeddingSalesEvalRuntime;
  passed: boolean;
  response?: string;
  usedTooling?: string[];
  failures: string[];
  skipped?: boolean;
};

export const weddingSalesStressCases: WeddingSalesEvalCase[] = [
  {
    id: "regression-pending-date-correction-confirms-once",
    title: "Explicit clarification resolves a pending wedding date change once",
    input: {
      contactId: "eval-pending-date-correction@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "June 14, 2027 in Charlotte is available. Would you be open to a consultation?",
        },
        {
          role: "USER",
          content: "October 17",
        },
        {
          role: "ASSISTANT",
          content: "Just to confirm, is October 17 your updated wedding date?",
        },
      ],
      message: "Yes, I mean October 17, 2027 is our new wedding date.",
    },
    assertions: [
      {
        id: "resolves-date-change",
        description: "The explicit correction is accepted instead of asking the same confirmation again.",
        mustNotInclude: ["is October 17 your updated wedding date"],
      },
    ],
  },
  {
    id: "regression-complete-first-message-keeps-names",
    title: "Complete first message captures names, date, and Florida location",
    input: {
      contactId: "eval-complete-florida-first-message@example.com",
      message: "Hey, Olivia and Daniel here. Wedding is November 8, 2026 in Tampa, Florida.",
    },
    assertions: [
      {
        id: "does-not-reask-complete-details",
        description: "The runtime continues from captured details without asking for names or date again.",
        mustNotInclude: ["both of your names", "your full names", "wedding date"],
        usedToolingIncludes: ["Wedding availability"],
      },
    ],
  },
  {
    id: "regression-question-before-names-answers-first",
    title: "Business question is answered before continuing missing-info qualification",
    input: {
      contactId: "eval-question-before-names@example.com",
      history: [
        {
          role: "USER",
          content: "Hi, we are planning a wedding in Charlotte.",
        },
        {
          role: "ASSISTANT",
          content: "Could you share both of your names and your wedding date?",
        },
      ],
      message: "Why did you need the venue?",
    },
    assertions: [
      {
        id: "answers-venue-question",
        description: "The reply explains why venue details matter and does not merely repeat the names request.",
        mustInclude: ["venue", "travel"],
        mustNotInclude: ["could you share both of your names"],
      },
    ],
  },
  {
    id: "regression-final-film-delivery-faq",
    title: "Final film delivery question uses the configured FAQ answer",
    input: {
      contactId: "eval-final-film-delivery@example.com",
      message: "How long until we receive the final film?",
    },
    assertions: [
      {
        id: "answers-delivery-faq",
        description: "The reply gives the four-month delivery expectation instead of offering unrelated assets.",
        mustInclude: ["4 months"],
        mustNotInclude: ["recent wedding films", "Google Reviews"],
      },
    ],
  },
  {
    id: "regression-call-objection-does-not-check-calendar",
    title: "Not-ready-for-a-call objection does not trigger calendar tooling",
    input: {
      contactId: "eval-call-objection@example.com",
      history: [
        {
          role: "USER",
          content: "We are Emma and Liam. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "June 14, 2027 is available. Would you be open to a quick consultation?",
        },
      ],
      message: "I am not ready to schedule a call yet, can I ask more questions?",
    },
    assertions: [
      {
        id: "respects-objection",
        description: "The runtime welcomes questions without checking or rejecting a calendar time.",
        mustInclude: ["question"],
        mustNotInclude: ["already taken", "what other time works"],
        usedToolingExcludes: ["Calendar", "Book"],
      },
    ],
  },
  {
    id: "regression-existing-client-question-handoffs",
    title: "Existing-client operational question is handed to the owner",
    input: {
      contactId: "eval-existing-client-question@example.com",
      message:
        "Our wedding already happened last weekend. Could my parents have paid the operators for an additional hour on the wedding day?",
    },
    assertions: [
      {
        id: "does-not-start-sales-flow",
        description: "The runtime does not congratulate an existing client or start lead qualification.",
        mustNotInclude: ["congratulations on your engagement", "both of your names", "wedding date"],
      },
      {
        id: "requests-owner-help",
        description: "The runtime routes the unknown operational answer to owner handoff.",
        usedToolingIncludes: ["owner handoff"],
      },
    ],
  },
  {
    id: "regression-address-is-venue-not-date",
    title: "Street address updates venue without inventing a wedding date",
    input: {
      contactId: "eval-address-not-date@example.com",
      history: [
        {
          role: "USER",
          content: "We are Suzie and Rick. Our wedding is October 11, 2026 in Tampa, Florida.",
        },
        {
          role: "ASSISTANT",
          content: "October 11, 2026 is available. What is the exact venue in Tampa?",
        },
      ],
      message: "The venue is 333 S Franklin Street, Tampa, FL 33602.",
    },
    assertions: [
      {
        id: "keeps-known-date",
        description: "Numeric address text is treated as venue data, never as a date correction.",
        mustNotInclude: ["updated wedding date", "2026-10-10", "October 10"],
        usedToolingExcludes: ["Wedding availability"],
      },
    ],
  },
  {
    id: "regression-partner-name-later-not-reasked",
    title: "Partner name supplied later completes names without re-asking",
    input: {
      contactId: "eval-partner-name-later@example.com",
      history: [
        {
          role: "USER",
          content: "Hey, I'm Mia. What do you charge?",
        },
        {
          role: "ASSISTANT",
          content: "Our collections start at $2,950. What's your fiance's name and wedding date?",
        },
      ],
      message: "My fiance is Ethan, and the wedding is October 17, 2026 in Miami.",
    },
    assertions: [
      {
        id: "does-not-reask-names",
        description: "The partner name is treated as completing names, not as an unanswered field.",
        mustNotInclude: ["fiance's name", "both of your names", "full names"],
      },
      {
        id: "checks-availability-after-complete-info",
        description: "The runtime can move to availability once names, date, and location are complete.",
        usedToolingIncludes: ["Wedding availability"],
      },
    ],
  },
  {
    id: "regression-travel-faq-after-venue-no-name-loop",
    title: "Travel FAQ after venue does not restart names or venue collection",
    input: {
      contactId: "eval-travel-after-venue@example.com",
      history: [
        {
          role: "USER",
          content: "We are Rachel and Rick. Wedding is November 8, 2026 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "November 8, 2026 is available. What's the exact venue in Charlotte?",
        },
        {
          role: "USER",
          content: "Evergreen Park.",
        },
        {
          role: "ASSISTANT",
          content: "Evergreen Park sounds lovely. When would be a good time for a quick call?",
        },
      ],
      message: "Any travel fees?",
    },
    assertions: [
      {
        id: "answers-travel-faq",
        description: "The reply answers travel coverage instead of looping back to collected fields.",
        mustInclude: ["travel"],
        mustNotInclude: ["fiance", "both of your names", "exact venue"],
      },
    ],
  },
  {
    id: "regression-location-correction-overrides-raw-old-location",
    title: "Explicit location correction overrides older raw-message location",
    input: {
      contactId: "eval-location-correction@example.com",
      history: [
        {
          role: "USER",
          content: "We are Suzie and Rick. Wedding is October 11, 2026 in Tampa, Florida.",
        },
        {
          role: "ASSISTANT",
          content: "October 11, 2026 is available for your Tampa wedding. What's the exact venue in Tampa?",
        },
      ],
      message: "Actually not Tampa, it will be in Charlotte NC.",
    },
    assertions: [
      {
        id: "does-not-keep-old-location",
        description: "The runtime should use the corrected location instead of old Tampa text from history.",
        mustInclude: ["Charlotte"],
        mustNotInclude: ["Tampa wedding", "Florida"],
        usedToolingIncludes: ["Wedding availability"],
      },
    ],
  },
  {
    id: "regression-completed-lead-faq-no-requalification",
    title: "Completed lead FAQ stays in support mode instead of re-qualifying",
    input: {
      contactId: "eval-completed-lead-faq@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. October 11, 2026 in Charlotte at Evergreen Park works.",
        },
        {
          role: "ASSISTANT",
          content: "Perfect, tomorrow at 11 AM Eastern works great. What's the best email for the calendar invite?",
        },
        {
          role: "USER",
          content: "anna@example.com",
        },
        {
          role: "ASSISTANT",
          content: "You're all set. I've sent a calendar invite to anna@example.com.",
        },
      ],
      message: "How long does the final film usually take?",
    },
    assertions: [
      {
        id: "answers-without-requalifying",
        description: "After booking, the agent answers FAQs without asking the sales sequence again.",
        mustInclude: ["4 months"],
        mustNotInclude: ["wedding date", "both of your names", "quick call"],
      },
    ],
  },
  {
    id: "regression-multi-goal-faq-and-ambiguous-date",
    title: "Multi-goal message answers FAQ while leaving uncertain date change pending",
    input: {
      contactId: "eval-multi-goal-faq-date@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "June 14, 2027 is available. What would you like to know?",
        },
      ],
      message: "How long is the film? Also, we may change our date to June 15, but we are not sure yet.",
    },
    assertions: [
      {
        id: "answers-and-clarifies",
        description: "The reply answers the film question and asks before changing the uncertain date.",
        mustInclude: ["film", "June 15"],
        mustNotInclude: ["June 15, 2027 is available"],
        usedToolingExcludes: ["Wedding availability"],
      },
    ],
  },
  {
    id: "missing-names-and-date",
    title: "No names or wedding date asks for both before qualification",
    input: {
      contactId: "eval-missing-names-date@example.com",
      message: "Hi, we love your films and want more info about wedding video.",
    },
    assertions: [
      {
        id: "asks-names-date",
        description: "Reply asks for names and wedding date.",
        mustInclude: ["names", "date"],
      },
    ],
  },
  {
    id: "date-without-year",
    title: "Month/day without year asks for the year before availability",
    input: {
      contactId: "eval-missing-year@example.com",
      message: "We are Anna and Mark. Our wedding is June 14 in Charlotte.",
    },
    assertions: [
      {
        id: "asks-year",
        description: "Reply asks for wedding year and avoids availability confirmation.",
        mustInclude: ["year"],
        mustNotInclude: ["available", "collections guide"],
      },
    ],
  },
  {
    id: "date-year-location",
    title: "Complete wedding info checks Sheets capacity",
    input: {
      contactId: "eval-complete-wedding@example.com",
      message: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
    },
    assertions: [
      {
        id: "checks-wedding-availability",
        description: "Runtime uses wedding availability tooling.",
        usedToolingIncludes: ["Wedding availability"],
      },
    ],
  },
  {
    id: "unavailable-date",
    title: "Unavailable wedding date offers alternatives instead of pretending availability",
    input: {
      contactId: "eval-unavailable@example.com",
      message: "We are Anna and Mark. Our wedding is September 6, 2026 in Charlotte, NC.",
    },
    assertions: [
      {
        id: "offers-alternatives",
        description: "Reply does not claim the date is available and offers another path.",
        mustNotInclude: ["date is available", "we are available"],
        mustInclude: ["alternative"],
      },
    ],
  },
  {
    id: "sunday-4pm-call",
    title: "Sunday 4 PM consultation request is rejected by booking window",
    input: {
      contactId: "eval-sunday-call@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
      ],
      message: "Could we do Sunday at 4 PM Eastern for a consultation?",
    },
    assertions: [
      {
        id: "rejects-outside-window",
        description: "Reply rejects Sunday/outside-hours booking and asks for a weekday window.",
        mustInclude: ["Monday", "Friday"],
        mustNotInclude: ["confirmed", "booked"],
      },
    ],
  },
  {
    id: "monday-10am-call",
    title: "Monday 10 AM consultation request checks Calendar",
    input: {
      contactId: "eval-monday-call@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
      ],
      message: "Would Monday at 10 AM Eastern work for a consultation?",
    },
    assertions: [
      {
        id: "checks-calendar",
        description: "Runtime checks calendar availability.",
        usedToolingIncludes: ["Calendar"],
      },
    ],
  },
  {
    id: "yes-book",
    title: "Explicit confirmation books the call",
    input: {
      contactId: "eval-book-call@example.com",
      history: [
        {
          role: "USER",
          content: "Would Monday at 10 AM Eastern work for a consultation?",
        },
        {
          role: "ASSISTANT",
          content: "Monday at 10 AM Eastern looks available. Would you like me to book it?",
        },
      ],
      message: "Yes, please book it.",
    },
    assertions: [
      {
        id: "books-call",
        description: "Runtime uses booking tooling and avoids false confirmation without a booking result.",
        usedToolingIncludes: ["Book"],
      },
    ],
  },
  {
    id: "coordinator-coi",
    title: "Coordinator or COI message is ignored by Gmail classifier path",
    input: {
      contactId: "eval-coordinator@example.com",
      message: "Hi, I am the wedding coordinator sending the COI and vendor details.",
    },
    assertions: [
      {
        id: "does-not-sell-to-coordinator",
        description: "Reply should not start the couple sales sequence.",
        mustNotInclude: ["collections guide", "your wedding date"],
      },
    ],
  },
  {
    id: "quality-no-repeat-greeting-mid-thread",
    title: "Mid-thread reply does not greet again",
    input: {
      contactId: "eval-quality-no-greeting@example.com",
      history: [
        {
          role: "USER",
          content: "Hi, we love your films and want more info about wedding video.",
        },
        {
          role: "ASSISTANT",
          content: "Hi there! I would love to hear more. Could you share both of your names and your wedding date?",
        },
      ],
      message: "We are Anna and Mark. Our wedding is June 14 in Charlotte.",
    },
    assertions: [
      {
        id: "no-repeat-greeting",
        description: "Reply continues the thread without greeting again.",
        mustNotStartWith: ["hi", "hello", "hey"],
      },
    ],
  },
  {
    id: "quality-no-repeat-availability-intro",
    title: "Pricing/travel question does not repeat availability intro",
    input: {
      contactId: "eval-quality-no-repeat-availability@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "Amazing, thank you so much, Anna and Mark. June 14, 2027 in Charlotte is available for Myndful, so you reached out at a great time. Our 8-hour collections start at $3,490.",
        },
      ],
      message: "Could you send pricing again? Also do you travel?",
    },
    assertions: [
      {
        id: "answers-current-question",
        description: "Reply answers pricing and travel directly.",
        mustInclude: ["$3,490", "travel"],
      },
      {
        id: "does-not-repeat-availability-intro",
        description: "Reply does not repeat the previous availability intro.",
        mustNotInclude: ["June 14, 2027 in Charlotte is available", "you reached out at a great time"],
        mustNotRepeatFromHistory: ["Amazing, thank you so much, Anna and Mark"],
      },
    ],
  },
  {
    id: "quality-no-repeat-assets-after-guide",
    title: "Follow-up after guide does not resend portfolio/reviews block",
    input: {
      contactId: "eval-quality-no-repeat-assets@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "Our 8-hour collections start at $3,490. Here are a few recent wedding films: Callista and Kevin, McCord & Kristopher, Valeriia and Kirk. Google Reviews. Would you be open to a consultation?",
        },
      ],
      message: "Thanks, that helps. What is included in the starting package?",
    },
    assertions: [
      {
        id: "does-not-resend-assets",
        description: "Reply does not resend portfolio or reviews block.",
        mustNotInclude: ["Callista and Kevin", "McCord", "Google Reviews"],
      },
    ],
  },
  {
    id: "quality-explicit-same-date-rechecks-availability",
    title: "Explicit repeat of the same wedding date rechecks availability",
    input: {
      contactId: "eval-quality-repeat-explicit-date@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "June 14, 2027 in Charlotte is available for Myndful. Our 8-hour collections start at $3,490.",
        },
      ],
      message: "Just double checking, is June 14, 2027 still available?",
    },
    assertions: [
      {
        id: "rechecks-explicit-date",
        description: "Runtime checks Sheets again when the customer names an explicit date.",
        usedToolingIncludes: ["Wedding availability"],
        mustNotInclude: ["names", "wedding year"],
      },
    ],
  },
  {
    id: "quality-explicit-new-date-rechecks-availability",
    title: "Explicit different wedding date rechecks availability",
    input: {
      contactId: "eval-quality-new-explicit-date@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "June 14, 2027 in Charlotte is available for Myndful. Our 8-hour collections start at $3,490.",
        },
      ],
      message: "What about June 21, 2027 instead?",
    },
    assertions: [
      {
        id: "rechecks-new-date",
        description: "Runtime checks Sheets when the customer changes the date.",
        usedToolingIncludes: ["Wedding availability"],
        mustNotInclude: ["names", "wedding year"],
      },
    ],
  },
  {
    id: "quality-implicit-date-question-uses-memory",
    title: "Implicit date question uses state instead of repeating availability flow",
    input: {
      contactId: "eval-quality-implicit-date-memory@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "June 14, 2027 in Charlotte is available for Myndful. Our 8-hour collections start at $3,490.",
        },
      ],
      message: "Just double checking, is our date still available?",
    },
    assertions: [
      {
        id: "answers-from-memory",
        description: "Reply answers from known state without rerunning Sheets or switching to pricing/travel.",
        mustInclude: ["available"],
        mustNotInclude: ["$3,490", "travel", "collections start"],
        usedToolingExcludes: ["Wedding availability"],
      },
    ],
  },
  {
    id: "quality-booking-confirmation-warm",
    title: "Booking confirmation is warm and not a dry status line",
    input: {
      contactId: "eval-quality-booking-warm@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "Monday at 10 AM Eastern looks available on the calendar. Would you like me to book it?",
        },
      ],
      message: "Yes, please!",
    },
    assertions: [
      {
        id: "warm-booking-confirmation",
        description: "Reply confirms the consultation warmly.",
        mustInclude: ["calendar invite"],
        mustNotInclude: ["has been created."],
      },
    ],
  },
  {
    id: "quality-time-only-after-busy-checks-calendar",
    title: "Time-only reply after busy alternatives checks Calendar, not wedding availability",
    input: {
      contactId: "eval-quality-time-only-after-busy@example.com",
      history: [
        {
          role: "USER",
          content: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
        },
        {
          role: "ASSISTANT",
          content: "June 14, 2027 in Charlotte is available. Our 8-hour collections start at $3,490. Would you be open to a consultation?",
        },
        {
          role: "USER",
          content: "What about Monday at 10 AM Eastern?",
        },
        {
          role: "ASSISTANT",
          content: "Monday at 10:00 AM Eastern is already taken, but I have openings at 9:00, 9:30, and 10:30 AM that day. Would any of those times work for you?",
        },
      ],
      message: "10:30 works for me.",
    },
    assertions: [
      {
        id: "checks-calendar-not-wedding",
        description: "Runtime treats the short time answer as scheduling continuation.",
        usedToolingIncludes: ["Calendar"],
        usedToolingExcludes: ["Wedding availability"],
        mustNotInclude: ["$3,490", "wedding date", "collections start"],
      },
    ],
  },
  {
    id: "quality-long-thread-summary-keeps-context",
    title: "Long thread keeps names/date/location context",
    input: {
      contactId: "eval-quality-long-thread@example.com",
      history: [
        { role: "USER", content: "Hi, we love your films." },
        { role: "ASSISTANT", content: "Could you share your names and wedding date?" },
        { role: "USER", content: "We are Anna and Mark. Our wedding is June 14 in Charlotte." },
        { role: "ASSISTANT", content: "Could you share the wedding year?" },
        { role: "USER", content: "2027. The venue is in Charlotte, NC." },
        { role: "ASSISTANT", content: "June 14, 2027 in Charlotte is available. Our 8-hour collections start at $3,490. Would you be open to a consultation?" },
        { role: "USER", content: "Could we do Monday at 10 AM Eastern?" },
        { role: "ASSISTANT", content: "Monday at 10 AM Eastern looks available. Would you like me to book it?" },
      ],
      message: "Yes, please book it.",
    },
    assertions: [
      {
        id: "books-with-context",
        description: "Runtime books the call without losing context.",
        usedToolingIncludes: ["Book"],
        mustNotInclude: ["names", "wedding date", "year"],
      },
    ],
  },
];

function includesCaseInsensitive(value: string, needle: string) {
  const normalize = (entry: string) => entry.toLowerCase().replace(/[_-]+/g, " ");
  return normalize(value).includes(normalize(needle));
}

export function evaluateWeddingSalesCase(args: {
  testCase: WeddingSalesEvalCase;
  runtime: WeddingSalesEvalRuntime;
  response: string;
  usedTooling: string[];
}): WeddingSalesEvalResult {
  const failures: string[] = [];

  for (const assertion of args.testCase.assertions) {
    for (const needle of assertion.mustInclude ?? []) {
      if (!includesCaseInsensitive(args.response, needle)) {
        failures.push(`${assertion.id}: response must include "${needle}".`);
      }
    }

    for (const needle of assertion.mustNotInclude ?? []) {
      if (includesCaseInsensitive(args.response, needle)) {
        failures.push(`${assertion.id}: response must not include "${needle}".`);
      }
    }

    for (const needle of assertion.mustNotStartWith ?? []) {
      if (args.response.trim().toLowerCase().startsWith(needle.toLowerCase())) {
        failures.push(`${assertion.id}: response must not start with "${needle}".`);
      }
    }

    for (const needle of assertion.mustNotRepeatFromHistory ?? []) {
      if (includesCaseInsensitive(args.response, needle)) {
        failures.push(`${assertion.id}: response must not repeat historical wording "${needle}".`);
      }
    }

    for (const needle of assertion.usedToolingIncludes ?? []) {
      if (!args.usedTooling.some((toolName) => includesCaseInsensitive(toolName, needle))) {
        failures.push(`${assertion.id}: usedTooling must include "${needle}".`);
      }
    }

    for (const needle of assertion.usedToolingExcludes ?? []) {
      if (args.usedTooling.some((toolName) => includesCaseInsensitive(toolName, needle))) {
        failures.push(`${assertion.id}: usedTooling must not include "${needle}".`);
      }
    }
  }

  return {
    caseId: args.testCase.id,
    runtime: args.runtime,
    passed: failures.length === 0,
    response: args.response,
    usedTooling: args.usedTooling,
    failures,
  };
}
