/**
 * MobileApp — ogscan.fun/mobile-app
 *
 * Feature 16: Native Mobile App landing page for iOS & Android.
 * - App feature highlights: background audio, home screen widget,
 *   Siri/Google Assistant integration, CarPlay support
 * - Beta waitlist signup
 * - QR code to TestFlight / Play Beta
 * - Simulated phone mockup UI
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Smartphone, Apple, Music, Bell, Mic2, Car, Star, Zap, ArrowLeft,
  CheckCircle2, ArrowRight, Loader2, Mail, Globe, Play,
  Volume2, Home, MessageSquare, Radio, Sparkles, ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// ─── Android-style Play icon inline ──────────────────────────────────────────
function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3.18 23.77 15.5 12 3.18.23C2.78.52 2.5 1 2.5 1.56v20.88c0 .56.28 1.04.68 1.33zm18.04-9.78-3.29-1.87-3.7 3.7 3.7 3.7 3.3-1.87a1.98 1.98 0 0 0 0-3.66zM4.28 23.12l11.08-6.3-3.12-3.12-7.96 9.42zM15.36 7.18 4.28.88l7.96 9.42 3.12-3.12z"/>
    </svg>
  );
}

// ─── Feature cards ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Volume2,
    title: "Background Audio",
    desc: "Keep listening to spaces with your screen off or while using other apps. Seamless background playback.",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Home,
    title: "Home Screen Widget",
    desc: "Live listener count, currently playing space, and one-tap join — right from your home screen.",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  {
    icon: Mic2,
    title: "Siri & Google Assistant",
    desc: '"Hey Siri, open the latest crypto space on OGScan" — voice shortcuts to tune in instantly.',
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Car,
    title: "CarPlay & Android Auto",
    desc: "Listen to trending spaces hands-free while driving. Full CarPlay and Android Auto support.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Bell,
    title: "Push Notifications",
    desc: "Instant alerts when a space you follow goes live, 15-min reminders, and direct message pings.",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
  {
    icon: Sparkles,
    title: "Native Performance",
    desc: "Built with React Native (Expo). 60fps animations, haptic feedback, and offline caching of clips.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
];

// ─── Phone mockup content ─────────────────────────────────────────────────────
function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 220 }}>
      {/* Outer frame */}
      <div className="relative rounded-[32px] border-2 border-white/20 bg-[#0d0d1a] shadow-2xl overflow-hidden" style={{ width: 220, height: 440 }}>
        {/* Notch */}
        <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-4 w-20 rounded-full bg-black z-10" />
        {/* Screen */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d1a] to-[#07070f] flex flex-col">
          {/* Status bar */}
          <div className="flex justify-between px-6 pt-8 pb-2">
            <span className="text-[9px] font-bold text-white/60">9:41</span>
            <div className="flex gap-1 items-center">
              <div className="h-1.5 w-3 rounded-sm bg-white/50" />
              <div className="h-1.5 w-1 rounded-sm bg-white/50" />
              <div className="h-1.5 w-4 rounded-sm bg-white/70" />
            </div>
          </div>
          {/* App bar */}
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-[11px] font-black text-white">OGScan</span>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20">
              <Bell className="h-2.5 w-2.5 text-violet-400" />
            </div>
          </div>
          {/* Live now card */}
          <div className="mx-3 rounded-xl bg-gradient-to-br from-violet-600/40 to-indigo-600/30 border border-violet-500/30 p-3 mb-2">
            <div className="flex items-center gap-1 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] font-bold text-emerald-400">LIVE NOW</span>
            </div>
            <p className="text-[10px] font-black text-white leading-tight">Crypto Bull Run</p>
            <p className="text-[8px] text-white/45 mb-2">@cryptoking · 1.2k listeners</p>
            <div className="flex gap-1">
              <div className="flex-1 h-4 rounded bg-white/20 flex items-center justify-center">
                <Play className="h-2 w-2 text-white" />
              </div>
              <div className="h-4 w-8 rounded bg-white/10" />
            </div>
          </div>
          {/* Trending */}
          <div className="px-3">
            <p className="text-[8px] font-bold text-white/35 mb-1.5">TRENDING</p>
            {["DeFi Deep Dive", "NFT Market Update", "Layer 2 Chat"].map((title, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 mb-1">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500/40 to-sky-500/40 shrink-0" />
                <div>
                  <p className="text-[8px] font-bold text-white">{title}</p>
                  <p className="text-[7px] text-white/35">{[342, 891, 210][i]} listeners</p>
                </div>
              </div>
            ))}
          </div>
          {/* Bottom nav */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-around border-t border-white/[0.07] bg-[#0a0a14] py-2 px-2">
            {[Home, Radio, Sparkles, Bell, Smartphone].map((Icon, i) => (
              <div key={i} className={cn("flex flex-col items-center gap-0.5", i === 0 ? "text-violet-400" : "text-white/25")}>
                <Icon className="h-3 w-3" />
                <div className={cn("h-0.5 w-0.5 rounded-full", i === 0 ? "bg-violet-400" : "bg-transparent")} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Glow */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 h-12 w-32 rounded-full bg-violet-600/20 blur-xl" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MobileApp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<"ios" | "android" | "both">("both");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setJoining(true);
    try {
      const { error } = await supabase.from("mobile_beta_waitlist").upsert({
        email: email.toLowerCase().trim(),
        platform,
        created_at: new Date().toISOString(),
      });
      if (error && error.code !== "23505") throw error;
      setJoined(true);
      toast.success("You're on the list! We'll notify you when the beta launches.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setJoining(false);
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-hidden">
      <Toaster position="top-right" />

      {/* Back button */}
      <div className="px-4 pt-4 pb-0 max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
      </div>
      {/* Hero */}
      <div className="relative border-b border-white/[0.06] bg-[#09091a]">
        <div className="absolute inset-0 bg-gradient-radial from-violet-900/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 py-16">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left: text */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5">
                <Smartphone className="h-3 w-3 text-violet-400" />
                <span className="text-xs font-bold text-violet-300">Coming Soon — Beta Q3 2025</span>
              </div>
              <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight">
                OGScan
                <br />
                <span className="bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">
                  Native Mobile
                </span>
              </h1>
              <p className="mb-6 text-sm text-white/50 leading-relaxed max-w-md">
                The full OGScan experience in your pocket. Background audio, home screen widgets,
                Siri/Google Assistant shortcuts, and CarPlay support — built for power listeners.
              </p>

              {/* CTA: beta waitlist */}
              {joined ? (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-5 py-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-300">You're on the beta list!</p>
                    <p className="text-xs text-emerald-300/60">We'll email you when early access opens.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-3 max-w-sm">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-9 pr-3 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={joining}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-60 transition"
                    >
                      {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {(["both", "ios", "android"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlatform(p)}
                        className={cn(
                          "flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition",
                          platform === p
                            ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                            : "border-white/[0.08] bg-white/[0.03] text-white/40 hover:border-white/15"
                        )}
                      >
                        {p === "both" ? "Both" : p === "ios" ? "iOS" : "Android"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/25">No spam. Early access invite only.</p>
                </form>
              )}

              {/* Store badges (coming soon) */}
              <div className="mt-6 flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 opacity-50">
                  <Apple className="h-5 w-5 text-white" />
                  <div>
                    <div className="text-[8px] text-white/50">Coming to</div>
                    <div className="text-xs font-bold text-white">App Store</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 opacity-50">
                  <PlayStoreIcon className="h-5 w-5 text-white" />
                  <div>
                    <div className="text-[8px] text-white/50">Coming to</div>
                    <div className="text-xs font-bold text-white">Google Play</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: phone mockup */}
            <div className="flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="mb-2 text-center text-2xl font-black text-white">Built for power listeners</h2>
        <p className="mb-8 text-center text-sm text-white/40">Everything the web app has, plus mobile-exclusive features</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className={cn("rounded-2xl border p-5", bg)}>
              <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl border", bg)}>
                <Icon className={cn("h-5 w-5", color)} />
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-white">{title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Widget preview */}
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
          <h3 className="mb-2 text-lg font-black text-white">Home Screen Widget</h3>
          <p className="mb-6 text-xs text-white/40 max-w-md mx-auto">
            Add the OGScan widget to your home screen for live space stats and one-tap join.
            Available in small (2×2) and medium (4×2) sizes.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            {/* Small widget */}
            <div className="rounded-2xl bg-gradient-to-br from-violet-800/60 to-indigo-800/50 border border-violet-500/30 p-3 w-28 h-28 flex flex-col justify-between">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] font-bold text-emerald-400">LIVE</span>
              </div>
              <div>
                <p className="text-[9px] font-black text-white leading-tight">Crypto Bull Run</p>
                <p className="text-[8px] text-white/45">1.2k listening</p>
              </div>
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-0.5 rounded-full bg-white/15 px-2 py-0.5">
                  <Play className="h-2 w-2 text-white" />
                  <span className="text-[8px] font-bold text-white">Join</span>
                </div>
              </div>
            </div>
            {/* Medium widget */}
            <div className="rounded-2xl bg-gradient-to-r from-[#0e0e20] to-[#12123a] border border-white/10 p-3 w-60 h-28 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-white">OGScan</span>
                <span className="text-[7px] text-white/30">3 spaces live</span>
              </div>
              <div className="space-y-1">
                {["Crypto Bull Run", "DeFi Deep Dive"].map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.05] px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-emerald-400" />
                      <span className="text-[8px] text-white font-semibold">{t}</span>
                    </div>
                    <span className="text-[7px] text-white/30">{[1200, 340][i]} 👂</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
