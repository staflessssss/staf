CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
ON "Message"("conversationId", "createdAt");
