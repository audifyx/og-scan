// OrbitX Launchpad — Leaderboards. Top Creators (ranked by graduated launches,
// then total launches) and Top Tokens (by live market cap). All real data from
// the registry + DexScreener. Wallet-native identity: each creator links to their
// on-chain profile page.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listTokens } from "@/lib/orbitx/registry";
import { TokenCard, shortAddr, GRADUATION_MC_USD } from "./_shared";
import { useMarketMap, fmtCompactUsd } from "./lpx";
import { Trophy, Rocket, Droplets, Loader2, Crown, Coins } from "lucide-react";

type Tab = "creators" | "tokens";

export default function LaunchpadLeaderboard() {
  const [tab, setTab] = useState<Tab>("creators");
  const { data: launches, isLoading } = useQuery({
    queryKey: ["orbitx-lb-launches"],
    queryFn: () => listTokens("all", 500),
    staleTime: 30_000,
  });
  const mints = useMemo(() => (Array.isArray(launches) ? launches.map((t) => t.mint_address) : []), [launches]);
  const { data: markets } = useMarketMap(mints);

  const creators = useMemo(() => {
    const map = new Map<string, { wallet: string; launches: number; graduated: number; mcap: number }>();
    (launches ?? []).forEach((t) => {
      if (!t) return;
      const c = map.get(t.creator_wallet) ?? { wallet: t.creator_wallet, launches: 0, graduated: 0, mcap: 0 };
      c.launches += 1;
      c.mcap += markets?.[t.mint_address]?.mcap ?? 0;
      if (t.lp_pool_address || t.graduated_at || (markets?.[t.mint_address]?.mcap ?? 0) >= GRADUATION_MC_USD) c.graduated += 1;
      map.set(t.creator_wallet, c);
    });
    return Array.from(map.values()).sort((a, b) => b.graduated - a.graduated || b.mcap - a.mcap || b.launches - a.launches).slice(0, 50);
  }, [launches, markets]);

  const topTokens = useMemo(() => {
    return (launches ?? []).filter((t) => !!t).sort((a, b) => (markets?.[b.mint_address]?.mcap ?? 0) - (markets?.[a.mint_address]?.mcap ?? 0)).slice(0, 30);
  }, [launches, markets]);

  const rankColor = (i: number) => (i === 0 ? "text-[hsl(var(--pf-gold))]" : i === 1 ? "text-[hsl(var(--pf-muted))]" : i === 2 ? "text-[hsl(28_80%_45%)]" : "text-[hsl(var(--pf-muted))]");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-[hsl(var(--pf-gold))]" />
        <h1 className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">Leaderboards</h1>
      </div>

      <div className="mb-4 flex gap-2">
        {([["creators", "Top creators"], ["tokens", "Top tokens"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${tab === id ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-ink))]"}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading…</div>
      ) : tab === "creators" ? (
        <div className="space-y-2">
          {creators.map((c, i) => (
            <Link key={c.wallet} to={`/orbitxlaunch/creator/${c.wallet}`} className="pf-card flex items-center gap-3 p-3">
              <div className={`w-7 shrink-0 text-center text-lg font-black ${rankColor(i)}`}>{i < 3 ? <Crown className="mx-auto h-5 w-5" /> : i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="pf-mono text-sm font-bold text-[hsl(var(--pf-ink))]">{shortAddr(c.wallet, 5)}</div>
                <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">total mcap {fmtCompactUsd(c.mcap)}</div>
              </div>
              <div className="flex items-center gap-4 pf-mono text-xs">
                <span className="inline-flex items-center gap-1 text-[hsl(var(--pf-green))]"><Droplets className="h-3.5 w-3.5" /> {c.graduated}</span>
                <span className="inline-flex items-center gap-1 text-[hsl(var(--pf-muted))]"><Rocket className="h-3.5 w-3.5" /> {c.launches}</span>
              </div>
            </Link>
          ))}
          {creators.length === 0 && <div className="pf-card py-16 text-center text-sm text-[hsl(var(--pf-muted))]">No creators yet.</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {topTokens.map((t) => <TokenCard key={t.mint_address} t={t} mc={markets?.[t.mint_address]?.mcap ?? null} market={markets?.[t.mint_address] ?? null} />)}
        </div>
      )}
    </div>
  );
}
