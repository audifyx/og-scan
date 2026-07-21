// OrbitX NFT Creator inventory dashboard — real-time stats for the Creator Pad.
import { useQuery } from "@tanstack/react-query";
import {
  Layers, Tag, ShoppingBag, Wallet, Coins, TrendingUp, Crown, Gem, ArrowDownWideNarrow, FileEdit,
} from "lucide-react";
import { getCreatorNftStats } from "@/lib/orbitx/nftStats";

const sol = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL`;

function Stat({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="pf-card group relative overflow-hidden p-3 transition-transform hover:-translate-y-0.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label}</span>
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--pf-green))]" />
      </div>
      <div className="pf-mono text-lg font-black text-[hsl(var(--pf-ink))]">{value}</div>
    </div>
  );
}

export default function CreatorInventory({ wallet }: { wallet: string }) {
  const { data: s, isLoading } = useQuery({
    queryKey: ["creator-nft-stats", wallet],
    queryFn: () => getCreatorNftStats(wallet),
    enabled: !!wallet,
    refetchInterval: 60_000,
  });

  if (isLoading || !s) {
    return <div className="pf-card mb-5 animate-pulse p-4 text-center text-xs text-[hsl(var(--pf-muted))]">Loading your NFT inventory…</div>;
  }
  if (s.totalMinted === 0 && s.collections === 0) return null;

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Layers className="h-4 w-4 text-[hsl(var(--pf-green))]" />
        <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Your NFT inventory</h2>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Minted" value={s.totalMinted} icon={Layers} />
        <Stat label="Listed" value={s.listed} icon={Tag} />
        <Stat label="Sold" value={s.sold} icon={ShoppingBag} />
        <Stat label="Owned now" value={s.ownedNow} icon={Wallet} />
        <Stat label="Active listings" value={s.activeListings} icon={Tag} />
        <Stat label="Collections" value={s.collections} icon={Layers} />
        <Stat label="Revenue" value={sol(s.revenueSol)} icon={Coins} />
        <Stat label="Royalties" value={sol(s.royaltiesSol)} icon={Crown} />
        <Stat label="Total volume" value={sol(s.volumeSol)} icon={TrendingUp} />
        <Stat label="Floor" value={sol(s.floorSol)} icon={ArrowDownWideNarrow} />
        <Stat label="Avg sale" value={sol(s.avgSaleSol)} icon={Gem} />
        <Stat label="Drafts" value={s.draftCollections} icon={FileEdit} />
      </div>
      {s.salesCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          <span>{s.salesCount} sales</span>
          <span>high {sol(s.highSaleSol)}</span>
          <span>low {sol(s.lowSaleSol)}</span>
        </div>
      )}
    </div>
  );
}
