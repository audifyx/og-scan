/**
 * CommunityRooms — backend-backed crypto-native group and community chat.
 * Uses Supabase tables for rooms, messages, members, reports, warnings,
 * mutes, bans, reactions, and moderation audit logs.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Archive, BadgeCheck, Ban, Bell, BookOpen, CalendarDays,
  CheckCircle2, ChevronLeft, Crown, EyeOff, FileText, Flag, Gauge, Hash,
  Image as ImageIcon, Link2, Loader2, Lock, Megaphone, MessageSquare,
  Mic, MoreHorizontal, Pin, Plus, Radio, Search, Send, Settings, Shield,
  ShieldCheck, Smile, Sparkles, Trash2, UserMinus, UserPlus, Users, VolumeX,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type RoomRole = "owner" | "admin" | "moderator" | "helper" | "verified" | "member";
type RoomType = "public" | "private" | "invite_only" | "community" | "team" | "project" | "research" | "trading" | "local";
type ModerationDuration = "15m" | "1h" | "6h" | "24h" | "7d";

interface ProfileLite {
  username: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
}

interface ProfileRow extends ProfileLite {
  user_id: string;
}

interface Room {
  id: string;
  community_id?: string | null;
  name: string;
  description: string | null;
  category?: string | null;
  room_type?: RoomType | string | null;
  is_private?: boolean | null;
  is_public?: boolean | null;
  is_locked?: boolean | null;
  is_read_only?: boolean | null;
  is_hidden?: boolean | null;
  is_archived?: boolean | null;
  is_pinned?: boolean | null;
  sort_order?: number | null;
  member_count: number;
  online_count?: number | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  rules?: string | null;
  pinned_announcement?: string | null;
  shared_links?: Array<{ label: string; url: string }> | null;
  media_gallery?: unknown[] | null;
  created_by?: string | null;
  host_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
}

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  message_type?: string | null;
  media_url?: string | null;
  file_url?: string | null;
  reply_to_id?: string | null;
  quote_message_id?: string | null;
  is_pinned: boolean;
  is_deleted?: boolean | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  profiles?: ProfileLite | null;
}

interface AttachmentDraft {
  url: string;
  caption: string;
}

interface Member {
  room_id: string;
  user_id: string;
  role: RoomRole;
  joined_at: string;
  warning_count?: number | null;
  reputation_score?: number | null;
  activity_score?: number | null;
  muted_until?: string | null;
  banned_until?: string | null;
  is_banned?: boolean | null;
  profiles?: ProfileLite | null;
}

interface RoomReport {
  id: string;
  room_id: string;
  message_id?: string | null;
  reported_user_id?: string | null;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
}

interface ModAction {
  id: string;
  room_id: string;
  moderator_id?: string | null;
  target_user_id?: string | null;
  message_id?: string | null;
  action_type: string;
  reason?: string | null;
  created_at: string;
}

const ROOM_TYPES: { value: RoomType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "public", label: "Public", Icon: Hash },
  { value: "private", label: "Private", Icon: Lock },
  { value: "invite_only", label: "Invite-only", Icon: Shield },
  { value: "community", label: "Community", Icon: Users },
  { value: "team", label: "Team", Icon: BadgeCheck },
  { value: "project", label: "Project", Icon: Sparkles },
  { value: "research", label: "Research", Icon: BookOpen },
  { value: "trading", label: "Trading Talk", Icon: Gauge },
  { value: "local", label: "Local", Icon: Radio },
];

const DEFAULT_CHANNELS = ["general", "announcements", "research", "questions", "memes", "support", "events", "spaces-discussion"];
const QUICK_EMOJIS = ["🔥", "💎", "🚀", "👀", "✅", "💯", "🧠", "🛡️"];
const MOD_ROLES: RoomRole[] = ["owner", "admin", "moderator"];

const durationToExpiry = (duration: ModerationDuration) => {
  const mins: Record<ModerationDuration, number> = { "15m": 15, "1h": 60, "6h": 360, "24h": 1440, "7d": 10080 };
  return new Date(Date.now() + mins[duration] * 60_000).toISOString();
};

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatShortDate = (value: string) => new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
const IMAGE_URL_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i;

const isImageUrl = (value: string) => IMAGE_URL_RE.test(value) || value.includes("images") || value.includes("img") || value.includes("photo");

const slugifyRoomName = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9- ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "room";
};

async function buildUniqueRoomSlug(name: string) {
  const baseSlug = slugifyRoomName(name);
  const { data, error } = await supabase
    .from("community_rooms")
    .select("slug")
    .ilike("slug", `${baseSlug}%`)
    .limit(100);

  if (error) {
    console.error("community room slug lookup failed", error);
    return baseSlug;
  }

  const taken = new Set(((data || []) as Array<{ slug: string | null }>).map(row => row.slug).filter(Boolean) as string[]);
  if (!taken.has(baseSlug)) return baseSlug;

  for (let index = 2; index <= 1000; index += 1) {
    const candidate = `${baseSlug}-${index}`.slice(0, 64);
    if (!taken.has(candidate)) return candidate;
  }

  return `${baseSlug}-${Date.now()}`.slice(0, 64);
}

async function fetchProfilesMap(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {} as Record<string, ProfileLite>;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, avatar_url, verified")
    .in("user_id", ids);

  if (error) {
    console.error("community room profile load failed", error);
    return {} as Record<string, ProfileLite>;
  }

  return ((data || []) as ProfileRow[]).reduce<Record<string, ProfileLite>>((acc, row) => {
    acc[row.user_id] = {
      username: row.username,
      avatar_url: row.avatar_url,
      verified: row.verified,
    };
    return acc;
  }, {});
}

const roleTone: Record<RoomRole, string> = {
  owner: "border-og-gold/25 bg-og-gold/10 text-og-gold",
  admin: "border-og-cyan/25 bg-og-cyan/10 text-og-cyan",
  moderator: "border-og-lime/25 bg-og-lime/10 text-og-lime",
  helper: "border-blue-400/25 bg-blue-400/10 text-blue-300",
  verified: "border-purple-400/25 bg-purple-400/10 text-purple-300",
  member: "border-white/10 bg-white/[0.04] text-white/40",
};

function Avatar({ url, username, size = "md" }: { url?: string | null; username?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs";
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.05] font-black uppercase text-white/45", sizeClass)}>
      {url ? <img src={url} alt={username || ""} className="h-full w-full object-cover" /> : (username || "?").charAt(0)}
    </div>
  );
}

function RoleBadge({ role }: { role: RoomRole }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest", roleTone[role])}>
      {role}
    </span>
  );
}

function RoomIcon({ room }: { room: Room }) {
  const meta = ROOM_TYPES.find(type => type.value === room.room_type);
  const Icon = room.is_locked ? Lock : meta?.Icon || Hash;
  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border",
      room.is_read_only ? "border-og-gold/20 bg-og-gold/10 text-og-gold" : "border-og-cyan/20 bg-og-cyan/10 text-og-cyan"
    )}>
      {room.avatar_url ? <img src={room.avatar_url} alt="" className="h-full w-full object-cover" /> : <Icon className="h-4 w-4" />}
    </div>
  );
}

function MessageRow({
  msg,
  isOwn,
  canModerate,
  onPin,
  onDelete,
  onReport,
  onReact,
  onReply,
}: {
  msg: Message;
  isOwn: boolean;
  canModerate: boolean;
  onPin: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReport: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
}) {
  const attachmentUrl = msg.media_url || msg.file_url;
  const hasAttachment = !!attachmentUrl;
  const attachmentIsImage = !!msg.media_url || (!!attachmentUrl && isImageUrl(attachmentUrl));
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={cn("group flex gap-2.5", isOwn && "flex-row-reverse")}>
      <Avatar url={msg.profiles?.avatar_url} username={msg.profiles?.username} size="sm" />
      <div className={cn("min-w-0 max-w-[78%]", isOwn ? "items-end" : "items-start", "flex flex-col gap-1")}>
        <div className={cn("flex items-center gap-1.5 px-1", isOwn && "flex-row-reverse")}>
          <span className="truncate text-xs font-bold text-white/65">{isOwn ? "You" : msg.profiles?.username || "Member"}</span>
          {msg.profiles?.verified && <BadgeCheck className="h-3 w-3 text-og-cyan" />}
          <span className="text-[10px] text-white/20">{formatTime(msg.created_at)}</span>
          {msg.edited_at && <span className="text-[9px] text-white/18">edited</span>}
        </div>
        <div
          className={cn(
            "relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
            isOwn ? "rounded-tr-sm bg-og-cyan/20 text-white" : "rounded-tl-sm bg-white/[0.06] text-white/86",
            msg.is_pinned && "ring-1 ring-og-gold/40",
          )}
        >
          {msg.is_pinned && <Pin className="mr-1 inline h-3 w-3 text-og-gold" />}
          {msg.is_deleted ? (
            <span className="italic text-white/30">Message deleted</span>
          ) : (
            <div className="space-y-2">
              {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
              {hasAttachment && (
                attachmentIsImage ? (
                  <a href={attachmentUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <img src={attachmentUrl || undefined} alt="Attachment" className="max-h-72 w-full object-cover" />
                  </a>
                ) : (
                  <a href={attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white/80 hover:bg-black/30">
                    <Link2 className="h-3.5 w-3.5 text-og-cyan" />
                    Open attachment
                  </a>
                )
              )}
            </div>
          )}
        </div>
        <div className={cn("flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100", isOwn && "flex-row-reverse")}>
          {QUICK_EMOJIS.slice(0, 4).map(emoji => (
            <button key={emoji} onClick={() => onReact(msg, emoji)} className="rounded-lg px-1 text-xs hover:bg-white/[0.06]">{emoji}</button>
          ))}
          <button onClick={() => onReply(msg)} className="rounded-lg p-1 text-white/25 hover:bg-white/[0.06] hover:text-white/60" title="Reply">
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-1 text-white/25 hover:bg-white/[0.06] hover:text-white/60" title="More">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute z-30 mt-8 min-w-[150px] rounded-xl border border-white/10 bg-[#11111a] p-1 shadow-2xl">
              {(canModerate || isOwn) && (
                <button onClick={() => { onPin(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/55 hover:bg-white/[0.05]">
                  <Pin className="h-3.5 w-3.5" /> {msg.is_pinned ? "Unpin" : "Pin"}
                </button>
              )}
              <button onClick={() => { navigator.clipboard?.writeText(msg.content); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/55 hover:bg-white/[0.05]">
                <FileText className="h-3.5 w-3.5" /> Copy
              </button>
              <button onClick={() => { onReport(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/55 hover:bg-white/[0.05]">
                <Flag className="h-3.5 w-3.5" /> Report
              </button>
              {(canModerate || isOwn) && (
                <button onClick={() => { onDelete(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-red-300 hover:bg-red-400/10">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CommunityRooms: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [reports, setReports] = useState<RoomReport[]>([]);
  const [modActions, setModActions] = useState<ModAction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<"active" | "discover" | "archived">("active");
  const [sidePanel, setSidePanel] = useState<"members" | "moderation" | "info" | null>("info");
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", description: "", room_type: "public" as RoomType, category: "General", rules: "" });
  const [modTarget, setModTarget] = useState<Member | null>(null);
  const [modReason, setModReason] = useState("");
  const [modDuration, setModDuration] = useState<ModerationDuration>("1h");
  const [localOnline, setLocalOnline] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft>({ url: "", caption: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const realtimeRef = useRef<any>(null);
  const presenceRef = useRef<any>(null);

  const currentMember = useMemo(() => members.find(member => member.user_id === user?.id), [members, user?.id]);
  const canModerate = !!currentMember && MOD_ROLES.includes(currentMember.role);
  const isMuted = !!currentMember?.muted_until && new Date(currentMember.muted_until).getTime() > Date.now();
  const isBanned = !!currentMember?.is_banned || (!!currentMember?.banned_until && new Date(currentMember.banned_until).getTime() > Date.now());
  const pinnedMessages = messages.filter(message => message.is_pinned && !message.is_deleted);
  const requestedRoomId = useMemo(() => new URLSearchParams(window.location.search).get("room"), []);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const haystack = `${room.name} ${room.description || ""} ${room.category || ""}`.toLowerCase();
      const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
      const matchesState = roomFilter === "archived" ? room.is_archived : roomFilter === "discover" ? !room.is_archived : !room.is_archived && !room.is_hidden;
      return matchesSearch && matchesState;
    });
  }, [rooms, roomFilter, searchQuery]);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    const { data, error } = await supabase
      .from("community_rooms")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(80);
    if (error) {
      console.error("community room load failed", error);
      toast.error("Could not load community chats");
    } else {
      const rows = (data || []) as Room[];
      setRooms(rows);
      const requestedRoom = requestedRoomId ? rows.find(room => room.id === requestedRoomId) : null;
      if (requestedRoom) {
        setActiveRoom(requestedRoom);
      } else if (!activeRoom && rows.length > 0) {
        setActiveRoom(rows[0]);
      }
    }
    setLoadingRooms(false);
  }, [activeRoom, requestedRoomId]);

  const loadMembers = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from("community_room_members")
      .select("*")
      .eq("room_id", roomId)
      .order("role", { ascending: true })
      .limit(200);

    if (error) {
      console.error("community member load failed", error);
      return;
    }

    const rows = (data || []) as Member[];
    const profilesMap = await fetchProfilesMap(rows.map(member => member.user_id));
    setMembers(rows.map(member => ({ ...member, profiles: profilesMap[member.user_id] || null })));
  }, []);

  const loadMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from("community_room_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) {
      console.error("community message load failed", error);
      toast.error("Could not load messages");
      setMessages([]);
    } else {
      const rows = (data || []) as Message[];
      const profilesMap = await fetchProfilesMap(rows.map(message => message.sender_id));
      setMessages(rows.reverse().map(message => ({ ...message, profiles: profilesMap[message.sender_id] || null })));
    }
    setLoadingMessages(false);
  }, []);

  const loadModeration = useCallback(async (roomId: string) => {
    if (!canModerate) {
      setReports([]);
      setModActions([]);
      return;
    }
    const [reportRows, actionRows] = await Promise.all([
      supabase.from("community_room_reports").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(50),
      supabase.from("community_room_moderation_actions").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (!reportRows.error) setReports((reportRows.data || []) as RoomReport[]);
    if (!actionRows.error) setModActions((actionRows.data || []) as ModAction[]);
  }, [canModerate]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  useEffect(() => {
    if (!activeRoom) return;
    loadMessages(activeRoom.id);
    loadMembers(activeRoom.id);
  }, [activeRoom, loadMembers, loadMessages]);

  useEffect(() => {
    if (!activeRoom || !canModerate) return;
    loadModeration(activeRoom.id);
  }, [activeRoom, canModerate, loadModeration]);

  useEffect(() => {
    if (!activeRoom) return;
    realtimeRef.current?.unsubscribe();
    realtimeRef.current = supabase
      .channel(`community-room-messages-${activeRoom.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_room_messages", filter: `room_id=eq.${activeRoom.id}` }, () => loadMessages(activeRoom.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "community_room_members", filter: `room_id=eq.${activeRoom.id}` }, () => loadMembers(activeRoom.id))
      .subscribe();
    return () => { realtimeRef.current?.unsubscribe(); };
  }, [activeRoom, loadMembers, loadMessages]);

  useEffect(() => {
    if (!activeRoom || !user) return;
    presenceRef.current?.unsubscribe();
    const channel = supabase.channel(`community-presence-${activeRoom.id}`, { config: { presence: { key: user.id } } });
    channel.on("presence", { event: "sync" }, () => setLocalOnline(Object.keys(channel.presenceState()).length));
    channel.subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id, username: profile?.username || "Member", online_at: new Date().toISOString() });
      }
    });
    presenceRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [activeRoom, profile?.username, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const createRoom = async () => {
    if (!user || !newRoom.name.trim()) return;

    const roomName = newRoom.name.trim().slice(0, 80);
    const roomSlug = await buildUniqueRoomSlug(roomName);

    const { data, error } = await supabase.from("community_rooms").insert({
      name: roomName,
      slug: roomSlug,
      description: newRoom.description.trim() || null,
      category: newRoom.category,
      room_type: newRoom.room_type,
      is_private: newRoom.room_type !== "public",
      is_public: newRoom.room_type === "public",
      rules: newRoom.rules.trim() || null,
      created_by: user.id,
      host_id: user.id,
      member_count: 1,
    }).select().single();
    if (error) {
      toast.error(error.message || "Room creation failed");
      return;
    }
    await supabase.from("community_room_members").upsert({ room_id: data.id, user_id: user.id, role: "owner" }, { onConflict: "room_id,user_id" });
    await supabase.from("community_room_moderation_actions").insert({ room_id: data.id, moderator_id: user.id, action_type: "channel_created", reason: `Created #${roomSlug}` });
    setRooms(prev => [data as Room, ...prev]);
    setActiveRoom(data as Room);
    setShowCreateModal(false);
    setNewRoom({ name: "", description: "", room_type: "public", category: "General", rules: "" });
    toast.success("Chat room created");
  };

  const sendMessage = async () => {
    if (!user || !activeRoom || !input.trim() || sending) return;
    if (activeRoom.is_locked || activeRoom.is_archived) { toast.error("This channel is locked"); return; }
    if (activeRoom.is_read_only && !canModerate) { toast.error("This channel is read-only"); return; }
    if (isMuted) { toast.error("You are muted in this chat"); return; }
    if (isBanned) { toast.error("You are banned from this chat"); return; }
    const recent = messages.slice(-4).filter(msg => msg.sender_id === user.id).map(msg => msg.content.trim().toLowerCase());
    if (recent.includes(input.trim().toLowerCase())) { toast.error("Duplicate message blocked"); return; }
    setSending(true);
    const content = input.trim();
    setInput("");
    const { error } = await supabase.from("community_room_messages").insert({
      room_id: activeRoom.id,
      sender_id: user.id,
      content,
      reply_to_id: replyTo?.id || null,
    });
    if (error) {
      toast.error(error.message || "Message failed");
      setInput(content);
    } else {
      setReplyTo(null);
      await supabase.from("community_rooms").update({ last_message: content.slice(0, 180), last_message_at: new Date().toISOString() }).eq("id", activeRoom.id);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const pinMessage = async (message: Message) => {
    if (!activeRoom || !canModerate) return;
    await supabase.from("community_room_messages").update({ is_pinned: !message.is_pinned }).eq("id", message.id);
    await supabase.from("community_room_moderation_actions").insert({
      room_id: activeRoom.id,
      moderator_id: user?.id,
      message_id: message.id,
      action_type: message.is_pinned ? "message_unpinned" : "message_pinned",
    });
    loadMessages(activeRoom.id);
  };

  const deleteMessage = async (message: Message) => {
    if (!activeRoom || (!canModerate && message.sender_id !== user?.id)) return;
    await supabase.from("community_room_messages").update({ is_deleted: true, deleted_at: new Date().toISOString(), content: "[deleted]" }).eq("id", message.id);
    if (canModerate) {
      await supabase.from("community_room_moderation_actions").insert({ room_id: activeRoom.id, moderator_id: user?.id, target_user_id: message.sender_id, message_id: message.id, action_type: "message_deleted" });
    }
    loadMessages(activeRoom.id);
  };

  const reportMessage = async (message: Message) => {
    if (!activeRoom || !user) return;
    const reason = window.prompt("Report reason");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("community_room_reports").insert({
      room_id: activeRoom.id,
      message_id: message.id,
      reported_user_id: message.sender_id,
      reporter_id: user.id,
      reason: reason.trim(),
    });
    if (error) toast.error("Could not report message");
    else toast.success("Report sent to moderators");
  };

  const reactToMessage = async (message: Message, emoji: string) => {
    if (!user) return;
    await supabase.from("community_room_reactions").upsert({ message_id: message.id, user_id: user.id, emoji }, { onConflict: "message_id,user_id,emoji" });
  };

  const logModAction = async (target: Member, action_type: string, reason?: string) => {
    if (!activeRoom || !user) return;
    await supabase.from("community_room_moderation_actions").insert({
      room_id: activeRoom.id,
      moderator_id: user.id,
      target_user_id: target.user_id,
      action_type,
      reason: reason || null,
    });
    loadModeration(activeRoom.id);
  };

  const addEmojiToComposer = (emoji: string) => {
    setInput(prev => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${emoji}`.trimStart());
    setShowEmojiPicker(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const copyRoomLink = async () => {
    if (!activeRoom) return;
    const roomPath = `${window.location.origin}${window.location.pathname}?room=${activeRoom.id}`;
    try {
      await navigator.clipboard.writeText(roomPath);
      toast.success("Room link copied");
    } catch {
      toast.error("Could not copy room link");
    }
  };

  const sendAttachment = async () => {
    if (!user || !activeRoom) return;
    const url = attachmentDraft.url.trim();
    const caption = attachmentDraft.caption.trim();

    if (!url) {
      toast.error("Add a media or file URL");
      return;
    }

    const payload = {
      room_id: activeRoom.id,
      sender_id: user.id,
      content: caption || url,
      media_url: isImageUrl(url) ? url : null,
      file_url: isImageUrl(url) ? null : url,
      message_type: isImageUrl(url) ? "image" : "attachment",
    };

    const { error } = await supabase.from("community_room_messages").insert(payload);
    if (error) {
      toast.error(error.message || "Attachment failed");
      return;
    }

    await supabase
      .from("community_rooms")
      .update({ last_message: caption || "Shared an attachment", last_message_at: new Date().toISOString() })
      .eq("id", activeRoom.id);

    setAttachmentDraft({ url: "", caption: "" });
    setShowAttachModal(false);
    toast.success("Attachment sent");
  };

  const warnMember = async () => {
    if (!activeRoom || !user || !modTarget || !modReason.trim()) return;
    await supabase.from("community_room_warnings").insert({ room_id: activeRoom.id, user_id: modTarget.user_id, moderator_id: user.id, reason: modReason.trim() });
    await supabase.from("community_room_members").update({ warning_count: (modTarget.warning_count || 0) + 1 }).eq("room_id", activeRoom.id).eq("user_id", modTarget.user_id);
    await logModAction(modTarget, "user_warned", modReason.trim());
    toast.success("Warning issued");
    setModReason("");
    loadMembers(activeRoom.id);
  };

  const muteMember = async () => {
    if (!activeRoom || !user || !modTarget) return;
    const expiresAt = durationToExpiry(modDuration);
    await supabase.from("community_room_mutes").insert({ room_id: activeRoom.id, user_id: modTarget.user_id, moderator_id: user.id, reason: modReason.trim() || null, expires_at: expiresAt });
    await supabase.from("community_room_members").update({ muted_until: expiresAt }).eq("room_id", activeRoom.id).eq("user_id", modTarget.user_id);
    await logModAction(modTarget, "user_muted", modReason.trim() || modDuration);
    toast.success("Member muted");
    loadMembers(activeRoom.id);
  };

  const banMember = async () => {
    if (!activeRoom || !user || !modTarget) return;
    const expiresAt = modDuration === "7d" ? null : durationToExpiry(modDuration);
    await supabase.from("community_room_bans").insert({ room_id: activeRoom.id, user_id: modTarget.user_id, moderator_id: user.id, reason: modReason.trim() || null, expires_at: expiresAt });
    await supabase.from("community_room_members").update({ is_banned: true, banned_until: expiresAt }).eq("room_id", activeRoom.id).eq("user_id", modTarget.user_id);
    await logModAction(modTarget, "user_banned", modReason.trim() || (expiresAt ? modDuration : "permanent"));
    toast.success("Member banned");
    loadMembers(activeRoom.id);
  };

  const updateMemberRole = async (member: Member, role: RoomRole) => {
    if (!activeRoom || !canModerate) return;
    await supabase.from("community_room_members").update({ role }).eq("room_id", activeRoom.id).eq("user_id", member.user_id);
    await logModAction(member, "role_changed", role);
    loadMembers(activeRoom.id);
  };

  const toggleRoomFlag = async (field: "is_locked" | "is_read_only" | "is_hidden" | "is_archived", value: boolean) => {
    if (!activeRoom || !canModerate) return;
    const { data } = await supabase.from("community_rooms").update({ [field]: value }).eq("id", activeRoom.id).select().single();
    await supabase.from("community_room_moderation_actions").insert({ room_id: activeRoom.id, moderator_id: user?.id, action_type: `channel_${field}_${value ? "enabled" : "disabled"}` });
    if (data) setActiveRoom(data as Room);
    loadRooms();
  };

  const sidePanelContent = sidePanel === "info" ? (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/25">Room Rules</p>
        <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/55">{activeRoom?.rules || "No rules posted yet. Keep it helpful, respectful, and crypto-focused."}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Members", value: activeRoom?.member_count || members.length, Icon: Users },
          { label: "Online", value: localOnline || activeRoom?.online_count || 0, Icon: Bell },
          { label: "Pinned", value: pinnedMessages.length, Icon: Pin },
          { label: "Reports", value: reports.length, Icon: Flag },
        ].map(item => (
          <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
            <item.Icon className="mb-2 h-4 w-4 text-white/35" />
            <p className="text-lg font-black text-white">{item.value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/25">{item.label}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/25">Connected Features</p>
        <div className="mt-2 space-y-2">
          {[
            { label: "Spaces discussion", Icon: Mic, action: () => navigate("/spaces") },
            { label: "Scheduled events", Icon: CalendarDays, action: () => navigate("/spaces") },
            { label: "Shared links", Icon: Link2, action: copyRoomLink },
            { label: "Moderation logs", Icon: ShieldCheck, action: () => setSidePanel("moderation") },
          ].map(item => (
            <button key={item.label} onClick={item.action} className="flex w-full items-center gap-2 rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2 text-left text-xs text-white/50 transition hover:border-white/[0.08] hover:bg-black/30 hover:text-white/80">
              <item.Icon className="h-3.5 w-3.5 text-og-cyan/65" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {canModerate && activeRoom && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/25">Channel Controls</p>
          {[
            { field: "is_locked" as const, label: "Lock channel", value: !!activeRoom.is_locked, Icon: Lock },
            { field: "is_read_only" as const, label: "Read-only", value: !!activeRoom.is_read_only, Icon: Megaphone },
            { field: "is_hidden" as const, label: "Hidden", value: !!activeRoom.is_hidden, Icon: EyeOff },
            { field: "is_archived" as const, label: "Archived", value: !!activeRoom.is_archived, Icon: Archive },
          ].map(control => (
            <button key={control.field} onClick={() => toggleRoomFlag(control.field, !control.value)} className="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-white/50 hover:bg-white/[0.04]">
              <control.Icon className="h-3.5 w-3.5" />
              <span className="flex-1">{control.label}</span>
              {control.value && <CheckCircle2 className="h-3.5 w-3.5 text-og-lime" />}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : sidePanel === "members" ? (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/25">Members ({members.length})</p>
        <button onClick={copyRoomLink} className="rounded-lg p-1.5 text-white/25 hover:bg-white/[0.05] hover:text-white" title="Copy room invite link">
          <UserPlus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1">
        {members.map(member => (
          <div key={member.user_id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-2.5">
            <div className="flex items-center gap-2">
              <Avatar url={member.profiles?.avatar_url} username={member.profiles?.username} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white/70">{member.profiles?.username || "Member"}</p>
                <p className="text-[9px] text-white/25">Joined {formatShortDate(member.joined_at)}</p>
              </div>
              <RoleBadge role={member.role} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center">
              <span className="rounded-lg bg-black/20 px-1 py-1 text-[9px] text-white/28">Rep {member.reputation_score || 0}</span>
              <span className="rounded-lg bg-black/20 px-1 py-1 text-[9px] text-white/28">Act {member.activity_score || 0}</span>
              <span className="rounded-lg bg-black/20 px-1 py-1 text-[9px] text-white/28">Warn {member.warning_count || 0}</span>
            </div>
            {canModerate && member.user_id !== user?.id && member.role !== "owner" && (
              <div className="mt-2 flex gap-1">
                <button onClick={() => setModTarget(member)} className="flex-1 rounded-lg bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-white/45 hover:text-white">Manage</button>
                <select value={member.role} onChange={event => updateMemberRole(member, event.target.value as RoomRole)} className="rounded-lg border border-white/[0.06] bg-[#10131a] px-2 py-1 text-[10px] text-white/50">
                  {(["admin", "moderator", "helper", "verified", "member"] as RoomRole[]).map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : sidePanel === "moderation" ? (
    <div className="space-y-4">
      {!canModerate ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-center">
          <Shield className="mx-auto h-8 w-8 text-white/12" />
          <p className="mt-2 text-sm font-bold text-white/30">Moderator access required</p>
        </div>
      ) : (
        <>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/25">Open Reports</p>
            <div className="space-y-2">
              {reports.length === 0 ? <p className="rounded-xl bg-white/[0.025] p-3 text-xs text-white/25">No reports.</p> : reports.map(report => (
                <div key={report.id} className="rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3">
                  <p className="text-xs font-bold text-white/70">{report.reason}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-widest text-white/25">{report.status} · {formatShortDate(report.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/25">Audit Log</p>
            <div className="space-y-2">
              {modActions.length === 0 ? <p className="rounded-xl bg-white/[0.025] p-3 text-xs text-white/25">No actions logged.</p> : modActions.map(action => (
                <div key={action.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <p className="text-xs font-bold text-white/65">{action.action_type.replace(/_/g, " ")}</p>
                  {action.reason && <p className="mt-1 text-[10px] text-white/30">{action.reason}</p>}
                  <p className="mt-1 text-[9px] uppercase tracking-widest text-white/18">{formatShortDate(action.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#08090d] text-white">
      <aside className="flex w-[310px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0d0f15] max-md:w-[92px]">
        <div className="flex items-center gap-2 border-b border-white/[0.06] p-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 text-white/35 hover:bg-white/[0.05] hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 max-md:hidden">
            <h1 className="text-sm font-black uppercase tracking-widest">Community Chats</h1>
            <p className="text-[10px] text-white/25">{rooms.length} backend channels</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="rounded-xl border border-og-cyan/20 bg-og-cyan/10 p-2 text-og-cyan hover:bg-og-cyan/20" title="Create chat">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 p-3 max-md:hidden">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2">
            <Search className="h-4 w-4 text-white/25" />
            <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search chats, topics, rules..." className="min-w-0 flex-1 bg-transparent text-xs text-white/70 outline-none placeholder:text-white/20" />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(["active", "discover", "archived"] as const).map(filter => (
              <button key={filter} onClick={() => setRoomFilter(filter)} className={cn("rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest", roomFilter === filter ? "bg-og-lime/10 text-og-lime" : "bg-white/[0.03] text-white/30")}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loadingRooms ? (
            Array.from({ length: 8 }).map((_, index) => <div key={index} className="mb-2 h-14 animate-pulse rounded-xl bg-white/[0.035]" />)
          ) : filteredRooms.length === 0 ? (
            <div className="px-3 py-12 text-center max-md:hidden">
              <Hash className="mx-auto h-8 w-8 text-white/10" />
              <p className="mt-2 text-xs text-white/25">No chats found</p>
            </div>
          ) : (
            filteredRooms.map(room => (
              <button key={room.id} onClick={() => setActiveRoom(room)} className={cn("mb-1 flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-all",
                activeRoom?.id === room.id ? "border-og-cyan/25 bg-og-cyan/[0.08]" : "border-transparent hover:bg-white/[0.035]"
              )}>
                <RoomIcon room={room} />
                <div className="min-w-0 flex-1 max-md:hidden">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-black">{room.name}</p>
                    {room.is_read_only && <Megaphone className="h-3 w-3 text-og-gold" />}
                    {room.is_hidden && <EyeOff className="h-3 w-3 text-white/25" />}
                  </div>
                  <p className="truncate text-[10px] text-white/28">{room.last_message || room.description || "No messages yet"}</p>
                </div>
                <div className="max-md:hidden">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-300/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {activeRoom?.id === room.id ? localOnline : room.online_count || 0}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {activeRoom ? (
          <>
            <header className="border-b border-white/[0.06] bg-[#08090d]/92 backdrop-blur">
              {activeRoom.banner_url && <img src={activeRoom.banner_url} alt="" className="h-20 w-full object-cover opacity-70" />}
              <div className="flex items-center gap-3 px-4 py-3">
                <RoomIcon room={activeRoom} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-black">#{activeRoom.name}</h2>
                    {activeRoom.is_locked && <Lock className="h-4 w-4 text-red-300" />}
                    {activeRoom.is_read_only && <Megaphone className="h-4 w-4 text-og-gold" />}
                  </div>
                  <p className="truncate text-xs text-white/35">{activeRoom.description || "Crypto-native chat connected to OG SCAN communities, profiles, spaces, and moderation."}</p>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { id: "info" as const, Icon: FileText },
                    { id: "members" as const, Icon: Users },
                    { id: "moderation" as const, Icon: ShieldCheck },
                  ].map(item => (
                    <button key={item.id} onClick={() => setSidePanel(sidePanel === item.id ? null : item.id)} className={cn("rounded-xl p-2 text-white/35 hover:bg-white/[0.05]", sidePanel === item.id && "bg-white/[0.07] text-white")}>
                      <item.Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </header>

            {pinnedMessages.length > 0 && (
              <div className="flex items-center gap-2 border-b border-og-gold/10 bg-og-gold/[0.055] px-4 py-2">
                <Pin className="h-3.5 w-3.5 text-og-gold" />
                <p className="truncate text-xs text-og-gold/80">{pinnedMessages[pinnedMessages.length - 1].content}</p>
              </div>
            )}

            <div className="flex min-h-0 flex-1">
              <section className="flex min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-og-cyan/60" /></div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageSquare className="h-12 w-12 text-white/10" />
                      <p className="mt-3 text-sm font-bold text-white/30">No messages yet</p>
                      <p className="mt-1 text-xs text-white/20">Start the discussion with a helpful note, question, or announcement.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map(message => (
                        <MessageRow
                          key={message.id}
                          msg={message}
                          isOwn={message.sender_id === user?.id}
                          canModerate={canModerate}
                          onPin={pinMessage}
                          onDelete={deleteMessage}
                          onReport={reportMessage}
                          onReact={reactToMessage}
                          onReply={setReplyTo}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-white/[0.06] p-3">
                  {replyTo && (
                    <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                      <MessageSquare className="h-3.5 w-3.5 text-og-cyan" />
                      <p className="min-w-0 flex-1 truncate text-xs text-white/45">Replying to {replyTo.profiles?.username || "member"}: {replyTo.content}</p>
                      <button onClick={() => setReplyTo(null)}><X className="h-3.5 w-3.5 text-white/30" /></button>
                    </div>
                  )}
                  {showEmojiPicker && (
                    <div className="mb-2 flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2">
                      {QUICK_EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => addEmojiToComposer(emoji)} className="rounded-lg px-2 py-1 text-sm hover:bg-white/[0.06]">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={cn("flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-3 py-2", (isMuted || isBanned || activeRoom.is_locked) && "opacity-55")}>
                    <button onClick={() => setShowEmojiPicker(prev => !prev)} className="rounded-lg p-1 text-white/30 hover:bg-white/[0.06]" title="Emoji">
                      <Smile className="h-4 w-4" />
                    </button>
                    <button onClick={() => setShowAttachModal(true)} className="rounded-lg p-1 text-white/30 hover:bg-white/[0.06]" title="Attach media">
                      <ImageIcon className="h-4 w-4" />
                    </button>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={event => setInput(event.target.value)}
                      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }}
                      disabled={isMuted || isBanned || !!activeRoom.is_locked || (!!activeRoom.is_read_only && !canModerate)}
                      placeholder={isMuted ? "Muted members cannot send messages" : activeRoom.is_read_only && !canModerate ? "Announcements channel is read-only" : `Message #${activeRoom.name}`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-white/80 outline-none placeholder:text-white/22 disabled:cursor-not-allowed"
                    />
                    <button onClick={sendMessage} disabled={!input.trim() || sending} className={cn("rounded-xl p-2 transition-all", input.trim() ? "bg-og-cyan text-background hover:bg-white" : "bg-white/[0.04] text-white/20")}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </section>

              {sidePanel && sidePanelContent && (
                <>
                  <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-white/[0.06] bg-[#0d0f15] p-4 lg:block">
                    {sidePanelContent}
                  </aside>
                  <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setSidePanel(null)}>
                    <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[#0d0f15] p-4 shadow-2xl" onClick={event => event.stopPropagation()}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/28">{sidePanel}</p>
                        <button onClick={() => setSidePanel(null)} className="rounded-lg p-1.5 text-white/35 hover:bg-white/[0.05] hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {sidePanelContent}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center">
            <div>
              <Hash className="mx-auto h-12 w-12 text-white/10" />
              <p className="mt-3 text-sm font-bold text-white/35">Select a chat room</p>
            </div>
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#11131b] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Create Group Chat</h3>
                <p className="text-xs text-white/30">Public, private, invite-only, team, project, research, or community-linked.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1.5 text-white/35 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={newRoom.name} onChange={event => setNewRoom(prev => ({ ...prev, name: event.target.value }))} placeholder="chat-name" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20" />
              <input value={newRoom.description} onChange={event => setNewRoom(prev => ({ ...prev, description: event.target.value }))} placeholder="Description" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20" />
              <div className="grid grid-cols-3 gap-2">
                {ROOM_TYPES.map(type => (
                  <button key={type.value} onClick={() => setNewRoom(prev => ({ ...prev, room_type: type.value }))} className={cn("rounded-xl border p-2 text-left", newRoom.room_type === type.value ? "border-og-cyan/30 bg-og-cyan/10 text-og-cyan" : "border-white/[0.06] bg-white/[0.025] text-white/45")}>
                    <type.Icon className="mb-1 h-4 w-4" />
                    <p className="text-[10px] font-black uppercase tracking-wider">{type.label}</p>
                  </button>
                ))}
              </div>
              <textarea value={newRoom.rules} onChange={event => setNewRoom(prev => ({ ...prev, rules: event.target.value }))} placeholder="Rules, posting expectations, and moderation notes" className="h-24 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20" />
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/25">Fast channel templates</p>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_CHANNELS.map(name => (
                    <button key={name} onClick={() => setNewRoom(prev => ({ ...prev, name }))} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-white/38 hover:text-white">
                      #{name}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={createRoom} disabled={!newRoom.name.trim()} className="w-full rounded-xl bg-og-cyan px-4 py-2.5 text-sm font-black text-background transition-colors hover:bg-white disabled:opacity-40">
                Create Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#11131b] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Attach Media or File</h3>
                <p className="text-xs text-white/30">Paste an image URL, media URL, or file link to send it into this room.</p>
              </div>
              <button onClick={() => setShowAttachModal(false)} className="rounded-lg p-1.5 text-white/35 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input
                value={attachmentDraft.url}
                onChange={event => setAttachmentDraft(prev => ({ ...prev, url: event.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
              />
              <textarea
                value={attachmentDraft.caption}
                onChange={event => setAttachmentDraft(prev => ({ ...prev, caption: event.target.value }))}
                placeholder="Optional caption"
                className="h-24 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
              />
              <button onClick={sendAttachment} className="w-full rounded-xl bg-og-cyan px-4 py-2.5 text-sm font-black text-background transition-colors hover:bg-white">
                Send attachment
              </button>
            </div>
          </div>
        </div>
      )}

      {modTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#11131b] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Manage Member</h3>
                <p className="text-xs text-white/30">{modTarget.profiles?.username || "Member"} · {modTarget.warning_count || 0} warnings</p>
              </div>
              <button onClick={() => setModTarget(null)} className="rounded-lg p-1.5 text-white/35 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
            </div>
            <textarea value={modReason} onChange={event => setModReason(event.target.value)} placeholder="Reason visible in moderation history" className="mb-3 h-24 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/20" />
            <div className="mb-3 grid grid-cols-5 gap-1">
              {(["15m", "1h", "6h", "24h", "7d"] as ModerationDuration[]).map(duration => (
                <button key={duration} onClick={() => setModDuration(duration)} className={cn("rounded-lg px-2 py-1.5 text-[10px] font-black", modDuration === duration ? "bg-og-cyan text-background" : "bg-white/[0.04] text-white/35")}>{duration}</button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={warnMember} disabled={!modReason.trim()} className="rounded-xl border border-og-gold/20 bg-og-gold/10 px-3 py-2 text-xs font-black text-og-gold disabled:opacity-40"><AlertTriangle className="mx-auto mb-1 h-4 w-4" />Warn</button>
              <button onClick={muteMember} className="rounded-xl border border-og-cyan/20 bg-og-cyan/10 px-3 py-2 text-xs font-black text-og-cyan"><VolumeX className="mx-auto mb-1 h-4 w-4" />Mute</button>
              <button onClick={banMember} className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-black text-red-300"><Ban className="mx-auto mb-1 h-4 w-4" />Ban</button>
            </div>
            <button onClick={() => setModTarget(null)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/45 hover:text-white">
              <UserMinus className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityRooms;
