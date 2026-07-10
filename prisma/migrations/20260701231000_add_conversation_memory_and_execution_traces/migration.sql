CREATE TABLE IF NOT EXISTS "ConversationMemory" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "memory" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConversationMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExecutionTrace" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "channel" "ChannelType" NOT NULL,
  "inboundMessage" TEXT NOT NULL,
  "memoryBefore" JSONB,
  "promptPreview" TEXT,
  "toolCalls" JSONB,
  "toolResults" JSONB,
  "modelRawText" TEXT,
  "finalMessage" TEXT,
  "attachments" JSONB,
  "delivery" JSONB,
  "memoryUpdate" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExecutionTrace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationMemory_conversationId_key"
ON "ConversationMemory"("conversationId");

CREATE INDEX IF NOT EXISTS "ExecutionTrace_conversationId_createdAt_idx"
ON "ExecutionTrace"("conversationId", "createdAt");

CREATE INDEX IF NOT EXISTS "ExecutionTrace_agentId_createdAt_idx"
ON "ExecutionTrace"("agentId", "createdAt");

ALTER TABLE "ConversationMemory"
ADD CONSTRAINT "ConversationMemory_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExecutionTrace"
ADD CONSTRAINT "ExecutionTrace_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
