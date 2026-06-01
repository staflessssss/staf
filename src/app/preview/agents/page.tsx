import { AgentsView, type AgentsViewAgent } from "@/app/client/agents/agents-view";

// Auth/DB-free preview of the agents dashboard layout.
// Open http://localhost:3000/preview/agents — no login required.
const mockAgents: AgentsViewAgent[] = [
  {
    id: "1",
    name: "Mia — Wedding Concierge",
    status: "ACTIVE",
    persona:
      "Warm, attentive concierge that answers couples like a human, qualifies leads, checks availability and books discovery calls.",
    channel: { type: "GMAIL" },
    conversations: [{ updatedAt: new Date() }],
  },
  {
    id: "2",
    name: "Leo — Instagram DM",
    status: "ACTIVE",
    persona:
      "Replies to Instagram DMs, captures wedding date and location, nudges toward a booked call.",
    channel: { type: "INSTAGRAM" },
    conversations: [{ updatedAt: new Date(Date.now() - 3600_000) }],
  },
  {
    id: "3",
    name: "Nova — After-hours",
    status: "PAUSED",
    persona: "Backup agent handling overflow inquiries outside business hours.",
    channel: { type: "GMAIL" },
    conversations: [],
  },
  {
    id: "4",
    name: "Iris — Follow-ups",
    status: "ACTIVE",
    persona: "Re-engages cold leads with gentle, personalised follow-up sequences.",
    channel: { type: "GMAIL" },
    conversations: [{ updatedAt: new Date(Date.now() - 86_400_000) }],
  },
];

export default function PreviewAgentsPage() {
  return (
    <AgentsView
      agents={mockAgents}
      tenantId="preview"
      userInitials="BF"
      userName="Behalfy Client"
    />
  );
}
