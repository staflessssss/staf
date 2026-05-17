import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let cachedPostgresSaver: PostgresSaver | null = null;
let setupPromise: Promise<void> | null = null;

export function buildLangGraphThreadId(args: {
  tenantId: string;
  agentId: string;
  contactId: string;
}) {
  return [args.tenantId, args.agentId, args.contactId].join(":");
}

function getLangGraphPostgresUrl() {
  return process.env.LANGGRAPH_POSTGRES_URL || process.env.DATABASE_URL || null;
}

export async function getLangGraphPostgresSaver() {
  const connectionString = getLangGraphPostgresUrl();

  if (!connectionString) {
    return null;
  }

  if (!cachedPostgresSaver) {
    cachedPostgresSaver = PostgresSaver.fromConnString(connectionString);
  }

  setupPromise ??= cachedPostgresSaver.setup();
  await setupPromise;

  return cachedPostgresSaver;
}
