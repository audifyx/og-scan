/**
 * LaunchpadSwipe — Tinder-style token discovery for the OrbitX Launchpad.
 * Read-only discovery: swipe to build a localStorage watchlist ("aped" tokens).
 * No wallet connect, no trading — actions happen through the MCP.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface LaunchToken {
  mint: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  status: string;
  price_usd: number | null;
  market_cap_usd: number | null;
  creator_username: string | null;
  created_at: string;
}

const WATCHLIST_KEY = "orbitx-launchpad-watchlist";
const SWIPE_THRESHOLD = 100; // px to trigger a swipe

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function LaunchpadSwipe() {
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<string[]>(() => loadWatchlist());
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [degen, setDegen] = useState(false);

  // Drag state (no external lib)
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const dragStartX = useRef(0);
  const dragMoved = useRef(false);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("launchpad_tokens")
      .select("mint,name,symbol,description,image_url,status,price_usd,market_cap_usd,creator_username,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    let list = (data || []) as LaunchToken[];
    if (degen) {
      // Fisher-Yates shuffle
      list = [...list];
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    setTokens(list);
    setIndex(0);
    setLoading(false);
  }, [degen]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const saveWatchlist = (next: string[]) => {
    setWatchlist(next);
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const advance = (dir: "left" | "right") => {
    const current = tokens[index];
    setLeaving(dir);
    if (dir === "right" && current && !watchlist.includes(current.mint)) {
      saveWatchlist([...watchlist, current.mint]);
    }
    // Animate out, then move to next card
    setTimeout(() => {
      setIndex((i) => i + 1);
      setDragX(0);
      setLeaving(null);
    }, 220);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving) return;
    setDragging(true);
    dragStartX.current = e.clientX;
    dragMoved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || leaving) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 4) dragMoved.current = true;
    setDragX(dx);
  };

  const endDrag = () => {
    if (!dragging || leaving) return;
    setDragging(false);
    if (dragX > SWIPE_THRESHOLD) advance("right");
    else if (dragX < -SWIPE_THRESHOLD) advance("left");
    else setDragX(0); // snap back
  };

  const current = tokens[index];
  const done = !loading && tokens.length > 0 && index >= tokens.length;
  const watchlistTokens = tokens.filter((t) => watchlist.includes(t.mint));

  // Card rotation based on drag distance
  const rotation = dragX / 12;
  const opacity = 1 - Math.min(Math.abs(dragX) / 500, 0.4);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <Link to="/launchpad/live" className="text-sm font-bold text-blue-400">
          ← Feed
        </Link>
        <h1 className="text-sm font-black uppercase tracking-widest text-white/70">
          Discover
        </h1>
        <button
          onClick={() => setShowWatchlist(true)}
          className="relative rounded-full bg-white/5 px-3 py-1.5 text-sm font-bold"
        >
          👀
          {watchlist.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black">
              {watchlist.length}
            </span>
          )}
        </button>
      </div>

      {/* Card area */}
      <div className="flex flex-1 items-center justify-center px-4 py-6">
        {loading ? (
          <div className="h-96 w-full max-w-sm animate-pulse rounded-3xl bg-white/5" />
        ) : tokens.length === 0 ? (
          <div className="text-center">
            <p className="text-xl font-bold text-white/60">No tokens yet</p>
            <p className="mt-2 text-sm text-white/40">Check back after launches go live</p>
          </div>
        ) : done ? (
          <div className="text-center">
            <p className="text-2xl font-black">That's everything 🔥</p>
            <p className="mt-2 text-sm text-white/40">
              You've seen all {tokens.length} tokens
            </p>
            <button
              onClick={() => setDegen((d) => !d)}
              className="mt-6 rounded-full bg-blue-600 px-6 py-3 text-sm font-bold"
            >
              {degen ? "🔀 Reshuffle (degen mode)" : "🎲 Degen mode — shuffle"}
            </button>
          </div>
        ) : current ? (
          <div className="w-full max-w-sm">
            {/* Stack effect: ghost cards behind */}
            <div className="relative">
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                  transform: `translateX(${leaving === "left" ? -window.innerWidth : leaving === "right" ? window.innerWidth : dragX}px) rotate(${leaving ? (leaving === "right" ? 18 : -18) : rotation}deg)`,
                  opacity: leaving ? 0 : opacity,
                  transition: dragging ? "none" : "transform 0.22s ease, opacity 0.22s ease",
                  touchAction: "pan-y",
                  cursor: dragging ? "grabbing" : "grab",
                }}
                className="relative z-10 select-none overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02]"
              >
                {/* Swipe overlays */}
                <div
                  className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between p-6 transition-opacity"
                  style={{ opacity: Math.min(Math.abs(dragX) / 80, 1) }}
                >
                  {dragX > 20 && (
                    <span className="rounded-xl border-4 border-green-400 px-3 py-1 text-2xl font-black text-green-400 -rotate-12">
                      APE 🦍
                    </span>
                  )}
                  {dragX < -20 && (
                    <span className="ml-auto rounded-xl border-4 border-red-400 px-3 py-1 text-2xl font-black text-red-400 rotate-12">
                      SKIP
                    </span>
                  )}
                </div>

                {/* Token image */}
                <div className="h-64 w-full bg-gradient-to-br from-blue-900 to-purple-900">
                  {current.image_url ? (
                    <img
                      src={current.image_url}
                      alt={current.symbol}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-7xl font-black text-white/30">
                      {current.symbol.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Token info */}
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-black">{current.name}</h2>
                    <span className="shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-300">
                      ${current.symbol}
                    </span>
                  </div>
                  {current.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-white/50">{current.description}</p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-white/30">Market Cap</p>
                      <p className="font-black">{fmtUsd(current.market_cap_usd)}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-white/30">Price</p>
                      <p className="font-black">{fmtUsd(current.price_usd)}</p>
                    </div>
                  </div>
                  {current.creator_username && (
                    <p className="mt-3 text-xs text-white/30">by {current.creator_username}</p>
                  )}
                </div>
              </div>

              {/* Ghost cards */}
              {tokens[index + 1] && (
                <div className="absolute inset-x-4 top-2 -z-0 h-full rounded-3xl bg-white/[0.02] border border-white/5 scale-[0.97]" />
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                onClick={() => advance("left")}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/50 bg-red-500/10 text-2xl transition-transform active:scale-90"
                aria-label="Skip"
              >
                ✕
              </button>
              <button
                onClick={() => setDegen((d) => !d)}
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ${degen ? "bg-purple-600" : "bg-white/10 text-white/50"}`}
                title="Shuffle order"
              >
                🎲 {degen ? "Degen ON" : "Degen"}
              </button>
              <button
                onClick={() => advance("right")}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500/50 bg-green-500/10 text-2xl transition-transform active:scale-90"
                aria-label="Ape in"
              >
                ✓
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-white/30">
              {index + 1} / {tokens.length} · trade via the MCP, not here
            </p>
          </div>
        ) : null}
      </div>

      {/* Watchlist modal */}
      {showWatchlist && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
          onClick={() => setShowWatchlist(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">🦍 Aped ({watchlist.length})</h2>
              <button
                onClick={() => setShowWatchlist(false)}
                className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            {watchlistTokens.length === 0 ? (
              <p className="mt-6 text-center text-sm text-white/40">
                Swipe right or tap ✓ on tokens you like — they'll show up here.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {watchlistTokens.map((t) => (
                  <div
                    key={t.mint}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-800 to-purple-800 font-black">
                      {t.image_url ? (
                        <img src={t.image_url} alt={t.symbol} className="h-full w-full object-cover" />
                      ) : (
                        t.symbol.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{t.name}</p>
                      <p className="text-xs text-white/40">${t.symbol} · {fmtUsd(t.market_cap_usd)}</p>
                    </div>
                    <Link
                      to={`/launchpad/token/${t.mint}`}
                      className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => saveWatchlist(watchlist.filter((m) => m !== t.mint))}
                      className="shrink-0 text-white/30 hover:text-red-400"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {watchlist.length > 0 && (
              <button
                onClick={() => saveWatchlist([])}
                className="mt-4 w-full rounded-xl bg-white/5 py-2.5 text-xs font-bold text-white/40"
              >
                Clear watchlist
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
