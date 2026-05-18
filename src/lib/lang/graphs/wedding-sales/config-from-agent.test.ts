import assert from "node:assert/strict";
import test from "node:test";

import { buildWeddingSalesConfigFromChannelConfig } from "./config-from-agent";

test("buildWeddingSalesConfigFromChannelConfig maps Myndful channel config into graph config", () => {
  const config = buildWeddingSalesConfigFromChannelConfig({
    signatureText: "Taras Mynd\nMYNDFUL",
    priceAttachmentFileId: "file-1",
    priceAttachmentFileName: "price.png",
    channelBehavior: {
      useRichFormatting: true,
      allowAttachments: true,
    },
    collectionsGuideTextBlock:
      "[Film One](https://galleries.vidflow.co/one)\n[Google Reviews](https://example.com/reviews)",
    functionBlocks: [
      {
        name: "Check wedding availability",
        steps: [
          {
            params: {
              capacityRules: [
                {
                  region: "NC/SC/GA",
                  aliases: ["NC", "Charlotte"],
                  capacity: 2,
                },
              ],
            },
          },
        ],
      },
      {
        name: "Check consultation calendar",
        steps: [
          {
            params: {
              timeZone: "America/New_York",
              businessDays: [1, 2, 3, 4, 5],
              businessWindowStartHour: 9,
              businessWindowEndHour: 14,
              slotDurationMinutes: 30,
            },
          },
        ],
      },
    ],
  });

  assert.equal(config.signature, "Taras Mynd\nMYNDFUL");
  assert.equal(config.guide.fileId, "file-1");
  assert.equal(config.guide.fileName, "price.png");
  assert.deepEqual(config.portfolio, [
    {
      label: "Film One",
      url: "https://galleries.vidflow.co/one",
    },
  ]);
  assert.deepEqual(config.reviews, {
    label: "Google Reviews",
    url: "https://example.com/reviews",
  });
  assert.deepEqual(config.coverage.regions, ["NC/SC/GA"]);
  assert.equal(config.coverage.capacityPerDate, 2);
  assert.equal(config.callBookingWindow.timezone, "America/New_York");
  assert.equal(config.channelFormatting.gmail.richLinks, true);
  assert.equal(config.channelFormatting.gmail.allowAttachments, true);
});
