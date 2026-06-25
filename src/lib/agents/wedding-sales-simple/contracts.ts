import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesMode,
  SimpleWeddingSalesState,
} from "@/lib/lang/graphs/wedding-sales-simple/state";
import type { ReplyActionContract } from "@/lib/lang/graphs/wedding-sales-simple/reply-contract";
import type { ReplyGuardResult } from "@/lib/lang/graphs/wedding-sales-simple/reply-guards";
import type { ChannelDeliveryPlan } from "./delivery-plan";

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
  attachments?: Array<{
    type: "image" | "link";
    url: string;
    label?: string;
    purpose: "pricing_guide" | "portfolio" | "reviews";
  }>;
  handoffMode: SimpleWeddingSalesMode;
  decisionTrace: SimpleWeddingSalesDecisionTrace;
  channelDeliveryPlan?: ChannelDeliveryPlan;
};

export type WeddingSalesSimpleSafetyLogEntry = {
  inboundText: string;
  outboundText: string;
  decisionTrace?: SimpleWeddingSalesDecisionTrace;
  replyContract?: ReplyActionContract;
  guardResult?: ReplyGuardResult;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
  channelDeliveryPlan?: ChannelDeliveryPlan;
  knowledgeSummary?: {
    hasPricing: boolean;
    startPrice?: string;
    hasGuideImage: boolean;
    hasGuideLink: boolean;
    personaName?: string;
  };
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
