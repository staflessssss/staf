import { MessageRole } from "@prisma/client";

import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { OverviewView, type OverviewAgentRow } from "./overview-view";

type Tally = { conversations: number; messages: number; tools: number; lastActivity: Date | null };

export default async function ClientOverviewPage() {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;

  const [agents, conversations] = await Promise.all([
    db.agent.findMany({
      where: { tenantId },
      include: { channel: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.conversation.findMany({
      where: { agent: { tenantId } },
      select: {
        id: true,
        agentId: true,
        updatedAt: true,
      },
    }),
  ]);
  const conversationIds = conversations.map((conversation) => conversation.id);
  const [messageCounts, topFunctions] = await Promise.all([
    conversationIds.length > 0
      ? db.message.groupBy({
          by: ["conversationId", "role"],
          where: { conversationId: { in: conversationIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    db.message.groupBy({
      by: ["toolName"],
      where: {
        role: MessageRole.TOOL,
        toolName: { not: null },
        conversation: { agent: { tenantId } },
      },
      _count: { _all: true },
      orderBy: { _count: { toolName: "desc" } },
      take: 6,
    }),
  ]);

  const countsByConversation = new Map<string, { messages: number; tools: number }>();
  for (const count of messageCounts) {
    const current = countsByConversation.get(count.conversationId) ?? { messages: 0, tools: 0 };
    if (count.role === MessageRole.TOOL) current.tools += count._count._all;
    else current.messages += count._count._all;
    countsByConversation.set(count.conversationId, current);
  }

  const tally = new Map<string, Tally>();
  for (const conversation of conversations) {
    const stat = tally.get(conversation.agentId) ?? {
      conversations: 0,
      messages: 0,
      tools: 0,
      lastActivity: null,
    };
    stat.conversations += 1;
    const counts = countsByConversation.get(conversation.id);
    stat.messages += counts?.messages ?? 0;
    stat.tools += counts?.tools ?? 0;
    if (!stat.lastActivity || conversation.updatedAt > stat.lastActivity) {
      stat.lastActivity = conversation.updatedAt;
    }
    tally.set(conversation.agentId, stat);
  }

  const agentRows: OverviewAgentRow[] = agents.map((agent) => {
    const stat = tally.get(agent.id);
    return {
      id: agent.id,
      name: agent.name,
      channelType: agent.channel.type,
      status: agent.status,
      conversations: stat?.conversations ?? 0,
      messages: stat?.messages ?? 0,
      tools: stat?.tools ?? 0,
      lastActivity: stat?.lastActivity ?? null,
    };
  });

  const totalMessages = agentRows.reduce((sum, row) => sum + row.messages, 0);
  const totalTools = agentRows.reduce((sum, row) => sum + row.tools, 0);
  const userLabel = getCabinetUserName(session.user);

  return (
    <OverviewView
      userInitials={getInitials(userLabel)}
      userName={userLabel}
      data={{
        activeAgents: agents.filter((agent) => agent.status === "ACTIVE").length,
        totalAgents: agents.length,
        totalConversations: conversations.length,
        totalMessages,
        totalTools,
        agents: agentRows,
        topFunctions: topFunctions.map((fn) => ({
          toolName: fn.toolName ?? "unknown",
          count: fn._count._all,
        })),
      }}
    />
  );
}
