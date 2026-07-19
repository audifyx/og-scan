// Orbitx Launchpad — token detail page (/orbitxlaunch/token/:mint). Glass/terminal aesthetic.
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getToken, type OrbitxToken } from "@/lib/orbitx/registry";
import { shortAddr, timeAgo, SectionLabel } from "./_shared";
import {
  Loader2, Copy, Check, ExternalLink, ShieldCheck, ShieldAlert, Droplets, Flame,
  ArrowLeft, Coins, TrendingUp, BarChart3, Zap, Send,
} from "lucide-react";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 last:border-0">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "gold" | "cyan" | "lime" | "blood" | "muted" }) {
  const map: Record<string, string> = {
    gold: "bg-[hsl(var(--og-gold))]/12 text-[hsl(var(--og-gold))] border-[hsl(var(--og-gold))]/25",
    cyan: "bg-[hsl(var(--og-cyan))]/12 text-[hsl(var(--og-cyan))] border-[hsl(var(--og-cyan))]/25",
    lime: "bg-[hsl(var(--og-lime))]/12 text-[hsl(var(--og-lime))] border-[hsl(var(--og-lime))]/25",
    blood: "bg-[hsl(var(--og-blood))]/12 text-[hsl(var(--og-blood))] border-[hsl(var(--og-blood))]/25",
    muted: "bg-white/5 text-muted-foreground border-white/10",
  };
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${map[tone]}`}>{children}</span>;
}

export default function LaunchpadToken() {
  const { mint } = useParams<{ mint: string }>();
  const [copied, setCopied] = useState(false);
  const { data: t, isLoading, error } = useQuery({
    queryKey: ["orbitx-token", mint],
    queryFn: () => getToken(mint!),
    enabled: !!mint,
  });
  
  // Fetch market data from DexScreener
  const { data: marketData } = useQuery({
    queryKey: ["market-data", mint],
    queryFn: async () => {
      if (!mint) return null;
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        const json = await res.json();
        return json.pairs?.[0] ?? null;
      } catch (e) {
        console.error("Failed to fetch market data", e);
        return null;
      }
    },
    enabled: !!mint,
  });

  const copy = () => {
    if (!mint) return;
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (isLoading) return <div className="flex items-center justify-center gap-2 py-24 font-mono text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> loading token…</div>;

  if (error || !t)
    return (
      <div className="og-glass-card mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <div className="font-display text-lg font-bold text-foreground">Token not found</div>
        <div className="max-w-sm text-sm text-muted-foreground">No launch is registered for <span className="font-mono text-[hsl(var(--og-gold))]">{shortAddr(mint, 6)}</span> on Orbitx.</div>
        <Link to="/orbitxlaunch" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-wider hover:bg-white/5"><ArrowLeft className="h-4 w-4" /> Back to launchpad</Link>
      </div>
    );

  const graduated = !!t.lp_pool_address;
  const explorer = `https://solscan.io/token/${t.mint_address}${t.cluster !== "mainnet-beta" ? "?cluster=devnet" : ""}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/orbitxlaunch" className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Launchpad</Link>

      <div className="og-glass-frame relative overflow-hidden p-6">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/12 bg-white/5 shadow-lg shadow-[hsl(var(--og-gold))]/10">
              {t.logo_url ? <img src={t.logo_url} alt={t.ticker} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-muted-foreground">{t.ticker?.slice(0, 2).toUpperCase()}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{t.name}</h1>
                <span className="rounded-md bg-[hsl(var(--og-gold))]/10 px-2 py-0.5 font-mono text-xs text-[hsl(var(--og-gold))] border border-[hsl(var(--og-gold))]/30">${t.ticker}</span>
                <Pill tone={t.launch_type === "pump" ? "cyan" : "gold"}>{t.launch_type === "pump" ? "Pump launch" : "Custom launch"}</Pill>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {graduated
                  ? <Pill tone="lime"><Droplets className="h-3 w-3" /> Graduated</Pill>
                  : <Pill tone="cyan"><Flame className="h-3 w-3" /> Fresh</Pill>}
                {t.is_vamp
                  ? <Pill tone="blood"><ShieldAlert className="h-3 w-3" /> Vamp · fees → {t.fee_route === "orbitx_buyback" ? "OBX buyback" : t.fee_route}</Pill>
                  : <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> Verified unique</Pill>}
                <Pill tone="muted">{t.cluster}</Pill>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button className="flex items-center gap-2 rounded-lg bg-[hsl(var(--og-lime))]/20 border border-[hsl(var(--og-lime))]/40 text-[hsl(var(--og-lime))] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-[hsl(var(--og-lime))]/30 transition">
                <TrendingUp className="h-4 w-4" /> Buy
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-[hsl(var(--og-blood))]/20 border border-[hsl(var(--og-blood))]/40 text-[hsl(var(--og-blood))] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-[hsl(var(--og-blood))]/30 transition">
                <TrendingUp className="h-4 w-4 rotate-180" /> Sell
              </button>
            </div>
          </div>

          {/* CA */}
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5">
            <Coins className="h-4 w-4 shrink-0 text-[hsl(var(--og-gold))]" />
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{t.mint_address}</span>
            <button onClick={copy} className="shrink-0 rounded-lg border border-white/10 p-1.5 hover:bg-white/5" title="Copy CA">{copied ? <Check className="h-4 w-4 text-[hsl(var(--og-lime))]" /> : <Copy className="h-4 w-4" />}</button>
            <a href={explorer} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-white/10 p-1.5 hover:bg-white/5" title="View on Solscan"><ExternalLink className="h-4 w-4" /></a>
          </div>
        </div>
      </div>

      {/* Bonding Curve Progress */}
      {!graduated && (
        <div className="og-glass-card mt-4 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Bonding Curve Progress</span>
            <span className="font-mono text-sm font-bold text-[hsl(var(--og-lime))]">{marketData?.marketCap ? Math.min(99, Math.round((Number(marketData.marketCap) / 69000) * 100)) : 3}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[hsl(var(--og-lime))] to-[hsl(var(--og-gold))]" style={{ width: `${marketData?.marketCap ? Math.min(99, Math.round((Number(marketData.marketCap) / 69000) * 100)) : 3}%` }} />
          </div>
        </div>
      )}

      {/* Trading & Market Info */}
      <div className="grid gap-4 mt-4 lg:grid-cols-3">
        <div className="og-glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Market Cap</span>
          </div>
          <div className="font-mono text-lg font-bold text-foreground">{marketData?.marketCap ? `$${(Number(marketData.marketCap) / 1e6).toFixed(2)}M` : "—"}</div>
        </div>
        <div className="og-glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-[hsl(var(--og-gold))]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">24h Volume</span>
          </div>
          <div className="font-mono text-lg font-bold text-foreground">{marketData?.volume?.h24 ? `$${(Number(marketData.volume.h24) / 1e6).toFixed(2)}M` : "—"}</div>
        </div>
        <div className="og-glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-4 w-4 text-[hsl(var(--og-lime))]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">24h Change</span>
          </div>
          <div className={`font-mono text-lg font-bold ${Number(marketData?.priceChange?.h24 ?? 0) >= 0 ? "text-[hsl(var(--og-lime))]" : "text-[hsl(var(--og-blood))]"}`}>{marketData?.priceChange?.h24 ? `${Number(marketData.priceChange.h24).toFixed(2)}%` : "—"}</div>
        </div>
      </div>

      <div className="og-glass-card mt-4 p-6">
        <SectionLabel accent="gold">Token details</SectionLabel>
        <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
          <Row label="Supply">{Number(t.supply).toLocaleString()}</Row>
          <Row label="Decimals">{t.decimals}</Row>
          <Row label="DEX">{t.dex || "—"}</Row>
          <Row label="Fee routing">{t.fee_route === "orbitx_buyback" ? "OBX buyback" : t.fee_route === "og" ? "Original token" : "Creator"}</Row>
          <Row label="Creator">{shortAddr(t.creator_wallet, 5)}</Row>
          <Row label="Launched">{timeAgo(t.created_at)}</Row>
          {t.lp_pool_address && <Row label="LP pool">{shortAddr(t.lp_pool_address, 5)}</Row>}
          {t.mint_signature && <Row label="Mint tx"><a className="text-[hsl(var(--og-cyan))] hover:underline" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${t.mint_signature}${t.cluster !== "mainnet-beta" ? "?cluster=devnet" : ""}`}>{shortAddr(t.mint_signature, 5)}</a></Row>}
        </div>
      </div>
    </div>
  );
}
