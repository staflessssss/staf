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
      "Prepare the Instagram account you want to connect.",
      "Make sure you are signing in to the correct business account.",
      "Click Connect Instagram and confirm access.",
      "After that, new messages can be routed into Behalfy.",
    ],
  },
  {
    kind: "channel",
    key: "telegram",
    type: ChannelType.TELEGRAM,
    title: "Telegram",
    shortDescription: "Connect Telegram so your agent can receive new dialogs from your bot.",
    icon: "/brands/telegram.svg",
    instructions: [
      "Open Telegram and search for BotFather.",
      "Create a new bot or open the existing bot for this business.",
      "Copy the bot token that BotFather gives you.",
      "Paste the token into the field below and save the connection.",
    ],
    notes: [
      "Your token is stored securely. If you change the bot later, just save a new token here.",
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
