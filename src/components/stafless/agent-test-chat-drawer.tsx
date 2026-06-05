"use client";

import { useState } from "react";
import { Bot, ChevronDown, RotateCcw, SendHorizontal, X } from "lucide-react";

import {
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "@/components/stafless/foundation";

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
  };
  error?: string;
};

const HIDDEN_WEDDING_SALES_STATE_TOOL_NAME = "__wedding_sales_state";

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
        className={secondaryButtonClassName}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {buttonLabel}
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/10">
          <div className="flex h-full w-full max-w-[460px] flex-col border-l border-border bg-white shadow-[-24px_0_60px_rgba(31,23,40,0.14)]">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-[#faf6f0] text-foreground">
                  <Bot className="size-5" />
                </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-semibold text-foreground">{agentName}</p>
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={secondaryButtonClassName}
                  onClick={resetChat}
                  type="button"
                >
                  <RotateCcw className="size-4" />
                </button>
                <button
                  className={secondaryButtonClassName}
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#fcfaf6] px-5 py-5">
              {visibleMessages.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#e5d8c8] bg-white px-4 py-6 text-sm leading-6 text-muted-foreground">
                  {emptyStateCopy}
                </div>
              ) : (
                visibleMessages.map((chatMessage) => (
                  <div
                    key={chatMessage.id}
                    className={
                      chatMessage.role === "user"
                        ? "ml-10 rounded-[18px] bg-[#221b2d] px-4 py-3 text-sm leading-6 text-white"
                        : chatMessage.role === "tool"
                          ? "rounded-[16px] border border-[#d7a96d]/35 bg-[#fff8ee] px-4 py-3 text-xs leading-5 text-[#5d4b38]"
                          : "mr-10 rounded-[18px] border border-[#e5d8c8] bg-white px-4 py-3 text-sm leading-6 text-[#433a49]"
                    }
                  >
                    {chatMessage.role === "tool" ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c6b35]">
                            Function call
                          </span>
                          {chatMessage.durationMs ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9c6b35]/70">
                              {chatMessage.durationMs}ms
                            </span>
                          ) : null}
                        </div>
                        <p className="font-semibold text-[#2f2418]">{chatMessage.toolName}</p>
                        <pre className="max-h-64 overflow-auto rounded-xl border border-[#e5d8c8] bg-white/70 p-3 text-[11px] leading-5 text-[#433a49]">
                          {stringifyTraceValue(chatMessage.toolResult) || chatMessage.text}
                        </pre>
                      </div>
                    ) : (
                      <p>{chatMessage.text}</p>
                    )}
                    {chatMessage.role === "assistant" && chatMessage.usedTooling?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {chatMessage.usedTooling.map((toolName) => (
                          <span
                            key={`${chatMessage.id}-${toolName}`}
                            className="rounded-lg border border-border bg-[#faf6f0] px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
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

            <div className="border-t border-border bg-white px-5 py-4">
              {error ? (
                <div className="mb-3 rounded-[16px] border border-[#efc4c1] bg-[#fff0ef] px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <textarea
                className={textareaClassName}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type a message..."
                value={message}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Refresh starts a new chat and wipes the temporary memory.
                </p>
                <button
                  className={primaryButtonClassName}
                  disabled={isSending || !message.trim()}
                  onClick={sendMessage}
                  type="button"
                >
                  <SendHorizontal className="mr-2 size-4" />
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
