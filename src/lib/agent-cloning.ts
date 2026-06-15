import { IntegrationType, Prisma } from "@prisma/client";

const deploymentConfigKeys = new Set([
  "channelType",
  "gmailWatch",
  "inboundMode",
  "outboundMode",
  "pubsubWebhookPath",
  "pubsubWebhookUrl",
  "webhookAuthHeaderName",
  "webhookPath",
  "webhookRegistration",
  "webhookUrl",
]);

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T;
}

function applyResourceOverrides(
  value: unknown,
  resourceOverrides: {
    spreadsheetId?: string;
    calendarId?: string;
  },
) {
  const wasString = typeof value === "string";
  let parsed: unknown = value;

  if (wasString) {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value;
    }
  }

  const params = asObject(parsed);
  delete params.ownerTelegramChatId;

  if (resourceOverrides.spreadsheetId) {
    if (typeof params.spreadsheetId === "string") {
      params.spreadsheetId = resourceOverrides.spreadsheetId;
    }
    if (typeof params.leadSpreadsheetId === "string") {
      params.leadSpreadsheetId = resourceOverrides.spreadsheetId;
    }
  }
  if (resourceOverrides.calendarId && typeof params.calendarId === "string") {
    params.calendarId = resourceOverrides.calendarId;
  }

  return wasString ? JSON.stringify(params) : params;
}

export type IntegrationReference = {
  id: string;
  type: IntegrationType;
};

export type ExternalResourceReference = {
  path: string;
  value: string;
};

export function getExternalResourceReferences(value: unknown) {
  const references: ExternalResourceReference[] = [];

  function visit(current: unknown, path: string) {
    if (typeof current === "string") {
      try {
        visit(JSON.parse(current), path);
      } catch {
        // Ordinary strings are not nested configuration.
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }

    if (!current || typeof current !== "object") {
      return;
    }

    for (const [key, entry] of Object.entries(current)) {
      const entryPath = path ? `${path}.${key}` : key;
      const isResourceField =
        /(?:spreadsheet|calendar|file|folder|attachment).*(?:id|url)$/i.test(key) ||
        /(?:public|image|webView|webContent)Url$/i.test(key);

      if (isResourceField && typeof entry === "string" && entry.trim()) {
        references.push({ path: entryPath, value: entry });
      }

      visit(entry, entryPath);
    }
  }

  visit(value, "");
  return references;
}

export function buildIntegrationIdMap(args: {
  source: IntegrationReference[];
  target: IntegrationReference[];
  referencedIds: string[];
}) {
  const sourceById = new Map(args.source.map((integration) => [integration.id, integration]));
  const targetByType = new Map(args.target.map((integration) => [integration.type, integration]));
  const mapping = new Map<string, string>();

  for (const sourceId of new Set(args.referencedIds)) {
    const sourceIntegration = sourceById.get(sourceId);
    if (!sourceIntegration) {
      throw new Error(`Source integration ${sourceId} was not found.`);
    }

    const targetIntegration = targetByType.get(sourceIntegration.type);
    if (!targetIntegration) {
      throw new Error(
        `Target tenant needs a connected ${sourceIntegration.type} integration before cloning.`,
      );
    }

    mapping.set(sourceId, targetIntegration.id);
  }

  return mapping;
}

export function getReferencedIntegrationIds(channelConfig: unknown) {
  const config = asObject(channelConfig);
  const integrations = asObject(config.integrations);
  const enabledIds = Array.isArray(integrations.enabledIds)
    ? integrations.enabledIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const functionBlocks = Array.isArray(config.functionBlocks) ? config.functionBlocks : [];
  const stepIds = functionBlocks.flatMap((block) => {
    const steps = Array.isArray(asObject(block).steps) ? asObject(block).steps as unknown[] : [];
    return steps
      .map((step) => asObject(step).integrationId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  });

  return Array.from(new Set([...enabledIds, ...stepIds]));
}

export function prepareClonedChannelConfig(
  channelConfig: unknown,
  integrationIdMap: Map<string, string>,
  resourceOverrides: {
    spreadsheetId?: string;
    calendarId?: string;
    priceAttachmentFileId?: string;
  } = {},
): Prisma.InputJsonObject {
  const config = cloneJson(asObject(channelConfig));

  for (const key of deploymentConfigKeys) {
    delete config[key];
  }

  const integrations = asObject(config.integrations);
  if (Array.isArray(integrations.enabledIds)) {
    integrations.enabledIds = integrations.enabledIds.map((id) => {
      if (typeof id !== "string") {
        return id;
      }

      const mappedId = integrationIdMap.get(id);
      if (!mappedId) {
        throw new Error(`No target integration mapping exists for ${id}.`);
      }

      return mappedId;
    });
    config.integrations = integrations;
  }

  if (Array.isArray(config.functionBlocks)) {
    config.functionBlocks = config.functionBlocks.map((block) => {
      const nextBlock = asObject(block);
      if (!Array.isArray(nextBlock.steps)) {
        return nextBlock;
      }

      nextBlock.steps = nextBlock.steps.map((step) => {
        const nextStep = asObject(step);
        if ("params" in nextStep) {
          nextStep.params = applyResourceOverrides(nextStep.params, resourceOverrides);
        }

        const sourceId = nextStep.integrationId;
        if (typeof sourceId !== "string") {
          return nextStep;
        }

        const mappedId = integrationIdMap.get(sourceId);
        if (!mappedId) {
          throw new Error(`No target integration mapping exists for ${sourceId}.`);
        }

        nextStep.integrationId = mappedId;
        return nextStep;
      });
      return nextBlock;
    });
  }

  if (resourceOverrides.priceAttachmentFileId && typeof config.priceAttachmentFileId === "string") {
    config.priceAttachmentFileId = resourceOverrides.priceAttachmentFileId;
  }

  return config as Prisma.InputJsonObject;
}
