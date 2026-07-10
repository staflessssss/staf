ALTER TABLE "AgentMonitorThread"
  ADD COLUMN "latestInboundSourceMessageId" TEXT,
  ADD COLUMN "latestInboundAt" TIMESTAMP(3),
  ADD COLUMN "responseAlertedAt" TIMESTAMP(3);
