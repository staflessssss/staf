import type { WeddingSalesConfig } from "../config";
import type { WeddingSalesState } from "../state";

function appendSignature(text: string, signature: string) {
  return signature ? `${text.trim()}\n\n${signature.trim()}` : text.trim();
}

export function createWeddingSalesReplyNodes(config: WeddingSalesConfig) {
  return {
    askMissingInfo: async (_state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => ({
      responseDraft: appendSignature(
        "Thank you so much for reaching out. Could you share both of your names and your wedding date so I can check availability and send the most helpful details?",
        config.signature,
      ),
    }),
    askWeddingYear: async (_state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => ({
      responseDraft: appendSignature(
        "Thank you so much. Just so I check the right date, could you share the wedding year?",
        config.signature,
      ),
    }),
    checkAvailability: async (_state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => ({
      responseDraft: appendSignature(
        `I have enough details to check the wedding date against our availability. If available, I will send the collections guide and note that collections start at ${config.pricing.startPrice}.`,
        config.signature,
      ),
    }),
    checkCalendar: async (_state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => ({
      responseDraft:
        "I will check that consultation time against the calendar before calling it confirmed.",
    }),
    bookCall: async (_state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => ({
      responseDraft: appendSignature(
        "I will book that consultation now and only confirm once the calendar event is created.",
        config.signature,
      ),
    }),
    ignored: async (_state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => ({
      responseDraft: "",
    }),
  };
}
