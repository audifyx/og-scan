/**
 * SpaceReplay — Public standalone page for listening to recorded OG Spaces.
 * No auth required. Shareable link: ogscan.fun/listen/{spaceId}
 */
import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Mic, Play, Pause, Users, Clock, Radio, Share2, Copy,
  ArrowLeft, Volume2, VolumeX, SkipBack, SkipForward, Loader2,
  Headphones, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface Space {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  host_name: string | null;
  host_avatar: string | null;
  topic: string | null;
  is_live: boolean;
  listener_count: number;
  recording_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  ended_at: string | null;
}

/* ─── Topic colors ─── */
const TOPIC_COLORS: Record<string, string> = {
  Alpha: "from-amber-500/20 to-amber-600/5 border-amber-500/20",
  Trading: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
  Memecoins: "from-pink-500/20 to-pink-600/5 border-pink-500/20",
  DeFi: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
  NFTs: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
  News: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20",
  General: "from-white/10 to-white/5 border-white/10",
};

const formatDur = (sec: number | null): string => {
  if (!sec || sec <= 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
};

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

/* ═══════════════════════════════════════════════════════════════════════════════
   AUDIO WAVEFORM VISUALIZATION
   ═══════════════════════════════════════════════════════════════════════════════ */
const WaveformBars = ({ playing, barCount = 40 }: { playing: boolean; barCount?: number }) => (
  <div className="flex items-end gap-[2px] h-16 w-full px-2">
    {Array.from({ length: barCount }).map((_, i) => {
      const baseHeight = 20 + Math.sin(i * 0.4) * 30 + Math.cos(i * 0.7) * 20;
      return (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-full transition-all duration-300",
            playing ? "bg-gradient-to-t from-blue-500 to-cyan-400" : "bg-white/10"
          )}
          style={{
            height: `${playing ? baseHeight + Math.random() * 15 : baseHeight * 0.4}%`,
            opacity: playing ? 0.6 + Math.random() * 0.4 : 0.3,
            animationDuration: playing ? `${0.3 + Math.random() * 0.4}s` : undefined,
          }}
        />
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PUBLIC REPLAY PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
const SpaceReplay = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Fetch space data
  useEffect(() => {
    if (!spaceId) { setError("No space ID provided"); setLoading(false); return; }
    const fetch = async () => {
      const { data, error: err } = await supabase
        .from("spaces")
        .select("*")
        .eq("id", spaceId)
        .single();
      if (err || !data) { setError("Space not found"); }
      else { setSpace(data as Space); }
      setLoading(false);
    };
    fetch();
  }, [spaceId]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onDur = () => setDuration(audio.duration || 0);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("ended", onEnd);
    };
  }, [space?.recording_url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  const skip = (sec: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + sec));
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !muted;
    setMuted(!muted);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareUrl = window.location.href;
  const topicGrad = space?.topic ? TOPIC_COLORS[space.topic] || TOPIC_COLORS.General : TOPIC_COLORS.General;

  // ─── OG Meta tags via document.title ───
  useEffect(() => {
    if (space) {
      document.title = `${space.title} — OG Spaces | OG Scan`;
    }
    return () => { document.title = "OG Scan"; };
  }, [space]);

  // ─── Loading state ───
  if (loading) return (
    <div className="min-h-screen bg-[#060a12] flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
    </div>
  );

  // ─── Error state ───
  if (error || !space) return (
    <div className="min-h-screen bg-[#060a12] flex flex-col items-center justify-center gap-4 px-4">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
        <Mic className="h-8 w-8 text-white/20" />
      </div>
      <h1 className="text-xl font-bold text-white">Space Not Found</h1>
      <p className="text-sm text-white/40 text-center max-w-sm">This space may have been removed or the link is invalid.</p>
      <Link to="/" className="mt-2 px-5 py-2.5 rounded-xl bg-blue-500/15 text-blue-400 text-sm font-bold border border-blue-500/25 hover:bg-blue-500/25 transition-all">
        Go to OG Scan
      </Link>
    </div>
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasRecording = !!space.recording_url;

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      {/* Hidden audio element */}
      {hasRecording && (
        <audio ref={audioRef} src={space.recording_url!} preload="metadata" />
      )}

      {/* ─── Background effects ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-cyan-500/3 rounded-full blur-[100px]" />
      </div>

      {/* ─── Content ─── */}
      <div className="relative z-10 max-w-xl mx-auto px-4 py-8 sm:py-12">
        {/* Nav bar */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-bold">OG Scan</span>
          </Link>
          <button onClick={copyLink}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all",
              copied
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                : "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60"
            )}>
            {copied ? <><Copy className="h-3 w-3" /> Copied!</> : <><Share2 className="h-3 w-3" /> Share</>}
          </button>
        </div>

        {/* ─── Main Card ─── */}
        <div className={cn("rounded-3xl border overflow-hidden bg-gradient-to-br", topicGrad)}>
          {/* Top bar */}
          <div className="px-5 pt-5 pb-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
              <Radio className="h-3 w-3 text-white/40" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">OG Space</span>
            </div>
            {space.topic && (
              <span className="text-[10px] font-bold text-white/30 px-2 py-0.5 rounded-full border border-white/[0.06]">
                {space.topic}
              </span>
            )}
            <span className="ml-auto text-[10px] text-white/20">
              {space.ended_at ? "Ended" : space.is_live ? "● LIVE" : "Scheduled"}
            </span>
          </div>

          {/* Title + host */}
          <div className="px-5 pb-4">
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
              {space.title}
            </h1>
            {space.description && (
              <p className="text-sm text-white/40 leading-relaxed mb-3 line-clamp-3">{space.description}</p>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden">
                {space.host_avatar ? (
                  <img src={space.host_avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-white/30">{(space.host_name?.[0] || "H").toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white/70">{space.host_name || "Host"}</p>
                <p className="text-[10px] text-white/30">{formatDate(space.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="px-5 pb-4 flex items-center gap-4">
            {space.listener_count > 0 && (
              <div className="flex items-center gap-1.5 text-white/30">
                <Users className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">{space.listener_count} listeners</span>
              </div>
            )}
            {(space.duration_seconds || duration > 0) && (
              <div className="flex items-center gap-1.5 text-white/30">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">{formatDur(space.duration_seconds || Math.round(duration))}</span>
              </div>
            )}
          </div>

          {/* ─── Waveform ─── */}
          <div className="px-5 py-4 bg-black/20">
            <WaveformBars playing={playing} />
          </div>

          {/* ─── Player Controls ─── */}
          {hasRecording ? (
            <div className="px-5 py-5 bg-black/30">
              {/* Progress bar */}
              <div ref={progressRef} onClick={seek}
                className="h-2 rounded-full bg-white/[0.06] cursor-pointer mb-4 relative group overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                  style={{ width: `${progress}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${progress}% - 7px)` }} />
              </div>

              {/* Time labels */}
              <div className="flex justify-between text-[10px] text-white/25 font-mono mb-4">
                <span>{formatDur(Math.round(currentTime))}</span>
                <span>{formatDur(Math.round(duration))}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                {/* Volume */}
                <button onClick={toggleMute}
                  className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>

                {/* Skip back */}
                <button onClick={() => skip(-15)}
                  className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
                  <SkipBack className="h-4 w-4" />
                </button>

                {/* Play/Pause */}
                <button onClick={togglePlay}
                  className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-xl",
                    playing
                      ? "bg-white/10 border border-white/20 text-white"
                      : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white hover:shadow-blue-500/25"
                  )}>
                  {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
                </button>

                {/* Skip forward */}
                <button onClick={() => skip(15)}
                  className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
                  <SkipForward className="h-4 w-4" />
                </button>

                {/* Share */}
                <button onClick={copyLink}
                  className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            /* No recording available */
            <div className="px-5 py-8 bg-black/20 text-center">
              <Headphones className="h-8 w-8 mx-auto text-white/10 mb-2" />
              <p className="text-sm font-bold text-white/40">No recording available</p>
              <p className="text-[11px] text-white/20 mt-1">This space wasn't recorded or the recording is still processing.</p>
            </div>
          )}
        </div>

        {/* ─── CTA to join platform ─── */}
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
          <p className="text-sm font-bold text-white/50 mb-1">Want to join live spaces?</p>
          <p className="text-[11px] text-white/25 mb-4">Create an account to host or join live OG Spaces on OG Scan.</p>
          <Link to="/auth"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-black transition-all shadow-lg shadow-amber-400/10">
            <Mic className="h-4 w-4" /> Join OG Scan
            <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-white/15">OG Scan · Solana Token Intelligence · ogscan.fun</p>
        </div>
      </div>
    </div>
  );
};

export default SpaceReplay;
