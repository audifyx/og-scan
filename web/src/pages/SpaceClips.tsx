/**
 * SpaceClips — ogscan.fun/clips
 *
 * Feature 6: Clips & Highlights
 * - Browse all public clips from past spaces
 * - Waveform visualiser (canvas-rendered from waveform_data JSON)
 * - Clip player with seek, play/pause, like, share to X/TikTok
 * - Create clip modal: pick start/end time within a space recording
 * - Filter by space, creator, tags
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Play, Pause, Heart, Share2, Scissors, Clock, Download,
  Twitter, Copy, X, Plus, ChevronLeft, ChevronRight,
  Volume2, VolumeX, Headphones, Flame, Bookmark,
  TrendingUp, Radio,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { safeAvatarUrl } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
interface Clip {
  id: string;
  space_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  start_offset_sec: number;
  end_offset_sec: number;
  duration_sec: number;
  clip_url: string | null;
  thumbnail_url: string | null;
  waveform_data: number[] | null;
  view_count: number;
  like_count: number;
  share_count: number;
  tags: string[] | null;
  is_public: boolean;
  created_at: string;
  // joined
  creator_username?: string;
  creator_avatar?: string | null;
  space_title?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Waveform Canvas Renderer
// ────────────────────────────────────────────────────────────────────────────
function WaveformBar({
  data,
  progress = 0,
  onSeek,
  color = "#7c3aed",
  height = 48,
}: {
  data: number[] | null;
  progress?: number;
  onSeek?: (pct: number) => void;
  color?: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bars = data || Array.from({ length: 60 }, () => 0.2 + Math.random() * 0.8);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const barW = W / bars.length;
    bars.forEach((v, i) => {
      const h = Math.max(3, v * H);
      const x = i * barW;
      const y = (H - h) / 2;
      const filled = (i / bars.length) < progress;
      ctx.fillStyle = filled ? color : color + "40";
      ctx.beginPath();
      ctx.roundRect(x + 1, y, barW - 2, h, 2);
      ctx.fill();
    });
  }, [bars, progress, color]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    onSeek((e.clientX - rect.left) / rect.width);
  };

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={height}
      className="w-full cursor-pointer"
      onClick={handleClick}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Clip Player Card
// ────────────────────────────────────────────────────────────────────────────
function ClipCard({ clip, onLike }: { clip: Clip; onLike: (id: string) => void }) {
  const [playing, setPlaying] = useState(false);
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(clip.like_count);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const duration = clip.duration_sec || (clip.end_offset_sec - clip.start_offset_sec) || 30;

  const togglePlay = () => {
    if (!clip.clip_url) {
      toast.info("Clip playback coming soon — audio processing in progress");
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(clip.clip_url);
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
    }
    if (playing) {
      audioRef.current.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      audioRef.current.muted = muted;
      audioRef.current.play();
      intervalRef.current = setInterval(() => {
        if (!audioRef.current) return;
        setProgress(audioRef.current.currentTime / (audioRef.current.duration || duration));
      }, 250);
    }
    setPlaying(p => !p);
  };

  const handleSeek = (pct: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = pct * (audioRef.current.duration || duration);
    setProgress(pct);
  };

  const handleLike = () => {
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    onLike(clip.id);
  };

  const shareToX = () => {
    const url = `https://ogscan.fun/clip/${clip.id}`;
    const text = `🎵 "${clip.title}" — a clip from OGScan Spaces\n${url}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://ogscan.fun/clip/${clip.id}`);
    toast.success("Link copied!");
  };

  const formatDur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.1] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-white/[0.08] border border-white/[0.1] shrink-0">
            {clip.creator_avatar ? (
              <img src={safeAvatarUrl(clip.creator_avatar)} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[10px] text-white/40 font-bold">
                {(clip.creator_username || "?")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-white/80">@{clip.creator_username || "user"}</p>
            <p className="text-[10px] text-white/30">{formatDistanceToNow(new Date(clip.created_at), { addSuffix: true })}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {clip.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.05]">#{tag}</span>
          ))}
        </div>
      </div>

      {/* Title & space ref */}
      <div>
        <p className="text-sm font-semibold text-white/90 mb-0.5">{clip.title}</p>
        {clip.space_title && (
          <p className="text-[10px] text-white/30 flex items-center gap-1">
            <Radio className="h-2.5 w-2.5" />
            From: {clip.space_title}
            {clip.start_offset_sec != null && (
              <span className="text-white/20">· at {formatDur(clip.start_offset_sec)}</span>
            )}
          </p>
        )}
        {clip.description && <p className="text-xs text-white/40 mt-1 line-clamp-2">{clip.description}</p>}
      </div>

      {/* Waveform + Player */}
      <div className="space-y-2">
        <WaveformBar
          data={clip.waveform_data}
          progress={progress}
          onSeek={handleSeek}
          color="#7c3aed"
          height={44}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="h-8 w-8 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 hover:bg-violet-600/50 transition-colors"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
            </button>
            <button onClick={() => setMuted(m => !m)} className="text-white/30 hover:text-white/60 transition-colors">
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          <span className="text-[10px] text-white/30 font-mono">
            {formatDur(Math.round(progress * duration))} / {formatDur(duration)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group mb-4"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-xs transition-colors ${liked ? "text-red-400" : "text-white/30 hover:text-red-400"}`}
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-red-400" : ""}`} />
            {likeCount}
          </button>
          <span className="flex items-center gap-1 text-xs text-white/25">
            <Headphones className="h-3.5 w-3.5" />
            {clip.view_count}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={shareToX} className="h-6 w-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.1] transition-all">
            <Twitter className="h-3 w-3" />
          </button>
          <button onClick={copyLink} className="h-6 w-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.1] transition-all">
            <Copy className="h-3 w-3" />
          </button>
          {clip.clip_url && (
            <a href={clip.clip_url} download className="h-6 w-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.1] transition-all">
              <Download className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Create Clip Modal
// ────────────────────────────────────────────────────────────────────────────
function CreateClipModal({ spaceId, spaceTitle, onClose, onCreated }: {
  spaceId: string;
  spaceTitle: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(30);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !title.trim()) { toast.error("Add a title"); return; }
    if (endSec <= startSec) { toast.error("End must be after start"); return; }
    setSaving(true);
    const { error } = await supabase.from("space_clips").insert({
      space_id: spaceId,
      creator_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      start_offset_sec: startSec,
      end_offset_sec: endSec,
      tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      is_public: true,
    });
    setSaving(false);
    if (error) { toast.error("Failed to create clip"); return; }
    toast.success("Clip created!");
    onCreated();
    onClose();
  };

  const formatDur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#1a1a2e] border border-white/[0.12] rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2"><Scissors className="h-4 w-4 text-violet-400" /> Create Clip</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-white/40 mb-4">From: <span className="text-white/60">{spaceTitle}</span></p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Give this moment a name…" className="w-full h-9 px-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-violet-500/50 transition-all" />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What's happening in this clip?" className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-violet-500/50 transition-all resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Start (seconds)</label>
              <input type="number" min={0} value={startSec} onChange={e => setStartSec(Number(e.target.value))} className="w-full h-9 px-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white/80 focus:outline-none focus:border-violet-500/50 transition-all" />
              <p className="text-[9px] text-white/25 mt-0.5">{formatDur(startSec)}</p>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">End (seconds)</label>
              <input type="number" min={startSec + 1} value={endSec} onChange={e => setEndSec(Number(e.target.value))} className="w-full h-9 px-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white/80 focus:outline-none focus:border-violet-500/50 transition-all" />
              <p className="text-[9px] text-white/25 mt-0.5">{formatDur(endSec)} · {endSec - startSec}s clip</p>
            </div>
          </div>
          {/* Waveform preview */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[10px] text-white/30 mb-2">Preview range</p>
            <WaveformBar data={null} progress={startSec / Math.max(endSec, 1)} color="#7c3aed" height={36} />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Tags (comma separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="alpha, market, breakout" className="w-full h-9 px-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-violet-500/50 transition-all" />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Scissors className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Create Clip"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────
export default function SpaceClips() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"recent" | "popular" | "mine">("recent");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForSpace, setCreateForSpace] = useState<{ id: string; title: string } | null>(null);
  const [myRecentSpaces, setMyRecentSpaces] = useState<{ id: string; title: string }[]>([]);

  const loadClips = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("space_clips").select("*").eq("is_public", true);
    if (filter === "popular") q = q.order("like_count", { ascending: false });
    else if (filter === "mine" && user) q = (supabase.from("space_clips").select("*") as any).eq("creator_id", user.id).order("created_at", { ascending: false });
    else q = q.order("created_at", { ascending: false });
    const { data } = await q.limit(40);

    // Enrich with creator profile + space title
    if (data && data.length > 0) {
      const creatorIds = [...new Set(data.map((c: any) => c.creator_id))];
      const spaceIds = [...new Set(data.map((c: any) => c.space_id))];
      const [{ data: profiles }, { data: spaces }] = await Promise.all([
        supabase.from("profiles").select("user_id,username,avatar_url").in("user_id", creatorIds),
        supabase.from("spaces").select("id,title").in("id", spaceIds),
      ]);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      const spaceMap = Object.fromEntries((spaces || []).map((s: any) => [s.id, s]));
      setClips(data.map((c: any) => ({
        ...c,
        creator_username: profileMap[c.creator_id]?.username,
        creator_avatar: profileMap[c.creator_id]?.avatar_url,
        space_title: spaceMap[c.space_id]?.title,
      })));
    } else {
      setClips([]);
    }
    setLoading(false);
  }, [filter, user]);

  useEffect(() => { loadClips(); }, [loadClips]);

  useEffect(() => {
    if (!user) return;
    supabase.from("spaces").select("id,title").eq("host_id", user.id).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(10)
      .then(({ data }) => setMyRecentSpaces((data || []) as { id: string; title: string }[]));
  }, [user]);

  const handleLike = async (clipId: string) => {
    if (!user) { toast.error("Sign in to like"); return; }
    await supabase.from("clip_likes").upsert({ clip_id: clipId, user_id: user.id }, { onConflict: "clip_id,user_id" });
    await supabase.from("space_clips").update({ like_count: clips.find(c => c.id === clipId)!.like_count + 1 }).eq("id", clipId);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white font-sans">
      <Toaster />
      {showCreateModal && createForSpace && (
        <CreateClipModal
          spaceId={createForSpace.id}
          spaceTitle={createForSpace.title}
          onClose={() => { setShowCreateModal(false); setCreateForSpace(null); }}
          onCreated={loadClips}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0f0f1a]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white/90 flex items-center gap-2">
              <Scissors className="h-4 w-4 text-violet-400" />
              Clips & Highlights
            </h1>
            <p className="text-xs text-white/30 mt-0.5">Best moments from OGScan Spaces</p>
          </div>
          {user && myRecentSpaces.length > 0 && (
            <button
              onClick={() => { setCreateForSpace(myRecentSpaces[0]); setShowCreateModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/30 text-violet-300 border border-violet-500/40 hover:bg-violet-600/50 transition-colors text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              New Clip
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {(["recent", "popular", "mine"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all capitalize ${filter === f ? "bg-violet-600/30 text-violet-300 border-violet-500/40" : "bg-white/[0.04] text-white/40 border-white/[0.06] hover:border-white/[0.12]"}`}
            >
              {f === "recent" && <Clock className="h-3 w-3 inline mr-1 -mt-0.5" />}
              {f === "popular" && <Flame className="h-3 w-3 inline mr-1 -mt-0.5" />}
              {f === "mine" && <Headphones className="h-3 w-3 inline mr-1 -mt-0.5" />}
              {f === "mine" ? "My Clips" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Clip from a specific past space selector */}
        {user && myRecentSpaces.length > 1 && (
          <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/40 mb-2">Clip from one of your past spaces:</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {myRecentSpaces.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setCreateForSpace(s); setShowCreateModal(true); }}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-white/60 hover:border-violet-500/40 hover:text-violet-300 transition-all flex items-center gap-1.5"
                >
                  <Scissors className="h-3 w-3" />
                  {s.title.slice(0, 30)}{s.title.length > 30 ? "…" : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clips grid */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-16">
            <Scissors className="h-10 w-10 text-white/15 mx-auto mb-4" />
            <p className="text-sm text-white/40 font-medium">No clips yet</p>
            <p className="text-xs text-white/25 mt-1 max-w-xs mx-auto">
              {filter === "mine" ? "Host a Space, then clip your best moments from the past spaces panel." : "Clips from live spaces will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {clips.map(clip => <ClipCard key={clip.id} clip={clip} onLike={handleLike} />)}
          </div>
        )}
      </div>
    </div>
  );
}
