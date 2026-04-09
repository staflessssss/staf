import { ChannelType } from "@prisma/client";

import { gmailAdapter } from "@/lib/channels/gmail";
import { instagramAdapter } from "@/lib/channels/instagram";
import { telegramAdapter } from "@/lib/channels/telegram";

export function getChannelAdapter(channel: ChannelType | string) {
  switch (channel) {
    case ChannelType.GMAIL:
      return gmailAdapter;
    case ChannelType.INSTAGRAM:
      return instagramAdapter;
    case ChannelType.TELEGRAM:
      return telegramAdapter;
    default:
      throw new Error(`Channel ${channel} not implemented`);
  }
}
