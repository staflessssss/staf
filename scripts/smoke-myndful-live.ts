import { ChannelType, MessageRole } from "@prisma/client";

import { invokeAgent } from "@/lib/ai-runtime";
import { db } from "@/lib/db";

const MYNDFUL_AGENT_ID = "cmq6m9uk2000duxospuaod8al";

type HistoryMessage = {
  role: MessageRole;
  content: string;
  model?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
};

type Scenario = {
  name: string;
  messages: string[];
};

const scenarios: Scenario[] = [
  {
    name: "Third-party couple, pricing, unavailable date, alternative",
    messages: [
      "Hey! I’m helping my sister plan her wedding. They’re looking at Raleigh next October.",
      "Could you send pricing?",
      "October 17, 2026. Are you free?",
      "What about October 18 instead?",
      "Their names are Analeigh Brooks and Jackson Ellerbee.",
    ],
  },
  {
    name: "Ambiguous venue and a natural FAQ interruption",
    messages: [
      "Hi, we’re hoping to finalize our venue this week.",
      "By the way, where are you based?",
      "It will probably be in Charlotte, North Carolina, on October 3, 2026.",
      "Do you travel to Asheville too, or is that too far?",
    ],
  },
  {
    name: "Pricing request before region, then promo negotiation",
    messages: [
      "Hey Taras, what do your films cost?",
      "We’re in Tampa, Florida.",
      "We only have about $1,000. Could you make that work?",
      "Okay, and does the Summer Special still apply if the wedding is in November?",
    ],
  },
  {
    name: "Consultation request, invalid time, then booking precondition",
    messages: [
      "Hi! We’re interested in chatting. Our wedding is October 18, 2026 in Raleigh.",
      "Could we talk Sunday at 5pm ET?",
      "How about Monday, July 13 at 10am ET instead?",
      "Yes, please book it. We’re Sarah and Daniel, and my email is sarah@example.com.",
    ],
  },
  {
    name: "Human request and thank-you should not be mistaken for a booking",
    messages: [
      "Can I speak with a real person about a custom cultural ceremony?",
      "Thank you!",
    ],
  },
  {
    name: "Founder-style package questions and a budget objection",
    messages: [
      "Hey! We are considering October 18, 2026 in Raleigh.",
      "Does raw footage come too? And with Classic, how does one filmmaker and two cameras work?",
      "Honestly we only have about $1,000 for video. I need to think about it.",
    ],
  },
  {
    name: "Existing-client payment request routes to a person",
    messages: [
      "Hey, we already booked with you. Can you move our next payment and resend the invoice?",
    ],
  },
];

async function main() {
  const agent = await db.agent.findUnique({
    where: { id: MYNDFUL_AGENT_ID },
    select: { id: true, tenantId: true, channel: { select: { type: true } } },
  });

  if (!agent) {
    throw new Error(`Myndful agent ${MYNDFUL_AGENT_ID} was not found.`);
  }

  const requestedScenarios = new Set(
    (process.env.SMOKE_SCENARIOS ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
  const scenariosToRun =
    requestedScenarios.size > 0
      ? scenarios.filter((_, index) => requestedScenarios.has(index + 1))
      : scenarios;

  if (scenariosToRun.length === 0) {
    throw new Error("SMOKE_SCENARIOS did not match a configured scenario.");
  }

  const report: Array<Record<string, unknown>> = [];

  for (const [scenarioIndex, scenario] of scenariosToRun.entries()) {
    const history: HistoryMessage[] = [];
    const turns: Array<Record<string, unknown>> = [];

    for (const [turnIndex, message] of scenario.messages.entries()) {
      const result = await invokeAgent({
        tenantId: agent.tenantId,
        agentId: agent.id,
        channel: agent.channel.type as ChannelType,
        contactId: `live-smoke-${scenarioIndex + 1}-${turnIndex + 1}`,
        message,
        historyMessages: history,
        testMode: true,
      });

      turns.push({
        customer: message,
        assistant: result.message,
        model: result.model,
        tools: result.toolExecutions?.map((entry: NonNullable<typeof result.toolExecutions>[number]) => ({
          name: entry.toolName,
          result: entry.toolResult,
        })) ?? [],
        attachments: result.attachments ?? [],
        suppressed: Boolean(result.suppressReply),
      });

      history.push({ role: MessageRole.USER, content: message });
      history.push(...(result.historyAppend ?? []).map((entry: NonNullable<typeof result.historyAppend>[number]) => ({
        role: entry.role,
        content: entry.content,
        model: entry.model ?? undefined,
        toolName: entry.toolName ?? undefined,
        toolResult: entry.toolResult,
      })));
    }

    report.push({ scenario: scenario.name, turns });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
