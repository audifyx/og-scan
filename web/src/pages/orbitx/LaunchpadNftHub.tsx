// OrbitX NFT Hub — Explore (real OrbitX-minted collections/NFTs), My NFTs
// (everything the connected wallet actually owns, on-chain via Helius, plus
// what it created through OrbitX), and Creator Studio entry point.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWalletNfts } from "./nfts";
import { shortAddr } from "./_shared";
import {
  listNftCollections, listNfts, listNftsByCreator, listCollectionsByCreator,
  listNft, cancelNftListing, type OrbitxNft,
} from "@/lib/orbitx/nftRegistry";
import {
  Wallet, Loader2, Image as ImageIcon, Layers, Sparkles, Send, Twitter, ExternalLink,
  ShieldCheck, Plus, Tag, X, Rocket,
} from "lucide-react";

type Tab = "explore" | "mine" | "created";

function ListModal({ nft, onClose, onListed }: { nft: OrbitxNft; onClose: () => void; onListed: () => void }) {
  const [price, setPrice] = useState("1");
  const [busy, setBusy] = useState(false);
  const { publicKey } = useWallet();
  const submit = async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      await listNft(nft.id, publicKey.toBase58(), Number(price));
      toast.success(`Listed ${nft.name} for ${price} SOL`);
      onListed(); onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing failed");
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="pf-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-[hsl(var(--pf-ink))]">List "{nft.name}" for sale</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-[hsl(var(--pf-muted))]" /></button>
        </div>
        <div className="mb-1 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Price (SOL)</div>
        <input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2 text-sm text-[hsl(var(--pf-ink))] outline-none focus:border-[hsl(var(--pf-green))]" />
        <p className="mt-2 text-[10px] text-[hsl(var(--pf-muted))]">This publishes a real "for sale" listing on OrbitX. Escrowed, trustless checkout (buy now) is in progress — see the NFT Hub notice for details.</p>
        <button onClick={submit} disabled={busy} className="pf-btn mt-4 w-full justify-center">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />} List for sale</button>
      </div>
    </div>
  );
}

export default function LaunchpadNftHub() {
  const { connected, publicKey } = useWallet();
  const addr = publicKey?.toBase58();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("explore");
  const [filterCollection, setFilterCollection] = useState<string | null>(null);
  const [listingNft, setListingNft] = useState<OrbitxNft | null>(null);

  const { data: nfts, isLoading } = useWalletNfts(addr);
  const { data: collections, isLoading: loadingCollections } = useQuery({ queryKey: ["orbitx-nft-collections"], queryFn: () => listNftCollections(60) });
  const { data: allNfts, isLoading: loadingAllNfts } = useQuery({ queryKey: ["orbitx-nfts-all"], queryFn: () => listNfts(100) });
  const { data: createdNfts, isLoading: loadingCreated } = useQuery({ queryKey: ["orbitx-nfts-created", addr], queryFn: () => listNftsByCreator(addr!), enabled: !!addr });
  const { data: createdCollections } = useQuery({ queryKey: ["orbitx-collections-created", addr], queryFn: () => listCollectionsByCreator(addr!), enabled: !!addr });

  const ownedCollections = useMemo(() => {
    const map = new Map<string, number>();
    (nfts ?? []).forEach((n) => { const key = n.collection ?? "Ungrouped"; map.set(key, (map.get(key) ?? 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [nfts]);
  const visibleOwned = useMemo(() => (!filterCollection ? nfts ?? [] : (nfts ?? []).filter((n) => (n.collection ?? "Ungrouped") === filterCollection)), [nfts, filterCollection]);

  const officialCollections = (collections ?? []).filter((c) => c.is_official);
  const otherCollections = (collections ?? []).filter((c) => !c.is_official);

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "explore", label: "Explore", icon: Layers },
    { id: "mine", label: "My NFTs", icon: ImageIcon },
    { id: "created", label: "Created by me", icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {listingNft && <ListModal nft={listingNft} onClose={() => setListingNft(null)} onListed={() => qc.invalidateQueries({ queryKey: ["orbitx-nfts-created"] })} />}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[hsl(var(--pf-green))]" />
          <h1 className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">NFT Hub</h1>
        </div>
        <Link to="/orbitxlaunch/nft/create" className="pf-btn text-xs"><Plus className="h-3.5 w-3.5" /> Create NFT / Collection</Link>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-[hsl(var(--pf-muted))]">Real, on-chain NFTs minted through OrbitX, plus everything your connected wallet actually owns on Solana.</p>

      <div className="mb-5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${tab === t.id ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-ink))]"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "explore" && (
        <>
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

          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Collections</span>
          </div>
          {loadingCollections ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading collections…</div>
          ) : !otherCollections.length ? (
            <div className="pf-card mb-6 py-10 text-center text-sm text-[hsl(var(--pf-muted))]">No collections minted through OrbitX yet — be the first.</div>
          ) : (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {otherCollections.map((c) => (
                <div key={c.id} className="pf-card overflow-hidden">
                  <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{c.logo_url ? <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                  <div className="p-2">
                    <div className="flex items-center gap-1 truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{c.name} {c.verified && <ShieldCheck className="h-3 w-3 shrink-0 text-[hsl(var(--pf-green))]" />}</div>
                    <div className="pf-mono text-[9px] text-[hsl(var(--pf-muted))]">by {shortAddr(c.creator_wallet, 4)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Recently minted</div>
          {loadingAllNfts ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading NFTs…</div>
          ) : !allNfts?.length ? (
            <div className="pf-card py-10 text-center text-sm text-[hsl(var(--pf-muted))]">No NFTs minted through OrbitX yet.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {allNfts.map((n) => (
                <a key={n.id} href={`https://solscan.io/token/${n.mint_address}`} target="_blank" rel="noreferrer" className="pf-card overflow-hidden">
                  <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{n.image_url ? <img src={n.image_url} alt={n.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                  <div className="p-2"><div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{n.name}</div><div className="pf-mono text-[9px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">{n.status}</div></div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "mine" && (
        !connected || !addr ? (
          <div className="pf-card flex flex-col items-center gap-4 py-20 text-center"><Wallet className="h-7 w-7 text-[hsl(var(--pf-green))]" /><div className="text-sm font-bold text-[hsl(var(--pf-ink))]">Connect your wallet to see the NFTs you own.</div></div>
        ) : (
          <>
            {ownedCollections.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                <button onClick={() => setFilterCollection(null)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${!filterCollection ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))]"}`}>All ({nfts?.length ?? 0})</button>
                {ownedCollections.map(([key, count]) => (
                  <button key={key} onClick={() => setFilterCollection(key)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${filterCollection === key ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))]"}`}>{key === "Ungrouped" ? "Ungrouped" : shortAddr(key, 4)} ({count})</button>
                ))}
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> reading NFTs…</div>
            ) : !visibleOwned.length ? (
              <div className="pf-card flex flex-col items-center gap-3 py-16 text-center"><ImageIcon className="h-8 w-8 text-[hsl(var(--pf-muted))]" /><div className="text-sm font-bold text-[hsl(var(--pf-muted))]">No NFTs found in this wallet</div></div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {visibleOwned.map((n) => (
                  <a key={n.id} href={`https://solscan.io/token/${n.id}`} target="_blank" rel="noreferrer" className="pf-card overflow-hidden">
                    <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{n.image ? <img src={n.image} alt={n.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                    <div className="p-2"><div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{n.name}</div></div>
                  </a>
                ))}
              </div>
            )}
          </>
        )
      )}

      {tab === "created" && (
        !connected || !addr ? (
          <div className="pf-card flex flex-col items-center gap-4 py-20 text-center"><Wallet className="h-7 w-7 text-[hsl(var(--pf-green))]" /><div className="text-sm font-bold text-[hsl(var(--pf-ink))]">Connect your wallet to see what you've created.</div></div>
        ) : (
          <>
            {!!createdCollections?.length && (
              <div className="mb-6">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Your collections</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {createdCollections.map((c) => (
                    <div key={c.id} className="pf-card overflow-hidden">
                      <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{c.logo_url ? <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                      <div className="p-2"><div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{c.name}</div><div className="pf-mono text-[9px] text-[hsl(var(--pf-muted))]">{c.mint_address ? shortAddr(c.mint_address, 4) : "pending"}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">NFTs you minted</div>
            {loadingCreated ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading…</div>
            ) : !createdNfts?.length ? (
              <div className="pf-card flex flex-col items-center gap-3 py-16 text-center"><Sparkles className="h-8 w-8 text-[hsl(var(--pf-muted))]" /><div className="text-sm font-bold text-[hsl(var(--pf-muted))]">You haven't minted an NFT through OrbitX yet</div><Link to="/orbitxlaunch/nft/create" className="pf-btn text-xs"><Rocket className="h-3.5 w-3.5" /> Create one</Link></div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {createdNfts.map((n) => (
                  <div key={n.id} className="pf-card overflow-hidden">
                    <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">{n.image_url ? <img src={n.image_url} alt={n.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}</div>
                    <div className="p-2">
                      <div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{n.name}</div>
                      <div className="mb-1.5 pf-mono text-[9px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">{n.status} · {n.royalty_bps / 100}% royalty</div>
                      {n.current_owner === addr && (
                        n.status === "listed"
                          ? <button onClick={() => cancelNftListing(n.id, addr).then(() => qc.invalidateQueries({ queryKey: ["orbitx-nfts-created"] }))} className="w-full rounded-md border border-[hsl(var(--pf-border))] py-1 text-[10px] font-bold uppercase text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]">Cancel listing</button>
                          : <button onClick={() => setListingNft(n)} className="w-full rounded-md bg-[hsl(var(--pf-green))] py-1 text-[10px] font-bold uppercase text-black">List for sale</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}

      {/* Honest scope note */}
      <div className="og-glass-card mt-8 border-[hsl(var(--og-gold))]/25 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--og-gold))]" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[hsl(var(--og-gold))]">Marketplace checkout — in progress</h3>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          Minting, ownership, and listings above are fully real and on-chain today. Trustless <em className="text-foreground not-italic font-semibold">buying</em> (escrowed fixed-price sales, offers, and auctions with atomic settlement) is being built on Metaplex Auction House — an audited Solana program — rather than a custom escrow rushed out in one pass, since it directly moves people's SOL and NFTs.
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
