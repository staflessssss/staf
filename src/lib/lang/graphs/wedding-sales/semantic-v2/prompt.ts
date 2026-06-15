import type { WeddingSalesState } from "../state";

const SEMANTIC_FIELD_CONTRACT = {
  customerName: "Name of the person currently speaking with the agent.",
  partnerName: "Name of the speaker's fiance or wedding partner.",
  names: "Legacy-compatible couple display name. Never use it instead of providedInfo name roles.",
  weddingDate: "Exact wedding date. normalizedValue must be ISO YYYY-MM-DD when the year is known.",
  weddingYear: "Wedding year when the customer provided a year without a complete date.",
  location: "Wedding city, state, region, or general geographic location.",
  venue: "Wedding venue business name or street address.",
  email: "Customer email address.",
  callTime: "Customer's proposed consultation time, preserving the customer's exact wording in value.",
} as const;

function compact(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > maxLength ? normalized.slice(-maxLength) : normalized;
}

export const semanticV2SystemPrompt = `
You are the semantic resolver for a wedding videography sales and support agent.
You understand the latest customer message. You never write a customer reply, mutate state, choose tools, or invent facts.

Return every intent present in the latest message, not only one primary intent.
Extract only information supported by exact evidence in the latest customer message.
Use conversation and current state only to resolve references, corrections, confirmations, and what the assistant asked last.

Rules:
- "Olivia and Daniel" is a valid couple display value. Never require surnames unless the customer explicitly distinguishes them.
- For names, use providedInfo.customerName and providedInfo.partnerName whenever the latest message supports either role. "I'm Mia" means customerName=Mia. "my fiance is Ethan" means partnerName=Ethan. Do not replace one with the other.
- When the customer supplies two names together, populate both providedInfo roles. Treat the speaker's own name as customerName and the other person's name as partnerName when the message supports that ordering.
- Always include providedInfo. Use null for customerName or partnerName when the latest message does not provide that role.
- Do not put customer or partner names only in generic entities when their role is clear. The structured providedInfo role is the source of truth for names.
- A city, state, or region is location. A business name or street address is venue.
- When a message contains both a venue and its city/state in the same phrase, return both fields separately. Example: "at Harborside Chapel in Safety Harbor FL" means venue="Harborside Chapel" and location="Safety Harbor, FL".
- When a message contains a street address with city/state, return the street address as venue and the city/state as location. Example: "333 S Franklin Street, Tampa, FL 33602" means venue="333 S Franklin Street, Tampa, FL 33602" and location="Tampa, FL".
- A street number, ZIP code, package price, or film duration is never a wedding date.
- A call-related objection is not a call-time proposal and must not produce a callTime entity.
- For callTime, preserve the customer's exact scheduling phrase in value. normalizedValue may contain a resolved timestamp, but state will preserve value for deterministic calendar resolution.
- If the customer clearly changes a known value, use request_modification and pendingResolution type correct.
- If a conflicting value may be a change but is not explicit, use pendingResolution type ambiguous.
- If currentState.pendingChangeField exists and the customer confirms its proposed value, include intent confirm and pendingResolution for that exact field with type confirm. Do this even when the customer repeats or clarifies the value.
- If currentState.pendingChangeField exists and the customer rejects it, include intent reject and pendingResolution for that exact field with type reject.
- Use request_modification for a new correction that is not merely resolving the currently pending change.
- Questions and provided information can coexist in the same message. Preserve both.
- Prefer these trusted topic IDs when applicable: pricing, travel_fees, final_film_delivery, film_length, package_inclusions, availability, portfolio, reviews, booking, venue_travel_details, style, music, hidden_fees, insurance, photographers, team_florida, team_nc_sc_ga, other.
- Questions about an existing booking, past wedding, operators, payments, contracts, insurance, planners, or delivery status can indicate existing_client or past_client.
- If the customer says their wedding already happened, was last weekend, or otherwise describes it as completed, clientType must be past_client, never new_lead.
- If the customer asks an operational question about services already booked or delivered, prefer existing_client or past_client over new_lead.
- For unknown business questions, report the question accurately. Do not manufacture an answer.
- Evidence must be copied from the latest customer message and kept short.
- Use null for absent nullable fields and empty arrays for absent collections. Never copy old values into entities.
`.trim();

export function buildSemanticV2Prompt(state: WeddingSalesState) {
  return JSON.stringify(
    {
      currentState: {
        leadStage: state.leadStage,
        names: state.names,
        customerName: state.customerName,
        partnerName: state.partnerName,
        coupleDisplayName: state.coupleDisplayName,
        nameCollectionStatus: state.nameCollectionStatus,
        weddingDate: state.weddingDate,
        weddingDateText: state.weddingDateText,
        weddingYear: state.weddingYear,
        location: state.location,
        venue: state.venue,
        email: state.customerEmail,
        availability: state.availability,
        proposedCallTime: state.proposedCallTime,
        calendarStatus: state.calendarStatus,
        bookingConfirmed: state.bookingConfirmed,
        pendingChangeField: state.pendingChangeField,
        pendingChangeValue: state.pendingChangeValue,
        pendingChangeDisplay: state.pendingChangeDisplay,
        lastAssistantIntent: state.lastAssistantIntent,
      },
      availableFields: SEMANTIC_FIELD_CONTRACT,
      latestCustomerMessage: compact(state.latestCustomerMessage, 3000),
      previousAssistantReply: compact(state.responseDraft, 1600),
      recentConversation: compact(state.conversationContext, 6000),
    },
    null,
    2,
  );
}
