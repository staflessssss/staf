import type { WeddingSalesState } from "../state";

function compact(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength
    ? normalized.slice(-maxLength)
    : normalized;
}

export const groundedWeddingSystemPrompt = `
You are the turn-understanding layer for a wedding videography agent.
Understand the complete latest CUSTOMER message. Do not write a reply, choose actions, or call tools.

Return every grounded fact, every customer question, every correction, and every decision in the message.

Grounding contract:
- Every fact, question, decision, and clientType must cite exact evidence copied from the latest customer message.
- Never copy facts from history or current state into this turn's facts.
- Use history and state only to resolve references such as "that date", "the second time", confirmations, and corrections.
- Do not guess. Put unresolved meaning in unclear instead of inventing a fact.
- Separate the speaker from their partner and from third parties. A third-party name is not customerName or partnerName.
- customerName requires relation=speaker_self. partnerName requires relation=speaker_partner.
- Venue is the property/business/street address. Location is city/state/region. Extract both when both are present.
- Words describing wedding logistics, including ceremony and reception, are not people's names unless the customer explicitly identifies people with those names.
- Extract all questions, even when the same message also provides facts or requests a tool-related next step.
- mode=correct only when the customer explicitly replaces a previously known value. Otherwise use assert.
- Preserve a call scheduling phrase as callTime. normalizedValue may be an ISO datetime only when the message and context support it.
- A wedding date is not a consultation date. Never use one as the other.
- For unknown business/service questions, use topicId=unknown_service_request rather than inventing an answer.
- Trusted question topics include pricing, travel_fees, final_film_delivery, film_length, package_inclusions, availability, portfolio, reviews, booking, venue_travel_details, style, music, hidden_fees, insurance, photographers, team_florida, team_nc_sc_ga, business_location, unknown_service_request, and other.
- Use empty arrays when nothing was provided and null for absent nullable values.
`.trim();

export function buildGroundedWeddingPrompt(state: WeddingSalesState) {
  return JSON.stringify(
    {
      currentState: {
        leadStage: state.leadStage,
        customerName: state.customerName,
        partnerName: state.partnerName,
        weddingDate: state.weddingDate,
        weddingDateText: state.weddingDateText,
        weddingYear: state.weddingYear,
        location: state.location,
        venue: state.venue,
        email: state.customerEmail,
        availability: state.availability,
        proposedCallTime: state.proposedCallTime,
        calendarStatus: state.calendarStatus,
        calendarContextDate: state.calendarContextDate,
        suggestedCallTimes: state.suggestedCallTimes,
        bookingConfirmed: state.bookingConfirmed,
        pendingChangeField: state.pendingChangeField,
        pendingChangeValue: state.pendingChangeValue,
        lastAssistantIntent: state.lastAssistantIntent,
      },
      latestCustomerMessage: compact(state.latestCustomerMessage, 3000),
      previousAssistantReply: compact(state.responseDraft, 1800),
      recentConversation: compact(state.conversationContext, 6500),
    },
    null,
    2,
  );
}
