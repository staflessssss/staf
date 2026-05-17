import { traceable } from "langsmith/traceable";

export type LangRuntimeType = "legacy" | "langgraph_wedding_sales";

export type LangRuntimeTraceMetadata = {
  tenantId?: string;
  agentId?: string;
  contactId?: string;
  channel?: string;
  testMode?: boolean;
  runtimeType?: LangRuntimeType;
  [key: string]: unknown;
};

function isLangSmithEnabled() {
  return Boolean(process.env.LANGSMITH_API_KEY);
}

function cleanMetadata(metadata: LangRuntimeTraceMetadata = {}) {
  return Object.entries(metadata).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }

    return acc;
  }, {});
}

export async function traceLangRuntime<T>(
  name: string,
  metadata: LangRuntimeTraceMetadata,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isLangSmithEnabled()) {
    return fn();
  }

  const traced = traceable(fn, {
    name,
    metadata: cleanMetadata(metadata),
    tags: [
      "stafless",
      String(metadata.runtimeType ?? "legacy"),
      ...(metadata.channel ? [String(metadata.channel).toLowerCase()] : []),
      ...(metadata.testMode ? ["test-mode"] : []),
    ],
  });

  return traced();
}
