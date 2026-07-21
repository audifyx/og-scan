// OrbitX NFT detail modal — full NFT view with traits, on-chain analytics
// (sale history + price stats), and quick actions.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X, Copy, ExternalLink, Heart, Eye, Crown, Tag, Share2, Loader2, TrendingUp, Gavel, ShoppingCart,
} from "lucide-react";
import { listSalesForNft, incrementNftView, toggleNftFavorite, type OrbitxNft } from "@/lib/orbitx/nftRegistry";

const short = (a?: string | null, n = 4) => (a ? `${a.slice(0, n)}…${a.slice(-n)}` : "—");
const sol = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL`);

export default function NftDetailModal({
  nft, wallet, favorited, onClose, onToggleFavorite, onBuy, onList, onOffer,
}: {
  nft: OrbitxNft;
  wallet?: string;
  favorited?: boolean;
  onClose: () => void;
  onToggleFavorite?: (nowFav: boolean) => void;
  onBuy?: (nft: OrbitxNft) => void;
  onList?: (nft: OrbitxNft) => void;
  onOffer?: (nft: OrbitxNft) => void;
}) {
  const [fav, setFav] = useState(!!favorited);
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => { incrementNftView(nft.id); }, [nft.id]);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["nft-sales", nft.id],
    queryFn: () => listSalesForNft(nft.id),
  });

  const prices = (sales ?? []).map((s) => Number(s.amount_sol) || 0);
  const stats = prices.length
    ? { count: prices.length, high: Math.max(...prices), low: Math.min(...prices), avg: prices.reduce((a, b) => a + b, 0) / prices.length, last: prices[0] }
    : null;

  const isOwner = wallet && nft.current_owner === wallet;

  const doFav = async () => {
    if (!wallet) { toast.error("Connect a wallet to favorite"); return; }
    setFavBusy(true);
    try {
      const now = await toggleNftFavorite(nft.id, wallet);
      setFav(now);
      onToggleFavorite?.(now);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setFavBusy(false); }
  };

  const copyMint = () => { navigator.clipboard.writeText(nft.mint_address); toast.success("Mint address copied"); };
  const share = () => {
    const url = `${window.location.origin}/orbitxlaunch/nft?mint=${nft.mint_address}`;
    navigator.clipboard.writeText(url); toast.success("Share link copied");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="pf-card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-0 md:grid-cols-2">
          {/* media */}
          <div className="relative aspect-square w-full bg-[hsl(var(--pf-bg))]">
            {nft.image_url ? <img src={nft.image_url} alt={nft.name} className="h-full w-full object-cover" /> : null}
            {nft.rarity_tier && (
              <span className="absolute left-3 top-3 rounded-full border border-[hsl(var(--og-gold))]/50 bg-black/70 px-2 py-0.5 pf-mono text-[10px] font-bold uppercase text-[hsl(var(--og-gold))]">
                {nft.rarity_tier}{nft.rarity_rank ? ` #${nft.rarity_rank}` : ""}
              </span>
            )}
          </div>

          {/* details */}
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-[hsl(var(--pf-ink))]">{nft.name}</h3>
                {nft.symbol && <div className="pf-mono text-[11px] text-[hsl(var(--pf-muted))]">${nft.symbol}</div>}
              </div>
              <button onClick={onClose}><X className="h-5 w-5 text-[hsl(var(--pf-muted))]" /></button>
            </div>

            <div className="flex items-center gap-3 pf-mono text-[11px] text-[hsl(var(--pf-muted))]">
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {nft.view_count ?? 0}</span>
              <span className="inline-flex items-center gap-1"><Heart className={`h-3.5 w-3.5 ${fav ? "fill-[hsl(var(--og-blood))] text-[hsl(var(--og-blood))]" : ""}`} /> {nft.favorite_count ?? 0}</span>
              <span className="inline-flex items-center gap-1"><Crown className="h-3.5 w-3.5" /> {(nft.royalty_bps / 100).toFixed(1)}% royalty</span>
            </div>

            <div className="space-y-1 text-xs">
              {[["Owner", nft.current_owner], ["Creator", nft.creator_wallet], ["Mint", nft.mint_address], ["Status", nft.status]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-[hsl(var(--pf-muted))]">{k}</span>
                  <span className="pf-mono text-[hsl(var(--pf-ink))]">{k === "Status" ? v : short(v as string)}</span>
                </div>
              ))}
            </div>

            {/* actions */}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={doFav} disabled={favBusy} className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--pf-border))] px-2 py-1 text-[11px] font-bold text-[hsl(var(--pf-ink))]">
                {favBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className={`h-3 w-3 ${fav ? "fill-[hsl(var(--og-blood))] text-[hsl(var(--og-blood))]" : ""}`} />} {fav ? "Favorited" : "Favorite"}
              </button>
              <button onClick={share} className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--pf-border))] px-2 py-1 text-[11px] font-bold text-[hsl(var(--pf-ink))]"><Share2 className="h-3 w-3" /> Share</button>
              <button onClick={copyMint} className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--pf-border))] px-2 py-1 text-[11px] font-bold text-[hsl(var(--pf-ink))]"><Copy className="h-3 w-3" /> Copy mint</button>
              <a href={`https://solscan.io/token/${nft.mint_address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--pf-border))] px-2 py-1 text-[11px] font-bold text-[hsl(var(--pf-ink))]"><ExternalLink className="h-3 w-3" /> Solscan</a>
              {isOwner && onList && nft.status !== "listed" && <button onClick={() => { onList(nft); onClose(); }} className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--pf-green))] px-2 py-1 text-[11px] font-bold text-black"><Tag className="h-3 w-3" /> List</button>}
              {!isOwner && onOffer && <button onClick={() => { onOffer(nft); onClose(); }} className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--pf-border))] px-2 py-1 text-[11px] font-bold text-[hsl(var(--pf-ink))]"><Gavel className="h-3 w-3" /> Make offer</button>}
              {!isOwner && onBuy && nft.status === "listed" && <button onClick={() => { onBuy(nft); onClose(); }} className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--pf-green))] px-2 py-1 text-[11px] font-bold text-black"><ShoppingCart className="h-3 w-3" /> Buy</button>}
            </div>

            {/* traits */}
            {nft.attributes?.length > 0 && (
              <div>
                <div className="mb-1 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Traits</div>
                <div className="flex flex-wrap gap-1.5">
                  {nft.attributes.map((a, i) => (
                    <div key={i} className="rounded-md border border-[hsl(var(--pf-border))] px-2 py-1">
                      <div className="pf-mono text-[8px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">{a.trait_type}</div>
                      <div className="text-[11px] font-bold text-[hsl(var(--pf-ink))]">{a.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* analytics */}
        <div className="border-t border-[hsl(var(--pf-border))] p-4">
          <div className="mb-2 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--pf-green))]" /><span className="pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Sale analytics</span></div>
          {stats && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[["Sales", String(stats.count)], ["Last", sol(stats.last)], ["Avg", sol(stats.avg)], ["High", sol(stats.high)], ["Low", sol(stats.low)]].map(([k, v]) => (
                <div key={k} className="rounded-md border border-[hsl(var(--pf-border))] p-2 text-center">
                  <div className="pf-mono text-[8px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">{k}</div>
                  <div className="pf-mono text-xs font-black text-[hsl(var(--pf-ink))]">{v}</div>
                </div>
              ))}
            </div>
          )}
          {isLoading ? <div className="py-4 text-center text-xs text-[hsl(var(--pf-muted))]"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
            : !sales?.length ? <div className="py-3 text-center text-xs text-[hsl(var(--pf-muted))]">No sales yet.</div>
            : (
              <div className="space-y-1">
                {sales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md px-2 py-1 text-[11px] hover:bg-white/5">
                    <span className="pf-mono text-[hsl(var(--pf-muted))]">{new Date(s.created_at).toLocaleDateString()}</span>
                    <span className="pf-mono text-[hsl(var(--pf-muted))]">{short(s.seller_wallet)} → {short(s.buyer_wallet)}</span>
                    <a href={`https://solscan.io/tx/${s.tx_signature}`} target="_blank" rel="noreferrer" className="pf-mono font-black text-[hsl(var(--pf-green))]">{sol(Number(s.amount_sol))}</a>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
