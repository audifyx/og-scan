/**
 * ArtFeed — OG Scan Meme Gallery & Media Hub
 *
 * Interactive meme gallery with reactions, fullscreen viewer, movie trailers,
 * 3D banners, and category filtering. Images are stored in /public/memes/.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tilt3D } from "@/components/banners/OGBanner3D";
import {
  ChevronLeft, ChevronRight, ImageIcon, Heart, Share2,
  Download, Maximize2, X, Play, Pause, Volume2, VolumeX,
  Flame, Trophy, Sparkles, Film, Grid3X3, LayoutList,
  Shuffle, Search, Eye, MessageSquare, Zap, Clapperboard,
  Star, ThumbsUp, Laugh, Skull, Rocket, Crown
} from "lucide-react";

// ─── Meme data ────────────────────────────────────────────────────────────────

interface Meme {
  id: number;
  src: string;
  caption: string;
  tag: string;
  category: string;
  featured?: boolean;
}

const MEMES: Meme[] = [
  { id: 1, src: "/memes/og-built-different.jpg", caption: "Deploying the future. I am built different.", tag: "Builder", category: "Dev Life", featured: true },
  { id: 2, src: "/memes/og-real-explorer.jpg", caption: "WAGMI. Ship. Code. Repeat. The real Solana explorer.", tag: "OG Dev", category: "Dev Life", featured: true },
  { id: 3, src: "/memes/og-truth-scanner.jpg", caption: "Exit liquidity is a scam. OG Scan Truth Scan exposes them all.", tag: "Truth Scan", category: "Forensics", featured: true },
  { id: 4, src: "/memes/og-forensic-matrix.jpg", caption: "Originals only. We don't guess. We forensic.", tag: "OG Detection", category: "Forensics", featured: true },
  { id: 5, src: "/memes/og-deploying-future.jpg", caption: "Deploying the future, one block at a time.", tag: "Building", category: "Dev Life" },
  { id: 6, src: "/memes/og-scan-dashboard.jpg", caption: "WAGMI. Ship. Code. Repeat.", tag: "OG Dev", category: "Dev Life" },
  { id: 7, src: "/memes/og-truth-scan.jpg", caption: "Not your keys, not your coins. Code is law.", tag: "Truth Scan", category: "Forensics" },
  { id: 8, src: "/memes/og-detection-matrix.jpg", caption: "OG Detection Matrix — True OG verified at 97.9/100.", tag: "OG Detection", category: "Forensics" },
  { id: 9, src: "/memes/og-king-throne.jpg", caption: "The Solana chain never lies. Neither do we.", tag: "On-Chain King", category: "Culture" },
  { id: 10, src: "/memes/og-rug-radar.jpg", caption: "Rugs don't sleep. Neither do we.", tag: "Rug Radar", category: "Forensics" },
  { id: 11, src: "/memes/og-wallet-profiler.jpg", caption: "Built by OGs. For OGs.", tag: "OG Dev", category: "Dev Life" },
  { id: 12, src: "/memes/og-they-dont-know.jpg", caption: "They don't know OG. We do.", tag: "Alpha", category: "Culture" },
  { id: 13, src: "/memes/og-command-deck.jpg", caption: "Solana Memecoin Forensics Command Deck.", tag: "Command Deck", category: "Dev Life" },
  { id: 14, src: "/memes/og-clone-buyer.jpg", caption: "Clone buyer gets rekt. OG Scan user finds the gem.", tag: "True OG", category: "Culture" },
  { id: 15, src: "/memes/og-diamond-hands.jpg", caption: "Diamond hands verified. Never selling.", tag: "HODL", category: "Trading" },
  { id: 16, src: "/memes/og-whale-watcher.jpg", caption: "Whale spotted. Following the smart money.", tag: "Whale Watch", category: "Trading" },
  { id: 17, src: "/memes/og-rug-pull-detector.jpg", caption: "RUG PULL DETECTED. Trust no dev.", tag: "Rug Alert", category: "Forensics" },
  { id: 18, src: "/memes/og-alpha-hunter.jpg", caption: "Alpha located. Night vision activated.", tag: "Alpha", category: "Trading" },
  { id: 19, src: "/memes/og-fud-immune.jpg", caption: "FUD is temporary. On-chain data is forever.", tag: "FUD Immune", category: "Culture" },
  { id: 20, src: "/memes/og-degen-hours.jpg", caption: "3:47 AM. Sleep is for normies. One more trade.", tag: "Degen", category: "Dev Life" },
  { id: 21, src: "/memes/og-chain-detective.jpg", caption: "Following the trail. Every transaction tells a story.", tag: "Detective", category: "Forensics" },
  { id: 22, src: "/memes/og-mint-sniper.jpg", caption: "First. Always. Sniping new mints.", tag: "Sniper", category: "Trading" },
  { id: 23, src: "/memes/og-paper-hands-rekt.jpg", caption: "Paper hands get rekt. OG hands never fold.", tag: "Rekt", category: "Trading" },
  { id: 24, src: "/memes/og-gas-optimizer.jpg", caption: "Gas fees irrelevant. Solana speed is unmatched.", tag: "Speed", category: "Dev Life" },
  { id: 25, src: "/memes/og-liquidity-king.jpg", caption: "Sitting on the liquidity throne.", tag: "LP King", category: "Trading" },
  { id: 26, src: "/memes/og-scan-prophecy.jpg", caption: "The scan never lies. Oracle of the chain.", tag: "Prophet", category: "Culture" },
  { id: 27, src: "/memes/og-token-archaeologist.jpg", caption: "Finding the true OG. Digging through the blockchain.", tag: "Archaeology", category: "Forensics" },
  { id: 28, src: "/memes/og-solana-speed.jpg", caption: "65,000 TPS. 400ms confirmations. Solana speed.", tag: "Speed", category: "Dev Life" },
  { id: 29, src: "/memes/og-insider-detector.jpg", caption: "Insiders exposed. Every wallet leaves a trace.", tag: "Insider", category: "Forensics" },
  { id: 30, src: "/memes/og-community-chad.jpg", caption: "Community built different. Together we're unstoppable.", tag: "Community", category: "Culture" },
  { id: 31, src: "/memes/og-no-sleep-dev.jpg", caption: "2,847 commits. Shipping never stops.", tag: "Builder", category: "Dev Life" },
  { id: 32, src: "/memes/og-airdrop-farmer.jpg", caption: "Farming season. Airdrops incoming.", tag: "Airdrop", category: "Trading" },
  { id: 33, src: "/memes/og-memecoin-radar.jpg", caption: "Memecoin radar active. All blips tracked.", tag: "Radar", category: "Trading" },
  { id: 34, src: "/memes/og-ngmi-vs-wagmi.jpg", caption: "NGMI without research. WAGMI with OG Scan.", tag: "WAGMI", category: "Culture" },
  { id: 35, src: "/memes/og-blockchain-samurai.jpg", caption: "Cutting through the rugs. Blockchain samurai.", tag: "Samurai", category: "Culture" },
  { id: 36, src: "/memes/og-morning-ritual.jpg", caption: "The morning ritual. OG Scan before coffee.", tag: "Ritual", category: "Dev Life" },
  { id: 37, src: "/memes/og-wallet-tracker.jpg", caption: "Every wallet tells a story. We read them all.", tag: "Tracker", category: "Forensics" },
  { id: 38, src: "/memes/og-cope-room.jpg", caption: "From cope to hope. New gem found.", tag: "Cope", category: "Culture" },
  { id: 39, src: "/memes/og-mev-hunter.jpg", caption: "MEV hunter. Tracking the bots.", tag: "MEV", category: "Trading" },
  { id: 40, src: "/memes/og-genesis-block.jpg", caption: "Since genesis. OG from block zero.", tag: "Genesis", category: "Culture" },
  { id: 41, src: "/memes/og-portfolio-grief.jpg", caption: "Five stages of portfolio grief. We've all been there.", tag: "Grief", category: "Culture" },
  { id: 42, src: "/memes/og-onchain-proof.jpg", caption: "On-chain proof. The blockchain is the judge.", tag: "Proof", category: "Forensics" },
  { id: 43, src: "/memes/og-based-department.jpg", caption: "Hello? Based department? We found the OG.", tag: "Based", category: "Culture" },
  { id: 44, src: "/memes/og-exit-liquidity.jpg", caption: "Not my exit liquidity. OG Scan warned me first.", tag: "Exit Liq", category: "Trading" },
];

const CATEGORIES = ["All", "Dev Life", "Forensics", "Trading", "Culture"];

const REACTIONS = [
  { icon: ThumbsUp, label: "Based", key: "based" },
  { icon: Laugh, label: "LMAO", key: "lmao" },
  { icon: Skull, label: "Dead", key: "dead" },
  { icon: Rocket, label: "Moon", key: "moon" },
  { icon: Crown, label: "King", key: "king" },
];

// ─── OG Scan Movie Trailers ──────────────────────────────────────────────────

interface Trailer {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  duration: string;
  videoUrl: string;
  badge: string;
  views: string;
}

const TRAILERS: Trailer[] = [
  {
    id: "tr-1",
    title: "OG SCAN: Origins",
    subtitle: "The story of how on-chain forensics changed Solana forever.",
    thumbnail: "/memes/og-forensic-matrix.jpg",
    duration: "2:34",
    videoUrl: "#",
    badge: "PREMIERE",
    views: "24K",
  },
  {
    id: "tr-2",
    title: "The Rug Pull Chronicles",
    subtitle: "True stories of rugs detected and degens saved by OG Scan.",
    thumbnail: "/memes/og-truth-scanner.jpg",
    duration: "3:12",
    videoUrl: "#",
    badge: "NEW",
    views: "18K",
  },
  {
    id: "tr-3",
    title: "Built Different: Dev Diaries",
    subtitle: "Behind the scenes of building the ultimate chain forensics tool.",
    thumbnail: "/memes/og-built-different.jpg",
    duration: "1:58",
    videoUrl: "#",
    badge: "EXCLUSIVE",
    views: "31K",
  },
  {
    id: "tr-4",
    title: "Clone Wars: The OG Battle",
    subtitle: "How OG Scan's detection matrix separates real from fake.",
    thumbnail: "/memes/og-detection-matrix.jpg",
    duration: "2:45",
    videoUrl: "#",
    badge: "COMING SOON",
    views: "12K",
  },
];

// ─── Frame accent colours ─────────────────────────────────────────────────────

const FRAME_STYLES = [
  { border: "border-[#22d3ee]/30", glow: "shadow-[0_0_20px_rgba(34,211,238,0.1)]", accent: "#22d3ee" },
  { border: "border-[#a855f7]/30", glow: "shadow-[0_0_20px_rgba(168,85,247,0.1)]", accent: "#a855f7" },
  { border: "border-[#eab308]/25", glow: "shadow-[0_0_20px_rgba(234,179,8,0.08)]", accent: "#eab308" },
  { border: "border-[#f97316]/25", glow: "shadow-[0_0_20px_rgba(249,115,22,0.08)]", accent: "#f97316" },
  { border: "border-[#84cc16]/25", glow: "shadow-[0_0_20px_rgba(132,204,22,0.08)]", accent: "#84cc16" },
];

// ─── Reaction Store (local) ───────────────────────────────────────────────────

const useReactions = () => {
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [userReactions, setUserReactions] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem("og-meme-reactions");
    const savedUser = localStorage.getItem("og-meme-user-reactions");
    if (saved) setReactions(JSON.parse(saved));
    if (savedUser) setUserReactions(JSON.parse(savedUser));
  }, []);

  const react = useCallback((memeId: number, reactionKey: string) => {
    setReactions(prev => {
      const key = String(memeId);
      const cur = prev[key] || {};
      const updated = { ...prev, [key]: { ...cur, [reactionKey]: (cur[reactionKey] || 0) + 1 } };
      localStorage.setItem("og-meme-reactions", JSON.stringify(updated));
      return updated;
    });
    setUserReactions(prev => {
      const updated = { ...prev, [String(memeId)]: reactionKey };
      localStorage.setItem("og-meme-user-reactions", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getReactions = useCallback((memeId: number) => reactions[String(memeId)] || {}, [reactions]);
  const getUserReaction = useCallback((memeId: number) => userReactions[String(memeId)] || null, [userReactions]);

  return { react, getReactions, getUserReaction };
};

// ─── Fullscreen Modal ─────────────────────────────────────────────────────────

const FullscreenModal = ({
  meme,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  reactions,
}: {
  meme: Meme;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  reactions: ReturnType<typeof useReactions>;
}) => {
  const memeReactions = reactions.getReactions(meme.id);
  const userReaction = reactions.getUserReaction(meme.id);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Badge className="text-[10px] bg-white/5 text-white/60 border-white/10">{meme.tag}</Badge>
          <span className="text-xs text-white/40">{meme.category}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = meme.src;
              a.download = meme.src.split("/").pop() || "meme.jpg";
              a.click();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.06] transition"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center relative px-4 py-4 overflow-hidden">
        {hasPrev && (
          <button
            onClick={onPrev}
            className="absolute left-4 z-10 h-12 w-12 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <img
          src={meme.src}
          alt={meme.caption}
          className="max-w-full max-h-full object-contain rounded-xl"
          draggable={false}
        />
        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-4 z-10 h-12 w-12 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Bottom bar — reactions + caption */}
      <div className="px-4 py-4 border-t border-white/5">
        <p className="text-sm text-white/70 italic text-center mb-3">"{meme.caption}"</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {REACTIONS.map(r => {
            const count = memeReactions[r.key] || 0;
            const isActive = userReaction === r.key;
            return (
              <button
                key={r.key}
                onClick={() => reactions.react(meme.id, r.key)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all
                  ${isActive
                    ? "bg-[#22d3ee]/15 border-[#22d3ee]/30 text-[#22d3ee] scale-105"
                    : "bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.08] hover:text-white/70"
                  }
                `}
              >
                <r.icon className="h-3.5 w-3.5" />
                {r.label}
                {count > 0 && <span className="text-[10px] opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Meme Card (Grid) ─────────────────────────────────────────────────────────

const MemeGridCard = ({
  meme,
  index,
  onOpen,
  reactions,
}: {
  meme: Meme;
  index: number;
  onOpen: () => void;
  reactions: ReturnType<typeof useReactions>;
}) => {
  const frame = FRAME_STYLES[index % FRAME_STYLES.length];
  const memeReactions = reactions.getReactions(meme.id);
  const userReaction = reactions.getUserReaction(meme.id);
  const totalReactions = Object.values(memeReactions).reduce((a, b) => a + b, 0);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="break-inside-avoid mb-4 sm:mb-5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`
          relative rounded-2xl border-2 overflow-hidden
          bg-[#070d14]/80 backdrop-blur cursor-pointer
          ${frame.border} ${frame.glow}
          transition-all duration-300
          ${hovered ? "scale-[1.02] shadow-lg" : ""}
        `}
        onClick={onOpen}
      >
        {/* Featured badge */}
        {meme.featured && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30 text-[9px] font-bold gap-1">
              <Star className="h-2.5 w-2.5 fill-current" /> FEATURED
            </Badge>
          </div>
        )}

        {/* Top label */}
        <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5">
          <span className="text-[10px] font-bold tracking-widest text-white/30 uppercase">OG SCAN</span>
          <Badge className="text-[9px] px-2 py-0 h-4 bg-white/5 text-white/50 border-white/10 font-bold tracking-wide uppercase">
            {meme.tag}
          </Badge>
        </div>

        {/* Image */}
        <div className="relative overflow-hidden bg-black group">
          <img
            src={meme.src}
            alt={meme.caption}
            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />

          {/* Hover overlay */}
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                <Maximize2 className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Caption */}
        <div className="px-4 py-3 bg-[#050a10]/60">
          <p className="text-xs text-white/70 leading-relaxed font-light tracking-wide italic">
            "{meme.caption}"
          </p>
        </div>

        {/* Reactions bar */}
        <div className="px-3 py-2.5 bg-[#050a10]/40 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {REACTIONS.slice(0, 3).map(r => {
              const count = memeReactions[r.key] || 0;
              const isActive = userReaction === r.key;
              return (
                <button
                  key={r.key}
                  onClick={(e) => { e.stopPropagation(); reactions.react(meme.id, r.key); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                    isActive ? "bg-[#22d3ee]/15 text-[#22d3ee]" : "text-white/30 hover:text-white/60 hover:bg-white/5"
                  }`}
                >
                  <r.icon className="h-3 w-3" />
                  {count > 0 && count}
                </button>
              );
            })}
          </div>
          {totalReactions > 0 && (
            <span className="text-[10px] text-white/25 font-medium">{totalReactions} reactions</span>
          )}
        </div>

        {/* Bottom accent line */}
        <div
          className="h-[2px] w-full opacity-40"
          style={{
            background: `linear-gradient(to right, transparent, ${frame.accent}80, transparent)`,
          }}
        />
      </div>
    </div>
  );
};

// ─── Scrollable Slider ────────────────────────────────────────────────────────

const MemeSlider = ({ memes, onOpen, reactions }: { memes: Meme[]; onOpen: (idx: number) => void; reactions: ReturnType<typeof useReactions> }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const snapTo = useCallback((idx: number) => {
    const el = trackRef.current;
    if (!el) return;
    const CARD_W = window.innerWidth < 640 ? 288 + 16 : 320 + 20;
    el.scrollTo({ left: idx * CARD_W, behavior: "smooth" });
    setActiveIdx(idx);
  }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const CARD_W = window.innerWidth < 640 ? 288 + 16 : 320 + 20;
    setActiveIdx(Math.min(Math.max(Math.round(el.scrollLeft / CARD_W), 0), memes.length - 1));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-[#070d14] to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-[#070d14] to-transparent pointer-events-none" />
        <div
          ref={trackRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth px-12 pb-4 cursor-grab select-none"
          onScroll={onScroll}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {memes.map((meme, i) => {
            const frame = FRAME_STYLES[i % FRAME_STYLES.length];
            return (
              <div
                key={meme.id}
                className={`
                  relative flex-shrink-0 w-72 sm:w-80
                  rounded-2xl border-2 ${frame.border} ${frame.glow}
                  bg-[#070d14]/80 backdrop-blur overflow-hidden cursor-pointer
                  transition-all duration-500
                  ${i === activeIdx ? "scale-100 opacity-100" : "scale-95 opacity-60"}
                `}
                onClick={() => onOpen(i)}
              >
                {meme.featured && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30 text-[9px] font-bold gap-1">
                      <Star className="h-2.5 w-2.5 fill-current" /> FEATURED
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5">
                  <span className="text-[10px] font-bold tracking-widest text-white/30 uppercase">OG SCAN</span>
                  <Badge className="text-[9px] px-2 py-0 h-4 bg-white/5 text-white/50 border-white/10">{meme.tag}</Badge>
                </div>
                <div className="relative aspect-square overflow-hidden bg-black">
                  <img src={meme.src} alt={meme.caption} className="w-full h-full object-cover" loading="lazy" draggable={false} />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
                </div>
                <div className="px-4 py-3 bg-[#050a10]/60">
                  <p className="text-xs text-white/70 leading-relaxed font-light tracking-wide italic">"{meme.caption}"</p>
                </div>
                <div className="h-[2px] w-full opacity-40" style={{ background: `linear-gradient(to right, transparent, ${frame.accent}80, transparent)` }} />
              </div>
            );
          })}
          <div className="flex-shrink-0 w-12" />
        </div>
      </div>
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => snapTo(Math.max(0, activeIdx - 1))} disabled={activeIdx === 0} className="h-8 w-8 border-white/10 text-white/50 hover:text-white">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1">
          {memes.slice(0, 20).map((_, i) => (
            <button key={i} onClick={() => snapTo(i)} className={`rounded-full transition-all duration-300 ${i === activeIdx ? "w-5 h-2 bg-[#22d3ee]" : "w-2 h-2 bg-white/20 hover:bg-white/40"}`} />
          ))}
          {memes.length > 20 && <span className="text-[10px] text-white/20 ml-1">+{memes.length - 20}</span>}
        </div>
        <Button variant="outline" size="icon" onClick={() => snapTo(Math.min(memes.length - 1, activeIdx + 1))} disabled={activeIdx === memes.length - 1} className="h-8 w-8 border-white/10 text-white/50 hover:text-white">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-center text-sm text-white/40 italic">
        {activeIdx + 1} / {memes.length} · <span className="text-white/60">{memes[activeIdx]?.caption}</span>
      </p>
    </div>
  );
};

// ─── Trailer Card ─────────────────────────────────────────────────────────────

const TrailerCard = ({ trailer }: { trailer: Trailer }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Tilt3D intensity={6} className="flex-shrink-0 w-72 sm:w-80">
      <div
        className="relative rounded-2xl border border-white/[0.08] overflow-hidden bg-[#070d14]/90 cursor-pointer group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          <img
            src={trailer.thumbnail}
            alt={trailer.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Play button */}
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${hovered ? "opacity-100" : "opacity-70"}`}>
            <div className={`h-14 w-14 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center transition-transform duration-300 ${hovered ? "scale-110" : ""}`}>
              <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
            </div>
          </div>

          {/* Duration */}
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white/80">
            {trailer.duration}
          </div>

          {/* Badge */}
          <div className="absolute top-2 left-2">
            <Badge className="bg-[#22d3ee]/20 text-[#22d3ee] border-[#22d3ee]/30 text-[9px] font-bold">
              {trailer.badge}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-bold text-sm text-white mb-1">{trailer.title}</h3>
          <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2">{trailer.subtitle}</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1 text-[10px] text-white/30">
              <Eye className="h-3 w-3" />
              {trailer.views} views
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/30">
              <Clapperboard className="h-3 w-3" />
              OG Studios
            </div>
          </div>
        </div>
      </div>
    </Tilt3D>
  );
};

// ─── 3D Hero Banner ───────────────────────────────────────────────────────────

const ArtFeedHero = () => (
  <Tilt3D className="mx-4 lg:mx-6 mb-6" intensity={7} glareOpacity={0.15}>
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08]">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d1a] via-[#0d1b2a] to-[#0a0a14]" />
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      {/* Scanlines */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(168,85,247,0.02)_2px,rgba(168,85,247,0.02)_4px)] pointer-events-none" />
      {/* Orbs */}
      <div className="absolute top-[-30%] right-[-15%] w-[350px] h-[350px] rounded-full bg-[#22d3ee]/8 blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-30%] left-[-15%] w-[300px] h-[300px] rounded-full bg-[#a855f7]/8 blur-[100px] animate-pulse" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-[20%] left-[50%] w-[200px] h-[200px] rounded-full bg-[#eab308]/5 blur-[80px] animate-pulse" style={{ animationDelay: "3s" }} />

      <div className="relative px-6 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Logo block */}
          <div className="relative shrink-0" style={{ transform: "translateZ(40px)" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#22d3ee] to-[#a855f7] blur-3xl opacity-30 animate-pulse" />
            <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[#0d1b2a] to-[#060c13] border-2 border-[#22d3ee]/25 flex items-center justify-center shadow-2xl">
              <span className="text-4xl font-black bg-gradient-to-br from-[#22d3ee] via-white to-[#a855f7] bg-clip-text text-transparent">OG</span>
            </div>
          </div>
          <div className="text-center sm:text-left" style={{ transform: "translateZ(25px)" }}>
            <div className="flex items-center gap-3 justify-center sm:justify-start mb-2">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">OG Gallery</h2>
              <Badge className="bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/25 text-[10px]">
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                {MEMES.length} MEMES
              </Badge>
            </div>
            <p className="text-sm text-[#22d3ee]/60 font-semibold tracking-widest uppercase mb-2">
              The memes that built the movement
            </p>
            <p className="text-xs text-white/35 max-w-md leading-relaxed">
              Curated memes, movie trailers, and art from the OG Scan universe. React, share, and collect.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#a855f7]/40 to-transparent" />
    </div>
  </Tilt3D>
);

// ─── 3D Promo Banners sprinkled across ────────────────────────────────────────

const PromoBanner1 = () => (
  <Tilt3D className="mb-5" intensity={5}>
    <div className="relative overflow-hidden rounded-2xl border border-[#22d3ee]/15 bg-gradient-to-r from-[#22d3ee]/8 via-[#060c13] to-[#a855f7]/8">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(34,211,238,0.015)_3px,rgba(34,211,238,0.015)_6px)] pointer-events-none" />
      <div className="absolute right-0 top-0 w-[200px] h-full rounded-full blur-[80px] bg-[#22d3ee]/8" />
      <div className="relative px-5 py-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-[#22d3ee]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">On-Chain Intelligence</p>
          <p className="text-[11px] text-white/40">1.2M+ tokens scanned · 47K rugs detected · Real-time forensics</p>
        </div>
        <Badge className="shrink-0 bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20 text-[9px]">LIVE</Badge>
      </div>
    </div>
  </Tilt3D>
);

const PromoBanner2 = () => (
  <Tilt3D className="mb-5" intensity={5}>
    <div className="relative overflow-hidden rounded-2xl border border-[#a855f7]/15 bg-gradient-to-r from-[#a855f7]/8 via-[#060c13] to-[#eab308]/8">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(168,85,247,0.015)_3px,rgba(168,85,247,0.015)_6px)] pointer-events-none" />
      <div className="absolute left-0 top-0 w-[200px] h-full rounded-full blur-[80px] bg-[#a855f7]/8" />
      <div className="relative px-5 py-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center shrink-0">
          <Trophy className="h-5 w-5 text-[#a855f7]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">Join the OG Movement</p>
          <p className="text-[11px] text-white/40">Share memes · Earn reactions · Climb the meme leaderboard</p>
        </div>
        <Badge className="shrink-0 bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20 text-[9px]">NEW</Badge>
      </div>
    </div>
  </Tilt3D>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────

const ArtFeed = ({ inline = false }: { inline?: boolean }) => {
  const [view, setView] = useState<"slider" | "grid">("grid");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null);
  const [showTrailers, setShowTrailers] = useState(true);
  const reactions = useReactions();

  const filteredMemes = useMemo(() => {
    let result = MEMES;
    if (selectedCategory !== "All") {
      result = result.filter(m => m.category === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.caption.toLowerCase().includes(q) ||
        m.tag.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [selectedCategory, searchQuery]);

  const featuredMemes = useMemo(() => MEMES.filter(m => m.featured), []);

  const openFullscreen = (meme: Meme) => {
    const idx = filteredMemes.findIndex(m => m.id === meme.id);
    setFullscreenIdx(idx >= 0 ? idx : 0);
  };

  const content = (
    <>
      <PageHeader title="OG Gallery" description="Memes, trailers & art from the OG Scan universe.">
        <div className="flex items-center gap-2">
          <Badge className="bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/20 text-[10px] font-bold">
            <ImageIcon className="h-2.5 w-2.5 mr-1" /> {MEMES.length} MEMES
          </Badge>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setView("slider")}
              className={`p-1.5 transition-colors ${view === "slider" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
              title="Slider view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 border-l border-white/10 transition-colors ${view === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
              title="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="py-4 sm:py-6">
        {/* 3D Hero Banner */}
        <ArtFeedHero />

        {/* Featured Slider */}
        <div className="mb-8">
          <div className="px-4 lg:px-6 mb-4 flex items-center gap-3">
            <Flame className="h-5 w-5 text-[#f97316]" />
            <h3 className="font-bold text-white text-sm">Featured Memes</h3>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <MemeSlider memes={featuredMemes} onOpen={(idx) => openFullscreen(featuredMemes[idx])} reactions={reactions} />
        </div>

        {/* Promo Banner */}
        <div className="px-4 lg:px-6">
          <PromoBanner1 />
        </div>

        {/* Movie Trailers Section */}
        <div className="mb-8">
          <div className="px-4 lg:px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Film className="h-5 w-5 text-[#a855f7]" />
              <h3 className="font-bold text-white text-sm">OG Scan Movie Trailers</h3>
              <Badge className="bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/20 text-[9px]">ORIGINALS</Badge>
            </div>
            <button
              onClick={() => setShowTrailers(!showTrailers)}
              className="text-[10px] text-white/30 hover:text-white/60 transition"
            >
              {showTrailers ? "Hide" : "Show"}
            </button>
          </div>
          {showTrailers && (
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-[#070d14] to-transparent pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-[#070d14] to-transparent pointer-events-none" />
              <div
                className="flex gap-4 overflow-x-auto scroll-smooth px-4 lg:px-6 pb-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {TRAILERS.map(t => <TrailerCard key={t.id} trailer={t} />)}
                <div className="flex-shrink-0 w-4" />
              </div>
            </div>
          )}
        </div>

        {/* 3D Promo Banner 2 */}
        <div className="px-4 lg:px-6">
          <PromoBanner2 />
        </div>

        {/* Category Filter + Search */}
        <div className="px-4 lg:px-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                    ${selectedCategory === cat
                      ? "bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/25"
                      : "text-white/40 hover:text-white/70 border border-transparent hover:border-white/10"
                    }
                  `}
                >
                  {cat}
                  {cat !== "All" && (
                    <span className="ml-1.5 text-[10px] opacity-60">
                      {MEMES.filter(m => m.category === cat).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memes..."
                className="w-full sm:w-48 bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#22d3ee]/30"
              />
            </div>
          </div>
        </div>

        {/* All Memes Section Header */}
        <div className="px-4 lg:px-6 mb-4 flex items-center gap-3">
          <Grid3X3 className="h-5 w-5 text-[#22d3ee]" />
          <h3 className="font-bold text-white text-sm">
            {selectedCategory === "All" ? "All Memes" : selectedCategory}
          </h3>
          <span className="text-[11px] text-white/30">{filteredMemes.length} items</span>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        </div>

        {/* Meme Grid / Slider */}
        <div className="px-4 lg:px-6">
          {view === "slider" ? (
            <MemeSlider memes={filteredMemes} onOpen={(idx) => setFullscreenIdx(idx)} reactions={reactions} />
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 sm:gap-5">
              {filteredMemes.map((meme, i) => (
                <MemeGridCard
                  key={meme.id}
                  meme={meme}
                  index={i}
                  onOpen={() => openFullscreen(meme)}
                  reactions={reactions}
                />
              ))}
            </div>
          )}
        </div>

        {filteredMemes.length === 0 && (
          <div className="px-4 lg:px-6 py-12 text-center">
            <ImageIcon className="h-12 w-12 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">No memes found for this filter.</p>
          </div>
        )}

        {/* Bottom 3D Banner */}
        <div className="px-4 lg:px-6 mt-8">
          <Tilt3D intensity={5}>
            <div className="relative overflow-hidden rounded-2xl border border-[#22d3ee]/15 bg-gradient-to-br from-[#0d1b2a] via-[#060c13] to-[#0d1b2a]">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
              <div className="absolute top-0 right-0 w-[300px] h-[200px] bg-[#22d3ee]/5 blur-[100px] rounded-full" />
              <div className="relative px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="font-bold text-white text-base">More memes dropping soon</p>
                  <p className="text-xs text-white/35 mt-1">New OG Scan art added regularly. Stay tuned for community submissions.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-[#22d3ee]/30 to-[#a855f7]/30 border-2 border-[#070d14] flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white/60">{["OG", "🔥", "💎", "🚀"][i]}</span>
                      </div>
                    ))}
                  </div>
                  <Badge className="bg-white/5 text-white/50 border-white/10 text-[10px]">
                    <MessageSquare className="h-2.5 w-2.5 mr-1" />
                    Community
                  </Badge>
                </div>
              </div>
            </div>
          </Tilt3D>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {fullscreenIdx !== null && filteredMemes[fullscreenIdx] && (
        <FullscreenModal
          meme={filteredMemes[fullscreenIdx]}
          onClose={() => setFullscreenIdx(null)}
          onPrev={() => setFullscreenIdx(Math.max(0, fullscreenIdx - 1))}
          onNext={() => setFullscreenIdx(Math.min(filteredMemes.length - 1, fullscreenIdx + 1))}
          hasPrev={fullscreenIdx > 0}
          hasNext={fullscreenIdx < filteredMemes.length - 1}
          reactions={reactions}
        />
      )}
    </>
  );

  return inline ? content : <AppLayout>{content}</AppLayout>;
};

export default ArtFeed;
