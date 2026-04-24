import test from "node:test";
import assert from "node:assert/strict";

import {
  getTimezoneDisplayLabel,
  getTimezoneOptions,
  isValidTimezone,
} from "@/lib/timezones";

test("isValidTimezone accepts real IANA zones and rejects invalid ones", () => {
  assert.equal(isValidTimezone("UTC"), true);
  assert.equal(isValidTimezone("Asia/Almaty"), true);
  assert.equal(isValidTimezone("Mars/Phobos"), false);
});

test("getTimezoneDisplayLabel adds a GMT offset label", () => {
  const label = getTimezoneDisplayLabel("UTC", new Date("2026-01-01T00:00:00Z"));

  assert.match(label, /^UTC GMT[+-]\d+/);
});

test("getTimezoneOptions keeps selected and tenant timezones available", () => {
  const options = getTimezoneOptions({
    selectedTimezone: "Asia/Almaty",
    tenantTimezone: "Europe/Moscow",
    now: new Date("2026-01-01T00:00:00Z"),
  });

  assert.equal(options.some((option) => option.value === "Asia/Almaty"), true);
  assert.equal(options.some((option) => option.value === "Europe/Moscow"), true);
  assert.equal(options.some((option) => option.value === "UTC"), true);
});
