CREATE TABLE "AgentMonitorThread" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "latestInboundMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMonitorThread_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentMonitorThread_conversationId_key" ON "AgentMonitorThread"("conversationId");

ALTER TABLE "AgentMonitorThread"
ADD CONSTRAINT "AgentMonitorThread_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
