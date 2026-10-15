// NFT detail page — full view with traits, sale history, and actions.
// Route: /nft/item/:id
import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, ExternalLink, Heart, Eye, Tag, Share2, Loader2,
  ShoppingCart, Gavel, HandCoins, Send, Flame, ShieldCheck, AlertTriangle, X,
} from "lucide-react";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import {
  getNftById, getListingForNft, listSalesForNft, incrementNftView,
  toggleNftFavorite, cancelNftListing, makeNftOffer, listOffersForNft,
  createNftAuction,
} from "@/lib/orbitx/nftRegistry";
import { deskNftBuy, deskNftList, deskNftApproveDelegate } from "@/lib/nftDesk";
import { TransferBurnModal } from "./TransferBurnModal";
import { shortAddr } from "@/pages/orbitx/_shared";

const sol = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL`;

const RARITY_COLOR: Record<string, string> = {
  Mythic: "text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10",
  Legendary: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  Epic: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  Rare: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  Common: "text-white/40 border-white/10 bg-white/[0.02]",
};

function ActionModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="mkt-panel w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-white/50" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function NftItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { address, ready } = useActiveTradingWallet();
  const [fav, setFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [showAuction, setShowAuction] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [price, setPrice] = useState("1");
  const [offerPrice, setOfferPrice] = useState("1");
  const [auctionStart, setAuctionStart] = useState("1");
  const [auctionStep, setAuctionStep] = useState("0.1");
  const [auctionHours, setAuctionHours] = useState("24");

  const { data: nft, isLoading } = useQuery({
    queryKey: ["nft-item", id],
    enabled: !!id,
    queryFn: async () => {
      const n = await getNftById(id!);
      if (n) incrementNftView(n.id);
      return n;
    },
  });
  const { data: listing } = useQuery({
    queryKey: ["nft-item-listing", id],
    enabled: !!id,
    queryFn: () => getListingForNft(id!),
  });
  const { data: sales } = useQuery({
    queryKey: ["nft-item-sales", id],
    enabled: !!id,
    queryFn: () => listSalesForNft(id!),
  });
  const { data: offers } = useQuery({
    queryKey: ["nft-item-offers", id],
    enabled: !!id,
    queryFn: () => listOffersForNft(id!),
    refetchInterval: 20_000,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-20 text-sm mkt-muted"><Loader2 className="h-5 w-5 animate-spin" /> Loading NFT…</div>;
  }
  if (!nft) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="text-lg font-black text-white">NFT not found</div>
        <Link to="/nft/explore" className="mkt-btn ghost mt-4">Back to explore</Link>
      </div>
    );
  }

  const isOwner = address && nft.current_owner === address;
  const activeOffers = (offers ?? []).filter((o) => o.status === "active");
  const prices = (sales ?? []).map((s) => Number(s.amount_sol) || 0);
  const stats = prices.length
    ? { count: prices.length, high: Math.max(...prices), low: Math.min(...prices), avg: prices.reduce((a, b) => b + a, 0) / prices.length, last: prices[0] }
    : null;

  const doFav = async () => {
    if (!address) return toast.error("Link your in-app wallet to favorite");
    setFavBusy(true);
    try {
      const now = await toggleNftFavorite(nft.id, address);
      setFav(now);
      qc.invalidateQueries({ queryKey: ["nft-item", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setFavBusy(false); }
  };

  const doBuy = async () => {
    if (!ready || !listing) return toast.error("Link your in-app wallet first");
    setBusy("buy");
    try {
      const { signature, totalSol } = await deskNftBuy({ listingId: listing.id, mode: "listing" });
      toast.success(`Purchased!${totalSol ? ` ${totalSol} SOL` : ""} settled on-chain`, { description: `https://solscan.io/tx/${signature}` });
      qc.invalidateQueries({ queryKey: ["nft-item", id] });
      qc.invalidateQueries({ queryKey: ["nft-item-listing", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Purchase failed"); }
    finally { setBusy(null); }
  };

  const doList = async () => {
    if (!ready) return toast.error("Link your in-app wallet first");
    const p = Number(price);
    if (!p || p <= 0) return toast.error("Enter a valid price");
    setBusy("list");
    try {
      await deskNftList({ nftId: nft.id, mint: nft.mint_address, priceSol: p });
      toast.success(`Listed for ${p} SOL — backend-signed`);
      setShowList(false);
      qc.invalidateQueries({ queryKey: ["nft-item", id] });
      qc.invalidateQueries({ queryKey: ["nft-item-listing", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Listing failed"); }
    finally { setBusy(null); }
  };

  const doCancel = async () => {
    if (!address || !listing) return;
    setBusy("cancel");
    try {
      await cancelNftListing(nft.id, address);
      toast.success("Listing cancelled");
      qc.invalidateQueries({ queryKey: ["nft-item", id] });
      qc.invalidateQueries({ queryKey: ["nft-item-listing", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Cancel failed"); }
    finally { setBusy(null); }
  };

  const doOffer = async () => {
    if (!address) return toast.error("Link your in-app wallet first");
    const p = Number(offerPrice);
    if (!p || p <= 0) return toast.error("Enter a valid offer");
    setBusy("offer");
    try {
      await makeNftOffer(nft.id, address, p);
      toast.success(`Offer of ${p} SOL sent (72h expiry)`);
      setShowOffer(false);
      qc.invalidateQueries({ queryKey: ["nft-item-offers", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Offer failed"); }
    finally { setBusy(null); }
  };

  const doAuction = async () => {
    if (!ready || !address) return toast.error("Link your in-app wallet first");
    setBusy("auction");
    try {
      await deskNftApproveDelegate(nft.mint_address);
      await createNftAuction(nft.id, address, Number(auctionStart), Number(auctionStep), Number(auctionHours));
      toast.success("Auction started");
      setShowAuction(false);
      qc.invalidateQueries({ queryKey: ["nft-item", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Auction failed"); }
    finally { setBusy(null); }
  };

  const share = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => toast.success("Link copied")).catch(() => toast.error("Copy failed"));
  };

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={() => navigate(-1)} className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back</button>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Media */}
        <div className="mkt-panel overflow-hidden">
          <div className="aspect-square w-full bg-black/40">
            {nft.image_url ? (
              <img src={nft.image_url} alt={nft.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/20">No image</div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-white/5 p-3">
            <div className="flex items-center gap-2">
              <button onClick={doFav} disabled={favBusy} title="Favorite" className="rounded-full border border-white/10 p-2 transition hover:border-white/30">
                <Heart className={`h-4 w-4 ${fav ? "fill-red-500 text-red-500" : "text-white/60"}`} />
              </button>
              <button onClick={share} title="Share" className="rounded-full border border-white/10 p-2 transition hover:border-white/30">
                <Share2 className="h-4 w-4 text-white/60" />
              </button>
              <a href={`https://solscan.io/token/${nft.mint_address}`} target="_blank" rel="noreferrer" title="View on Solscan" className="rounded-full border border-white/10 p-2 transition hover:border-white/30">
                <ExternalLink className="h-4 w-4 text-white/60" />
              </a>
            </div>
            <div className="flex items-center gap-3 text-[11px] mkt-muted">
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {nft.view_count ?? 0}</span>
              <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {nft.favorite_count ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Details + actions */}
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {nft.rarity_tier && (
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${RARITY_COLOR[nft.rarity_tier] ?? RARITY_COLOR.Common}`}>
                  {nft.rarity_tier}{nft.rarity_rank ? ` #${nft.rarity_rank}` : ""}
                </span>
              )}
              {nft.is_flagged_duplicate && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                  <AlertTriangle className="h-3 w-3" /> Possible duplicate
                </span>
              )}
              <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide mkt-muted">{nft.status}</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{nft.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] mkt-muted">
              {nft.symbol && <span className="font-mono font-bold text-cyan-300">${nft.symbol}</span>}
              <button onClick={() => { navigator.clipboard?.writeText(nft.mint_address); toast.success("Mint copied"); }} className="inline-flex items-center gap-1 font-mono hover:text-white">
                <Copy className="h-3 w-3" /> {shortAddr(nft.mint_address, 6)}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-widest mkt-muted">Creator</div>
                <Link to={`/nft/profile/${nft.creator_wallet}`} className="font-mono font-bold text-white hover:text-cyan-300">{shortAddr(nft.creator_wallet, 6)}</Link>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-widest mkt-muted">Owner</div>
                <Link to={`/nft/profile/${nft.current_owner}`} className="font-mono font-bold text-white hover:text-cyan-300">{shortAddr(nft.current_owner, 6)}</Link>
              </div>
            </div>
          </div>

          {/* Price / actions */}
          <div className="mkt-panel p-4">
            {listing ? (
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest mkt-muted">Listed price</div>
                  <div className="text-2xl font-black text-emerald-400">{sol(listing.price_sol)}</div>
                </div>
                <div className="text-right font-mono text-[10px] mkt-muted">Seller<br />{shortAddr(listing.seller_wallet, 4)}</div>
              </div>
            ) : (
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest mkt-muted">Not listed for sale</div>
            )}
            <div className="flex flex-wrap gap-2">
              {listing && !isOwner && (
                <button onClick={doBuy} disabled={busy === "buy" || !ready} className="mkt-btn primary flex-1 justify-center py-2.5">
                  {busy === "buy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShoppingCart className="h-4 w-4" /> Buy now</>}
                </button>
              )}
              {isOwner && !listing && (
                <>
                  <button onClick={() => setShowList(true)} className="mkt-btn primary flex-1 justify-center py-2.5"><Tag className="h-4 w-4" /> List for sale</button>
                  <button onClick={() => setShowAuction(true)} className="mkt-btn ghost flex-1 justify-center py-2.5"><Gavel className="h-4 w-4" /> Auction</button>
                </>
              )}
              {isOwner && listing && (
                <button onClick={doCancel} disabled={busy === "cancel"} className="mkt-btn ghost flex-1 justify-center py-2.5">
                  {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel listing"}
                </button>
              )}
              {!isOwner && !listing && (
                <button onClick={() => setShowOffer(true)} className="mkt-btn ghost flex-1 justify-center py-2.5"><HandCoins className="h-4 w-4" /> Make offer</button>
              )}
              {isOwner && (
                <button onClick={() => setShowManage(true)} className="mkt-btn ghost px-4 py-2.5" title="Transfer / Burn"><Send className="h-4 w-4" /></button>
              )}
            </div>
            {!ready && <div className="mt-2 text-center text-[11px] mkt-muted">Link your in-app wallet to trade.</div>}
          </div>

          {/* Traits */}
          {!!nft.attributes?.length && (
            <div className="mkt-panel p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest mkt-muted">Traits</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {nft.attributes.map((a, i) => (
                  <div key={i} className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-2.5 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-cyan-300/70">{a.trait_type}</div>
                    <div className="mt-0.5 truncate text-[13px] font-bold text-white">{a.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price stats */}
          {stats && (
            <div className="mkt-panel p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest mkt-muted">Price history · {stats.count} sale{stats.count === 1 ? "" : "s"}</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[["Last", stats.last], ["High", stats.high], ["Low", stats.low], ["Avg", stats.avg]].map(([label, v]) => (
                  <div key={label as string} className="rounded-xl bg-white/[0.03] p-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest mkt-muted">{label}</div>
                    <div className="mt-0.5 text-[13px] font-black text-white">{sol(v as number)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offers */}
          {!!activeOffers.length && (
            <div className="mkt-panel p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest mkt-muted">Active offers ({activeOffers.length})</div>
              <div className="space-y-1.5">
                {activeOffers.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12px]">
                    <span className="text-white">{shortAddr(o.buyer_wallet, 4)} offered <b className="text-emerald-400">{o.price_sol} SOL</b></span>
                    <span className="font-mono text-[10px] mkt-muted">expires {new Date(o.expires_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sale history */}
          {!!sales?.length && (
            <div className="mkt-panel p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest mkt-muted">Sale history</div>
              <div className="space-y-1.5">
                {sales.slice(0, 8).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12px]">
                    <span className="mkt-muted">{new Date(s.created_at).toLocaleDateString()} · {shortAddr(s.seller_wallet, 3)} → {shortAddr(s.buyer_wallet, 3)}</span>
                    <span className="font-mono font-bold text-emerald-400">{Number(s.amount_sol)} SOL</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-[11px] mkt-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            Settlement is atomic: SOL payment and NFT transfer happen in one transaction, or neither happens. Backend-signed by your in-app wallet — no popups.
          </div>
        </div>
      </div>

      {/* Modals */}
      {showList && (
        <ActionModal title={`List "${nft.name}" for sale`} onClose={() => setShowList(false)}>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest mkt-muted">Price (SOL)</div>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mkt-input w-full" />
          <p className="mt-2 text-[11px] mkt-muted">Approves OrbitX's marketplace delegate over just this NFT (revocable) so buyers can check out atomically.</p>
          <button onClick={doList} disabled={busy === "list"} className="mkt-btn primary mt-4 w-full justify-center">
            {busy === "list" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Tag className="h-4 w-4" /> List for sale</>}
          </button>
        </ActionModal>
      )}
      {showOffer && (
        <ActionModal title={`Offer on "${nft.name}"`} onClose={() => setShowOffer(false)}>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest mkt-muted">Offer (SOL)</div>
          <input type="number" min="0.01" step="0.01" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} className="mkt-input w-full" />
          <p className="mt-2 text-[11px] mkt-muted">Expires in 72 hours. If the owner accepts, you'll complete an atomic on-chain checkout.</p>
          <button onClick={doOffer} disabled={busy === "offer"} className="mkt-btn primary mt-4 w-full justify-center">
            {busy === "offer" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><HandCoins className="h-4 w-4" /> Send offer</>}
          </button>
        </ActionModal>
      )}
      {showAuction && (
        <ActionModal title={`Auction "${nft.name}"`} onClose={() => setShowAuction(false)}>
          <div className="grid grid-cols-3 gap-2">
            <div><div className="mb-1 font-mono text-[9px] uppercase mkt-muted">Start (SOL)</div><input type="number" min="0.01" step="0.01" value={auctionStart} onChange={(e) => setAuctionStart(e.target.value)} className="mkt-input w-full" /></div>
            <div><div className="mb-1 font-mono text-[9px] uppercase mkt-muted">Min step</div><input type="number" min="0.01" step="0.01" value={auctionStep} onChange={(e) => setAuctionStep(e.target.value)} className="mkt-input w-full" /></div>
            <div><div className="mb-1 font-mono text-[9px] uppercase mkt-muted">Hours</div><input type="number" min="1" max="168" value={auctionHours} onChange={(e) => setAuctionHours(e.target.value)} className="mkt-input w-full" /></div>
          </div>
          <button onClick={doAuction} disabled={busy === "auction"} className="mkt-btn primary mt-4 w-full justify-center">
            {busy === "auction" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Gavel className="h-4 w-4" /> Start auction</>}
          </button>
        </ActionModal>
      )}
      {showManage && (
        <TransferBurnModal mint={nft.mint_address} name={nft.name} onClose={() => setShowManage(false)} onDone={() => qc.invalidateQueries({ queryKey: ["nft-item", id] })} />
      )}
    </div>
  );
}
