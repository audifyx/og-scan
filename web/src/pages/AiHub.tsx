/* OrbitX AI Hub — ChatGPT-style chat driving the full OrbitX MCP.
   /ai-hub — authed via the site's Supabase session (same account, all routes).
   Native OrbitX design language: og-cyan/og-lime/og-gold tokens, AlphaChat
   message patterns, AgentPlus header/section conventions. */
import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Plus,
  Send,
  Square,
  Trash2,
  Loader2,
  ChevronDown,
  Check,
  X,
  Menu,
  Sparkles,
  Wrench,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Bot,
  User as UserIcon,
  Zap,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  hubListThreads,
  hubCreateThread,
  hubGetThread,
  hubDeleteThread,
  hubChat,
  hubConfirm,
  hubModels,
  type HubThread,
  type HubMessage,
  type HubToolCall,
  type HubPending,
} from "@/components/hub/api";

const QUICK_PROMPTS = [
  { label: "Scan a token", prompt: "Scan this token for rugs and give me the safety breakdown: " },
  { label: "Trending now", prompt: "What's trending on Solana right now?" },
  { label: "My wallet", prompt: "Check my wallet balance and recent swaps." },
  { label: "Launch a coin", prompt: "Walk me through launching a coin on OrbitX — what do you need from me?" },
];

function shortModel(m?: string) {
  if (!m) return "AI Hub";
  const parts = String(m).split("/");
  return parts[parts.length - 1];
}

function StatusPill({ call }: { call: HubToolCall }) {
  if (call.gated)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-og-gold/10 px-2 py-0.5 text-[10px] font-semibold text-og-gold ring-1 ring-og-gold/30">
        awaiting approval
      </span>
    );
  if (call.declined)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/40 ring-1 ring-white/10">
        declined
      </span>
    );
  if (call.ok)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-og-lime/10 px-2 py-0.5 text-[10px] font-semibold text-og-lime ring-1 ring-og-lime/30">
        <Check className="h-3 w-3" /> ok
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-400/30">
      failed
    </span>
  );
}

function ToolCard({ call }: { call: HubToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-og-cyan" />
        <span className="truncate font-mono text-xs text-white/85">{call.name}</span>
        <StatusPill call={call} />
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-white/30 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-white/[0.07] px-3 py-2.5">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">arguments</div>
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-white/70">
              {call.args_summary || "{}"}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">result</div>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-white/70">
              {call.result_summary || "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingCard({ p, onConfirm, busy }: { p: HubPending; onConfirm: (id: string, ok: boolean) => void; busy: boolean }) {
  const args = p.args_summary || JSON.stringify(p.args || {}, null, 2);
  return (
    <div className="rounded-xl border border-og-gold/20 bg-og-gold/5 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-og-gold">
        <ShieldAlert className="h-4 w-4" />
        Confirmation needed
      </div>
      <p className="mt-1 text-xs text-og-gold/70">
        This action moves money or publishes something. Nothing happens until you approve.
      </p>
      <div className="mt-2.5 rounded-lg bg-black/40 p-2.5">
        <div className="font-mono text-xs text-white/90">{p.tool_name}</div>
        <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] text-white/50">
          {args}
        </pre>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(p.id, true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-og-lime px-5 py-2 text-sm font-bold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(p.id, false)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Deny
        </button>
      </div>
    </div>
  );
}

export default function AiHub() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<HubThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [pendings, setPendings] = useState<HubPending[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [model, setModel] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const r = await hubListThreads();
      if (r?.ok) {
        setThreads(r.threads || []);
        setLoadError(null);
      } else if (r?.error) {
        setLoadError(r.error === "unauthorized" ? "Sign in to use the AI Hub." : `Couldn't load chats: ${r.error}`);
      }
    } catch {
      setLoadError("Couldn't reach the server. Check your connection and retry.");
    }
  }, []);

  const selectThread = useCallback(async (id: string | null) => {
    setActiveId(id);
    setSidebarOpen(false);
    setFailedPrompt(null);
    if (!id) {
      setMessages([]);
      setPendings([]);
      return;
    }
    setLoadingThread(true);
    try {
      const r = await hubGetThread(id);
      if (r?.ok) {
        setMessages((r.messages || []).filter((m: HubMessage) => m.role !== "tool"));
        setPendings(r.pending || []);
        scrollDown();
      }
    } finally {
      setLoadingThread(false);
    }
  }, [scrollDown]);

  useEffect(() => {
    loadThreads();
    hubModels().then((r) => r?.ok && setModel(shortModel(r.model)));
  }, [loadThreads]);

  useEffect(() => {
    if (sending) {
      const t0 = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setElapsed(0);
      abortRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sending]);

  // Abort an in-flight turn if the page unmounts mid-send.
  useEffect(() => () => abortRef.current?.abort(), []);

  const pushAssistant = useCallback((content: string, tool_calls: HubToolCall[] | null, id?: number) => {
    setMessages((prev) => [
      ...prev,
      { id: id ?? Date.now(), role: "assistant", content, tool_calls, created_at: new Date().toISOString() },
    ]);
  }, []);

  const applyChatResponse = useCallback((r: any) => {
    if (r?.ok && r.thread_id) {
      setActiveId(r.thread_id);
      loadThreads();
    }
    if (r?.reply !== undefined) {
      pushAssistant(r.reply || "", r.tool_calls?.length ? r.tool_calls : null);
    }
    if (r?.pending?.length) {
      setPendings((prev) => [
        ...prev.filter((p) => !r.pending.some((np: any) => np.pending_id === p.id)),
        ...r.pending.map((p: any) => ({
          id: p.pending_id,
          tool_name: p.tool,
          args: null,
          args_summary: p.args_summary,
          status: "pending",
          created_at: new Date().toISOString(),
        })),
      ]);
    }
  }, [loadThreads, pushAssistant]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !user) return;
    setSending(true);
    setInput("");
    setFailedPrompt(null);
    const userMsgId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: msg, tool_calls: null, created_at: new Date().toISOString() },
    ]);
    scrollDown();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await hubChat(activeId, msg, ctrl.signal);
      if (!r?.ok && !r?.reply) {
        setFailedPrompt(msg);
        pushAssistant(
          `Something went wrong (${r?.error || "unknown error"}). Your message is saved — hit retry to try again.`,
          null,
        );
      } else {
        applyChatResponse(r);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        pushAssistant(
          "Stopped. The turn may still finish on the server — reopen this chat to see the result.",
          null,
        );
      } else {
        setFailedPrompt(msg);
        pushAssistant("Network error — your message is saved. Hit retry to try again.", null);
      }
    } finally {
      setSending(false);
      scrollDown();
    }
  }, [input, sending, user, activeId, scrollDown, applyChatResponse, pushAssistant]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (failedPrompt && !sending) {
      // Drop the failed error note, keep the original user message, resend.
      setMessages((prev) => prev.slice(0, -1));
      send(failedPrompt);
    }
  }, [failedPrompt, sending, send]);

  const doConfirm = useCallback(async (pendingId: string, approved: boolean) => {
    setConfirmBusy(true);
    try {
      const r = await hubConfirm(pendingId, approved);
      setPendings((prev) => prev.filter((p) => p.id !== pendingId));
      if (r?.ok || r?.reply) applyChatResponse(r);
      else pushAssistant(`Confirmation ${r?.error || "failed"} — ${r?.message || "please try again."}`, null);
    } finally {
      setConfirmBusy(false);
      scrollDown();
    }
  }, [applyChatResponse, pushAssistant, scrollDown]);

  const newChat = useCallback(async () => {
    if (!user) return;
    try {
      const r = await hubCreateThread("New chat");
      if (r?.ok) {
        setThreads((prev) => [r.thread, ...prev]);
        selectThread(r.thread.id);
      }
    } catch {
      /* keep local empty state */
      selectThread(null);
    }
  }, [selectThread, user]);

  const delThread = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const r = await hubDeleteThread(id);
      if (r?.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== id));
        if (activeId === id) selectThread(null);
      }
    } catch { /* thread stays; user can retry */ }
  }, [activeId, selectThread]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-4rem)] bg-[#04070f] text-white">
        {/* ── Thread sidebar ── */}
        <aside
          className={cn(
            "z-30 flex w-72 shrink-0 flex-col border-r border-white/[0.07] bg-[#060a14] transition-transform md:static md:translate-x-0",
            sidebarOpen ? "fixed inset-y-0 left-0 translate-x-0" : "fixed inset-y-0 left-0 -translate-x-full",
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-white/[0.07] p-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-og-cyan/20 blur-md" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-og-cyan/40 bg-og-cyan/10">
                <Sparkles className="h-4.5 w-4.5 text-og-cyan" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black uppercase tracking-wide">AI Hub</div>
              <div className="text-[11px] text-white/40">Chat · Trade · Launch</div>
            </div>
            <button
              type="button"
              onClick={newChat}
              disabled={!user}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-og-cyan px-3 py-1.5 text-xs font-bold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadError && threads.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-og-gold" />
                <p className="text-xs text-white/50">{loadError}</p>
                <button
                  type="button"
                  onClick={loadThreads}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectThread(t.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    activeId === t.id
                      ? "border border-white/[0.08] bg-white/[0.06] text-white"
                      : "border border-transparent text-white/60 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <span className="flex-1 truncate">{t.title || "New chat"}</span>
                  <Trash2
                    onClick={(e) => delThread(t.id, e)}
                    className="h-4 w-4 shrink-0 text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                  />
                </button>
              ))
            )}
            {!loadError && threads.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-white/30">No chats yet — start one below.</div>
            )}
          </div>
          {model && (
            <div className="border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-og-lime" />
                <span className="font-mono text-white/60">{model}</span>
              </span>
            </div>
          )}
        </aside>
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Main column ── */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* header */}
          <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
            <button type="button" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Chats">
              <Menu className="h-5 w-5 text-white/60" />
            </button>
            <div className="relative hidden sm:block">
              <div className="absolute inset-0 rounded-xl bg-og-cyan/20 blur-lg" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-og-cyan/40 bg-og-cyan/10">
                <Sparkles className="h-5 w-5 text-og-cyan" />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black uppercase tracking-wide">OrbitX AI Hub</h1>
              <p className="flex items-center gap-1.5 text-[11px] text-white/40">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-og-lime" />
                </span>
                {model ? `${model} · full MCP access` : "full MCP access"}
              </p>
            </div>
          </header>

          {/* messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {loadingThread ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-og-cyan" />
                  <p className="text-sm text-white/40">Loading chat…</p>
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="pt-6 text-center">
                      <div className="relative mx-auto mb-5 h-16 w-16">
                        <div className="absolute inset-0 rounded-2xl bg-og-cyan/20 blur-xl" />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-og-cyan/40 bg-og-cyan/10">
                          <Sparkles className="h-8 w-8 text-og-cyan" />
                        </div>
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-wide">What can I help with?</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
                        Scan tokens, check markets, trade, launch coins, run strategies — one account, everything in here.
                      </p>
                      <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                        {QUICK_PROMPTS.map((q) => (
                          <button
                            key={q.label}
                            type="button"
                            onClick={() => send(q.prompt)}
                            disabled={!user || sending}
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition hover:border-og-cyan/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <div className="text-[13px] font-semibold text-white/85">{q.label}</div>
                            <div className="mt-0.5 truncate text-[11px] text-white/35">{q.prompt}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m) => (
                    <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          m.role === "assistant"
                            ? "border-og-cyan/30 bg-og-cyan/10 text-og-cyan"
                            : "border-og-lime/30 bg-og-lime/10 text-og-lime",
                        )}
                      >
                        {m.role === "assistant" ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 max-w-[85%] flex-1">
                        <div
                          className={cn(
                            "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            m.role === "assistant"
                              ? "border border-white/[0.06] bg-white/[0.03] text-white/85"
                              : "bg-og-lime/15 text-white",
                          )}
                        >
                          {m.role === "assistant" ? (
                            <div className="prose prose-invert prose-sm max-w-none [&_a]:text-og-cyan [&_code]:rounded [&_code]:bg-black/40 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-og-cyan [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/40 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:my-2">
                              <ReactMarkdown>{m.content || ""}</ReactMarkdown>
                            </div>
                          ) : (
                            m.content
                          )}
                        </div>
                        {m.role === "assistant" && (m.tool_calls?.length ? (
                          <div className="mt-2 space-y-2">
                            {m.tool_calls.map((c, i) => (
                              <ToolCard key={i} call={c} />
                            ))}
                          </div>
                        ) : null)}
                        {failedPrompt && m.id === messages[messages.length - 1]?.id && m.role === "assistant" && (
                          <button
                            type="button"
                            onClick={retry}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {pendings.map((p) => (
                    <PendingCard key={p.id} p={p} onConfirm={doConfirm} busy={confirmBusy} />
                  ))}

                  {sending && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-og-cyan/30 bg-og-cyan/10 text-og-cyan">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white/50">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking{elapsed > 2 ? <span className="font-mono text-xs"> · {elapsed}s</span> : "…"}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* composer */}
          <div className="border-t border-white/[0.07] px-4 py-3 lg:px-6">
            {!user ? (
              <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-og-gold/20 bg-og-gold/5 px-4 py-2.5 text-[12px] text-og-gold/90">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Sign in to chat with the AI Hub.
              </div>
            ) : (
              <>
                <div className="mx-auto flex max-w-3xl items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    placeholder="Ask about a token, wallet, or strategy…"
                    disabled={sending}
                    className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-og-cyan/40 disabled:opacity-60"
                  />
                  {sending ? (
                    <button
                      type="button"
                      onClick={stop}
                      title="Stop"
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-red-400/40 bg-red-400/10 text-red-300 transition hover:bg-red-400/20"
                    >
                      <Square className="h-5 w-5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => send()}
                      disabled={!input.trim()}
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-og-cyan text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-white/20">
                  OrbitX AI can make mistakes. Verify on-chain before trading. Trades &amp; posts always ask first.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
