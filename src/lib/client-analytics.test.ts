import assert from "node:assert/strict";
import test from "node:test";

import { clientAnalyticsTestHelpers } from "./client-analytics";

test("client analytics extracts lead details from booking tool results", () => {
  const details = clientAnalyticsTestHelpers.getLeadDetails(
    {
      toolName: "book_consultation",
      createdAt: new Date("2026-05-21T10:00:00Z"),
      toolResult: {
        status: "booked",
        mode: "live",
        date: "2026-05-25",
        time: "11:00",
        email: "anna@example.com",
        coupleName: "Anna and Mark",
        weddingDate: "2027-06-14",
        location: "Charlotte, NC",
        eventId: "event-1",
      },
    },
    "anna@example.com",
  );

  assert.equal(details.action, "Consultation booked");
  assert.equal(details.status, "Booked");
  assert.equal(details.coupleName, "Anna and Mark");
  assert.equal(details.weddingDate, "2027-06-14");
  assert.equal(details.callDate, "2026-05-25");
  assert.equal(details.callTime, "11:00");
  assert.equal(details.eventId, "event-1");
});

test("client analytics extracts capacity details from availability tool results", () => {
  const details = clientAnalyticsTestHelpers.getLeadDetails(
    {
      toolName: "check_wedding_availability",
      createdAt: new Date("2026-05-21T10:00:00Z"),
      toolResult: {
        status: "available",
        requestedDate: "2027-06-14",
        requestedRegion: "NC",
        bookedCount: 0,
        capacity: 2,
      },
    },
    "lead@example.com",
  );

  assert.equal(details.action, "Availability checked");
  assert.equal(details.status, "Available");
  assert.equal(details.weddingDate, "2027-06-14");
  assert.equal(details.location, "NC");
  assert.equal(details.bookedCount, 0);
  assert.equal(details.capacity, 2);
});

test("client analytics builds generic captured fields from direct and step tool results", () => {
  const fields = clientAnalyticsTestHelpers.getCapturedLeadFields({
    toolName: "custom_lead_capture",
    createdAt: new Date("2026-05-21T10:00:00Z"),
    toolResult: {
      status: "qualified",
      companyName: "Acme Studio",
      budget: 7500,
      steps: [
        {
          result: {
            preferredService: "Video production",
            summary: "Captured lead details",
          },
        },
      ],
    },
  });

  assert.deepEqual(fields, [
    { label: "Company Name", value: "Acme Studio" },
    { label: "Budget", value: "7500" },
    { label: "Preferred Service", value: "Video production" },
  ]);
});

test("client analytics hides executor internals from captured lead fields", () => {
  const fields = clientAnalyticsTestHelpers.getCapturedLeadFields({
    toolName: "check_wedding_availability",
    createdAt: new Date("2026-05-21T10:00:00Z"),
    toolResult: {
      integration: "GOOGLE_SHEETS",
      message: "11:00 on 2026-05-25 is available.",
      reason: "NC/SC/GA has 0/2 booked slot(s) used.",
      region: "NC/SC/GA",
      result: "2027-06-14 is AVAILABLE in NC/SC/GA",
      capacity: 2,
      available: true,
      operation: "capacity_availability",
      sheetName: "Bookings",
      bookedCount: 0,
      requestedDate: "2027-06-14",
      spreadsheetId: "sheet-1",
      requestedRegion: "NC/SC/GA",
      spreadsheetTitle: "Bookings",
      status: "available",
    },
  });

  assert.deepEqual(fields, [{ label: "Wedding Date", value: "2027-06-14" }]);
});
