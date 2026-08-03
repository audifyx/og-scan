/**
 * /trade/notifications — market signals + movers feed.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Bell, Loader2, Zap, ArrowLeft } from "lucide-react";
import { fetchMarketSignals, type MarketCoin } from "./tradeApi";
import { fmtPct, fmtUsd } from "./tradeFmt";

function reasonFor(c: MarketCoin): string {
  const ch = c.change24h;
  if (Math.abs(ch) >= 80) return ch > 0 ? "Explosive 24h runner" : "Heavy 24h dump";
  if (Math.abs(ch) >= 30) return ch > 0 ? "Strong momentum" : "Sharp pullback";
  if ((c.volume24h || 0) >= 500_000) return "High volume tape";
  return "Trending on OrbitX markets";
}

export default function TradeNotifications() {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const [rows, setRows] = useState<MarketCoin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchMarketSignals().then((list) => {
      if (!on) return;
      setRows(list);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black">
      <div className="shrink-0 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Bell className="h-5 w-5" />
          <div>
            <h1 className="text-base font-bold">Notifications</h1>
            <p className="text-[11px] text-white/40">Live market signals from OrbitX screener</p>
          </div>
        </div>
        {!connected && (
          <Link
            to="/trade/profile"
            className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12px] text-white/60"
          >
            <Zap className="h-4 w-4" />
            Connect wallet in Profile for personal trade alerts
          </Link>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : !rows.length ? (
          <p className="px-4 py-16 text-center text-sm text-white/35">No signals right now</p>
        ) : (
          rows.map((c) => (
            <button
              key={c.mint}
              type="button"
              onClick={() => navigate(`/trade/token/${c.mint}`)}
              className="flex w-full items-start gap-3 border-b border-white/[0.05] px-4 py-3.5 text-left hover:bg-white/[0.04]"
            >
              {c.image ? (
                <img src={c.image} alt="" className="mt-0.5 h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                  {c.symbol.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{c.symbol}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      c.change24h >= 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {fmtPct(c.change24h)}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-white/55">{reasonFor(c)}</p>
                <p className="mt-1 font-mono text-[10px] text-white/30">
                  MCap {fmtUsd(c.mcap)} · Vol {fmtUsd(c.volume24h)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
