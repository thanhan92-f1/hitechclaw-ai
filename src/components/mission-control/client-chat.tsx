"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HiTechClawProvider, useChat, useSessions } from "@hitechclaw/chat-sdk/react";
import {
  Bot,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  SendHorizonal,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { getCsrfToken } from "./api";
import { EmptyCard, StatCard } from "./ui-cards";

type SessionRecord = ReturnType<typeof useSessions>["sessions"][number];
type ChatMessage = Awaited<ReturnType<ReturnType<typeof useSessions>["getMessages"]>>[number];
type ConversationSummary = SessionRecord;

type ApiChatMessage = Omit<ChatMessage, "createdAt"> & {
  createdAt: string | Date;
};

function normalizeChatMessage(message: ApiChatMessage): ChatMessage {
  return {
    ...message,
    createdAt: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt),
  };
}

function formatConversationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatUsage(totalTokens: number | undefined) {
  if (!totalTokens) return "No usage yet";
  return `${totalTokens.toLocaleString()} tokens`;
}

function ChatWorkspace({ csrfToken }: { csrfToken: string }) {
  const { sessions, loading, refresh, deleteSession, renameSession, getMessages } = useSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [seedMessages, setSeedMessages] = useState<ChatMessage[]>([]);
  const [paneKey, setPaneKey] = useState(0);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  const openConversation = async (sessionId: string) => {
    setLoadingConversation(true);
    setSessionError(null);
    try {
      const messages = await getMessages(sessionId);
      setSeedMessages(messages.map((message) => normalizeChatMessage(message as ApiChatMessage)));
      setActiveSessionId(sessionId);
      setPaneKey((current) => current + 1);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Failed to load conversation");
    } finally {
      setLoadingConversation(false);
    }
  };

  const createConversation = () => {
    setSessionError(null);
    setSeedMessages([]);
    setActiveSessionId(undefined);
    setPaneKey((current) => current + 1);
  };

  const handleRename = async (session: ConversationSummary) => {
    const nextTitle = window.prompt("Rename conversation", session.title || "Untitled conversation");
    if (!nextTitle?.trim()) return;
    try {
      await renameSession(session.id, nextTitle.trim());
      await refresh();
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Rename failed");
    }
  };

  const handleDelete = async (session: ConversationSummary) => {
    const confirmed = window.confirm(`Delete conversation \"${session.title || session.id}\"?`);
    if (!confirmed) return;

    try {
      await deleteSession(session.id);
      if (activeSessionId === session.id) {
        createConversation();
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Conversations" value={sessions.length} subtitle={loading ? "Refreshing history" : "SDK-managed session history"} icon={MessageSquare} />
        <StatCard label="Active thread" value={activeSession ? activeSession.title || "Untitled" : "New chat"} subtitle={activeSession ? formatConversationDate(activeSession.updatedAt) : "Start a fresh workflow discussion"} icon={Sparkles} />
        <StatCard label="Security" value="Same-origin" subtitle={csrfToken ? "CSRF-protected SDK requests" : "Cookie auth only"} icon={Bot} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Client conversations</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Powered by `@hitechclaw/chat-sdk`.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                aria-label="Refresh sessions"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={createConversation}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[rgba(0,212,126,0.1)] px-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.16)]"
              >
                <Plus className="h-4 w-4" />
                New
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {sessions.length === 0 ? (
              <EmptyCard
                icon={MessageSquare}
                title="No conversations yet"
                description="Start a new client-side AI workflow chat to generate your first persisted session."
                className="py-10"
              />
            ) : (
              sessions.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => void openConversation(session.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                        : "border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--accent)]/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{session.title || "Untitled conversation"}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{formatConversationDate(session.updatedAt)} · {session.messageCount} messages</p>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{session.lastMessage || "Awaiting first assistant reply."}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                          {active ? "Live" : "Saved"}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRename(session);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
                          aria-label="Rename conversation"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDelete(session);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition hover:bg-red-500/10 hover:text-red-400"
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <ChatPane
          key={`${activeSessionId ?? "new"}-${paneKey}`}
          sessionId={activeSessionId}
          initialMessages={seedMessages}
          loadingConversation={loadingConversation}
          sessionError={sessionError}
          onSessionIdChange={setActiveSessionId}
          onConversationSaved={refresh}
        />
      </div>
    </div>
  );
}

function ChatPane({
  sessionId,
  initialMessages,
  loadingConversation,
  sessionError,
  onSessionIdChange,
  onConversationSaved,
}: {
  sessionId?: string;
  initialMessages: ChatMessage[];
  loadingConversation: boolean;
  sessionError: string | null;
  onSessionIdChange: (sessionId: string) => void;
  onConversationSaved: () => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { messages, send, cancel, sessionId: resolvedSessionId, isStreaming, usage, error } = useChat({
    sessionId,
    initialMessages,
    onFinish: () => {
      void onConversationSaved();
    },
  });

  useEffect(() => {
    onSessionIdChange(resolvedSessionId);
  }, [onSessionIdChange, resolvedSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    if (!input.trim() || isStreaming) return;
    send(input);
    setInput("");
  };

  return (
    <section className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Client AI workspace</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{sessionId ? "Resume conversation" : "New conversation"}</h2>
        </div>
        <div className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">{formatUsage(usage?.totalTokens)}</div>
      </div>

      <div ref={scrollRef} className="max-h-[560px] space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
        {loadingConversation ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
            Loading conversation history...
          </div>
        ) : messages.length === 0 ? (
          <EmptyCard
            icon={Sparkles}
            title="Start a guided client conversation"
            description="Ask HiTechClaw to summarize risk, explain a plan, or turn product requirements into an execution checklist."
            className="py-12"
          />
        ) : (
          messages.map((message) => {
            const assistant = message.role === "assistant";
            return (
              <div key={message.id} className={`flex ${assistant ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[92%] rounded-3xl border px-4 py-3 sm:max-w-[80%] ${assistant ? "border-[var(--border)] bg-[var(--bg-primary)]" : "border-[var(--accent)]/30 bg-[rgba(0,212,126,0.08)]"}`}>
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    {assistant ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    <span>{assistant ? "HiTechClaw" : "You"}</span>
                    {message.isStreaming ? <span className="animate-pulse text-[var(--accent)]">Streaming...</span> : null}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">{message.content || (assistant ? "Thinking..." : "")}</div>
                  {message.toolCalls?.length ? (
                    <div className="mt-3 space-y-2 rounded-2xl border border-[var(--border)] bg-black/10 p-3">
                      {message.toolCalls.map((toolCall) => (
                        <div key={toolCall.id} className="text-xs text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)]">{toolCall.name}</span>
                          {toolCall.result?.output ? <p className="mt-1 line-clamp-3">{toolCall.result.output}</p> : null}
                          {toolCall.result?.error ? <p className="mt-1 text-red-400">{toolCall.result.error}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {sessionError || error ? (
        <div className="border-t border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300 sm:px-5">
          {sessionError || error?.message}
        </div>
      ) : null}

      <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask for an executive summary, delivery plan, or client-safe AI workflow recommendation..."
            rows={3}
            className="min-h-[92px] flex-1 resize-y rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]/40"
          />
          <div className="flex shrink-0 flex-row gap-2 sm:w-[180px] sm:flex-col">
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim() || isStreaming}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[rgba(0,212,126,0.12)] px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendHorizonal className="h-4 w-4" />
              Send
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={!isStreaming}
              className="min-h-11 flex-1 rounded-2xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Stop
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClientChat() {
  const csrfToken = getCsrfToken();

  return (
    <HiTechClawProvider
      config={{
        baseUrl: "",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      }}
    >
      <ChatWorkspace csrfToken={csrfToken} />
    </HiTechClawProvider>
  );
}