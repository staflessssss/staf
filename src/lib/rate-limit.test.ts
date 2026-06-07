import assert from "node:assert/strict";
import test from "node:test";

import { getRequestIp, rateLimitResponse } from "@/lib/rate-limit";

test("getRequestIp prefers the first forwarded address", () => {
  const request = new Request("https://example.com", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "198.51.100.20",
    },
  });

  assert.equal(getRequestIp(request), "203.0.113.10");
});

test("rateLimitResponse returns retry metadata", async () => {
  const response = rateLimitResponse({
    allowed: false,
    limit: 10,
    remaining: 0,
    retryAfterSeconds: 42,
  });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "42");
  assert.deepEqual(await response.json(), {
    error: "Too many requests. Try again later.",
  });
});
