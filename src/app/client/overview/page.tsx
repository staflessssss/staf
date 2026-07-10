import {
  AgentEventSource,
  AgentEventStatus,
  AgentEventType,
  ChannelType,
  ConversationStatus,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
  MessageRole,
} from "@prisma/client";

import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
import { BUSINESS_MANUAL_MESSAGE_TOOL_NAME } from "@/lib/business-handoff";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import {
  OverviewView,
  type OverviewAgentRow,
  type OverviewChannel,
  type OverviewPeriod,
} from "./overview-view";

type ClientOverviewPageProps = {
  searchParams: Promise<{ period?: string; channel?: string }>;
};

function parsePeriod(value?: string): OverviewPeriod {
  return value === "7d" || value === "90d" || value === "all" ? value : "30d";
}

function parseChannel(value?: string): OverviewChannel {
  return value === ChannelType.INSTAGRAM || value === ChannelType.GMAIL ? value : "all";
}

function getSince(period: OverviewPeriod) {
  if (period === "all") return undefined;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function uniqueConversationCount(
  events: Array<{ conversationId: string | null }>,
) {
  return new Set(events.map((event) => event.conversationId).filter(Boolean)).size;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
    : (sorted[middle] ?? null);
}

export default async function ClientOverviewPage({ searchParams }: ClientOverviewPageProps) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const { period: rawPeriod, channel: rawChannel } = await searchParams;
  const period = parsePeriod(rawPeriod);
  const channel = parseChannel(rawChannel);
  const since = getSince(period);
  const channelWhere = channel === "all" ? {} : { channel };
  const agentChannelWhere = channel === "all" ? {} : { channel: { type: channel } };
  const occurredAt = since ? { gte: since } : undefined;

  const [agents, conversations, events, manualMessages, responseMessages, escalatedCount, pendingFollowUps] =
    await Promise.all([
      db.agent.findMany({
        where: { tenantId, ...agentChannelWhere },
        include: { channel: true },
        orderBy: { updatedAt: "desc" },
      }),
      db.conversation.findMany({
        where: {
          agent: { tenantId },
          ...channelWhere,
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        select: { id: true, agentId: true, createdAt: true, updatedAt: true },
      }),
      db.agentEvent.findMany({
        where: {
          agent: { tenantId },
          ...channelWhere,
          source: { in: [AgentEventSource.LIVE, AgentEventSource.BACKFILL] },
          ...(occurredAt ? { occurredAt } : {}),
        },
        select: {
          agentId: true,
          conversationId: true,
          type: true,
          status: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: "desc" },
      }),
      db.message.findMany({
        where: {
          role: MessageRole.TOOL,
          toolName: BUSINESS_MANUAL_MESSAGE_TOOL_NAME,
          conversation: { agent: { tenantId }, ...channelWhere },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        select: { conversationId: true },
      }),
      db.message.findMany({
        where: {
          role: { in: [MessageRole.USER, MessageRole.ASSISTANT] },
          conversation: { agent: { tenantId }, ...channelWhere },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        select: { conversationId: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      db.conversation.count({
        where: {
          agent: { tenantId },
          ...channelWhere,
          status: ConversationStatus.ESCALATED,
        },
      }),
      db.delayedDelivery.count({
        where: {
          agent: { tenantId, ...agentChannelWhere },
          kind: DelayedDeliveryKind.FOLLOW_UP,
          status: DelayedDeliveryStatus.PENDING,
        },
      }),
    ]);

  const successfulEvents = events.filter((event) => event.status === AgentEventStatus.SUCCEEDED);
  const eventsOfType = (type: AgentEventType) =>
    successfulEvents.filter((event) => event.type === type);
  const conversationEvents = eventsOfType(AgentEventType.CONVERSATION_STARTED);
  const replyEvents = eventsOfType(AgentEventType.REPLY_SENT);
  const availabilityEvents = eventsOfType(AgentEventType.AVAILABILITY_CHECKED);
  const guideEvents = eventsOfType(AgentEventType.PRICING_GUIDE_SENT);
  const qualifiedEvents = eventsOfType(AgentEventType.LEAD_QUALIFIED);
  const bookedEvents = eventsOfType(AgentEventType.CONSULTATION_BOOKED);
  const handoffEvents = eventsOfType(AgentEventType.HANDOFF_REQUESTED);
  const failedDeliveries = events.filter(
    (event) =>
      event.type === AgentEventType.DELIVERY_FAILED && event.status === AgentEventStatus.FAILED,
  ).length;
  const manualConversationIds = new Set(manualMessages.map((message) => message.conversationId));
  const handoffConversationIds = new Set(
    handoffEvents.map((event) => event.conversationId).filter(Boolean),
  );
  const repliedConversationIds = new Set(
    replyEvents.map((event) => event.conversationId).filter(Boolean),
  );
  const automatedConversationCount = [...repliedConversationIds].filter(
    (conversationId) =>
      !manualConversationIds.has(conversationId as string) &&
      !handoffConversationIds.has(conversationId),
  ).length;
  const automationRate =
    repliedConversationIds.size > 0
      ? Math.round((automatedConversationCount / repliedConversationIds.size) * 100)
      : 0;
  const firstInboundByConversation = new Map<string, Date>();
  const firstReplyByConversation = new Map<string, Date>();
  for (const message of responseMessages) {
    if (message.role === MessageRole.USER && !firstInboundByConversation.has(message.conversationId)) {
      firstInboundByConversation.set(message.conversationId, message.createdAt);
    }
    if (
      message.role === MessageRole.ASSISTANT &&
      firstInboundByConversation.has(message.conversationId) &&
      !firstReplyByConversation.has(message.conversationId)
    ) {
      firstReplyByConversation.set(message.conversationId, message.createdAt);
    }
  }
  const medianResponseMs = median(
    [...firstReplyByConversation.entries()]
      .map(([conversationId, replyAt]) => {
        const inboundAt = firstInboundByConversation.get(conversationId);
        return inboundAt ? replyAt.getTime() - inboundAt.getTime() : -1;
      })
      .filter((value) => value >= 0),
  );

  const agentRows: OverviewAgentRow[] = agents.map((agent) => {
    const agentEvents = successfulEvents.filter((event) => event.agentId === agent.id);
    const agentConversations = conversations.filter((item) => item.agentId === agent.id);
    return {
      id: agent.id,
      name: agent.name,
      channelType: agent.channel.type,
      status: agent.status,
      conversations: agentConversations.length,
      replies: agentEvents.filter((event) => event.type === AgentEventType.REPLY_SENT).length,
      qualified: uniqueConversationCount(
        agentEvents.filter((event) => event.type === AgentEventType.LEAD_QUALIFIED),
      ),
      booked: uniqueConversationCount(
        agentEvents.filter((event) => event.type === AgentEventType.CONSULTATION_BOOKED),
      ),
      lastActivity:
        agentEvents[0]?.occurredAt ?? agentConversations[0]?.updatedAt ?? null,
    };
  });
  const userLabel = getCabinetUserName(session.user);

  return (
    <OverviewView
      userInitials={getInitials(userLabel)}
      userName={userLabel}
      data={{
        period,
        channel,
        activeAgents: agents.filter((agent) => agent.status === "ACTIVE").length,
        totalAgents: agents.length,
        newConversations:
          uniqueConversationCount(conversationEvents) || conversations.length,
        repliesSent: replyEvents.length,
        availabilityChecks: availabilityEvents.length,
        guidesSent: guideEvents.length,
        qualifiedLeads: uniqueConversationCount(qualifiedEvents),
        bookedCalls: uniqueConversationCount(bookedEvents),
        automationRate,
        agents: agentRows,
        funnel: [
          { label: "New inquiries", count: uniqueConversationCount(conversationEvents) || conversations.length },
          { label: "Availability checked", count: uniqueConversationCount(availabilityEvents) },
          { label: "Pricing sent", count: uniqueConversationCount(guideEvents) },
          { label: "Qualified", count: uniqueConversationCount(qualifiedEvents) },
          { label: "Consultations booked", count: uniqueConversationCount(bookedEvents) },
        ],
        health: {
          escalated: escalatedCount,
          failedDeliveries,
          pendingFollowUps,
          handoffs: uniqueConversationCount(handoffEvents),
          medianResponseMs,
          lastSuccessfulReply: replyEvents[0]?.occurredAt ?? null,
        },
      }}
    />
  );
}
