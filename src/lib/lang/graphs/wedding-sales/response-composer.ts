import type { WeddingSalesConfig } from "./config";
import type { WeddingSalesState } from "./state";

export type WeddingSalesResponseIntent =
  | "ask_missing_info"
  | "ask_wedding_year"
  | "availability_tool_missing"
  | "availability_available"
  | "availability_unavailable"
  | "calendar_time_missing"
  | "calendar_available"
  | "calendar_busy"
  | "booking_tool_missing"
  | "booking_confirmed"
  | "booking_failed";

type ComposeWeddingSalesResponseArgs = {
  intent: WeddingSalesResponseIntent;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
  summary?: string;
};

function appendSignatureOnce(text: string, signature: string) {
  const body = text.trim();
  const trimmedSignature = signature.trim();

  if (!trimmedSignature || body.endsWith(trimmedSignature)) {
    return body;
  }

  return `${body}\n\n${trimmedSignature}`;
}

function getChannelFormatting(config: WeddingSalesConfig, state: WeddingSalesState) {
  return config.channelFormatting[state.channel] ?? config.channelFormatting.gmail;
}

function formatLink(args: {
  label: string;
  url?: string;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
}) {
  if (!args.url) {
    return args.label;
  }

  return getChannelFormatting(args.config, args.state).richLinks
    ? `<a href="${args.url}">${args.label}</a>`
    : `${args.label}: ${args.url}`;
}

function formatPortfolioLinks(config: WeddingSalesConfig, state: WeddingSalesState) {
  return config.portfolio
    .map((item) => formatLink({ label: item.label, url: item.url, config, state }))
    .filter(Boolean)
    .join("\n");
}

function formatGuideText(config: WeddingSalesConfig, state: WeddingSalesState) {
  if (config.guide.link) {
    return `You can review the collections guide here: ${formatLink({
      label: config.guide.fileName || "Collections Guide",
      url: config.guide.link,
      config,
      state,
    })}`;
  }

  if (getChannelFormatting(config, state).allowAttachments) {
    return "I am attaching the collections guide so you can review the full details.";
  }

  return "I can send over the collections guide with the full details.";
}

function formatWeddingDateForReply(value?: string) {
  if (!value) {
    return "your date";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatLocationSuffix(location?: string) {
  return location ? ` in ${location}` : "";
}

function appendSignatureForIntent(intent: WeddingSalesResponseIntent) {
  return !["calendar_available", "calendar_busy", "calendar_time_missing"].includes(intent);
}

export function composeWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs) {
  const { intent, config, state, summary } = args;
  const weddingDate = formatWeddingDateForReply(state.weddingDate);
  const location = formatLocationSuffix(state.location);

  const response = (() => {
    switch (intent) {
      case "ask_missing_info":
        return [
          "Thank you so much for reaching out. I would love to hear more.",
          "Could you share both of your names and the date you are planning to get married? Once I have that, I can check availability and send the most helpful details.",
        ].join("\n\n");
      case "ask_wedding_year":
        return "Thank you so much. Just so I check the right date, could you share the wedding year?";
      case "availability_tool_missing":
        return "I have enough details to check the wedding date, but the availability tool is not configured yet.";
      case "availability_unavailable":
        return [
          `Thank you for sharing those details. I checked ${weddingDate}${location}, and it looks unavailable on my end.`,
          summary || "If you have flexibility, I can help look at alternative dates.",
        ].join("\n\n");
      case "availability_available": {
        const intro = `Amazing, thank you so much${state.names ? `, ${state.names}` : ""}. ${weddingDate}${location} is available for Myndful, so you reached out at a great time 🤍`;

        if (state.guideSent) {
          return [
            intro,
            "The next step is a quick consultation where I can hear more about your story and answer any questions.",
            "Would you be open to a 30-minute call Monday through Friday between 9 AM and 2 PM Eastern?",
          ].join("\n\n");
        }

        const links = formatPortfolioLinks(config, state);
        const reviews = config.reviews.url
          ? formatLink({
              label: config.reviews.label || "Google Reviews",
              url: config.reviews.url,
              config,
              state,
            })
          : config.reviews.label;

        return [
          intro,
          `Our collections start at ${config.pricing.startPrice}. ${formatGuideText(config, state)}`,
          links ? `Here are a few recent wedding films:\n${links}` : "",
          reviews ? `And here are reviews from couples: ${reviews}` : "",
          "Would you be open to a 30-minute consultation Monday through Friday between 9 AM and 2 PM Eastern?",
        ]
          .filter(Boolean)
          .join("\n\n");
      }
      case "calendar_time_missing":
        return state.calendarStatus === "busy"
          ? "That time was not available, so I cannot book it yet. Could you send another time Monday through Friday between 9 AM and 2 PM Eastern?"
          : "I can check that consultation time once I have the requested time.";
      case "calendar_available":
        return "That time looks available on the calendar. Would you like me to book it?";
      case "calendar_busy":
        return "That time is already taken on the calendar, so I do not want to book the wrong slot. Could you send another time Monday through Friday between 9 AM and 2 PM Eastern?";
      case "booking_tool_missing":
        return "I can book the consultation once I have the confirmed time and booking tool configured.";
      case "booking_confirmed":
        return `You are all set. The calendar invite has been created${state.proposedCallTime ? ` for ${state.proposedCallTime}` : ""}.`;
      case "booking_failed":
        return "I could not confirm the booking yet. I will need to retry the calendar booking step.";
    }
  })();

  return appendSignatureForIntent(intent)
    ? appendSignatureOnce(response, config.signature)
    : response.trim();
}
