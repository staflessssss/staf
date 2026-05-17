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
    usedToolingIncludes?: string[];
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
];

function includesCaseInsensitive(value: string, needle: string) {
  return value.toLowerCase().includes(needle.toLowerCase());
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

    for (const needle of assertion.usedToolingIncludes ?? []) {
      if (!args.usedTooling.some((toolName) => includesCaseInsensitive(toolName, needle))) {
        failures.push(`${assertion.id}: usedTooling must include "${needle}".`);
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
