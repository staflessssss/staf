import { ChannelType, MessageRole } from "@prisma/client";

import { invokeAgent } from "@/lib/ai-runtime";

type Expectation = {
  requiredTools?: string[];
  forbiddenTools?: string[];
  minAttachments?: number;
  maxAttachments?: number;
  replyIncludes?: string[];
  replyIncludesAny?: string[];
  replyExcludes?: string[];
};

type Turn = {
  customer: string;
  expect: Expectation;
};

type Scenario = {
  id: string;
  title: string;
  history?: Array<{ role: MessageRole; content: string }>;
  turns: Turn[];
};

function requiredEnvironmentValue(name: "EVAL_AGENT_ID" | "EVAL_TENANT_ID") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const AGENT_ID = requiredEnvironmentValue("EVAL_AGENT_ID");
const TENANT_ID = requiredEnvironmentValue("EVAL_TENANT_ID");

const scenarios: Scenario[] = [
  {
    id: "availability_unavailable",
    title: "Exact unavailable wedding date with third-party language",
    turns: [
      {
        customer:
          "Hi! I'm helping my sister. Their wedding is October 17, 2026 in Raleigh. Are you available?",
        expect: {
          requiredTools: ["Check wedding availability"],
          replyIncludesAny: ["unavailable", "booked", "fully booked"],
          replyIncludes: ["Taras"],
          replyExcludes: ["October 16", "October 18", "nearby", "closest open"],
          forbiddenTools: ["Book consultation call"],
        },
      },
    ],
  },
  {
    id: "availability_available_guide",
    title: "Available date sends the matching regional guide",
    turns: [
      {
        customer: "My sister is getting married October 16, 2026 in Raleigh. Can you check it?",
        expect: {
          requiredTools: ["Check wedding availability", "send_collections_guide"],
          minAttachments: 1,
          replyIncludesAny: ["available", "open", "free"],
          replyIncludes: ["Taras", "$3,600", "20%"],
          replyExcludes: [
            "NC/SC/GA collections",
            "NC/SC/GA guide",
            "NC/SC/GA",
            "regional guide",
            "guide for Raleigh",
            "For Raleigh",
            "Raleigh pricing",
            "Raleigh starts",
            "compare the options",
            "compare packages",
            "which collection fits",
            "narrow down",
          ],
          forbiddenTools: ["Book consultation call"],
        },
      },
      {
        customer: "Thank you, I'll take a look!",
        expect: {
          forbiddenTools: ["send_collections_guide", "Book consultation call"],
          replyExcludes: [
            "?",
            "compare",
            "other guide",
            "other pricing",
            "which collection",
            "narrow down",
          ],
        },
      },
    ],
  },
  {
    id: "taras_unavailable_date_close",
    title: "Taras flow: missing year, unavailable date, and warm close",
    turns: [
      {
        customer: "Good afternoon!",
        expect: {
          forbiddenTools: ["Check wedding availability", "Book consultation call"],
        },
      },
      {
        customer:
          "I'm getting married on November 21. Where are you located? The wedding will be in Port Saint Lucie, Florida.",
        expect: {
          replyIncludes: ["year"],
          replyIncludesAny: ["Tampa", "North Carolina", "NC and Florida", "Florida and NC"],
          replyExcludes: [
            "November 20",
            "November 22",
            "nearby",
            "collections guide",
            "pricing guide",
          ],
          forbiddenTools: ["Check wedding availability", "send_collections_guide", "Book consultation call"],
        },
      },
      {
        customer: "2026",
        expect: {
          requiredTools: ["Check wedding availability"],
          replyIncludesAny: ["unavailable", "booked", "fully booked"],
          replyExcludes: [
            "November 20",
            "November 22",
            "nearby",
            "closest open",
            "based in Tampa",
            "we’re based",
            "we're based",
            "we are based",
            "based in",
            "based in North Carolina",
            "Port Saint Lucie is Florida",
            "send over the Florida guide",
            "collections guide",
          ],
          forbiddenTools: ["Book consultation call"],
        },
      },
      {
        customer: "Ohhhh okay, thank you so much.",
        expect: {
          forbiddenTools: ["Check wedding availability", "Book consultation call"],
          replyExcludes: [
            "November 20",
            "November 22",
            "either of those",
            "from there",
            "another date",
          ],
        },
      },
    ],
  },
  {
    id: "pricing_region_unknown",
    title: "Pricing request without a region",
    turns: [
      {
        customer: "Could you send your pricing?",
        expect: {
          forbiddenTools: ["Book consultation call"],
          maxAttachments: 0,
          replyIncludes: ["$2,800", "$3,600"],
        },
      },
    ],
  },
  {
    id: "pricing_florida",
    title: "Pricing request with Tampa established",
    turns: [
      {
        customer: "We're getting married in Tampa. Can you send your pricing?",
        expect: {
          requiredTools: ["send_collections_guide"],
          minAttachments: 1,
          replyIncludes: ["$2,800", "20%"],
          replyExcludes: [
            "Florida guide",
            "Florida collections",
            "Florida starts",
            "FL starts",
            "NC/SC/GA",
            "regional guide",
            "guide for Tampa",
            "For Tampa",
            "Tampa starts",
            "Tampa pricing",
            "pricing in Tampa",
            "compare the options",
            "compare packages",
            "which collection fits",
            "narrow down",
          ],
          forbiddenTools: ["Book consultation call"],
        },
      },
    ],
  },
  {
    id: "third_party_names",
    title: "Third-party names after availability",
    history: [
      {
        role: MessageRole.ASSISTANT,
        content:
          "Great news - October 16 is available in Raleigh, and I sent the investment guide over 🤍 What are the couple's names?",
      },
    ],
    turns: [
      {
        customer: "Their names are Analeigh Brooks and Jackson Ellerbee.",
        expect: {
          forbiddenTools: ["tool_4_owner_handoff_request", "Book consultation call"],
          replyExcludes: ["nice to meet you both"],
        },
      },
    ],
  },
  {
    id: "faq_raw_footage_and_music",
    title: "Taras-style FAQ interruption",
    turns: [
      {
        customer: "Does raw footage come too? And can we choose our own music?",
        expect: {
          forbiddenTools: ["Check wedding availability", "send_collections_guide"],
          replyIncludes: ["raw", "music"],
        },
      },
    ],
  },
  {
    id: "consultation_outside_hours",
    title: "Consultation request outside the business window",
    turns: [
      {
        customer: "Could we chat next Tuesday at 5pm ET?",
        expect: {
          forbiddenTools: ["Check consultation calendar", "Book consultation call"],
          replyIncludes: ["9am", "2pm"],
        },
      },
    ],
  },
  {
    id: "consultation_calendar_check",
    title: "In-window consultation check",
    turns: [
      {
        customer: "Could we chat next Tuesday at 11am ET?",
        expect: {
          requiredTools: ["Check consultation calendar"],
          forbiddenTools: ["Book consultation call"],
        },
      },
    ],
  },
  {
    id: "budget_objection",
    title: "Unapproved custom-price request",
    turns: [
      {
        customer: "Could you do $1000 for us?",
        expect: {
          forbiddenTools: ["Book consultation call"],
          replyExcludes: ["we can do $1000", "yes, $1000 works"],
        },
      },
    ],
  },
  {
    id: "thank_you_close",
    title: "Simple thank-you should stay natural",
    history: [
      {
        role: MessageRole.ASSISTANT,
        content: "Unfortunately, that wedding date is already booked on our side.",
      },
    ],
    turns: [
      {
        customer: "Thank you!",
        expect: {
          forbiddenTools: ["tool_4_owner_handoff_request", "Book consultation call"],
          replyExcludes: ["handoff", "fallback"],
        },
      },
    ],
  },
  {
    id: "full_availability_to_consultation",
    title: "Full lead journey: date, guide, names, FAQ, and consultation",
    turns: [
      {
        customer:
          "Hey, I'm helping my sister. Their wedding is October 17, 2026 in Raleigh. Are you free?",
        expect: {
          requiredTools: ["Check wedding availability"],
          replyIncludesAny: ["unavailable", "booked", "fully booked"],
          replyIncludes: ["Taras"],
          replyExcludes: ["October 16", "October 18", "nearby", "closest open"],
        },
      },
      {
        customer: "Could they do October 16 instead?",
        expect: {
          requiredTools: ["Check wedding availability", "send_collections_guide"],
          minAttachments: 1,
          replyIncludesAny: ["available", "open", "free"],
          replyIncludes: ["$3,600", "20%"],
          replyExcludes: [
            "NC/SC/GA collections",
            "NC/SC/GA guide",
            "NC/SC/GA",
            "regional guide",
            "guide for Raleigh",
            "For Raleigh",
            "Raleigh pricing",
            "Raleigh starts",
            "compare the options",
            "compare packages",
            "which collection fits",
            "narrow down",
          ],
        },
      },
      {
        customer: "Their names are Analeigh Brooks and Jackson Ellerbee.",
        expect: { replyExcludes: ["nice to meet you both"] },
      },
      {
        customer: "Does the package include all raw footage and can they pick the music?",
        expect: {
          forbiddenTools: ["Check wedding availability", "send_collections_guide"],
          replyIncludes: ["raw", "music"],
        },
      },
      {
        customer: "Could we talk next Tuesday at 5pm ET?",
        expect: {
          forbiddenTools: ["Check consultation calendar", "Book consultation call"],
          replyIncludes: ["9am", "2pm"],
        },
      },
      {
        customer: "Okay, next Tuesday at 11am ET works.",
        expect: {
          requiredTools: ["Check consultation calendar"],
          forbiddenTools: ["Book consultation call"],
        },
      },
    ],
  },
  {
    id: "full_pricing_to_budget",
    title: "Full pricing journey: unknown region, Tampa guide, objection, and close",
    turns: [
      {
        customer: "Hi! Could you send pricing?",
        expect: { maxAttachments: 0, replyIncludes: ["$2,800", "$3,600"] },
      },
      {
        customer: "It's in Tampa, Florida.",
        expect: {
          requiredTools: ["send_collections_guide"],
          minAttachments: 1,
          replyIncludes: ["$2,800"],
        },
      },
      {
        customer: "Could you do $1000 for us?",
        expect: {
          forbiddenTools: ["Book consultation call"],
          replyExcludes: ["we can do $1000", "yes, $1000 works"],
        },
      },
      {
        customer: "Thank you!",
        expect: { replyExcludes: ["handoff", "fallback"] },
      },
    ],
  },
];

function hasAll(values: string[], expected: string[]) {
  return expected.every((item) => values.includes(item));
}

function hasNone(values: string[], forbidden: string[]) {
  return forbidden.every((item) => !values.includes(item));
}

function evaluate(args: {
  reply: string;
  tools: string[];
  attachmentCount: number;
  expectation: Expectation;
}) {
  const reply = args.reply.toLowerCase();
  const failures: string[] = [];
  if (args.expectation.requiredTools && !hasAll(args.tools, args.expectation.requiredTools)) {
    failures.push(`missing tools: ${args.expectation.requiredTools.join(", ")}`);
  }
  if (args.expectation.forbiddenTools && !hasNone(args.tools, args.expectation.forbiddenTools)) {
    failures.push(`forbidden tools: ${args.expectation.forbiddenTools.join(", ")}`);
  }
  if (
    args.expectation.minAttachments !== undefined &&
    args.attachmentCount < args.expectation.minAttachments
  ) {
    failures.push(`expected at least ${args.expectation.minAttachments} attachment(s)`);
  }
  if (
    args.expectation.maxAttachments !== undefined &&
    args.attachmentCount > args.expectation.maxAttachments
  ) {
    failures.push(`expected at most ${args.expectation.maxAttachments} attachment(s)`);
  }
  for (const phrase of args.expectation.replyIncludes ?? []) {
    if (!reply.includes(phrase.toLowerCase())) failures.push(`missing reply text: ${phrase}`);
  }
  if (
    args.expectation.replyIncludesAny &&
    !args.expectation.replyIncludesAny.some((phrase) => reply.includes(phrase.toLowerCase()))
  ) {
    failures.push(`missing one of: ${args.expectation.replyIncludesAny.join(", ")}`);
  }
  for (const phrase of args.expectation.replyExcludes ?? []) {
    if (reply.includes(phrase.toLowerCase())) failures.push(`unsafe reply text: ${phrase}`);
  }
  return failures;
}

async function runScenario(scenario: Scenario) {
  const history = [...(scenario.history ?? [])];
  const turns = [];

  for (const turn of scenario.turns) {
    const result = await invokeAgent({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      channel: ChannelType.INSTAGRAM,
      contactId: `eval-${scenario.id}`,
      message: turn.customer,
      historyMessages: history,
      testMode: true,
      allowDraftAgent: true,
    });
    const tools = result.usedTooling ?? [];
    const attachmentCount = result.attachments?.length ?? 0;
    const failures = evaluate({
      reply: result.message,
      tools,
      attachmentCount,
      expectation: turn.expect,
    });
    turns.push({
      customer: turn.customer,
      reply: result.message,
      model: result.model,
      tools,
      attachmentCount,
      pass: failures.length === 0,
      failures,
    });
    history.push({ role: MessageRole.USER, content: turn.customer });
    history.push(...(result.historyAppend ?? []));
  }

  return {
    id: scenario.id,
    title: scenario.title,
    pass: turns.every((turn) => turn.pass),
    turns,
  };
}

async function main() {
  const selectedScenarioId = process.env.EVAL_SCENARIO_ID?.trim();
  const selectedScenarios = selectedScenarioId
    ? scenarios.filter((scenario) => scenario.id === selectedScenarioId)
    : scenarios;

  if (selectedScenarios.length === 0) {
    throw new Error(`Unknown EVAL_SCENARIO_ID: ${selectedScenarioId}`);
  }

  const results = [];
  for (const scenario of selectedScenarios) results.push(await runScenario(scenario));

  const passed = results.filter((result) => result.pass).length;
  console.log(JSON.stringify({
    mode: "sandbox_no_outbound_delivery",
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
