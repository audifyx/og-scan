/**
 * Spaces — Premium Twitter-Spaces-style live audio rooms.
 * Features: live chat, reactions, speaker management, polls, mini player,
 * trending banner, co-hosts, RSVP, replay summaries, glassmorphism design.
 * Rendered inline inside Index.tsx — do NOT wrap in AppLayout.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Mic, MicOff, Plus, Radio, Lock, Flame, Clock, Crown, X as XIcon,
  Headphones, MessageSquare, Star, StopCircle, ChevronDown, Loader2,
  Search, Share2, Send, Hand, MoreVertical, Pin, PinOff, Calendar,
  Bell, ArrowLeft, Archive, Volume2, Users, Globe, Sparkles,
  TrendingUp, Heart, ThumbsUp, Eye, BarChart3, Copy, Zap,
  Shield, Play, Pause, Minimize2, Maximize2, ChevronRight,
  AlertCircle, CheckCircle2, Repeat2, ExternalLink, UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { VoicePanel } from "@/components/lobbies/VoicePanel";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════════ */

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

interface FloatingReaction { id: number; emoji: string; x: number; delay: number; size: number }

interface PollOption { label: string; votes: number }
interface SpacePoll { question: string; options: PollOption[]; votedIndex: number | null; closed: boolean }

/* ═══════════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════════ */

const TOPICS = ["Trading", "Alpha", "NFTs", "DeFi", "Memes", "Research", "Tech", "General"] as const;

const TOPIC_META: Record<string, { icon: string; color: string; glow: string }> = {
  Trading:  { icon: "📈", color: "text-sky-400 bg-sky-500/10 border-sky-500/25",       glow: "shadow-sky-500/10" },
  Alpha:    { icon: "🔑", color: "text-amber-400 bg-amber-500/10 border-amber-500/25", glow: "shadow-amber-500/10" },
  NFTs:     { icon: "🖼️", color: "text-violet-400 bg-violet-500/10 border-violet-500/25", glow: "shadow-violet-500/10" },
  DeFi:     { icon: "🏦", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", glow: "shadow-emerald-500/10" },
  Memes:    { icon: "🐸", color: "text-pink-400 bg-pink-500/10 border-pink-500/25",     glow: "shadow-pink-500/10" },
  Research: { icon: "🔬", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",     glow: "shadow-cyan-500/10" },
  Tech:     { icon: "⚡", color: "text-blue-400 bg-blue-500/10 border-blue-500/25",     glow: "shadow-blue-500/10" },
  General:  { icon: "💬", color: "text-white/50 bg-white/5 border-white/10",            glow: "" },
};

const REACTION_EMOJIS = ["🔥", "👏", "❤️", "💎", "🚀", "💯", "🎯", "⚡", "🧠", "😂"];

const CARD_GRADIENTS = [
  "from-violet-600/20 via-purple-900/10 to-transparent",
  "from-sky-600/20 via-blue-900/10 to-transparent",
  "from-emerald-600/20 via-green-900/10 to-transparent",
  "from-amber-600/20 via-orange-900/10 to-transparent",
  "from-rose-600/20 via-pink-900/10 to-transparent",
  "from-cyan-600/20 via-teal-900/10 to-transparent",
  "from-indigo-600/20 via-blue-950/10 to-transparent",
  "from-fuchsia-600/20 via-purple-950/10 to-transparent",
];

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };
const cardGrad = (id: string) => CARD_GRADIENTS[hash(id) % CARD_GRADIENTS.length];
const topicOf = (t: string | null) => TOPIC_META[t || "General"] || TOPIC_META.General;

function fmtDur(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
}

function safAvatar(url: string | null | undefined) { return safeAvatarUrl(url); }

/* ═══════════════════════════════════════════════════════════════════════════════
   INLINE STYLES — injected once
   ═══════════════════════════════════════════════════════════════════════════════ */

const SpaceStyles = () => (
  <style>{`
    @keyframes sp-float{0%{opacity:1;transform:translateY(0) scale(1) rotate(0deg)}40%{opacity:.9;transform:translateY(-35vh) scale(1.3) rotate(-8deg)}100%{opacity:0;transform:translateY(-80vh) scale(.5) rotate(12deg)}}
    .sp-float{animation:sp-float var(--dur,2.8s) ease-out forwards}
    @keyframes sp-pulse-ring{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.4)}50%{box-shadow:0 0 0 8px rgba(52,211,153,0)}}
    .sp-pulse-ring{animation:sp-pulse-ring 2s ease-in-out infinite}
    @keyframes sp-eq{0%,100%{height:var(--h1,4px)}50%{height:var(--h2,14px)}}
    .sp-eq-bar{animation:sp-eq var(--spd,0.4s) ease-in-out infinite alternate}
    @keyframes sp-gradient-shift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    .sp-gradient-bg{background-size:200% 200%;animation:sp-gradient-shift 8s ease infinite}
    @keyframes sp-slide-up{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
    .sp-slide-up{animation:sp-slide-up .35s ease-out both}
    @keyframes sp-glow{0%,100%{opacity:.6}50%{opacity:1}}
    .sp-glow{animation:sp-glow 2.5s ease-in-out infinite}
  `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   AUDIO EQUALIZER (visual)
   ═══════════════════════════════════════════════════════════════════════════════ */

const AudioEQ = ({ active = true, color = "bg-emerald-400", bars = 4 }: { active?: boolean; color?: string; bars?: number }) => (
  <div className="flex items-end gap-[2px] h-4">
    {Array.from({ length: bars }, (_, i) => (
      <div
        key={i}
        className={cn("w-[3px] rounded-full transition-all", active ? color : "bg-white/10")}
        style={active ? {
          ["--h1" as string]: `${3 + i}px`,
          ["--h2" as string]: `${8 + Math.random() * 8}px`,
          ["--spd" as string]: `${0.3 + Math.random() * 0.3}s`,
          animationDelay: `${i * 0.1}s`,
          height: `${8 + Math.random() * 8}px`,
        } as React.CSSProperties : { height: "4px" }}
      />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   FLOATING REACTIONS OVERLAY
   ═══════════════════════════════════════════════════════════════════════════════ */

const ReactionOverlay = ({ items }: { items: FloatingReaction[] }) => (
  <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
    {items.map(r => (
      <div key={r.id} className="absolute bottom-24 sp-float" style={{ left: `${r.x}%`, ["--dur" as string]: `${2.2 + r.delay}s`, fontSize: `${r.size}px` }}>
        {r.emoji}
      </div>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   LIVE TIMER
   ═══════════════════════════════════════════════════════════════════════════════ */

const LiveTimer = ({ startedAt }: { startedAt: string }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const s = new Date(startedAt).getTime();
    const t = () => setElapsed(Math.floor((Date.now() - s) / 1000));
    t(); const iv = setInterval(t, 1000); return () => clearInterval(iv);
  }, [startedAt]);
  return <span className="font-mono text-[11px] text-red-400 tabular-nums">{fmtDur(elapsed)}</span>;
};

/* ═══════════════════════════════════════════════════════════════════════════════
   TOGGLE SWITCH — reusable
   ═══════════════════════════════════════════════════════════════════════════════ */

const Toggle = ({ on, onChange, activeColor = "bg-primary" }: { on: boolean; onChange: () => void; activeColor?: string }) => (
  <button onClick={onChange} className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0", on ? activeColor : "bg-white/10")}>
    <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform", on ? "translate-x-6" : "translate-x-1")} />
  </button>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   AVATAR STACK — overlapping avatars
   ═══════════════════════════════════════════════════════════════════════════════ */

const AvatarStack = ({ avatars, count, size = 24 }: { avatars: (string | null)[]; count: number; size?: number }) => (
  <div className="flex items-center">
    <div className="flex -space-x-2">
      {avatars.slice(0, 3).map((a, i) => (
        <div key={i} style={{ width: size, height: size, zIndex: 3 - i }} className="rounded-full border-2 border-[#0a0f18] bg-white/[0.06] flex items-center justify-center overflow-hidden">
          {safAvatar(a) ? <img src={safAvatar(a)} alt="" className="w-full h-full object-cover" /> : <Headphones style={{ width: size * 0.5, height: size * 0.5 }} className="text-white/20" />}
        </div>
      ))}
    </div>
    {count > 3 && <span className="text-[10px] text-white/30 font-bold ml-1.5">+{count - 3}</span>}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   LIVE POLL — in-room polls
   ═══════════════════════════════════════════════════════════════════════════════ */

const LivePollWidget = ({ poll, onVote, onClose, isHost }: {
  poll: SpacePoll;
  onVote: (idx: number) => void;
  onClose: () => void;
  isHost: boolean;
}) => {
  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
  return (
    <div className="mx-4 mt-2 rounded-2xl border border-primary/20 bg-primary/[0.04] backdrop-blur-sm p-4 sp-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary">Live Poll</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
          {isHost && !poll.closed && (
            <button onClick={onClose} className="text-[10px] text-white/30 hover:text-white/60 transition px-2 py-0.5 rounded-full border border-white/10 hover:border-white/20">
              Close poll
            </button>
          )}
        </div>
      </div>
      <p className="text-sm font-bold text-white mb-3">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const voted = poll.votedIndex === i;
          const canVote = poll.votedIndex === null && !poll.closed;
          return (
            <button
              key={i}
              onClick={() => canVote && onVote(i)}
              disabled={!canVote}
              className={cn(
                "w-full text-left relative rounded-xl overflow-hidden border transition-all h-10 flex items-center",
                voted ? "border-primary/40 bg-primary/10" : canVote ? "border-white/10 bg-white/[0.03] hover:border-white/20" : "border-white/[0.06] bg-white/[0.02]"
              )}
            >
              <div className="absolute inset-y-0 left-0 bg-primary/10 transition-all" style={{ width: `${pct}%` }} />
              <span className="relative z-10 px-3 text-xs font-medium text-white/80 flex-1">{opt.label}</span>
              <span className="relative z-10 px-3 text-xs font-bold text-white/40">{pct}%</span>
              {voted && <CheckCircle2 className="relative z-10 h-3.5 w-3.5 text-primary mr-3 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   CREATE SPACE MODAL
   ═══════════════════════════════════════════════════════════════════════════════ */

const CreateSpaceModal = ({ onClose, onCreated, user, profile }: {
  onClose: () => void;
  onCreated: (s: Space) => void;
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
    if (t && tags.length < 5 && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      let sf: string | null = null;
      if (isScheduled && scheduledDate && scheduledTime) sf = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      const d: Record<string, unknown> = {
        title: title.trim(), description: description.trim() || null, host_id: user.id,
        host_username: profile?.username || null, host_avatar: safAvatar(profile?.avatar_url) ?? null,
        topic, is_live: !isScheduled, is_private: isPrivate, is_recording: isRecording,
        listener_count: isScheduled ? 0 : 1, speaker_count: isScheduled ? 0 : 1,
        peak_listeners: isScheduled ? 0 : 1, scheduled_for: sf, tags: tags.length > 0 ? tags : null,
      };
      const { data, error } = await supabase.from("spaces").insert(d).select().single();
      if (error) throw error;
      toast.success(isScheduled ? "Space scheduled! 📅" : "Space started! 🎙️");
      onCreated(data as Space); onClose();
    } catch (e: any) { toast.error(e?.message || "Failed to create space."); }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg mx-4 bg-[#0c1219] rounded-3xl border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden max-h-[92vh] flex flex-col sp-slide-up">
        {/* Decorative top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06] relative">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2.5 text-white">
              <div className="p-1.5 rounded-xl bg-primary/15 border border-primary/25">
                <Radio className="h-4 w-4 text-primary" />
              </div>
              {isScheduled ? "Schedule a Space" : "Start a Space"}
            </h2>
            <p className="text-[11px] text-white/30 mt-1">
              {isScheduled ? "Set a time for your community to join" : "Go live with voice for your community"}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-white/10 transition-colors">
            <XIcon className="h-4 w-4 text-white/40" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ scrollbarWidth: "none" }}>
          {/* Title */}
          <div>
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Title *</label>
            <Input placeholder="e.g. Solana Alpha Call — New Launches" value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
              className="bg-white/[0.04] border-white/[0.08] rounded-xl h-11 focus:border-primary/50 transition-colors" />
            <div className="flex justify-end mt-1">
              <span className={cn("text-[10px] tabular-nums", title.length > 70 ? "text-amber-400" : "text-white/15")}>{title.length}/80</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Description</label>
            <Textarea placeholder="What will you discuss?" value={description} onChange={e => setDescription(e.target.value)} maxLength={280}
              className="bg-white/[0.04] border-white/[0.08] rounded-xl resize-none min-h-[80px] text-sm focus:border-primary/50" />
          </div>

          {/* Topic */}
          <div>
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Topic</label>
            <div className="grid grid-cols-4 gap-2">
              {TOPICS.map(t => {
                const m = topicOf(t);
                return (
                  <button key={t} onClick={() => setTopic(t)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all text-center",
                      topic === t
                        ? "bg-primary/10 border-primary/40 scale-[1.02] shadow-lg shadow-primary/10"
                        : "border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]"
                    )}>
                    <span className="text-lg">{m.icon}</span>
                    <span className={cn("text-[10px] font-bold", topic === t ? "text-primary" : "text-white/40")}>{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Tags <span className="text-white/20">({tags.length}/5)</span></label>
            <div className="flex gap-2">
              <Input placeholder="#solana, #alpha..." value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                className="bg-white/[0.04] border-white/[0.08] rounded-xl flex-1" />
              <Button size="sm" variant="outline" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 5} className="rounded-xl border-white/[0.08] shrink-0 h-9 w-9 p-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    #{t}
                    <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-red-400 transition"><XIcon className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Settings Cards */}
          <div className="space-y-2">
            {/* Schedule */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10"><Calendar className="h-3.5 w-3.5 text-primary" /></div>
                  <div><p className="text-[13px] font-bold text-white">Schedule for later</p><p className="text-[10px] text-white/25">Set a date & time</p></div>
                </div>
                <Toggle on={isScheduled} onChange={() => setIsScheduled(v => !v)} />
              </div>
              {isScheduled && (
                <div className="flex gap-2 px-3 pb-3 pl-12">
                  <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
                    className="bg-white/[0.04] border-white/[0.08] rounded-lg text-sm flex-1 h-9" />
                  <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                    className="bg-white/[0.04] border-white/[0.08] rounded-lg text-sm w-28 h-9" />
                </div>
              )}
            </div>
            {/* Private */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-white/5"><Lock className="h-3.5 w-3.5 text-white/40" /></div>
                <div><p className="text-[13px] font-bold text-white">Private Space</p><p className="text-[10px] text-white/25">Invite-only access</p></div>
              </div>
              <Toggle on={isPrivate} onChange={() => setIsPrivate(v => !v)} />
            </div>
            {/* Recording */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-red-400 flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-red-400" /></div>
                </div>
                <div><p className="text-[13px] font-bold text-white">Record Space</p><p className="text-[10px] text-white/25">Save for replay</p></div>
              </div>
              <Toggle on={isRecording} onChange={() => setIsRecording(v => !v)} activeColor="bg-red-500" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-white/[0.06]">
          <Button onClick={handleCreate} disabled={!title.trim() || creating || (isScheduled && (!scheduledDate || !scheduledTime))}
            className="w-full rounded-full btn-3d font-black gap-2 h-12 text-sm">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : isScheduled ? <><Calendar className="h-4 w-4" /> Schedule Space</> : <><Mic className="h-4 w-4" /> Go Live</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   TRENDING BANNER — horizontal scroll of hot spaces
   ═══════════════════════════════════════════════════════════════════════════════ */

const TrendingBanner = ({ spaces, onJoin }: { spaces: Space[]; onJoin: (s: Space) => void }) => {
  if (spaces.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="p-1 rounded-md bg-red-500/10"><Flame className="h-3 w-3 text-red-400" /></div>
        <span className="text-[11px] font-black text-white/50 uppercase tracking-wider">Happening Now</span>
        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {spaces.slice(0, 5).map((s, idx) => {
          const tm = topicOf(s.topic);
          const total = (s.listener_count || 0) + (s.speaker_count || 0);
          return (
            <button key={s.id} onClick={() => onJoin(s)}
              className={cn(
                "shrink-0 w-64 rounded-2xl border p-4 text-left transition-all group relative overflow-hidden",
                "bg-gradient-to-br", cardGrad(s.id),
                idx === 0 ? "border-primary/25 shadow-lg shadow-primary/5" : "border-white/[0.08] hover:border-white/[0.15]"
              )}
              style={{ animationDelay: `${idx * 0.05}s` }}>
              {/* Decorative orb */}
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border", tm.color)}>
                    {tm.icon} {s.topic}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
                    <span className="text-[9px] font-bold text-red-400">LIVE</span>
                  </div>
                </div>
                <h4 className="font-bold text-sm text-white leading-snug line-clamp-1">{s.title}</h4>
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                      {safAvatar(s.host_avatar) ? <img src={safAvatar(s.host_avatar)} alt="" className="w-full h-full object-cover" /> : <Crown className="h-2.5 w-2.5 text-primary" />}
                    </div>
                    <span className="text-[10px] text-white/40 font-medium">{s.host_username ? `@${s.host_username}` : "Host"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/25">
                    <Headphones className="h-2.5 w-2.5" />{total.toLocaleString()}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SPACE CARD — list view
   ═══════════════════════════════════════════════════════════════════════════════ */

const SpaceCard = ({ space, onJoin, variant = "default" }: { space: Space; onJoin: (s: Space) => void; variant?: "default" | "past" }) => {
  const tm = topicOf(space.topic);
  const total = (space.listener_count || 0) + (space.speaker_count || 0);
  const isPast = variant === "past";

  return (
    <button onClick={() => !isPast && onJoin(space)}
      className={cn(
        "w-full text-left rounded-2xl border transition-all group relative overflow-hidden",
        isPast ? "p-4 border-white/[0.05] bg-white/[0.015] opacity-60 cursor-default" : "p-4 border-white/[0.08] bg-gradient-to-br hover:border-white/[0.15] hover:shadow-lg hover:shadow-white/[0.02]",
        !isPast && cardGrad(space.id),
      )}>
      {/* Hover glow */}
      {!isPast && <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/[0.04] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />}

      <div className="relative flex gap-3">
        {/* Left: Topic icon */}
        <div className={cn("shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-lg border", tm.color, "bg-opacity-20")}>
          {tm.icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-1.5 mb-1">
            {space.is_live && !isPast && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
                <span className="text-[9px] font-bold text-red-400">LIVE</span>
              </span>
            )}
            {space.is_recording && <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-red-400/60 uppercase"><div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />REC</span>}
            {space.is_private && <Lock className="h-2.5 w-2.5 text-white/20" />}
            {isPast && space.ended_at && (
              <span className="inline-flex items-center gap-1 text-[9px] text-white/25"><Archive className="h-2.5 w-2.5" />Ended {formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}</span>
            )}
            {space.tags?.slice(0, 2).map(t => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/20 border border-white/[0.05]">#{t}</span>
            ))}
          </div>

          <h3 className="font-bold text-[13px] text-white leading-tight line-clamp-1">{space.title}</h3>
          {space.description && <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">{space.description}</p>}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center overflow-hidden">
                {safAvatar(space.host_avatar) ? <img src={safAvatar(space.host_avatar)} alt="" className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = "none"} /> : <Crown className="h-2.5 w-2.5 text-primary" />}
              </div>
              <span className="text-[10px] text-white/40 font-medium">{space.host_username ? `@${space.host_username}` : "Host"}</span>
            </div>
            <div className="flex items-center gap-3 ml-auto text-white/20">
              {space.speaker_count > 1 && <span className="flex items-center gap-0.5 text-[10px]"><Mic className="h-2.5 w-2.5" />{space.speaker_count}</span>}
              <span className="flex items-center gap-0.5 text-[10px]"><Headphones className="h-2.5 w-2.5" />{total.toLocaleString()}</span>
              {!isPast && space.is_live && <AudioEQ active bars={3} color="bg-emerald-400/60" />}
            </div>
          </div>
        </div>

        {/* Join arrow */}
        {!isPast && (
          <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="h-4 w-4 text-white/20" />
          </div>
        )}
      </div>
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SCHEDULED SPACE CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

const ScheduledSpaceCard = ({ space, onRemind, onStartNow, isOwner }: { space: Space; onRemind: (s: Space) => void; onStartNow?: (s: Space) => void; isOwner: boolean }) => {
  const tm = topicOf(space.topic);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.12] transition-all p-4">
      <div className="flex items-start gap-3">
        <div className={cn("shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-lg border", tm.color)}>
          {tm.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[13px] text-white line-clamp-1">{space.title}</h3>
          {space.description && <p className="text-[11px] text-white/25 mt-0.5 line-clamp-1">{space.description}</p>}
          {space.scheduled_for && (
            <div className="flex items-center gap-2 mt-2">
              <Clock className="h-3 w-3 text-primary/50" />
              <span className="text-[11px] text-primary/70 font-medium">{format(new Date(space.scheduled_for), "MMM d · h:mm a")}</span>
              <span className="text-[9px] text-white/20">({formatDistanceToNow(new Date(space.scheduled_for), { addSuffix: true })})</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-4 h-4 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center overflow-hidden">
              {safAvatar(space.host_avatar) ? <img src={safAvatar(space.host_avatar)} alt="" className="w-full h-full object-cover" /> : <Crown className="h-2 w-2 text-primary" />}
            </div>
            <span className="text-[10px] text-white/30">{space.host_username ? `@${space.host_username}` : "Host"}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button size="sm" variant="outline" onClick={() => onRemind(space)}
            className="rounded-full text-[10px] h-7 border-primary/20 text-primary hover:bg-primary/10 gap-1 px-2.5">
            <Bell className="h-3 w-3" /> Remind
          </Button>
          {isOwner && onStartNow && (
            <Button size="sm" onClick={() => onStartNow(space)}
              className="rounded-full text-[10px] h-7 gap-1 px-2.5 btn-3d">
              <Play className="h-3 w-3" /> Start now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SPACE CHAT
   ═══════════════════════════════════════════════════════════════════════════════ */

const SpaceChat = ({ spaceId, isHost }: { spaceId: string; isHost: boolean }) => {
  const { user, profile } = useAuth();
  const [msgs, setMsgs] = useState<SpaceChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from("space_messages").select("*").eq("space_id", spaceId).order("created_at", { ascending: true }).limit(100);
      setMsgs((data as SpaceChatMessage[]) || []);
    } catch { /* */ }
  }, [spaceId]);

  useEffect(() => {
    load();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase.channel(`sp-chat-${spaceId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_messages", filter: `space_id=eq.${spaceId}` },
          p => setMsgs(prev => [...prev, p.new as SpaceChatMessage]))
        .subscribe();
    } catch { /* */ }
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [spaceId, load]);

  useEffect(() => { if (atBottom && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, atBottom]);

  const onScroll = () => { if (!scrollRef.current) return; const { scrollHeight, scrollTop, clientHeight } = scrollRef.current; setAtBottom(scrollHeight - scrollTop - clientHeight < 50); };

  const send = async () => {
    if (!user || !input.trim()) return;
    setSending(true);
    try {
      await supabase.from("space_messages").insert({ space_id: spaceId, user_id: user.id, username: profile?.username || null, avatar_url: safAvatar(profile?.avatar_url) ?? null, content: input.trim() });
      setInput("");
    } catch { toast.error("Failed to send"); }
    setSending(false);
  };

  const pinMsg = async (m: SpaceChatMessage) => {
    if (!isHost) return;
    await supabase.from("spaces").update({ pinned_message: m.content }).eq("id", spaceId).then(() => toast.success("Pinned!"));
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
        {msgs.length === 0 && (
          <div className="text-center py-12"><MessageSquare className="h-8 w-8 mx-auto text-white/[0.06] mb-2" /><p className="text-[11px] text-white/15">No messages yet</p></div>
        )}
        {msgs.map(m => (
          <div key={m.id} className="group flex items-start gap-2 py-1.5 px-2 hover:bg-white/[0.02] rounded-lg transition-colors">
            <div className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
              {safAvatar(m.avatar_url) ? <img src={safAvatar(m.avatar_url)} alt="" className="w-full h-full object-cover" /> :
                <span className="text-[9px] font-bold text-white/30">{m.username?.[0]?.toUpperCase() || "?"}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-bold text-white/50 truncate">{m.username || "Anon"}</span>
                <span className="text-[8px] text-white/10">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
              </div>
              <p className="text-[12px] text-white/60 break-words leading-relaxed">{m.content}</p>
            </div>
            {isHost && (
              <button onClick={() => pinMsg(m)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition" title="Pin"><Pin className="h-3 w-3 text-white/20" /></button>
            )}
          </div>
        ))}
      </div>
      {!atBottom && msgs.length > 3 && (
        <button onClick={() => { setAtBottom(true); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }}
          className="mx-3 mb-1 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-bold flex items-center gap-1 justify-center">
          <ChevronDown className="h-3 w-3" /> New messages
        </button>
      )}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <Input placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            className="bg-white/[0.04] border-white/[0.06] rounded-full text-sm h-9 focus:border-primary/40" />
          <Button size="sm" onClick={send} disabled={!input.trim() || sending} className="rounded-full h-9 w-9 p-0 shrink-0">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SPEAKER QUEUE
   ═══════════════════════════════════════════════════════════════════════════════ */

const SpeakerQueue = ({ spaceId, isHost, onRaiseHand, hasRaised }: { spaceId: string; isHost: boolean; onRaiseHand: () => void; hasRaised: boolean }) => {
  const [reqs, setReqs] = useState<SpeakerRequest[]>([]);

  useEffect(() => {
    if (!isHost) return;
    const load = async () => { const { data } = await supabase.from("speaker_requests").select("*").eq("space_id", spaceId).eq("status", "pending").order("created_at"); setReqs((data as SpeakerRequest[]) || []); };
    load();
    const ch = supabase.channel(`sp-reqs-${spaceId}`).on("postgres_changes", { event: "*", schema: "public", table: "speaker_requests", filter: `space_id=eq.${spaceId}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId, isHost]);

  const handle = async (id: string, s: "approved" | "denied") => {
    await supabase.from("speaker_requests").update({ status: s }).eq("id", id);
    setReqs(prev => prev.filter(r => r.id !== id));
    toast.success(s === "approved" ? "Speaker approved! 🎙️" : "Request denied");
  };

  if (!isHost) return (
    <button onClick={onRaiseHand}
      className={cn("flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all",
        hasRaised ? "bg-amber-400/15 text-amber-400 border border-amber-400/25 shadow-lg shadow-amber-400/5" : "bg-white/[0.04] text-white/40 border border-white/[0.08] hover:border-white/[0.15] hover:text-white/60"
      )}>
      <Hand className={cn("h-4 w-4", hasRaised && "animate-bounce")} />{hasRaised ? "Hand Raised ✋" : "Raise Hand"}
    </button>
  );

  if (!reqs.length) return null;
  return (
    <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-3 space-y-2 sp-slide-up">
      <p className="text-[10px] font-black text-amber-400/50 uppercase tracking-widest flex items-center gap-1.5"><Hand className="h-3 w-3" />Speaker Requests · {reqs.length}</p>
      {reqs.map(r => (
        <div key={r.id} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center overflow-hidden">
            {safAvatar(r.avatar_url) ? <img src={safAvatar(r.avatar_url)} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-white/30">{r.username?.[0]?.toUpperCase() || "?"}</span>}
          </div>
          <span className="text-[11px] text-white/60 font-medium flex-1 truncate">{r.username || "User"}</span>
          <button onClick={() => handle(r.id, "approved")} className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20">Accept</button>
          <button onClick={() => handle(r.id, "denied")} className="p-1 rounded-full hover:bg-white/10 text-white/25"><XIcon className="h-3 w-3" /></button>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SPACE ROOM — Full immersive experience
   ═══════════════════════════════════════════════════════════════════════════════ */

const SpaceRoom = ({ space, onLeave, onMinimize }: { space: Space; onLeave: () => void; onMinimize?: () => void }) => {
  const { user, profile } = useAuth();
  const [muted, setMuted] = useState(true);
  const [hasRaised, setHasRaised] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [pinnedMsg, setPinnedMsg] = useState(space.pinned_message);
  const [cur, setCur] = useState(space);
  const [poll, setPoll] = useState<SpacePoll | null>(null);
  const [showPollCreate, setShowPollCreate] = useState(false);
  const isHost = user?.id === space.host_id;
  const tm = topicOf(cur.topic);
  const rxId = useRef(0);

  // Realtime
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase.channel(`sp-room-${space.id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${space.id}` },
          p => { const u = p.new as Space; setCur(u); if (u.pinned_message !== pinnedMsg) setPinnedMsg(u.pinned_message); if (u.ended_at) { toast("Space ended"); onLeave(); } })
        .subscribe();
    } catch { /* */ }
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [space.id]);

  useEffect(() => {
    if (!user) return;
    // Try RPC first, fall back to direct update
    supabase.rpc("increment_listener", { space_id: space.id }).catch(() => {
      supabase.from("spaces").update({ listener_count: (cur.listener_count || 0) + 1 }).eq("id", space.id).then(() => {});
    });
    return () => {
      supabase.rpc("decrement_listener", { space_id: space.id }).catch(() => {
        supabase.from("spaces").update({ listener_count: Math.max((cur.listener_count || 1) - 1, 0) }).eq("id", space.id).then(() => {});
      });
    };
  }, [space.id, user?.id]);

  const react = (emoji: string) => {
    const id = rxId.current++;
    setReactions(prev => [...prev, { id, emoji, x: 10 + Math.random() * 80, delay: Math.random() * 0.8, size: 20 + Math.random() * 12 }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3500);
  };

  const raiseHand = async () => {
    if (!user || hasRaised) return;
    try {
      await supabase.from("speaker_requests").insert({ space_id: space.id, user_id: user.id, username: profile?.username || null, avatar_url: safAvatar(profile?.avatar_url) ?? null, status: "pending" });
      setHasRaised(true); toast("Hand raised! ✋");
    } catch { toast.error("Failed to raise hand"); }
  };

  const endSpace = async () => {
    if (!isHost) return;
    await supabase.from("spaces").update({ is_live: false, ended_at: new Date().toISOString() }).eq("id", space.id);
    toast.success("Space ended"); onLeave();
  };

  const share = () => { navigator.clipboard.writeText(`${window.location.origin}/spaces?join=${space.id}`); toast.success("Link copied! 🔗"); };

  const votePoll = (idx: number) => {
    if (!poll || poll.votedIndex !== null) return;
    setPoll({ ...poll, votedIndex: idx, options: poll.options.map((o, i) => i === idx ? { ...o, votes: o.votes + 1 } : o) });
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <SpaceStyles />
      <ReactionOverlay items={reactions} />

      {/* ── Animated gradient background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-primary/[0.06] via-violet-900/[0.04] to-transparent sp-gradient-bg" />
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/[0.04] blur-[80px] sp-glow" />
        <div className="absolute -top-10 -right-20 w-48 h-48 rounded-full bg-violet-500/[0.04] blur-[60px] sp-glow" style={{ animationDelay: "1.2s" }} />
      </div>

      {/* ── Room Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#070d14]/80 backdrop-blur-xl z-10 shrink-0 relative">
        <button onClick={onLeave} className="p-2 rounded-full hover:bg-white/10 transition"><ArrowLeft className="h-4 w-4 text-white/50" /></button>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm text-white truncate">{cur.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", tm.color)}>{tm.icon} {cur.topic}</span>
            <span className="text-[10px] text-white/15">·</span>
            <span className="flex items-center gap-0.5 text-[10px] text-white/25"><Headphones className="h-2.5 w-2.5" />{(cur.listener_count || 0) + (cur.speaker_count || 0)}</span>
            {cur.peak_listeners > 5 && <><span className="text-[10px] text-white/15">·</span><span className="text-[10px] text-white/15">Peak: {cur.peak_listeners}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
            <LiveTimer startedAt={cur.created_at} />
          </div>
          <button onClick={share} className="p-2 rounded-full hover:bg-white/10 transition" title="Share"><Share2 className="h-4 w-4 text-white/30" /></button>
          {onMinimize && <button onClick={onMinimize} className="p-2 rounded-full hover:bg-white/10 transition" title="Minimize"><Minimize2 className="h-4 w-4 text-white/30" /></button>}
          {isHost && (
            <div className="relative">
              <button onClick={() => setShowMore(!showMore)} className="p-2 rounded-full hover:bg-white/10 transition"><MoreVertical className="h-4 w-4 text-white/30" /></button>
              {showMore && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMore(false)} />
                  <div className="absolute right-0 top-full mt-1 w-52 bg-[#0c1219] border border-white/[0.08] rounded-xl shadow-2xl z-30 overflow-hidden sp-slide-up">
                    <button onClick={() => { setShowPollCreate(true); setShowMore(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 transition">
                      <BarChart3 className="h-4 w-4" /> Create Poll
                    </button>
                    <button onClick={() => { setPinnedMsg(null); supabase.from("spaces").update({ pinned_message: null }).eq("id", space.id); setShowMore(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 transition">
                      <PinOff className="h-4 w-4" /> Clear Pin
                    </button>
                    <div className="border-t border-white/[0.06]" />
                    <button onClick={() => { endSpace(); setShowMore(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                      <StopCircle className="h-4 w-4" /> End Space
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
        <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-amber-400/[0.04] border border-amber-400/15 flex items-start gap-2 shrink-0 sp-slide-up">
          <Pin className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/70 leading-relaxed flex-1 line-clamp-2">{pinnedMsg}</p>
          {isHost && <button onClick={() => { setPinnedMsg(null); supabase.from("spaces").update({ pinned_message: null }).eq("id", space.id); }} className="p-0.5 hover:bg-white/10 rounded"><XIcon className="h-2.5 w-2.5 text-white/25" /></button>}
        </div>
      )}

      {/* ── Recording indicator ── */}
      {cur.is_recording && (
        <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/[0.04] border border-red-500/15 w-fit shrink-0">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /><span className="text-[10px] font-bold text-red-400/60">Recording</span>
        </div>
      )}

      {/* ── Poll ── */}
      {poll && <LivePollWidget poll={poll} onVote={votePoll} onClose={() => setPoll({ ...poll, closed: true })} isHost={isHost} />}

      {/* ── Create Poll Modal (inline) ── */}
      {showPollCreate && <CreatePollInline onCreate={p => { setPoll(p); setShowPollCreate(false); }} onCancel={() => setShowPollCreate(false)} />}

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0 relative">
        {/* Left: Voice / Speakers */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0" style={{ scrollbarWidth: "none" }}>
          {/* Host card */}
          <div className="mb-5">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <Crown className="h-3 w-3 text-amber-400" /> Host
            </p>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-primary/[0.06] via-violet-900/[0.03] to-transparent border border-primary/15 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-600/30 border-2 border-primary/30 flex items-center justify-center font-black text-xl overflow-hidden sp-pulse-ring">
                {safAvatar(cur.host_avatar) ? <img src={safAvatar(cur.host_avatar)} alt="" className="w-full h-full object-cover rounded-2xl" /> : <span>{cur.host_username?.[0]?.toUpperCase() ?? "H"}</span>}
              </div>
              <div className="flex-1 relative">
                <p className="font-black text-sm text-white">{cur.host_username ? `@${cur.host_username}` : "Host"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Mic className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-bold">Speaking</span>
                  <AudioEQ active color="bg-emerald-400" bars={5} />
                </div>
              </div>
            </div>
          </div>

          {/* Voice panel */}
          <div className="mb-5">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-widest mb-2.5 flex items-center gap-1.5"><Mic className="h-3 w-3" /> Speakers</p>
            <VoicePanel lobbyId={`space-${space.id}`} lobbyName={space.title} autoJoin />
          </div>

          {/* Speaker queue */}
          <div className="mb-5">
            <SpeakerQueue spaceId={space.id} isHost={isHost} onRaiseHand={raiseHand} hasRaised={hasRaised} />
          </div>

          {/* Listeners */}
          <div className="mb-5">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <Headphones className="h-3 w-3" /> Listeners · {cur.listener_count || 0}
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2.5">
              {user && (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border-2 border-primary/25 flex items-center justify-center font-bold text-sm overflow-hidden">
                    {safAvatar(profile?.avatar_url) ? <img src={safAvatar(profile?.avatar_url)} alt="" className="w-full h-full object-cover rounded-xl" /> : <span className="text-primary">{profile?.username?.[0]?.toUpperCase() ?? "Y"}</span>}
                  </div>
                  <span className="text-[9px] text-primary/60 font-bold">You</span>
                </div>
              )}
              {Array.from({ length: Math.min(Math.max((cur.listener_count || 1) - 1, 0), 11) }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-1 sp-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <Headphones className="h-4 w-4 text-white/[0.08]" />
                  </div>
                  <span className="text-[9px] text-white/[0.08]">Listener</span>
                </div>
              ))}
            </div>
          </div>

          {/* About */}
          {cur.description && (
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-4">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1.5">About this Space</p>
              <p className="text-[12px] text-white/40 leading-relaxed">{cur.description}</p>
            </div>
          )}
          {cur.tags && cur.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {cur.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] text-white/20 border border-white/[0.05]">#{t}</span>)}
            </div>
          )}
        </div>

        {/* Right: Chat panel */}
        <div className={cn("border-t lg:border-t-0 lg:border-l border-white/[0.06] flex flex-col transition-all",
          showChat ? "h-[45vh] lg:h-auto lg:w-80" : "h-0 lg:h-auto lg:w-0 overflow-hidden")}>
          {showChat && (
            <>
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] shrink-0">
                <p className="text-[11px] font-bold text-white/40 flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Live Chat</p>
                <button onClick={() => setShowChat(false)} className="p-1 rounded hover:bg-white/10 lg:hidden"><XIcon className="h-3 w-3 text-white/25" /></button>
              </div>
              <SpaceChat spaceId={space.id} isHost={isHost} />
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Controls ── */}
      <div className="px-4 pb-4 pt-3 border-t border-white/[0.06] shrink-0 bg-[#070d14]/90 backdrop-blur-xl relative z-10">
        {/* Reactions */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {REACTION_EMOJIS.map(e => (
            <button key={e} onClick={() => react(e)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:scale-110 active:scale-90 transition-all text-lg shrink-0">
              {e}
            </button>
          ))}
        </div>
        {/* Controls */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => { setMuted(v => !v); toast(muted ? "Unmuted 🎙️" : "Muted 🔇"); }}
            className={cn("flex items-center gap-2 px-5 h-11 rounded-full font-bold text-sm transition-all",
              muted ? "bg-white/[0.06] text-white/50 hover:bg-white/[0.1] border border-white/[0.08]" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30"
            )}>
            {muted ? <><MicOff className="h-4 w-4" />Unmute</> : <><Mic className="h-4 w-4" /><AudioEQ active color="bg-white" bars={3} /></>}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowChat(!showChat)}
              className={cn("h-11 w-11 rounded-full flex items-center justify-center transition-all border",
                showChat ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/[0.04] border-white/[0.08] text-white/30 hover:bg-white/[0.08]"
              )} title="Chat">
              <MessageSquare className="h-4 w-4" />
            </button>
            {!isHost && (
              <button onClick={raiseHand}
                className={cn("h-11 w-11 rounded-full flex items-center justify-center transition-all border",
                  hasRaised ? "bg-amber-400/15 border-amber-400/25 text-amber-400" : "bg-white/[0.04] border-white/[0.08] text-white/30 hover:bg-white/[0.08]"
                )} title="Raise hand">
                <Hand className="h-4 w-4" />
              </button>
            )}
            <button onClick={onLeave}
              className="h-11 px-5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/15 transition flex items-center gap-1.5">
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   CREATE POLL INLINE
   ═══════════════════════════════════════════════════════════════════════════════ */

const CreatePollInline = ({ onCreate, onCancel }: { onCreate: (p: SpacePoll) => void; onCancel: () => void }) => {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const addOpt = () => opts.length < 4 && setOpts([...opts, ""]);
  const updateOpt = (i: number, v: string) => { const c = [...opts]; c[i] = v; setOpts(c); };
  const valid = q.trim() && opts.filter(o => o.trim()).length >= 2;
  return (
    <div className="mx-4 mt-2 rounded-2xl border border-primary/20 bg-[#0c1219] p-4 sp-slide-up">
      <p className="text-xs font-bold text-primary mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Create Live Poll</p>
      <Input placeholder="Your question..." value={q} onChange={e => setQ(e.target.value)} className="bg-white/[0.04] border-white/[0.08] rounded-xl mb-3 text-sm" />
      <div className="space-y-2 mb-3">
        {opts.map((o, i) => (
          <Input key={i} placeholder={`Option ${i + 1}`} value={o} onChange={e => updateOpt(i, e.target.value)} className="bg-white/[0.04] border-white/[0.08] rounded-lg text-sm h-9" />
        ))}
      </div>
      <div className="flex gap-2">
        {opts.length < 4 && <Button size="sm" variant="outline" onClick={addOpt} className="rounded-full text-[10px] h-7 border-white/10 gap-1"><Plus className="h-3 w-3" />Option</Button>}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onCancel} className="rounded-full text-[10px] h-7">Cancel</Button>
        <Button size="sm" disabled={!valid} onClick={() => onCreate({ question: q.trim(), options: opts.filter(o => o.trim()).map(o => ({ label: o.trim(), votes: 0 })), votedIndex: null, closed: false })}
          className="rounded-full text-[10px] h-7 btn-3d gap-1"><BarChart3 className="h-3 w-3" />Launch Poll</Button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MINI PLAYER BAR
   ═══════════════════════════════════════════════════════════════════════════════ */

const MiniPlayerBar = ({ space, onExpand, onLeave }: { space: Space; onExpand: () => void; onLeave: () => void }) => (
  <div className="fixed bottom-20 left-4 right-4 z-50 bg-[#0c1219]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3 shadow-2xl shadow-black/40 flex items-center gap-3 sp-slide-up">
    <div className="relative">
      <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center overflow-hidden">
        {safAvatar(space.host_avatar) ? <img src={safAvatar(space.host_avatar)} alt="" className="w-full h-full object-cover rounded-xl" /> : <Radio className="h-4 w-4 text-primary" />}
      </div>
      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-2.5 w-2.5 rounded-full bg-red-500 border border-[#0c1219]" /></span>
    </div>
    <div className="flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
      <p className="font-bold text-[12px] text-white truncate">{space.title}</p>
      <div className="flex items-center gap-1.5">
        <AudioEQ active bars={3} color="bg-emerald-400" />
        <span className="text-[10px] text-white/25">{(space.listener_count || 0) + (space.speaker_count || 0)} listening</span>
      </div>
    </div>
    <button onClick={onExpand} className="p-2 rounded-full hover:bg-white/10 transition"><Maximize2 className="h-4 w-4 text-white/40" /></button>
    <button onClick={onLeave} className="p-2 rounded-full hover:bg-red-500/10 transition"><XIcon className="h-4 w-4 text-red-400/60" /></button>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════════════════════ */

const EmptyState = ({ icon: Icon, title, sub, action }: { icon: React.ComponentType<{ className?: string }>; title: string; sub: string; action?: { label: string; onClick: () => void } }) => (
  <div className="text-center py-20">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-4">
      <Icon className="h-8 w-8 text-white/[0.06]" />
    </div>
    <p className="font-bold text-white/25 text-sm">{title}</p>
    <p className="text-[12px] text-white/15 mt-1">{sub}</p>
    {action && <Button onClick={action.onClick} className="mt-5 rounded-full btn-3d gap-2 text-sm"><Mic className="h-4 w-4" />{action.label}</Button>}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN SPACES PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */

const Spaces = () => {
  const { user, profile } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [minimizedSpace, setMinimizedSpace] = useState<Space | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<"live" | "scheduled" | "past">("live");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const fetchSpaces = useCallback(async () => {
    try {
      const [lr, pr] = await Promise.all([
        supabase.from("spaces").select("*").is("ended_at", null).order("is_live", { ascending: false }).order("listener_count", { ascending: false }).limit(50),
        supabase.from("spaces").select("*").eq("is_live", false).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(20),
      ]);
      if (lr.error) { console.warn("Spaces fetch error:", lr.error.message); }
      setSpaces((lr.data as Space[] | null) ?? []);
      setPastSpaces((pr.data as Space[] | null) ?? []);
    } catch (e) { console.warn("Spaces fetch exception:", e); setSpaces([]); setPastSpaces([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSpaces();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase.channel("sp-list").on("postgres_changes", { event: "*", schema: "public", table: "spaces" }, () => fetchSpaces()).subscribe();
    } catch { /* realtime optional */ }
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [fetchSpaces]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const j = p.get("join");
    if (j) { const s = spaces.find(x => x.id === j); if (s) setActiveSpace(s); }
  }, [spaces]);

  const handleCreated = (s: Space) => { if (s.is_live) { setSpaces(prev => [s, ...prev]); setActiveSpace(s); } else { setSpaces(prev => [s, ...prev]); setTab("scheduled"); } };

  const startScheduled = async (s: Space) => {
    await supabase.from("spaces").update({ is_live: true, scheduled_for: null }).eq("id", s.id);
    toast.success("Space is now live! 🎙️"); fetchSpaces();
    setActiveSpace({ ...s, is_live: true, scheduled_for: null });
  };

  const matchSearch = (s: Space) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || (s.description?.toLowerCase().includes(q)) || (s.topic?.toLowerCase().includes(q)) || (s.host_username?.toLowerCase().includes(q)) || (s.tags?.some(t => t.toLowerCase().includes(q)));
  };
  const matchTopic = (s: Space) => !topicFilter || s.topic === topicFilter;

  const live = useMemo(() => spaces.filter(s => s.is_live && matchTopic(s) && matchSearch(s)), [spaces, topicFilter, search]);
  const scheduled = useMemo(() => spaces.filter(s => !s.is_live && !s.ended_at && matchTopic(s) && matchSearch(s)), [spaces, topicFilter, search]);
  const ended = useMemo(() => pastSpaces.filter(s => matchTopic(s) && matchSearch(s)), [pastSpaces, topicFilter, search]);
  const totalListening = live.reduce((a, s) => a + (s.listener_count || 0) + (s.speaker_count || 0), 0);

  // ── Active room ──
  if (activeSpace) return (
    <SpaceRoom space={activeSpace}
      onLeave={() => { setActiveSpace(null); setMinimizedSpace(null); fetchSpaces(); }}
      onMinimize={() => { setMinimizedSpace(activeSpace); setActiveSpace(null); }} />
  );

  // ── Main view ──
  return (
    <div className="relative">
      <SpaceStyles />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-primary/15 border border-primary/25"><Radio className="h-4 w-4 text-primary" /></div>
            Spaces
          </h2>
          <p className="text-[11px] text-white/25 mt-1">
            {live.length > 0 ? `${live.length} live · ${totalListening.toLocaleString()} listening now` : "Live audio rooms for the community"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSearch(!showSearch)}
            className={cn("h-9 w-9 rounded-xl flex items-center justify-center transition-all border",
              showSearch ? "bg-primary/10 border-primary/30 text-primary" : "border-white/[0.08] text-white/30 hover:bg-white/[0.04]"
            )}>
            <Search className="h-3.5 w-3.5" />
          </button>
          <Button onClick={() => setShowCreate(true)} className="rounded-full btn-3d gap-2 text-[12px] h-9 px-4 font-black" size="sm">
            <Mic className="h-3.5 w-3.5" /> New Space
          </Button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="mb-4 relative sp-slide-up">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/15" />
          <Input placeholder="Search by title, topic, host, or tag..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-white/[0.03] border-white/[0.08] rounded-xl pl-10 pr-10 h-10 focus:border-primary/40" autoFocus />
          {search && <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50"><XIcon className="h-4 w-4" /></button>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] mb-4">
        {([
          { key: "live" as const, label: "Live Now", count: live.length, pulse: live.length > 0 },
          { key: "scheduled" as const, label: "Upcoming", count: scheduled.length, pulse: false },
          { key: "past" as const, label: "Replay", count: ended.length, pulse: false },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-4 py-3 text-[12px] font-bold transition-all relative flex items-center gap-2",
              tab === t.key ? "text-white" : "text-white/25 hover:text-white/50"
            )}>
            {t.pulse && <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-2 w-2 rounded-full bg-red-500" /></span>}
            {t.label}
            {t.count > 0 && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center", tab === t.key ? "bg-primary/20 text-primary" : "bg-white/[0.04] text-white/15")}>{t.count}</span>}
            {tab === t.key && <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* Topic filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3" style={{ scrollbarWidth: "none" }}>
        <button onClick={() => setTopicFilter(null)}
          className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold border shrink-0 transition-all",
            !topicFilter ? "bg-primary/15 border-primary/40 text-primary shadow-sm shadow-primary/10" : "border-white/[0.08] text-white/30 hover:border-white/[0.12]"
          )}>All</button>
        {TOPICS.map(t => { const m = topicOf(t); return (
          <button key={t} onClick={() => setTopicFilter(topicFilter === t ? null : t)}
            className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold border shrink-0 transition-all flex items-center gap-1",
              topicFilter === t ? "bg-primary/15 border-primary/40 text-primary shadow-sm shadow-primary/10" : "border-white/[0.08] text-white/30 hover:border-white/[0.12]"
            )}><span>{m.icon}</span>{t}</button>
        ); })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : tab === "live" ? (
        live.length === 0 ? (
          <EmptyState icon={Radio} title="No live spaces right now" sub={search ? "Try a different search" : "Be the first to start one!"}
            action={!search ? { label: "Start a Space", onClick: () => setShowCreate(true) } : undefined} />
        ) : (
          <>
            {/* Trending banner for top spaces */}
            {live.length > 1 && <TrendingBanner spaces={live} onJoin={setActiveSpace} />}
            {/* If only 1, still show cards */}
            {live.length === 1 && (
              <div className="mb-3">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Flame className="h-3 w-3 text-red-400" /> Live</p>
                <SpaceCard space={live[0]} onJoin={setActiveSpace} />
              </div>
            )}
            {/* All live cards below banner */}
            {live.length > 1 && (
              <div className="flex flex-col gap-2.5 pb-4">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest flex items-center gap-1.5">All Live Spaces</p>
                {live.map(s => <SpaceCard key={s.id} space={s} onJoin={setActiveSpace} />)}
              </div>
            )}
          </>
        )
      ) : tab === "scheduled" ? (
        scheduled.length === 0 ? (
          <EmptyState icon={Calendar} title="No upcoming spaces" sub="Schedule one and your community will be notified"
            action={{ label: "Schedule a Space", onClick: () => setShowCreate(true) }} />
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {scheduled.map(s => (
              <ScheduledSpaceCard key={s.id} space={s} onRemind={s => toast.success(`Reminder set for "${s.title}" 🔔`)} onStartNow={startScheduled} isOwner={s.host_id === user?.id} />
            ))}
          </div>
        )
      ) : (
        ended.length === 0 ? (
          <EmptyState icon={Archive} title="No past spaces" sub="Ended spaces will appear here for replay" />
        ) : (
          <div className="flex flex-col gap-2.5 pb-4">
            {ended.map(s => <SpaceCard key={s.id} space={s} onJoin={() => {}} variant="past" />)}
          </div>
        )
      )}

      {/* Mini player */}
      {minimizedSpace && !activeSpace && (
        <MiniPlayerBar space={minimizedSpace}
          onExpand={() => { setActiveSpace(minimizedSpace); setMinimizedSpace(null); }}
          onLeave={() => setMinimizedSpace(null)} />
      )}

      {/* Create modal */}
      {showCreate && <CreateSpaceModal onClose={() => setShowCreate(false)} onCreated={handleCreated} user={user} profile={profile} />}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   ERROR BOUNDARY — catches runtime crashes so the whole page doesn't go blank
   ═══════════════════════════════════════════════════════════════════════════════ */

class SpacesErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Spaces] Render crash:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="h-10 w-10 text-red-400/60" />
          <h3 className="text-lg font-bold text-white">Spaces failed to load</h3>
          <p className="text-sm text-white/40 max-w-md text-center">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-bold hover:bg-primary/25 transition"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SafeSpaces = () => (
  <SpacesErrorBoundary>
    <Spaces />
  </SpacesErrorBoundary>
);

export default SafeSpaces;
