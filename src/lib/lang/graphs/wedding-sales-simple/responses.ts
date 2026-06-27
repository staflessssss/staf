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
      text: "Hi! So happy you reached out 🤍 What wedding date and city are you planning for?",
    },
    {
      id: "ask_wedding_details_v2",
      text: "Hi, happy you’re here 🤍 What date and location are you thinking for the wedding?",
    },
    {
      id: "ask_wedding_details_v3",
      text: "Hi! I’d love to hear a little more 🤍 What’s your wedding date and location?",
    },
  ],
  utter_availability_available_ask_names: [
    {
      id: "availability_names_v1",
      text: "{{greetingOpening}}\n\n{{greetingIntroduction}} {{greetingCelebration}}\n\nI checked {{weddingDateDisplay}} in {{locationDisplay}}, and that date is available.\n\nOur {{coverageHours}}-hour wedding films start at {{startPrice}} for {{coverageRegion}}, and I’ll include the collections guide here so you can look through the options.\n\nWhat are both of your names?",
    },
    {
      id: "availability_names_v2",
      text: "{{greetingOpening}}\n\n{{greetingIntroduction}} {{greetingCelebration}}\n\n{{weddingDateDisplay}} in {{locationDisplay}} is open for us.\n\nThe {{coverageHours}}-hour collection starts at {{startPrice}} for {{coverageRegion}}, and I’ll send the collections guide over for you.\n\nWho would I be speaking with?",
    },
    {
      id: "availability_names_v3",
      text: "{{greetingOpening}}\n\n{{greetingIntroduction}} {{greetingCelebration}}\n\nI checked {{weddingDateDisplay}} in {{locationDisplay}}, and that date is available.\n\nOur {{coverageHours}}-hour wedding films start at {{startPrice}} for {{coverageRegion}}.\n\nWhat are both of your names?",
    },
  ],
  utter_pricing_repeat_send_guide_ask_names: [
    {
      id: "pricing_repeat_names_v1",
      text: "Yep, pricing is the same as I mentioned - {{startPrice}} for the {{coverageHours}}-hour collection for {{coverageRegion}}.\n\nI’ll include the collections guide here so you can look through the options.\n\nWhat are both of your names?",
    },
    {
      id: "pricing_repeat_names_v2",
      text: "The starting point is still {{startPrice}} for the {{coverageHours}}-hour collection for {{coverageRegion}}.\n\nI’ll send the collections guide over for you.\n\nWho would I be speaking with?",
    },
  ],
  utter_ask_location_only: [
    {
      id: "ask_location_only_v1",
      text: "Perfect, {{weddingDateDisplay}} 🤍 What city or venue are you planning for?",
    },
    {
      id: "ask_location_only_v2",
      text: "Got it for {{weddingDateDisplay}}. And where will the wedding be?",
    },
  ],
  utter_ask_wedding_date_only: [
    {
      id: "ask_date_only_v1",
      text: "Got it — {{location}} 🤍 What's your wedding date?",
    },
    {
      id: "ask_date_only_v2",
      text: "Beautiful. What date are you planning for in {{location}}?",
    },
  ],
  utter_ask_names_after_details: [
    {
      id: "ask_names_after_details_v1",
      text: "Perfect — {{weddingDateDisplay}} in {{location}} 🤍 What are both of your names?",
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
      text: "Beautiful — and where's the wedding taking place?",
    },
  ],
  utter_ask_call_time: [
    {
      id: "ask_call_time_v1",
      text: "From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.",
    },
    {
      id: "ask_call_time_v2",
      text: "The next best step would be a quick consult so I can learn a little more about the day. What time works best for you? I'm usually available Monday-Friday, 9am-2pm Eastern.",
    },
    {
      id: "ask_call_time_v3",
      text: "I'd love to hear more about what you're planning. What time would be good for a quick consult? I do calls Monday-Friday, 9am-2pm Eastern.",
    },
  ],
  utter_venue_collected_ask_call_time: [
    {
      id: "venue_call_time_v1",
      text: "Beautiful - {{venue}} gives us a good starting point.\n\nFrom here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults {{callWindow}}.",
    },
    {
      id: "venue_call_time_v2",
      text: "{{venue}} gives us a helpful starting point.\n\nThe easiest next step is a quick consult so I can learn a little more about the day. What time works best? I do consults {{callWindow}}.",
    },
  ],
  utter_calendar_available_ask_email: [
    {
      id: "calendar_email_v1",
      text: "{{callTimeDisplay}} works on my calendar.\n\nWhat's the best email for the calendar invite?",
    },
    {
      id: "calendar_email_v2",
      text: "{{callTimeDisplay}} is open on my calendar.\n\nWhat email should I use for the calendar invite?",
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
      text: "Of course — talk soon 🤍",
    },
    {
      id: "ack_v2",
      text: "Absolutely, see you then 🤍",
    },
    {
      id: "ack_v3",
      text: "You got it — looking forward to it ✨",
    },
  ],
  utter_answer_raw_footage: [
    {
      id: "raw_footage_v1",
      text: "Yes — raw footage can be added depending on the collection and what you're looking for. We can talk through the cleanest option on the call 🤍",
    },
    {
      id: "raw_footage_v2",
      text: "Yes, that's something we can talk through. It depends a bit on the collection and what kind of raw footage you're hoping to have.",
    },
    {
      id: "raw_footage_v3",
      text: "We can usually add raw footage depending on what you're looking for. I'd walk you through the cleanest option on the call.",
    },
  ],
  utter_answer_travel_resume_call_time: [
    {
      id: "travel_resume_call_v1",
      text: "Yes - travel is included within the collection's coverage, and if the venue is beyond the included mileage, we can go over the exact details on the call.\n\nSame next step from here: what time works best for a quick consult? I do calls {{callWindow}}.",
    },
    {
      id: "travel_resume_call_v2",
      text: "Yes, we do travel. The collection includes travel coverage, and if anything is outside the included mileage we can talk through the details on the call.\n\nWhat time would be best for a quick consult? I do calls {{callWindow}}.",
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

export function selectResponseVariationCandidates(input: {
  responseKey: SimpleWeddingSalesResponseKey;
  conversationId?: string;
  contactId?: string;
  turnIndex?: number;
  lastVariationIds?: string[];
}): SimpleWeddingSalesResponseVariation[] {
  const variations = SIMPLE_WEDDING_RESPONSES[input.responseKey];

  if (!variations?.length) {
    return [];
  }

  const first = selectResponseVariation(input);
  const ordered = first
    ? [first, ...variations.filter((variation) => variation.id !== first.id)]
    : [...variations];
  const lastVariationIds = new Set(input.lastVariationIds ?? []);

  return [
    ...ordered.filter((variation) => !lastVariationIds.has(variation.id)),
    ...ordered.filter((variation) => lastVariationIds.has(variation.id)),
  ];
}
