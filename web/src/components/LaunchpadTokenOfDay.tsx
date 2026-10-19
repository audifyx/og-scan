/**
 * LaunchpadTokenOfDay — daily spotlight card for the OrbitX Launchpad.
 * Picks one token per day deterministically (hash of date, fair rotation
 * over the full list), with a "why today?" reason line. Self-contained:
 * fetches its own data. Designed to sit between the ticker and the token
 * grid on /launchpad/live.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface DayToken {
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

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/** FNV-1a 32-bit hash — deterministic across browsers/sessions. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prettyDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const NEUTRAL_REASONS = [
  "Daily rotation spotlight",
  "Under-the-radar gem",
  "Community watch pick",
];

export default function LaunchpadTokenOfDay() {
  const [token, setToken] = useState<DayToken | null>(null);
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("launchpad_tokens")
        .select("mint,name,symbol,description,image_url,status,price_usd,market_cap_usd,creator_username,created_at")
        .order("created_at", { ascending: true })
        .limit(500);
      if (cancelled) return;
      const tokens = (data || []) as DayToken[];
      if (tokens.length === 0) return;

      // Deterministic daily pick: hash(date) rotates fairly across the full list.
      const idx = hashStr(`launchpad-totd:${todayKey()}`) % tokens.length;
      const pick = tokens[idx];
      setToken(pick);

      // "Why today?" — grounded in the token's real attributes.
      const maxMcap = Math.max(...tokens.map((t) => t.market_cap_usd ?? 0));
      const ageHrs = (Date.now() - new Date(pick.created_at).getTime()) / 3.6e6;
      if ((pick.market_cap_usd ?? 0) >= maxMcap && maxMcap > 0) {
        setReason("Highest market cap on the board");
      } else if (ageHrs < 48) {
        setReason("Freshest launch on the board");
      } else if (pick.status === "trending") {
        setReason("Trending with the community right now");
      } else if (pick.status === "graduated") {
        setReason("Graduated — a launchpad success story");
      } else {
        setReason(NEUTRAL_REASONS[hashStr(`totd-reason:${todayKey()}`) % NEUTRAL_REASONS.length]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!token) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <Link
        to={`/launchpad/token/${token.mint}`}
        className="group relative block overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-950/60 via-black to-black p-5 sm:p-6 transition-all hover:border-amber-400/50"
      >
        {/* Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[500px] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Image */}
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-800 to-yellow-900 sm:h-28 sm:w-28">
            {token.image_url ? (
              <img src={token.image_url} alt={token.symbol} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-black text-amber-200/70">
                {token.symbol.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-amber-300">
                <span className="animate-pulse">✨</span> Token of the Day
              </span>
              <span className="text-xs text-white/40">{prettyDate()}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="truncate text-2xl font-black tracking-tight group-hover:text-amber-200">
                {token.name}
              </h2>
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                ${token.symbol}
              </span>
            </div>

            {token.description && (
              <p className="mt-1 line-clamp-1 text-sm text-white/50">{token.description}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-white/35">Price </span>
                <span className="font-bold text-white/90">{fmtUsd(token.price_usd)}</span>
              </div>
              <div>
                <span className="text-white/35">MCap </span>
                <span className="font-bold text-amber-300">{fmtUsd(token.market_cap_usd)}</span>
              </div>
              {token.creator_username && (
                <span className="text-white/40">by {token.creator_username}</span>
              )}
            </div>
          </div>

          {/* Why today */}
          <div className="shrink-0 rounded-2xl border border-amber-500/20 bg-black/40 px-4 py-3 sm:max-w-[200px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">Why today?</p>
            <p className="mt-1 text-sm font-semibold text-white/80">{reason}</p>
            <p className="mt-1 text-[11px] text-white/35">New pick every day →</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
