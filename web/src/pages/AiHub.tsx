/* OrbitX AI Hub — ChatGPT-style chat driving the full OrbitX MCP.
   /ai-hub — authed via the site's Supabase session (same account, all routes). */
import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Plus,
  Send,
  Trash2,
  Loader2,
  ChevronDown,
  Check,
  X,
  Menu,
  Sparkles,
  Wrench,
  ShieldAlert,
  CircleCheck,
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
  "What can you do on OrbitX?",
  "What's trending on Solana right now?",
  "Check my wallet balance",
  "How do I launch a coin on OrbitX?",
];

function shortModel(m?: string) {
  if (!m) return "AI Hub";
  const parts = String(m).split("/");
  return parts[parts.length - 1];
}

function ToolCard({ call }: { call: HubToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
        <span className="font-mono text-zinc-200">{call.name}</span>
        {call.gated ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            awaiting approval
          </span>
        ) : call.declined ? (
          <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            declined
          </span>
        ) : call.ok ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            ok
          </span>
        ) : (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300">
            failed
          </span>
        )}
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-zinc-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-white/10 px-3 py-2 text-xs">
          <div>
            <div className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-500">arguments</div>
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-zinc-300">{call.args_summary || "{}"}</pre>
          </div>
          <div>
            <div className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-500">result</div>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] text-zinc-300">
              {call.result_summary || "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingCard({ p, onConfirm, busy }: { p: HubPending; onConfirm: (id: string, ok: boolean) => void; busy: boolean }) {
  const args = p.args_summary || JSON.stringify(p.args || {});
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
        <ShieldAlert className="h-4 w-4" />
        Confirmation needed
      </div>
      <div className="mt-2 font-mono text-xs text-zinc-200">{p.tool_name}</div>
      <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] text-zinc-400">
        {args}
      </pre>
      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          onClick={() => onConfirm(p.id, true)}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => onConfirm(p.id, false)}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }, []);

  const loadThreads = useCallback(async () => {
    const r = await hubListThreads();
    if (r?.ok) setThreads(r.threads || []);
  }, []);

  const selectThread = useCallback(async (id: string | null) => {
    setActiveId(id);
    setSidebarOpen(false);
    if (!id) {
      setMessages([]);
      setPendings([]);
      return;
    }
    const r = await hubGetThread(id);
    if (r?.ok) {
      setMessages((r.messages || []).filter((m: HubMessage) => m.role !== "tool"));
      setPendings(r.pending || []);
      scrollDown();
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
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sending]);

  const applyChatResponse = useCallback((r: any, fallbackThread: string | null) => {
    const tid = r?.thread_id || fallbackThread;
    if (r?.ok && r.thread_id) {
      setActiveId(r.thread_id);
      loadThreads();
    }
    if (r?.reply !== undefined) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: r.reply || "",
          tool_calls: r.tool_calls?.length ? r.tool_calls : null,
          created_at: new Date().toISOString(),
        },
      ]);
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
    return tid;
  }, [loadThreads]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: msg, tool_calls: null, created_at: new Date().toISOString() },
    ]);
    scrollDown();
    try {
      const r = await hubChat(activeId, msg);
      if (!r?.ok && !r?.reply) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", content: `Something went wrong (${r?.error || "unknown"}). Please try again.`, tool_calls: null, created_at: new Date().toISOString() },
        ]);
      } else {
        applyChatResponse(r, activeId);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: "Network error — please try again.", tool_calls: null, created_at: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
      scrollDown();
    }
  }, [input, sending, activeId, scrollDown, applyChatResponse]);

  const doConfirm = useCallback(async (pendingId: string, approved: boolean) => {
    setConfirmBusy(true);
    try {
      const r = await hubConfirm(pendingId, approved);
      setPendings((prev) => prev.filter((p) => p.id !== pendingId));
      if (r?.ok || r?.reply) applyChatResponse(r, activeId);
      else {
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), role: "assistant", content: `Confirmation ${r?.error || "failed"} — ${r?.message || "please try again."}`, tool_calls: null, created_at: new Date().toISOString() },
        ]);
      }
    } finally {
      setConfirmBusy(false);
      scrollDown();
    }
  }, [activeId, applyChatResponse, scrollDown]);

  const newChat = useCallback(async () => {
    const r = await hubCreateThread("New chat");
    if (r?.ok) {
      setThreads((prev) => [r.thread, ...prev]);
      selectThread(r.thread.id);
    } else {
      selectThread(null);
    }
  }, [selectThread]);

  const delThread = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await hubDeleteThread(id);
    if (r?.ok) {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeId === id) selectThread(null);
    }
  }, [activeId, selectThread]);

  if (!user) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
          <div>
            <Sparkles className="mx-auto mb-4 h-10 w-10 text-cyan-300" />
            <h1 className="text-xl font-bold text-zinc-100">OrbitX AI Hub</h1>
            <p className="mt-2 text-sm text-zinc-400">Sign in with your OrbitX account to chat with the AI.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] bg-[#04070f] text-zinc-100">
        {/* Sidebar */}
        <aside
          className={cn(
            "z-30 flex w-72 shrink-0 flex-col border-r border-white/10 bg-[#060a14] transition-transform md:static md:translate-x-0",
            sidebarOpen ? "fixed inset-y-0 left-0 translate-x-0" : "fixed inset-y-0 left-0 -translate-x-full"
          )}
        >
          <div className="flex items-center gap-2 border-b border-white/10 p-4">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            <div>
              <div className="text-sm font-bold">AI Hub</div>
              <div className="text-[11px] text-zinc-500">Chat · Trade · Launch</div>
            </div>
            <button
              onClick={() => newChat()}
              className="ml-auto flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-cyan-300"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => selectThread(t.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                  activeId === t.id ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                <span className="flex-1 truncate">{t.title || "New chat"}</span>
                <Trash2
                  onClick={(e) => delThread(t.id, e)}
                  className="h-4 w-4 shrink-0 text-zinc-600 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                />
              </button>
            ))}
            {threads.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-zinc-600">No chats yet — start one below.</div>
            )}
          </div>
          {model && (
            <div className="border-t border-white/10 p-3 text-[11px] text-zinc-500">
              Mind: <span className="font-mono text-zinc-300">{model}</span>
            </div>
          )}
        </aside>
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <button className="md:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-zinc-400" />
            </button>
            <div className="text-sm font-semibold">OrbitX AI Hub</div>
            {model && (
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 font-mono text-[11px] text-zinc-400">{model}</span>
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.length === 0 && !sending && (
                <div className="pt-10 text-center">
                  <Sparkles className="mx-auto mb-4 h-12 w-12 text-cyan-300" />
                  <h2 className="text-2xl font-bold">What can I help with?</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
                    Chat with OrbitX AI — scan tokens, check markets, trade, launch coins, manage strategies. One account, everything in here.
                  </p>
                  <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-cyan-400/40 hover:bg-white/10"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/15 px-4 py-2.5 text-sm text-zinc-100">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="space-y-1">
                    <div className="prose prose-invert prose-sm max-w-none text-sm text-zinc-200 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/40 [&_pre]:p-3">
                      <ReactMarkdown>{m.content || ""}</ReactMarkdown>
                    </div>
                    {(m.tool_calls || []).map((c, i) => (
                      <ToolCard key={i} call={c} />
                    ))}
                  </div>
                )
              )}

              {pendings.map((p) => (
                <PendingCard key={p.id} p={p} onConfirm={doConfirm} busy={confirmBusy} />
              ))}

              {sending && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  Thinking… {elapsed > 2 ? <span className="font-mono text-xs">{elapsed}s</span> : null}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask anything — scan a token, trade, launch…"
                className="max-h-32 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/50"
              />
              <button
                onClick={() => send()}
                disabled={sending || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-black transition hover:bg-cyan-300 disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
            <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-center gap-3 text-[11px] text-zinc-600">
              <span className="flex items-center gap-1">
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CircleCheck className="h-3 w-3 text-emerald-400" />}
                {sending ? "working" : "ready"}
              </span>
              <span>Trades &amp; posts always ask first</span>
            </div>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
