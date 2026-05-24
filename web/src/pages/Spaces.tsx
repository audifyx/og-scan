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
import { VoicePanel, VoicePanelHandle, VoiceParticipant, VoiceRole } from "@/components/lobbies/VoicePanel";
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
  recording_url: string | null;
  duration_seconds: number | null;
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
   AUDIO EQUALIZER (visual, CSS-only animation)
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
   LIVE MIC VISUALIZER — real-time waveform from actual mic input
   ═══════════════════════════════════════════════════════════════════════════════ */

const MicVisualizer = ({ active, barCount = 24 }: { active: boolean; barCount?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!active) {
      // Cleanup when deactivated
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) {
        // Don't stop tracks — the VoicePanel owns the stream
      }
      // Draw flat bars
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barW = canvas.width / barCount;
          for (let i = 0; i < barCount; i++) {
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            ctx.beginPath();
            const x = i * barW + 1;
            const h = 3;
            const y = canvas.height / 2 - h / 2;
            ctx.roundRect(x, y, barW - 2, h, 1);
            ctx.fill();
          }
        }
      }
      return;
    }

    let mounted = true;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;
        draw();
      } catch {
        // Mic not available — just show flat bars
      }
    };

    const draw = () => {
      if (!mounted) return;
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barW = w / barCount;
      const maxH = h * 0.85;
      const minH = 3;

      for (let i = 0; i < barCount; i++) {
        // Map frequency bins to bar count
        const dataIdx = Math.floor((i / barCount) * data.length);
        const val = data[dataIdx] / 255;
        const barH = Math.max(val * maxH, minH);

        // Gradient color: emerald for low bars, cyan for peaks
        const intensity = val;
        const r = Math.round(16 + intensity * 34);
        const g = Math.round(185 + intensity * 60);
        const b = Math.round(129 + intensity * 126);
        const alpha = 0.4 + intensity * 0.6;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

        // Centered bars
        const x = i * barW + 1;
        const y = (h - barH) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(barW - 2, 1), barH, 2);
        ctx.fill();

        // Glow effect for loud bars
        if (val > 0.6) {
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    setup();

    return () => {
      mounted = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [active, barCount]);

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-all duration-300",
      active
        ? "bg-emerald-500/[0.04] border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
        : "bg-white/[0.02] border-white/[0.06]"
    )}>
      <canvas
        ref={canvasRef}
        width={240}
        height={40}
        className="w-full h-10 block"
      />
    </div>
  );
};

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
   GRADIENT TAB — SocialHub-style gradient pill tab
   ═══════════════════════════════════════════════════════════════════════════════ */

const GradientTab = ({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className={cn(
      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all",
      active
        ? "bg-gradient-to-r from-emerald-500 to-yellow-400 text-black shadow-lg shadow-emerald-500/20"
        : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
    )}>
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   PERSON CARD — avatar card for people grid
   ═══════════════════════════════════════════════════════════════════════════════ */

const PersonCard = ({ username, avatarUrl, isYou, isSpeaking, online = true }: {
  username: string | null;
  avatarUrl: string | null;
  isYou?: boolean;
  isSpeaking?: boolean;
  online?: boolean;
}) => (
  <div className={cn(
    "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
    isSpeaking ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
  )}>
    <div className="relative">
      <div className={cn(
        "w-14 h-14 rounded-full flex items-center justify-center overflow-hidden border-2",
        isSpeaking ? "border-emerald-400/50 sp-pulse-ring" : "border-white/[0.08] bg-white/[0.04]"
      )}>
        {safAvatar(avatarUrl) ? (
          <img src={safAvatar(avatarUrl)} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-white/20">{(username?.[0] || "?").toUpperCase()}</span>
        )}
      </div>
      {online && (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0a0f18]" />
      )}
    </div>
    <span className="text-[11px] font-bold text-white/60 truncate max-w-[100px]">
      {isYou ? `${username || "You"} (You)` : username || "User"}
    </span>
    {isSpeaking && <AudioEQ active bars={3} color="bg-emerald-400" />}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   ROOM CARD — voice room list item
   ═══════════════════════════════════════════════════════════════════════════════ */

const RoomCard = ({ space, onJoin }: { space: Space; onJoin: (s: Space) => void }) => {
  const tm = topicOf(space.topic);
  const total = (space.listener_count || 0) + (space.speaker_count || 0);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] transition-all p-4">
      <div className="flex items-start gap-3">
        <div className={cn("shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-lg border", tm.color)}>
          {tm.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-[14px] text-white leading-tight line-clamp-1">{space.title}</h3>
            {space.is_live && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
                <span className="text-[8px] font-bold text-red-400">LIVE</span>
              </span>
            )}
          </div>
          {space.description && <p className="text-[11px] text-white/25 line-clamp-1 mb-1.5">{space.description}</p>}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30">@{space.host_username || "host"}</span>
            <span className="flex items-center gap-1 text-[10px] text-white/20"><Users className="h-3 w-3" />{total}</span>
            {space.is_recording && <span className="flex items-center gap-1 text-[8px] text-red-400/50 font-bold"><div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />REC</span>}
          </div>
        </div>
        <button onClick={() => onJoin(space)}
          className="shrink-0 self-center px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-yellow-400 text-black text-[11px] font-black hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
          Join
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   PAST ROOM CARD — for replay section
   ═══════════════════════════════════════════════════════════════════════════════ */

const formatDuration = (sec: number | null): string => {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const PastRoomCard = ({ space, onPlay }: { space: Space; onPlay: (s: Space) => void }) => {
  const tm = topicOf(space.topic);
  const hasReplay = !!space.recording_url;
  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all",
      hasReplay ? "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] cursor-pointer" : "border-white/[0.04] bg-white/[0.01] opacity-40"
    )} onClick={() => hasReplay && onPlay(space)}>
      <div className="flex items-center gap-3">
        <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base border", tm.color)}>
          {tm.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[13px] text-white line-clamp-1">{space.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-white/20">@{space.host_username || "host"}</span>
            {space.ended_at && <span className="text-[9px] text-white/15">{formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}</span>}
            {hasReplay && <span className="text-[9px] text-primary/60 font-bold">{space.duration_seconds ? formatDuration(space.duration_seconds) : "Replay"}</span>}
          </div>
        </div>
        {hasReplay && (
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center hover:bg-primary/20 transition-colors">
            <Play className="h-4 w-4 text-primary ml-0.5" />
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   UNUSED — kept for compat (referenced nowhere now)
   ═══════════════════════════════════════════════════════════════════════════════ */
const TrendingBanner = ({ spaces, onJoin }: { spaces: Space[]; onJoin: (s: Space) => void }) => {
  if (spaces.length === 0) return null;
  const top = spaces[0];
  const ttm = topicOf(top.topic);
  const topTotal = (top.listener_count || 0) + (top.speaker_count || 0);
  return (
    <div className="mb-5">
      {/* Featured / top space — full width hero card */}
      <button onClick={() => onJoin(top)} className="w-full text-left rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-violet-900/[0.04] to-transparent p-5 relative overflow-hidden group transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/[0.05] mb-3">
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/[0.06] blur-3xl opacity-60 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-start gap-4">
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-2xl">
            {ttm.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
                <span className="text-[9px] font-bold text-red-400">LIVE</span>
              </span>
              <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border", ttm.color)}>
                {top.topic}
              </span>
              {top.is_recording && <span className="inline-flex items-center gap-1 text-[8px] font-bold text-red-400/60 px-1.5 py-0.5 rounded-full bg-red-500/5 border border-red-500/10">● REC</span>}
            </div>
            <h3 className="font-black text-base text-white leading-snug line-clamp-1">{top.title}</h3>
            {top.description && <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">{top.description}</p>}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                  {safAvatar(top.host_avatar) ? <img src={safAvatar(top.host_avatar)} alt="" className="w-full h-full object-cover" /> : <Crown className="h-2.5 w-2.5 text-primary" />}
                </div>
                <span className="text-[10px] text-white/40 font-medium">@{top.host_username || "host"}</span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-white/25"><Headphones className="h-3 w-3" />{topTotal.toLocaleString()} listening</span>
              <AudioEQ active bars={4} color="bg-emerald-400/80" />
            </div>
          </div>
          <div className="shrink-0 self-center px-4 py-2 rounded-full bg-primary/15 border border-primary/30 text-primary text-[11px] font-bold group-hover:bg-primary/25 transition-colors">
            Join
          </div>
        </div>
      </button>

      {/* More live — smaller horizontal cards */}
      {spaces.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {spaces.slice(1, 6).map((s) => {
            const tm = topicOf(s.topic);
            const total = (s.listener_count || 0) + (s.speaker_count || 0);
            return (
              <button key={s.id} onClick={() => onJoin(s)}
                className="shrink-0 w-56 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.04] group">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">{tm.icon}</span>
                  <span className="text-[9px] font-bold text-white/30 uppercase">{s.topic}</span>
                  <span className="ml-auto relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
                </div>
                <h4 className="font-bold text-[12px] text-white leading-snug line-clamp-1">{s.title}</h4>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-white/30 truncate">@{s.host_username || "host"}</span>
                  <span className="flex items-center gap-1 text-[10px] text-white/20"><Headphones className="h-2.5 w-2.5" />{total}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SPACE CARD — list view
   ═══════════════════════════════════════════════════════════════════════════════ */

const formatDuration = (sec: number | null): string => {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const SpaceCard = ({ space, onJoin, variant = "default" }: { space: Space; onJoin: (s: Space) => void; variant?: "default" | "past" }) => {
  const tm = topicOf(space.topic);
  const total = (space.listener_count || 0) + (space.speaker_count || 0);
  const isPast = variant === "past";
  const hasReplay = isPast && !!space.recording_url;

  return (
    <button onClick={() => { if (isPast && !hasReplay) return; onJoin(space); }}
      className={cn(
        "w-full text-left rounded-xl border transition-all group",
        isPast
          ? hasReplay
            ? "p-3.5 border-white/[0.06] bg-white/[0.015] hover:border-primary/25 hover:bg-white/[0.03] cursor-pointer"
            : "p-3.5 border-white/[0.04] bg-white/[0.01] opacity-35 cursor-default"
          : "p-3.5 border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]",
      )}>
      <div className="flex gap-3 items-center">
        {/* Left: Topic badge */}
        <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base border", tm.color)}>
          {tm.icon}
        </div>

        {/* Middle: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {space.is_live && !isPast && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
                <span className="text-[8px] font-bold text-red-400">LIVE</span>
              </span>
            )}
            {space.is_recording && <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-red-400/50"><div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />REC</span>}
            {space.is_private && <Lock className="h-2.5 w-2.5 text-white/15" />}
            {isPast && space.ended_at && (
              <span className="text-[9px] text-white/20">{formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}</span>
            )}
            {isPast && hasReplay && (
              <span className="inline-flex items-center gap-1 text-[9px] text-primary/60 font-bold"><Play className="h-2.5 w-2.5" />{space.duration_seconds ? formatDuration(space.duration_seconds) : "Replay"}</span>
            )}
            {isPast && !hasReplay && <span className="text-[8px] text-white/15 italic">No recording</span>}
          </div>
          <h3 className="font-bold text-[13px] text-white leading-tight line-clamp-1">{space.title}</h3>
          {space.description && <p className="text-[10px] text-white/25 mt-0.5 line-clamp-1">{space.description}</p>}
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-[10px] text-white/30 font-medium">@{space.host_username || "host"}</span>
            {space.speaker_count > 1 && <span className="flex items-center gap-0.5 text-[9px] text-white/20"><Mic className="h-2.5 w-2.5" />{space.speaker_count}</span>}
            <span className="flex items-center gap-0.5 text-[9px] text-white/15"><Headphones className="h-2.5 w-2.5" />{total}</span>
            {space.tags?.slice(0, 1).map(t => (
              <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/[0.03] text-white/15 border border-white/[0.04]">#{t}</span>
            ))}
          </div>
        </div>

        {/* Right: action hint */}
        {!isPast && (
          <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] text-white/40 font-medium group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/25 transition-all">
              Join
            </div>
          </div>
        )}
        {isPast && hasReplay && (
          <div className="shrink-0 self-center">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Play className="h-3.5 w-3.5 text-primary ml-0.5" />
            </div>
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1] transition-all p-3.5">
      <div className="flex items-center gap-3">
        <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base border", tm.color)}>
          {tm.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[13px] text-white line-clamp-1">{space.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {space.scheduled_for && (
              <>
                <Clock className="h-2.5 w-2.5 text-primary/50" />
                <span className="text-[10px] text-primary/60 font-medium">{format(new Date(space.scheduled_for), "MMM d · h:mm a")}</span>
                <span className="text-[9px] text-white/15">({formatDistanceToNow(new Date(space.scheduled_for), { addSuffix: true })})</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-white/25 mt-0.5 block">@{space.host_username || "host"}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onRemind(space)}
            className="h-8 w-8 rounded-lg flex items-center justify-center border border-white/[0.06] text-white/30 hover:bg-white/[0.04] hover:text-primary transition-all" title="Set reminder">
            <Bell className="h-3.5 w-3.5" />
          </button>
          {isOwner && onStartNow && (
            <Button size="sm" onClick={() => onStartNow(space)}
              className="rounded-lg text-[10px] h-8 gap-1 px-3 font-bold">
              <Play className="h-3 w-3" /> Go Live
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
   SPACE ROOM — SocialHub-style clean room view
   ═══════════════════════════════════════════════════════════════════════════════ */

const SpaceRoom = ({ space, onLeave }: { space: Space; onLeave: () => void }) => {
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
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [myRole, setMyRole] = useState<VoiceRole>("speaker");
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [slowMode, setSlowMode] = useState(false);
  const voicePanelRef = useRef<VoicePanelHandle>(null);
  const isHost = user?.id === space.host_id;
  const tm = topicOf(cur.topic);
  const rxId = useRef(0);
  const MAX_SPEAKERS = 10;

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
    supabase.rpc("increment_listener", { space_id: space.id }).then(({ error }) => {
      if (error) supabase.from("spaces").update({ listener_count: (cur.listener_count || 0) + 1 }).eq("id", space.id);
    });
    return () => {
      supabase.rpc("decrement_listener", { space_id: space.id }).then(({ error }) => {
        if (error) supabase.from("spaces").update({ listener_count: Math.max((cur.listener_count || 1) - 1, 0) }).eq("id", space.id);
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
    const duration = Math.round((Date.now() - new Date(space.created_at).getTime()) / 1000);
    await supabase.from("spaces").update({
      is_live: false,
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
    }).eq("id", space.id);
    toast.success("Space ended"); onLeave();
  };

  const share = () => { navigator.clipboard.writeText(`${window.location.origin}/spaces?join=${space.id}`); toast.success("Link copied! 🔗"); };

  const votePoll = (idx: number) => {
    if (!poll || poll.votedIndex !== null) return;
    setPoll({ ...poll, votedIndex: idx, options: poll.options.map((o, i) => i === idx ? { ...o, votes: o.votes + 1 } : o) });
  };

  const totalInRoom = voiceParticipants.length || ((cur.listener_count || 0) + (cur.speaker_count || 0));

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <SpaceStyles />
      <ReactionOverlay items={reactions} />

      {/* ── Room Header — SocialHub style ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <button onClick={onLeave} className="text-emerald-400 text-sm font-bold flex items-center gap-1 hover:text-emerald-300 transition">
          <ArrowLeft className="h-4 w-4" /> Leave
        </button>
        <div className="flex-1 min-w-0 ml-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <h3 className="font-black text-sm text-white uppercase tracking-wide truncate">{cur.title}</h3>
          </div>
          <div className="flex items-center gap-2 mt-0.5 ml-[18px]">
            <Globe className="h-3 w-3 text-white/20" />
            <span className="text-[11px] text-white/30">{cur.is_private ? "private" : "public"} · {totalInRoom} connected</span>
            {cur.is_recording && <span className="flex items-center gap-1 text-[9px] text-red-400/60 font-bold"><div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />REC</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
            <LiveTimer startedAt={cur.created_at} />
          </div>
          {isHost && (
            <div className="relative">
              <button onClick={() => setShowMore(!showMore)} className="p-2 rounded-xl hover:bg-white/[0.05] transition"><MoreVertical className="h-4 w-4 text-white/30" /></button>
              {showMore && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMore(false)} />
                  <div className="absolute right-0 top-full mt-1 w-52 bg-[#0c1219] border border-white/[0.08] rounded-xl shadow-2xl z-30 overflow-hidden sp-slide-up">
                    <button onClick={() => { setShowHostPanel(!showHostPanel); setShowMore(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary hover:bg-primary/5 transition"><Shield className="h-4 w-4" /> Host Controls</button>
                    <button onClick={() => { setShowPollCreate(true); setShowMore(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 transition"><BarChart3 className="h-4 w-4" /> Create Poll</button>
                    <div className="border-t border-white/[0.06]" />
                    <button onClick={() => { endSpace(); setShowMore(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"><StopCircle className="h-4 w-4" /> End Room</button>
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

      {/* ── Poll ── */}
      {poll && <LivePollWidget poll={poll} onVote={votePoll} onClose={() => setPoll({ ...poll, closed: true })} isHost={isHost} />}
      {showPollCreate && <CreatePollInline onCreate={p => { setPoll(p); setShowPollCreate(false); }} onCancel={() => setShowPollCreate(false)} />}

      {/* ── Host Controls Panel ── */}
      {isHost && showHostPanel && (
        <div className="mx-4 mt-3 rounded-2xl border border-primary/15 bg-primary/[0.02] p-4 sp-slide-up space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-primary flex items-center gap-2"><Shield className="h-4 w-4" /> Host Controls</p>
            <button onClick={() => setShowHostPanel(false)} className="p-1 rounded hover:bg-white/10"><XIcon className="h-3 w-3 text-white/25" /></button>
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">Speakers ({voiceParticipants.filter(p => p.role === "speaker").length}/{MAX_SPEAKERS})</p>
            <div className="space-y-1.5">
              {voiceParticipants.filter(p => p.role === "speaker").map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] overflow-hidden flex items-center justify-center">
                    {safAvatar(p.avatar_url) ? <img src={safAvatar(p.avatar_url)} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-white/30">{p.username?.[0]?.toUpperCase() || "?"}</span>}
                  </div>
                  <span className="text-[11px] text-white/60 font-medium flex-1 truncate">{p.username || "User"}{p.user_id === space.host_id && <Crown className="h-3 w-3 text-amber-400 inline ml-1" />}</span>
                  {p.user_id !== space.host_id && p.user_id !== user?.id && (
                    <div className="flex gap-1">
                      <button onClick={() => voicePanelRef.current?.muteUser(p.user_id)} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/20">Mute</button>
                      <button onClick={() => voicePanelRef.current?.demoteToListener(p.user_id)} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/[0.04] text-white/40 border border-white/[0.08] hover:bg-white/[0.08]">Demote</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {voiceParticipants.filter(p => p.role === "listener").length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">Listeners ({voiceParticipants.filter(p => p.role === "listener").length})</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {voiceParticipants.filter(p => p.role === "listener").map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <div className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/[0.06] overflow-hidden flex items-center justify-center">
                      {safAvatar(p.avatar_url) ? <img src={safAvatar(p.avatar_url)} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold text-white/20">{p.username?.[0]?.toUpperCase() || "?"}</span>}
                    </div>
                    <span className="text-[10px] text-white/40 font-medium flex-1 truncate">{p.username || "User"}</span>
                    {voiceParticipants.filter(pp => pp.role === "speaker").length < MAX_SPEAKERS && (
                      <button onClick={() => voicePanelRef.current?.promoteToSpeaker(p.user_id)} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"><UserPlus className="h-3 w-3 inline mr-0.5" />Promote</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Input placeholder="Announcement..." value={announcement} onChange={e => setAnnouncement(e.target.value)} className="bg-white/[0.04] border-white/[0.06] rounded-lg text-sm h-8 flex-1" />
            <Button size="sm" disabled={!announcement.trim()} onClick={() => { setPinnedMsg(announcement.trim()); supabase.from("spaces").update({ pinned_message: announcement.trim() }).eq("id", space.id); setAnnouncement(""); }} className="rounded-lg h-8 px-3 text-[10px]">Pin</Button>
          </div>
        </div>
      )}

      {/* ── Main content: IN ROOM grid ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0" style={{ scrollbarWidth: "none" }}>
          {/* Section header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
            <Users className="h-4 w-4 text-white/30" />
            <span className="text-[12px] font-black text-white/40 uppercase tracking-widest">In Room ({totalInRoom})</span>
          </div>

          {/* Avatar grid — matching SocialHub style */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {/* All participants as PersonCards */}
            {voiceParticipants.map((p, i) => (
              <PersonCard
                key={p.id}
                username={p.username}
                avatarUrl={p.avatar_url}
                isYou={p.user_id === user?.id}
                isSpeaking={p.role === "speaker" && !p.is_muted}
              />
            ))}
            {voiceParticipants.length === 0 && (
              <div className="col-span-full text-center py-8">
                <Users className="h-8 w-8 mx-auto text-white/[0.06] mb-2" />
                <p className="text-[11px] text-white/15">Waiting for people to join...</p>
              </div>
            )}
          </div>

          {/* Hidden VoicePanel — provides WebRTC functionality */}
          <div className="hidden">
            <VoicePanel
              ref={voicePanelRef}
              lobbyId={`space-${space.id}`}
              lobbyName={space.title}
              autoJoin
              isRecording={cur.is_recording && isHost}
              spaceId={space.id}
              hostId={space.host_id}
              initialRole={isHost ? "speaker" : "listener"}
              maxSpeakers={MAX_SPEAKERS}
              onRecordingSaved={(url, dur) => { setCur(prev => ({ ...prev, recording_url: url, duration_seconds: dur })); }}
              onParticipantsChange={setVoiceParticipants}
              onRoleChange={setMyRole}
            />
          </div>

          {/* Speaker queue (only for non-hosts or pending requests) */}
          <div className="mt-4">
            <SpeakerQueue spaceId={space.id} isHost={isHost} onRaiseHand={raiseHand} hasRaised={hasRaised} />
          </div>

          {/* About section */}
          {cur.description && (
            <div className="mt-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1.5">About</p>
              <p className="text-[12px] text-white/40 leading-relaxed">{cur.description}</p>
            </div>
          )}
        </div>

        {/* Chat panel (side on desktop, bottom on mobile) */}
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

      {/* ── Bottom Controls — SocialHub-style rounded squares ── */}
      <div className="px-4 pb-6 pt-4 shrink-0 relative z-10">
        {/* Mic visualizer when speaking */}
        {myRole === "speaker" && !muted && (
          <div className="mb-3"><MicVisualizer active={true} /></div>
        )}

        {/* Reactions row */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto justify-center" style={{ scrollbarWidth: "none" }}>
          {REACTION_EMOJIS.slice(0, 6).map(e => (
            <button key={e} onClick={() => react(e)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:scale-110 active:scale-90 transition-all text-lg shrink-0">
              {e}
            </button>
          ))}
        </div>

        {/* Main controls — centered rounded squares */}
        <div className="flex items-center justify-center gap-3">
          {/* Mic toggle */}
          {myRole === "speaker" ? (
            <button onClick={() => { setMuted(v => !v); toast(muted ? "Unmuted 🎙️" : "Muted 🔇"); }}
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                muted
                  ? "bg-white/[0.06] border border-white/[0.08] text-white/50 hover:bg-white/[0.1]"
                  : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10"
              )}>
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : (
            <button onClick={raiseHand} disabled={hasRaised}
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                hasRaised
                  ? "bg-amber-400/15 border border-amber-400/25 text-amber-400"
                  : "bg-white/[0.06] border border-white/[0.08] text-white/50 hover:bg-white/[0.1]"
              )}>
              <Hand className={cn("h-5 w-5", hasRaised && "animate-bounce")} />
            </button>
          )}

          {/* Chat */}
          <button onClick={() => setShowChat(!showChat)}
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
              showChat
                ? "bg-primary/15 border border-primary/30 text-primary"
                : "bg-white/[0.06] border border-white/[0.08] text-white/40 hover:bg-white/[0.1]"
            )}>
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Host controls / Sparkle effects */}
          {isHost ? (
            <button onClick={() => setShowHostPanel(!showHostPanel)}
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                showHostPanel
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "bg-white/[0.06] border border-white/[0.08] text-white/40 hover:bg-white/[0.1]"
              )}>
              <Sparkles className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={share}
              className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-white/40 hover:bg-white/[0.1] transition-all">
              <Share2 className="h-5 w-5" />
            </button>
          )}

          {/* Leave — red */}
          <button onClick={onLeave}
            className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all">
            <XIcon className="h-5 w-5" />
          </button>
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

/* ═══════════════════════════════════════════════════════════════════════════════
   REPLAY PLAYER — Plays back a recorded Space
   ═══════════════════════════════════════════════════════════════════════════════ */
const ReplayPlayer = ({ space, onClose }: { space: Space; onClose: () => void }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(space.duration_seconds || 0);
  const [loading, setLoading] = useState(true);
  const tm = topicOf(space.topic);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoad = () => { setDuration(Math.round(el.duration)); setLoading(false); };
    const onTime = () => setCurTime(Math.round(el.currentTime));
    const onEnded = () => setPlaying(false);
    const onCanPlay = () => setLoading(false);
    el.addEventListener("loadedmetadata", onLoad);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("canplay", onCanPlay);
    return () => { el.removeEventListener("loadedmetadata", onLoad); el.removeEventListener("timeupdate", onTime); el.removeEventListener("ended", onEnded); el.removeEventListener("canplay", onCanPlay); };
  }, []);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const t = Number(e.target.value);
    el.currentTime = t;
    setCurTime(t);
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <SpaceStyles />
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-primary/[0.04] via-violet-900/[0.03] to-transparent" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#070d14]/80 backdrop-blur-xl z-10 shrink-0 relative">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition"><ArrowLeft className="h-4 w-4 text-white/50" /></button>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm text-white truncate">{space.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", tm.color)}>{tm.icon} {space.topic}</span>
            <span className="text-[10px] text-white/15">·</span>
            <span className="text-[10px] text-white/25">Replay</span>
            {space.ended_at && <><span className="text-[10px] text-white/15">·</span><span className="text-[10px] text-white/15">{formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}</span></>}
          </div>
        </div>
      </div>

      {/* Player Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6 relative">
        {/* Space info */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-600/20 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
            {safAvatar(space.host_avatar) ? <img src={safAvatar(space.host_avatar)} alt="" className="w-full h-full object-cover rounded-2xl" /> : <Radio className="h-8 w-8 text-primary/50" />}
          </div>
          <h2 className="text-lg font-black text-white mb-1">{space.title}</h2>
          {space.description && <p className="text-sm text-white/30 mb-2">{space.description}</p>}
          <p className="text-[11px] text-white/25">Hosted by @{space.host_username || "unknown"}</p>
        </div>

        {/* Audio element */}
        <audio ref={audioRef} src={space.recording_url || ""} preload="metadata" />

        {/* Play button */}
        <button onClick={togglePlay} disabled={loading}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-all",
            playing
              ? "bg-white/10 border-2 border-white/20 text-white hover:bg-white/15"
              : "bg-primary/20 border-2 border-primary/40 text-primary hover:bg-primary/30 shadow-[0_0_30px_rgba(var(--primary-rgb,190,242,100),0.2)]",
            loading && "opacity-50"
          )}
        >
          {loading ? (
            <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : playing ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 ml-0.5" />
          )}
        </button>

        {/* Progress bar */}
        <div className="w-full max-w-sm space-y-2">
          <input
            type="range"
            min={0}
            max={duration || 1}
            value={currentTime}
            onChange={seek}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(var(--primary-rgb,190,242,100),0.5)]"
            style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)` }}
          />
          <div className="flex justify-between text-[10px] text-white/25 font-mono">
            <span>{fmtTime(currentTime)}</span>
            <span>{fmtTime(duration)}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[10px] text-white/20">
          {space.peak_listeners > 0 && <span className="flex items-center gap-1"><Headphones className="h-3 w-3" />{space.peak_listeners} peak listeners</span>}
          {space.speaker_count > 0 && <span className="flex items-center gap-1"><Mic className="h-3 w-3" />{space.speaker_count} speakers</span>}
          {space.duration_seconds && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(space.duration_seconds)}</span>}
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, sub, action }: { icon: React.ComponentType<{ className?: string }>; title: string; sub: string; action?: { label: string; onClick: () => void } }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
      <Icon className="h-7 w-7 text-white/[0.08]" />
    </div>
    <p className="font-black text-white/25 text-sm uppercase tracking-wider">{title}</p>
    <p className="text-[12px] text-white/15 mt-1 text-center max-w-xs">{sub}</p>
    {action && (
      <button onClick={action.onClick}
        className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-yellow-400 text-black text-sm font-black hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2">
        <Plus className="h-4 w-4" />{action.label}
      </button>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN SPACES PAGE — SocialHub-style with LOBBY / PEOPLE / ROOMS
   ═══════════════════════════════════════════════════════════════════════════════ */

const Spaces = () => {
  const { user, profile } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [subTab, setSubTab] = useState<"lobby" | "people" | "rooms">("lobby");
  const [inLobby, setInLobby] = useState(false);
  const [search, setSearch] = useState("");
  const [replaySpace, setReplaySpace] = useState<Space | null>(null);
  const [lobbyParticipants, setLobbyParticipants] = useState<VoiceParticipant[]>([]);
  const [lobbyMuted, setLobbyMuted] = useState(true);
  const lobbyVoiceRef = useRef<VoicePanelHandle>(null);

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

  const handleCreated = (s: Space) => {
    if (s.is_live) { setSpaces(prev => [s, ...prev]); setActiveSpace(s); }
    else { setSpaces(prev => [s, ...prev]); setSubTab("rooms"); }
  };

  const liveRooms = useMemo(() => spaces.filter(s => s.is_live), [spaces]);
  const scheduledRooms = useMemo(() => spaces.filter(s => !s.is_live && !s.ended_at), [spaces]);
  const endedRooms = useMemo(() => pastSpaces, [pastSpaces]);
  const allRooms = useMemo(() => [...liveRooms, ...scheduledRooms], [liveRooms, scheduledRooms]);
  const filteredRooms = useMemo(() => {
    if (!search.trim()) return allRooms;
    const q = search.toLowerCase();
    return allRooms.filter(s => s.title.toLowerCase().includes(q) || s.host_username?.toLowerCase().includes(q) || s.topic?.toLowerCase().includes(q));
  }, [allRooms, search]);

  const lobbyCount = lobbyParticipants.length || 0;

  // ── Replay player ──
  if (replaySpace) return <ReplayPlayer space={replaySpace} onClose={() => setReplaySpace(null)} />;

  // ── Active room (custom space) ──
  if (activeSpace) return (
    <SpaceRoom space={activeSpace}
      onLeave={() => { setActiveSpace(null); fetchSpaces(); }} />
  );

  // ── Main view ──
  return (
    <div className="relative">
      <SpaceStyles />

      {/* ══════ SUB-TABS: LOBBY / PEOPLE / ROOMS ══════ */}
      <div className="flex gap-2 mb-4">
        <GradientTab active={subTab === "lobby"} icon={Volume2} label="Lobby" onClick={() => setSubTab("lobby")} />
        <GradientTab active={subTab === "people"} icon={Users} label="People" onClick={() => setSubTab("people")} />
        <GradientTab active={subTab === "rooms"} icon={Globe} label="Rooms" onClick={() => setSubTab("rooms")} />
      </div>

      {/* ══════ LOBBY TAB ══════ */}
      {subTab === "lobby" && !inLobby && (
        <div className="space-y-5">
          {/* Voice Lobby hero card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-black text-base text-white uppercase tracking-wide">Voice Lobby</h3>
              </div>
              {lobbyCount > 0 && (
                <span className="text-[11px] text-white/30 font-bold px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  {lobbyCount} here
                </span>
              )}
            </div>
            <p className="text-[13px] text-white/30 mb-4">Community voice channel with live audio & soundboard support.</p>
            <button onClick={() => { setInLobby(true); toast.success("Joined Voice Lobby 🎙️"); }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-yellow-400 text-black font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
              <Volume2 className="h-4 w-4" /> Join Voice Lobby
            </button>
          </div>

          {/* People here */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
              <Users className="h-4 w-4 text-white/25" />
              <span className="text-[11px] font-black text-white/35 uppercase tracking-widest">People Here</span>
            </div>
            {lobbyCount > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {lobbyParticipants.map(p => (
                  <PersonCard key={p.id} username={p.username} avatarUrl={p.avatar_url} isYou={p.user_id === user?.id} isSpeaking={p.role === "speaker" && !p.is_muted} />
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-white/15 text-center py-6">No one in the lobby yet. Be the first!</p>
            )}
          </div>
        </div>
      )}

      {/* ══════ LOBBY TAB — IN LOBBY (joined) ══════ */}
      {subTab === "lobby" && inLobby && (
        <div className="space-y-0">
          {/* Room header */}
          <div className="flex items-center gap-3 pb-3 mb-4 border-b border-white/[0.06]">
            <button onClick={() => { setInLobby(false); lobbyVoiceRef.current?.leaveVoice(); toast("Left the lobby"); }}
              className="text-emerald-400 text-sm font-bold flex items-center gap-1 hover:text-emerald-300 transition">
              <ArrowLeft className="h-4 w-4" /> Leave
            </button>
            <div className="flex-1 min-w-0 ml-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <h3 className="font-black text-sm text-white uppercase tracking-wide">Voice Lobby</h3>
              </div>
              <p className="text-[11px] text-white/25 ml-[18px]">
                <Globe className="h-3 w-3 text-white/15 inline mr-1" />public · {lobbyParticipants.length} connected
              </p>
            </div>
          </div>

          {/* In room section */}
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-white/30" />
            <span className="text-[12px] font-black text-white/40 uppercase tracking-widest">In Room ({lobbyParticipants.length})</span>
          </div>

          {/* Avatar grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-6">
            {lobbyParticipants.map(p => (
              <PersonCard key={p.id} username={p.username} avatarUrl={p.avatar_url} isYou={p.user_id === user?.id} isSpeaking={p.role === "speaker" && !p.is_muted} />
            ))}
            {lobbyParticipants.length === 0 && (
              <PersonCard username={profile?.username} avatarUrl={profile?.avatar_url} isYou />
            )}
          </div>

          {/* Hidden voice panel for WebRTC */}
          <div className="hidden">
            <VoicePanel
              ref={lobbyVoiceRef}
              lobbyId="main-voice-lobby"
              lobbyName="Voice Lobby"
              autoJoin
              onParticipantsChange={setLobbyParticipants}
            />
          </div>

          {/* Mic visualizer */}
          {!lobbyMuted && <div className="mb-4"><MicVisualizer active={true} /></div>}

          {/* Bottom controls — centered rounded squares */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <button onClick={() => { setLobbyMuted(v => !v); toast(lobbyMuted ? "Unmuted 🎙️" : "Muted 🔇"); }}
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                lobbyMuted
                  ? "bg-white/[0.06] border border-white/[0.08] text-white/50 hover:bg-white/[0.1]"
                  : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10"
              )}>
              {lobbyMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-white/40 hover:bg-white/[0.1] transition-all">
              <Sparkles className="h-5 w-5" />
            </button>
            <button onClick={() => { setInLobby(false); lobbyVoiceRef.current?.leaveVoice(); toast("Left the lobby"); }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* ══════ PEOPLE TAB ══════ */}
      {subTab === "people" && (
        <div>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/[0.06]">
            <Users className="h-4 w-4 text-white/25" />
            <span className="text-[11px] font-black text-white/35 uppercase tracking-widest">People Online ({lobbyParticipants.length})</span>
          </div>
          {lobbyParticipants.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {lobbyParticipants.map(p => (
                <PersonCard key={p.id} username={p.username} avatarUrl={p.avatar_url} isYou={p.user_id === user?.id} online />
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No one online" sub="People in voice will appear here" />
          )}
        </div>
      )}

      {/* ══════ ROOMS TAB ══════ */}
      {subTab === "rooms" && (
        <div>
          {/* Rooms header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-white/30" />
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-wide">Voice Rooms</h3>
                <p className="text-[11px] text-white/25">{liveRooms.length} active room{liveRooms.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-yellow-400 text-black text-[12px] font-black flex items-center gap-1.5 hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
              <Plus className="h-3.5 w-3.5" /> New Room
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
            <Input placeholder="Search rooms..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-white/[0.03] border-white/[0.06] rounded-xl pl-10 h-10 text-sm focus:border-emerald-500/40" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50"><XIcon className="h-4 w-4" /></button>}
          </div>

          {/* Room lists */}
          {loading ? (
            <div className="flex flex-col gap-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-white/[0.02] animate-pulse" />)}</div>
          ) : filteredRooms.length === 0 && endedRooms.length === 0 ? (
            <EmptyState icon={Globe} title="No Rooms Yet" sub="Create a room above to start a conversation"
              action={{ label: "New Room", onClick: () => setShowCreate(true) }} />
          ) : (
            <div className="space-y-3 pb-4">
              {/* Live rooms */}
              {filteredRooms.filter(s => s.is_live).map(s => (
                <RoomCard key={s.id} space={s} onJoin={setActiveSpace} />
              ))}
              {/* Scheduled rooms */}
              {filteredRooms.filter(s => !s.is_live).length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-2">
                    <Clock className="h-3.5 w-3.5 text-white/20" />
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Upcoming</span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                  </div>
                  {filteredRooms.filter(s => !s.is_live).map(s => (
                    <RoomCard key={s.id} space={s} onJoin={setActiveSpace} />
                  ))}
                </>
              )}
              {/* Past rooms with replay */}
              {endedRooms.length > 0 && !search && (
                <>
                  <div className="flex items-center gap-2 pt-2">
                    <Archive className="h-3.5 w-3.5 text-white/20" />
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Past Rooms</span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                  </div>
                  {endedRooms.slice(0, 5).map(s => (
                    <PastRoomCard key={s.id} space={s} onPlay={setReplaySpace} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
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
