// Conversation status is the single source of truth for human handoff.
// These hooks retain the handoff lifecycle boundary without a second agent-state runtime.
export async function recordConversationHandoffPause(_args: unknown) {
  void _args;
}

export async function recordConversationOwnerReply(_args: unknown) {
  void _args;
}

export async function recordConversationHandoffResume(_args: unknown) {
  void _args;
}
