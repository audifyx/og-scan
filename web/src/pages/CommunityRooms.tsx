/**
 * CommunityRooms — backend-backed crypto-native group and community chat.
 * Uses Supabase tables for rooms, messages, members, reports, warnings,
 * mutes, bans, reactions, and moderation audit logs.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Archive, BadgeCheck, Ban, Bell, BookOpen, Bookmark, CalendarDays,
  Check, CheckCircle2, ChevronLeft, Copy, Crown, ExternalLink, EyeOff, FileText,
  Flag, Gauge, Hash, Image as ImageIcon, Link2, Loader2, Lock, Megaphone,
  MessageSquare, Mic, MoreHorizontal, Pin, Plus, Radio, Search, Send, Settings,
  Shield, ShieldCheck, Smile, Sparkles, Trash2, UserMinus, UserPlus, Users,
  VolumeX, X, Zap,
} from "lucide-react";
import { RaidTab } from "@/components/RaidTab";
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

interface MessageReactionSummary {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface ReplyPreview {
  id: string;
  sender_id: string;
  content: string;
  is_deleted?: boolean | null;
  profiles?: ProfileLite | null;
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
  replyPreview?: ReplyPreview | null;
  replyCount?: number;
  reactions?: MessageReactionSummary[];
}

interface MessageReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
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
const QUICK_EMOJIS = ["🔥", "💎", "🚀", "👀", "✅", "💯", "🧠", "🛡️", "💰", "🐋", "📈", "⚡", "🎯", "🤝"];
const MESSAGE_ACTION_REACTIONS = ["👀", "🚀", "💎", "🔥"];

/* ─── OGS-style Reaction Picker Emojis (50+ crypto/meme culture emojis) ─── */
const OGS_REACTION_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "🔥 Hype",
    emojis: ["🔥", "🚀", "💎", "👀", "⚡", "💯", "🏆", "👑", "✨", "🎯", "🫡", "🤯", "😤", "💪", "🙌"],
  },
  {
    label: "💰 Crypto",
    emojis: ["💰", "🐋", "📈", "📉", "🪙", "💸", "🤑", "🏦", "⛏️", "🧾", "📊", "🐂", "🐻", "🦈", "🧲"],
  },
  {
    label: "🧠 Vibes",
    emojis: ["🧠", "🛡️", "🤝", "🫶", "❤️", "👍", "👎", "😂", "💀", "🤡", "😈", "👻", "🎩", "🍀", "🌙"],
  },
  {
    label: "⚠️ Alerts",
    emojis: ["⚠️", "🚨", "🔴", "🟢", "🟡", "🏴‍☠️", "🔒", "🔓", "📌", "🧐", "🕵️", "🔍", "💡", "📢", "🗳️"],
  },
];
const MOD_ROLES: RoomRole[] = ["owner", "admin", "moderator"];
const SAVED_MESSAGES_STORAGE_PREFIX = "ogscan-community-saved-messages:";

const durationToExpiry = (duration: ModerationDuration) => {
  const mins: Record<ModerationDuration, number> = { "15m": 15, "1h": 60, "6h": 360, "24h": 1440, "7d": 10080 };
  return new Date(Date.now() + mins[duration] * 60_000).toISOString();
};

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatShortDate = (value: string) => new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
const IMAGE_URL_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i;

const isImageUrl = (value: string) => IMAGE_URL_RE.test(value) || value.includes("images") || value.includes("img") || value.includes("photo");
const truncateText = (value: string | null | undefined, max = 80) => {
  const clean = (value || "").trim();
  if (!clean) return "Message";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};
const getSavedMessagesStorageKey = (userId: string) => `${SAVED_MESSAGES_STORAGE_PREFIX}${userId}`;

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
  isSaved,
  isHighlighted,
  onPin,
  onDelete,
  onReport,
  onReact,
  onReply,
  onToggleSave,
  onCopyMessage,
  onCopyLink,
  onJumpToMessage,
  registerMessageRef,
}: {
  msg: Message;
  isOwn: boolean;
  canModerate: boolean;
  isSaved: boolean;
  isHighlighted: boolean;
  onPin: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReport: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onToggleSave: (message: Message) => void;
  onCopyMessage: (message: Message) => void;
  onCopyLink: (message: Message) => void;
  onJumpToMessage: (messageId: string) => void;
  registerMessageRef: (messageId: string, node: HTMLDivElement | null) => void;
}) {
  const attachmentUrl = msg.media_url || msg.file_url;
  const hasAttachment = !!attachmentUrl;
  const attachmentIsImage = !!msg.media_url || (!!attachmentUrl && isImageUrl(attachmentUrl));
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  if (msg.is_deleted || msg.deleted_at) return null;

  return (
    <div
      ref={node => registerMessageRef(msg.id, node)}
      className={cn(
        "group scroll-mt-24 rounded-[24px] px-2 py-1.5 transition-all",
        isOwn && "flex-row-reverse",
        isHighlighted && "bg-og-cyan/[0.08] ring-1 ring-og-cyan/25 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]",
      )}
    >
      <div className={cn("flex gap-2.5", isOwn && "flex-row-reverse")}>
        <Avatar url={msg.profiles?.avatar_url} username={msg.profiles?.username} size="sm" />
        <div className={cn("min-w-0 max-w-[82%]", isOwn ? "items-end" : "items-start", "flex flex-col gap-1")}>
          <div className={cn("flex items-center gap-1.5 px-1", isOwn && "flex-row-reverse")}>
            <span className="truncate text-xs font-bold text-white/65">{isOwn ? "You" : msg.profiles?.username || "Member"}</span>
            {msg.profiles?.verified && <BadgeCheck className="h-3 w-3 text-og-cyan" />}
            <span className="text-[10px] text-white/20">{formatTime(msg.created_at)}</span>
            {msg.edited_at && <span className="text-[9px] text-white/18">edited</span>}
            {isSaved && (
              <span className="inline-flex items-center gap-1 rounded-full border border-og-gold/20 bg-og-gold/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-og-gold">
                <Bookmark className="h-2.5 w-2.5" /> Saved
              </span>
            )}
          </div>
          <div
            className={cn(
              "relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
              isOwn ? "rounded-tr-sm bg-og-cyan/20 text-white" : "rounded-tl-sm bg-white/[0.06] text-white/86",
              msg.is_pinned && "ring-1 ring-og-gold/40",
            )}
          >
            {msg.is_pinned && <Pin className="mr-1 inline h-3 w-3 text-og-gold" />}
              <div className="space-y-2">
                {msg.replyPreview && (
                  <button
                    onClick={() => onJumpToMessage(msg.replyPreview!.id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-2.5 py-2 text-left text-[11px] text-white/52 transition-colors hover:border-white/[0.15] hover:bg-black/30 hover:text-white/75",
                      isOwn && "text-right"
                    )}
                  >
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-og-cyan" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white/62">Replying to {msg.replyPreview.profiles?.username || "member"}</p>
                      <p className="truncate">{msg.replyPreview.is_deleted ? "Deleted message" : truncateText(msg.replyPreview.content, 90)}</p>
                    </div>
                  </button>
                )}
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
          </div>

          {!!msg.reactions?.length && (
            <div className={cn("flex flex-wrap items-center gap-1 px-1", isOwn && "justify-end")}>
              {msg.reactions.map(reaction => (
                <button
                  key={reaction.emoji}
                  onClick={() => onReact(msg, reaction.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold transition-colors",
                    reaction.reacted
                      ? "border-og-cyan/35 bg-og-cyan/15 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white"
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className={cn("flex flex-wrap items-center gap-1 px-1 text-[10px] text-white/28", isOwn && "justify-end")}>
            {msg.replyCount ? (
              <button onClick={() => onReply(msg)} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-bold text-white/45 hover:text-white">
                {msg.replyCount} repl{msg.replyCount === 1 ? "y" : "ies"}
              </button>
            ) : null}
            {hasAttachment ? <span>Attachment</span> : null}
          </div>

          <div className={cn("relative flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100", isOwn && "justify-end")}>
            <button onClick={() => { setMenuOpen(prev => !prev); setEmojiPickerOpen(false); }} className="rounded-full bg-white/[0.04] px-2 py-1.5 text-white/32 hover:bg-white/[0.08] hover:text-white/70" title="More">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onReply(msg)} className="rounded-full bg-white/[0.04] px-2 py-1.5 text-white/32 hover:bg-white/[0.08] hover:text-white/70" title="Reply">
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            {MESSAGE_ACTION_REACTIONS.map(emoji => {
              const activeReaction = msg.reactions?.find(reaction => reaction.emoji === emoji)?.reacted;
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(msg, emoji)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-sm transition-colors",
                    activeReaction ? "bg-white/[0.1] text-white" : "bg-white/[0.04] text-white/85 hover:bg-white/[0.08]"
                  )}
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
            <button onClick={() => { setEmojiPickerOpen(prev => !prev); setMenuOpen(false); }} className="rounded-full bg-white/[0.04] px-2 py-1.5 text-white/32 hover:bg-white/[0.08] hover:text-white/70" title="Add reaction">
              <Plus className="h-3.5 w-3.5" />
            </button>
            {emojiPickerOpen && (
              <div className={cn("absolute z-40 w-[280px] rounded-2xl border border-white/10 bg-popover p-2 shadow-2xl", isOwn ? "right-0 top-10" : "left-0 top-10")}>
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Reactions</span>
                  <button onClick={() => setEmojiPickerOpen(false)} className="rounded p-0.5 text-white/30 hover:text-white"><X className="h-3 w-3" /></button>
                </div>
                <div className="max-h-[240px] overflow-y-auto">
                  {OGS_REACTION_CATEGORIES.map(category => (
                    <div key={category.label} className="mb-1">
                      <p className="px-1 py-1 text-[9px] font-bold uppercase tracking-wider text-white/20">{category.label}</p>
                      <div className="flex flex-wrap gap-0.5">
                        {category.emojis.map(emoji => {
                          const isActive = msg.reactions?.find(r => r.emoji === emoji)?.reacted;
                          return (
                            <button key={emoji} onClick={() => { onReact(msg, emoji); setEmojiPickerOpen(false); }} className={cn("rounded-lg px-2 py-1 text-base transition-colors hover:bg-white/[0.08]", isActive && "bg-white/[0.12] ring-1 ring-white/10")} title={emoji}>
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {menuOpen && (
              <div className={cn("absolute z-30 min-w-[190px] rounded-2xl border border-white/10 bg-popover p-1.5 shadow-2xl", isOwn ? "right-0 top-10" : "left-0 top-10")}>
                <button onClick={() => { onToggleSave(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-white/60 hover:bg-white/[0.05] hover:text-white">
                  {isSaved ? <Check className="h-3.5 w-3.5 text-og-gold" /> : <Bookmark className="h-3.5 w-3.5" />} {isSaved ? "Saved" : "Save message"}
                </button>
                <button onClick={() => { onCopyMessage(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-white/60 hover:bg-white/[0.05] hover:text-white">
                  <Copy className="h-3.5 w-3.5" /> Copy text
                </button>
                <button onClick={() => { onCopyLink(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-white/60 hover:bg-white/[0.05] hover:text-white">
                  <Link2 className="h-3.5 w-3.5" /> Copy link
                </button>
                {msg.replyPreview && (
                  <button onClick={() => { onJumpToMessage(msg.replyPreview!.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-white/60 hover:bg-white/[0.05] hover:text-white">
                    <ExternalLink className="h-3.5 w-3.5" /> Jump to original
                  </button>
                )}
                {hasAttachment && attachmentUrl && (
                  <a href={attachmentUrl} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-white/60 hover:bg-white/[0.05] hover:text-white">
                    <FileText className="h-3.5 w-3.5" /> Open attachment
                  </a>
                )}
                {(canModerate || isOwn) && (
                  <button onClick={() => { onPin(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-white/60 hover:bg-white/[0.05] hover:text-white">
                    <Pin className="h-3.5 w-3.5" /> {msg.is_pinned ? "Unpin" : "Pin"}
                  </button>
                )}
                <button onClick={() => { onReport(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-white/60 hover:bg-white/[0.05] hover:text-white">
                  <Flag className="h-3.5 w-3.5" /> Report
                </button>
                {(canModerate || isOwn) && (
                  <button onClick={() => { onDelete(msg); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-red-300 hover:bg-red-400/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
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
  const [sidePanel, setSidePanel] = useState<"members" | "moderation" | "info" | null>(null);
  const [roomView, setRoomView] = useState<"chat" | "raid">("chat");
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
  const [savedMessageIds, setSavedMessageIds] = useState<string[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; avatar_url: string | null }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const realtimeRef = useRef<any>(null);
  const presenceRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMessageIdsRef = useRef<string[]>([]);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const handledRequestedMessageRef = useRef<string | null>(null);

  const currentMember = useMemo(() => members.find(member => member.user_id === user?.id), [members, user?.id]);
  const canModerate = !!currentMember && MOD_ROLES.includes(currentMember.role);
  const isMuted = !!currentMember?.muted_until && new Date(currentMember.muted_until).getTime() > Date.now();
  const isBanned = !!currentMember?.is_banned || (!!currentMember?.banned_until && new Date(currentMember.banned_until).getTime() > Date.now());
  const pinnedMessages = messages.filter(message => message.is_pinned && !message.is_deleted);
  const requestedRoomId = useMemo(() => new URLSearchParams(window.location.search).get("room"), []);
  const inviterRef = useMemo(() => new URLSearchParams(window.location.search).get("ref"), []);
  const [inviteModal, setInviteModal] = useState<{ room: Room; inviterName: string; inviterAvatar: string | null } | null>(null);
  const [joiningInvite, setJoiningInvite] = useState(false);
  const handledInviteKey = useRef<string | null>(null);
  const requestedMessageId = useMemo(() => new URLSearchParams(window.location.search).get("message"), []);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const haystack = `${room.name} ${room.description || ""} ${room.category || ""}`.toLowerCase();
      const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
      const matchesState = roomFilter === "archived" ? room.is_archived : roomFilter === "discover" ? !room.is_archived : !room.is_archived && !room.is_hidden;
      return matchesSearch && matchesState;
    });
  }, [rooms, roomFilter, searchQuery]);

  useEffect(() => {
    if (!user?.id) {
      setSavedMessageIds([]);
      return;
    }

    try {
      const raw = localStorage.getItem(getSavedMessagesStorageKey(user.id));
      const parsed = raw ? JSON.parse(raw) : [];
      setSavedMessageIds(Array.isArray(parsed) ? parsed.filter(value => typeof value === "string") : []);
    } catch {
      setSavedMessageIds([]);
    }
  }, [user?.id]);

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
      let requestedRoom = requestedRoomId ? rows.find(room => room.id === requestedRoomId) : null;

      // Invite link to a room we can't see yet (private/invite-only, not
      // joined) — fall back to the safe preview RPC so we can still show
      // the "@x invited you" popup before the viewer has joined.
      if (!requestedRoom && requestedRoomId && inviterRef) {
        const { data: preview } = await supabase.rpc("get_room_invite_preview", { p_room_id: requestedRoomId });
        const previewRoom = Array.isArray(preview) ? preview[0] : preview;
        if (previewRoom?.id) {
          requestedRoom = { ...previewRoom, member_count: previewRoom.member_count ?? 0, created_at: new Date().toISOString() } as Room;
          setRooms(prev => (prev.some(r => r.id === requestedRoom!.id) ? prev : [requestedRoom!, ...prev]));
        }
      }

      if (requestedRoom) {
        setActiveRoom(requestedRoom);
      } else if (!activeRoom && rows.length > 0) {
        setActiveRoom(rows[0]);
      }
    }
    setLoadingRooms(false);
  }, [activeRoom, requestedRoomId, inviterRef]);

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
      .eq("is_deleted", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) {
      console.error("community message load failed", error);
      toast.error("Could not load messages");
      setMessages([]);
      activeMessageIdsRef.current = [];
    } else {
      const rows = (data || []) as Message[];
      const messageIds = rows.map(message => message.id);
      const inlineReplyIds = Array.from(new Set(rows.map(message => message.reply_to_id).filter(Boolean) as string[]));
      const missingReplyIds = inlineReplyIds.filter(replyId => !messageIds.includes(replyId));

      const [reactionRowsResult, missingRepliesResult] = await Promise.all([
        messageIds.length > 0
          ? supabase.from("community_room_reactions").select("message_id, user_id, emoji, created_at").in("message_id", messageIds)
          : Promise.resolve({ data: [], error: null }),
        missingReplyIds.length > 0
          ? supabase.from("community_room_messages").select("*").in("id", missingReplyIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const missingReplyRows = ((missingRepliesResult.data || []) as Message[]);
      const combinedRows = [...rows, ...missingReplyRows];
      const profilesMap = await fetchProfilesMap(combinedRows.map(message => message.sender_id));
      const rowsById = new Map<string, Message>(combinedRows.map(message => [message.id, { ...message, profiles: profilesMap[message.sender_id] || null }]));
      const replyCountById = rows.reduce<Record<string, number>>((acc, message) => {
        if (message.reply_to_id) acc[message.reply_to_id] = (acc[message.reply_to_id] || 0) + 1;
        return acc;
      }, {});

      const groupedReactions = new Map<string, Map<string, Set<string>>>();
      for (const reaction of (reactionRowsResult.data || []) as MessageReactionRow[]) {
        if (!groupedReactions.has(reaction.message_id)) groupedReactions.set(reaction.message_id, new Map());
        const byEmoji = groupedReactions.get(reaction.message_id)!;
        if (!byEmoji.has(reaction.emoji)) byEmoji.set(reaction.emoji, new Set());
        byEmoji.get(reaction.emoji)!.add(reaction.user_id);
      }

      const hydratedRows = rows.reverse().map(message => {
        const reactionSummary = Array.from(groupedReactions.get(message.id)?.entries() || []).map(([emoji, userIds]) => ({
          emoji,
          count: userIds.size,
          reacted: !!user?.id && userIds.has(user.id),
        })).sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return MESSAGE_ACTION_REACTIONS.indexOf(a.emoji) - MESSAGE_ACTION_REACTIONS.indexOf(b.emoji);
        });

        const replyMessage = message.reply_to_id ? rowsById.get(message.reply_to_id) : null;
        return {
          ...message,
          profiles: profilesMap[message.sender_id] || null,
          reactions: reactionSummary,
          replyCount: replyCountById[message.id] || 0,
          replyPreview: replyMessage ? {
            id: replyMessage.id,
            sender_id: replyMessage.sender_id,
            content: replyMessage.content,
            is_deleted: replyMessage.is_deleted,
            profiles: replyMessage.profiles || null,
          } : null,
        } as Message;
      });

      activeMessageIdsRef.current = hydratedRows.map(message => message.id);
      setMessages(hydratedRows);
    }
    setLoadingMessages(false);
  }, [user?.id]);

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

  // Invite links: /community-rooms?room=<id>&ref=<inviter username>
  // Once the target room is loaded, show "@ref invited you to join" —
  // but only if the viewer isn't already a member and hasn't dismissed it yet.
  useEffect(() => {
    if (!inviterRef || !activeRoom || !user?.id) return;
    const key = `${activeRoom.id}:${inviterRef}`;
    if (handledInviteKey.current === key) return;
    if (inviterRef.toLowerCase() === (profile?.username || "").toLowerCase()) return; // can't invite yourself

    let cancelled = false;
    (async () => {
      const { data: existingMember } = await supabase
        .from("community_room_members")
        .select("user_id")
        .eq("room_id", activeRoom.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      handledInviteKey.current = key;
      if (existingMember) return; // already in — no need to prompt

      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("username", inviterRef)
        .maybeSingle();
      if (cancelled) return;
      setInviteModal({
        room: activeRoom,
        inviterName: inviterProfile?.username || inviterRef,
        inviterAvatar: inviterProfile?.avatar_url || null,
      });
    })();
    return () => { cancelled = true; };
  }, [inviterRef, activeRoom, user?.id, profile?.username]);

  const acceptInvite = async () => {
    if (!inviteModal || !user?.id) return;
    setJoiningInvite(true);
    const { error } = await supabase
      .from("community_room_members")
      .upsert({ room_id: inviteModal.room.id, user_id: user.id, role: "member" }, { onConflict: "room_id,user_id" });
    setJoiningInvite(false);
    if (error) {
      console.error("accept invite failed", error);
      toast.error("Could not join — try again");
      return;
    }
    toast.success(`Joined ${inviteModal.room.name}`);
    loadMembers(inviteModal.room.id);
    loadMessages(inviteModal.room.id);
    loadRooms();
    setInviteModal(null);
    navigate(`${window.location.pathname}?room=${inviteModal.room.id}`, { replace: true });
  };

  const dismissInvite = () => {
    if (inviteModal) navigate(`${window.location.pathname}?room=${inviteModal.room.id}`, { replace: true });
    setInviteModal(null);
  };

  // Real-time: community_rooms list updates (new rooms, renames, deletions)
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`community-rooms-list-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_rooms" }, (payload) => {
        const newRoom = payload.new as Room;
        setRooms(prev => {
          if (prev.some(r => r.id === newRoom.id)) return prev;
          return [newRoom, ...prev];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_rooms" }, (payload) => {
        const updated = payload.new as Room;
        setRooms(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
        setActiveRoom(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_rooms" }, (payload) => {
        const deleted = payload.old as Room;
        setRooms(prev => prev.filter(r => r.id !== deleted.id));
        setActiveRoom(prev => prev?.id === deleted.id ? null : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_room_messages", filter: `room_id=eq.${activeRoom.id}` }, async (payload) => {
        const newMsg = payload.new as Message;
        // Fetch profile for the new message sender
        const profilesMap = await fetchProfilesMap([newMsg.sender_id]);
        const hydratedMsg = { ...newMsg, profiles: profilesMap[newMsg.sender_id] || null, reactions: [], replyCount: 0, replyPreview: null };
        setMessages(prev => {
          // Replace optimistic temp message
          const tempIdx = prev.findIndex(m => m.id.startsWith("temp-") && m.sender_id === newMsg.sender_id && m.content === newMsg.content);
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = hydratedMsg;
            return updated;
          }
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, hydratedMsg];
        });
        activeMessageIdsRef.current = [...activeMessageIdsRef.current, newMsg.id];
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_room_messages", filter: `room_id=eq.${activeRoom.id}` }, (payload) => {
        const deletedId = (payload.old as { id?: string })?.id;
        if (deletedId) {
          setMessages(prev => prev.filter(m => m.id !== deletedId));
          activeMessageIdsRef.current = activeMessageIdsRef.current.filter(id => id !== deletedId);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_room_messages", filter: `room_id=eq.${activeRoom.id}` }, (payload) => {
        const updated = payload.new as Message;
        if (updated.is_deleted) {
          setMessages(prev => prev.filter(m => m.id !== updated.id));
        } else {
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_room_members", filter: `room_id=eq.${activeRoom.id}` }, () => loadMembers(activeRoom.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "community_room_reactions" }, payload => {
        const changedMessageId = (payload.new as { message_id?: string } | null)?.message_id || (payload.old as { message_id?: string } | null)?.message_id;
        if (changedMessageId && activeMessageIdsRef.current.includes(changedMessageId)) {
          loadMessages(activeRoom.id);
        }
      })
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

  /* ─── Typing indicator channel ─── */
  useEffect(() => {
    if (!activeRoom || !user) {
      if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
      if (typingChannelRef.current) { typingChannelRef.current.untrack?.(); supabase.removeChannel(typingChannelRef.current); typingChannelRef.current = null; }
      setTypingUsers(new Map());
      return;
    }
    const ch = supabase.channel(`community-typing-${activeRoom.id}`, { config: { presence: { key: user.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const typing = new Map<string, { username: string; avatar_url: string | null }>();
      Object.entries(state).forEach(([uid, data]) => {
        if (uid !== user.id && Array.isArray(data) && data.some((d: any) => d.typing)) {
          const info = data[0] as any;
          typing.set(uid, { username: info.username || "Someone", avatar_url: info.avatar_url || null });
        }
      });
      setTypingUsers(typing);
    });
    ch.subscribe(async (status: string) => { if (status === "SUBSCRIBED") await ch.track({ typing: false, username: profile?.username || "Member", avatar_url: profile?.avatar_url || null }); });
    typingChannelRef.current = ch;
    return () => {
      if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
      ch.untrack?.(); supabase.removeChannel(ch);
      if (typingChannelRef.current === ch) typingChannelRef.current = null;
      setTypingUsers(new Map());
    };
  }, [activeRoom, user, profile?.username, profile?.avatar_url]);

  const broadcastTyping = useCallback(() => {
    if (!activeRoom || !user || !typingChannelRef.current) return;
    void typingChannelRef.current.track({ typing: true, username: profile?.username || "Member", avatar_url: profile?.avatar_url || null });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { void typingChannelRef.current?.track({ typing: false, username: profile?.username || "Member", avatar_url: profile?.avatar_url || null }); }, 3000);
  }, [activeRoom, user, profile?.username, profile?.avatar_url]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const registerMessageRef = useCallback((messageId: string, node: HTMLDivElement | null) => {
    messageRefs.current[messageId] = node;
  }, []);

  const focusMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    requestAnimationFrame(() => {
      messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => {
      setHighlightedMessageId(current => current === messageId ? null : current);
    }, 2400);
  }, []);

  useEffect(() => {
    if (!requestedMessageId || handledRequestedMessageRef.current === requestedMessageId) return;
    const exists = messages.some(message => message.id === requestedMessageId);
    if (exists) {
      handledRequestedMessageRef.current = requestedMessageId;
      focusMessage(requestedMessageId);
    }
  }, [focusMessage, messages, requestedMessageId]);

  const persistSavedMessageIds = useCallback((nextIds: string[]) => {
    setSavedMessageIds(nextIds);
    if (!user?.id) return;
    localStorage.setItem(getSavedMessagesStorageKey(user.id), JSON.stringify(nextIds));
  }, [user?.id]);

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
    // Stop typing indicator
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    void typingChannelRef.current?.track({ typing: false, username: profile?.username || "Member", avatar_url: profile?.avatar_url || null });
    // Optimistic insert — show message instantly
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId, room_id: activeRoom.id, sender_id: user.id, content, created_at: new Date().toISOString(),
      is_pinned: false, is_deleted: false, deleted_at: null, reply_to_id: replyTo?.id || null,
      attachment_url: null, attachment_type: null, edited_at: null,
      profiles: profile ? { user_id: user.id, username: profile.username, avatar_url: profile.avatar_url, verified: (profile as any).verified ?? false } : null,
      reactions: [], replyCount: 0, replyPreview: replyTo ? { id: replyTo.id, sender_id: replyTo.sender_id, content: replyTo.content, is_deleted: false, profiles: replyTo.profiles || null } : null,
    } as Message;
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    const { error } = await supabase.from("community_room_messages").insert({
      room_id: activeRoom.id,
      sender_id: user.id,
      content,
      reply_to_id: replyTo?.id || null,
    });
    if (error) {
      toast.error(error.message || "Message failed");
      setInput(content);
      setMessages(prev => prev.filter(m => m.id !== tempId));
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
    // Optimistic removal — hide immediately
    setMessages(prev => prev.filter(m => m.id !== message.id));
    if (canModerate) {
      await supabase.from("community_room_moderation_actions").insert({ room_id: activeRoom.id, moderator_id: user?.id, target_user_id: message.sender_id, message_id: message.id, action_type: "message_deleted" });
    }
    const { error } = await supabase.from("community_room_messages").delete().eq("id", message.id);
    if (error) {
      toast.error(error.message || "Could not delete message");
      // Restore on failure
      loadMessages(activeRoom.id);
      return;
    }
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
    if (!user || !activeRoom) return;
    const alreadyReacted = !!message.reactions?.find(reaction => reaction.emoji === emoji && reaction.reacted);

    // Optimistic update — instant feedback
    setMessages(prev => prev.map(m => {
      if (m.id !== message.id) return m;
      const existing = (m.reactions || []).slice();
      const idx = existing.findIndex(r => r.emoji === emoji);
      if (alreadyReacted) {
        if (idx !== -1) {
          if (existing[idx].count <= 1) existing.splice(idx, 1);
          else existing[idx] = { ...existing[idx], count: existing[idx].count - 1, reacted: false };
        }
      } else {
        if (idx !== -1) existing[idx] = { ...existing[idx], count: existing[idx].count + 1, reacted: true };
        else existing.push({ emoji, count: 1, reacted: true });
      }
      return { ...m, reactions: existing };
    }));

    const query = supabase.from("community_room_reactions");
    const { error } = alreadyReacted
      ? await query.delete().eq("message_id", message.id).eq("user_id", user.id).eq("emoji", emoji)
      : await query.upsert({ message_id: message.id, user_id: user.id, emoji }, { onConflict: "message_id,user_id,emoji" });

    if (error) {
      toast.error("Could not update reaction");
      // Revert on error
      loadMessages(activeRoom.id);
    }
  };

  const toggleSavedMessage = (message: Message) => {
    const nextIds = savedMessageIds.includes(message.id)
      ? savedMessageIds.filter(id => id !== message.id)
      : [message.id, ...savedMessageIds].slice(0, 250);

    persistSavedMessageIds(nextIds);
    toast.success(savedMessageIds.includes(message.id) ? "Message removed from saved" : "Message saved");
  };

  const copyMessageText = async (message: Message) => {
    const text = message.content?.trim() || message.file_url || message.media_url;
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copied");
    } catch {
      toast.error("Could not copy message");
    }
  };

  const copyMessageLink = async (message: Message) => {
    if (!activeRoom) return;
    const params = new URLSearchParams(window.location.search);
    params.set("room", activeRoom.id);
    params.set("message", message.id);
    const messageUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(messageUrl);
      focusMessage(message.id);
      toast.success("Message link copied");
    } catch {
      toast.error("Could not copy message link");
    }
  };

  const jumpToMessage = (messageId: string) => {
    if (!activeRoom) return;
    const params = new URLSearchParams(window.location.search);
    params.set("room", activeRoom.id);
    params.set("message", messageId);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    focusMessage(messageId);
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
    const ref = profile?.username ? `&ref=${encodeURIComponent(profile.username)}` : "";
    const roomPath = `${window.location.origin}${window.location.pathname}?room=${activeRoom.id}${ref}`;
    try {
      await navigator.clipboard.writeText(roomPath);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy invite link");
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

  const sidePanelLabel = sidePanel === "info" ? "Room Info" : sidePanel === "members" ? "Members" : sidePanel === "moderation" ? "Moderation" : "";

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
      <div className="relative mb-4 flex items-center justify-center">
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-white/25">Members ({members.length})</p>
        <button onClick={copyRoomLink} className="absolute right-0 rounded-lg p-1.5 text-white/25 hover:bg-white/[0.05] hover:text-white" title="Copy room invite link">
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
                <select value={member.role} onChange={event => updateMemberRole(member, event.target.value as RoomRole)} className="rounded-lg border border-white/[0.06] bg-card px-2 py-1 text-[10px] text-white/50">
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
    <div className="flex h-full overflow-hidden bg-background text-white">
      <aside className="hidden md:flex w-[310px] shrink-0 flex-col border-r border-white/[0.06] bg-card">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 text-white shadow-lg shadow-emerald-500/30 max-md:mx-auto">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 max-md:hidden">
            <h1 className="text-sm font-black tracking-tight text-white">Rooms</h1>
            <p className="text-[10px] text-white/30">{rooms.length} active</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-300 transition hover:bg-emerald-500/20 max-md:hidden" title="Create room">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 p-3 max-md:hidden">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 focus-within:border-emerald-400/40">
            <Search className="h-4 w-4 text-emerald-300/70" />
            <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search chats, topics, rules..." className="min-w-0 flex-1 bg-transparent text-xs text-white/70 outline-none placeholder:text-white/20" />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(["active", "discover", "archived"] as const).map(filter => (
              <button key={filter} onClick={() => setRoomFilter(filter)} className={cn("rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest", roomFilter === filter ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.03] text-white/35")}>
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
                activeRoom?.id === room.id ? "border-emerald-400/30 bg-emerald-500/[0.08]" : "border-transparent hover:bg-white/[0.04]"
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
            <header className="border-b border-white/[0.06] bg-background/92 backdrop-blur">
              {activeRoom.banner_url && <img src={activeRoom.banner_url} alt="" className="h-20 w-full object-cover opacity-70" />}
              <div className="flex items-center gap-3 px-4 py-3">
                <RoomIcon room={activeRoom} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-black">#{activeRoom.name}</h2>
                    {activeRoom.is_locked && <Lock className="h-4 w-4 text-red-300" />}
                    {activeRoom.is_read_only && <Megaphone className="h-4 w-4 text-og-gold" />}
                  </div>
                  <p className="truncate text-xs text-white/35">{activeRoom.description || "Crypto-native chat connected to OrbitX communities, profiles, spaces, and moderation."}</p>
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
              {/* Chat / Raid tab switcher */}
              <div className="flex items-center gap-1 border-t border-white/[0.04] px-4 py-1.5">
                {([
                  { id: "chat" as const, label: "Chat", Icon: MessageSquare },
                  { id: "raid" as const, label: "Raid", Icon: Zap },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRoomView(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                      roomView === tab.id
                        ? tab.id === "raid" ? "bg-og-gold/10 text-og-gold" : "bg-emerald-500/10 text-emerald-300"
                        : "text-white/30 hover:bg-white/[0.04] hover:text-white/50"
                    )}
                  >
                    <tab.Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </header>

            {roomView === "chat" && pinnedMessages.length > 0 && (
              <div className="flex items-center gap-2 border-b border-og-gold/10 bg-og-gold/[0.055] px-4 py-2">
                <Pin className="h-3.5 w-3.5 text-og-gold" />
                <p className="truncate text-xs text-og-gold/80">{pinnedMessages[pinnedMessages.length - 1].content}</p>
              </div>
            )}

            {roomView === "raid" ? (
              <div className="min-h-0 flex-1">
                <RaidTab roomId={activeRoom.id} />
              </div>
            ) : (
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
                          isSaved={savedMessageIds.includes(message.id)}
                          isHighlighted={highlightedMessageId === message.id}
                          onPin={pinMessage}
                          onDelete={deleteMessage}
                          onReport={reportMessage}
                          onReact={reactToMessage}
                          onReply={setReplyTo}
                          onToggleSave={toggleSavedMessage}
                          onCopyMessage={copyMessageText}
                          onCopyLink={copyMessageLink}
                          onJumpToMessage={jumpToMessage}
                          registerMessageRef={registerMessageRef}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Typing indicator */}
                {typingUsers.size > 0 && (
                  <div className="flex items-center gap-2 border-t border-white/[0.04] px-4 py-1.5">
                    <div className="flex -space-x-1.5">
                      {[...typingUsers.entries()].slice(0, 3).map(([uid, info]) => (
                        info.avatar_url
                          ? <img key={uid} src={info.avatar_url} alt="" className="h-5 w-5 rounded-full border border-card object-cover" />
                          : <div key={uid} className="flex h-5 w-5 items-center justify-center rounded-full border border-card bg-white/10 text-[8px] font-bold text-white/50">{(info.username || "?")[0].toUpperCase()}</div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                      <span>{[...typingUsers.values()].slice(0, 2).map(u => u.username).join(", ")}{typingUsers.size > 2 ? ` +${typingUsers.size - 2}` : ""} is typing</span>
                      <span className="flex gap-0.5">
                        <span className="h-1 w-1 animate-bounce rounded-full bg-white/25" style={{ animationDelay: "0ms" }} />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-white/25" style={{ animationDelay: "150ms" }} />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-white/25" style={{ animationDelay: "300ms" }} />
                      </span>
                    </div>
                  </div>
                )}

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
                      onChange={event => { setInput(event.target.value); broadcastTyping(); }}
                      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }}
                      disabled={isMuted || isBanned || !!activeRoom.is_locked || (!!activeRoom.is_read_only && !canModerate)}
                      placeholder={isMuted ? "Muted members cannot send messages" : activeRoom.is_read_only && !canModerate ? "Announcements channel is read-only" : `Message #${activeRoom.name}`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-white/80 outline-none placeholder:text-white/22 disabled:cursor-not-allowed"
                    />
                    <button onClick={sendMessage} disabled={!input.trim() || sending} className={cn("rounded-xl p-2 transition-all", input.trim() ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-white/[0.04] text-white/20")}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </section>

              {sidePanel && sidePanelContent && (
                <>
                  <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-white/[0.06] bg-card p-4 lg:block">
                    {sidePanelContent}
                  </aside>
                  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/78 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+88px)] pt-[max(env(safe-area-inset-top,0px),16px)] backdrop-blur-sm lg:hidden" onClick={() => setSidePanel(null)}>
                    <div className="relative flex max-h-[min(78vh,calc(100vh-132px))] w-full max-w-[420px] flex-col overflow-hidden rounded-[30px] border border-white/[0.08] bg-card shadow-[0_30px_90px_rgba(0,0,0,0.55)]" onClick={event => event.stopPropagation()}>
                      <div className="relative border-b border-white/[0.06] px-5 pb-3 pt-5 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/28">{sidePanelLabel}</p>
                        <button onClick={() => setSidePanel(null)} className="absolute right-4 top-4 rounded-lg p-1.5 text-white/35 hover:bg-white/[0.05] hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="overflow-y-auto px-5 py-4">
                        {sidePanelContent}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><MessageSquare className="h-6 w-6" /></div>
              <p className="mt-3 text-sm font-bold text-white/55">Pick a room to start chatting</p>
              <p className="mt-1 text-xs text-white/30">Choose a room on the left, or create a new one.</p>
            </div>
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-popover p-5 shadow-2xl">
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
                  <button key={type.value} onClick={() => setNewRoom(prev => ({ ...prev, room_type: type.value }))} className={cn("rounded-xl border p-2 text-left", newRoom.room_type === type.value ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-white/[0.06] bg-white/[0.025] text-white/45")}>
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
              <button onClick={createRoom} disabled={!newRoom.name.trim()} className="w-full rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110 disabled:opacity-40">
                Create Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-popover p-5 shadow-2xl">
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
              <button onClick={sendAttachment} className="w-full rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110">
                Send attachment
              </button>
            </div>
          </div>
        </div>
      )}

      {modTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-popover p-5 shadow-2xl">
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
      {inviteModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.1] bg-popover p-6 text-center shadow-2xl">
            <button onClick={dismissInvite} className="absolute right-4 top-4 rounded-lg p-1.5 text-white/35 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>

            {inviteModal.inviterAvatar ? (
              <img src={inviteModal.inviterAvatar} alt={inviteModal.inviterName} className="mx-auto mb-3 h-14 w-14 rounded-full object-cover ring-2 ring-og-lime/40" />
            ) : (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-og-lime/15 text-lg font-black text-og-lime ring-2 ring-og-lime/40">
                {inviteModal.inviterName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <p className="text-sm text-white/60">
              <span className="font-bold text-white">@{inviteModal.inviterName}</span> has invited you to join
            </p>

            <div className="my-3 flex items-center justify-center gap-2">
              {inviteModal.room.avatar_url && (
                <img src={inviteModal.room.avatar_url} alt={inviteModal.room.name} className="h-6 w-6 rounded-lg object-cover" />
              )}
              <h3 className="text-lg font-black text-white">{inviteModal.room.name}</h3>
            </div>
            {inviteModal.room.description && (
              <p className="mb-4 text-xs text-white/40 line-clamp-2">{inviteModal.room.description}</p>
            )}
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-wide text-white/25">
              {inviteModal.room.member_count || 0} members
            </p>

            <button
              onClick={acceptInvite}
              disabled={joiningInvite}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110 disabled:opacity-50"
            >
              {joiningInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {joiningInvite ? "Joining…" : "Join community"}
            </button>
            <button onClick={dismissInvite} className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-bold text-white/40 hover:text-white">
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityRooms;
