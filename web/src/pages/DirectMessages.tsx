/**
 * DirectMessages — iOS-style private messaging.
 * Conversation list + chat thread. Wired to dm_conversations + dm_messages.
 * Rendered inline inside CommunityHub.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Send, ArrowLeft, Search, Plus, X as XIcon,
  Loader2, UserPlus, Check, CheckCheck, Reply,
  Copy, Edit2, Trash2, MoreHorizontal, Smile,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { notifyUser } from "@/lib/notifications";

const QUICK_REACTIONS = ["👀", "🚀", "💎", "🔥", "😂", "❤️"];

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface OtherUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_active_at: string | null;
  badge: string | null;
}

interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  updated_at: string;
  otherUser?: OtherUser;
  lastMessage?: DMMessage;
  unreadCount?: number;
}

interface DMMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  read: boolean;
  read_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  message_type: string | null;
}

const dicebear = (seed: string) =>
  `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0a0a0a`;
const safeAvatar = (url: string | null | undefined, fallback: string) =>
  url && url.startsWith("http") ? url : dicebear(fallback);

const fmtTime = (ts: string): string => {
  const d = new Date(ts);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  const diff = (Date.now() - d.getTime()) / 86400000;
  if (diff < 7) return format(d, "EEE");
  return format(d, "M/d/yy");
};

const fmtMsgTime = (ts: string): string => {
  const d = new Date(ts);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday " + format(d, "h:mm a");
  return format(d, "MMM d, h:mm a");
};

const lastSeen = (ts: string | null): string => {
  if (!ts) return "Offline";
  const diff = (Date.now() - new Date(ts).getTime()) / 60000;
  if (diff < 2) return "Active now";
  return "Last seen " + formatDistanceToNow(new Date(ts), { addSuffix: true });
};

/* ═══════════════════════════════════════════════════════════════
   Online Dot
   ═══════════════════════════════════════════════════════════════ */
const OnlineDot = ({ online, size = "md" }: { online: boolean; size?: "sm" | "md" }) => (
  <span
    className={cn(
      "absolute rounded-full border-2 border-black",
      online ? "bg-green-400" : "bg-white/20",
      size === "sm"
        ? "-bottom-0.5 -right-0.5 h-2 w-2"
        : "-bottom-0.5 -right-0.5 h-3 w-3",
    )}
  />
);

/* ═══════════════════════════════════════════════════════════════
   Typing Dots
   ═══════════════════════════════════════════════════════════════ */
const TypingDots = () => (
  <div className="flex items-center gap-1 px-3 py-2.5">
    {[0, 150, 300].map((d) => (
      <span
        key={d}
        className="h-2 w-2 animate-bounce rounded-full bg-white/30"
        style={{ animationDelay: `${d}ms` }}
      />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   DirectMessages — Main Component
   ═══════════════════════════════════════════════════════════════ */
const DirectMessages: React.FC = () => {
  const { user, profile } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OtherUser[]>([]);
  const [showNewDM, setShowNewDM] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [replyTo, setReplyTo] = useState<DMMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<OtherUser[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  /* ─── Fetch active users for quick-start ─── */
  const fetchActiveUsers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, is_online, last_active_at, badge")
      .neq("user_id", user?.id || "")
      .order("last_active_at", { ascending: false })
      .limit(8);
    setActiveUsers(data || []);
  }, [user?.id]);

  /* ─── Fetch conversations ─── */
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConvos(true);

    const { data: convoRows } = await supabase
      .from("dm_conversations")
      .select("*")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!convoRows || convoRows.length === 0) {
      setConvos([]);
      setLoadingConvos(false);
      return;
    }

    const otherIds = convoRows.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, is_online, last_active_at, badge")
      .in("user_id", otherIds);
    const profileMap = new Map(profileRows?.map((p) => [p.user_id, p]) || []);

    const enriched: Conversation[] = [];
    for (const c of convoRows) {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const { data: lastMsgArr } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("conversation_id", c.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      const { count } = await supabase
        .from("dm_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .neq("sender_id", user.id)
        .eq("read", false);
      enriched.push({
        ...c,
        otherUser: profileMap.get(otherId) || {
          user_id: otherId,
          username: null,
          avatar_url: null,
          is_online: false,
          last_active_at: null,
          badge: null,
        },
        lastMessage: lastMsgArr?.[0] || undefined,
        unreadCount: count || 0,
      });
    }

    setConvos(enriched);
    setLoadingConvos(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
    fetchActiveUsers();
  }, [fetchConversations, fetchActiveUsers]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("dm-convo-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchConversations]);

  /* ─── Fetch messages ─── */
  const fetchMessages = useCallback(
    async (convoId: string) => {
      setLoadingMsgs(true);
      const { data } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("conversation_id", convoId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) setMessages(data);
      setLoadingMsgs(false);
      setTimeout(() => scrollToBottom(false), 50);
      if (user) {
        await supabase
          .from("dm_messages")
          .update({ read: true, read_at: new Date().toISOString() })
          .eq("conversation_id", convoId)
          .neq("sender_id", user.id)
          .eq("read", false);
      }
    },
    [user, scrollToBottom],
  );

  useEffect(() => {
    if (!activeConvo) return;
    fetchMessages(activeConvo.id);
    const ch = supabase
      .channel(`dm-msgs-${activeConvo.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `conversation_id=eq.${activeConvo.id}` },
        (payload) => {
          const msg = payload.new as DMMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const tempIdx = prev.findIndex(
              (m) => m.id.startsWith("temp-") && m.sender_id === msg.sender_id && m.body === msg.body,
            );
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = msg;
              return updated;
            }
            return [...prev, msg];
          });
          setTimeout(() => scrollToBottom(), 50);
          if (msg.sender_id !== user?.id) {
            supabase
              .from("dm_messages")
              .update({ read: true, read_at: new Date().toISOString() })
              .eq("id", msg.id);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeConvo, fetchMessages, user, scrollToBottom]);

  /* ─── Typing channel ─── */
  useEffect(() => {
    if (!activeConvo || !user) {
      if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
      if (typingChannelRef.current) { typingChannelRef.current.untrack?.(); supabase.removeChannel(typingChannelRef.current); typingChannelRef.current = null; }
      setTypingUsers(new Set());
      return;
    }
    const ch = supabase.channel(`dm-typing-${activeConvo.id}`, { config: { presence: { key: user.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const typing = new Set<string>();
      Object.entries(state).forEach(([uid, data]) => {
        if (uid !== user.id && Array.isArray(data) && data.some((d: any) => d.typing)) typing.add(uid);
      });
      setTypingUsers(typing);
    });
    ch.subscribe(async (s) => { if (s === "SUBSCRIBED") await ch.track({ typing: false }); });
    typingChannelRef.current = ch;
    return () => {
      if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
      ch.untrack?.();
      supabase.removeChannel(ch);
      if (typingChannelRef.current === ch) typingChannelRef.current = null;
      setTypingUsers(new Set());
    };
  }, [activeConvo, user]);

  const broadcastTyping = useCallback(() => {
    if (!activeConvo || !user || !typingChannelRef.current) return;
    void typingChannelRef.current.track({ typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      void typingChannelRef.current?.track({ typing: false });
      typingTimeoutRef.current = null;
    }, 2000);
  }, [activeConvo, user]);

  /* ─── Send ─── */
  const sendMessage = async () => {
    if (!input.trim() || !user || !activeConvo || sending) return;
    const body = input.trim();
    const replyId = replyTo?.id || null;
    setInput("");
    setReplyTo(null);
    setSending(true);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: DMMessage = {
      id: tempId,
      conversation_id: activeConvo.id,
      sender_id: user.id,
      body,
      image_url: null,
      created_at: new Date().toISOString(),
      read: false,
      read_at: null,
      edited_at: null,
      deleted_at: null,
      reply_to_id: replyId,
      message_type: "text",
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollToBottom(), 20);

    const { error } = await supabase.from("dm_messages").insert({
      conversation_id: activeConvo.id,
      sender_id: user.id,
      body,
      reply_to_id: replyId,
      read: false,
      message_type: "text",
    });

    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    void typingChannelRef.current?.track({ typing: false });

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Failed to send");
      setInput(body);
    } else {
      supabase.from("dm_conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvo.id);
      const otherId = activeConvo.user_a === user.id ? activeConvo.user_b : activeConvo.user_a;
      notifyUser({
        userId: otherId,
        type: "dm",
        title: `💬 ${profile?.username || "Someone"}`,
        message: body.slice(0, 100),
        url: "/messages",
        data: { actor_id: user.id, conversation_id: activeConvo.id },
      });
    }
    setSending(false);
  };

  /* ─── Search users ─── */
  const searchUsers = useCallback(
    async (q: string) => {
      if (q.length < 2) { setSearchResults([]); return; }
      setSearchingUsers(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, badge, is_online, last_active_at")
        .ilike("username", `%${q}%`)
        .neq("user_id", user?.id || "")
        .limit(10);
      setSearchResults((data || []) as OtherUser[]);
      setSearchingUsers(false);
    },
    [user],
  );

  /* ─── Start DM ─── */
  const startConversation = async (otherUserId: string) => {
    if (!user) return;
    const existing = convos.find(
      (c) =>
        (c.user_a === user.id && c.user_b === otherUserId) ||
        (c.user_b === user.id && c.user_a === otherUserId),
    );
    if (existing) { setActiveConvo(existing); setShowNewDM(false); return; }

    const { data, error } = await supabase
      .from("dm_conversations")
      .insert({ user_a: user.id, user_b: otherUserId, created_by: user.id })
      .select()
      .single();
    if (error) { toast.error("Failed to start conversation"); return; }

    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, is_online, last_active_at, badge")
      .eq("user_id", otherUserId)
      .single();

    const newConvo: Conversation = {
      ...data,
      otherUser: otherProfile || { user_id: otherUserId, username: null, avatar_url: null, is_online: false, last_active_at: null, badge: null },
      unreadCount: 0,
    };
    setConvos((prev) => [newConvo, ...prev]);
    setActiveConvo(newConvo);
    setShowNewDM(false);
    toast.success("Conversation started!");
  };

  /* ─── Delete / Edit ─── */
  const deleteMessage = async (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    const { error } = await supabase.from("dm_messages").delete().eq("id", msgId);
    if (error) { toast.error("Could not delete message"); if (activeConvo) fetchMessages(activeConvo.id); }
  };

  const startEdit = (msg: DMMessage) => { setEditingId(msg.id); setEditText(msg.body); };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await supabase.from("dm_messages").update({ body: editText.trim(), edited_at: new Date().toISOString() }).eq("id", editingId);
    setMessages((prev) => prev.map((m) => (m.id === editingId ? { ...m, body: editText.trim(), edited_at: new Date().toISOString() } : m)));
    setEditingId(null);
    setEditText("");
  };

  const copyText = async (body: string | null) => {
    if (!body?.trim()) { toast.error("Nothing to copy"); return; }
    try { await navigator.clipboard.writeText(body); toast.success("Copied"); } catch { toast.error("Could not copy"); }
  };

  const replyToMsg = useMemo(
    () => (replyTo ? messages.find((m) => m.id === replyTo.id) || replyTo : null),
    [replyTo, messages],
  );

  /* ─── filtered convos ─── */
  const filtered = useMemo(() => {
    if (!searchQuery) return convos;
    return convos.filter((c) =>
      (c.otherUser?.username || "").toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [convos, searchQuery]);

  /* ═══════════════════════════════════════════════════════════════
     Render — Conversation List
     ═══════════════════════════════════════════════════════════════ */
  if (!activeConvo) {
    return (
      <div className="flex h-full flex-col bg-background">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
          <h2 className="text-[17px] font-bold text-foreground">Messages</h2>
          <button
            onClick={() => setShowNewDM(!showNewDM)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary transition hover:bg-primary/25"
          >
            {showNewDM ? <XIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>

        {/* ── Search bar ── */}
        <div className="px-4 py-2.5 border-b border-border/40">
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (showNewDM) searchUsers(e.target.value); }}
              placeholder={showNewDM ? "Find people…" : "Search conversations…"}
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            {(searchQuery || showNewDM) && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); setShowNewDM(false); }}>
                <XIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
              </button>
            )}
          </div>
        </div>

        {/* ── New DM user search results ── */}
        {showNewDM && (
          <div className="border-b border-border/40">
            {/* Suggested: active users */}
            {!searchQuery && (
              <div className="px-4 py-3">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Active Users</p>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {activeUsers.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground/40">No users yet</p>
                  ) : (
                    activeUsers.map((u) => (
                      <button
                        key={u.user_id}
                        onClick={() => startConversation(u.user_id)}
                        className="flex flex-col items-center gap-1.5 min-w-[52px]"
                      >
                        <div className="relative">
                          <img
                            src={safeAvatar(u.avatar_url, u.username || u.user_id)}
                            alt=""
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-border/40"
                          />
                          <OnlineDot online={u.is_online} />
                        </div>
                        <span className="text-[10px] font-semibold text-foreground/70 truncate w-12 text-center">
                          {u.username?.split(" ")[0] || "Anon"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Search results */}
            {searchQuery.length >= 2 && (
              <div className="px-4 pb-3">
                {searchingUsers ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="py-3 text-center text-[12px] text-muted-foreground/40">No users found</p>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((u) => (
                      <button
                        key={u.user_id}
                        onClick={() => startConversation(u.user_id)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-muted/50"
                      >
                        <div className="relative">
                          <img
                            src={safeAvatar(u.avatar_url, u.username || u.user_id)}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                          <OnlineDot online={u.is_online} size="sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate">
                            {u.username || "Anon"}
                            {u.badge && <span className="ml-1.5 text-[10px] text-primary">{u.badge}</span>}
                          </p>
                          <p className="text-[11px] text-muted-foreground/50">
                            {u.is_online ? "Online" : lastSeen(u.last_active_at)}
                          </p>
                        </div>
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground/30" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Conversation list ── */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center">
                <Send className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-[14px] font-semibold text-muted-foreground/60">
                {searchQuery ? "No results" : "No messages yet"}
              </p>
              <p className="text-[12px] text-muted-foreground/35">
                {searchQuery ? "Try a different name" : "Tap + to start a conversation"}
              </p>
            </div>
          ) : (
            <div>
              {filtered.map((c) => {
                const unread = (c.unreadCount || 0) > 0;
                const lastMsg = c.lastMessage;
                const preview = lastMsg
                  ? (lastMsg.sender_id === user?.id ? "You: " : "") + (lastMsg.body || "").slice(0, 60)
                  : "Start the conversation";
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveConvo(c)}
                    className="flex w-full items-center gap-3.5 border-b border-border/30 px-4 py-3.5 text-left transition hover:bg-muted/30 active:bg-muted/50"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={safeAvatar(c.otherUser?.avatar_url, c.otherUser?.username || c.otherUser?.user_id || "")}
                        alt=""
                        className={cn(
                          "h-12 w-12 rounded-full object-cover",
                          unread && "ring-2 ring-primary/50",
                        )}
                      />
                      <OnlineDot online={c.otherUser?.is_online || false} />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={cn("text-[15px] truncate", unread ? "font-bold text-foreground" : "font-semibold text-foreground/80")}>
                          {c.otherUser?.username || "User"}
                          {c.otherUser?.badge && (
                            <span className="ml-1.5 text-[10px] text-primary font-normal">{c.otherUser.badge}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                          {lastMsg && (
                            <span className="text-[12px] text-muted-foreground/50">{fmtTime(lastMsg.created_at)}</span>
                          )}
                          {unread && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={cn("text-[13px] truncate", unread ? "text-foreground/70 font-medium" : "text-muted-foreground/55")}>
                        {preview}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     Render — Chat Thread (iOS style)
     ═══════════════════════════════════════════════════════════════ */
  const otherName = activeConvo.otherUser?.username || "User";
  const otherAvatar = safeAvatar(activeConvo.otherUser?.avatar_url, otherName);
  const isOnline = activeConvo.otherUser?.is_online || false;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Chat Header ── */}
      <div className="flex flex-col items-center border-b border-border/60 pt-3 pb-2 px-4 relative">
        <button
          onClick={() => { setActiveConvo(null); setMessages([]); }}
          className="absolute left-4 top-4 text-primary transition hover:text-primary/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="relative mb-1">
          <img src={otherAvatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          <OnlineDot online={isOnline} />
        </div>
        <p className="text-[15px] font-bold text-foreground leading-tight">{otherName}</p>
        <p className={cn("text-[12px] font-medium", isOnline ? "text-green-400" : "text-muted-foreground/50")}>
          {isOnline ? "Online" : lastSeen(activeConvo.otherUser?.last_active_at || null)}
        </p>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loadingMsgs ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="relative">
              <img src={otherAvatar} alt="" className="h-16 w-16 rounded-full object-cover" />
              <OnlineDot online={isOnline} />
            </div>
            <p className="text-[15px] font-bold text-foreground">{otherName}</p>
            <p className="text-[12px] text-muted-foreground/50">Say hello! 👋</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((msg, i) => {
              const isMe = msg.sender_id === user?.id;
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;
              const sameSenderPrev = prevMsg?.sender_id === msg.sender_id;
              const sameSenderNext = nextMsg?.sender_id === msg.sender_id;
              const timeDiff = prevMsg
                ? (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) / 60000
                : 999;
              const compact = sameSenderPrev && timeDiff < 5;

              const showTimestamp =
                i === 0 ||
                (prevMsg &&
                  new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 15 * 60000);

              const replyMsg = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;

              // Bubble shape
              const bubbleRadius = isMe
                ? cn(
                    "rounded-[20px]",
                    !sameSenderPrev && "rounded-tr-[6px]",
                    !sameSenderNext && "rounded-br-[6px]",
                  )
                : cn(
                    "rounded-[20px]",
                    !sameSenderPrev && "rounded-tl-[6px]",
                    !sameSenderNext && "rounded-bl-[6px]",
                  );

              return (
                <React.Fragment key={msg.id}>
                  {showTimestamp && (
                    <div className="flex justify-center my-4">
                      <span className="text-[11px] font-medium text-muted-foreground/50 bg-muted/40 rounded-full px-3 py-1">
                        {fmtMsgTime(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={cn("group flex items-end gap-2", isMe ? "justify-end" : "justify-start", !compact && i > 0 && !showTimestamp && "mt-2")}>
                    {/* Avatar (other user, only on last in group) */}
                    {!isMe && (
                      <div className="flex-shrink-0 w-7">
                        {!sameSenderNext ? (
                          <img src={otherAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : null}
                      </div>
                    )}

                    <div className={cn("max-w-[72%] flex flex-col", isMe ? "items-end" : "items-start")}>
                      {/* Reply quote */}
                      {replyMsg && (
                        <div
                          className={cn(
                            "mb-1 rounded-2xl border border-border/40 bg-muted/30 px-3 py-1.5",
                            isMe ? "mr-1" : "ml-1",
                          )}
                        >
                          <p className="text-[10px] font-bold text-primary/70 mb-0.5">
                            {replyMsg.sender_id === user?.id ? "You" : otherName}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 truncate">{replyMsg.body?.slice(0, 60)}</p>
                        </div>
                      )}

                      {/* Bubble */}
                      {editingId === msg.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="rounded-2xl border border-primary/30 bg-muted/40 px-3 py-2 text-[13px] text-foreground outline-none"
                          />
                          <button onClick={saveEdit} className="text-green-400"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditingId(null)} className="text-muted-foreground/50"><XIcon className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "relative px-3.5 py-2 text-[14px] leading-relaxed",
                            bubbleRadius,
                            isMe
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/70 text-foreground",
                          )}
                          onDoubleClick={() => setReplyTo(msg)}
                        >
                          <p>{msg.body}</p>

                          {/* Time + read receipt */}
                          <div className={cn("mt-0.5 flex items-center gap-1", isMe ? "justify-end" : "justify-start")}>
                            <span className={cn("text-[10px]", isMe ? "text-primary-foreground/60" : "text-muted-foreground/40")}>
                              {format(new Date(msg.created_at), "h:mm a")}
                            </span>
                            {msg.edited_at && (
                              <span className={cn("text-[10px] italic", isMe ? "text-primary-foreground/50" : "text-muted-foreground/35")}>
                                edited
                              </span>
                            )}
                            {isMe && (
                              msg.read
                                ? <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
                                : <Check className="h-3 w-3 text-primary-foreground/40" />
                            )}
                          </div>

                          {/* Hover actions */}
                          <div
                            className={cn(
                              "absolute -top-9 flex items-center gap-0.5 rounded-2xl border border-border/60 bg-card/95 px-1.5 py-1 shadow-xl backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 z-20",
                              isMe ? "right-0" : "left-0",
                            )}
                          >
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => copyText(emoji)}
                                className="rounded-xl px-1.5 py-0.5 text-[14px] hover:bg-muted/60 transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                            <div className="mx-0.5 h-5 w-px bg-border/50" />
                            <button
                              onClick={() => setReplyTo(msg)}
                              className="rounded-xl p-1 text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors"
                              title="Reply"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setMenuOpenId(menuOpenId === msg.id ? null : msg.id)}
                              className="rounded-xl p-1 text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors"
                              title="More"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Context menu */}
                          {menuOpenId === msg.id && (
                            <div
                              className={cn(
                                "absolute z-30 min-w-[150px] rounded-2xl border border-border/60 bg-card p-1 shadow-2xl",
                                isMe ? "right-0 -top-[8rem]" : "left-0 -top-[8rem]",
                              )}
                            >
                              <button
                                onClick={() => { copyText(msg.body); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-foreground/70 hover:bg-muted/50"
                              >
                                <Copy className="h-3.5 w-3.5" /> Copy
                              </button>
                              {isMe && (
                                <button
                                  onClick={() => { startEdit(msg); setMenuOpenId(null); }}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-foreground/70 hover:bg-muted/50"
                                >
                                  <Edit2 className="h-3.5 w-3.5" /> Edit
                                </button>
                              )}
                              {isMe && (
                                <button
                                  onClick={() => { deleteMessage(msg.id); setMenuOpenId(null); }}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-red-400 hover:bg-red-400/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Typing bubble */}
            {typingUsers.size > 0 && (
              <div className="flex items-end gap-2 mt-2">
                <div className="w-7 flex-shrink-0">
                  <img src={otherAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                </div>
                <div className="rounded-[20px] rounded-bl-[6px] bg-muted/70">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Reply preview ── */}
      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border/40 bg-muted/30 px-4 py-2">
          <Reply className="h-3.5 w-3.5 text-primary/60 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-primary/70">
              Replying to {replyTo.sender_id === user?.id ? "yourself" : otherName}
            </p>
            <p className="text-[11px] text-muted-foreground/50 truncate">{replyTo.body?.slice(0, 80)}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground/40 hover:text-muted-foreground">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Input bar (iOS-style) ── */}
      <div className="border-t border-border/60 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <div className="flex-1 rounded-full border border-border/60 bg-muted/40 px-4 py-2 min-h-[36px] flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); broadcastTyping(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`Message ${otherName}…`}
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all",
              input.trim()
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/80 active:scale-95"
                : "bg-muted/60 text-muted-foreground/30",
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DirectMessages;
