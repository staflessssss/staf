import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";

import type {
  NormalizedWeddingSalesIncomingMessage,
  NormalizedWeddingSalesOutboundMessage,
} from "./contracts";
import { buildChannelDeliveryPlan } from "./delivery-plan";

export function buildWeddingSalesSimpleOutbound(args: {
  incoming: NormalizedWeddingSalesIncomingMessage;
  state: SimpleWeddingSalesState;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
  channelConfig?: unknown;
}): NormalizedWeddingSalesOutboundMessage {
  if (!args.state.decisionTrace) {
    throw new Error("Cannot build wedding-sales-simple outbound without decisionTrace.");
  }

  if (!args.state.replyContract) {
    throw new Error("Cannot build wedding-sales-simple outbound without replyContract.");
  }

  const text = args.state.responseDraft ?? "";
  const channelDeliveryPlan = buildChannelDeliveryPlan({
    channel: args.incoming.channel,
    outboundText: text,
    replyContract: args.state.replyContract,
    attachments: args.attachments,
    conversationId: args.incoming.conversationId,
    turnId: args.state.replyMemory?.turnIndex ? `turn-${args.state.replyMemory.turnIndex}` : "turn-1",
    channelConfig: args.channelConfig,
  });

  return {
    channel: args.incoming.channel,
    conversationId: args.incoming.conversationId,
    text,
    attachments: args.attachments,
    handoffMode: args.state.mode,
    decisionTrace: args.state.decisionTrace,
    channelDeliveryPlan,
  };
}
