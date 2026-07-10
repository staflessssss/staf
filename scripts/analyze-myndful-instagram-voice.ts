import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { parseInstagramCredentials } from "@/lib/channels/instagram";

const MYNDFUL_AGENT_ID = "cmq6m9uk2000duxospuaod8al";
const conversationLimit = Math.min(Math.max(Number(process.env.INSTAGRAM_VOICE_SAMPLE_SIZE ?? 30), 1), 80);
const messagesPerConversation = 40;

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string };
};

type Participant = {
  id?: string;
  name?: string;
  username?: string;
};

type Conversation = {
  id?: string;
  participants?: { data?: Participant[] };
};

type InstagramMessage = {
  id?: string;
  message?: string;
  created_time?: string;
  from?: Participant;
};

type ConversationDetail = {
  messages?: { data?: InstagramMessage[] };
};

function redact(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?\d[\d().\-\s]{7,}\d)/g, "[phone]")
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchGraphJson<T>(url: URL, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify(payload.error)
        : `Meta Graph request failed with ${response.status}.`,
    );
  }

  return payload as T;
}

async function main() {
  const agent = await db.agent.findUnique({
    where: { id: MYNDFUL_AGENT_ID },
    include: { channel: true },
  });
  if (!agent) {
    throw new Error("Myndful Instagram agent was not found.");
  }

  const credentials = parseInstagramCredentials(decrypt(agent.channel.credentialsEnc));
  if (!credentials.pageAccessToken) {
    throw new Error("Myndful Instagram credentials are unavailable.");
  }

  const graphVersion = credentials.graphApiVersion || "v25.0";
  const ownerIds = new Set(
    [credentials.igUserId, credentials.igBusinessAccountId, credentials.pageId].filter(
      (value): value is string => Boolean(value),
    ),
  );
  const conversations: Conversation[] = [];
  let nextUrl: URL | null = new URL(`https://graph.instagram.com/${graphVersion}/me/conversations`);
  nextUrl.searchParams.set("platform", "instagram");
  nextUrl.searchParams.set("fields", "id,participants");
  nextUrl.searchParams.set("limit", String(Math.min(conversationLimit, 50)));

  while (nextUrl && conversations.length < conversationLimit) {
    const conversationPage: GraphPage<Conversation> = await fetchGraphJson<GraphPage<Conversation>>(
      nextUrl,
      credentials.pageAccessToken,
    );
    conversations.push(...(conversationPage.data ?? []));
    nextUrl = conversationPage.paging?.next ? new URL(conversationPage.paging.next) : null;
  }

  const sampled = conversations.slice(0, conversationLimit);
  const transcripts = await Promise.all(
    sampled.map(async (conversation) => {
      if (!conversation.id) {
        return null;
      }
      const detailUrl = new URL(
        `https://graph.instagram.com/${graphVersion}/${encodeURIComponent(conversation.id)}`,
      );
      detailUrl.searchParams.set(
        "fields",
        `messages.limit(${messagesPerConversation}){id,from,created_time,message}`,
      );
      const detail = await fetchGraphJson<ConversationDetail>(detailUrl, credentials.pageAccessToken);
      const messages = (detail.messages?.data ?? [])
        .filter((message) => message.message?.trim())
        .sort((left, right) => String(left.created_time).localeCompare(String(right.created_time)))
        .map((message) => ({
          speaker: ownerIds.has(message.from?.id ?? "") ? "Taras" : "Customer",
          text: redact(message.message ?? ""),
        }));

      return messages.length > 1 ? messages : null;
    }),
  );

  const usable = transcripts.filter((transcript): transcript is NonNullable<typeof transcript> => Boolean(transcript));
  const tarasMessages = usable.flatMap((transcript) => transcript.filter((message) => message.speaker === "Taras"));
  const customerMessages = usable.flatMap((transcript) => transcript.filter((message) => message.speaker === "Customer"));
  const excerpted = usable
    .filter((transcript) => transcript.some((message) => message.speaker === "Taras"))
    .slice(0, 12)
    .map((transcript) => transcript.slice(-16));

  console.log(
    JSON.stringify(
      {
        sampledConversations: sampled.length,
        usableConversations: usable.length,
        tarasMessageCount: tarasMessages.length,
        customerMessageCount: customerMessages.length,
        tarasSamples: tarasMessages.slice(0, 40).map((message) => message.text),
        customerSamples: customerMessages.slice(0, 40).map((message) => message.text),
        excerpts: excerpted,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
