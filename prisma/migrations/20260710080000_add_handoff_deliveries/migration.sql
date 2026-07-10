DO $$ BEGIN
  ALTER TYPE "DelayedDeliveryKind" ADD VALUE 'HANDOFF';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
