import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesMode,
  SimpleWeddingSalesState,
} from "@/lib/lang/graphs/wedding-sales-simple/state";

export type WeddingSalesSimpleRuntime = "legacy" | "wedding-sales-simple";

export type NormalizedWeddingSalesIncomingMessage = {
  channel: "instagram" | "gmail";
  tenantId: string;
  agentId: string;
  contactId: string;
  conversationId: string;
  text: string;
  incomingMessageId?: string;
  senderName?: string;
  senderEmail?: string;
  receivedAt: string;
};

export type NormalizedWeddingSalesOutboundMessage = {
  channel: "instagram" | "gmail";
  conversationId: string;
  text: string;
  handoffMode: SimpleWeddingSalesMode;
  decisionTrace: SimpleWeddingSalesDecisionTrace;
};

export type WeddingSalesSimpleSafetyLogEntry = {
  inboundText: string;
  outboundText: string;
  decisionTrace?: SimpleWeddingSalesDecisionTrace;
  toolCalls: string[];
  previousState?: Partial<SimpleWeddingSalesState>;
  nextState: SimpleWeddingSalesState;
  runtime: "wedding-sales-simple";
};

export type WeddingSalesSimpleCanaryTarget = {
  tenantId: string;
  agentId: string;
  channel: "instagram" | "gmail";
};
