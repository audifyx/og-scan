/**
 * ArtFeed — OG Scan Meme Gallery
 *
 * Curated vintage-style meme slider. Images are stored in /public/memes/
 * and captions are maintained manually right here in the MEMES array below.
 * To add new memes: drop the image in /public/memes/, add an entry to MEMES.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

// ─── Meme data — edit captions / add entries here ─────────────────────────────

interface Meme {
  src: string;
  caption: string;
  tag?: string;
}

const MEMES: Meme[] = [
  {
    src: "/memes/og-deploying-future.jpg",
    caption: "Deploying the future, one block at a time.",
    tag: "Building",
  },
  {
    src: "/memes/og-scan-dashboard.jpg",
    caption: "WAGMI. Ship. Code. Repeat.",
    tag: "OG Dev",
  },
  {
    src: "/memes/og-truth-scan.jpg",
    caption: "Exit liquidity is a scam. We expose them all.",
    tag: "Truth Scan",
  },
  {
    src: "/memes/og-detection-matrix.jpg",
    caption: "Originals only. We don't guess. We forensic.",
    tag: "OG Detection",
  },
  {
    src: "/memes/og-king-throne.jpg",
    caption: "The Solana chain never lies. Neither do we.",
    tag: "On-Chain King",
  },
  {
    src: "/memes/og-rug-radar.jpg",
    caption: "Rugs don't sleep. Neither do we.",
    tag: "Rug Radar",
  },
  {
    src: "/memes/og-wallet-profiler.jpg",
    caption: "Built by OGs. For OGs.",
    tag: "OG Dev",
  },
  {
    src: "/memes/og-they-dont-know.jpg",
    caption: "They don't know OG. We do.",
    tag: "Alpha",
  },
  {
    src: "/memes/og-command-deck.jpg",
    caption: "Solana Memecoin Forensics Command Deck.",
    tag: "Command Deck",
  },
  {
    src: "/memes/og-clone-buyer.jpg",
    caption: "Clone buyer gets rekt. OG Scan user finds the gem.",
    tag: "True OG",
  },
];

// ─── Vintage frame colours cycling ────────────────────────────────────────────

const FRAME_STYLES = [
  "border-[#22d3ee]/40 shadow-[0_0_24px_rgba(34,211,238,0.15)]",
  "border-[#a855f7]/40 shadow-[0_0_24px_rgba(168,85,247,0.15)]",
  "border-[#eab308]/30 shadow-[0_0_24px_rgba(234,179,8,0.12)]",
  "border-[#22d3ee]/40 shadow-[0_0_24px_rgba(34,211,238,0.15)]",
  "border-[#f97316]/30 shadow-[0_0_24px_rgba(249,115,22,0.12)]",
];

// ─── Single Meme Card ─────────────────────────────────────────────────────────

const MemeCard = ({
  meme,
  index,
  active,
}: {
  meme: Meme;
  index: number;
  active: boolean;
}) => {
  const frame = FRAME_STYLES[index % FRAME_STYLES.length];
  return (
    <div
      className={`
        relative flex-shrink-0 w-72 sm:w-80
        rounded-2xl border-2 ${frame}
        bg-[#070d14]/80 backdrop-blur
        overflow-hidden
        transition-all duration-500
        ${active ? "scale-100 opacity-100" : "scale-95 opacity-60"}
      `}
    >
      {/* Polaroid top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5">
        <span className="text-[10px] font-bold tracking-widest text-white/30 uppercase">
          OG SCAN
        </span>
        {meme.tag && (
          <Badge className="text-[9px] px-2 py-0 h-4 bg-white/5 text-white/50 border-white/10 font-bold tracking-wide uppercase">
            {meme.tag}
          </Badge>
        )}
      </div>

      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-black">
        <img
          src={meme.src}
          alt={meme.caption}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* Caption — vintage photo label */}
      <div className="px-4 py-3 bg-[#050a10]/60">
        <p className="text-xs text-white/70 leading-relaxed font-light tracking-wide italic">
          "{meme.caption}"
        </p>
      </div>

      {/* Bottom decorative line */}
      <div
        className={`h-[2px] w-full opacity-40 ${
          index % 2 === 0
            ? "bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent"
            : "bg-gradient-to-r from-transparent via-[#a855f7] to-transparent"
        }`}
      />
    </div>
  );
};

// ─── Scrollable Gallery ────────────────────────────────────────────────────────

const MemeGallery = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);

  // Snap to a card
  const snapTo = useCallback((idx: number) => {
    const el = trackRef.current;
    if (!el) return;
    const CARD_W = window.innerWidth < 640 ? 288 + 16 : 320 + 20; // card + gap
    el.scrollTo({ left: idx * CARD_W, behavior: "smooth" });
    setActiveIdx(idx);
  }, []);

  const prev = () => snapTo(Math.max(0, activeIdx - 1));
  const next = () => snapTo(Math.min(MEMES.length - 1, activeIdx + 1));

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    scrollStartLeft.current = trackRef.current?.scrollLeft ?? 0;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !trackRef.current) return;
    trackRef.current.scrollLeft =
      scrollStartLeft.current - (e.clientX - dragStartX.current);
  };
  const onMouseUp = () => setIsDragging(false);

  // Sync active index on scroll
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const CARD_W = window.innerWidth < 640 ? 288 + 16 : 320 + 20;
    const idx = Math.round(el.scrollLeft / CARD_W);
    setActiveIdx(Math.min(Math.max(idx, 0), MEMES.length - 1));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Gallery track */}
      <div className="relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-[#070d14] to-transparent pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-[#070d14] to-transparent pointer-events-none" />

        <div
          ref={trackRef}
          className={`
            flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth
            px-12 pb-4
            scrollbar-none
            cursor-${isDragging ? "grabbing" : "grab"}
            select-none
          `}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onScroll={onScroll}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {MEMES.map((meme, i) => (
            <MemeCard key={i} meme={meme} index={i} active={i === activeIdx} />
          ))}
          {/* trailing spacer */}
          <div className="flex-shrink-0 w-12" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={prev}
          disabled={activeIdx === 0}
          className="h-8 w-8 border-white/10 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-20"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {MEMES.map((_, i) => (
            <button
              key={i}
              onClick={() => snapTo(i)}
              className={`
                rounded-full transition-all duration-300
                ${
                  i === activeIdx
                    ? "w-5 h-2 bg-[#22d3ee]"
                    : "w-2 h-2 bg-white/20 hover:bg-white/40"
                }
              `}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={next}
          disabled={activeIdx === MEMES.length - 1}
          className="h-8 w-8 border-white/10 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-20"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Current caption centered below */}
      <div className="text-center px-6">
        <p className="text-sm text-white/40 italic tracking-wide">
          {activeIdx + 1} / {MEMES.length} &nbsp;·&nbsp;{" "}
          <span className="text-white/60">{MEMES[activeIdx].caption}</span>
        </p>
      </div>
    </div>
  );
};

// ─── Full Grid view ────────────────────────────────────────────────────────────

const MemeGrid = () => (
  <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
    {MEMES.map((meme, i) => (
      <div key={i} className="break-inside-avoid">
        <div
          className={`
            relative rounded-2xl border-2 overflow-hidden
            bg-[#070d14]/80 backdrop-blur
            ${FRAME_STYLES[i % FRAME_STYLES.length]}
            transition-transform duration-200 hover:scale-[1.01]
          `}
        >
          {/* Top label */}
          <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5">
            <span className="text-[10px] font-bold tracking-widest text-white/30 uppercase">
              OG SCAN
            </span>
            {meme.tag && (
              <Badge className="text-[9px] px-2 py-0 h-4 bg-white/5 text-white/50 border-white/10 font-bold tracking-wide uppercase">
                {meme.tag}
              </Badge>
            )}
          </div>

          <div className="relative overflow-hidden bg-black">
            <img
              src={meme.src}
              alt={meme.caption}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
          </div>

          <div className="px-4 py-3 bg-[#050a10]/60">
            <p className="text-xs text-white/70 leading-relaxed font-light tracking-wide italic">
              "{meme.caption}"
            </p>
          </div>

          <div
            className={`h-[2px] w-full opacity-40 ${
              i % 2 === 0
                ? "bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent"
                : "bg-gradient-to-r from-transparent via-[#a855f7] to-transparent"
            }`}
          />
        </div>
      </div>
    ))}
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────

const ArtFeed = ({ inline = false }: { inline?: boolean }) => {
  const [view, setView] = useState<"slider" | "grid">("slider");

  const content = (
    <>
      <PageHeader title="OG Gallery" description="The memes that built the movement.">
        <div className="flex items-center gap-2">
          <Badge className="bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/20 text-[10px] font-bold">
            <ImageIcon className="h-2.5 w-2.5 mr-1" /> CURATED
          </Badge>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setView("slider")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === "slider"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Slider
            </button>
            <button
              onClick={() => setView("grid")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-white/10 ${
                view === "grid"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Grid
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="py-6">
        {/* Hero intro */}
        <div className="mx-4 lg:mx-6 mb-8 og-glass-frame rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#22d3ee] to-[#a855f7] flex items-center justify-center text-base font-black text-black shrink-0">
            OG
          </div>
          <div>
            <p className="font-black text-white text-sm">OG Scan Art & Memes</p>
            <p className="text-xs text-white/40 mt-0.5">
              Curated images from the OG Scan universe. New drops added regularly.
            </p>
          </div>
        </div>

        <div className={view === "grid" ? "mx-4 lg:mx-6" : ""}>
          {view === "slider" ? <MemeGallery /> : <MemeGrid />}
        </div>
      </div>
    </>
  );

  return inline ? content : <AppLayout>{content}</AppLayout>;
};

export default ArtFeed;
