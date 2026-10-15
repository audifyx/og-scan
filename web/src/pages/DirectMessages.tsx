/**
 * DirectMessages — iOS-style private messaging.
 * Conversation list + chat thread. Wired to dm_conversations + dm_messages.
 * Rendered inline inside CommunityHub.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Send, ArrowLeft, Search, Plus, X as XIcon, MailPlus,
  Loader2, UserPlus, Check, CheckCheck, Reply,
  Copy, Edit2, Trash2, MoreHorizontal, Smile,
  ImagePlus, Mic, Play, Pause,
  Pin, PinOff, Archive, Inbox,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateUploadFile, safeExtForMime, MEDIA_MIME_ALLOWLIST } from "@/lib/safeUpload";
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
  const uploadDM = async (file: Blob, ext: string, allow?: readonly string[]): Promise<string | null> => {
    if (!user) return null;
    const vErr = validateUploadFile(file, { maxMB: 5, allow });
    if (vErr) { toast.error(vErr); return null; }
    const safeExt = safeExtForMime((file as File).type || "");
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
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
        const url = await uploadDM(blob, "webm", MEDIA_MIME_ALLOWLIST);
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
  /* ═══════════════════════════════════════════════════════════════
     Render — X-style DMs: conversation list + thread
     ═══════════════════════════════════════════════════════════════ */
  const otherName = activeConvo?.otherUser?.username || "User";
  const otherAvatar = safeAvatar(activeConvo?.otherUser?.avatar_url, otherName);
  const otherHandle = "@" + (activeConvo?.otherUser?.username || "user").toLowerCase().replace(/\s+/g, "");
  const convoHandle = (c: Conversation) => "@" + (c.otherUser?.username || "user").toLowerCase().replace(/\s+/g, "");

  const renderRow = (c: Conversation) => {
    const unread = (c.unreadCount || 0) > 0;
    const lastMsg = c.lastMessage;
    const preview = !lastMsg
      ? "Start the conversation"
      : (lastMsg.sender_id === user?.id ? "You: " : "") + (lastMsg.body || "").slice(0, 80);
    const active = activeConvo?.id === c.id;
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => setActiveConvo(c)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]",
          active && "bg-white/[0.06]",
        )}
      >
        <img
          src={safeAvatar(c.otherUser?.avatar_url, c.otherUser?.username || c.otherUser?.user_id || "")}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-[15px] font-bold text-[#e7e9ea]">{c.otherUser?.username || "User"}</span>
            <span className="shrink-0 truncate text-[14px] text-[#71767b]">
              {convoHandle(c)}{lastMsg ? ` · ${fmtTime(lastMsg.created_at)}` : ""}
            </span>
          </span>
          <span className={cn("mt-0.5 block truncate text-[14px]", unread ? "font-semibold text-[#e7e9ea]" : "text-[#71767b]")}>
            {preview}
          </span>
        </span>
        {unread && (
          <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-[#1d9bf0] px-1.5 text-[11px] font-bold text-white">
            {c.unreadCount}
          </span>
        )}
      </button>
    );
  };

  const threadMessages = messages.filter((m) => !m.deleted_at);

  return (
    <div className="flex h-full bg-black text-[#e7e9ea]">
      {/* ── LEFT: conversation list ── */}
      <div className={cn("flex h-full w-full flex-col border-r border-[#2f3336] md:w-[380px] md:min-w-[320px] md:max-w-[420px]", activeConvo ? "hidden md:flex" : "flex")}>
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <h2 className="text-[20px] font-extrabold tracking-tight text-white">Messages</h2>
          <button
            type="button"
            onClick={() => { setShowNewDM((v) => !v); setSearchQuery(""); setSearchResults([]); }}
            className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10"
            aria-label="New message"
          >
            {showNewDM ? <XIcon className="h-5 w-5" /> : <MailPlus className="h-5 w-5" />}
          </button>
        </div>
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 rounded-full border border-[#2f3336] bg-[#16181c] px-4 py-2 focus-within:border-[#1d9bf0]">
            <Search className="h-4 w-4 shrink-0 text-[#71767b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (showNewDM) searchUsers(e.target.value); }}
              placeholder={showNewDM ? "Search people" : "Search messages"}
              className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-[#71767b]"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }} aria-label="Clear">
                <XIcon className="h-4 w-4 text-[#71767b]" />
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {showNewDM ? (
            searchQuery.length >= 2 ? (
              searchingUsers ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#71767b]" /></div>
              ) : searchResults.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-[#71767b]">No people found</p>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => startConversation(u.user_id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                  >
                    <img src={safeAvatar(u.avatar_url, u.username || u.user_id)} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-white">{u.username || "Anon"}</span>
                      <span className="block truncate text-[13px] text-[#71767b]">Start a conversation</span>
                    </span>
                  </button>
                ))
              )
            ) : (
              <p className="px-4 py-8 text-center text-[14px] text-[#71767b]">Type to search people</p>
            )
          ) : loadingConvos ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1d9bf0]" /></div>
          ) : visibleConvos.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <p className="text-[20px] font-extrabold text-white">No messages yet</p>
              <p className="mx-auto mt-1 max-w-[260px] text-[14px] text-[#71767b]">Tap the compose button above to start a conversation.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2f3336]">{visibleConvos.map(renderRow)}</div>
          )}
        </div>
      </div>

      {/* ── RIGHT: active thread ── */}
      <div className={cn("h-full min-w-0 flex-1 flex-col", activeConvo ? "flex" : "hidden md:flex")}>
        {activeConvo ? (
          <>
            <div className="flex items-center gap-3 border-b border-[#2f3336] px-3 py-2.5">
              <button
                type="button"
                onClick={() => setActiveConvo(null)}
                className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10 md:hidden"
                aria-label="Back to messages"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <img src={otherAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-extrabold text-white">{otherName}</div>
                <div className="truncate text-[13px] text-[#71767b]">{otherHandle}</div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loadingMsgs ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1d9bf0]" /></div>
              ) : threadMessages.length === 0 ? (
                <div className="py-16 text-center text-[14px] text-[#71767b]">Say hello — start the conversation.</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {threadMessages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-snug",
                            mine
                              ? "rounded-3xl rounded-br-md bg-[#1d9bf0] text-white"
                              : "rounded-3xl rounded-bl-md bg-[#2f3336] text-[#e7e9ea]",
                          )}
                        >
                          {m.image_url && (
                            <img src={m.image_url} alt="" className="mb-1.5 max-h-56 rounded-2xl object-cover" />
                          )}
                          {m.body}
                        </div>
                      </div>
                    );
                  })}
                  {typingUsers.size > 0 && (
                    <div className="flex justify-start">
                      <div className="rounded-3xl rounded-bl-md bg-[#2f3336] px-4 py-3"><TypingDots /></div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
            <div className="border-t border-[#2f3336] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Start a new message"
                  className="min-w-0 flex-1 rounded-full border border-[#2f3336] bg-transparent px-4 py-2.5 text-[15px] text-white outline-none placeholder:text-[#71767b] focus:border-[#1d9bf0]"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1d9bf0] text-white transition hover:brightness-110 disabled:opacity-30"
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="hidden h-full flex-col items-center justify-center px-8 text-center md:flex">
            <p className="text-[28px] font-extrabold text-white">Select a message</p>
            <p className="mx-auto mt-1 max-w-[300px] text-[14px] text-[#71767b]">
              Choose from your existing conversations, or start a new one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DirectMessages;
