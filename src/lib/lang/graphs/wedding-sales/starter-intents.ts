const instagramCtaStarterPattern =
  /^\s*(?:get in touch|inquire|start inquiry|start|i(?:'|’)?m interested)\s*[.!?]*\s*$/i;

export function isInstagramCtaStarter(message?: string | null) {
  return Boolean(message && instagramCtaStarterPattern.test(message));
}

export function hasAssistantReplyInConversationContext(conversationContext?: string) {
  return Boolean(conversationContext?.split(/\r?\n/).some((line) => line.trim().toLowerCase().startsWith("assistant:")));
}
