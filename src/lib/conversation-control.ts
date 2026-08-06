export function isConversationManualOnly(
  conversation: { manualOnly?: boolean | null } | null | undefined,
) {
  return conversation?.manualOnly === true;
}
