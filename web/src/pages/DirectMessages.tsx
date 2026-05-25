/**
 * DirectMessages — Full private messaging system.
 * Conversation list + chat thread. Wired to dm_conversations + dm_messages.
 * Rendered inline inside CommunityHub.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MessageSquare, Send, ArrowLeft, Search, Plus, MoreHorizontal,
  Trash2, Check, CheckCheck, Image, Smile, Reply, X as XIcon,
  Loader2, UserPlus, Edit2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { notifyUser } from "@/lib/notifications";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  updated_at: string;
  // Enriched client-side
  otherUser?: {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    is_online: boolean;
    last_active_at: string | null;
    badge: string | null;
  };
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showNewDM, setShowNewDM] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [replyTo, setReplyTo] = useState<DMMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

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

    // Gather other user IDs
    const otherIds = convoRows.map(c => c.user_a === user.id ? c.user_b : c.user_a);
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, is_online, last_active_at, badge")
      .in("user_id", otherIds);
    const profileMap = new Map(profileRows?.map(p => [p.user_id, p]) || []);

    // Fetch last message for each conversation
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
        otherUser: profileMap.get(otherId) || { user_id: otherId, username: null, avatar_url: null, is_online: false, last_active_at: null, badge: null },
        lastMessage: lastMsgArr?.[0] || undefined,
        unreadCount: count || 0,
      });
    }

    setConvos(enriched);
    setLoadingConvos(false);
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  /* ─── Real-time conversation updates ─── */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dm-convo-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  /* ─── Fetch messages for active conversation ─── */
  const fetchMessages = useCallback(async (convoId: string) => {
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

    // Mark unread as read
    if (user) {
      await supabase
        .from("dm_messages")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("conversation_id", convoId)
        .neq("sender_id", user.id)
        .eq("read", false);
    }
  }, [user, scrollToBottom]);

  useEffect(() => {
    if (!activeConvo) return;
    fetchMessages(activeConvo.id);

    // Real-time messages for this conversation
    const channel = supabase
      .channel(`dm-msgs-${activeConvo.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `conversation_id=eq.${activeConvo.id}` },
        (payload) => {
          const msg = payload.new as DMMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => scrollToBottom(), 50);
          // Auto-mark as read
          if (msg.sender_id !== user?.id) {
            supabase.from("dm_messages").update({ read: true, read_at: new Date().toISOString() }).eq("id", msg.id);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConvo, fetchMessages, user, scrollToBottom]);

  /* ─── Typing indicator ─── */
  useEffect(() => {
    if (!activeConvo || !user) return;
    const channel = supabase.channel(`dm-typing-${activeConvo.id}`, {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const typing = new Set<string>();
      Object.entries(state).forEach(([uid, data]) => {
        if (uid !== user.id && Array.isArray(data) && data.some((d: any) => d.typing)) {
          typing.add(uid);
        }
      });
      setTypingUsers(typing);
    });

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvo, user]);

  const broadcastTyping = useCallback(() => {
    if (!activeConvo || !user) return;
    const ch = supabase.channel(`dm-typing-${activeConvo.id}`);
    ch.track({ typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      ch.track({ typing: false });
    }, 2000);
  }, [activeConvo, user]);

  /* ─── Send message ─── */
  const sendMessage = async () => {
    if (!input.trim() || !user || !activeConvo || sending) return;
    const body = input.trim();
    setInput("");
    setReplyTo(null);
    setSending(true);
    const { error } = await supabase.from("dm_messages").insert({
      conversation_id: activeConvo.id,
      sender_id: user.id,
      body,
      reply_to_id: replyTo?.id || null,
      read: false,
      message_type: "text",
    });
    if (error) {
      toast.error("Failed to send");
      setInput(body);
    } else {
      // Update conversation timestamp
      await supabase.from("dm_conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvo.id);
      // Notify recipient (in-app + push)
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

  /* ─── Search users for new DM ─── */
  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, badge, is_online")
      .ilike("username", `%${q}%`)
      .neq("user_id", user?.id || "")
      .limit(10);
    setSearchResults(data || []);
    setSearchingUsers(false);
  }, [user]);

  /* ─── Start new DM ─── */
  const startConversation = async (otherUserId: string) => {
    if (!user) return;

    // Check if conversation already exists
    const existing = convos.find(c =>
      (c.user_a === user.id && c.user_b === otherUserId) ||
      (c.user_b === user.id && c.user_a === otherUserId)
    );
    if (existing) {
      setActiveConvo(existing);
      setShowNewDM(false);
      return;
    }

    // Create new conversation
    const { data, error } = await supabase
      .from("dm_conversations")
      .insert({ user_a: user.id, user_b: otherUserId, created_by: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Failed to start conversation");
      return;
    }

    // Fetch other user profile
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

    setConvos(prev => [newConvo, ...prev]);
    setActiveConvo(newConvo);
    setShowNewDM(false);
    toast.success("Conversation started!");
  };

  /* ─── Delete message ─── */
  const deleteMessage = async (msgId: string) => {
    await supabase.from("dm_messages").update({ deleted_at: new Date().toISOString() }).eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  /* ─── Edit message ─── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (msg: DMMessage) => {
    setEditingId(msg.id);
    setEditText(msg.body);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await supabase.from("dm_messages").update({ body: editText.trim(), edited_at: new Date().toISOString() }).eq("id", editingId);
    setMessages(prev => prev.map(m => m.id === editingId ? { ...m, body: editText.trim(), edited_at: new Date().toISOString() } : m));
    setEditingId(null);
    setEditText("");
  };

  const formatMsgTime = (ts: string) => {
    const d = new Date(ts);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return "Yesterday " + format(d, "h:mm a");
    return format(d, "MMM d, h:mm a");
  };

  const replyToMsg = useMemo(() => {
    if (!replyTo) return null;
    return messages.find(m => m.id === replyTo.id) || replyTo;
  }, [replyTo, messages]);

  /* ═══════════════════════════════════════════════════════════════
     Render — Conversation List
     ═══════════════════════════════════════════════════════════════ */

  if (!activeConvo) {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="h-4 w-4 text-white/40" />
            <span className="text-sm font-black tracking-wide text-white">Messages</span>
          </div>
          <button
            onClick={() => setShowNewDM(true)}
            className="rounded-lg bg-og-lime/10 p-1.5 text-og-lime transition hover:bg-og-lime/20"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* New DM Search Modal */}
        {showNewDM && (
          <div className="border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-white/25" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                placeholder="Search users..."
                autoFocus
                className="flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 outline-none"
              />
              <button onClick={() => { setShowNewDM(false); setSearchQuery(""); setSearchResults([]); }} className="text-white/30 hover:text-white/60">
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            {searchingUsers && <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin text-white/20" />}
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1">
                {searchResults.map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => startConversation(u.user_id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="relative">
                      <img src={safeAvatar(u.avatar_url, u.username || u.user_id)} alt="" className="h-7 w-7 rounded-full object-cover" />
                      {u.is_online && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0e14] bg-og-lime" />}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-white/70">{u.username || "Anon"}</span>
                      {u.badge && <span className="ml-1 text-[9px] text-og-gold">{u.badge}</span>}
                    </div>
                    <UserPlus className="ml-auto h-3.5 w-3.5 text-white/20" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-white/20" />
            </div>
          ) : convos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <MessageSquare className="mb-3 h-10 w-10 text-white/[0.06]" />
              <p className="text-sm font-bold text-white/20">No messages yet</p>
              <p className="mt-1 text-[10px] text-white/10">Tap + to start a conversation</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {convos.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveConvo(c)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={safeAvatar(c.otherUser?.avatar_url, c.otherUser?.username || c.otherUser?.user_id || "")}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    {c.otherUser?.is_online && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0e14] bg-og-lime" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-white/80 truncate">
                        {c.otherUser?.username || "User"}
                        {c.otherUser?.badge && <span className="ml-1 text-[9px] text-og-gold">{c.otherUser.badge}</span>}
                      </span>
                      {c.lastMessage && (
                        <span className="text-[9px] text-white/15 flex-shrink-0">
                          {formatDistanceToNow(new Date(c.lastMessage.created_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] text-white/30 truncate flex-1">
                        {c.lastMessage
                          ? (c.lastMessage.sender_id === user?.id ? "You: " : "") + (c.lastMessage.body || "").slice(0, 50)
                          : "No messages yet"
                        }
                      </p>
                      {(c.unreadCount || 0) > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-og-lime px-1 text-[9px] font-black text-black">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     Render — Chat Thread
     ═══════════════════════════════════════════════════════════════ */

  const otherName = activeConvo.otherUser?.username || "User";
  const otherAvatar = safeAvatar(activeConvo.otherUser?.avatar_url, otherName);

  return (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
        <button onClick={() => { setActiveConvo(null); setMessages([]); }} className="text-white/40 hover:text-white/70 transition">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="relative">
          <img src={otherAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          {activeConvo.otherUser?.is_online && (
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0e14] bg-og-lime" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-bold text-white/80">{otherName}</span>
          <p className="text-[9px] text-white/25">
            {activeConvo.otherUser?.is_online
              ? "Online now"
              : activeConvo.otherUser?.last_active_at
              ? `Last seen ${formatDistanceToNow(new Date(activeConvo.otherUser.last_active_at), { addSuffix: true })}`
              : "Offline"
            }
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-3">
        {loadingMsgs ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/20" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <MessageSquare className="mb-3 h-10 w-10 text-white/[0.06]" />
            <p className="text-sm font-bold text-white/20">Start the conversation</p>
            <p className="mt-1 text-[10px] text-white/10">Say hello to {otherName}!</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((msg, i) => {
              const isMe = msg.sender_id === user?.id;
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const sameSender = prevMsg?.sender_id === msg.sender_id;
              const timeDiff = prevMsg ? (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) / 60000 : 999;
              const compact = sameSender && timeDiff < 5;

              // Find reply-to message
              const replyMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;

              return (
                <div key={msg.id} className={cn("group flex", isMe ? "justify-end" : "justify-start", !compact && i > 0 && "mt-3")}>
                  <div className={cn("max-w-[80%] sm:max-w-[70%]")}>
                    {/* Reply preview */}
                    {replyMsg && (
                      <div className={cn("mb-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px]", isMe ? "ml-auto" : "")}>
                        <span className="font-bold text-og-cyan/50">{replyMsg.sender_id === user?.id ? "You" : otherName}</span>
                        <p className="text-white/25 truncate">{replyMsg.body?.slice(0, 60)}</p>
                      </div>
                    )}

                    {editingId === msg.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && saveEdit()}
                          autoFocus
                          className="rounded-lg border border-og-cyan/20 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/80 outline-none"
                        />
                        <button onClick={saveEdit} className="text-og-lime"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-white/30"><XIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "relative rounded-2xl px-3 py-2 text-[12px] leading-relaxed",
                          isMe
                            ? "bg-og-lime/15 text-white/80 rounded-br-sm"
                            : "bg-white/[0.06] text-white/70 rounded-bl-sm",
                        )}
                      >
                        <p>{msg.body}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[8px] text-white/15">{formatMsgTime(msg.created_at)}</span>
                          {msg.edited_at && <span className="text-[8px] italic text-white/10">edited</span>}
                          {isMe && (
                            msg.read
                              ? <CheckCheck className="h-2.5 w-2.5 text-og-cyan/50" />
                              : <Check className="h-2.5 w-2.5 text-white/15" />
                          )}
                        </div>

                        {/* Hover actions */}
                        <div className={cn(
                          "absolute top-0 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100",
                          isMe ? "-left-16" : "-right-16",
                        )}>
                          <button onClick={() => setReplyTo(msg)} className="rounded p-1 text-white/20 hover:bg-white/[0.06] hover:text-white/50">
                            <Reply className="h-3 w-3" />
                          </button>
                          {isMe && (
                            <>
                              <button onClick={() => startEdit(msg)} className="rounded p-1 text-white/20 hover:bg-white/[0.06] hover:text-white/50">
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button onClick={() => deleteMessage(msg.id)} className="rounded p-1 text-white/20 hover:bg-red-500/20 hover:text-red-400/60">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.size > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-white/25">
            <div className="flex gap-0.5">
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/20" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/20" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/20" style={{ animationDelay: "300ms" }} />
            </div>
            {otherName} is typing…
          </div>
        )}
      </div>

      {/* Reply preview bar */}
      {replyTo && (
        <div className="flex items-center gap-2 border-t border-white/[0.05] bg-white/[0.02] px-4 py-2">
          <Reply className="h-3.5 w-3.5 text-og-cyan/40" />
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold text-og-cyan/50">Replying to {replyTo.sender_id === user?.id ? "yourself" : otherName}</span>
            <p className="text-[10px] text-white/25 truncate">{replyTo.body?.slice(0, 80)}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-white/20 hover:text-white/50">
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); broadcastTyping(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Message ${otherName}…`}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition",
              input.trim() ? "bg-og-lime text-black hover:bg-og-lime/80" : "text-white/15",
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DirectMessages;
