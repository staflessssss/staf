"use client";

import { useState, type KeyboardEvent } from "react";
import { Bot, ChevronDown, RotateCcw, SendHorizontal, Wrench, X } from "lucide-react";

import { cn } from "@/lib/utils";

type TestChatDrawerProps = {
  tenantId: string;
  agentId: string;
  agentName: string;
  audience?: "admin" | "client";
};

type VisibleChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  toolName?: string;
  toolResult?: unknown;
  durationMs?: number;
  usedTooling?: string[];
  attachments?: TestChatAttachment[];
};

type TestChatAttachment = {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  publicUrl?: string;
};

type HiddenHistoryMessage = {
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
  toolName?: string;
  toolResult?: unknown;
  durationMs?: number;
  createdAt?: string;
};

type InvokeResponse = {
  item?: {
    message: string;
    usedTooling: string[];
    historyAppend?: HiddenHistoryMessage[];
    suppressReply?: boolean;
    attachments?: TestChatAttachment[];
  };
  error?: string;
};

const HIDDEN_WEDDING_SALES_STATE_TOOL_NAME = "__wedding_sales_state";

export function shouldSubmitTestChatKey(
  event: Pick<KeyboardEvent<HTMLTextAreaElement>, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">,
) {
  return (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  );
}

function stringifyTraceValue(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildVisibleTraceMessages(args: {
  historyAppend: HiddenHistoryMessage[];
  fallbackAssistantText: string;
  fallbackUsedTooling: string[];
  suppressReply?: boolean;
  attachments?: TestChatAttachment[];
}) {
  const visible = args.historyAppend
    .filter((entry) => entry.toolName !== HIDDEN_WEDDING_SALES_STATE_TOOL_NAME)
    .filter((entry) => entry.role === "TOOL" || entry.role === "ASSISTANT")
    .map((entry, index): VisibleChatMessage => {
      if (entry.role === "TOOL") {
        return {
          id: `tool-${Date.now()}-${index}`,
          role: "tool",
          text: entry.content || stringifyTraceValue(entry.toolResult),
          toolName: entry.toolName ?? "tool",
          toolResult: entry.toolResult,
          durationMs: entry.durationMs,
        };
      }

      return {
        id: `assistant-${Date.now()}-${index}`,
        role: "assistant",
        text: entry.content,
        usedTooling: args.fallbackUsedTooling,
        attachments: args.attachments,
      };
    });

  if (visible.length > 0) {
    return visible;
  }

  return args.suppressReply
    ? []
    : [
        {
          id: `assistant-${Date.now()}`,
          role: "assistant" as const,
          text: args.fallbackAssistantText,
          usedTooling: args.fallbackUsedTooling,
          attachments: args.attachments,
        },
      ];
}

export function AgentTestChatDrawer({
  tenantId,
  agentId,
  agentName,
  audience = "admin",
}: TestChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [contactId, setContactId] = useState(() => `test-chat-${Date.now()}`);
  const [visibleMessages, setVisibleMessages] = useState<VisibleChatMessage[]>([]);
  const [historyMessages, setHistoryMessages] = useState<HiddenHistoryMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const endpoint =
    audience === "client"
      ? `/api/client/agents/${agentId}/test-chat`
      : "/api/agent/invoke";
  const buttonLabel = audience === "client" ? "Test agent" : "Test chat";
  const subtitle = audience === "client" ? "Live agent sandbox" : "Test chat";
  const launcherClassName = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9be86]/55",
    audience === "client"
      ? "border-[#d7a96d]/38 bg-[#3a3028] text-[#e9be86] hover:border-[#d7a96d]/60 hover:bg-[#46372d]"
      : "border-[#d7a96d]/32 bg-[#211b15] text-[#e9be86] hover:border-[#d7a96d]/60 hover:bg-[#2b221a]",
  );
  const emptyStateCopy =
    audience === "client"
      ? "Try your live agent in isolated test mode. This panel keeps short temporary memory while you test, but it does not send real invites, write live leads, or store the session outside this drawer."
      : "This chat runs the saved agent in isolated test mode. It can use tools and short in-chat memory, but it does not create live bookings, send invites, write leads, or store the session outside this panel.";

  function resetChat() {
    setVisibleMessages([]);
    setHistoryMessages([]);
    setMessage("");
    setContactId(`test-chat-${Date.now()}`);
    setError(null);
  }

  async function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    const userMessage: VisibleChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setVisibleMessages((current) => [...current, userMessage]);
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          audience === "client"
            ? {
                contactId,
                message: trimmed,
                history: historyMessages,
              }
            : {
                tenantId,
                agentId,
                contactId,
                testMode: true,
                message: trimmed,
                history: historyMessages,
              },
        ),
      });

      const result = (await response.json().catch(() => null)) as InvokeResponse | null;

      if (!response.ok || !result?.item) {
        setVisibleMessages((current) =>
          current.filter((currentMessage) => currentMessage.id !== userMessage.id),
        );
        setError(result?.error || "Could not run the test chat.");
        return;
      }

      const appendedHistory = result.item.historyAppend ?? [];
      const visibleTraceMessages = buildVisibleTraceMessages({
        historyAppend: appendedHistory,
        fallbackAssistantText: result.item.message,
        fallbackUsedTooling: result.item.usedTooling ?? [],
        suppressReply: result.item.suppressReply,
        attachments: result.item.attachments,
      });

      setVisibleMessages((current) => [...current, ...visibleTraceMessages]);
      setHistoryMessages((current) => [
        ...current,
        {
          role: "USER",
          content: trimmed,
          createdAt: new Date().toISOString(),
        },
        ...(appendedHistory.map((historyEntry) => ({
          role: historyEntry.role,
          content: historyEntry.content,
          toolName: historyEntry.toolName,
          toolResult: historyEntry.toolResult,
          durationMs: historyEntry.durationMs,
          createdAt: new Date().toISOString(),
        })) as HiddenHistoryMessage[]),
      ]);
    } catch (invokeError) {
      setVisibleMessages((current) =>
        current.filter((currentMessage) => currentMessage.id !== userMessage.id),
      );
      setError(
        invokeError instanceof Error ? invokeError.message : "Could not run the test chat.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        className={launcherClassName}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Bot className="size-4" />
        {buttonLabel}
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-[520px] animate-in slide-in-from-right duration-200 flex-col border-l border-[#d7a96d]/24 bg-[#0d0f0e] shadow-[-32px_0_80px_rgba(0,0,0,0.38)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#d7a96d]/18 bg-[#14110d] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#d7a96d]/34 bg-[#2c2118] text-[#e9be86]">
                  <Bot className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xl font-semibold tracking-[-0.03em] text-white">
                      {agentName}
                    </p>
                    <ChevronDown className="size-4 shrink-0 text-[#e9be86]/66" />
                  </div>
                  <p className="mt-1 text-sm text-white/48">{subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Reset test chat"
                  className="grid size-10 place-items-center rounded-lg border border-white/[0.09] bg-white/[0.04] text-white/62 transition hover:border-[#d7a96d]/36 hover:text-[#e9be86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9be86]/55"
                  onClick={resetChat}
                  type="button"
                >
                  <RotateCcw className="size-4" />
                </button>
                <button
                  aria-label="Close test chat"
                  className="grid size-10 place-items-center rounded-lg border border-white/[0.09] bg-white/[0.04] text-white/62 transition hover:border-[#d7a96d]/36 hover:text-[#e9be86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9be86]/55"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#0b0d0c] px-5 py-5">
              {visibleMessages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#d7a96d]/28 bg-[#15120f] px-4 py-6 text-sm leading-6 text-white/52">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e9be86]">
                    Isolated test
                  </p>
                  <p className="mt-3">{emptyStateCopy}</p>
                </div>
              ) : (
                visibleMessages.map((chatMessage) => (
                  <div
                    key={chatMessage.id}
                    className={
                      chatMessage.role === "user"
                        ? "ml-10 rounded-lg bg-[#3a3028] px-4 py-3 text-sm leading-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : chatMessage.role === "tool"
                          ? "rounded-lg border border-[#d7a96d]/24 bg-[#18130f] px-4 py-3 text-xs leading-5 text-white/62"
                          : "mr-10 rounded-lg border border-white/[0.08] bg-[#121514] px-4 py-3 text-sm leading-6 text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    }
                  >
                    {chatMessage.role === "tool" ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#e9be86]">
                            <Wrench className="size-3.5" />
                            Agent called
                          </span>
                          {chatMessage.durationMs ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                              {chatMessage.durationMs}ms
                            </span>
                          ) : null}
                        </div>
                        <p className="font-semibold text-white">{chatMessage.toolName}</p>
                        <pre className="max-h-64 overflow-auto rounded-lg border border-white/[0.08] bg-black/20 p-3 text-[11px] leading-5 text-white/54">
                          {stringifyTraceValue(chatMessage.toolResult) || chatMessage.text}
                        </pre>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap">{chatMessage.text}</p>
                        {chatMessage.attachments?.map((attachment) =>
                          attachment.publicUrl &&
                          attachment.mimeType?.startsWith("image/") ? (
                            // The URL is supplied by the saved agent's Google Drive attachment config.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt={attachment.fileName ?? "Agent attachment"}
                              className="mt-3 max-h-80 w-full rounded-lg border border-white/[0.1] bg-black/20 object-contain"
                              key={attachment.fileId}
                              src={attachment.publicUrl}
                            />
                          ) : attachment.publicUrl ? (
                            <a
                              className="mt-3 inline-flex text-sm font-medium text-[#e9be86] underline decoration-[#e9be86]/40 underline-offset-4"
                              href={attachment.publicUrl}
                              key={attachment.fileId}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {attachment.fileName ?? "Open attachment"}
                            </a>
                          ) : null,
                        )}
                      </>
                    )}
                    {chatMessage.role === "assistant" && chatMessage.usedTooling?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {chatMessage.usedTooling.map((toolName) => (
                          <span
                            key={`${chatMessage.id}-${toolName}`}
                            className="rounded-md border border-[#d7a96d]/24 bg-[#211b15] px-2.5 py-1 text-[11px] font-medium text-[#e9be86]"
                          >
                            {toolName}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[#d7a96d]/18 bg-[#14110d] px-5 py-4">
              {error ? (
                <div className="mb-3 rounded-lg border border-[#ef9a8a]/28 bg-[#2b1714] px-4 py-3 text-sm text-[#ffb4a8]">
                  {error}
                </div>
              ) : null}
              <textarea
                className="min-h-24 w-full resize-none rounded-lg border border-white/[0.1] bg-[#0b0d0c] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[#d7a96d]/48 focus:ring-4 focus:ring-[#d7a96d]/10"
                onKeyDown={(event) => {
                  if (shouldSubmitTestChatKey(event)) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type a message..."
                value={message}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-white/38">
                  Enter sends. Shift+Enter adds a new line.
                </p>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d7a96d]/38 bg-[#d7a96d] px-4 py-2.5 text-sm font-semibold text-[#15100c] transition hover:bg-[#e9be86] disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:bg-white/[0.06] disabled:text-white/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9be86]/55"
                  disabled={isSending || !message.trim()}
                  onClick={sendMessage}
                  type="button"
                >
                  <SendHorizontal className="size-4" />
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
