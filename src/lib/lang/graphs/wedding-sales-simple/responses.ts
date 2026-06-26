import type { SimpleWeddingSalesResponseKey } from "./state";

export type SimpleWeddingSalesResponseVariation = {
  id: string;
  text: string;
  requiredSlots?: string[];
  tags?: string[];
};

export const SIMPLE_WEDDING_RESPONSES: Partial<
  Record<SimpleWeddingSalesResponseKey, readonly SimpleWeddingSalesResponseVariation[]>
> = {
  utter_ask_wedding_details: [
    {
      id: "ask_wedding_details_v1",
      text: "Hey there - thanks for reaching out 🤍 Do you already have a wedding date and location in mind?",
    },
    {
      id: "ask_wedding_details_v2",
      text: "Hi! Happy you reached out 🤍 What date and location are you planning for?",
    },
    {
      id: "ask_wedding_details_v3",
      text: "Hey! I’d be happy to help. Do you already have your wedding date and location?",
    },
  ],
  utter_ask_venue: [
    {
      id: "ask_venue_v1",
      text: "So nice to meet you both 🤍 Do you already have a venue picked out?",
    },
    {
      id: "ask_venue_v2",
      text: "Love it. What venue are you two planning for?",
    },
    {
      id: "ask_venue_v3",
      text: "Beautiful — and where’s the wedding taking place?",
    },
  ],
  utter_ask_call_time: [
    {
      id: "ask_call_time_v1",
      text: "From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.",
    },
    {
      id: "ask_call_time_v2",
      text: "The next best step would be a quick consult so I can learn a little more about the day. What time works best for you? I’m usually available Monday-Friday, 9am-2pm Eastern.",
    },
    {
      id: "ask_call_time_v3",
      text: "I’d love to hear more about what you’re planning. What time would be good for a quick consult? I do calls Monday-Friday, 9am-2pm Eastern.",
    },
  ],
  utter_ask_booking_confirmation: [
    {
      id: "ask_booking_confirmation_v1",
      text: "Perfect, I have {{callTimeDisplay}} open. Want me to lock that in?",
    },
    {
      id: "ask_booking_confirmation_v2",
      text: "That works on my side — should I put {{callTimeDisplay}} on the calendar?",
    },
    {
      id: "ask_booking_confirmation_v3",
      text: "Amazing, {{callTimeDisplay}} is open. Want me to lock it in? ✨",
    },
  ],
  utter_booking_confirmed: [
    {
      id: "booking_confirmed_v1",
      text: "Perfect — you're all set for {{callTimeDisplay}} ✨\n\nYou should see the calendar invite come through at {{email}}.",
    },
    {
      id: "booking_confirmed_v2",
      text: "Done — I locked us in for {{callTimeDisplay}} ✨\n\nThe calendar invite should come through at {{email}}.",
    },
    {
      id: "booking_confirmed_v3",
      text: "All set for {{callTimeDisplay}} 🤍\n\nYou should get the calendar invite at {{email}}.",
    },
  ],
  utter_acknowledgement: [
    {
      id: "ack_v1",
      text: "Of course 🤍",
    },
    {
      id: "ack_v2",
      text: "Absolutely 🤍",
    },
    {
      id: "ack_v3",
      text: "You got it ✨",
    },
  ],
  utter_answer_raw_footage: [
    {
      id: "raw_footage_v1",
      text: "Yes — raw footage can be added depending on the collection and what you're looking for. We can talk through the cleanest option on the call 🤍",
    },
    {
      id: "raw_footage_v2",
      text: "Yes, that’s something we can talk through. It depends a bit on the collection and what kind of raw footage you’re hoping to have.",
    },
    {
      id: "raw_footage_v3",
      text: "We can usually add raw footage depending on what you’re looking for. I’d walk you through the cleanest option on the call.",
    },
  ],
} as const;

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function renderResponseVariation(
  variation: SimpleWeddingSalesResponseVariation,
  slots: Record<string, string | undefined>,
) {
  return Object.entries(slots).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value ?? ""),
    variation.text,
  ).trim();
}

export function missingResponseVariationSlots(
  variation: SimpleWeddingSalesResponseVariation,
  slots: Record<string, string | undefined>,
) {
  const requiredSlots = new Set(
    Array.from(variation.text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map(
      (match) => match[1]!,
    ),
  );

  return Array.from(requiredSlots).filter((slot) => !slots[slot]);
}

export function selectResponseVariation(input: {
  responseKey: SimpleWeddingSalesResponseKey;
  conversationId?: string;
  contactId?: string;
  turnIndex?: number;
  lastVariationIds?: string[];
}): SimpleWeddingSalesResponseVariation | null {
  const variations = SIMPLE_WEDDING_RESPONSES[input.responseKey];

  if (!variations?.length) {
    return null;
  }

  const available = variations.filter(
    (variation) => !input.lastVariationIds?.includes(variation.id),
  );
  const pool = available.length ? available : variations;
  const seed = `${input.conversationId ?? ""}:${input.contactId ?? ""}:${
    input.turnIndex ?? 0
  }:${input.responseKey}`;
  const index = stableHash(seed) % pool.length;

  return pool[index] ?? null;
}
