/**
 * SupportCenter — Redesigned support page.
 * Users: create tickets + live chat.
 * Agents: manage + reply to all tickets.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle, ArrowLeft, CheckCircle, Clock,
  Headset, Loader2, MessageCircle, Plus, RefreshCw,
  Search, Send, Shield, X, ChevronRight, Sparkles,
  User, Users, Inbox, Check,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { notifyUser, notifyUsers } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { cn, safeAvatarUrl } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Ticket {
  id: string;
  user_id: string;
  username: string | null;
  subject: string;
  status: string | null;
  updated_at: string | null;
  created_at: string | null;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  is_admin: boolean | null;
  created_at: string | null;
}

interface SupportAgentProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
  is_official_account?: boolean | null;
  affiliate_org_id?: string | null;
}

interface PresenceParticipant {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  typing?: boolean;
  is_agent?: boolean;
  last_seen?: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const statusMeta = (status: string | null) => {
  switch (status) {
    case "in_progress":
      return { label: "Live", icon: Clock, dot: "bg-primary", badge: "bg-primary/10 text-primary border-primary/20" };
    case "resolved":
      return { label: "Resolved", icon: CheckCircle, dot: "bg-green-400", badge: "bg-green-400/10 text-green-300 border-green-400/20" };
    default:
      return { label: "Open", icon: AlertCircle, dot: "bg-amber-400", badge: "bg-amber-400/10 text-amber-300 border-amber-400/20" };
  }
};

const dicebear = (seed: string) =>
  `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0a0a0a`;
const safeAv = (url: string | null | undefined, seed: string) =>
  url && url.startsWith("http") ? url : dicebear(seed);

const TypingDots = () => (
  <div className="flex items-center gap-1 px-3 py-2.5">
    {[0, 150, 300].map((d) => (
      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: `${d}ms` }} />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */
const SupportCenter = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { isSupportAgent } = useAdmin();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [supportAgents, setSupportAgents] = useState<SupportAgentProfile[]>([]);
  const [onlineAgentIds, setOnlineAgentIds] = useState<Set<string>>(new Set());
  const [roomParticipants, setRoomParticipants] = useState<PresenceParticipant[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [draftOpeningMessage, setDraftOpeningMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");

  const bottomRef = useRef<HTMLDivElement>(null);
  const rosterChannelRef = useRef<any>(null);
  const roomChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const displayHandle = profile?.username || profile?.display_name || user?.email?.split("@")[0] || "user";

  /* ─── Data loading ─── */
  const refreshTickets = useCallback(async (showSpinner = false) => {
    if (!user) return;
    if (showSpinner) setRefreshing(true);
    else setLoadingTickets(true);
    try {
      let query = supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
      if (!isSupportAgent) query = query.eq("user_id", user.id);
      const { data, error } = await query;
      if (error) throw error;
      const nextTickets = (data || []) as Ticket[];
      setTickets(nextTickets);
      setActiveTicket((current) => {
        if (!current) return current;
        return nextTickets.find((t) => t.id === current.id) || current;
      });
    } catch { toast.error("Could not load support tickets"); }
    finally { setLoadingTickets(false); setRefreshing(false); }
  }, [isSupportAgent, user]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data || []) as SupportMessage[]);
    } catch { toast.error("Could not load chat history"); }
    finally { setLoadingMessages(false); }
  }, []);

  const fetchSupportAgents = useCallback(async () => {
    if (!user) return;
    try {
      const [off, aff] = await Promise.all([
        supabase.from("profiles").select("user_id,username,display_name,avatar_url,verified,is_official_account,affiliate_org_id").eq("is_official_account", true),
        supabase.from("profiles").select("user_id,username,display_name,avatar_url,verified,is_official_account,affiliate_org_id").not("affiliate_org_id", "is", null),
      ]);
      const merged = new Map<string, SupportAgentProfile>();
      for (const row of [...((off.data || []) as SupportAgentProfile[]), ...((aff.data || []) as SupportAgentProfile[])]) merged.set(row.user_id, row);
      if (isSupportAgent) merged.set(user.id, { user_id: user.id, username: profile?.username || null, display_name: profile?.display_name || null, avatar_url: profile?.avatar_url || null });
      setSupportAgents(Array.from(merged.values()));
    } catch { /* silent */ }
  }, [isSupportAgent, profile, user]);

  useEffect(() => { if (!user) return; refreshTickets(); fetchSupportAgents(); }, [fetchSupportAgents, refreshTickets, user]);

  /* ─── Realtime: ticket updates ─── */
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("support-tickets-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => refreshTickets(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refreshTickets, user]);

  /* ─── Presence: agent roster ─── */
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("support-roster", { config: { presence: { key: user.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const online = new Set<string>();
      Object.entries(state).forEach(([key, entries]) => {
        if (Array.isArray(entries) && (entries as any[]).some((e) => e?.is_agent)) online.add(key);
      });
      setOnlineAgentIds(online);
    }).subscribe(async (s) => {
      if (s === "SUBSCRIBED" && isSupportAgent) {
        await ch.track({ user_id: user.id, username: profile?.username || displayHandle, is_agent: true, last_seen: new Date().toISOString() });
      }
    });
    rosterChannelRef.current = ch;
    return () => { ch.untrack?.(); supabase.removeChannel(ch); rosterChannelRef.current = null; };
  }, [displayHandle, isSupportAgent, profile, user]);

  /* ─── Scroll to bottom ─── */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const closeRoomChannel = useCallback(() => {
    if (typingTimeoutRef.current) { window.clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    if (roomChannelRef.current) { roomChannelRef.current.untrack?.(); supabase.removeChannel(roomChannelRef.current); roomChannelRef.current = null; }
    setRoomParticipants([]);
  }, []);

  const updateRoomPresence = useCallback(async (typing: boolean) => {
    if (!roomChannelRef.current || !user) return;
    try {
      await roomChannelRef.current.track({
        user_id: user.id, username: profile?.username || displayHandle,
        display_name: profile?.display_name || null, avatar_url: profile?.avatar_url || null,
        typing, is_agent: isSupportAgent, last_seen: new Date().toISOString(),
      });
    } catch { /* silent */ }
  }, [displayHandle, isSupportAgent, profile, user]);

  /* ─── Realtime: messages + room presence ─── */
  useEffect(() => {
    if (!user || !activeTicket) { closeRoomChannel(); return; }
    fetchMessages(activeTicket.id);
    const msgCh = supabase.channel(`support-messages-${activeTicket.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${activeTicket.id}` }, () => { fetchMessages(activeTicket.id); refreshTickets(true); })
      .subscribe();
    const roomCh = supabase.channel(`support-room-${activeTicket.id}`, { config: { presence: { key: user.id } } });
    roomCh.on("presence", { event: "sync" }, () => {
      const state = roomCh.presenceState();
      const participants: PresenceParticipant[] = [];
      Object.entries(state).forEach(([key, entries]) => {
        (Array.isArray(entries) ? entries as any[] : []).forEach((e) => {
          participants.push({ user_id: e?.user_id || key, username: e?.username || "user", display_name: e?.display_name || null, avatar_url: e?.avatar_url || null, typing: Boolean(e?.typing), is_agent: Boolean(e?.is_agent), last_seen: e?.last_seen });
        });
      });
      const deduped = new Map<string, PresenceParticipant>();
      participants.forEach((p) => deduped.set(p.user_id, p));
      setRoomParticipants(Array.from(deduped.values()));
    }).subscribe(async (s) => {
      if (s === "SUBSCRIBED") await roomCh.track({ user_id: user.id, username: profile?.username || displayHandle, display_name: profile?.display_name || null, avatar_url: profile?.avatar_url || null, typing: false, is_agent: isSupportAgent, last_seen: new Date().toISOString() });
    });
    roomChannelRef.current = roomCh;
    if (isSupportAgent && activeTicket.status === "open") {
      supabase.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", activeTicket.id).then(() => refreshTickets(true)).catch(() => null);
    }
    return () => { supabase.removeChannel(msgCh); closeRoomChannel(); };
  }, [activeTicket, closeRoomChannel, displayHandle, fetchMessages, isSupportAgent, profile, refreshTickets, updateRoomPresence, user]);

  /* ─── Actions ─── */
  const submitTicket = async () => {
    if (!user || !subject.trim()) return;
    try {
      const { data, error } = await supabase.from("support_tickets").insert({
        user_id: user.id, username: profile?.username || displayHandle,
        subject: subject.trim(), status: "open", updated_at: new Date().toISOString(),
      }).select("*").single();
      if (error || !data) throw error || new Error("Ticket creation failed");
      if (draftOpeningMessage.trim()) {
        await supabase.from("support_messages").insert({ ticket_id: data.id, user_id: user.id, content: draftOpeningMessage.trim(), is_admin: false });
      }
      setCreating(false); setSubject(""); setDraftOpeningMessage("");
      setActiveTicket(data as Ticket);
      toast.success("Support ticket created");
      refreshTickets(true);
      const agentIds = supportAgents.map((a) => a.user_id).filter((id) => id && id !== user.id);
      if (agentIds.length > 0) void notifyUsers(agentIds, { type: "support_ticket", title: `🎫 New ticket from ${profile?.username || displayHandle}`, message: subject.trim(), url: "/support", data: { ticketId: data.id } });
    } catch { toast.error("Could not create support ticket"); }
  };

  const sendMessage = async () => {
    if (!user || !activeTicket || !draftMessage.trim() || sending) return;
    setSending(true);
    try {
      const body = draftMessage.trim();
      const { error } = await supabase.from("support_messages").insert({ ticket_id: activeTicket.id, user_id: user.id, content: body, is_admin: isSupportAgent });
      if (error) throw error;
      const nextStatus = isSupportAgent ? "in_progress" : activeTicket.status === "resolved" ? "open" : activeTicket.status || "open";
      await supabase.from("support_tickets").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", activeTicket.id);
      setDraftMessage("");
      await updateRoomPresence(false);
      refreshTickets(true);
      if (isSupportAgent) void notifyUser({ userId: activeTicket.user_id, type: "support_reply", title: "💬 Support replied to your ticket", message: body.slice(0, 140), url: "/support", data: { ticketId: activeTicket.id } });
      else { const agentIds = supportAgents.map((a) => a.user_id).filter((id) => id && id !== user.id); if (agentIds.length > 0) void notifyUsers(agentIds, { type: "support_reply", title: `💬 New message from ${profile?.username || displayHandle}`, message: body.slice(0, 140), url: "/support", data: { ticketId: activeTicket.id } }); }
    } catch { toast.error("Could not send message"); }
    finally { setSending(false); }
  };

  const updateTicketStatus = async (ticketId: string, status: "open" | "in_progress" | "resolved") => {
    try {
      await supabase.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticketId);
      setActiveTicket((cur) => cur?.id === ticketId ? { ...cur, status } : cur);
      refreshTickets(true);
      toast.success(status === "resolved" ? "Ticket resolved" : status === "open" ? "Ticket reopened" : "Ticket set live");
    } catch { toast.error("Could not update ticket"); }
  };

  const handleTyping = () => {
    if (!user) return;
    void updateRoomPresence(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => { void updateRoomPresence(false); typingTimeoutRef.current = null; }, 2000);
  };

  /* ─── Derived state ─── */
  const filteredTickets = useMemo(() => tickets.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    const matchQ = !q || t.subject?.toLowerCase().includes(q) || t.username?.toLowerCase().includes(q);
    const matchF = ticketFilter === "all" || (t.status || "open") === ticketFilter;
    return matchQ && matchF;
  }), [searchQuery, ticketFilter, tickets]);

  const onlineAgents = useMemo(() => supportAgents.filter((a) => onlineAgentIds.has(a.user_id)), [onlineAgentIds, supportAgents]);
  const typingParticipants = useMemo(() => roomParticipants.filter((p) => p.typing && p.user_id !== user?.id), [roomParticipants, user?.id]);

  /* ─── Loading / unauthenticated states ─── */
  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Headset className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-foreground">Support Center</h1>
          <p className="mt-3 text-[14px] text-muted-foreground/70 leading-relaxed">
            Sign in to create a support ticket and chat with the team.
          </p>
          <button
            onClick={() => (window.location.href = "/auth")}
            className="mt-6 rounded-full bg-primary px-6 py-2.5 text-[14px] font-bold text-primary-foreground hover:bg-primary/80 transition"
          >
            Sign in
          </button>
        </div>
      </AppLayout>
    );
  }

  /* ═══ Chat view (active ticket) ═══ */
  if (activeTicket) {
    const meta = statusMeta(activeTicket.status);
    const StatusIcon = meta.icon;

    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-64px)] flex-col bg-background text-foreground">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur-sm">
            <button
              onClick={() => { setActiveTicket(null); setMessages([]); closeRoomChannel(); }}
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-muted/60 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-foreground truncate">{activeTicket.subject}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", meta.badge)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                  {meta.label}
                </span>
                <span className="text-[11px] text-muted-foreground/50">
                  {onlineAgents.length > 0
                    ? `${onlineAgents.length} agent${onlineAgents.length > 1 ? "s" : ""} online`
                    : "Support team • usually replies within 24h"}
                </span>
              </div>
            </div>
            {isSupportAgent && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {activeTicket.status !== "resolved" && (
                  <button
                    onClick={() => updateTicketStatus(activeTicket.id, "resolved")}
                    className="flex items-center gap-1.5 rounded-full bg-green-400/10 border border-green-400/20 px-3 py-1.5 text-[11px] font-bold text-green-300 transition hover:bg-green-400/20"
                  >
                    <Check className="h-3 w-3" /> Resolve
                  </button>
                )}
                {activeTicket.status === "resolved" && (
                  <button
                    onClick={() => updateTicketStatus(activeTicket.id, "open")}
                    className="flex items-center gap-1.5 rounded-full bg-muted/50 border border-border/40 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:bg-muted"
                  >
                    Reopen
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loadingMessages ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <MessageCircle className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-[14px] font-semibold text-muted-foreground/50">No messages yet</p>
                <p className="text-[12px] text-muted-foreground/35">Describe your issue and we'll get back to you.</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.user_id === user.id;
                const isAdmin = msg.is_admin;
                const prevMsg = i > 0 ? messages[i - 1] : null;
                const showDate = !prevMsg || new Date(msg.created_at!).getTime() - new Date(prevMsg.created_at!).getTime() > 15 * 60000;

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] text-muted-foreground/40 bg-muted/30 rounded-full px-3 py-1">
                          {format(new Date(msg.created_at!), "MMM d, h:mm a")}
                        </span>
                      </div>
                    )}
                    <div className={cn("flex items-end gap-2", isMe ? "justify-end" : "justify-start")}>
                      {!isMe && (
                        <div className="flex-shrink-0 w-7 mb-1">
                          {isAdmin ? (
                            <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                              <Shield className="h-3.5 w-3.5 text-primary" />
                            </div>
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center">
                              <User className="h-3.5 w-3.5 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className={cn("max-w-[72%] flex flex-col", isMe ? "items-end" : "items-start")}>
                        {!isMe && i === 0 || (!prevMsg || prevMsg.user_id !== msg.user_id) ? (
                          <p className="text-[11px] font-semibold text-muted-foreground/60 mb-1 ml-1">
                            {isAdmin ? "Support Team" : (activeTicket.username || "User")}
                          </p>
                        ) : null}
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-[6px]"
                              : isAdmin
                              ? "bg-primary/10 border border-primary/20 text-foreground rounded-bl-[6px]"
                              : "bg-muted/60 text-foreground rounded-bl-[6px]",
                          )}
                        >
                          {msg.content}
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground/35 mx-1">
                          {format(new Date(msg.created_at!), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {typingParticipants.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="h-7 w-7 flex-shrink-0 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="rounded-2xl rounded-bl-[6px] bg-muted/60">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/60 bg-card/40 px-4 py-3">
            {activeTicket.status === "resolved" && !isSupportAgent ? (
              <div className="rounded-2xl border border-green-400/20 bg-green-400/5 px-4 py-3 flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                <p className="text-[13px] text-green-300/80 flex-1">This ticket has been resolved. Reply to reopen it.</p>
              </div>
            ) : null}
            <div className="flex items-end gap-2 mt-2">
              <div className="flex-1 rounded-2xl border border-border/60 bg-muted/30 px-4 py-2.5 min-h-[42px]">
                <textarea
                  value={draftMessage}
                  onChange={(e) => { setDraftMessage(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type your message…"
                  rows={1}
                  className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/40 outline-none resize-none"
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!draftMessage.trim() || sending}
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all",
                  draftMessage.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/80 active:scale-95 shadow-sm"
                    : "bg-muted/50 text-muted-foreground/30",
                )}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ═══ Create ticket modal ═══ */
  if (creating) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg px-4 py-10">
          <div className="rounded-3xl border border-border/60 bg-card/80 overflow-hidden shadow-2xl">
            <div className="border-b border-border/40 bg-muted/20 px-6 py-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 border border-primary/20 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-foreground">New Support Ticket</h2>
                <p className="text-[12px] text-muted-foreground/60">Describe your issue and we'll help.</p>
              </div>
              <button onClick={() => setCreating(false)} className="ml-auto text-muted-foreground/50 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your issue"
                  className="w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Message (optional)</label>
                <textarea
                  value={draftOpeningMessage}
                  onChange={(e) => setDraftOpeningMessage(e.target.value)}
                  placeholder="Add more details about your issue…"
                  rows={4}
                  className="w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setCreating(false)} className="flex-1 rounded-full border border-border/60 py-2.5 text-[14px] font-semibold text-muted-foreground hover:bg-muted/40 transition">
                  Cancel
                </button>
                <button
                  onClick={submitTicket}
                  disabled={!subject.trim()}
                  className="flex-1 rounded-full bg-primary py-2.5 text-[14px] font-bold text-primary-foreground hover:bg-primary/80 disabled:opacity-40 transition"
                >
                  Submit Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ═══ Ticket list ═══ */
  const openCount       = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount   = tickets.filter((t) => t.status === "resolved").length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">

        {/* ══════════════════════════════════════════════════════════════
            AGENT / ADMIN HERO  (shown only to support agents & owner)
        ══════════════════════════════════════════════════════════════ */}
        {isSupportAgent ? (
          <div className="mb-8">
            {/* Header row */}
            <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-card to-card p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/15 text-violet-300">
                    <Inbox className="h-7 w-7" />
                    {openCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black">
                        {openCount > 9 ? "9+" : openCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-black text-foreground">Support Inbox</h1>
                      <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-300">
                        Agent View
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground/60 mt-0.5">
                      Manage all user support requests
                    </p>
                  </div>
                </div>

                {/* Online agents badge */}
                <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-muted/30 px-4 py-2.5">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[12px] font-semibold text-foreground/70">
                    You're online
                  </span>
                  <Shield className="h-3.5 w-3.5 text-violet-300 ml-1" />
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-6 grid grid-cols-4 gap-3">
                {[
                  { label: "Open",     value: openCount,       color: "text-amber-300",  bg: "bg-amber-400/10 border-amber-400/20" },
                  { label: "Live",     value: inProgressCount, color: "text-primary",    bg: "bg-primary/10 border-primary/20" },
                  { label: "Resolved", value: resolvedCount,   color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20" },
                  { label: "Total",    value: tickets.length,  color: "text-foreground", bg: "bg-muted/30 border-border/40" },
                ].map((s) => (
                  <div key={s.label} className={cn("rounded-2xl border px-4 py-3 text-center", s.bg)}>
                    <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        ) : (
        /* ══════════════════════════════════════════════════════════════
            USER HERO  (default customer-facing view)
        ══════════════════════════════════════════════════════════════ */
          <div className="mb-8 rounded-3xl border border-border/50 bg-gradient-to-br from-primary/8 via-card to-card p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 text-primary">
                  <Headset className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-foreground">Support Center</h1>
                  <p className="text-[13px] text-muted-foreground/60 mt-0.5">
                    {onlineAgents.length > 0
                      ? <span className="text-green-400 font-semibold">● {onlineAgents.length} agent{onlineAgents.length > 1 ? "s" : ""} online</span>
                      : "Usually replies within 24 hours"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[14px] font-bold text-primary-foreground hover:bg-primary/80 transition"
              >
                <Plus className="h-4 w-4" /> New Ticket
              </button>
            </div>
          </div>
        )}

        {/* ── Filter + Search ── */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/30 px-3 py-2 flex-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets…"
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
            {searchQuery && <button onClick={() => setSearchQuery("")}><X className="h-3.5 w-3.5 text-muted-foreground/40" /></button>}
          </div>
          <div className="flex gap-1.5">
            {(["all", "open", "in_progress", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTicketFilter(f)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
                  ticketFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground/60 hover:bg-muted/70",
                )}
              >
                {f === "all" ? "All" : f === "in_progress" ? "Live" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <button
              onClick={() => refreshTickets(true)}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/60 hover:bg-muted/70 transition"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ── Ticket list ── */}
        {loadingTickets ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border border-border/40 bg-muted/10">
            <Inbox className="h-10 w-10 text-muted-foreground/20" />
            <div className="text-center">
              <p className="text-[15px] font-bold text-muted-foreground/60">
                {searchQuery ? "No matching tickets" : isSupportAgent ? "All clear — inbox is empty" : "No tickets yet"}
              </p>
              <p className="text-[12px] text-muted-foreground/35 mt-1">
                {!searchQuery && (isSupportAgent ? "No pending user requests right now." : "Create your first support ticket to get started.")}
              </p>
            </div>
            {!searchQuery && !isSupportAgent && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-[13px] font-bold text-primary-foreground hover:bg-primary/80 transition"
              >
                <Plus className="h-3.5 w-3.5" /> New Ticket
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTickets.map((ticket) => {
              const meta = statusMeta(ticket.status);
              const StatusIcon = meta.icon;
              const isResolved = ticket.status === "resolved";
              return (
                <button
                  key={ticket.id}
                  onClick={() => setActiveTicket(ticket)}
                  className="w-full flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 px-5 py-4 text-left transition hover:bg-card hover:border-border/80 hover:shadow-sm group"
                >
                  <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", isResolved ? "bg-green-400/10 border border-green-400/20" : "bg-primary/10 border border-primary/20")}>
                    <StatusIcon className={cn("h-4.5 w-4.5", isResolved ? "text-green-400" : "text-primary")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[14px] font-bold text-foreground truncate">{ticket.subject}</p>
                      <span className={cn("flex-shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", meta.badge)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSupportAgent && ticket.username && (
                        <span className="text-[12px] text-muted-foreground/50">@{ticket.username}</span>
                      )}
                      <span className="text-[12px] text-muted-foreground/40">
                        {ticket.updated_at
                          ? formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })
                          : "Just now"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SupportCenter;
