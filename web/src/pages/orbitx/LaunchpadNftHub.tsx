// OrbitX NFT Hub — v1. Shows real, live-owned NFTs for the connected wallet
// (via the same Helius DAS data source used across the launchpad), grouped
// by on-chain collection. On-chain NFT/collection CREATION is a separate,
// larger infra project (Metaplex mint program + IPFS pinning) and is called
// out honestly below rather than faked with a non-functional "Create" button.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletNfts } from "./nfts";
import { shortAddr } from "./_shared";
import { Wallet, Loader2, Image as ImageIcon, Layers, Sparkles, Send, Twitter, ExternalLink } from "lucide-react";

export default function LaunchpadNftHub() {
  const { connected, publicKey } = useWallet();
  const addr = publicKey?.toBase58();
  const { data: nfts, isLoading } = useWalletNfts(addr);
  const [filterCollection, setFilterCollection] = useState<string | null>(null);

  const collections = useMemo(() => {
    const map = new Map<string, number>();
    (nfts ?? []).forEach((n) => { const key = n.collection ?? "Ungrouped"; map.set(key, (map.get(key) ?? 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [nfts]);

  const visible = useMemo(() => {
    if (!filterCollection) return nfts ?? [];
    return (nfts ?? []).filter((n) => (n.collection ?? "Ungrouped") === filterCollection);
  }, [nfts, filterCollection]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-2 flex items-center gap-2">
        <Layers className="h-5 w-5 text-[hsl(var(--pf-green))]" />
        <h1 className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">NFT Hub</h1>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-[hsl(var(--pf-muted))]">Real, live NFTs owned by your connected wallet — read directly from Solana, the same way every other OrbitX page reads on-chain data.</p>

      {!connected || !addr ? (
        <div className="pf-card flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-green))]/15"><Wallet className="h-7 w-7 text-[hsl(var(--pf-green))]" /></div>
          <div>
            <div className="text-lg font-black text-[hsl(var(--pf-ink))]">Connect your wallet</div>
            <div className="mx-auto mt-1 max-w-sm text-sm text-[hsl(var(--pf-muted))]">Connect up top to see the NFTs you own.</div>
          </div>
        </div>
      ) : (
        <>
          {collections.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button onClick={() => setFilterCollection(null)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${!filterCollection ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))]"}`}>All ({nfts?.length ?? 0})</button>
              {collections.map(([key, count]) => (
                <button key={key} onClick={() => setFilterCollection(key)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${filterCollection === key ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))]"}`}>
                  {key === "Ungrouped" ? "Ungrouped" : shortAddr(key, 4)} ({count})
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> reading NFTs…</div>
          ) : !visible.length ? (
            <div className="pf-card flex flex-col items-center gap-3 py-16 text-center">
              <ImageIcon className="h-8 w-8 text-[hsl(var(--pf-muted))]" />
              <div className="text-sm font-bold text-[hsl(var(--pf-muted))]">No NFTs found in this wallet</div>
            </div>
          ) : (
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {visible.map((n) => (
                <a key={n.id} href={`https://solscan.io/token/${n.id}`} target="_blank" rel="noreferrer" className="pf-card overflow-hidden">
                  <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">
                    {n.image ? <img src={n.image} alt={n.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}
                  </div>
                  <div className="p-2">
                    <div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{n.name}</div>
                    <div className="pf-mono text-[9px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">{n.compressed ? "compressed" : n.interface.replace("_", " ").toLowerCase()}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {/* Honest scope note — no fake mint button */}
      <div className="og-glass-card border-[hsl(var(--og-gold))]/25 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--og-gold))]" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[hsl(var(--og-gold))]">NFT creation &amp; collections — in progress</h3>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          On-chain NFT and collection <em className="text-foreground not-italic font-semibold">creation</em> (minting, royalties, IPFS metadata storage, mint pages) needs its own on-chain program integration and a metadata pinning service — the same rigor as the token launch lanes, not a stub button. That work is scoped separately so it isn't shipped half-working. The viewer above is fully real today: it reads every NFT your wallet actually owns straight from Solana.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="https://t.me/ogscan" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pf-border))] px-3 py-2 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--og-cyan))]"><Send className="h-3.5 w-3.5" /> Follow progress on Telegram</a>
          <a href="https://x.com/ogscan" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pf-border))] px-3 py-2 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--og-cyan))]"><Twitter className="h-3.5 w-3.5" /> X / Twitter</a>
          <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-3 py-2 text-xs font-bold text-[hsl(var(--og-gold))] hover:bg-[hsl(var(--og-gold))]/25"><ExternalLink className="h-3.5 w-3.5" /> Launch a token instead</Link>
        </div>
      </div>
    </div>
  );
}
