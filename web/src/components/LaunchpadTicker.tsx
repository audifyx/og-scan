/**
 * LaunchpadTicker — horizontal scrolling ticker tape of top tokens by market cap.
 * Self-contained: fetches its own data from Supabase. Designed to sit at the
 * top of the /launchpad/live page. Pause on hover, click → DexScreener.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface TickerToken {
  mint: string;
  symbol: string;
  price_usd: number | null;
  market_cap_usd: number | null;
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(4)}`;
}

export default function LaunchpadTicker() {
  const [tokens, setTokens] = useState<TickerToken[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("launchpad_tokens")
        .select("mint,symbol,price_usd,market_cap_usd")
        .order("market_cap_usd", { ascending: false })
        .limit(10);
      if (!cancelled) setTokens((data || []) as TickerToken[]);
    })();
    return () => { cancelled = true; };
  }, []);

  if (tokens.length === 0) return null;

  // Duplicate the list for a seamless infinite loop
  const items = [...tokens, ...tokens];

  return (
    <>
      <style>{`
        @keyframes lp-ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lp-ticker-track {
          display: inline-flex;
          animation: lp-ticker-scroll 40s linear infinite;
          will-change: transform;
        }
        .lp-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="w-full overflow-hidden border-b border-white/10 bg-black">
        <div className="lp-ticker-track whitespace-nowrap py-1.5">
          {items.map((t, i) => {
            const up = (t.price_usd ?? 0) > 0;
            return (
              <a
                key={`${t.mint}-${i}`}
                href={`https://dexscreener.com/solana/${t.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-5 inline-flex items-center gap-2 text-xs"
                aria-hidden={i >= tokens.length}
              >
                <span className="font-bold text-white/80">${t.symbol}</span>
                <span className="text-white/50">{fmtUsd(t.price_usd)}</span>
                <span className="text-white/30">MCap {fmtUsd(t.market_cap_usd)}</span>
                <span className={up ? "text-green-400" : "text-red-400"}>
                  {up ? "▲" : "▼"}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}
