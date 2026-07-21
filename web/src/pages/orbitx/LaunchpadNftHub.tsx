// OrbitX NFT Hub — Explore, Marketplace (real atomic buy/bid via the
// delegated-authority settlement flow), My NFTs, and Created-by-me, with
// rarity badges and fraud/duplicate warnings throughout.
import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWalletNfts } from "./nfts";
import { shortAddr } from "./_shared";
import {
  listNftCollections, listNfts, listNftsByCreator, listCollectionsByCreator,
  listNft, cancelNftListing, listActiveListings, listActiveAuctions, listOffersForNft,
  makeNftOffer, respondNftOffer, createNftAuction, placeNftBid,
  setNftDelegateApproved, listMyFavoriteIds, toggleNftFavorite, listRecentSales, type OrbitxNft, type NftOffer,
} from "@/lib/orbitx/nftRegistry";
import { approveMarketplaceDelegate, executeSale } from "@/lib/orbitx/nftMarketplace";
import NftDetailModal from "@/components/orbitx/NftDetailModal";
import { NFT_CATEGORIES } from "@/lib/orbitx/nftCategories";
import {
  Wallet, Loader2, Image as ImageIcon, Layers, Sparkles, Send, Twitter, ExternalLink,
  ShieldCheck, Plus, Tag, X, Rocket, ShoppingCart, Gavel, HandCoins, AlertTriangle, Crown,
  Heart, Eye, Search, Flame,
} from "lucide-react";

type Tab = "explore" | "market" | "mine" | "created";

const RARITY_COLOR: Record<string, string> = {
  Mythic: "text-[hsl(320_90%_65%)] border-[hsl(320_90%_65%)]/40 bg-[hsl(320_90%_65%)]/10",
  Legendary: "text-[hsl(var(--og-gold))] border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10",
  Epic: "text-[hsl(var(--og-cyan))] border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10",
  Rare: "text-[hsl(var(--pf-green))] border-[hsl(var(--pf-green))]/40 bg-[hsl(var(--pf-green))]/10",
  Common: "text-[hsl(var(--pf-muted))] border-[hsl(var(--pf-border))] bg-white/[0.02]",
};
function RarityBadge({ tier, rank }: { tier?: string | null; rank?: number | null }) {
  if (!tier) return null;
  return <span className={`rounded-full border px-1.5 py-0.5 pf-mono text-[8px] font-bold uppercase tracking-wide ${RARITY_COLOR[tier] ?? RARITY_COLOR.Common}`}>{tier}{rank ? ` #${rank}` : ""}</span>;
}

function ListModal({ nft, onClose, onListed }: { nft: OrbitxNft; onClose: () => void; onListed: () => void }) {
  const [price, setPrice] = useState("1");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "approving">("idle");
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const submit = async () => {
    if (!publicKey || !signTransaction) return;
    setBusy(true);
    try {
      if (!nft.delegate_approved) {
        setStep("approving");
        await approveMarketplaceDelegate(connection, signTransaction, publicKey, nft.mint_address);
        await setNftDelegateApproved(nft.id, publicKey.toBase58());
      }
      setStep("idle");
      await listNft(nft.id, publicKey.toBase58(), Number(price));
      toast.success(`Listed ${nft.name} for ${price} SOL`);
      onListed(); onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing failed");
    } finally { setBusy(false); setStep("idle"); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="pf-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-[hsl(var(--pf-ink))]">List "{nft.name}" for sale</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-[hsl(var(--pf-muted))]" /></button>
        </div>
        {!nft.delegate_approved && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10 p-2.5 text-[11px] text-[hsl(var(--pf-muted))]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--og-gold))]" />
            First-time listing: you'll approve OrbitX's marketplace authority as a delegate over just this 1 NFT (a normal, revocable Solana approval — it stays in your wallet). This lets a buyer complete checkout atomically later without you being online.
          </div>
        )}
        <div className="mb-1 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Price (SOL)</div>
        <input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2 text-sm text-[hsl(var(--pf-ink))] outline-none focus:border-[hsl(var(--pf-green))]" />
        <button onClick={submit} disabled={busy} className="pf-btn mt-4 w-full justify-center">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {step === "approving" ? "Approve delegate in wallet…" : "Listing…"}</> : <><Tag className="h-4 w-4" /> List for sale</>}
        </button>
      </div>
    </div>
  );
}

function OfferModal({ nft, onClose }: { nft: OrbitxNft; onClose: () => void }) {
  const [price, setPrice] = useState("1");
  const [busy, setBusy] = useState(false);
  const { publicKey } = useWallet();
  const submit = async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      await makeNftOffer(nft.id, publicKey.toBase58(), Number(price));
      toast.success(`Offer of ${price} SOL sent`);
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Offer failed"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="pf-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-[hsl(var(--pf-ink))]">Make an offer on "{nft.name}"</h3><button onClick={onClose}><X className="h-4 w-4 text-[hsl(var(--pf-muted))]" /></button></div>
        <div className="mb-1 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Offer (SOL)</div>
        <input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2 text-sm text-[hsl(var(--pf-ink))] outline-none focus:border-[hsl(var(--pf-green))]" />
        <p className="mt-2 text-[10px] text-[hsl(var(--pf-muted))]">Expires in 72 hours. If the owner accepts, you'll complete an atomic on-chain checkout for the agreed price.</p>
        <button onClick={submit} disabled={busy} className="pf-btn mt-4 w-full justify-center">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Send offer</button>
      </div>
    </div>
  );
}

function AuctionModal({ nft, onClose }: { nft: OrbitxNft; onClose: () => void }) {
  const [start, setStart] = useState("1");
  const [increment, setIncrement] = useState("0.1");
  const [hours, setHours] = useState("24");
  const [busy, setBusy] = useState(false);
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const submit = async () => {
    if (!publicKey || !signTransaction) return;
    setBusy(true);
    try {
      if (!nft.delegate_approved) {
        await approveMarketplaceDelegate(connection, signTransaction, publicKey, nft.mint_address);
        await setNftDelegateApproved(nft.id, publicKey.toBase58());
      }
      await createNftAuction(nft.id, publicKey.toBase58(), Number(start), Number(increment), Number(hours));
      toast.success("Auction started");
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Auction creation failed"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="pf-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-[hsl(var(--pf-ink))]">Auction "{nft.name}"</h3><button onClick={onClose}><X className="h-4 w-4 text-[hsl(var(--pf-muted))]" /></button></div>
        <div className="grid grid-cols-3 gap-2">
          <div><div className="mb-1 pf-mono text-[9px] uppercase text-[hsl(var(--pf-muted))]">Start (SOL)</div><input type="number" min="0.01" step="0.01" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-2 py-2 text-sm text-[hsl(var(--pf-ink))]" /></div>
          <div><div className="mb-1 pf-mono text-[9px] uppercase text-[hsl(var(--pf-muted))]">Min step</div><input type="number" min="0.01" step="0.01" value={increment} onChange={(e) => setIncrement(e.target.value)} className="w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-2 py-2 text-sm text-[hsl(var(--pf-ink))]" /></div>
          <div><div className="mb-1 pf-mono text-[9px] uppercase text-[hsl(var(--pf-muted))]">Hours</div><input type="number" min="1" max="168" value={hours} onChange={(e) => setHours(e.target.value)} className="w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-2 py-2 text-sm text-[hsl(var(--pf-ink))]" /></div>
        </div>
        <button onClick={submit} disabled={busy} className="pf-btn mt-4 w-full justify-center">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Start auction</button>
      </div>
    </div>
  );
}

function OffersPanel({ nft }: { nft: OrbitxNft }) {
  const { publicKey } = useWallet();
  const qc = useQueryClient();
  const { data: offers } = useQuery({ queryKey: ["orbitx-nft-offers", nft.id], queryFn: () => listOffersForNft(nft.id) });
  const active = (offers ?? []).filter((o) => o.status === "active");
  if (!active.length) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {active.map((o: NftOffer) => (
        <div key={o.id} className="flex items-center justify-between rounded-md bg-white/[0.03] px-1.5 py-1 text-[10px]">
          <span className="text-[hsl(var(--pf-ink))]">{shortAddr(o.buyer_wallet, 3)} offered {o.price_sol} SOL</span>
          {nft.current_owner === publicKey?.toBase58() && (
            <div className="flex gap-1">
              <button onClick={() => respondNftOffer(o.id, publicKey!.toBase58(), true).then(() => qc.invalidateQueries({ queryKey: ["orbitx-nft-offers", nft.id] }))} className="rounded bg-[hsl(var(--pf-green))] px-1.5 py-0.5 font-bold text-black">Accept</button>
              <button onClick={() => respondNftOffer(o.id, publicKey!.toBase58(), false).then(() => qc.invalidateQueries({ queryKey: ["orbitx-nft-offers", nft.id] }))} className="rounded border border-[hsl(var(--pf-border))] px-1.5 py-0.5 text-[hsl(var(--pf-muted))]">Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const chipCls = (a: boolean) => `rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition ${a ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-ink))]"}`;

export default function LaunchpadNftHub() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const addr = publicKey?.toBase58();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("explore");
  const [filterCollection, setFilterCollection] = useState<string | null>(null);
  const [listingNft, setListingNft] = useState<OrbitxNft | null>(null);
  const [offerNft, setOfferNft] = useState<OrbitxNft | null>(null);
  const [auctionNft, setAuctionNft] = useState<OrbitxNft | null>(null);
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [busySale, setBusySale] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [exploreSort, setExploreSort] = useState<"new" | "volume" | "floor">("new");
  const [detailNft, setDetailNft] = useState<OrbitxNft | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  const { data: nfts, isLoading } = useWalletNfts(addr);
  const { data: collections, isLoading: loadingCollections } = useQuery({ queryKey: ["orbitx-nft-collections"], queryFn: () => listNftCollections(60) });
  const { data: allNfts, isLoading: loadingAllNfts } = useQuery({ queryKey: ["orbitx-nfts-all"], queryFn: () => listNfts(100) });
  const { data: createdNfts, isLoading: loadingCreated } = useQuery({ queryKey: ["orbitx-nfts-created", addr], queryFn: () => listNftsByCreator(addr!), enabled: !!addr });
  const { data: createdCollections } = useQuery({ queryKey: ["orbitx-collections-created", addr], queryFn: () => listCollectionsByCreator(addr!), enabled: !!addr });
  const { data: activeListings, isLoading: loadingListings } = useQuery({ queryKey: ["orbitx-nft-active-listings"], queryFn: listActiveListings, refetchInterval: 20_000 });
  const { data: activeAuctions, isLoading: loadingAuctions } = useQuery({ queryKey: ["orbitx-nft-active-auctions"], queryFn: listActiveAuctions, refetchInterval: 15_000 });
  const { data: recentSales } = useQuery({ queryKey: ["orbitx-nft-recent-sales"], queryFn: () => listRecentSales(12), refetchInterval: 30_000 });

  const ownedCollections = useMemo(() => {
    const map = new Map<string, number>();
    (nfts ?? []).forEach((n) => { const key = n.collection ?? "Ungrouped"; map.set(key, (map.get(key) ?? 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [nfts]);
  const visibleOwned = useMemo(() => (!filterCollection ? nfts ?? [] : (nfts ?? []).filter((n) => (n.collection ?? "Ungrouped") === filterCollection)), [nfts, filterCollection]);

  const officialCollections = (collections ?? []).filter((c) => c.is_official);
  const otherCollections = (collections ?? []).filter((c) => !c.is_official);

  const q = search.trim().toLowerCase();
  const displayCollections = useMemo(() => {
    let list = otherCollections;
    if (category) list = list.filter((c) => c.category === category);
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || c.creator_wallet.toLowerCase().includes(q));
    if (exploreSort === "volume") list = [...list].sort((a, b) => (b.volume_sol || 0) - (a.volume_sol || 0));
    else if (exploreSort === "floor") list = [...list].sort((a, b) => (b.floor_price_sol || 0) - (a.floor_price_sol || 0));
    return list;
  }, [otherCollections, category, q, exploreSort]);
  const displayNfts = useMemo(() => {
    let list = allNfts ?? [];
    if (q) list = list.filter((n) => n.name.toLowerCase().includes(q) || n.mint_address.toLowerCase().includes(q) || n.creator_wallet.toLowerCase().includes(q));
    return list;
  }, [allNfts, q]);

  useEffect(() => { if (addr) listMyFavoriteIds(addr).then(setFavIds).catch(() => undefined); }, [addr]);
  const handleFav = async (n: OrbitxNft) => {
    if (!addr) { toast.error("Connect a wallet to favorite"); return; }
    try {
      const now = await toggleNftFavorite(n.id, addr);
      setFavIds((prev) => { const set = new Set(prev); if (now) set.add(n.id); else set.delete(n.id); return set; });
      qc.invalidateQueries({ queryKey: ["orbitx-nfts-all"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const buyListing = async (listingId: string, nftId: string) => {
    if (!publicKey || !signTransaction) { toast.error("Connect a wallet first"); return; }
    setBusySale(listingId);
    try {
      const { signature, breakdown } = await executeSale(connection, signTransaction, "listing", listingId, publicKey);
      toast.success(`Purchased! ${breakdown.totalSol} SOL settled on-chain — tx ${signature.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: ["orbitx-nft-active-listings"] });
      qc.invalidateQueries({ queryKey: ["orbitx-nfts-all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    } finally { setBusySale(null); }
  };

  const settleAuction = async (auctionId: string) => {
    if (!publicKey || !signTransaction) { toast.error("Connect a wallet first"); return; }
    setBusySale(auctionId);
    try {
      const { signature, breakdown } = await executeSale(connection, signTransaction, "auction", auctionId, publicKey);
      toast.success(`Auction settled! ${breakdown.totalSol} SOL — tx ${signature.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: ["orbitx-nft-active-auctions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Settlement failed");
    } finally { setBusySale(null); }
  };

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "explore", label: "Explore", icon: Layers },
    { id: "market", label: "Marketplace", icon: ShoppingCart },
    { id: "mine", label: "My NFTs", icon: ImageIcon },
    { id: "created", label: "Created by me", icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {listingNft && <ListModal nft={listingNft} onClose={() => setListingNft(null)} onListed={() => qc.invalidateQueries({ queryKey: ["orbitx-nfts-created"] })} />}
      {offerNft && <OfferModal nft={offerNft} onClose={() => setOfferNft(null)} />}
      {auctionNft && <AuctionModal nft={auctionNft} onClose={() => { setAuctionNft(null); qc.invalidateQueries({ queryKey: ["orbitx-nft-active-auctions"] }); }} />}
      {detailNft && <NftDetailModal nft={detailNft} wallet={addr} favorited={favIds.has(detailNft.id)} onClose={() => setDetailNft(null)} onToggleFavorite={(now) => setFavIds((prev) => { const set = new Set(prev); if (now) set.add(detailNft.id); else set.delete(detailNft.id); return set; })} onList={setListingNft} onOffer={setOfferNft} />}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Layers className="h-5 w-5 text-[hsl(var(--pf-green))]" /><h1 className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">NFT Hub</h1></div>
        <Link to="/orbitxlaunch/nft/create" className="pf-btn text-xs"><Plus className="h-3.5 w-3.5" /> Create NFT / Collection</Link>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-[hsl(var(--pf-muted))]">Real, on-chain NFTs minted through OrbitX — mint, list, offer, auction, and buy, all settled atomically on Solana.</p>

      <div className="mb-5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${tab === t.id ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-ink))]"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "explore" && (
        <>
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pf-muted))]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search NFTs, collections, creators, mint address…" className="w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] py-2 pl-9 pr-3 text-sm text-[hsl(var(--pf-ink))] outline-none focus:border-[hsl(var(--pf-green))]" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => setCategory(null)} className={chipCls(!category)}>All</button>
              {NFT_CATEGORIES.map((c) => (<button key={c} onClick={() => setCategory(category === c ? null : c)} className={chipCls(category === c)}>{c}</button>))}
            </div>
            <div className="flex items-center gap-1.5">
              {(["new", "volume", "floor"] as const).map((m) => (<button key={m} onClick={() => setExploreSort(m)} className={chipCls(exploreSort === m)}>{m === "new" ? "New" : m === "volume" ? "Top volume" : "Top floor"}</button>))}
            </div>
          </div>
          {officialCollections.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--og-gold))]" /><span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--og-gold))]">OrbitX Official</span></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {officialCollections.map((c) => (
                  <div key={c.id} className="pf-card overflow-hidden">
                    <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{c.logo_url ? <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                    <div className="p-2"><div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{c.name}</div><div className="pf-mono text-[9px] text-[hsl(var(--pf-muted))]">Floor {c.floor_price_sol ?? "—"} SOL</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Collections</div>
          {loadingCollections ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading…</div>
            : !displayCollections.length ? <div className="pf-card mb-6 py-10 text-center text-sm text-[hsl(var(--pf-muted))]">No collections match.</div>
            : <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{displayCollections.map((c) => (
                <div key={c.id} className="pf-card overflow-hidden">
                  <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{c.logo_url ? <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                  <div className="p-2"><div className="flex items-center gap-1 truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{c.name} {c.verified && <ShieldCheck className="h-3 w-3 shrink-0 text-[hsl(var(--pf-green))]" />}</div><div className="pf-mono text-[9px] text-[hsl(var(--pf-muted))]">by {shortAddr(c.creator_wallet, 4)}</div></div>
                </div>
              ))}</div>}
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Recently minted</div>
          {loadingAllNfts ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading…</div>
            : !allNfts?.length ? <div className="pf-card py-10 text-center text-sm text-[hsl(var(--pf-muted))]">No NFTs minted through OrbitX yet.</div>
            : !displayNfts.length ? <div className="pf-card py-10 text-center text-sm text-[hsl(var(--pf-muted))]">No NFTs match.</div>
            : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{displayNfts.map((n) => (
                <div key={n.id} onClick={() => setDetailNft(n)} className="pf-card group relative cursor-pointer overflow-hidden transition-transform hover:-translate-y-0.5">
                  <button onClick={(e) => { e.stopPropagation(); handleFav(n); }} title="Favorite" className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/60 p-1.5 backdrop-blur transition hover:bg-black/80">
                    <Heart className={`h-3.5 w-3.5 ${favIds.has(n.id) ? "fill-[hsl(var(--og-blood))] text-[hsl(var(--og-blood))]" : "text-white"}`} />
                  </button>
                  <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{n.image_url ? <img src={n.image_url} alt={n.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                  <div className="space-y-1 p-2">
                    <div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{n.name}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1"><RarityBadge tier={n.rarity_tier} rank={n.rarity_rank} />{n.is_flagged_duplicate && <AlertTriangle className="h-3 w-3 text-[hsl(var(--og-blood))]" titleAccess="Possibly duplicated artwork" />}</div>
                      <span className="inline-flex items-center gap-1 pf-mono text-[9px] text-[hsl(var(--pf-muted))]"><Eye className="h-3 w-3" /> {n.view_count ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}</div>}

          {recentSales && recentSales.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-[hsl(var(--og-gold))]" /><span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Recently sold</span></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">{recentSales.filter((sale) => sale.nft).map((sale) => (
                <div key={sale.id} onClick={() => sale.nft && setDetailNft(sale.nft)} className="pf-card cursor-pointer overflow-hidden">
                  <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{sale.nft?.image_url ? <img src={sale.nft.image_url} alt={sale.nft.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                  <div className="space-y-0.5 p-2">
                    <div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{sale.nft?.name ?? "NFT"}</div>
                    <div className="pf-mono text-[10px] font-black text-[hsl(var(--pf-green))]">{Number(sale.amount_sol)} SOL</div>
                    <div className="pf-mono text-[8px] text-[hsl(var(--pf-muted))]">{new Date(sale.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}</div>
            </div>
          )}
        </>
      )}

      {tab === "market" && (
        <>
          <div className="mb-2 flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5 text-[hsl(var(--pf-green))]" /><span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Buy now</span></div>
          {loadingListings ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading listings…</div>
            : !activeListings?.length ? <div className="pf-card mb-6 py-10 text-center text-sm text-[hsl(var(--pf-muted))]">No active listings yet.</div>
            : <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{activeListings.map((l) => (
                <div key={l.id} className="pf-card overflow-hidden">
                  <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{l.nft.image_url ? <img src={l.nft.image_url} alt={l.nft.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                  <div className="space-y-1.5 p-2">
                    <div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{l.nft.name}</div>
                    <RarityBadge tier={l.nft.rarity_tier} rank={l.nft.rarity_rank} />
                    <div className="pf-mono text-sm font-black text-[hsl(var(--pf-green))]">{l.price_sol} SOL</div>
                    {l.seller_wallet === addr ? (
                      <button onClick={() => cancelNftListing(l.nft_id, addr!).then(() => qc.invalidateQueries({ queryKey: ["orbitx-nft-active-listings"] }))} className="w-full rounded-md border border-[hsl(var(--pf-border))] py-1 text-[10px] font-bold uppercase text-[hsl(var(--pf-muted))]">Cancel</button>
                    ) : (
                      <button onClick={() => buyListing(l.id, l.nft_id)} disabled={busySale === l.id} className="pf-btn w-full justify-center py-1 text-[10px]">{busySale === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />} Buy now</button>
                    )}
                  </div>
                </div>
              ))}</div>}

          <div className="mb-2 flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5 text-[hsl(var(--pf-green))]" /><span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Live auctions</span></div>
          {loadingAuctions ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading auctions…</div>
            : !activeAuctions?.length ? <div className="pf-card py-10 text-center text-sm text-[hsl(var(--pf-muted))]">No live auctions.</div>
            : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{activeAuctions.map((a) => {
                const ended = a.status === "ended" || new Date(a.ends_at).getTime() < Date.now();
                const canSettle = ended && (a.highest_bidder === addr || a.seller_wallet === addr);
                return (
                  <div key={a.id} className="pf-card overflow-hidden">
                    <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{a.nft.image_url ? <img src={a.nft.image_url} alt={a.nft.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                    <div className="space-y-1.5 p-2">
                      <div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{a.nft.name}</div>
                      <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{ended ? "Ended" : `Ends ${new Date(a.ends_at).toLocaleString()}`}</div>
                      <div className="pf-mono text-sm font-black text-[hsl(var(--pf-gold))]">{a.highest_bid_sol ?? a.start_price_sol} SOL {a.highest_bidder ? <Crown className="inline h-3 w-3" /> : "(start)"}</div>
                      {!ended ? (
                        <div className="flex gap-1">
                          <input value={bidInputs[a.id] ?? ""} onChange={(e) => setBidInputs((s) => ({ ...s, [a.id]: e.target.value }))} placeholder={String((a.highest_bid_sol ?? a.start_price_sol) + a.min_increment_sol)} className="w-full rounded-md border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-1.5 py-1 text-[10px] text-[hsl(var(--pf-ink))]" />
                          <button onClick={() => placeNftBid(a.id, addr!, Number(bidInputs[a.id])).then(() => qc.invalidateQueries({ queryKey: ["orbitx-nft-active-auctions"] })).catch((e) => toast.error(e.message))} disabled={!addr} className="shrink-0 rounded-md bg-[hsl(var(--pf-green))] px-2 text-[10px] font-bold text-black">Bid</button>
                        </div>
                      ) : canSettle ? (
                        <button onClick={() => settleAuction(a.id)} disabled={busySale === a.id} className="pf-btn w-full justify-center py-1 text-[10px]">{busySale === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gavel className="h-3 w-3" />} Settle</button>
                      ) : (
                        <div className="pf-mono text-[9px] text-[hsl(var(--pf-muted))]">Awaiting settlement</div>
                      )}
                    </div>
                  </div>
                );
              })}</div>}
        </>
      )}

      {tab === "mine" && (
        !connected || !addr ? <div className="pf-card flex flex-col items-center gap-4 py-20 text-center"><Wallet className="h-7 w-7 text-[hsl(var(--pf-green))]" /><div className="text-sm font-bold text-[hsl(var(--pf-ink))]">Connect your wallet to see the NFTs you own.</div></div>
        : (
          <>
            {ownedCollections.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                <button onClick={() => setFilterCollection(null)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${!filterCollection ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))]"}`}>All ({nfts?.length ?? 0})</button>
                {ownedCollections.map(([key, count]) => (<button key={key} onClick={() => setFilterCollection(key)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${filterCollection === key ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))]"}`}>{key === "Ungrouped" ? "Ungrouped" : shortAddr(key, 4)} ({count})</button>))}
              </div>
            )}
            {isLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> reading NFTs…</div>
              : !visibleOwned.length ? <div className="pf-card flex flex-col items-center gap-3 py-16 text-center"><ImageIcon className="h-8 w-8 text-[hsl(var(--pf-muted))]" /><div className="text-sm font-bold text-[hsl(var(--pf-muted))]">No NFTs found in this wallet</div></div>
              : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{visibleOwned.map((n) => (
                  <a key={n.id} href={`https://solscan.io/token/${n.id}`} target="_blank" rel="noreferrer" className="pf-card overflow-hidden">
                    <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{n.image ? <img src={n.image} alt={n.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                    <div className="p-2"><div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{n.name}</div></div>
                  </a>
                ))}</div>}
          </>
        )
      )}

      {tab === "created" && (
        !connected || !addr ? <div className="pf-card flex flex-col items-center gap-4 py-20 text-center"><Wallet className="h-7 w-7 text-[hsl(var(--pf-green))]" /><div className="text-sm font-bold text-[hsl(var(--pf-ink))]">Connect your wallet to see what you've created.</div></div>
        : (
          <>
            {!!createdCollections?.length && (
              <div className="mb-6">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Your collections</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{createdCollections.map((c) => (
                  <div key={c.id} className="pf-card overflow-hidden">
                    <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{c.logo_url ? <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                    <div className="p-2"><div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{c.name}</div><div className="pf-mono text-[9px] text-[hsl(var(--pf-muted))]">{c.mint_address ? shortAddr(c.mint_address, 4) : "pending"}</div></div>
                  </div>
                ))}</div>
              </div>
            )}
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">NFTs you minted</div>
            {loadingCreated ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading…</div>
              : !createdNfts?.length ? <div className="pf-card flex flex-col items-center gap-3 py-16 text-center"><Sparkles className="h-8 w-8 text-[hsl(var(--pf-muted))]" /><div className="text-sm font-bold text-[hsl(var(--pf-muted))]">You haven't minted an NFT through OrbitX yet</div><Link to="/orbitxlaunch/nft/create" className="pf-btn text-xs"><Rocket className="h-3.5 w-3.5" /> Create one</Link></div>
              : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{createdNfts.map((n) => (
                  <div key={n.id} className="pf-card overflow-hidden">
                    <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{n.image_url ? <img src={n.image_url} alt={n.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                    <div className="space-y-1 p-2">
                      <div className="flex items-center gap-1 truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{n.name} {n.is_flagged_duplicate && <AlertTriangle className="h-3 w-3 shrink-0 text-[hsl(var(--og-blood))]" />}</div>
                      <div className="flex items-center gap-1"><RarityBadge tier={n.rarity_tier} rank={n.rarity_rank} /><span className="pf-mono text-[9px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">{n.status} · {n.royalty_bps / 100}%</span></div>
                      {n.current_owner === addr && (
                        <div className="flex flex-wrap gap-1">
                          {n.status === "listed" ? (
                            <button onClick={() => cancelNftListing(n.id, addr).then(() => qc.invalidateQueries({ queryKey: ["orbitx-nfts-created"] }))} className="flex-1 rounded-md border border-[hsl(var(--pf-border))] py-1 text-[9px] font-bold uppercase text-[hsl(var(--pf-muted))]">Cancel</button>
                          ) : (
                            <>
                              <button onClick={() => setListingNft(n)} className="flex-1 rounded-md bg-[hsl(var(--pf-green))] py-1 text-[9px] font-bold uppercase text-black">List</button>
                              <button onClick={() => setAuctionNft(n)} className="flex-1 rounded-md border border-[hsl(var(--pf-border))] py-1 text-[9px] font-bold uppercase text-[hsl(var(--pf-ink))]">Auction</button>
                            </>
                          )}
                        </div>
                      )}
                      {n.current_owner !== addr && <button onClick={() => setOfferNft(n)} className="w-full rounded-md border border-[hsl(var(--pf-border))] py-1 text-[9px] font-bold uppercase text-[hsl(var(--pf-ink))]">Make offer</button>}
                      <OffersPanel nft={n} />
                    </div>
                  </div>
                ))}</div>}
          </>
        )
      )}

      <div className="og-glass-card mt-8 border-[hsl(var(--og-gold))]/25 p-5">
        <div className="mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[hsl(var(--og-gold))]" /><h3 className="font-display text-sm font-bold uppercase tracking-wide text-[hsl(var(--og-gold))]">How settlement works</h3></div>
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          Buying and auction settlement are real, atomic on-chain transactions: your SOL payment and the NFT transfer happen in the same transaction, or neither happens. Sellers approve a revocable, OrbitX-only transfer delegate over a listed NFT (never full custody) so buyers can check out without the seller being online. Offers and bids are tracked live; accepting an offer or winning an auction unlocks the same atomic checkout.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="https://t.me/ogscan" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pf-border))] px-3 py-2 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--og-cyan))]"><Send className="h-3.5 w-3.5" /> Follow progress</a>
          <a href="https://x.com/ogscan" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pf-border))] px-3 py-2 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--og-cyan))]"><Twitter className="h-3.5 w-3.5" /> X / Twitter</a>
          <Link to="/orbitxlaunch/nft/create" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-3 py-2 text-xs font-bold text-[hsl(var(--og-gold))] hover:bg-[hsl(var(--og-gold))]/25"><ExternalLink className="h-3.5 w-3.5" /> Mint an NFT now</Link>
        </div>
      </div>
    </div>
  );
}
