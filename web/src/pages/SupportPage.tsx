/**
 * SupportPage — on-site support chat.
 *
 * Users  → open/continue a ticket, see which agents are online
 * Agents (admin or support role) → inbox with all tickets, reply from here
 *
 * Layout: uses AppLayout so BottomNav and Sidebar are always visible.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, CheckCheck, Loader2, Send, Shield,
} from "lucide-react";

/* ─── helpers ─── */
const ago = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });
const stamp = (d: string) => format(new Date(d), "h:mm a");
const isOnline = (p: AgentProfile) => {
  if (!p) return false;
  if (p.is_online === false) return false;
  const t = p.last_active_at || p.last_seen_at;
  if (!t) return Boolean(p.is_online);
  return Date.now() - new Date(t).getTime() < 3 * 60 * 1000;
};

/* ─── types ─── */
interface Ticket {
  id: string;
  user_id: string;
  username: string;
  subject: string;
  status: string;
  unread_user: number;
  unread_agent: number;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}
interface Message {
  id: string;
  ticket_id: string;
  content: string;
  is_admin: boolean;
  sender_id?: string;
  sender_name?: string;
  sender_avatar?: string;
  created_at: string;
  read_at?: string | null;
}
interface AgentProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
  last_active_at: string | null;
  last_seen_at: string | null;
}

/* ═══════════════════════════════════════════════════════ */
/* USER VIEW                                               */
/* ═══════════════════════════════════════════════════════ */
function UserChat({ agents }: { agents: AgentProfile[] }) {
  const { user, profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const onlineAgents = agents.filter(isOnline);

  const loadTicket = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .not("status", "eq", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setTicket(data);
    setLoading(false);
    if (data) {
      const { data: msgs } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", data.id)
        .order("created_at");
      setMessages(msgs || []);
      await supabase.from("support_tickets").update({ unread_user: 0 }).eq("id", data.id);
    }
  }, [user]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  useEffect(() => {
    if (!ticket) return;
    const ch = supabase.channel(`support-user-${ticket.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `ticket_id=eq.${ticket.id}`,
      }, (p) => {
        setMessages(prev => [...prev, p.new as Message]);
        supabase.from("support_tickets").update({ unread_user: 0 }).eq("id", ticket.id);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "support_tickets",
        filter: `id=eq.${ticket.id}`,
      }, (p) => setTicket(p.new as Ticket))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticket?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createTicket = async () => {
    if (!user || !subject.trim()) return;
    setSending(true);
    const { data, error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      username: profile?.username || "user",
      subject: subject.trim(),
      status: "open",
    }).select("*").single();
    if (error || !data) { setSending(false); return; }
    await supabase.from("support_messages").insert({
      ticket_id: data.id,
      sender_id: user.id,
      sender_name: profile?.display_name || profile?.username,
      sender_avatar: profile?.avatar_url,
      content: subject.trim(),
      is_admin: false,
    });
    setTicket(data);
    setSubject("");
    setSending(false);
    loadTicket();
  };

  const sendMessage = async () => {
    if (!user || !ticket || !text.trim()) return;
    const body = text.trim();
    setText("");
    setSending(true);
    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_name: profile?.display_name || profile?.username,
      sender_avatar: profile?.avatar_url,
      content: body,
      is_admin: false,
    });
    setSending(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-white/20" />
    </div>
  );

  /* ── New conversation screen ── */
  if (!ticket) return (
    <div className="px-4 pb-4">
      {/* Agent avatars */}
      {agents.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Support Team</p>
          <div className="flex gap-4 flex-wrap">
            {agents.slice(0, 6).map(a => (
              <div key={a.user_id} className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  {a.avatar_url
                    ? <img src={a.avatar_url} className="h-12 w-12 rounded-full border border-white/10 object-cover" />
                    : <div className="h-12 w-12 rounded-full bg-og-lime/20 flex items-center justify-center text-og-lime font-bold text-base">{(a.display_name || a.username || "?")[0].toUpperCase()}</div>}
                  <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background", isOnline(a) ? "bg-green-400" : "bg-white/20")} />
                </div>
                <span className="text-[10px] text-white/40 truncate max-w-[50px]">{a.display_name || a.username}</span>
              </div>
            ))}
          </div>
          {onlineAgents.length > 0 && (
            <p className="text-[11px] text-green-400/70 mt-3">● {onlineAgents.length} agent{onlineAgents.length > 1 ? "s" : ""} online — we reply fast</p>
          )}
        </div>
      )}

      {/* Start message */}
      <div className="text-center mb-5">
        <p className="text-3xl mb-2">👋</p>
        <h2 className="font-bold text-white text-xl">How can we help?</h2>
        <p className="text-xs text-white/35 mt-1">Send us a message and we'll get back to you fast.</p>
      </div>
      <div className="space-y-3">
        <textarea
          value={subject}
          onChange={e => setSubject(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), createTicket())}
          placeholder="Describe your issue…"
          rows={4}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-og-lime/30"
        />
        <button
          onClick={createTicket}
          disabled={!subject.trim() || sending}
          className="w-full rounded-2xl bg-og-lime text-black font-bold text-sm py-3.5 disabled:opacity-40 hover:bg-og-lime/90 transition-colors"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Start Conversation"}
        </button>
      </div>
    </div>
  );

  /* ── Active thread view ── */
  return (
    <div className="flex flex-col">
      {/* Thread header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="flex -space-x-2">
          {agents.slice(0, 3).map(a => (
            <div key={a.user_id} className="relative">
              {a.avatar_url
                ? <img src={a.avatar_url} className="h-9 w-9 rounded-full border-2 border-background object-cover" />
                : <div className="h-9 w-9 rounded-full border-2 border-background bg-og-lime/20 flex items-center justify-center text-og-lime text-xs font-bold">{(a.display_name || a.username || "?")[0].toUpperCase()}</div>}
              <span className={cn("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background", isOnline(a) ? "bg-green-400" : "bg-white/20")} />
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">OGScan Support</p>
          <p className="text-[10px] text-white/30">
            {onlineAgents.length > 0
              ? <span className="text-green-400">● {onlineAgents.length} online</span>
              : "We'll reply soon"}
          </p>
        </div>
        <span className={cn("text-[9px] font-bold px-2.5 py-1 rounded-full",
          ticket.status === "open" ? "bg-yellow-400/10 text-yellow-400"
          : ticket.status === "in_progress" ? "bg-og-cyan/10 text-og-cyan"
          : "bg-white/5 text-white/30"
        )}>
          {ticket.status.replace("_", " ")}
        </span>
      </div>

      {/* Messages */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-center text-[10px] text-white/20 mb-4">{ticket.subject}</p>
        {messages.map((m, i) => {
          const isMe = !m.is_admin;
          const showTime = i === messages.length - 1 || new Date(messages[i + 1]?.created_at).getTime() - new Date(m.created_at).getTime() > 5 * 60 * 1000;
          return (
            <div key={m.id} className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
              {!isMe && (
                <div className="shrink-0 mb-1">
                  {m.sender_avatar
                    ? <img src={m.sender_avatar} className="h-7 w-7 rounded-full border border-white/10 object-cover" />
                    : <div className="h-7 w-7 rounded-full bg-og-lime/20 flex items-center justify-center">
                        <Shield className="h-3.5 w-3.5 text-og-lime" />
                      </div>}
                </div>
              )}
              <div className={cn("flex flex-col gap-0.5 max-w-[75%]", isMe ? "items-end" : "items-start")}>
                {!isMe && m.sender_name && (
                  <p className="text-[9px] text-white/30 px-1">{m.sender_name}</p>
                )}
                <div className={cn("px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                  isMe
                    ? "bg-og-lime text-black rounded-br-sm"
                    : "bg-white/[0.07] text-white rounded-bl-sm"
                )}>
                  {m.content}
                </div>
                {showTime && (
                  <p className="text-[9px] text-white/20 px-1 flex items-center gap-1">
                    {stamp(m.created_at)}
                    {isMe && m.read_at && <CheckCheck className="h-3 w-3 text-og-cyan" />}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-3 pt-2 pb-4 border-t border-white/[0.06] flex items-end gap-2 sticky bottom-0 bg-background/95 backdrop-blur-sm">
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Message…"
            rows={1}
            style={{ resize: "none" }}
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-og-lime/30 max-h-32 overflow-y-auto"
          />
        </div>
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-og-lime text-black disabled:opacity-30 hover:bg-og-lime/90 transition-all active:scale-90"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* AGENT VIEW — ticket list                                */
/* ═══════════════════════════════════════════════════════ */
function AgentTicketList({ onSelect }: { onSelect: (t: Ticket) => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "in_progress" | "all">("open");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("support_tickets").select("*").order("last_message_at", { ascending: false, nullsFirst: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setTickets(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("agent-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filters: Array<"open" | "in_progress" | "all"> = ["open", "in_progress", "all"];

  return (
    <div>
      <div className="px-4 pt-2 pb-3">
        <div className="flex gap-1.5">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                filter === f ? "bg-og-lime text-black" : "bg-white/[0.05] text-white/40 hover:bg-white/[0.08]"
              )}>
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-white/20" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <p className="text-3xl mb-2">✨</p>
          <p className="text-sm">No {filter === "all" ? "" : filter} tickets</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {tickets.map(t => (
            <button key={t.id} onClick={() => onSelect(t)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors text-left">
              <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-og-lime/20 to-og-cyan/20 flex items-center justify-center text-white font-bold text-sm border border-white/[0.06]">
                {(t.username || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-semibold text-white truncate">{t.username}</p>
                  <p className="text-[10px] text-white/25 shrink-0 ml-2">
                    {t.last_message_at ? ago(t.last_message_at) : ago(t.created_at)}
                  </p>
                </div>
                <p className="text-xs text-white/40 truncate">{t.last_message || t.subject}</p>
              </div>
              {(t.unread_agent ?? 0) > 0 && (
                <span className="shrink-0 h-5 min-w-[20px] rounded-full bg-og-lime text-black text-[10px] font-black flex items-center justify-center px-1">
                  {t.unread_agent}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentThread({ ticket, agents, onBack }: { ticket: Ticket; agents: AgentProfile[]; onBack: () => void }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("support_messages").select("*").eq("ticket_id", ticket.id).order("created_at");
    setMessages(data || []);
    await supabase.from("support_tickets").update({ unread_agent: 0 }).eq("id", ticket.id);
  }, [ticket.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`agent-thread-${ticket.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `ticket_id=eq.${ticket.id}`,
      }, (p) => {
        setMessages(prev => [...prev, p.new as Message]);
        supabase.from("support_tickets").update({ unread_agent: 0 }).eq("id", ticket.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticket.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendReply = async () => {
    if (!user || !text.trim()) return;
    const body = text.trim();
    setText("");
    setSending(true);
    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_name: profile?.display_name || profile?.username,
      sender_avatar: profile?.avatar_url,
      content: body,
      is_admin: true,
    });
    await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", ticket.id);
    setSending(false);
  };

  const closeTicket = async () => {
    await supabase.from("support_tickets").update({ status: "closed" }).eq("id", ticket.id);
    onBack();
  };

  return (
    <div className="flex flex-col">
      {/* Header with back */}
      <div className="px-3 py-3 border-b border-white/[0.06] flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <button onClick={onBack} className="text-white/40 hover:text-white p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-og-lime/20 to-og-cyan/20 flex items-center justify-center text-white font-bold text-sm border border-white/[0.06]">
          {(ticket.username || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{ticket.username}</p>
          <p className="text-[10px] text-white/30 truncate">{ticket.subject}</p>
        </div>
        <button onClick={closeTicket} className="text-[10px] text-white/25 hover:text-red-400 border border-white/10 px-2.5 py-1 rounded-full transition-colors">
          Close
        </button>
      </div>

      {/* Messages */}
      <div className="px-4 py-4 space-y-3">
        {messages.map((m, i) => {
          const isAgent = m.is_admin;
          const showTime = i === messages.length - 1 || new Date(messages[i + 1]?.created_at).getTime() - new Date(m.created_at).getTime() > 5 * 60 * 1000;
          return (
            <div key={m.id} className={cn("flex items-end gap-2", isAgent ? "flex-row-reverse" : "flex-row")}>
              {!isAgent && (
                <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-og-lime/20 to-og-cyan/20 flex items-center justify-center text-white font-bold text-xs border border-white/[0.06] mb-1">
                  {(ticket.username || "?")[0].toUpperCase()}
                </div>
              )}
              {isAgent && (
                <div className="shrink-0 mb-1">
                  {m.sender_avatar
                    ? <img src={m.sender_avatar} className="h-7 w-7 rounded-full border border-white/10 object-cover" />
                    : <div className="h-7 w-7 rounded-full bg-og-lime/20 flex items-center justify-center"><Shield className="h-3.5 w-3.5 text-og-lime" /></div>}
                </div>
              )}
              <div className={cn("flex flex-col gap-0.5 max-w-[75%]", isAgent ? "items-end" : "items-start")}>
                {isAgent && m.sender_name && (
                  <p className="text-[9px] text-og-lime/50 px-1">{m.sender_name} · Agent</p>
                )}
                <div className={cn("px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                  isAgent
                    ? "bg-og-lime text-black rounded-br-sm"
                    : "bg-white/[0.07] text-white rounded-bl-sm"
                )}>
                  {m.content}
                </div>
                {showTime && (
                  <p className="text-[9px] text-white/20 px-1">{stamp(m.created_at)}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-3 pt-2 pb-4 border-t border-white/[0.06] flex items-end gap-2 sticky bottom-0 bg-background/95 backdrop-blur-sm">
        <div className="flex-1">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            placeholder="Reply…"
            rows={1}
            style={{ resize: "none" }}
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-og-lime/30 max-h-32 overflow-y-auto"
          />
        </div>
        <button
          onClick={sendReply}
          disabled={!text.trim() || sending}
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-og-lime text-black disabled:opacity-30 hover:bg-og-lime/90 transition-all active:scale-90"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ROOT                                                    */
/* ═══════════════════════════════════════════════════════ */
export default function SupportPage() {
  const { user } = useAuth();
  const [isAgent, setIsAgent] = useState(false);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    Promise.all([
      supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("admin_roles").select("user_id, role").in("role", ["admin", "support"]),
    ]).then(async ([roleRes, agentsRes]) => {
      const role = roleRes.data?.role;
      setIsAgent(role === "admin" || role === "support");

      if (agentsRes.data?.length) {
        const ids = agentsRes.data.map((r: any) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, is_online, last_active_at, last_seen_at")
          .in("user_id", ids);
        setAgents(profiles || []);
      }
      setChecking(false);
    });
  }, [user?.id]);

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto">
        {/* Page header */}
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
          <h1 className="text-xl font-black text-white">
            {isAgent ? "Support Inbox" : "Support"}
          </h1>
          {isAgent && (
            <p className="text-[11px] text-og-lime/60 mt-0.5 font-semibold">Agent View</p>
          )}
        </div>

        {checking ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/20" />
          </div>
        ) : isAgent ? (
          selectedTicket
            ? <AgentThread ticket={selectedTicket} agents={agents} onBack={() => setSelectedTicket(null)} />
            : <AgentTicketList onSelect={setSelectedTicket} />
        ) : (
          <div className="pt-5">
            <UserChat agents={agents} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
