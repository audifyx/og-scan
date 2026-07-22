// OrbitX NFT Marketplace — Launch Drops (Phase 3). Scheduled mints with
// whitelist/public/private access, wallet + supply limits, and a live countdown.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listDrops, dropPhase, countdown, type NftDrop } from "./drops";
import { Media, SectionHeader, Empty } from "./_ui";
import { fmtSol } from "./nftMarketData";
import { Rocket, Clock, Lock, Users, PlusCircle } from "lucide-react";

const PHASE_LABEL: Record<string, string> = { upcoming: "Upcoming", whitelist: "Whitelist live", public: "Public live", ended: "Ended" };
const PHASE_TONE: Record<string, string> = {
  upcoming: "text-[hsl(var(--og-gold))] border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10",
  whitelist: "text-[hsl(var(--og-cyan))] border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10",
  public: "text-[hsl(var(--og-lime))] border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10",
  ended: "mkt-muted border-[hsl(var(--mkt-line))] bg-white/[0.03]",
};

export default function Drops() {
  const { data, isLoading } = useQuery({ queryKey: ["nftmkt-drops"], queryFn: listDrops, staleTime: 20_000 });
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const drops = data ?? [];

  return (
    <div>
      <SectionHeader
        title="Launch drops"
        sub="Scheduled mints — whitelist, public, and private, with wallet + supply caps"
        action={<Link to="/nft/create" className="mkt-btn"><PlusCircle className="h-4 w-4" /> Create a drop</Link>}
      />
      {isLoading ? <div className="px-4 py-10 text-center text-sm mkt-muted">Loading…</div> :
        drops.length === 0 ? (
          <div className="mkt-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Rocket className="h-8 w-8 text-[hsl(var(--og-cyan))]" />
            <div className="text-sm font-bold">No drops scheduled yet</div>
            <p className="max-w-sm text-[12px] mkt-muted">Schedule a mint with whitelist and public phases, per-wallet limits, and a total supply cap. Buyers get a live countdown.</p>
            <Link to="/nft/create" className="mkt-btn mt-1"><PlusCircle className="h-4 w-4" /> Create your first drop</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {drops.map((d) => <DropCard key={d.id} d={d} />)}
          </div>
        )}
    </div>
  );
}

function DropCard({ d }: { d: NftDrop }) {
  const phase = dropPhase(d);
  const target = phase === "upcoming" ? d.starts_at : d.ends_at;
  const pct = d.supply ? Math.min(100, Math.round((d.minted / d.supply) * 100)) : 0;
  return (
    <div className="mkt-card">
      <div className="relative"><Media src={d.banner_url ?? d.logo_url} className="aspect-[16/10] w-full" />
        <span className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${PHASE_TONE[phase]}`}>{PHASE_LABEL[phase]}</span>
        {d.access !== "public" && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border mkt-hairline bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase"><Lock className="h-3 w-3" /> {d.access}</span>}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2"><Media src={d.logo_url} className="h-8 w-8 rounded-lg" /><div className="truncate font-bold">{d.name}</div></div>
        {d.description && <p className="mt-2 line-clamp-2 text-[12px] mkt-muted">{d.description}</p>}
        <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div><div className="mkt-muted">Price</div><div className="mkt-mono font-bold">{d.mint_price_sol ? fmtSol(d.mint_price_sol) : "Free"}</div></div>
          <div><div className="mkt-muted inline-flex items-center gap-1"><Users className="h-3 w-3" /> Per wallet</div><div className="mkt-mono font-bold">{d.per_wallet_limit ?? "∞"}</div></div>
        </div>
        {d.supply != null && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] mkt-muted"><span>Minted</span><span className="mkt-mono">{d.minted}/{d.supply}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--mkt-panel-2))]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, hsl(var(--og-cyan)), hsl(var(--og-lime)))" }} /></div>
          </div>
        )}
        {phase !== "ended" && target && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border mkt-hairline bg-[hsl(var(--mkt-panel-2))] px-2.5 py-1.5 text-[12px]">
            <Clock className="h-3.5 w-3.5 text-[hsl(var(--og-gold))]" />
            <span className="mkt-muted">{phase === "upcoming" ? "Starts in" : "Ends in"}</span>
            <span className="mkt-mono font-bold">{countdown(target)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
