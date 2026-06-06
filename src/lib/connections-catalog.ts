import { ChannelType, ConnectionStatus, IntegrationType } from "@prisma/client";

export type ConnectionKey =
  | "gmail"
  | "instagram"
  | "telegram"
  | "google-workspace";

type BaseConnectionDefinition = {
  key: ConnectionKey;
  title: string;
  shortDescription: string;
  icon: string;
  instructions: string[];
  notes?: string[];
};

export type ChannelDefinition = BaseConnectionDefinition & {
  kind: "channel";
  type: ChannelType;
};

export type IntegrationDefinition = BaseConnectionDefinition & {
  kind: "integration";
  type: IntegrationType;
  requiresGoogleWorkspace?: boolean;
};

export const channelDefinitions: ChannelDefinition[] = [
  {
    kind: "channel",
    key: "gmail",
    type: ChannelType.GMAIL,
    title: "Gmail",
    shortDescription: "Connect Gmail so your agent can work with inbound emails and replies.",
    icon: "/brands/gmail.svg",
    instructions: [
      "Click Connect Google Account below.",
      "Choose the Google account you want to use for this business.",
      "Approve access for Gmail and the related Google services.",
      "Return to Behalfy after the connection is complete.",
    ],
    notes: [
      "The same Google account can also unlock Google Calendar, Google Sheets, and Google Drive.",
    ],
  },
  {
    kind: "channel",
    key: "instagram",
    type: ChannelType.INSTAGRAM,
    title: "Instagram",
    shortDescription: "Connect Instagram so your agent can handle business messages in Direct.",
    icon: "/brands/instagram.svg",
    instructions: [
      "Make sure the Instagram account is a Professional or Business account.",
      "Connect that Instagram account to the correct Facebook Page in Meta Business settings.",
      "Click Connect Instagram and approve access to the Page and Instagram messages.",
      "After the connection is complete, your operator can assign an Instagram agent to this channel.",
    ],
    notes: [
      "If Meta shows no Pages, confirm the Instagram account is connected to a Facebook Page and your Facebook user can manage it.",
      "Instagram replies are plain text only: no Gmail signature and no HTML links.",
    ],
  },
  {
    kind: "channel",
    key: "telegram",
    type: ChannelType.TELEGRAM,
    title: "Telegram",
    shortDescription: "Connect Telegram so the agent can ask the business owner for help.",
    icon: "/brands/telegram.svg",
    instructions: [
      "Open Telegram and search for BotFather.",
      "Create a private owner-notification bot or open the existing bot for this business.",
      "Copy the bot token that BotFather gives you.",
      "Paste the token into the field below and save the connection.",
      "Open the bot in Telegram and send the exact /start command shown after saving.",
    ],
    notes: [
      "This bot is for operator handoff: when the agent is unsure, it sends the owner the dialog and waits for a command.",
      "Your token is stored securely. If you change the bot later, just save a new token here and send /start again.",
    ],
  },
];

export const integrationDefinitions: IntegrationDefinition[] = [
  {
    kind: "integration",
    key: "google-workspace",
    type: IntegrationType.GOOGLE_CALENDAR,
    title: "Google Workspace",
    shortDescription:
      "Connect Google services once to unlock Calendar, Sheets, and Drive for your business.",
    icon: "/brands/google-calendar.svg",
    requiresGoogleWorkspace: true,
    instructions: [
      "Start by connecting your Google account through Gmail.",
      "Once Gmail is connected, Google Calendar, Google Sheets, and Google Drive become available automatically.",
      "Your operator can then use scheduling, spreadsheets, and files inside the agent setup.",
    ],
    notes: ["Includes Google Calendar, Google Sheets, and Google Drive."],
  },
];

export const connectionDefinitions = [...channelDefinitions, ...integrationDefinitions];

export function getConnectionDefinition(key: string) {
  return connectionDefinitions.find((item) => item.key === key);
}

export function getConnectionStatusLabel(status?: ConnectionStatus) {
  switch (status) {
    case "CONNECTED":
      return "Connected";
    case "PENDING":
      return "Pending";
    case "ERROR":
      return "Needs attention";
    case "REVOKED":
      return "Disconnected";
    default:
      return "Not connected";
  }
}
