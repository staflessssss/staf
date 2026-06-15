import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultWeddingSalesConfig,
  selectWeddingSalesGuide,
  selectWeddingSalesPricing,
} from "./config";

test("pricing prefers committed availability region over location text", () => {
  const pricing = selectWeddingSalesPricing(defaultWeddingSalesConfig, {
    location: "Fort Lauderdale, FL",
    venue: "A venue that mentions Charlotte in notes",
    availabilityRegion: "FL",
  });

  assert.equal(pricing.startPrice, "$2,950");
  assert.equal(pricing.coverageHours, 8);
});

test("guide attachment prefers committed availability region", () => {
  const guide = selectWeddingSalesGuide(
    {
      ...defaultWeddingSalesConfig,
      guide: {
        fileId: "default-guide",
        fileName: "default.png",
      },
      guidesByRegion: {
        FL: {
          fileId: "fl-guide",
          fileName: "fl.png",
        },
        NC_SC_GA: {
          fileId: "nc-guide",
          fileName: "nc.png",
        },
      },
    },
    {
      location: "Charlotte, NC",
      availabilityRegion: "FL",
    },
  );

  assert.equal(guide.fileId, "fl-guide");
  assert.equal(guide.fileName, "fl.png");
});
