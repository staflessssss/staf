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
          content: "Amazing, thank you so much, Anna and Mark. June 14, 2027 in Charlotte is available for Myndful, so you reached out at a great time. Our collections start at $2,950.",
        },
      ],
      message: "Could you send pricing again? Also do you travel?",
    },
    assertions: [
      {
        id: "answers-current-question",
        description: "Reply answers pricing and travel directly.",
        mustInclude: ["$2,950", "travel"],
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
          content: "Our collections start at $2,950. Here are a few recent wedding films: Callista and Kevin, McCord & Kristopher, Valeriia and Kirk. Google Reviews. Would you be open to a consultation?",
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
          content: "June 14, 2027 in Charlotte is available for Myndful. Our collections start at $2,950.",
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
          content: "June 14, 2027 in Charlotte is available for Myndful. Our collections start at $2,950.",
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
          content: "June 14, 2027 in Charlotte is available for Myndful. Our collections start at $2,950.",
        },
      ],
      message: "Just double checking, is our date still available?",
    },
    assertions: [
      {
        id: "answers-from-memory",
        description: "Reply answers from known state without rerunning Sheets or switching to pricing/travel.",
        mustInclude: ["available"],
        mustNotInclude: ["$2,950", "travel", "collections start"],
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
          content: "June 14, 2027 in Charlotte is available. Our collections start at $2,950. Would you be open to a consultation?",
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
        mustNotInclude: ["$2,950", "wedding date", "collections start"],
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
        { role: "ASSISTANT", content: "June 14, 2027 in Charlotte is available. Our collections start at $2,950. Would you be open to a consultation?" },
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
