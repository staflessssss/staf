ALTER TABLE "Conversation"
ADD COLUMN IF NOT EXISTS "automationScope" TEXT NOT NULL DEFAULT 'UNCLASSIFIED';

CREATE INDEX IF NOT EXISTS "Conversation_agentId_automationScope_idx"
ON "Conversation"("agentId", "automationScope");
