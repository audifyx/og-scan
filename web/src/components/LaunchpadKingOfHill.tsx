/**
 * LaunchpadKingOfHill — hero spotlight for the #1 token by market cap.
 * Self-contained: fetches its own data, auto-refreshes every 60s.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface KingToken {
  mint: string;
  name: string;
  symbol: string;
  image_url: string | null;
  price_usd: number | null;
  market_cap_usd: number | null;
  status: string;
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(4)}`;
}

export default function LaunchpadKingOfHill() {
  const [king, setKing] = useState<KingToken | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      const { data } = await supabase
        .from("launchpad_tokens")
        .select("mint,name,symbol,image_url,price_usd,market_cap_usd,status")
        .order("market_cap_usd", { ascending: false })
        .limit(1)
        .single();
      if (!cancelled) {
        setKing((data as KingToken) || null);
        setLoading(false);
      }
    };
    fetch();
    const id = setInterval(fetch, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-3xl bg-white/5" />;
  }

  if (!king) {
    return (
      <div className="rounded-3xl border border-dashed border-yellow-500/20 bg-yellow-500/[0.03] p-8 text-center">
        <p className="text-2xl">👑</p>
        <p className="mt-2 font-bold text-white/60">No king yet</p>
        <p className="text-sm text-white/40">The throne awaits the first launch</p>
      </div>
    );
  }

  return (
    <Link
      to={`/launchpad/token/${king.mint}`}
      className="group relative block overflow-hidden rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/[0.08] via-black to-black p-6 sm:p-8 transition-all hover:border-yellow-500/50"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[500px] -translate-x-1/2 rounded-full bg-yellow-500/15 blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 sm:flex-row">
        {/* Crown + image */}
        <div className="relative shrink-0">
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 animate-bounce text-4xl" style={{ animationDuration: "2s" }}>
            👑
          </div>
          <div className="h-24 w-24 overflow-hidden rounded-2xl border-2 border-yellow-500/40 bg-gradient-to-br from-yellow-800 to-amber-900 sm:h-28 sm:w-28">
            {king.image_url ? (
              <img src={king.image_url} alt={king.symbol} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-black text-yellow-200/60">
                {king.symbol.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
            <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            King of the Hill
          </p>
          <h2 className="mt-1 text-2xl font-black group-hover:text-yellow-200 sm:text-3xl">
            {king.name}{" "}
            <span className="rounded-full bg-yellow-500/20 px-2.5 py-1 align-middle text-xs font-bold text-yellow-300">
              ${king.symbol}
            </span>
          </h2>
          <div className="mt-3 flex flex-wrap justify-center gap-6 sm:justify-start">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/30">Market Cap</p>
              <p className="text-xl font-black text-yellow-300">{fmtUsd(king.market_cap_usd)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/30">Price</p>
              <p className="text-xl font-black">{fmtUsd(king.price_usd)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/30">Status</p>
              <p className="text-xl font-black capitalize text-white/70">{king.status}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0">
          <span className="inline-block rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black text-black transition-transform group-hover:scale-105">
            View Token →
          </span>
        </div>
      </div>

      <p className="relative mt-4 text-center text-[11px] text-white/30 sm:text-left">
        Dethroned in real-time — refreshes every 60s
      </p>
    </Link>
  );
}
