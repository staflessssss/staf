import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  AgentStatus,
  ChannelType,
  ConversationStatus,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
  MessageRole,
} from "@prisma/client";

import { invokeWeddingSalesSimpleAdapter } from "@/lib/agents/wedding-sales-simple/invoke";
import {
  invokeWeddingSalesSimpleGraph,
  type InvokeWeddingSalesSimpleGraphInput,
} from "@/lib/lang/graphs/wedding-sales-simple/graph";
import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";
import type {
  SimpleWeddingSalesQuestion,
  TurnUnderstanding,
} from "@/lib/lang/graphs/wedding-sales-simple/state";
import type { WeddingSalesConfig } from "@/lib/lang/graphs/wedding-sales/config";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";
import {
  processDueDelayedDeliveriesWithDeps,
} from "@/lib/message-delivery-runtime";
import {
  scheduleWeddingSalesSimpleSlotFollowUpsForReplyWithDb,
  type WeddingSalesSimpleSlotFollowUpPayload,
  WEDDING_SALES_SIMPLE_FOLLOW_UP_LOG_TOOL_NAME,
} from "@/lib/agents/wedding-sales-simple/followups";

type Scenario = {
  test_case: string;
  mocked_datetime?: string;
  fixtures?: {
    state?: Partial<SimpleWeddingSalesState>;
    config?: Partial<WeddingSalesConfig>;
    channelConfig?: Record<string, unknown>;
  };
  steps: ScenarioStep[];
};

type ScenarioStep =
  | {
      user: string;
      understanding?: {
        customerMessageType?: TurnUnderstanding["customerMessageType"];
        facts?: Partial<TurnUnderstanding["facts"]>;
        questionsAskedByCustomer?: SimpleWeddingSalesQuestion[];
        confidence?: number;
      };
      assert?: StepAssert;
    }
  | {
      cron: string;
      assert?: StepAssert;
    };

type StepAssert = {
  responseKey?: string;
  replyType?: string;
  nextStep?: string;
  contains?: string | string[];
  doesNotContain?: string | string[];
  toolCalled?: string;
  toolNotCalled?: string;
  attachmentPurpose?: string;
  slot_was_set?: Record<string, unknown>;
  slot_was_not_set?: string[];
  pendingUserAction?: Record<string, unknown> | null;
  bookingConfirmed?: boolean;
  followUpsScheduled?: {
    slot?: string;
    stages?: string[];
  };
  followUpSent?: {
    slot?: string;
    stage?: string;
  };
  followUpCancelled?: {
    reason?: string;
  };
  safetyLogContains?: string | string[];
  deliveryParts?: Array<{
    kind?: string;
    reason?: string;
    purpose?: string;
  }>;
};

type OutboxEntry =
  | {
      kind: "text";
      text: string;
      reason?: string;
    }
  | {
      kind: "attachment";
      purpose?: string;
      url?: string;
      reason?: string;
    }
  | {
      kind: "sender_action";
      action?: string;
      reason?: string;
    };

type MessageRecord = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  toolName?: string | null;
  toolInput?: unknown;
  toolResult?: unknown;
  model?: string | null;
  createdAt: Date;
};

type DelayedDeliveryRecord = {
  id: string;
  agentId: string;
  conversationId: string;
  kind: DelayedDeliveryKind;
  status: DelayedDeliveryStatus;
  dueAt: Date;
  payload: unknown;
  attempts: number;
  lastAttemptAt?: Date | null;
  error?: string | null;
  createdAt: Date;
};

const rootDir = process.cwd();
const dialoguesDir = path.join(rootDir, "tests", "wedding-sales-simple", "dialogues");

function parseScenarioFile(filePath: string): Scenario {
  const raw = readFileSync(filePath, "utf8");

  try {
    return JSON.parse(raw) as Scenario;
  } catch (error) {
    throw new Error(
      `${filePath} must be JSON-compatible YAML for this lightweight runner: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function normalizeList(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function addDuration(base: Date, duration: string) {
  const match = /^\+(\d+)([mhd])$/.exec(duration.trim());

  if (!match) {
    throw new Error(`Unsupported cron duration "${duration}". Use +10m, +1d, +3d, etc.`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return new Date(base.getTime() + amount * multiplier);
}

function getSlot(state: Partial<SimpleWeddingSalesState>, slot: string) {
  if (slot === "names") {
    return [state.customerName, state.partnerName].filter(Boolean).join(" and ");
  }

  if (slot === "email") {
    return state.customerEmail;
  }

  if (slot === "callTime") {
    return state.checkedCallTime ?? state.checkedCallStartTime ?? state.proposedCallTime;
  }

  return (state as Record<string, unknown>)[slot];
}

function makeToolContext(): WeddingSalesToolContext {
  return {
    tenantId: "tenant-dialogue",
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
}

function defaultConfig(): Partial<WeddingSalesConfig> {
  return {
    guide: {
      imageUrl: "https://example.com/myndful-fl-guide.png",
      fileName: "Collections guide",
    },
    guidesByRegion: {
      FL: {
        imageUrl: "https://example.com/myndful-fl-guide.png",
        fileName: "Florida collections guide",
      },
      NC_SC_GA: {
        imageUrl: "https://example.com/myndful-nc-sc-ga-guide.png",
        fileName: "NC SC GA collections guide",
      },
    },
  };
}

function defaultChannelConfig() {
  return {
    runtimeType: "wedding_sales_simple",
    enableInstagramSemanticDeliveryPlan: true,
    instagramDeliveryPacing: "fast",
    pricing: {
      startPrice: "$2,800",
      currency: "USD",
      coverageHours: 8,
      promotionText: "Also, we are running a 20% discount through June 30.",
    },
    pricingByRegion: {
      FL: {
        startPrice: "$2,800",
        currency: "USD",
        coverageHours: 8,
        promotionText: "Also, we are running a 20% discount through June 30.",
      },
      NC_SC_GA: {
        startPrice: "$3,600",
        currency: "USD",
        coverageHours: 8,
        promotionText: "Also, we are running a 20% discount through June 30.",
      },
    },
    priceAttachmentsByRegion: {
      FL: {
        priceAttachmentPublicUrl: "https://example.com/myndful-fl-guide.png",
        fileName: "Florida collections guide",
      },
      NC_SC_GA: {
        priceAttachmentPublicUrl: "https://example.com/myndful-nc-sc-ga-guide.png",
        fileName: "NC SC GA collections guide",
      },
    },
    guidesByRegion: {
      FL: {
        imageUrl: "https://example.com/myndful-fl-guide.png",
        fileName: "Florida collections guide",
      },
      NC_SC_GA: {
        imageUrl: "https://example.com/myndful-nc-sc-ga-guide.png",
        fileName: "NC SC GA collections guide",
      },
    },
    guide: {
      imageUrl: "https://example.com/myndful-fl-guide.png",
      fileName: "Collections guide",
    },
  };
}

class InMemoryDialogueDb {
  readonly messages: MessageRecord[] = [];
  readonly delayedDeliveries: DelayedDeliveryRecord[] = [];
  private messageCounter = 0;
  private deliveryCounter = 0;

  constructor(
    private readonly now: () => Date,
    private readonly scenarioId: string,
  ) {}

  readonly agent = {
    findFirst: async () => ({
      id: "agent-dialogue",
      tenantId: "tenant-dialogue",
      status: AgentStatus.ACTIVE,
      channelConfig: defaultChannelConfig(),
      channel: {
        type: ChannelType.INSTAGRAM,
        credentialsEnc: "encrypted",
      },
    }),
  };

  readonly conversation = {
    findFirst: async () => ({
      id: this.conversationId,
      status: ConversationStatus.ACTIVE,
      contactId: "contact-dialogue",
    }),
    update: async () => ({
      id: this.conversationId,
      status: ConversationStatus.ACTIVE,
      contactId: "contact-dialogue",
    }),
  };

  get conversationId() {
    return `conv-${this.scenarioId}`;
  }

  readonly message = {
    create: async (args: { data: Partial<MessageRecord> }) => {
      const record: MessageRecord = {
        id: `msg-${++this.messageCounter}`,
        conversationId: args.data.conversationId ?? this.conversationId,
        role: args.data.role ?? MessageRole.TOOL,
        content: args.data.content ?? "",
        toolName: args.data.toolName ?? null,
        toolInput: args.data.toolInput,
        toolResult: args.data.toolResult,
        model: args.data.model ?? null,
        createdAt: this.now(),
      };
      this.messages.push(record);
      return record;
    },
    createMany: async (args: { data: Array<Partial<MessageRecord>> }) => {
      for (const data of args.data) {
        await this.message.create({ data });
      }
      return { count: args.data.length };
    },
    findFirst: async (args: {
      where?: {
        conversationId?: string;
        role?: MessageRole;
        toolName?: string;
        createdAt?: { gt?: Date };
      };
      orderBy?: { createdAt?: "asc" | "desc" };
    }) => {
      let rows = this.messages.filter((message) => {
        if (args.where?.conversationId && message.conversationId !== args.where.conversationId) {
          return false;
        }
        if (args.where?.role && message.role !== args.where.role) {
          return false;
        }
        if (args.where?.toolName && message.toolName !== args.where.toolName) {
          return false;
        }
        if (args.where?.createdAt?.gt && message.createdAt <= args.where.createdAt.gt) {
          return false;
        }
        return true;
      });

      rows = rows.sort((a, b) =>
        args.orderBy?.createdAt === "asc"
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime(),
      );

      return rows[0] ?? null;
    },
  };

  readonly delayedDelivery = {
    create: async (args: { data: Partial<DelayedDeliveryRecord> }) => {
      const record: DelayedDeliveryRecord = {
        id: `delivery-${++this.deliveryCounter}`,
        agentId: args.data.agentId ?? "agent-dialogue",
        conversationId: args.data.conversationId ?? this.conversationId,
        kind: args.data.kind ?? DelayedDeliveryKind.FOLLOW_UP,
        status: args.data.status ?? DelayedDeliveryStatus.PENDING,
        dueAt: args.data.dueAt ?? this.now(),
        payload: args.data.payload,
        attempts: args.data.attempts ?? 0,
        lastAttemptAt: args.data.lastAttemptAt ?? null,
        error: args.data.error ?? null,
        createdAt: this.now(),
      };
      this.delayedDeliveries.push(record);
      return record;
    },
    findMany: async (args: {
      where?: {
        conversationId?: string;
        kind?: DelayedDeliveryKind;
        status?: DelayedDeliveryStatus | { in?: DelayedDeliveryStatus[] };
        dueAt?: { lte?: Date };
      };
      orderBy?: { dueAt?: "asc" | "desc" };
      take?: number;
      select?: unknown;
    }) => {
      let rows = this.delayedDeliveries.filter((delivery) => {
        if (args.where?.conversationId && delivery.conversationId !== args.where.conversationId) {
          return false;
        }
        if (args.where?.kind && delivery.kind !== args.where.kind) {
          return false;
        }
        if (args.where?.status) {
          const status = args.where.status;
          if (typeof status === "string" && delivery.status !== status) {
            return false;
          }
          if (typeof status === "object" && status.in && !status.in.includes(delivery.status)) {
            return false;
          }
        }
        if (args.where?.dueAt?.lte && delivery.dueAt > args.where.dueAt.lte) {
          return false;
        }
        return true;
      });

      rows = rows.sort((a, b) =>
        args.orderBy?.dueAt === "desc"
          ? b.dueAt.getTime() - a.dueAt.getTime()
          : a.dueAt.getTime() - b.dueAt.getTime(),
      );

      return rows.slice(0, args.take ?? rows.length).map((delivery) => ({
        id: delivery.id,
        agentId: delivery.agentId,
        conversationId: delivery.conversationId,
        kind: delivery.kind,
        status: delivery.status,
        dueAt: delivery.dueAt,
        payload: delivery.payload,
      }));
    },
    findUnique: async (args: { where: { id: string } }) => {
      const delivery = this.delayedDeliveries.find((entry) => entry.id === args.where.id);

      if (!delivery) {
        return null;
      }

      return {
        ...delivery,
        agent: {
          id: delivery.agentId,
          tenantId: "tenant-dialogue",
          status: AgentStatus.ACTIVE,
          channelConfig: defaultChannelConfig(),
          channel: {
            type: ChannelType.INSTAGRAM,
            credentialsEnc: "encrypted",
          },
        },
        conversation: {
          id: delivery.conversationId,
          status: ConversationStatus.ACTIVE,
          contactId: "contact-dialogue",
        },
      };
    },
    updateMany: async (args: {
      where?: {
        id?: string;
        conversationId?: string;
        kind?: DelayedDeliveryKind;
        status?: DelayedDeliveryStatus | { in?: DelayedDeliveryStatus[] };
        dueAt?: { lte?: Date };
      };
      data?: Partial<DelayedDeliveryRecord> & {
        attempts?: { increment?: number };
      };
    }) => {
      let count = 0;
      for (const delivery of this.delayedDeliveries) {
        if (args.where?.id && delivery.id !== args.where.id) {
          continue;
        }
        if (args.where?.conversationId && delivery.conversationId !== args.where.conversationId) {
          continue;
        }
        if (args.where?.kind && delivery.kind !== args.where.kind) {
          continue;
        }
        if (args.where?.status) {
          const status = args.where.status;
          if (typeof status === "string" && delivery.status !== status) {
            continue;
          }
          if (typeof status === "object" && status.in && !status.in.includes(delivery.status)) {
            continue;
          }
        }
        if (args.where?.dueAt?.lte && delivery.dueAt > args.where.dueAt.lte) {
          continue;
        }

        if (args.data?.status) {
          delivery.status = args.data.status;
        }
        if (args.data?.dueAt) {
          delivery.dueAt = args.data.dueAt;
        }
        if (args.data?.lastAttemptAt !== undefined) {
          delivery.lastAttemptAt = args.data.lastAttemptAt;
        }
        if (args.data?.error !== undefined) {
          delivery.error = args.data.error;
        }
        if (args.data?.attempts?.increment) {
          delivery.attempts += args.data.attempts.increment;
        }
        count += 1;
      }
      return { count };
    },
    update: async (args: {
      where: { id: string };
      data: Partial<DelayedDeliveryRecord>;
    }) => {
      await this.delayedDelivery.updateMany({
        where: { id: args.where.id },
        data: args.data,
      });
      return this.delayedDeliveries.find((entry) => entry.id === args.where.id) ?? null;
    },
    count: async (args: {
      where?: {
        conversationId?: string;
        kind?: DelayedDeliveryKind;
        status?: DelayedDeliveryStatus;
      };
    }) =>
      this.delayedDeliveries.filter((delivery) => {
        if (args.where?.conversationId && delivery.conversationId !== args.where.conversationId) {
          return false;
        }
        if (args.where?.kind && delivery.kind !== args.where.kind) {
          return false;
        }
        if (args.where?.status && delivery.status !== args.where.status) {
          return false;
        }
        return true;
      }).length,
  };
}

function renderOutbox(args: {
  text: string;
  attachments?: Array<{ type: string; url: string; purpose?: string }>;
  channelDeliveryPlan?: unknown;
}) {
  const plan = args.channelDeliveryPlan as
    | {
        mode?: string;
        parts?: Array<Record<string, unknown>>;
      }
    | undefined;
  const outbox: OutboxEntry[] = [];

  if (plan?.mode === "semantic_split" && Array.isArray(plan.parts)) {
    for (const part of plan.parts) {
      if (part.kind === "text") {
        outbox.push({
          kind: "text",
          text: String(part.text ?? ""),
          reason: typeof part.reason === "string" ? part.reason : undefined,
        });
      } else if (part.kind === "attachment") {
        const attachment =
          part.attachment && typeof part.attachment === "object" && !Array.isArray(part.attachment)
            ? (part.attachment as Record<string, unknown>)
            : {};
        outbox.push({
          kind: "attachment",
          purpose:
            typeof part.purpose === "string"
              ? part.purpose
              : typeof attachment.purpose === "string"
                ? attachment.purpose
                : undefined,
          url:
            typeof part.url === "string"
              ? part.url
              : typeof attachment.url === "string"
                ? attachment.url
                : undefined,
          reason: typeof part.reason === "string" ? part.reason : undefined,
        });
      } else if (part.kind === "sender_action") {
        outbox.push({
          kind: "sender_action",
          action: typeof part.action === "string" ? part.action : undefined,
          reason: typeof part.reason === "string" ? part.reason : undefined,
        });
      }
    }
    return outbox;
  }

  if (args.text) {
    outbox.push({ kind: "text", text: args.text });
  }

  for (const attachment of args.attachments ?? []) {
    outbox.push({
      kind: "attachment",
      purpose: attachment.purpose,
      url: attachment.url,
    });
  }

  return outbox;
}

function newestFollowUpLog(db: InMemoryDialogueDb, event?: string) {
  const logs = db.messages
    .filter((message) => message.toolName === WEDDING_SALES_SIMPLE_FOLLOW_UP_LOG_TOOL_NAME)
    .filter((message) => !event || (message.toolResult as { event?: string } | undefined)?.event === event)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return logs[0];
}

function assertStep(args: {
  scenarioName: string;
  stepIndex: number;
  assertion?: StepAssert;
  state: Partial<SimpleWeddingSalesState>;
  responseText: string;
  outbox: OutboxEntry[];
  safetyLog?: Record<string, unknown>;
  cronResults?: Array<{ status?: string }>;
  db: InMemoryDialogueDb;
}) {
  const assertion = args.assertion;
  if (!assertion) {
    return;
  }

  const label = `${args.scenarioName} step ${args.stepIndex}`;
  const decisionTrace = args.state.decisionTrace;
  const toolCalls = args.state.toolObservations?.map((observation) => observation.toolName) ?? [];

  if (assertion.responseKey !== undefined) {
    assert.equal(decisionTrace?.responseKey, assertion.responseKey, `${label}: responseKey`);
  }
  if (assertion.replyType !== undefined) {
    assert.equal(decisionTrace?.replyType, assertion.replyType, `${label}: replyType`);
  }
  if (assertion.nextStep !== undefined) {
    assert.equal(args.state.nextStep, assertion.nextStep, `${label}: nextStep`);
  }
  for (const expected of normalizeList(assertion.contains)) {
    assert.match(args.responseText, new RegExp(escapeRegExp(expected), "i"), `${label}: contains ${expected}`);
  }
  for (const forbidden of normalizeList(assertion.doesNotContain)) {
    assert.doesNotMatch(
      args.responseText,
      new RegExp(escapeRegExp(forbidden), "i"),
      `${label}: doesNotContain ${forbidden}`,
    );
  }
  if (assertion.toolCalled !== undefined) {
    assert.ok(toolCalls.includes(assertion.toolCalled), `${label}: expected tool ${assertion.toolCalled}`);
  }
  if (assertion.toolNotCalled !== undefined) {
    assert.ok(!toolCalls.includes(assertion.toolNotCalled), `${label}: forbidden tool ${assertion.toolNotCalled}`);
  }
  if (assertion.attachmentPurpose !== undefined) {
    assert.ok(
      args.outbox.some((entry) => entry.kind === "attachment" && entry.purpose === assertion.attachmentPurpose),
      `${label}: expected attachment purpose ${assertion.attachmentPurpose}`,
    );
  }
  for (const [slot, expected] of Object.entries(assertion.slot_was_set ?? {})) {
    assert.equal(getSlot(args.state, slot), expected, `${label}: slot ${slot}`);
  }
  for (const slot of assertion.slot_was_not_set ?? []) {
    assert.equal(getSlot(args.state, slot), undefined, `${label}: slot ${slot} should not be set`);
  }
  if ("pendingUserAction" in assertion) {
    if (assertion.pendingUserAction === null) {
      assert.equal(args.state.pendingUserAction, null, `${label}: pendingUserAction`);
    } else {
      for (const [key, expected] of Object.entries(assertion.pendingUserAction ?? {})) {
        assert.equal(
          (args.state.pendingUserAction as Record<string, unknown> | undefined)?.[key],
          expected,
          `${label}: pendingUserAction.${key}`,
        );
      }
    }
  }
  if (assertion.bookingConfirmed !== undefined) {
    assert.equal(args.state.bookingConfirmed, assertion.bookingConfirmed, `${label}: bookingConfirmed`);
  }
  if (assertion.followUpsScheduled) {
    const log = newestFollowUpLog(args.db, "FollowupScheduled");
    assert.ok(log, `${label}: expected FollowupScheduled log`);
    const payload = (log.toolResult as { payload?: { slot?: string; stages?: string[] } }).payload;
    if (assertion.followUpsScheduled.slot) {
      assert.equal(payload?.slot, assertion.followUpsScheduled.slot, `${label}: followUpsScheduled.slot`);
    }
    if (assertion.followUpsScheduled.stages) {
      assert.deepEqual(payload?.stages, assertion.followUpsScheduled.stages, `${label}: followUpsScheduled.stages`);
    }
  }
  if (assertion.followUpSent) {
    const log = newestFollowUpLog(args.db, "FollowupSent");
    assert.ok(log, `${label}: expected FollowupSent log`);
    const payload = (log.toolResult as { payload?: WeddingSalesSimpleSlotFollowUpPayload }).payload;
    if (assertion.followUpSent.slot) {
      assert.equal(payload?.slot, assertion.followUpSent.slot, `${label}: followUpSent.slot`);
    }
    if (assertion.followUpSent.stage) {
      assert.equal(payload?.stage, assertion.followUpSent.stage, `${label}: followUpSent.stage`);
    }
  }
  if (assertion.followUpCancelled) {
    const log = newestFollowUpLog(args.db, "FollowupCancelled");
    assert.ok(log, `${label}: expected FollowupCancelled log`);
    if (assertion.followUpCancelled.reason) {
      assert.equal(
        (log.toolResult as { reason?: string }).reason,
        assertion.followUpCancelled.reason,
        `${label}: followUpCancelled.reason`,
      );
    }
  }
  for (const expected of normalizeList(assertion.safetyLogContains)) {
    assert.match(
      JSON.stringify(args.safetyLog ?? {}),
      new RegExp(escapeRegExp(expected), "i"),
      `${label}: safetyLogContains ${expected}`,
    );
  }
  if (assertion.deliveryParts) {
    for (const part of assertion.deliveryParts) {
      assert.ok(
        args.outbox.some((entry) => {
          if (part.kind && entry.kind !== part.kind) {
            return false;
          }
          if (part.reason && entry.reason !== part.reason) {
            return false;
          }
          if (part.purpose && (entry.kind !== "attachment" || entry.purpose !== part.purpose)) {
            return false;
          }
          return true;
        }),
        `${label}: expected delivery part ${JSON.stringify(part)}`,
      );
    }
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function runScenario(scenario: Scenario) {
  let now = new Date(scenario.mocked_datetime ?? "2026-06-29T12:00:00.000Z");
  const db = new InMemoryDialogueDb(() => now, slugify(scenario.test_case));
  const outbox: OutboxEntry[] = [];
  const safetyLogs: Record<string, unknown>[] = [];
  let state: Partial<SimpleWeddingSalesState> | undefined = scenario.fixtures?.state;
  const config = {
    ...defaultConfig(),
    ...scenario.fixtures?.config,
  };
  const channelConfig = {
    ...defaultChannelConfig(),
    ...scenario.fixtures?.channelConfig,
  };

  for (const [stepIndex, step] of scenario.steps.entries()) {
    if ("cron" in step) {
      now = addDuration(now, step.cron);
      const cronOutboxStart = outbox.length;
      const cronResults = await processDueDelayedDeliveriesWithDeps(
        {
          db: db as never,
          decrypt: (value) => value,
          getChannelAdapter: () =>
            ({
              formatReply: (text: string) => text,
              sendReply: async (args: { message: string }) => {
                outbox.push({ kind: "text", text: args.message });
                return { ok: true, message_id: `fake-follow-up-${outbox.length}` };
              },
            }) as never,
          invokeAgent: async () => {
            throw new Error("wedding_sales_simple follow-ups must not invoke generic agent");
          },
          saveMessages: async (conversationId, messages) => {
            for (const message of messages) {
              await db.message.create({
                data: {
                  conversationId,
                  role: message.role,
                  content: message.content,
                  model: message.model,
                },
              });
            }
          },
        },
        now,
        25,
      );

      assertStep({
        scenarioName: scenario.test_case,
        stepIndex,
        assertion: step.assert,
        state: state ?? {},
        responseText: outbox.slice(cronOutboxStart).map((entry) => entry.kind === "text" ? entry.text : "").join("\n\n"),
        outbox: outbox.slice(cronOutboxStart),
        safetyLog: safetyLogs.at(-1),
        cronResults,
        db,
      });
      continue;
    }

    await db.message.create({
      data: {
        conversationId: db.conversationId,
        role: MessageRole.USER,
        content: step.user,
        toolInput: {
          messageId: `user-${stepIndex + 1}`,
        },
      },
    });

    const incoming = {
        channel: "instagram",
        tenantId: "tenant-dialogue",
        agentId: "agent-dialogue",
        contactId: "contact-dialogue",
        conversationId: db.conversationId,
        text: step.user,
        incomingMessageId: `user-${stepIndex + 1}`,
        receivedAt: now.toISOString(),
    } as const;
    let currentSafetyLog: Record<string, unknown> | undefined;
    const adapterResult = await invokeWeddingSalesSimpleAdapter({
      incoming,
      toolContext: makeToolContext(),
      config,
      channelConfig,
      deps: {
        loadState: () => state,
        saveState: ({ state: savedState }) => {
          state = savedState;
        },
        recordSafetyLog: (entry) => {
          currentSafetyLog = entry as unknown as Record<string, unknown>;
        },
        invokeGraph: (input) =>
          invokeWeddingSalesSimpleGraph({
            ...input,
            understand: step.understanding
              ? () => ({
                  customerMessageType:
                    step.understanding?.customerMessageType ?? "answer_to_question",
                  facts: step.understanding?.facts ?? {},
                  questionsAskedByCustomer: step.understanding?.questionsAskedByCustomer ?? [],
                  confidence: step.understanding?.confidence ?? 0.95,
                })
              : undefined,
          } satisfies InvokeWeddingSalesSimpleGraphInput),
      },
    });
    assert.equal(adapterResult.status, "processed");
    const graphState = adapterResult.state;
    const outbound = adapterResult.outbound;

    if (currentSafetyLog) {
      safetyLogs.push(currentSafetyLog);
    }

    await db.message.create({
      data: {
        conversationId: db.conversationId,
        role: MessageRole.TOOL,
        toolName: "__wedding_sales_simple_state",
        content: "wedding-sales-simple state",
        toolResult: { state: graphState },
        model: "wedding_sales_simple",
      },
    });
    await db.message.create({
      data: {
        conversationId: db.conversationId,
        role: MessageRole.TOOL,
        toolName: "__wedding_sales_simple_safety_log",
        content: "wedding-sales-simple safety log",
        toolResult: currentSafetyLog,
        model: "wedding_sales_simple",
      },
    });

    const turnOutbox = renderOutbox({
      text: outbound.text,
      attachments: outbound.attachments,
      channelDeliveryPlan: outbound.channelDeliveryPlan,
    });
    outbox.push(...turnOutbox);
    await db.message.create({
      data: {
        conversationId: db.conversationId,
        role: MessageRole.ASSISTANT,
        content: outbound.text,
        model: "wedding_sales_simple",
      },
    });

    await db.delayedDelivery.updateMany({
      where: {
        conversationId: db.conversationId,
        kind: DelayedDeliveryKind.FOLLOW_UP,
        status: { in: [DelayedDeliveryStatus.PENDING, DelayedDeliveryStatus.PROCESSING] },
      },
      data: {
        status: DelayedDeliveryStatus.CANCELED,
        error: "superseded_by_new_user_turn",
      },
    });

    await scheduleWeddingSalesSimpleSlotFollowUpsForReplyWithDb({
      database: db as never,
      agentId: "agent-dialogue",
      conversationId: db.conversationId,
      replyContext: {
        contactId: "contact-dialogue",
      },
      anchorCreatedAt: now,
      anchorAssistantMessageId: `assistant-${stepIndex + 1}`,
      state: graphState,
    });

    state = graphState;

    assertStep({
      scenarioName: scenario.test_case,
      stepIndex,
      assertion: step.assert,
      state,
      responseText: outbound.text,
      outbox: turnOutbox,
      safetyLog: currentSafetyLog,
      db,
    });
  }

  return {
    outbox,
    safetyLogs,
    delayedDeliveries: db.delayedDeliveries,
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scenario";
}

async function main() {
  if (!existsSync(dialoguesDir)) {
    throw new Error(`Dialogues directory not found: ${dialoguesDir}`);
  }

  const files = readdirSync(dialoguesDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No dialogue fixtures found in ${dialoguesDir}`);
  }

  const results = [];
  for (const file of files) {
    const scenario = parseScenarioFile(path.join(dialoguesDir, file));
    await runScenario(scenario);
    results.push(scenario.test_case);
    console.log(`ok - ${scenario.test_case}`);
  }

  console.log(`\n${results.length}/${files.length} wedding dialogue scenarios passed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
