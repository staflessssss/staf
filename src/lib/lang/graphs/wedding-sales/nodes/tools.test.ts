import assert from "node:assert/strict";
import test from "node:test";

import { weddingSalesToolNodeTestHelpers } from "./tools";

test("wedding sales tool node treats booked status as confirmed without event id", () => {
  assert.deepEqual(
    weddingSalesToolNodeTestHelpers.getBookingOutcome({
      status: "booked",
      eventId: null,
    }),
    {
      bookingConfirmed: true,
      eventId: undefined,
    },
  );
});

test("wedding sales tool node preserves booked event id when present", () => {
  assert.deepEqual(
    weddingSalesToolNodeTestHelpers.getBookingOutcome({
      steps: [
        {
          result: {
            status: "booked",
            eventId: "event-1",
          },
        },
      ],
    }),
    {
      bookingConfirmed: true,
      eventId: "event-1",
    },
  );
});
