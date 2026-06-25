import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesMode,
  SimpleWeddingSalesState,
} from "@/lib/lang/graphs/wedding-sales-simple/state";
import type { ReplyActionContract } from "@/lib/lang/graphs/wedding-sales-simple/reply-contract";
import type { ReplyGuardResult } from "@/lib/lang/graphs/wedding-sales-simple/reply-guards";
import type { ChannelDeliveryPlan, DeliveryPlanGuardResult } from "./delivery-plan";

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

export type WeddingSalesSimpleDeliveryExecution =
  | {
      enabled: false;
      executed: false;
      reason:
        | "feature_flag_off"
        | "not_instagram"
        | "not_semantic_split"
        | "kill_switch"
        | "missing_plan";
    }
  | {
      enabled: true;
      executed: true;
      partsAttempted: number;
      partsSent: number;
      senderActionsAttempted: number;
      senderActionsFailed: number;
      fallbackToCanonical: false;
      pacing: "fast" | "human" | "slow";
      plannedTotalDelayMs: number;
      appliedTotalDelayMs: number;
      maxTotalDelayMs: number;
      startedAt: string;
      finishedAt: string;
      actualTotalMs: number;
      parts: Array<
        | {
            kind: "sender_action";
            action: "mark_seen" | "typing_on" | "typing_off";
            reason: string;
            plannedDelayMs: number;
            effectiveDelayMs: number;
            sentAtMs: number;
          }
        | {
            kind: "text";
            reason: string;
            plannedDelayMs: number;
            effectiveDelayMs: number;
            plannedTypingMs: number;
            effectiveTypingMs: number;
            sentAtMs: number;
          }
        | {
            kind: "attachment";
            reason: string;
            plannedDelayMs: number;
            effectiveDelayMs: number;
            sentAtMs: number;
          }
      >;
      warnings?: string[];
    };

export type WeddingSalesSimpleSafetyLogEntry = {
  inboundText: string;
  outboundText: string;
  decisionTrace?: SimpleWeddingSalesDecisionTrace;
  replyContract?: ReplyActionContract;
  guardResult?: ReplyGuardResult;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
  channelDeliveryPlan?: ChannelDeliveryPlan;
  deliveryPlanGuard?: DeliveryPlanGuardResult;
  deliveryExecution?: WeddingSalesSimpleDeliveryExecution;
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
