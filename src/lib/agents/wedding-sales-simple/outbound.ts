import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";

import type {
  NormalizedWeddingSalesIncomingMessage,
  NormalizedWeddingSalesOutboundMessage,
} from "./contracts";

export function buildWeddingSalesSimpleOutbound(args: {
  incoming: NormalizedWeddingSalesIncomingMessage;
  state: SimpleWeddingSalesState;
  attachments?: NormalizedWeddingSalesOutboundMessage["attachments"];
}): NormalizedWeddingSalesOutboundMessage {
  if (!args.state.decisionTrace) {
    throw new Error("Cannot build wedding-sales-simple outbound without decisionTrace.");
  }

  return {
    channel: args.incoming.channel,
    conversationId: args.incoming.conversationId,
    text: args.state.responseDraft ?? "",
    attachments: args.attachments,
    handoffMode: args.state.mode,
    decisionTrace: args.state.decisionTrace,
  };
}
