DO $$ BEGIN
  CREATE TYPE "AgentEventType" AS ENUM (
    'CONVERSATION_STARTED',
    'INBOUND_RECEIVED',
    'REPLY_SENT',
    'AVAILABILITY_CHECKED',
    'PRICING_GUIDE_SENT',
    'LEAD_QUALIFIED',
    'CONSULTATION_CHECKED',
    'CONSULTATION_BOOKED',
    'HANDOFF_REQUESTED',
    'HANDOFF_RESOLVED',
    'FOLLOW_UP_SENT',
    'DELIVERY_FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentEventStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentEventSource" AS ENUM ('LIVE', 'TEST', 'BACKFILL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AgentEvent" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "conversationId" TEXT,
  "channel" "ChannelType" NOT NULL,
  "type" "AgentEventType" NOT NULL,
  "status" "AgentEventStatus" NOT NULL DEFAULT 'SUCCEEDED',
  "source" "AgentEventSource" NOT NULL DEFAULT 'LIVE',
  "dedupeKey" TEXT,
  "durationMs" INTEGER,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentEvent_dedupeKey_key" ON "AgentEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "AgentEvent_agentId_occurredAt_idx" ON "AgentEvent"("agentId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AgentEvent_conversationId_occurredAt_idx" ON "AgentEvent"("conversationId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AgentEvent_type_status_occurredAt_idx" ON "AgentEvent"("type", "status", "occurredAt");

DO $$ BEGIN
  ALTER TABLE "AgentEvent"
  ADD CONSTRAINT "AgentEvent_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AgentEvent"
  ADD CONSTRAINT "AgentEvent_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
