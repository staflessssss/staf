import { MessageRole } from "@prisma/client";

import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { OverviewView, type OverviewAgentRow } from "./overview-view";

type Tally = { conversations: number; messages: number; tools: number; lastActivity: Date | null };

export default async function ClientOverviewPage() {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;

  const [agents, conversations, topFunctions] = await Promise.all([
    db.agent.findMany({
      where: { tenantId },
      include: { channel: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.conversation.findMany({
      where: { agent: { tenantId } },
      select: {
        agentId: true,
        updatedAt: true,
        messages: { select: { role: true } },
      },
    }),
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

  const tally = new Map<string, Tally>();
  for (const conversation of conversations) {
    const stat = tally.get(conversation.agentId) ?? {
      conversations: 0,
      messages: 0,
      tools: 0,
      lastActivity: null,
    };
    stat.conversations += 1;
    for (const message of conversation.messages) {
      if (message.role === MessageRole.TOOL) stat.tools += 1;
      else stat.messages += 1;
    }
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
