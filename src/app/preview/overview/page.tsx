import { OverviewView } from "@/app/client/overview/overview-view";

// Auth/DB-free preview of the stats overview. Open http://localhost:3000/preview/overview
export default function PreviewOverviewPage() {
  return (
    <OverviewView
      userInitials="BF"
      userName="Behalfy Client"
      data={{
        activeAgents: 3,
        totalAgents: 4,
        totalConversations: 128,
        totalMessages: 1463,
        totalTools: 312,
        agents: [
          {
            id: "1",
            name: "Mia — Wedding Concierge",
            channelType: "GMAIL",
            status: "ACTIVE",
            conversations: 64,
            messages: 812,
            tools: 187,
            lastActivity: new Date(),
          },
          {
            id: "2",
            name: "Leo — Instagram DM",
            channelType: "INSTAGRAM",
            status: "ACTIVE",
            conversations: 41,
            messages: 409,
            tools: 88,
            lastActivity: new Date(Date.now() - 3600_000),
          },
          {
            id: "3",
            name: "Nova — After-hours",
            channelType: "GMAIL",
            status: "PAUSED",
            conversations: 14,
            messages: 162,
            tools: 24,
            lastActivity: new Date(Date.now() - 86_400_000),
          },
          {
            id: "4",
            name: "Iris — Follow-ups",
            channelType: "GMAIL",
            status: "ACTIVE",
            conversations: 9,
            messages: 80,
            tools: 13,
            lastActivity: new Date(Date.now() - 3 * 86_400_000),
          },
        ],
        topFunctions: [
          { toolName: "check_availability", count: 142 },
          { toolName: "book_call", count: 76 },
          { toolName: "qualify_lead", count: 54 },
          { toolName: "send_pricing", count: 28 },
          { toolName: "create_contact", count: 12 },
        ],
      }}
    />
  );
}
