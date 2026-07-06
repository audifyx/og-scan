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
  ImagePlus, Mic, Play, Pause,
  Pin, PinOff, Archive, Inbox,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isUserOnline, usePresenceTick } from "@/lib/presence";
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
  audio_url?: string | null;
  audio_duration_ms?: number | null;
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

/* compact relative time for the active-users hub: "now" · "5m" · "3h" · "2d" */
const agoShort = (ts: string | null): string => {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 3) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
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
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStartRef = useRef<number>(0);
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
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [convoMenuId, setConvoMenuId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  /* ─── Fetch active users for quick-start ─── */
  const fetchActiveUsers = useCallback(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, is_online, last_active_at, badge")
      .neq("user_id", user?.id || "")
      .or(`is_online.eq.true,last_active_at.gte.${sevenDaysAgo}`)
      .order("is_online", { ascending: false })
      .order("last_active_at", { ascending: false })
      .limit(16);
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

  /* ─── Live presence: re-render on a tick + poll fresh status every 30s ─── */
  usePresenceTick(30_000);
  const presenceIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = new Set<string>();
    convos.forEach((c) => { if (c.otherUser?.user_id) ids.add(c.otherUser.user_id); });
    activeUsers.forEach((u) => ids.add(u.user_id));
    if (activeConvo?.otherUser?.user_id) ids.add(activeConvo.otherUser.user_id);
    presenceIdsRef.current = [...ids];
  }, [convos, activeUsers, activeConvo]);

  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const ids = presenceIdsRef.current;
      if (ids.length === 0) return;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, is_online, last_active_at")
        .in("user_id", ids);
      if (!data || data.length === 0) return;
      const fresh = new Map(data.map((p) => [p.user_id, p]));
      const patch = <T extends { user_id: string; is_online: boolean; last_active_at: string | null }>(u: T): T => {
        const f = fresh.get(u.user_id);
        return f ? { ...u, is_online: !!f.is_online, last_active_at: f.last_active_at ?? null } : u;
      };
      setConvos((prev) => prev.map((c) => (c.otherUser ? { ...c, otherUser: patch(c.otherUser) } : c)));
      setActiveUsers((prev) => prev.map(patch));
      setActiveConvo((prev) => (prev?.otherUser ? { ...prev, otherUser: patch(prev.otherUser) } : prev));
    };
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [user]);

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

  /* ─── Conversation actions: pin / archive / delete (pin+archive persisted locally) ─── */
  useEffect(() => {
    if (!user) return;
    try {
      const p = JSON.parse(localStorage.getItem(`dm_pinned_${user.id}`) || "[]");
      const a = JSON.parse(localStorage.getItem(`dm_archived_${user.id}`) || "[]");
      setPinnedIds(new Set(Array.isArray(p) ? p : []));
      setArchivedIds(new Set(Array.isArray(a) ? a : []));
    } catch { /* ignore */ }
  }, [user]);

  const persistConvoSet = (key: string, set: Set<string>) => {
    try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* ignore */ }
  };
  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persistConvoSet(`dm_pinned_${user?.id}`, next);
      return next;
    });
    setConvoMenuId(null);
  };
  const toggleArchive = (id: string) => {
    const wasArchived = archivedIds.has(id);
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persistConvoSet(`dm_archived_${user?.id}`, next);
      return next;
    });
    setConvoMenuId(null);
    toast.success(wasArchived ? "Unarchived" : "Archived");
  };
  const deleteConversation = async (id: string) => {
    if (!window.confirm("Delete this conversation? This permanently removes all messages for both people.")) return;
    setConvoMenuId(null);
    setConvos((prev) => prev.filter((c) => c.id !== id));
    if (activeConvo?.id === id) { setActiveConvo(null); setMessages([]); }
    await supabase.from("dm_messages").delete().eq("conversation_id", id);
    const { error } = await supabase.from("dm_conversations").delete().eq("id", id);
    if (error) { toast.error("Could not delete conversation"); fetchConversations(); }
    else toast.success("Conversation deleted");
  };

  /* ─── Media: image + voice notes (dm-media bucket) ─── */
  const uploadDM = async (file: Blob, ext: string): Promise<string | null> => {
    if (!user) return null;
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("dm-media").upload(path, file, { contentType: (file as File).type || undefined, upsert: false });
    if (error) { toast.error("Upload failed"); return null; }
    return supabase.storage.from("dm-media").getPublicUrl(path).data.publicUrl;
  };

  const sendImage = async (file: File) => {
    if (!user || !activeConvo) return;
    setUploading(true);
    const url = await uploadDM(file, (file.name.split(".").pop() || "jpg").toLowerCase());
    setUploading(false);
    if (!url) return;
    await supabase.from("dm_messages").insert({ conversation_id: activeConvo.id, sender_id: user.id, body: "", image_url: url, message_type: "image", read: false });
    supabase.from("dm_conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvo.id);
    setTimeout(() => scrollToBottom(), 60);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
        setRecording(false);
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        const dur = Date.now() - recStartRef.current;
        setRecSecs(0);
        if (blob.size < 800 || !user || !activeConvo) return;
        setUploading(true);
        const url = await uploadDM(blob, "webm");
        setUploading(false);
        if (!url) return;
        await supabase.from("dm_messages").insert({ conversation_id: activeConvo.id, sender_id: user.id, body: "", audio_url: url, audio_duration_ms: dur, message_type: "voice", read: false });
        supabase.from("dm_conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvo.id);
        setTimeout(() => scrollToBottom(), 60);
      };
      mr.start();
      mediaRecRef.current = mr;
      recStartRef.current = Date.now();
      setRecording(true); setRecSecs(0);
      recTimerRef.current = setInterval(() => setRecSecs((x) => x + 1), 1000);
    } catch { toast.error("Microphone access denied"); }
  };
  const stopRec = (cancel = false) => {
    const mr = mediaRecRef.current;
    if (cancel) { recChunksRef.current = []; if (recTimerRef.current) clearInterval(recTimerRef.current); setRecording(false); setRecSecs(0); }
    if (mr && mr.state !== "inactive") mr.stop();
    mediaRecRef.current = null;
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
    const ts = (c: Conversation) => new Date(c.lastMessage?.created_at || c.updated_at || 0).getTime();
    const base = [...convos].sort((a, b) => ts(b) - ts(a));
    if (!searchQuery) return base;
    return base.filter((c) =>
      (c.otherUser?.username || "").toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [convos, searchQuery]);

  /* ─── organized conversation buckets ─── */
  const visibleConvos = useMemo(
    () => filtered.filter((c) => (showArchived ? archivedIds.has(c.id) : !archivedIds.has(c.id))),
    [filtered, archivedIds, showArchived],
  );
  const pinnedConvos = useMemo(
    () => (showArchived ? [] : visibleConvos.filter((c) => pinnedIds.has(c.id))),
    [visibleConvos, pinnedIds, showArchived],
  );
  const otherConvos = useMemo(
    () => visibleConvos.filter((c) => showArchived || !pinnedIds.has(c.id)),
    [visibleConvos, pinnedIds, showArchived],
  );
  const archivedCount = archivedIds.size;

  const renderConvo = (c: Conversation) => {
    const unread = (c.unreadCount || 0) > 0;
    const lastMsg = c.lastMessage;
    const pinned = pinnedIds.has(c.id);
    const archived = archivedIds.has(c.id);
    const online = isUserOnline(c.otherUser);
    const preview = !lastMsg
      ? "Start the conversation"
      : lastMsg.message_type === "image"
      ? "\uD83D\uDCF7 Photo"
      : lastMsg.message_type === "voice"
      ? "\uD83C\uDFA4 Voice message"
      : (lastMsg.sender_id === user?.id ? "You: " : "") + (lastMsg.body || "").slice(0, 60);
    const menuOpen = convoMenuId === c.id;
    return (
      <div key={c.id} className="group relative border-b border-border/30">
        <div
          onClick={() => setActiveConvo(c)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3.5 py-3.5 pl-4 pr-11 text-left transition hover:bg-muted/30 active:bg-muted/50",
            pinned && "bg-primary/[0.04]",
            activeConvo?.id === c.id && "bg-muted/50",
          )}
        >
          <div className="relative flex-shrink-0">
            <img
              src={safeAvatar(c.otherUser?.avatar_url, c.otherUser?.username || c.otherUser?.user_id || "")}
              alt=""
              className={cn("h-[52px] w-[52px] rounded-full object-cover ring-1 ring-white/[0.08]", unread && "ring-2 ring-[#0A84FF]/70 shadow-[0_0_14px_rgba(10,132,255,0.35)]")}
            />
            <OnlineDot online={online} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center justify-between">
              <span className={cn("flex min-w-0 items-center gap-1 text-[15px]", unread ? "font-bold text-foreground" : "font-semibold text-foreground/80")}>
                {pinned && <Pin className="h-3 w-3 shrink-0 fill-primary/40 text-primary/70" />}
                <span className="truncate">{c.otherUser?.username || "User"}</span>
                {c.otherUser?.badge && <span className="shrink-0 text-[10px] font-normal text-primary">{c.otherUser.badge}</span>}
              </span>
              <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
                {lastMsg && <span className="text-[12px] text-muted-foreground/50">{fmtTime(lastMsg.created_at)}</span>}
                {unread && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0A84FF] px-1 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(10,132,255,0.5)]">
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </div>
            <p className={cn("truncate text-[13px]", unread ? "font-medium text-foreground/70" : "text-muted-foreground/55")}>
              {online && <span className="text-green-400">Active now · </span>}
              {preview}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setConvoMenuId(menuOpen ? null : c.id); }}
          data-open={menuOpen}
          title="Conversation options"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/45 transition hover:bg-muted hover:text-foreground active:scale-90 data-[open=true]:bg-muted data-[open=true]:text-foreground"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setConvoMenuId(null)} />
            <div className="absolute right-3 top-[60%] z-50 w-44 overflow-hidden rounded-xl border border-border/60 bg-popover py-1 shadow-xl">
              <button onClick={() => togglePin(c.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-foreground transition hover:bg-muted">
                {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                {pinned ? "Unpin" : "Pin to top"}
              </button>
              <button onClick={() => toggleArchive(c.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-foreground transition hover:bg-muted">
                {archived ? <Inbox className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {archived ? "Unarchive" : "Archive"}
              </button>
              <div className="my-1 h-px bg-border/50" />
              <button onClick={() => deleteConversation(c.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-red-400 transition hover:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     Render — Two-pane Messenger (sidebar + chat)
     ═══════════════════════════════════════════════════════════════ */
  /* ─── derived active-chat values ─── */
  const otherName = activeConvo?.otherUser?.username || "User";
  const otherAvatar = safeAvatar(activeConvo?.otherUser?.avatar_url, otherName);
  const isOnline = isUserOnline(activeConvo?.otherUser);

  return (
    <div className="relative flex h-full overflow-hidden bg-background">
      {/* iMessage-style ambient depth */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-[#0A84FF]/[0.07] blur-[100px]" />
        <div className="absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-[#9945FF]/[0.06] blur-[110px]" />
      </div>
      {/* LEFT — conversation sidebar */}
      <aside className={cn("relative z-10 h-full w-full flex-col border-r border-white/[0.07] bg-background/60 backdrop-blur-xl md:w-[360px] md:flex-shrink-0", activeConvo ? "hidden md:flex" : "flex")}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="min-w-0">
            <h2 className="text-[20px] font-black tracking-tight text-foreground">Messages</h2>
            <p className="text-[11px] text-muted-foreground/50">{convos.length} conversation{convos.length === 1 ? "" : "s"}</p>
          </div>
          <button
            onClick={() => setShowNewDM(!showNewDM)}
            title={showNewDM ? "Close" : "New message"}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full transition", showNewDM ? "bg-muted text-foreground" : "bg-gradient-to-br from-[#2F80FF] to-[#9945FF] text-white shadow-[0_8px_20px_-8px_rgba(47,128,255,0.8)] hover:opacity-90")}
          >
            {showNewDM ? <XIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
        {/* ── Active hub: online + last 7 days, always visible ── */}
        {!showArchived && activeUsers.length > 0 && (
          <div className="border-b border-border/40 px-4 pb-3 pt-1">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Active this week
            </p>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-0.5">
              {activeUsers.map((u) => {
                const online = isUserOnline(u);
                return (
                <button
                  key={u.user_id}
                  onClick={() => startConversation(u.user_id)}
                  title={online ? "Active now" : lastSeen(u.last_active_at)}
                  className="group flex w-[54px] shrink-0 flex-col items-center gap-1"
                >
                  <div className={cn("relative rounded-full p-[2px] transition group-active:scale-95", online ? "bg-gradient-to-tr from-emerald-400 via-[#2F80FF] to-[#9945FF]" : "bg-border/70")}>
                    <img
                      src={safeAvatar(u.avatar_url, u.username || u.user_id)}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-background transition group-hover:scale-[1.04]"
                    />
                    {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-400" />}
                  </div>
                  <span className="w-[54px] truncate text-center text-[10px] font-semibold text-foreground/75">{u.username?.split(" ")[0] || "Anon"}</span>
                  <span className={cn("-mt-0.5 text-[9px] font-bold", online ? "text-emerald-400" : "text-muted-foreground/40")}>{online ? "now" : agoShort(u.last_active_at)}</span>
                </button>
                );
              })}
            </div>
          </div>
        )}

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
                          <OnlineDot online={isUserOnline(u)} />
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
                          <OnlineDot online={isUserOnline(u)} size="sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate">
                            {u.username || "Anon"}
                            {u.badge && <span className="ml-1.5 text-[10px] text-primary">{u.badge}</span>}
                          </p>
                          <p className="text-[11px] text-muted-foreground/50">
                            {isUserOnline(u) ? "Online" : lastSeen(u.last_active_at)}
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
          ) : visibleConvos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40">
                {showArchived ? <Archive className="h-6 w-6 text-muted-foreground/30" /> : <Send className="h-6 w-6 text-muted-foreground/30" />}
              </div>
              <p className="text-[14px] font-semibold text-muted-foreground/60">
                {searchQuery ? "No results" : showArchived ? "No archived chats" : "No messages yet"}
              </p>
              <p className="text-[12px] text-muted-foreground/35">
                {searchQuery ? "Try a different name" : showArchived ? "Archived conversations show up here" : "Tap + to start a conversation"}
              </p>
            </div>
          ) : (
            <div>
              {pinnedConvos.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-4 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                    <Pin className="h-3 w-3" /> Pinned
                  </div>
                  {pinnedConvos.map(renderConvo)}
                </>
              )}
              {otherConvos.length > 0 && (
                <>
                  {pinnedConvos.length > 0 && (
                    <div className="px-4 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                      {showArchived ? "Archived" : "All messages"}
                    </div>
                  )}
                  {otherConvos.map(renderConvo)}
                </>
              )}
            </div>
          )}

          {/* Archived toggle */}
          {!showArchived && archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(true)}
              className="flex w-full items-center justify-center gap-2 border-t border-border/40 px-4 py-3 text-[12px] font-semibold text-muted-foreground/60 transition hover:bg-muted/30"
            >
              <Archive className="h-3.5 w-3.5" /> Archived ({archivedCount})
            </button>
          )}
          {showArchived && (
            <button
              onClick={() => setShowArchived(false)}
              className="flex w-full items-center justify-center gap-2 border-t border-border/40 px-4 py-3 text-[12px] font-semibold text-primary transition hover:bg-muted/30"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to messages
            </button>
          )}
        </div>
      </aside>

      {/* RIGHT — chat panel */}
      <main className={cn("relative z-10 h-full min-w-0 flex-1 flex-col bg-transparent", activeConvo ? "flex" : "hidden md:flex")}>
        {!activeConvo ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2F80FF]/15 to-[#9945FF]/15">
              <Send className="h-9 w-9 text-primary/60" />
            </div>
            <div>
              <p className="text-[18px] font-black text-foreground">Your messages</p>
              <p className="mt-1 max-w-xs text-[13px] text-muted-foreground/50">Pick a conversation on the left or start a new one to begin chatting.</p>
            </div>
            <button onClick={() => setShowNewDM(true)} className="mt-1 rounded-full bg-gradient-to-br from-[#2F80FF] to-[#9945FF] px-5 py-2 text-[13px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(47,128,255,0.8)] transition hover:opacity-90">
              New message
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <button onClick={() => { setActiveConvo(null); setMessages([]); }} className="text-primary transition hover:text-primary/70 md:hidden">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="relative shrink-0">
                <img src={otherAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                <OnlineDot online={isOnline} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[15px] font-bold leading-tight text-foreground">
                  <span className="truncate">{otherName}</span>
                  {activeConvo.otherUser?.badge && <span className="shrink-0 text-[10px] font-semibold text-primary">{activeConvo.otherUser.badge}</span>}
                </p>
                <p className={cn("text-[12px] font-medium", isOnline ? "text-green-400" : "text-muted-foreground/50")}>
                  {isOnline ? "Active now" : lastSeen(activeConvo.otherUser?.last_active_at || null)}
                </p>
              </div>
              <button onClick={() => togglePin(activeConvo.id)} title={pinnedIds.has(activeConvo.id) ? "Unpin" : "Pin"} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground">
                {pinnedIds.has(activeConvo.id) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
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
                              ? "bg-gradient-to-b from-[#0A84FF] to-[#0B6FE8] text-white shadow-[0_8px_24px_-10px_rgba(10,132,255,0.8)]"
                              : "border border-white/[0.08] bg-[#3a3a3c]/55 text-foreground shadow-[0_4px_16px_-8px_rgba(0,0,0,0.6)] backdrop-blur-xl",
                          )}
                          onDoubleClick={() => setReplyTo(msg)}
                        >
                          {msg.image_url && (
                            <img src={msg.image_url} alt="" loading="lazy" className="mb-1 max-h-72 w-full max-w-[260px] rounded-2xl object-cover" />
                          )}
                          {msg.audio_url && <VoiceNote src={msg.audio_url} durationMs={msg.audio_duration_ms ?? null} mine={isMe} />}
                          {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}

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
                <div className="rounded-[20px] rounded-bl-[6px] border border-white/[0.08] bg-[#3a3a3c]/55 backdrop-blur-xl">
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

      {/* ── Input bar (iOS-style, glass) ── */}
      <div className="border-t border-white/[0.07] bg-white/[0.03] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
        {recording ? (
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 backdrop-blur">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-[13px] font-semibold text-foreground">Recording… {recSecs}s</span>
            <div className="flex-1" />
            <button onClick={() => stopRec(true)} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={() => stopRec(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#0A84FF] to-[#0B6FE8] text-white shadow-[0_4px_14px_rgba(10,132,255,0.5)] active:scale-95"><Send className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input type="file" accept="image/*" ref={imgInputRef} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); if (e.currentTarget) e.currentTarget.value = ""; }} />
            <button onClick={() => imgInputRef.current?.click()} disabled={uploading} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground transition hover:text-foreground disabled:opacity-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            </button>
            <div className="flex-1 rounded-full border border-white/[0.12] bg-white/[0.07] px-4 py-2 min-h-[36px] flex items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl">
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); broadcastTyping(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Message ${otherName}…`}
                className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
            </div>
            {input.trim() ? (
              <button onClick={sendMessage} disabled={sending} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#0A84FF] to-[#0B6FE8] text-white shadow-[0_4px_14px_rgba(10,132,255,0.5)] transition active:scale-95">
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={startRec} disabled={uploading} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground transition hover:text-foreground">
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
          </>
        )}
      </main>
    </div>
  );
};

function VoiceNote({ src, durationMs, mine }: { src: string; durationMs: number | null; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  const secs = Math.max(1, Math.round((durationMs || 0) / 1000));
  const toggle = () => { const a = ref.current; if (!a) return; if (playing) a.pause(); else void a.play(); };
  return (
    <div className="flex items-center gap-2 py-0.5">
      <button onClick={toggle} className={cn("flex h-8 w-8 items-center justify-center rounded-full", mine ? "bg-white/25" : "bg-white/10")}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex items-center gap-[2px]">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className={cn("w-[2px] rounded-full", mine ? "bg-white/70" : "bg-foreground/40")} style={{ height: `${6 + ((i * 7) % 15)}px` }} />
        ))}
      </div>
      <span className="text-[10px] opacity-70">{secs}s</span>
      <audio ref={ref} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}

export default DirectMessages;
