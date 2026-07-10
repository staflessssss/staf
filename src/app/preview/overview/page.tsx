import { OverviewView } from "@/app/client/overview/overview-view";

// Auth/DB-free preview of the stats overview. Open http://localhost:3000/preview/overview
export default function PreviewOverviewPage() {
  return (
    <OverviewView
      userInitials="BF"
      userName="Behalfy Client"
      data={{
        period: "30d",
        channel: "all",
        activeAgents: 3,
        totalAgents: 4,
        newConversations: 128,
        repliesSent: 116,
        availabilityChecks: 72,
        guidesSent: 59,
        qualifiedLeads: 31,
        bookedCalls: 14,
        automationRate: 84,
        agents: [
          {
            id: "1",
            name: "Mia — Wedding Concierge",
            channelType: "GMAIL",
            status: "ACTIVE",
            conversations: 64,
            replies: 58,
            qualified: 16,
            booked: 8,
            lastActivity: new Date(),
          },
          {
            id: "2",
            name: "Leo — Instagram DM",
            channelType: "INSTAGRAM",
            status: "ACTIVE",
            conversations: 41,
            replies: 39,
            qualified: 10,
            booked: 4,
            lastActivity: new Date(Date.now() - 3600_000),
          },
          {
            id: "3",
            name: "Nova — After-hours",
            channelType: "GMAIL",
            status: "PAUSED",
            conversations: 14,
            replies: 12,
            qualified: 3,
            booked: 1,
            lastActivity: new Date(Date.now() - 86_400_000),
          },
          {
            id: "4",
            name: "Iris — Follow-ups",
            channelType: "GMAIL",
            status: "ACTIVE",
            conversations: 9,
            replies: 7,
            qualified: 2,
            booked: 1,
            lastActivity: new Date(Date.now() - 3 * 86_400_000),
          },
        ],
        funnel: [
          { label: "New inquiries", count: 128 },
          { label: "Availability checked", count: 72 },
          { label: "Pricing sent", count: 59 },
          { label: "Qualified", count: 31 },
          { label: "Consultations booked", count: 14 },
        ],
        health: {
          escalated: 3,
          failedDeliveries: 1,
          pendingFollowUps: 8,
          handoffs: 4,
          medianResponseMs: 82_000,
          lastSuccessfulReply: new Date(),
        },
      }}
    />
  );
}
