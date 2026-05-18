import { MessageRole } from "@prisma/client";

import { invokeAgent, type RuntimeHistoryMessage } from "@/lib/ai-runtime";
import { invokeWeddingSalesGraph } from "@/lib/lang/graphs/wedding-sales/graph";
import {
  evaluateWeddingSalesCase,
  weddingSalesStressCases,
  type WeddingSalesEvalResult,
  type WeddingSalesEvalRuntime,
} from "@/lib/lang/graphs/wedding-sales/evals/stress-cases";
import type { WeddingSalesToolContext } from "@/lib/lang/tools/wedding-sales";

function readRuntime(): WeddingSalesEvalRuntime {
  const runtime = process.env.WEDDING_SALES_EVAL_RUNTIME;

  if (runtime === "langgraph_wedding_sales") {
    return runtime;
  }

  return "legacy";
}

function mapHistory(history: NonNullable<(typeof weddingSalesStressCases)[number]["input"]["history"]>): RuntimeHistoryMessage[] {
  return history.map((entry) => ({
    role: entry.role === "ASSISTANT" ? MessageRole.ASSISTANT : MessageRole.USER,
    content: entry.content,
  }));
}

async function runLegacyCase(args: {
  tenantId: string;
  agentId: string;
  testCase: (typeof weddingSalesStressCases)[number];
}) {
  return invokeAgent({
    tenantId: args.tenantId,
    agentId: args.agentId,
    allowDraftAgent: true,
    testMode: true,
    channel: "GMAIL",
    contactId: args.testCase.input.contactId,
    contactEmail: args.testCase.input.contactId,
    message: args.testCase.input.message,
    historyMessages: mapHistory(args.testCase.input.history ?? []),
  });
}

function getLangGraphFixtureToolContext(): WeddingSalesToolContext {
  return {
    tenantId: "eval-tenant",
    testMode: true,
    defaultEmail: "eval@example.com",
    weddingAvailability: {
      action: "capacity availability",
      params: {
        operation: "capacity_availability",
        spreadsheetId: "eval-sheet",
        sheetName: "Bookings",
        headerRow: 1,
        dateColumn: "Wedding Date",
        statusColumn: "Status",
        regionColumn: "Region",
        bookedStatusValue: "Booked",
        capacityRules: [
          { region: "NC", aliases: ["NC", "Charlotte"], capacity: 2 },
          { region: "SC", aliases: ["SC", "Charleston"], capacity: 2 },
          { region: "GA", aliases: ["GA", "Atlanta"], capacity: 2 },
        ],
        suggestionSearchDays: 14,
      },
    },
    consultationCalendar: {
      action: "check calendar",
      params: {
        calendarId: "primary",
        timeZone: "America/New_York",
        availabilityDateSource: "time_text",
        availabilityDateValue: "",
        bookingDateSource: "time_text",
        bookingDateValue: "",
        bookingTimeSource: "time_text",
        bookingTimeValue: "",
        inviteEmailSource: "default_email",
        inviteEmailValue: "",
        slotDurationMinutes: 30,
        businessWindowStartHour: 9,
        businessWindowEndHour: 14,
        businessDays: [1, 2, 3, 4, 5],
        checkConflictsBeforeBooking: true,
        inviteCustomerByEmail: true,
        createMeetLink: true,
        reminderEnabled: false,
        reminderMinutesBefore: 60,
        eventSummaryTemplate: "Consultation with {{coupleName}}",
        eventDescriptionTemplate: "Wedding date: {{weddingDate}}\nLocation: {{location}}",
        syncLeadToSheets: false,
        leadHeaderRow: 1,
        leadColumns: {
          coupleName: "Couple Name",
          weddingDate: "Wedding Date",
          location: "Location",
          callDate: "Call Date",
          callTime: "Call Time",
          email: "Email",
          channel: "Channel",
        },
      },
    },
    bookConsultation: {
      action: "book call",
      params: {
        calendarId: "primary",
        timeZone: "America/New_York",
        availabilityDateSource: "time_text",
        availabilityDateValue: "",
        bookingDateSource: "time_text",
        bookingDateValue: "",
        bookingTimeSource: "time_text",
        bookingTimeValue: "",
        inviteEmailSource: "default_email",
        inviteEmailValue: "",
        slotDurationMinutes: 30,
        businessWindowStartHour: 9,
        businessWindowEndHour: 14,
        businessDays: [1, 2, 3, 4, 5],
        checkConflictsBeforeBooking: true,
        inviteCustomerByEmail: true,
        createMeetLink: true,
        reminderEnabled: false,
        reminderMinutesBefore: 60,
        eventSummaryTemplate: "Consultation with {{coupleName}}",
        eventDescriptionTemplate: "Wedding date: {{weddingDate}}\nLocation: {{location}}",
        syncLeadToSheets: false,
        leadHeaderRow: 1,
        leadColumns: {
          coupleName: "Couple Name",
          weddingDate: "Wedding Date",
          location: "Location",
          callDate: "Call Date",
          callTime: "Call Time",
          email: "Email",
          channel: "Channel",
        },
      },
    },
  };
}

function buildPreviousState(testCase: (typeof weddingSalesStressCases)[number]) {
  const historyText = (testCase.input.history ?? []).map((entry) => entry.content).join("\n");

  if (!historyText) {
    return undefined;
  }

  return {
    names: /Anna and Mark/i.test(historyText) ? "Anna and Mark" : undefined,
    weddingDate: /June 14,\s*2027/i.test(historyText) ? "2027-06-14" : undefined,
    weddingYearKnown: /(?:19|20)\d{2}/.test(historyText),
    location: /Charlotte/i.test(historyText) ? "Charlotte" : undefined,
    guideSent: /collections|guide/i.test(historyText),
    callProposed: /consultation|call/i.test(historyText),
    proposedCallTime: /Monday at 10 AM Eastern/i.test(historyText)
      ? "Monday at 10 AM Eastern"
      : undefined,
    calendarStatus: /looks available/i.test(historyText) ? ("available" as const) : undefined,
    bookingConfirmed: false,
  };
}

async function runLangGraphCase(testCase: (typeof weddingSalesStressCases)[number]) {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: testCase.input.message,
    previousState: buildPreviousState(testCase),
    config: {
      coverage: {
        regions: ["NC", "SC", "GA"],
        capacityPerDate: 2,
        unavailableDates: ["2026-09-06"],
      },
    },
    toolContext: getLangGraphFixtureToolContext(),
  });

  return {
    message: result.responseDraft ?? "",
    usedTooling: result.toolObservations.map((observation) => observation.toolName),
  };
}

async function main() {
  const tenantId = process.env.WEDDING_SALES_EVAL_TENANT_ID;
  const agentId = process.env.WEDDING_SALES_EVAL_AGENT_ID;
  const runtime = readRuntime();

  if (runtime === "legacy" && (!tenantId || !agentId)) {
    console.log(
      "Skipping wedding_sales evals: set WEDDING_SALES_EVAL_TENANT_ID and WEDDING_SALES_EVAL_AGENT_ID to run against a local agent.",
    );
    return;
  }

  const results: WeddingSalesEvalResult[] = [];

  for (const testCase of weddingSalesStressCases) {
    const result =
      runtime === "langgraph_wedding_sales"
        ? await runLangGraphCase(testCase)
        : await runLegacyCase({ tenantId: tenantId!, agentId: agentId!, testCase });
    results.push(
      evaluateWeddingSalesCase({
        testCase,
        runtime,
        response: result.message,
        usedTooling: result.usedTooling,
      }),
    );
  }

  const failed = results.filter((result) => !result.passed && !result.skipped);

  console.table(
    results.map((result) => ({
      case: result.caseId,
      runtime: result.runtime,
      status: result.skipped ? "skipped" : result.passed ? "pass" : "fail",
      failures: result.failures.join(" | "),
    })),
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
