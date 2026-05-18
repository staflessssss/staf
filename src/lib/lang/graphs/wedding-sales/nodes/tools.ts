import type { StructuredToolInterface } from "@langchain/core/tools";

import {
  bookConsultationTool,
  checkConsultationCalendarTool,
  checkWeddingAvailabilityTool,
  type WeddingSalesToolContext,
} from "@/lib/lang/tools/wedding-sales";

import type { WeddingSalesConfig } from "../config";
import type { WeddingSalesState } from "../state";

function parseToolJson(result: string) {
  try {
    const parsed = JSON.parse(result);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function getStepResults(toolResult: Record<string, unknown>) {
  return Array.isArray(toolResult.steps)
    ? toolResult.steps
        .map((step) => {
          if (!step || typeof step !== "object" || Array.isArray(step) || !("result" in step)) {
            return null;
          }

          const result = step.result;
          return result && typeof result === "object" && !Array.isArray(result)
            ? (result as Record<string, unknown>)
            : null;
        })
        .filter((result): result is Record<string, unknown> => Boolean(result))
    : [];
}

function getSummary(toolResult: Record<string, unknown>) {
  return typeof toolResult.summary === "string" ? toolResult.summary : "";
}

async function invokeTool(toolInstance: StructuredToolInterface, input: Record<string, unknown>) {
  const result = await toolInstance.invoke(input);
  return typeof result === "string" ? result : JSON.stringify(result);
}

function appendSignature(text: string, signature: string) {
  return signature ? `${text.trim()}\n\n${signature.trim()}` : text.trim();
}

function formatPortfolioLinks(config: WeddingSalesConfig) {
  return config.portfolio
    .map((item) => {
      if (!item.url) {
        return item.label;
      }

      return config.channelFormatting.gmail.richLinks
        ? `<a href="${item.url}">${item.label}</a>`
        : `${item.label}: ${item.url}`;
    })
    .join("\n");
}

export function createWeddingSalesToolNodes(args: {
  config: WeddingSalesConfig;
  toolContext?: WeddingSalesToolContext | null;
}) {
  const { config, toolContext } = args;

  return {
    checkAvailability: async (state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => {
      if (!toolContext || !state.weddingDate) {
        return {
          responseDraft: appendSignature(
            "I have enough details to check the wedding date, but the availability tool is not configured yet.",
            config.signature,
          ),
        };
      }

      if (config.coverage.unavailableDates?.includes(state.weddingDate)) {
        return {
          availability: "unavailable",
          leadStage: "availability_checked",
          responseDraft: appendSignature(
            "Thank you for sharing those details. I checked the date and it looks unavailable on my end. If you have flexibility, I can help look at alternative dates.",
            config.signature,
          ),
          toolObservations: [
            {
              toolName: "check_wedding_availability",
              result: JSON.stringify({
                status: "unavailable",
                date: state.weddingDate,
                summary: "Configured unavailable date.",
              }),
            },
          ],
        };
      }

      const result = await invokeTool(checkWeddingAvailabilityTool(toolContext), {
        request: state.latestCustomerMessage ?? `Check wedding availability for ${state.weddingDate}.`,
        date: state.weddingDate,
        weddingDate: state.weddingDate,
        coupleName: state.names,
        location: state.location,
        channel: state.channel,
      });
      const parsedResult = parseToolJson(result);
      const steps = getStepResults(parsedResult);
      const available = steps.some((step) => step.status === "available");
      const unavailable = steps.some((step) => step.status === "unavailable");
      const summary = getSummary(parsedResult);
      const links = formatPortfolioLinks(config);
      const guideText = config.guide.link
        ? `You can review the collections guide here: ${config.guide.link}`
        : "I am attaching the collections guide so you can review the details.";
      const reviewsText = config.reviews.url
        ? `${config.reviews.label}: ${config.reviews.url}`
        : config.reviews.label;

      if (unavailable && !available) {
        return {
          availability: "unavailable",
          leadStage: "availability_checked",
          responseDraft: appendSignature(
            `Thank you for sharing those details. I checked the date and it looks unavailable on my end. ${summary || "I can help look at another date if you have flexibility."}`,
            config.signature,
          ),
          toolObservations: [{ toolName: "check_wedding_availability", result }],
        };
      }

      return {
        availability: "available",
        guideSent: true,
        callProposed: true,
        leadStage: "availability_checked",
        responseDraft: appendSignature(
          [
            `Thank you for sharing those details. I checked ${state.weddingDate} and it looks available for Myndful.`,
            `Our collections start at ${config.pricing.startPrice}. ${guideText}`,
            links ? `Here are a few recent wedding films:\n${links}` : "",
            reviewsText ? `And here are reviews from couples: ${reviewsText}` : "",
            "Would you be open to a 30-minute consultation Monday through Friday between 9 AM and 2 PM Eastern?",
          ]
            .filter(Boolean)
            .join("\n\n"),
          config.signature,
        ),
        toolObservations: [{ toolName: "check_wedding_availability", result }],
      };
    },
    checkCalendar: async (state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => {
      if (!toolContext || !state.proposedCallTime) {
        return {
          responseDraft: state.calendarStatus === "busy"
            ? "That time was not available, so I cannot book it yet. Could you send another time Monday through Friday between 9 AM and 2 PM Eastern?"
            : "I can check that consultation time once the calendar tool and requested time are available.",
        };
      }

      const result = await invokeTool(checkConsultationCalendarTool(toolContext), {
        request: state.latestCustomerMessage ?? state.proposedCallTime,
        timeText: state.proposedCallTime,
        coupleName: state.names,
        weddingDate: state.weddingDate,
        location: state.location,
        channel: state.channel,
      });
      const parsedResult = parseToolJson(result);
      const steps = getStepResults(parsedResult);
      const available = steps.some((step) => step.status === "available");

      return {
        calendarStatus: available ? "available" : "busy",
        leadStage: available ? "call_proposed" : "checking_calendar",
        responseDraft: available
          ? "That consultation time looks available. Would you like me to book it?"
          : "That time does not look available on the calendar. Could you send another time Monday through Friday between 9 AM and 2 PM Eastern?",
        toolObservations: [{ toolName: "check_consultation_calendar", result }],
      };
    },
    bookCall: async (state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => {
      if (!toolContext || !state.proposedCallTime) {
        return {
          responseDraft: appendSignature(
            "I can book the consultation once I have the confirmed time and booking tool configured.",
            config.signature,
          ),
        };
      }

      const result = await invokeTool(bookConsultationTool(toolContext), {
        request: state.latestCustomerMessage ?? state.proposedCallTime,
        timeText: state.proposedCallTime,
        coupleName: state.names,
        weddingDate: state.weddingDate,
        location: state.location,
        channel: state.channel,
      });
      const parsedResult = parseToolJson(result);
      const steps = getStepResults(parsedResult);
      const bookedStep = steps.find((step) => step.status === "booked");
      const eventId = typeof bookedStep?.eventId === "string" ? bookedStep.eventId : undefined;

      return {
        bookingConfirmed: Boolean(eventId),
        bookedEventId: eventId,
        leadStage: eventId ? "booked" : "ready_to_book",
        responseDraft: eventId
          ? appendSignature("You are all set. The calendar invite has been created.", config.signature)
          : appendSignature(
              "I could not confirm the booking yet. I will need to retry the calendar booking step.",
              config.signature,
            ),
        toolObservations: [{ toolName: "book_consultation", result }],
      };
    },
  };
}
