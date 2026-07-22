// OrbitX NFT Marketplace — collection page with analytics strip (Phase 4) and
// item grid. Charts populate as the daily snapshot table accrues history.
import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listNftCollections, listNfts } from "@/lib/orbitx/nftRegistry";
import { Media, Verified, RarityBadge, Empty } from "./_ui";
import { fmtSol, fmtInt } from "./nftMarketData";
import { TrendingUp, Users, Package, Percent, ArrowLeft } from "lucide-react";

export default function CollectionPage() {
  const { id } = useParams();
  const { data: collections } = useQuery({ queryKey: ["nftmkt-collections"], queryFn: () => listNftCollections(200), staleTime: 30_000 });
  const { data: allNfts } = useQuery({ queryKey: ["nftmkt-nfts", 500], queryFn: () => listNfts(500), staleTime: 30_000 });

  const c = useMemo(() => (collections ?? []).find((x) => x.id === id) ?? null, [collections, id]);
  const items = useMemo(() => (allNfts ?? []).filter((n) => n.collection_id === id), [allNfts, id]);
  const holders = useMemo(() => new Set(items.map((n) => n.current_owner)).size, [items]);

  if (collections && !c) return <div><Link to="/nft" className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back</Link><Empty label="Collection not found." /></div>;

  return (
    <div>
      <Link to="/nft" className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back to marketplace</Link>
      <div className="mkt-panel overflow-hidden">
        <Media src={c?.banner_url ?? c?.logo_url} className="h-40 w-full sm:h-52" />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:p-6">
          <Media src={c?.logo_url} className="-mt-16 h-24 w-24 rounded-2xl border-2 border-[hsl(var(--mkt-panel))]" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-black">{c?.name ?? "…"} <Verified show={c?.verified} className="h-5 w-5" /></h1>
            {c?.description && <p className="mt-1 max-w-xl text-[13px] mkt-muted line-clamp-2">{c.description}</p>}
          </div>
        </div>
      </div>

      {/* analytics strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric icon={TrendingUp} label="Floor" value={c?.floor_price_sol ? fmtSol(c.floor_price_sol) : "—"} tone="lime" />
        <Metric icon={Package} label="Volume" value={c?.volume_sol ? fmtSol(c.volume_sol) : "—"} />
        <Metric icon={Users} label="Holders" value={fmtInt(holders)} />
        <Metric icon={Package} label="Items" value={fmtInt(items.length)} />
        <Metric icon={Percent} label="Royalty" value={c ? `${(c.royalty_bps / 100).toFixed(1)}%` : "—"} tone="gold" />
      </div>

      <div className="mt-4 mkt-panel p-5">
        <div className="text-sm font-black">Volume history</div>
        <div className="mt-3 flex h-40 items-center justify-center rounded-xl border border-dashed mkt-hairline text-[12px] mkt-muted">
          Daily / weekly / monthly charts populate from the collection snapshot table (v4 migration).
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-lg font-black">Items <span className="mkt-muted text-sm font-semibold">({items.length})</span></div>
        {items.length === 0 ? <Empty label="No items in this collection yet." /> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((n) => (
              <Link key={n.id} to="/nft/explore" className="mkt-card">
                <Media src={n.image_url} className="aspect-square w-full" />
                <div className="flex items-center justify-between gap-2 p-3"><span className="truncate text-[13px] font-bold">{n.name}</span><RarityBadge tier={n.rarity_tier} rank={n.rarity_rank} /></div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "lime" | "gold" }) {
  const color = tone === "lime" ? "text-[hsl(var(--og-lime))]" : tone === "gold" ? "text-[hsl(var(--og-gold))]" : "";
  return (
    <div className="mkt-panel p-4">
      <div className="flex items-center gap-1.5 mkt-mono text-[10px] uppercase tracking-widest mkt-muted"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`mt-1 text-lg font-black ${color}`}>{value}</div>
    </div>
  );
}
