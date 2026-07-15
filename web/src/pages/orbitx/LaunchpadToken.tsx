// Orbitx Launchpad — token detail page (/orbitxlaunch/token/:mint).
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/orbitx/registry";
import { shortAddr, timeAgo } from "./_shared";
import {
  Loader2, Copy, Check, ExternalLink, ShieldCheck, ShieldAlert, Droplets, Flame,
  ArrowLeft, Coins, Wallet, Layers,
} from "lucide-react";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function LaunchpadToken() {
  const { mint } = useParams<{ mint: string }>();
  const [copied, setCopied] = useState(false);
  const { data: t, isLoading, error } = useQuery({
    queryKey: ["orbitx-token", mint],
    queryFn: () => getToken(mint!),
    enabled: !!mint,
  });

  const copy = () => {
    if (!mint) return;
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (isLoading) return <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading token…</div>;

  if (error || !t)
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="text-lg font-bold text-foreground">Token not found</div>
        <div className="max-w-sm text-sm text-muted-foreground">No launch is registered for <span className="font-mono">{shortAddr(mint, 6)}</span> on Orbitx.</div>
        <Link to="/orbitxlaunch" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"><ArrowLeft className="h-4 w-4" /> Back to launchpad</Link>
      </div>
    );

  const graduated = !!t.lp_pool_address;
  const explorer = `https://solscan.io/token/${t.mint_address}${t.cluster !== "mainnet-beta" ? "?cluster=devnet" : ""}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/orbitxlaunch" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Launchpad</Link>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {t.logo_url ? <img src={t.logo_url} alt={t.ticker} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl font-black text-muted-foreground">{t.ticker?.slice(0, 2).toUpperCase()}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">{t.name}</h1>
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-muted-foreground">${t.ticker}</span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${t.launch_type === "pump" ? "bg-[hsl(var(--og-cyan))]/15 text-[hsl(var(--og-cyan))]" : "bg-[hsl(var(--og-gold))]/15 text-[hsl(var(--og-gold))]"}`}>{t.launch_type === "pump" ? "Pump launch" : "Custom launch"}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              {graduated
                ? <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--og-lime))]/15 px-2 py-0.5 font-bold text-[hsl(var(--og-lime))]"><Droplets className="h-3 w-3" /> Graduated</span>
                : <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--og-cyan))]/15 px-2 py-0.5 font-bold text-[hsl(var(--og-cyan))]"><Flame className="h-3 w-3" /> Fresh</span>}
              {t.is_vamp
                ? <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--og-blood))]/15 px-2 py-0.5 font-bold text-[hsl(var(--og-blood))]"><ShieldAlert className="h-3 w-3" /> Flagged vamp · fees → {t.fee_route === "orbitx_buyback" ? "OBX buyback" : t.fee_route}</span>
                : <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 font-bold text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Verified unique</span>}
              <span className="rounded-md bg-white/5 px-2 py-0.5 text-muted-foreground">{t.cluster}</span>
            </div>
          </div>
        </div>

        {/* CA */}
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5">
          <Coins className="h-4 w-4 shrink-0 text-[hsl(var(--og-gold))]" />
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{t.mint_address}</span>
          <button onClick={copy} className="shrink-0 rounded-lg border border-white/10 p-1.5 hover:bg-white/5" title="Copy CA">{copied ? <Check className="h-4 w-4 text-[hsl(var(--og-lime))]" /> : <Copy className="h-4 w-4" />}</button>
          <a href={explorer} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-white/10 p-1.5 hover:bg-white/5" title="View on Solscan"><ExternalLink className="h-4 w-4" /></a>
        </div>

        {/* Details */}
        <div className="mt-5 grid gap-x-8 gap-y-0 sm:grid-cols-2">
          <Row label="Supply">{Number(t.supply).toLocaleString()}</Row>
          <Row label="Decimals">{t.decimals}</Row>
          <Row label="DEX">{t.dex || "—"}</Row>
          <Row label="Fee routing">{t.fee_route === "orbitx_buyback" ? "OBX buyback" : t.fee_route === "og" ? "Original token" : "Creator"}</Row>
          <Row label="Creator"><span className="font-mono">{shortAddr(t.creator_wallet, 5)}</span></Row>
          <Row label="Launched">{timeAgo(t.created_at)}</Row>
          {t.lp_pool_address && <Row label="LP pool"><span className="font-mono">{shortAddr(t.lp_pool_address, 5)}</span></Row>}
          {t.mint_signature && <Row label="Mint tx"><a className="font-mono text-[hsl(var(--og-cyan))] hover:underline" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${t.mint_signature}${t.cluster !== "mainnet-beta" ? "?cluster=devnet" : ""}`}>{shortAddr(t.mint_signature, 5)}</a></Row>}
        </div>
      </div>
    </div>
  );
}
