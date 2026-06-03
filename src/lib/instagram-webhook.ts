export function splitInstagramMessagingPayloads(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [payload];
  }

  const entries = "entry" in payload && Array.isArray(payload.entry) ? payload.entry : [];
  const payloads: unknown[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const messaging = "messaging" in entry && Array.isArray(entry.messaging) ? entry.messaging : [];

    for (const event of messaging) {
      payloads.push({
        ...payload,
        entry: [
          {
            ...entry,
            messaging: [event],
          },
        ],
      });
    }
  }

  return payloads.length > 0 ? payloads : [payload];
}
