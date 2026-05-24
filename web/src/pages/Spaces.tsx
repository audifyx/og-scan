/**
 * Spaces — Twitter-Spaces-style live audio rooms with chat, reactions, speaker management.
 * Rendered inline inside Index.tsx — do NOT wrap in AppLayout.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MicOff, Plus, Radio, Lock, Hash, Flame, Clock, Crown,
  X as XIcon, Headphones, MessageSquare, Star, StopCircle,
  ChevronDown, Loader2, Search, Share2, Send, Hand, MoreVertical,
  Pin, PinOff, Calendar, Bell, ArrowLeft, Archive,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { VoicePanel } from "@/components/lobbies/VoicePanel";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Space {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  host_username: string | null;
  host_avatar: string | null;
  topic: string | null;
  is_live: boolean;
  is_private: boolean;
  is_recording: boolean;
  listener_count: number;
  speaker_count: number;
  peak_listeners: number;
  created_at: string;
  scheduled_for: string | null;
  ended_at: string | null;
  tags: string[] | null;
  pinned_message: string | null;
  co_hosts: string[] | null;
}

interface SpaceChatMessage {
  id: string;
  space_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
  is_pinned: boolean;
}

interface SpeakerRequest {
  id: string;
  space_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
}

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
  delay: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TOPICS = ["Trading", "Alpha", "NFTs", "DeFi", "Memes", "Research", "Tech", "General"];

const TOPIC_ICONS: Record<string, string> = {
  Trading: "📈", Alpha: "🔑", NFTs: "🖼️", DeFi: "🏦",
  Memes: "🐸", Research: "🔬", Tech: "⚡", General: "💬",
};

const TOPIC_COLORS: Record<string, string> = {
  Trading: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  Alpha: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  NFTs: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  DeFi: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Memes: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  Research: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  Tech: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  General: "text-white/40 bg-white/5 border-white/10",
};

const REACTION_EMOJIS = ["🔥", "👏", "❤️", "💎", "🚀", "💯", "🎯", "⚡"];

const GRAD_PAIRS = [
  "from-violet-600/30 via-purple-800/15 to-transparent",
  "from-sky-600/30 via-blue-800/15 to-transparent",
  "from-emerald-600/30 via-green-800/15 to-transparent",
  "from-amber-600/30 via-orange-800/15 to-transparent",
  "from-rose-600/30 via-pink-800/15 to-transparent",
  "from-cyan-600/30 via-teal-800/15 to-transparent",
  "from-indigo-600/30 via-blue-900/15 to-transparent",
  "from-fuchsia-600/30 via-purple-900/15 to-transparent",
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function spaceGrad(id: string) {
  return GRAD_PAIRS[strHash(id) % GRAD_PAIRS.length];
}

function safeAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const s = url.trim();
  if (!s || s === "default" || !s.startsWith("http")) return undefined;
  return s;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMOJI REACTION OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════

const EmojiReactionOverlay = ({ reactions }: { reactions: FloatingReaction[] }) => (
  <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
    {reactions.map((r) => (
      <div
        key={r.id}
        className="absolute bottom-20 animate-float-up text-2xl"
        style={{
          left: `${r.x}%`,
          animationDelay: `${r.delay}ms`,
          animationDuration: "2.5s",
        }}
      >
        {r.emoji}
      </div>
    ))}
    <style>{`
      @keyframes float-up {
        0% { opacity: 1; transform: translateY(0) scale(1); }
        50% { opacity: 0.8; transform: translateY(-40vh) scale(1.2); }
        100% { opacity: 0; transform: translateY(-80vh) scale(0.6); }
      }
      .animate-float-up { animation: float-up 2.5s ease-out forwards; }
    `}</style>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE TIMER
// ═══════════════════════════════════════════════════════════════════════════════

const LiveTimer = ({ startedAt }: { startedAt: string }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startedAt]);
  return (
    <span className="font-mono text-[11px] text-red-400 tabular-nums">{formatDuration(elapsed)}</span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE SPACE MODAL (Enhanced)
// ═══════════════════════════════════════════════════════════════════════════════

const CreateSpaceModal = ({
  onClose, onCreated, user, profile,
}: {
  onClose: () => void;
  onCreated: (space: Space) => void;
  user: { id: string } | null;
  profile: { username?: string | null; avatar_url?: string | null } | null;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("General");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [creating, setCreating] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && tags.length < 5 && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      let scheduledFor: string | null = null;
      if (isScheduled && scheduledDate && scheduledTime) {
        scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }
      const insertData: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        host_id: user.id,
        host_username: profile?.username || null,
        host_avatar: safeAvatar(profile?.avatar_url) ?? null,
        topic,
        is_live: !isScheduled,
        is_private: isPrivate,
        is_recording: isRecording,
        listener_count: isScheduled ? 0 : 1,
        speaker_count: isScheduled ? 0 : 1,
        peak_listeners: isScheduled ? 0 : 1,
        scheduled_for: scheduledFor,
        tags: tags.length > 0 ? tags : null,
      };
      const { data, error } = await supabase.from("spaces").insert(insertData).select().single();
      if (error) throw error;
      toast.success(isScheduled ? "Space scheduled! 📅" : "Space started! 🎙️");
      onCreated(data as Space);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create space.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-[#0d1117] rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07] shrink-0">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              {isScheduled ? "Schedule a Space" : "Start a Space"}
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              {isScheduled ? "Set a time for your community" : "Go live with voice to your community"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition">
            <XIcon className="h-4 w-4 text-white/50" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: "none" }}>
          {/* Title */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Space Title *</label>
            <Input
              placeholder="e.g. Solana Alpha Call — New Launches"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
              className="bg-white/[0.04] border-white/10 rounded-xl"
            />
            <p className="text-[10px] text-white/20 mt-1 text-right">{title.length}/80</p>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Description</label>
            <Textarea
              placeholder="What's this space about?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={280}
              className="bg-white/[0.04] border-white/10 rounded-xl resize-none min-h-[72px] text-sm"
            />
            <p className="text-[10px] text-white/20 mt-1 text-right">{description.length}/280</p>
          </div>

          {/* Topic */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 block">Topic</label>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map(t => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5",
                    topic === t
                      ? "bg-primary/20 border-primary/50 text-primary scale-105"
                      : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                  )}
                >
                  <span>{TOPIC_ICONS[t]}</span> {t}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Tags (up to 5)</label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                className="bg-white/[0.04] border-white/10 rounded-xl flex-1"
              />
              <Button size="sm" variant="outline" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 5} className="rounded-xl border-white/10 shrink-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    #{t}
                    <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-red-400 transition">
                      <XIcon className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {/* Schedule toggle */}
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-primary/60" />
                <div>
                  <p className="text-sm font-bold text-white">Schedule for later</p>
                  <p className="text-[10px] text-white/35">Set a date & time</p>
                </div>
              </div>
              <button onClick={() => setIsScheduled(v => !v)} className={cn("w-11 h-6 rounded-full transition-colors relative", isScheduled ? "bg-primary" : "bg-white/10")}>
                <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform", isScheduled ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            {/* Schedule date/time */}
            {isScheduled && (
              <div className="flex gap-2 pl-7">
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="bg-white/[0.04] border-white/10 rounded-xl text-sm flex-1"
                />
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="bg-white/[0.04] border-white/10 rounded-xl text-sm w-32"
                />
              </div>
            )}

            {/* Private toggle */}
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <Lock className="h-4 w-4 text-white/40" />
                <div>
                  <p className="text-sm font-bold text-white">Private Space</p>
                  <p className="text-[10px] text-white/35">Only invited users can join</p>
                </div>
              </div>
              <button onClick={() => setIsPrivate(v => !v)} className={cn("w-11 h-6 rounded-full transition-colors relative", isPrivate ? "bg-primary" : "bg-white/10")}>
                <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform", isPrivate ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            {/* Recording toggle */}
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full border-2 border-red-400 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Record Space</p>
                  <p className="text-[10px] text-white/35">Save a recording for replay</p>
                </div>
              </div>
              <button onClick={() => setIsRecording(v => !v)} className={cn("w-11 h-6 rounded-full transition-colors relative", isRecording ? "bg-red-500" : "bg-white/10")}>
                <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform", isRecording ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-white/[0.07] shrink-0">
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || creating || (isScheduled && (!scheduledDate || !scheduledTime))}
            className="w-full rounded-full btn-3d font-bold gap-2 h-11"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isScheduled ? (
              <><Calendar className="h-4 w-4" /> Schedule Space</>
            ) : (
              <><Mic className="h-4 w-4" /> Go Live</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPACE CARD
// ═══════════════════════════════════════════════════════════════════════════════

const SpaceCard = ({ space, onJoin, variant = "default" }: {
  space: Space;
  onJoin: (s: Space) => void;
  variant?: "default" | "featured" | "past";
}) => {
  const topicColor = TOPIC_COLORS[space.topic || "General"] || TOPIC_COLORS.General;
  const grad = spaceGrad(space.id);
  const totalPeople = (space.listener_count || 0) + (space.speaker_count || 0);
  const isFeatured = variant === "featured";
  const isPast = variant === "past";

  return (
    <button
      onClick={() => !isPast && onJoin(space)}
      className={cn(
        "w-full text-left rounded-2xl border transition-all group relative overflow-hidden",
        isFeatured
          ? `p-5 border-primary/20 bg-gradient-to-br ${grad} hover:border-primary/40 shadow-lg shadow-primary/5`
          : isPast
            ? "p-4 border-white/[0.06] bg-white/[0.02] opacity-70 cursor-default"
            : `p-4 border-white/[0.08] bg-gradient-to-br ${grad} hover:border-white/20`,
      )}
    >
      {/* Live pulse */}
      {space.is_live && !isPast && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Live</span>
        </div>
      )}

      {/* Recording badge */}
      {space.is_recording && (
        <div className="absolute top-3 right-20 flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-bold text-red-400/70 uppercase">Rec</span>
        </div>
      )}

      {/* Ended badge */}
      {isPast && space.ended_at && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <Archive className="h-3 w-3 text-white/30" />
          <span className="text-[10px] font-bold text-white/30 uppercase">Ended</span>
        </div>
      )}

      <div className="pr-20">
        {/* Topic + tags */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {space.topic && (
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", topicColor)}>
              <span>{TOPIC_ICONS[space.topic] || "💬"}</span> {space.topic}
            </span>
          )}
          {space.tags?.slice(0, 2).map(t => (
            <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/[0.06]">
              #{t}
            </span>
          ))}
        </div>

        <h3 className={cn("font-black text-white leading-tight", isFeatured ? "text-base" : "text-sm")}>
          {space.title}
        </h3>
        {space.description && (
          <p className={cn("text-white/40 mt-1 line-clamp-2", isFeatured ? "text-sm" : "text-xs")}>
            {space.description}
          </p>
        )}
      </div>

      {/* Host + stats */}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
            {safeAvatar(space.host_avatar) ? (
              <img src={safeAvatar(space.host_avatar)} alt="" className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
            ) : (
              <Crown className="h-3 w-3 text-primary" />
            )}
          </div>
          <span className="text-xs text-white/60 font-medium">
            {space.host_username ? `@${space.host_username}` : "Host"}
          </span>
        </div>

        <div className="flex items-center gap-3 ml-auto text-white/30">
          {space.speaker_count > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <Mic className="h-3 w-3" />
              <span>{space.speaker_count}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs">
            <Headphones className="h-3 w-3" />
            <span>{totalPeople.toLocaleString()}</span>
          </div>
          {space.is_private && <Lock className="h-3 w-3 text-white/20" />}
        </div>
      </div>

      {/* Time context */}
      {isPast && space.ended_at && (
        <p className="text-[10px] text-white/20 mt-2">
          Ended {formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}
        </p>
      )}

      {/* Join CTA glow on hover */}
      {!isPast && (
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED SPACE CARD
// ═══════════════════════════════════════════════════════════════════════════════

const ScheduledSpaceCard = ({ space, onRemind }: {
  space: Space;
  onRemind: (s: Space) => void;
}) => {
  const topicColor = TOPIC_COLORS[space.topic || "General"] || TOPIC_COLORS.General;

  return (
    <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.12] transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {space.topic && (
              <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border", topicColor)}>
                <span>{TOPIC_ICONS[space.topic] || "💬"}</span> {space.topic}
              </span>
            )}
          </div>
          <h3 className="font-bold text-sm text-white">{space.title}</h3>
          {space.description && (
            <p className="text-xs text-white/35 mt-0.5 line-clamp-1">{space.description}</p>
          )}
          {space.scheduled_for && (
            <div className="flex items-center gap-2 mt-2">
              <Clock className="h-3 w-3 text-primary/60" />
              <p className="text-xs text-primary/80 font-medium">
                {format(new Date(space.scheduled_for), "MMM d · h:mm a")}
              </p>
              <span className="text-[10px] text-white/25">
                ({formatDistanceToNow(new Date(space.scheduled_for), { addSuffix: true })})
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-4 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
              {safeAvatar(space.host_avatar) ? (
                <img src={safeAvatar(space.host_avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                <Crown className="h-2.5 w-2.5 text-primary" />
              )}
            </div>
            <span className="text-[11px] text-white/40">{space.host_username ? `@${space.host_username}` : "Host"}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRemind(space)}
          className="rounded-full text-xs h-8 border-primary/20 text-primary hover:bg-primary/10 shrink-0 gap-1.5"
        >
          <Bell className="h-3 w-3" /> Remind
        </Button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPACE LIVE CHAT
// ═══════════════════════════════════════════════════════════════════════════════

const SpaceChat = ({ spaceId, isHost }: { spaceId: string; isHost: boolean }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<SpaceChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("space_messages")
        .select("*")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data as SpaceChatMessage[]) || []);
    } catch { /* ignore */ }
  }, [spaceId]);

  useEffect(() => {
    fetchMessages();
    // Realtime subscription
    const channel = supabase
      .channel(`space-chat-${spaceId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "space_messages",
        filter: `space_id=eq.${spaceId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as SpaceChatMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [spaceId, fetchMessages]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  };

  const sendMessage = async () => {
    if (!user || !input.trim()) return;
    setSending(true);
    try {
      await supabase.from("space_messages").insert({
        space_id: spaceId,
        user_id: user.id,
        username: profile?.username || null,
        avatar_url: safeAvatar(profile?.avatar_url) ?? null,
        content: input.trim(),
      });
      setInput("");
    } catch (err: any) {
      toast.error("Failed to send message");
    }
    setSending(false);
  };

  const pinMessage = async (msg: SpaceChatMessage) => {
    if (!isHost) return;
    try {
      await supabase.from("spaces").update({ pinned_message: msg.content }).eq("id", spaceId);
      toast.success("Message pinned!");
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-1" style={{ scrollbarWidth: "none" }}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 mx-auto text-white/10 mb-2" />
            <p className="text-xs text-white/20">No messages yet — say something!</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="group flex items-start gap-2 py-1 hover:bg-white/[0.02] rounded-lg px-1">
            <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
              {safeAvatar(msg.avatar_url) ? (
                <img src={safeAvatar(msg.avatar_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[9px] font-bold text-white/40">
                  {msg.username?.[0]?.toUpperCase() || "?"}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-bold text-white/60 truncate">{msg.username || "Anon"}</span>
                <span className="text-[9px] text-white/15 shrink-0">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-[12px] text-white/70 break-words leading-relaxed">{msg.content}</p>
            </div>
            {isHost && (
              <button
                onClick={() => pinMessage(msg)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition shrink-0"
                title="Pin message"
              >
                <Pin className="h-3 w-3 text-white/30" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Not auto-scrolled indicator */}
      {!autoScroll && messages.length > 5 && (
        <button
          onClick={() => { setAutoScroll(true); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }}
          className="mx-3 mb-1 py-1 px-3 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-bold flex items-center gap-1 justify-center"
        >
          <ChevronDown className="h-3 w-3" /> New messages
        </button>
      )}

      {/* Input */}
      <div className="px-3 pb-2 pt-1 border-t border-white/[0.07]">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            className="bg-white/[0.04] border-white/[0.08] rounded-full text-sm h-9"
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="rounded-full h-9 w-9 p-0 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPEAKER QUEUE / HAND RAISE PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const SpeakerQueue = ({
  spaceId, isHost, onRaiseHand, hasRaisedHand,
}: {
  spaceId: string;
  isHost: boolean;
  onRaiseHand: () => void;
  hasRaisedHand: boolean;
}) => {
  const [requests, setRequests] = useState<SpeakerRequest[]>([]);

  useEffect(() => {
    if (!isHost) return;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from("speaker_requests")
          .select("*")
          .eq("space_id", spaceId)
          .eq("status", "pending")
          .order("created_at", { ascending: true });
        setRequests((data as SpeakerRequest[]) || []);
      } catch { /* ignore */ }
    };
    fetch();
    const channel = supabase
      .channel(`speaker-requests-${spaceId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "speaker_requests",
        filter: `space_id=eq.${spaceId}`,
      }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [spaceId, isHost]);

  const handleRequest = async (reqId: string, status: "approved" | "denied") => {
    try {
      await supabase.from("speaker_requests").update({ status }).eq("id", reqId);
      setRequests(prev => prev.filter(r => r.id !== reqId));
      toast.success(status === "approved" ? "Speaker approved! 🎙️" : "Request denied");
    } catch { /* ignore */ }
  };

  if (!isHost) {
    return (
      <button
        onClick={onRaiseHand}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
          hasRaisedHand
            ? "bg-amber-400/20 text-amber-400 border border-amber-400/30"
            : "bg-white/5 text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70"
        )}
      >
        <Hand className={cn("h-4 w-4", hasRaisedHand && "animate-bounce")} />
        {hasRaisedHand ? "Hand Raised" : "Raise Hand"}
      </button>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="bg-amber-400/5 border border-amber-400/15 rounded-xl p-3 space-y-2">
      <p className="text-[10px] font-bold text-amber-400/60 uppercase tracking-wider flex items-center gap-1.5">
        <Hand className="h-3 w-3" /> Speaker Requests · {requests.length}
      </p>
      {requests.map(req => (
        <div key={req.id} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center overflow-hidden">
            {safeAvatar(req.avatar_url) ? (
              <img src={safeAvatar(req.avatar_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] font-bold text-white/40">{req.username?.[0]?.toUpperCase() || "?"}</span>
            )}
          </div>
          <span className="text-xs text-white/70 font-medium flex-1 truncate">{req.username || "User"}</span>
          <button
            onClick={() => handleRequest(req.id, "approved")}
            className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20"
          >
            Accept
          </button>
          <button
            onClick={() => handleRequest(req.id, "denied")}
            className="p-1 rounded-full hover:bg-white/10 text-white/30"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPACE ROOM (Full Experience)
// ═══════════════════════════════════════════════════════════════════════════════

const SpaceRoom = ({ space, onLeave }: { space: Space; onLeave: () => void }) => {
  const { user, profile } = useAuth();
  const [muted, setMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [pinnedMsg, setPinnedMsg] = useState(space.pinned_message);
  const [currentSpace, setCurrentSpace] = useState(space);
  const isHost = user?.id === space.host_id;
  const topicColor = TOPIC_COLORS[space.topic || "General"] || TOPIC_COLORS.General;
  const reactionIdRef = useRef(0);

  // Realtime space updates
  useEffect(() => {
    const channel = supabase
      .channel(`space-room-${space.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "spaces",
        filter: `id=eq.${space.id}`,
      }, (payload) => {
        const updated = payload.new as Space;
        setCurrentSpace(updated);
        if (updated.pinned_message !== pinnedMsg) {
          setPinnedMsg(updated.pinned_message);
        }
        if (updated.ended_at) {
          toast("This space has ended");
          onLeave();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [space.id]);

  // Increment listener count on join
  useEffect(() => {
    if (!user) return;
    supabase.rpc("increment_listener", { space_id: space.id }).catch(() => {});
    return () => {
      supabase.rpc("decrement_listener", { space_id: space.id }).catch(() => {});
    };
  }, [space.id, user?.id]);

  const sendReaction = (emoji: string) => {
    const id = reactionIdRef.current++;
    const x = 15 + Math.random() * 70;
    setReactions(prev => [...prev, { id, emoji, x, delay: Math.random() * 300 }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
  };

  const raiseHand = async () => {
    if (!user || hasRaisedHand) return;
    try {
      await supabase.from("speaker_requests").insert({
        space_id: space.id,
        user_id: user.id,
        username: profile?.username || null,
        avatar_url: safeAvatar(profile?.avatar_url) ?? null,
        status: "pending",
      });
      setHasRaisedHand(true);
      toast("Hand raised! ✋ The host will see your request.");
    } catch {
      toast.error("Failed to raise hand");
    }
  };

  const endSpace = async () => {
    if (!isHost) return;
    try {
      await supabase.from("spaces").update({
        is_live: false,
        ended_at: new Date().toISOString(),
      }).eq("id", space.id);
      toast.success("Space ended");
      onLeave();
    } catch {
      toast.error("Failed to end space");
    }
  };

  const shareSpace = () => {
    const url = `${window.location.origin}/spaces?join=${space.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Space link copied! 🔗");
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <EmojiReactionOverlay reactions={reactions} />

      {/* ── Room Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] sticky top-0 bg-[#070d14]/95 backdrop-blur-md z-10 shrink-0">
        <button onClick={onLeave} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="h-4 w-4 text-white/60" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-white truncate">{currentSpace.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {currentSpace.topic && (
              <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", topicColor)}>
                {TOPIC_ICONS[currentSpace.topic] || "💬"} {currentSpace.topic}
              </span>
            )}
            <span className="text-[10px] text-white/25">·</span>
            <div className="flex items-center gap-1 text-[10px] text-white/30">
              <Headphones className="h-2.5 w-2.5" />
              {(currentSpace.listener_count || 0) + (currentSpace.speaker_count || 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            <LiveTimer startedAt={currentSpace.created_at} />
          </div>
          <button onClick={shareSpace} className="p-2 rounded-full hover:bg-white/10 transition" title="Share">
            <Share2 className="h-4 w-4 text-white/40" />
          </button>
          {isHost && (
            <div className="relative">
              <button onClick={() => setShowMore(!showMore)} className="p-2 rounded-full hover:bg-white/10 transition">
                <MoreVertical className="h-4 w-4 text-white/40" />
              </button>
              {showMore && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMore(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-[#0d1117] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                    <button
                      onClick={() => { endSpace(); setShowMore(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
                    >
                      <StopCircle className="h-4 w-4" /> End Space
                    </button>
                    <button
                      onClick={() => { setPinnedMsg(null); supabase.from("spaces").update({ pinned_message: null }).eq("id", space.id); setShowMore(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5 transition"
                    >
                      <PinOff className="h-4 w-4" /> Clear Pin
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Pinned Message ── */}
      {pinnedMsg && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/15 flex items-start gap-2 shrink-0">
          <Pin className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/80 leading-relaxed flex-1 line-clamp-2">{pinnedMsg}</p>
          {isHost && (
            <button onClick={() => { setPinnedMsg(null); supabase.from("spaces").update({ pinned_message: null }).eq("id", space.id); }} className="p-0.5 hover:bg-white/10 rounded">
              <XIcon className="h-2.5 w-2.5 text-white/30" />
            </button>
          )}
        </div>
      )}

      {/* ── Recording indicator ── */}
      {currentSpace.is_recording && (
        <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/5 border border-red-500/10 w-fit shrink-0">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-red-400/70">Recording in progress</span>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
        {/* Left: Voice / Speakers / Listeners */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0" style={{ scrollbarWidth: "none" }}>
          {/* Host */}
          <div className="mb-5">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Crown className="h-3 w-3 text-amber-400" /> Host
            </p>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/40 to-violet-600/40 border-2 border-primary/30 flex items-center justify-center font-black text-lg overflow-hidden relative">
                {safeAvatar(currentSpace.host_avatar) ? (
                  <img src={safeAvatar(currentSpace.host_avatar)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{currentSpace.host_username?.[0]?.toUpperCase() ?? "H"}</span>
                )}
                {/* Speaking indicator ring */}
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/50 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-white">{currentSpace.host_username ? `@${currentSpace.host_username}` : "Host"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Mic className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-bold">Speaking</span>
                </div>
              </div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-emerald-400 animate-pulse"
                    style={{ height: `${6 + i * 4}px`, animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Voice Panel (speakers) */}
          <div className="mb-5">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Mic className="h-3 w-3" /> Speakers
            </p>
            <VoicePanel lobbyId={`space-${space.id}`} lobbyName={space.title} autoJoin />
          </div>

          {/* Speaker Queue / Hand Raise */}
          <div className="mb-5">
            <SpeakerQueue
              spaceId={space.id}
              isHost={isHost}
              onRaiseHand={raiseHand}
              hasRaisedHand={hasRaisedHand}
            />
          </div>

          {/* Listeners */}
          <div className="mb-4">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Headphones className="h-3 w-3" /> Listeners · {currentSpace.listener_count || 0}
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {user && (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center font-bold text-sm overflow-hidden">
                    {safeAvatar(profile?.avatar_url) ? (
                      <img src={safeAvatar(profile?.avatar_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary">{profile?.username?.[0]?.toUpperCase() ?? "Y"}</span>
                    )}
                  </div>
                  <span className="text-[9px] text-primary/70 font-medium">You</span>
                </div>
              )}
              {Array.from({ length: Math.min(Math.max((currentSpace.listener_count || 1) - 1, 0), 15) }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <Headphones className="h-4 w-4 text-white/15" />
                  </div>
                  <span className="text-[9px] text-white/15">Listener</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          {currentSpace.description && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] mb-4">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-1">About</p>
              <p className="text-xs text-white/50 leading-relaxed">{currentSpace.description}</p>
            </div>
          )}

          {/* Tags */}
          {currentSpace.tags && currentSpace.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {currentSpace.tags.map(t => (
                <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/[0.06]">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Chat Panel (desktop side, mobile bottom sheet) */}
        <div className={cn(
          "border-t lg:border-t-0 lg:border-l border-white/[0.07] flex flex-col",
          showChat ? "h-[45vh] lg:h-auto lg:w-80" : "h-0 lg:h-auto lg:w-0 overflow-hidden"
        )}>
          {showChat && (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07] shrink-0">
                <p className="text-[11px] font-bold text-white/50 flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" /> Live Chat
                </p>
                <button onClick={() => setShowChat(false)} className="p-1 rounded hover:bg-white/10 lg:hidden">
                  <XIcon className="h-3 w-3 text-white/30" />
                </button>
              </div>
              <SpaceChat spaceId={space.id} isHost={isHost} />
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Controls ── */}
      <div className="px-4 pb-4 pt-3 border-t border-white/[0.07] shrink-0 bg-[#070d14]">
        {/* Emoji Reactions Row */}
        <div className="flex items-center gap-1 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:scale-110 active:scale-95 transition-all text-lg shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { setMuted(v => !v); toast(muted ? "Unmuted 🎙️" : "Muted 🔇"); }}
            className={cn(
              "flex items-center gap-2 px-5 h-11 rounded-full font-bold text-sm transition-all",
              muted
                ? "bg-white/10 text-white/60 hover:bg-white/15"
                : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
            )}
          >
            {muted ? <><MicOff className="h-4 w-4" /> Unmute</> : <><Mic className="h-4 w-4" /> Speaking</>}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChat(!showChat)}
              className={cn(
                "h-11 w-11 rounded-full flex items-center justify-center transition-all border",
                showChat
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
              )}
              title="Toggle chat"
            >
              <MessageSquare className="h-4 w-4" />
            </button>

            {!isHost && (
              <button
                onClick={raiseHand}
                className={cn(
                  "h-11 w-11 rounded-full flex items-center justify-center transition-all border",
                  hasRaisedHand
                    ? "bg-amber-400/15 border-amber-400/30 text-amber-400"
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                )}
                title="Raise hand"
              >
                <Hand className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={onLeave}
              className="h-11 px-5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SPACES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const Spaces = () => {
  const { user, profile } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<"live" | "scheduled" | "past">("live");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const fetchSpaces = useCallback(async () => {
    try {
      const [liveRes, pastRes] = await Promise.all([
        supabase
          .from("spaces")
          .select("*")
          .or("is_live.eq.true,and(is_live.eq.false,ended_at.is.null)")
          .order("is_live", { ascending: false })
          .order("listener_count", { ascending: false })
          .limit(50),
        supabase
          .from("spaces")
          .select("*")
          .eq("is_live", false)
          .not("ended_at", "is", null)
          .order("ended_at", { ascending: false })
          .limit(20),
      ]);
      setSpaces((liveRes.data as Space[]) || []);
      setPastSpaces((pastRes.data as Space[]) || []);
    } catch {
      setSpaces([]);
      setPastSpaces([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSpaces();
    // Realtime for space list updates
    const channel = supabase
      .channel("spaces-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces" }, () => {
        fetchSpaces();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSpaces]);

  // Check URL for ?join=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join");
    if (joinId) {
      const space = spaces.find(s => s.id === joinId);
      if (space) setActiveSpace(space);
    }
  }, [spaces]);

  const handleCreated = (space: Space) => {
    if (space.is_live) {
      setSpaces(prev => [space, ...prev]);
      setActiveSpace(space);
    } else {
      setSpaces(prev => [space, ...prev]);
      setTab("scheduled");
      toast.success("Space scheduled! Switching to Scheduled tab.");
    }
  };

  const handleRemind = (space: Space) => {
    toast.success(`Reminder set for "${space.title}"! 🔔`);
  };

  // Filtered spaces
  const filterBySearch = (s: Space) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.description?.toLowerCase().includes(q)) ||
      (s.topic?.toLowerCase().includes(q)) ||
      (s.host_username?.toLowerCase().includes(q)) ||
      (s.tags?.some(t => t.toLowerCase().includes(q)))
    );
  };

  const filterByTopic = (s: Space) => !topicFilter || s.topic === topicFilter;

  const liveSpaces = spaces.filter(s => s.is_live && filterByTopic(s) && filterBySearch(s));
  const scheduledSpaces = spaces.filter(s => !s.is_live && !s.ended_at && filterByTopic(s) && filterBySearch(s));
  const endedSpaces = pastSpaces.filter(s => filterByTopic(s) && filterBySearch(s));

  const totalListeners = liveSpaces.reduce((sum, s) => sum + (s.listener_count || 0) + (s.speaker_count || 0), 0);

  // ── Active Room ──
  if (activeSpace) {
    return <SpaceRoom space={activeSpace} onLeave={() => { setActiveSpace(null); fetchSpaces(); }} />;
  }

  // ── Main List View ──
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Spaces
          </h2>
          <p className="text-xs text-white/30 mt-0.5">
            {liveSpaces.length > 0
              ? `${liveSpaces.length} live · ${totalListeners.toLocaleString()} listening`
              : "Live audio rooms for the community"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center transition border",
              showSearch ? "bg-primary/10 border-primary/30 text-primary" : "border-white/10 text-white/40 hover:bg-white/5"
            )}
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <Button onClick={() => setShowCreate(true)} className="rounded-full btn-3d gap-1.5 text-xs h-8 px-3" size="sm">
            <Mic className="h-3.5 w-3.5" /> Start
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <Input
            placeholder="Search spaces by title, topic, or host..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-white/[0.04] border-white/10 rounded-xl pl-9 pr-9"
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Tabs: Live | Scheduled | Past */}
      <div className="flex border-b border-white/[0.07] mb-4">
        {[
          { key: "live" as const, label: "Live Now", count: liveSpaces.length, showPulse: liveSpaces.length > 0 },
          { key: "scheduled" as const, label: "Scheduled", count: scheduledSpaces.length, showPulse: false },
          { key: "past" as const, label: "Past", count: endedSpaces.length, showPulse: false },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-[12px] font-bold transition-colors relative flex items-center gap-2",
              tab === t.key ? "text-white" : "text-white/35 hover:text-white/60"
            )}
          >
            {t.showPulse && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                tab === t.key ? "bg-primary/20 text-primary" : "bg-white/5 text-white/25"
              )}>
                {t.count}
              </span>
            )}
            {tab === t.key && <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* Topic filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => setTopicFilter(null)}
          className={cn(
            "px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 transition-colors",
            !topicFilter ? "bg-primary/15 border-primary/50 text-primary" : "border-white/10 text-white/40 hover:border-white/20"
          )}
        >
          All
        </button>
        {TOPICS.map(t => (
          <button
            key={t}
            onClick={() => setTopicFilter(topicFilter === t ? null : t)}
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 transition-colors flex items-center gap-1",
              topicFilter === t ? "bg-primary/15 border-primary/50 text-primary" : "border-white/10 text-white/40 hover:border-white/20"
            )}
          >
            <span className="text-xs">{TOPIC_ICONS[t]}</span> {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : tab === "live" ? (
        liveSpaces.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No live spaces right now"
            subtitle={searchQuery ? "Try a different search" : "Be the first to start one!"}
            action={!searchQuery ? { label: "Start a Space", onClick: () => setShowCreate(true) } : undefined}
          />
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {/* Featured (top space) */}
            {liveSpaces[0] && (
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Flame className="h-3 w-3 text-orange-400" /> Featured
                </p>
                <SpaceCard space={liveSpaces[0]} onJoin={setActiveSpace} variant="featured" />
              </div>
            )}
            {liveSpaces.length > 1 && (
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 mt-2">More Spaces</p>
                <div className="flex flex-col gap-2.5">
                  {liveSpaces.slice(1).map(s => (
                    <SpaceCard key={s.id} space={s} onJoin={setActiveSpace} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      ) : tab === "scheduled" ? (
        scheduledSpaces.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No scheduled spaces"
            subtitle="Schedule a space to notify your followers"
            action={{ label: "Schedule a Space", onClick: () => { setShowCreate(true); } }}
          />
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {scheduledSpaces.map(s => (
              <ScheduledSpaceCard key={s.id} space={s} onRemind={handleRemind} />
            ))}
          </div>
        )
      ) : (
        endedSpaces.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No past spaces"
            subtitle="Ended spaces will appear here"
          />
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {endedSpaces.map(s => (
              <SpaceCard key={s.id} space={s} onJoin={() => {}} variant="past" />
            ))}
          </div>
        )
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateSpaceModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          user={user}
          profile={profile}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

const EmptyState = ({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}) => (
  <div className="text-center py-20">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-4">
      <Icon className="h-8 w-8 text-white/10" />
    </div>
    <p className="font-bold text-white/30">{title}</p>
    <p className="text-sm text-white/20 mt-1">{subtitle}</p>
    {action && (
      <Button onClick={action.onClick} className="mt-4 rounded-full btn-3d gap-2 text-sm">
        <Mic className="h-4 w-4" /> {action.label}
      </Button>
    )}
  </div>
);

export default Spaces;
