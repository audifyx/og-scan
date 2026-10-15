/**
 * MoneyTab — the "what's being bought RIGHT NOW" feed.
 * Ranks tokens by live on-chain buy pressure (DexScreener h24 buys vs sells),
 * weighted by volume. Every row is one tap from a trade.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Zap } from "lucide-react";
import { fetchScreener, type MarketCoin } from "../../trade/tradeApi";
import { fmtNum, fmtPct, fmtUsd } from "../../trade/tradeFmt";
import { extractCallTokens } from "./social-trade";
import TokenAvatar from "../../trade/TokenAvatar";
import { cn } from "@/lib/utils";

export interface MoneyPost {
  id: string;
  content: string;
  username: string | null;
  created_at: string;
}

interface MoneyRow extends MarketCoin {
  buys: number;
  sells: number;
  pressure: number; // 0..1 fraction of buys
}

interface MoneyTabProps {
  posts: MoneyPost[];
  onTrade: (mint: string, symbol: string) => void;
  onOpenPost: (id: string) => void;
  onOpenToken: (mint: string) => void;
}

const REFRESH_MS = 60_000;

export default function MoneyTab({ posts, onTrade, onOpenPost, onOpenToken }: MoneyTabProps) {
  const [rows, setRows] = useState<MoneyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const coins = await fetchScreener("runners", 40);
      const top = [...coins]
        .filter((c) => c.volume24h > 0)
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 18);
      if (!top.length) {
        setRows([]);
        setErr("No flow data right now");
        return;
      }
      // One batched DexScreener call for h24 buy/sell counts.
      const flow = new Map<string, { buys: number; sells: number }>();
      for (let i = 0; i < top.length; i += 30) {
        const chunk = top.slice(i, i + 30);
        try {
          const r = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${chunk.map((c) => c.mint).join(",")}`,
          );
          const d = await r.json();
          const best = new Map<string, { buys: number; sells: number; liq: number }>();
          for (const p of (d?.pairs || []) as any[]) {
            const addr: string | undefined = p?.baseToken?.address;
            if (!addr || p?.chainId !== "solana") continue;
            const liq = Number(p?.liquidity?.usd) || 0;
            const cur = best.get(addr);
            if (!cur || liq > cur.liq) {
              best.set(addr, {
                buys: Number(p?.txns?.h24?.buys) || 0,
                sells: Number(p?.txns?.h24?.sells) || 0,
                liq,
              });
            }
          }
          best.forEach((v, k) => flow.set(k, v));
        } catch {
          /* ignore chunk */
        }
      }
      const scored: MoneyRow[] = [];
      for (const c of top) {
        const f = flow.get(c.mint);
        if (!f) continue;
        const total = f.buys + f.sells;
        if (total < 20) continue; // need real flow, not dust
        const pressure = f.buys / total;
        scored.push({ ...c, buys: f.buys, sells: f.sells, pressure });
      }
      // Buy pressure first, volume breaks ties.
      scored.sort(
        (a, b) =>
          b.pressure * Math.log10(b.volume24h + 1) - a.pressure * Math.log10(a.volume24h + 1),
      );
      setRows(scored.slice(0, 12));
    } catch {
      setErr("Flow feed unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const postsFor = (mint: string) => {
    const out: MoneyPost[] = [];
    for (const p of posts) {
      if (out.length >= 2) break;
      try {
        if (extractCallTokens(p.content).some((t) => t.mint === mint)) out.push(p);
      } catch {
        /* ignore */
      }
    }
    return out;
  };

  return (
    <div className="osc-money">
      <div className="osc-money__head">
        <span className="osc-money__live">
          <Zap className="h-3.5 w-3.5" /> Money flow
        </span>
        <span className="osc-money__sub">ranked by live buy pressure · auto-refreshes</span>
        <button
          type="button"
          className="osc-money__refresh"
          onClick={() => setTick((t) => t + 1)}
          aria-label="Refresh money flow"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="osc-money__loading">
          <Loader2 className="h-6 w-6 animate-spin text-[#5aa2ff]" />
          <p>Scanning on-chain flow…</p>
        </div>
      ) : err && rows.length === 0 ? (
        <div className="osc-money__empty">
          <p className="osc-money__empty-title">No flow right now</p>
          <p className="osc-money__empty-copy">{err}</p>
          <button type="button" className="osc-money__retry" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <div className="osc-money__list">
          {rows.map((r, i) => {
            const sym = r.symbol?.trim() || r.mint.slice(0, 4);
            const up = r.change24h >= 0;
            const mentioned = postsFor(r.mint);
            return (
              <div key={r.mint} className="osc-money__card">
                <button
                  type="button"
                  className="osc-money__top"
                  onClick={() => onOpenToken(r.mint)}
                >
                  <span className="osc-money__rank">{i + 1}</span>
                  <TokenAvatar
                    image={r.image}
                    symbol={sym}
                    mint={r.mint}
                    size={44}
                    className="rounded-full"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="osc-money__sym">${sym}</span>
                    <span className="osc-money__price">
                      {fmtUsd(r.price)}{" "}
                      <span className={cn(up ? "text-[#34d399]" : "text-[#fb7185]")}>
                        {fmtPct(r.change24h)}
                      </span>
                    </span>
                  </span>
                  <span className="osc-money__pressure-num">
                    {Math.round(r.pressure * 100)}
                    <span>% buys</span>
                  </span>
                </button>

                <div
                  className="osc-money__bar"
                  role="img"
                  aria-label={`${r.buys} buys vs ${r.sells} sells`}
                >
                  <span
                    className="osc-money__bar-buy"
                    style={{ width: `${Math.round(r.pressure * 100)}%` }}
                  />
                </div>
                <div className="osc-money__meta">
                  <span>
                    <b className="text-[#34d399]">{fmtNum(r.buys)}</b> buys ·{" "}
                    <b className="text-[#fb7185]">{fmtNum(r.sells)}</b> sells
                  </span>
                  <span>Vol {fmtUsd(r.volume24h)}</span>
                </div>

                <div className="osc-money__actions">
                  <button
                    type="button"
                    className="osc-money__buy"
                    onClick={() => onTrade(r.mint, sym)}
                  >
                    Buy ${sym}
                  </button>
                  {mentioned.length > 0 && (
                    <button
                      type="button"
                      className="osc-money__posts"
                      onClick={() => onOpenPost(mentioned[0].id)}
                    >
                      {mentioned.length} post{mentioned.length > 1 ? "s" : ""} · @
                      {(mentioned[0].username || "anon").slice(0, 12)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
