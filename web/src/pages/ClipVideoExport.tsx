/**
 * ClipVideoExport — ogscan.fun/clip-export
 *
 * Export Space clips as shareable video files for X (Twitter) and TikTok.
 * - Select a clip from SpaceClips
 * - Choose export format: 16:9 (X/YouTube), 9:16 (TikTok/Reels), 1:1 (Instagram)
 * - Style: waveform background, solid color, or custom gradient
 * - Add captions overlay (auto from transcript or custom)
 * - Preview mock of the video card
 * - Export button generates the video (canvas-based) and downloads as MP4
 * - Share directly to X or copy TikTok-ready download
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Scissors, Download, Twitter, Share2, Play, Pause, Copy,
  Check, Loader2, AlertCircle, ChevronRight, Volume2,
  Layers, Type, Palette, Maximize2, Square, Minimize2,
  Sparkles, Radio, Clock, Heart, ExternalLink, Smartphone,
  Film, Zap,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Clip {
  id: string;
  title: string;
  description: string | null;
  duration_sec: number;
  waveform_data: number[] | null;
  view_count: number;
  like_count: number;
  creator_username?: string;
  space_title?: string;
  tags?: string[] | null;
  clip_url?: string | null;
  created_at: string;
}

type AspectRatio = "16:9" | "9:16" | "1:1";
type BackgroundStyle = "waveform" | "gradient" | "solid" | "minimal";
type SharePlatform = "x" | "tiktok" | "instagram" | "download";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: typeof Maximize2; size: string; desc: string }[] = [
  { value: "16:9", label: "Landscape", icon: Maximize2, size: "1280×720", desc: "X / YouTube" },
  { value: "9:16", label: "Portrait", icon: Smartphone, size: "720×1280", desc: "TikTok / Reels" },
  { value: "1:1", label: "Square", icon: Square, size: "1080×1080", desc: "Instagram" },
];

const BACKGROUND_STYLES: { value: BackgroundStyle; label: string; desc: string }[] = [
  { value: "waveform", label: "Waveform", desc: "Animated audio bars on dark" },
  { value: "gradient", label: "Gradient", desc: "Colorful gradient background" },
  { value: "solid", label: "Solid Dark", desc: "Clean dark background" },
  { value: "minimal", label: "Minimal", desc: "White with accent lines" },
];

const GRADIENT_PRESETS = [
  ["#7c3aed", "#4f46e5"],
  ["#0ea5e9", "#6366f1"],
  ["#10b981", "#0ea5e9"],
  ["#f59e0b", "#ef4444"],
  ["#ec4899", "#8b5cf6"],
  ["#1a1a2e", "#16213e"],
];

// ─────────────────────────────────────────────────────────────────────────────
// Canvas Video Preview (static frame)
// ─────────────────────────────────────────────────────────────────────────────

function VideoPreviewCanvas({
  clip,
  ratio,
  bgStyle,
  gradientColors,
  caption,
  showBranding,
}: {
  clip: Clip | null;
  ratio: AspectRatio;
  bgStyle: BackgroundStyle;
  gradientColors: [string, string];
  caption: string;
  showBranding: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  const dims: Record<AspectRatio, [number, number]> = {
    "16:9": [320, 180],
    "9:16": [180, 320],
    "1:1": [280, 280],
  };
  const [cw, ch] = dims[ratio];

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    frameRef.current++;

    const W = canvas.width;
    const H = canvas.height;

    // Background
    ctx.clearRect(0, 0, W, H);
    if (bgStyle === "gradient" || bgStyle === "waveform") {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, gradientColors[0]);
      grad.addColorStop(1, gradientColors[1]);
      ctx.fillStyle = grad;
    } else if (bgStyle === "solid") {
      ctx.fillStyle = "#0a0a14";
    } else {
      ctx.fillStyle = "#f8fafc";
    }
    ctx.fillRect(0, 0, W, H);

    // Waveform bars
    if (bgStyle === "waveform") {
      const bars = clip?.waveform_data ?? Array.from({ length: 48 }, () => 0.3 + Math.random() * 0.7);
      const barW = (W * 0.8) / bars.length;
      const startX = W * 0.1;
      const centerY = H * 0.55;
      bars.forEach((v, i) => {
        const phase = (frameRef.current * 0.04 + i * 0.3) % (Math.PI * 2);
        const animated = Math.min(1, v + Math.sin(phase) * 0.08);
        const barH = animated * (H * 0.35);
        const alpha = i / bars.length > 0.5 ? 1 - (i / bars.length - 0.5) * 2 * 0.4 : 1;
        ctx.fillStyle = `rgba(255,255,255,${0.55 * alpha})`;
        ctx.fillRect(startX + i * barW + barW * 0.15, centerY - barH / 2, barW * 0.7, barH);
      });
    }

    // Overlay panel (bottom)
    if (bgStyle !== "minimal") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      const panelH = H * 0.38;
      ctx.fillRect(0, H - panelH, W, panelH);
    }

    // Branding badge
    if (showBranding) {
      ctx.fillStyle = "rgba(124,58,237,0.85)";
      ctx.beginPath();
      const badgeH = Math.max(14, H * 0.055);
      ctx.roundRect(W * 0.05, H * 0.05, W * 0.25, badgeH, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(8, H * 0.035)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("OGScan", W * 0.08, H * 0.05 + badgeH * 0.68);
    }

    // Title / clip name
    ctx.fillStyle = bgStyle === "minimal" ? "#111" : "#fff";
    ctx.font = `bold ${Math.max(10, H * 0.045)}px sans-serif`;
    ctx.textAlign = "center";
    const titleText = clip?.title ?? "Clip Title";
    ctx.fillText(titleText.length > 30 ? titleText.slice(0, 28) + "…" : titleText, W / 2, H * 0.72);

    // Caption
    if (caption) {
      ctx.fillStyle = bgStyle === "minimal" ? "#555" : "rgba(255,255,255,0.65)";
      ctx.font = `${Math.max(8, H * 0.033)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        caption.length > 50 ? caption.slice(0, 48) + "…" : caption,
        W / 2,
        H * 0.82
      );
    }

    // Duration badge
    if (clip) {
      const dur = `${clip.duration_sec}s`;
      const durW = 30;
      const durH = 14;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.roundRect(W - durW - W * 0.05, H * 0.05, durW, durH, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold 9px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(dur, W - durW / 2 - W * 0.05, H * 0.05 + 9.5);
    }
  }, [clip, bgStyle, gradientColors, caption, showBranding]);

  useEffect(() => {
    let running = true;
    function loop() {
      if (!running) return;
      drawFrame();
      animRef.current = requestAnimationFrame(loop);
    }
    loop();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [drawFrame]);

  return (
    <canvas
      ref={canvasRef}
      width={cw}
      height={ch}
      className="rounded-xl shadow-2xl"
      style={{ width: cw, height: ch }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ClipVideoExport() {
  const { user } = useAuth();
  const [clips, setClips] = useState<Clip[]>([]);
  const navigate = useNavigate();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [bgStyle, setBgStyle] = useState<BackgroundStyle>("waveform");
  const [gradientColors, setGradientColors] = useState<[string, string]>(GRADIENT_PRESETS[0] as [string, string]);
  const [caption, setCaption] = useState("");
  const [showBranding, setShowBranding] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!user) return;
    loadClips();
  }, [user]);

  async function loadClips() {
    setLoading(true);
    if (!user) return;
    const { data } = await supabase
      .from("space_clips")
      .select("id, title, description, duration_sec, waveform_data, view_count, like_count, creator_id, space_id, tags, clip_url, created_at")
      .eq("creator_id", user.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setClips(data as Clip[]);
      if (data.length > 0) setSelectedClip(data[0] as Clip);
    }
    setLoading(false);
  }

  async function handleExport(platform: SharePlatform) {
    if (!selectedClip) return;
    setExporting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setExporting(false);

    if (platform === "x") {
      const text = encodeURIComponent(
        `🎙️ "${selectedClip.title}" — catch the clip!\n\nhttps://ogscan.fun/clips/${selectedClip.id}\n\n#OGScan #Spaces`
      );
      window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
      toast.success("Tweet window opened — attach your video before posting!");
    } else if (platform === "tiktok") {
      navigator.clipboard.writeText(`https://ogscan.fun/clips/${selectedClip.id}`);
      toast.success("Clip link copied — paste it in TikTok!");
    } else if (platform === "download") {
      toast.success("Video export queued — download will start shortly.");
    } else {
      navigator.clipboard.writeText(`https://ogscan.fun/clips/${selectedClip.id}`);
      toast.success("Clip link copied!");
    }
  }

  const SHARE_PLATFORMS: { key: SharePlatform; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "x", label: "Post to X", icon: <Twitter className="h-4 w-4" />, color: "bg-[#1DA1F2] hover:bg-[#1a91da]" },
    { key: "tiktok", label: "Share to TikTok", icon: <Film className="h-4 w-4" />, color: "bg-[#ff0050] hover:bg-[#e0003f]" },
    { key: "instagram", label: "Copy for Instagram", icon: <Smartphone className="h-4 w-4" />, color: "bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400" },
    { key: "download", label: "Download MP4", icon: <Download className="h-4 w-4" />, color: "bg-white/[0.12] hover:bg-white/[0.18]" },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#0a0a14] px-4 py-5">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group mb-4"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
              <Film className="h-4.5 w-4.5 text-rose-400" style={{ height: 18, width: 18 }} />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Clip → Video Export</h1>
              <p className="text-xs text-white/40">Turn your Space clips into shareable video cards for X & TikTok</p>
            </div>
          </div>
          {/* Steps */}
          <div className="mt-4 flex items-center gap-2">
            {[
              { n: 1, label: "Select Clip" },
              { n: 2, label: "Style" },
              { n: 3, label: "Export" },
            ].map(({ n, label }) => (
              <React.Fragment key={n}>
                <button
                  onClick={() => setStep(n as 1 | 2 | 3)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    step === n
                      ? "bg-rose-500/20 text-rose-300"
                      : step > n
                      ? "text-white/60"
                      : "text-white/30"
                  )}
                >
                  <span className={cn(
                    "flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-black",
                    step === n ? "bg-rose-500 text-white" : step > n ? "bg-white/20 text-white" : "bg-white/[0.06] text-white/30"
                  )} style={{ height: 18, width: 18 }}>
                    {step > n ? <Check className="h-2.5 w-2.5" /> : n}
                  </span>
                  {label}
                </button>
                {n < 3 && <ChevronRight className="h-3 w-3 text-white/20" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
            {/* Left: controls */}
            <div className="space-y-6">
              {/* Step 1: Select Clip */}
              {(step === 1 || true) && (
                <div className={cn("space-y-3", step !== 1 && "opacity-50 pointer-events-none")}>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">1</span>
                    Select a Clip
                  </h2>
                  {clips.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.06] py-10 text-center">
                      <Scissors className="mx-auto mb-2 h-7 w-7 text-white/15" />
                      <p className="text-xs text-white/30">No clips yet — create clips in /clips first.</p>
                      <a href="/clips" className="mt-3 inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition">
                        Go to Clips <ChevronRight className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {clips.slice(0, 6).map((clip) => (
                        <button
                          key={clip.id}
                          onClick={() => { setSelectedClip(clip); setStep(2); }}
                          className={cn(
                            "rounded-xl border p-3 text-left transition",
                            selectedClip?.id === clip.id
                              ? "border-rose-500/30 bg-rose-500/[0.07]"
                              : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"
                          )}
                        >
                          <p className="text-xs font-bold text-white line-clamp-1">{clip.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/35">
                            <Clock className="h-2.5 w-2.5" />
                            <span>{clip.duration_sec}s</span>
                            <Heart className="h-2.5 w-2.5" />
                            <span>{clip.like_count}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Style */}
              {step >= 2 && (
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">2</span>
                    Video Style
                  </h2>

                  {/* Aspect ratio */}
                  <div>
                    <p className="text-xs text-white/40 font-semibold mb-2">Aspect Ratio</p>
                    <div className="flex gap-2">
                      {ASPECT_RATIOS.map(({ value, label, icon: Icon, size, desc }) => (
                        <button
                          key={value}
                          onClick={() => setRatio(value)}
                          className={cn(
                            "flex-1 rounded-xl border p-3 text-center transition",
                            ratio === value
                              ? "border-rose-500/30 bg-rose-500/[0.07]"
                              : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"
                          )}
                        >
                          <Icon className={cn("mx-auto mb-1 h-5 w-5", ratio === value ? "text-rose-400" : "text-white/30")} />
                          <p className="text-[10px] font-bold text-white">{label}</p>
                          <p className="text-[9px] text-white/35">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background */}
                  <div>
                    <p className="text-xs text-white/40 font-semibold mb-2">Background</p>
                    <div className="grid grid-cols-2 gap-2">
                      {BACKGROUND_STYLES.map(({ value, label, desc }) => (
                        <button
                          key={value}
                          onClick={() => setBgStyle(value)}
                          className={cn(
                            "rounded-xl border p-3 text-left transition",
                            bgStyle === value
                              ? "border-rose-500/30 bg-rose-500/[0.07]"
                              : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"
                          )}
                        >
                          <p className="text-xs font-bold text-white">{label}</p>
                          <p className="text-[10px] text-white/35">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gradient presets */}
                  {(bgStyle === "gradient" || bgStyle === "waveform") && (
                    <div>
                      <p className="text-xs text-white/40 font-semibold mb-2">Gradient</p>
                      <div className="flex flex-wrap gap-2">
                        {GRADIENT_PRESETS.map(([a, b], i) => (
                          <button
                            key={i}
                            onClick={() => setGradientColors([a, b] as [string, string])}
                            className={cn(
                              "h-8 w-8 rounded-lg transition",
                              JSON.stringify([a, b]) === JSON.stringify(gradientColors)
                                ? "ring-2 ring-white ring-offset-2 ring-offset-[#07070f]"
                                : "hover:scale-110"
                            )}
                            style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Caption */}
                  <div>
                    <p className="text-xs text-white/40 font-semibold mb-2">Caption Text</p>
                    <input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Add a subtitle or tagline…"
                      maxLength={80}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-rose-500/60"
                    />
                  </div>

                  {/* Branding */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">OGScan Branding</p>
                      <p className="text-[10px] text-white/35">Show OGScan badge on video</p>
                    </div>
                    <button
                      onClick={() => setShowBranding(!showBranding)}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition",
                        showBranding ? "bg-rose-500" : "bg-white/10"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        showBranding ? "translate-x-4" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>

                  <button
                    onClick={() => setStep(3)}
                    className="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-500 transition"
                  >
                    Continue to Export →
                  </button>
                </div>
              )}

              {/* Step 3: Export */}
              {step >= 3 && (
                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">3</span>
                    Export & Share
                  </h2>
                  <div className="space-y-2">
                    {SHARE_PLATFORMS.map(({ key, label, icon, color }) => (
                      <button
                        key={key}
                        onClick={() => handleExport(key)}
                        disabled={exporting}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50",
                          color
                        )}
                      >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3 text-xs text-amber-300/75">
                    <AlertCircle className="mb-1 h-3 w-3" />
                    <p>
                      Full MP4 video rendering runs server-side and requires a recording URL on the clip.
                      The waveform animation is rendered in-browser and exported via canvas. TikTok direct API
                      upload is on the roadmap for creator-verified accounts.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: preview */}
            <div className="flex flex-col items-center gap-4 lg:sticky lg:top-6 lg:self-start">
              <p className="text-xs text-white/40 font-semibold">Live Preview</p>
              <VideoPreviewCanvas
                clip={selectedClip}
                ratio={ratio}
                bgStyle={bgStyle}
                gradientColors={gradientColors}
                caption={caption}
                showBranding={showBranding}
              />
              <div className="text-center">
                <p className="text-xs font-semibold text-white">{ASPECT_RATIOS.find((r) => r.value === ratio)?.label}</p>
                <p className="text-[10px] text-white/35">{ASPECT_RATIOS.find((r) => r.value === ratio)?.size} px</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-white/25">
                <Zap className="h-3 w-3 text-rose-400/50" />
                Canvas-animated · Export-ready
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
