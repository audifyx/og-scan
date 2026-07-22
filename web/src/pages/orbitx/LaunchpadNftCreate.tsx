// OrbitX NFT Creator Studio — real on-chain NFT + collection creation.
// Every mint here is a genuine Metaplex Token Metadata NFT signed by the
// connected wallet (Phantom, etc.) and registered in the OrbitX NFT registry.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mintNft, verifyNftInCollection } from "@/lib/orbitx/nftMint";
import { enableNftCoin } from "@/pages/nft/nftCoin";
import CreatorInventory from "@/components/orbitx/CreatorInventory";
import { NFT_CATEGORIES } from "@/lib/orbitx/nftCategories";
import { isAcceptedNftMedia, uploadNftAssets } from "./nftUpload";
import {
  registerNft, registerNftCollection, listCollectionsByCreator, checkNftCollectionOriginality, setCollectionCategory,
  checkNftContentDuplicate, sha256Hex, type OrbitxNftCollection,
} from "@/lib/orbitx/nftRegistry";
import {
  Wallet, Loader2, Upload, X, Plus, Layers, ImagePlus, Rocket, ShieldCheck, Info, Sparkles, AlertTriangle,
} from "lucide-react";

type Mode = "nft" | "collection";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-1.5 pf-mono text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label}</div>
      {children}
      {hint && <p className="mt-1 text-[10px] text-[hsl(var(--pf-muted))]">{hint}</p>}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2 text-sm text-[hsl(var(--pf-ink))] outline-none focus:border-[hsl(var(--pf-green))]";

export default function LaunchpadNftCreate() {
  const { connected, publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("nft");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const addr = publicKey?.toBase58();
  const { data: myCollections } = useQuery({
    queryKey: ["orbitx-nft-my-collections", addr],
    queryFn: () => listCollectionsByCreator(addr!),
    enabled: !!addr,
  });

  // ── shared NFT form state ──
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [royaltyPct, setRoyaltyPct] = useState("5");
  const [supply, setSupply] = useState("1");
  const [collectionId, setCollectionId] = useState<string>("");
  const [attributes, setAttributes] = useState<{ trait_type: string; value: string }[]>([{ trait_type: "", value: "" }]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [collectionNameBlocked, setCollectionNameBlocked] = useState<{ name: string; symbol: string } | null>(null);
  const [checkingCollectionName, setCheckingCollectionName] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameCheckTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── collection-only form state ──
  const [colBanner, setColBanner] = useState<File | null>(null);
  const [colBannerPreview, setColBannerPreview] = useState<string | null>(null);
  const [mintPrice, setMintPrice] = useState("0");
  const [mintLimit, setMintLimit] = useState("");
  const [category, setCategory] = useState<string>("Art");

  useEffect(() => {
    if (mode !== "collection" || !name.trim()) { setCollectionNameBlocked(null); return; }
    clearTimeout(nameCheckTimer.current);
    setCheckingCollectionName(true);
    nameCheckTimer.current = setTimeout(async () => {
      try {
        const matches = await checkNftCollectionOriginality(name, symbol);
        const hard = matches.find((m) => m.sim >= 0.85);
        setCollectionNameBlocked(hard ? { name: hard.name, symbol: hard.symbol } : null);
      } finally { setCheckingCollectionName(false); }
    }, 500);
  }, [mode, name, symbol]);

  const selectedCollection = useMemo(() => myCollections?.find((c) => c.id === collectionId) ?? null, [myCollections, collectionId]);

  const onMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isAcceptedNftMedia(f)) { toast.error("Use an image, GIF, video, or audio file"); return; }
    if (f.size > 25 * 1024 * 1024) { toast.error("File too large — max 25 MB"); return; }
    setMediaFile(f);
    setDuplicateWarning(null);
    const reader = new FileReader();
    reader.onload = () => setMediaPreview(reader.result as string);
    reader.readAsDataURL(f);
    try {
      const hash = await sha256Hex(f);
      setContentHash(hash);
      const matches = await checkNftContentDuplicate(hash);
      if (matches.length) setDuplicateWarning(`This exact file was already minted as "${matches[0].name}" by ${matches[0].creator_wallet.slice(0, 4)}…${matches[0].creator_wallet.slice(-4)}.`);
    } catch { /* hashing/lookup is best-effort, never blocks the flow */ }
  };

  const addAttribute = () => setAttributes((a) => [...a, { trait_type: "", value: "" }]);
  const removeAttribute = (i: number) => setAttributes((a) => a.filter((_, idx) => idx !== i));
  const updateAttribute = (i: number, key: "trait_type" | "value", v: string) =>
    setAttributes((a) => a.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)));

  const createCollection = async () => {
    if (!connected || !publicKey || !wallet) { toast.error("Connect a wallet first"); return; }
    if (!name.trim() || !symbol.trim() || !colBanner) { toast.error("Name, symbol, and a banner/logo image are required"); return; }
    if (collectionNameBlocked) { toast.error(`Too close to existing collection "${collectionNameBlocked.name}" ($${collectionNameBlocked.symbol}). Choose a different name.`); return; }
    setBusy(true);
    try {
      setStatusMsg("Uploading collection artwork…");
      const royaltyBps = Math.round(Number(royaltyPct) * 100);
      const { mediaUrl, uri } = await uploadNftAssets(`col-${publicKey.toBase58()}-${Date.now()}`, colBanner, {
        name: name.trim(), symbol: symbol.trim().toUpperCase(), description: description.trim(),
        externalUrl: externalUrl.trim(), attributes: [], creatorWallet: publicKey.toBase58(), royaltyBps,
      });

      setStatusMsg("Approve the collection mint in your wallet…");
      const { mintAddress } = await mintNft({
        connection, wallet: wallet.adapter, name: name.trim(), symbol: symbol.trim().toUpperCase(),
        uri, royaltyBps, isCollection: true,
      });

      setStatusMsg("Registering collection…");
      const newCollectionId = await registerNftCollection({
        creator_wallet: publicKey.toBase58(), name: name.trim(), symbol: symbol.trim().toUpperCase(),
        description: description.trim(), banner_url: mediaUrl, logo_url: mediaUrl, royalty_bps: royaltyBps,
        mint_price_sol: Number(mintPrice) || 0, mint_limit: mintLimit ? Number(mintLimit) : null, mint_address: mintAddress,
      });
      if (category && newCollectionId) {
        await setCollectionCategory(newCollectionId, category, publicKey.toBase58()).catch(() => undefined);
      }

      toast.success("Collection minted on-chain! 🎉");
      qc.invalidateQueries({ queryKey: ["orbitx-nft-my-collections"] });
      navigate("/nft");
    } catch (err) {
      console.error("[orbitx] collection mint failed", err);
      toast.error(err instanceof Error ? err.message : "Collection mint failed");
    } finally {
      setBusy(false); setStatusMsg("");
    }
  };

  const createNftItems = async () => {
    if (!connected || !publicKey || !wallet) { toast.error("Connect a wallet first"); return; }
    if (!name.trim() || !mediaFile) { toast.error("Name and media file are required"); return; }
    const copies = Math.max(1, Math.min(10, Number(supply) || 1));
    setBusy(true);
    try {
      setStatusMsg("Uploading media + metadata…");
      const royaltyBps = Math.round(Number(royaltyPct) * 100);
      const { mediaUrl, uri } = await uploadNftAssets(`nft-${publicKey.toBase58()}-${Date.now()}`, mediaFile, {
        name: name.trim(), symbol: symbol.trim().toUpperCase() || "NFT", description: description.trim(),
        externalUrl: externalUrl.trim(), attributes, creatorWallet: publicKey.toBase58(), royaltyBps,
        collectionName: selectedCollection?.name,
      });

      for (let i = 0; i < copies; i++) {
        setStatusMsg(copies > 1 ? `Approve mint ${i + 1} of ${copies} in your wallet…` : "Approve the mint in your wallet…");
        const { mintAddress } = await mintNft({
          connection, wallet: wallet.adapter, name: name.trim(), symbol: symbol.trim().toUpperCase() || "NFT",
          uri, royaltyBps, collectionMint: selectedCollection?.mint_address ?? undefined,
        });

        if (selectedCollection?.mint_address) {
          setStatusMsg("Verifying collection membership…");
          await verifyNftInCollection(connection, wallet.adapter, mintAddress, selectedCollection.mint_address).catch((e) =>
            console.warn("[orbitx] collection verification failed (item still minted, just unverified):", e)
          );
        }

        setStatusMsg("Registering NFT…");
        const nftId = await registerNft({
          collection_id: selectedCollection?.id ?? null, mint_address: mintAddress, creator_wallet: publicKey.toBase58(),
          name: name.trim(), symbol: symbol.trim().toUpperCase() || "NFT", image_url: mediaUrl, metadata_uri: uri, royalty_bps: royaltyBps,
          attributes: attributes.filter((a) => a.trait_type.trim() && a.value.trim()), content_hash: contentHash ?? undefined,
        });
        // Auto-launch a tradeable meme-coin market bound to this NFT (best-effort).
        await enableNftCoin(nftId, publicKey.toBase58()).catch((e) => console.warn("[orbitx] coin market enable skipped:", e));
      }

      toast.success(`${copies > 1 ? `${copies} NFTs` : "NFT"} minted on-chain! 🎉`);
      navigate("/nft");
    } catch (err) {
      console.error("[orbitx] NFT mint failed", err);
      toast.error(err instanceof Error ? err.message : "NFT mint failed");
    } finally {
      setBusy(false); setStatusMsg("");
    }
  };

  if (!connected || !addr) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="pf-card flex flex-col items-center gap-4 py-20 text-center">
          <Wallet className="h-8 w-8 text-[hsl(var(--pf-green))]" />
          <div className="text-lg font-black text-[hsl(var(--pf-ink))]">Connect your wallet</div>
          <div className="mx-auto max-w-sm text-sm text-[hsl(var(--pf-muted))]">Connect up top to mint real, on-chain NFTs and collections.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[hsl(var(--pf-green))]" />
        <h1 className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">NFT Creator Studio</h1>
      </div>
      <p className="mb-5 max-w-xl text-sm text-[hsl(var(--pf-muted))]">Mint real Solana NFTs (Metaplex Token Metadata) straight to your wallet. Every mint is a genuine on-chain transaction you approve in Phantom.</p>

      {addr && <CreatorInventory wallet={addr} />}

      <div className="mb-5 flex gap-2">
        <button onClick={() => setMode("nft")} className={`flex-1 rounded-lg border p-3 text-left transition ${mode === "nft" ? "border-[hsl(var(--pf-green))] bg-[hsl(var(--pf-green))]/10" : "border-[hsl(var(--pf-border))]"}`}>
          <ImagePlus className="mb-1 h-4 w-4 text-[hsl(var(--pf-green))]" />
          <div className="text-sm font-bold text-[hsl(var(--pf-ink))]">Single / Limited Edition NFT</div>
          <div className="text-[11px] text-[hsl(var(--pf-muted))]">Mint 1-10 copies of one artwork</div>
        </button>
        <button onClick={() => setMode("collection")} className={`flex-1 rounded-lg border p-3 text-left transition ${mode === "collection" ? "border-[hsl(var(--pf-green))] bg-[hsl(var(--pf-green))]/10" : "border-[hsl(var(--pf-border))]"}`}>
          <Layers className="mb-1 h-4 w-4 text-[hsl(var(--pf-green))]" />
          <div className="text-sm font-bold text-[hsl(var(--pf-ink))]">Collection</div>
          <div className="text-[11px] text-[hsl(var(--pf-muted))]">Create a verifiable on-chain collection</div>
        </button>
      </div>

      {mode === "collection" && collectionNameBlocked && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border-2 border-[hsl(var(--og-blood))]/60 bg-[hsl(var(--og-blood))]/15 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[hsl(var(--og-blood))]" />
          <div className="text-sm text-white/90">Too close to an existing collection: <strong>{collectionNameBlocked.name}</strong> (${collectionNameBlocked.symbol}). Choose a different name or symbol.</div>
        </div>
      )}
      {mode === "nft" && duplicateWarning && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[hsl(var(--og-gold))]" />
          <div className="text-sm text-white/90">Possible copy: {duplicateWarning} You can still mint — this is a warning, not a block.</div>
        </div>
      )}

      <div className="pf-card space-y-4 p-5">
        {/* media upload (shared field, different label per mode) */}
        <Field label={mode === "collection" ? "Collection banner / logo *" : "Media (image, GIF, video, or audio) *"}>
          <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" className="hidden"
            onChange={mode === "collection" ? (e) => { const f = e.target.files?.[0]; if (f) { setColBanner(f); const r = new FileReader(); r.onload = () => setColBannerPreview(r.result as string); r.readAsDataURL(f); } } : onMediaSelect} />
          {(mode === "collection" ? colBannerPreview : mediaPreview) ? (
            <div className="relative inline-block">
              <img src={(mode === "collection" ? colBannerPreview : mediaPreview) as string} alt="" className="h-28 w-28 rounded-xl border-2 border-[hsl(var(--pf-border))] object-cover" />
              <button onClick={() => (mode === "collection" ? (setColBanner(null), setColBannerPreview(null)) : (setMediaFile(null), setMediaPreview(null)))}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="flex h-28 w-28 items-center justify-center rounded-xl border-2 border-dashed border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-green))]">
              <div className="text-center"><Upload className="mx-auto mb-1 h-5 w-5" /><span className="text-[9px] uppercase tracking-widest">Upload</span></div>
            </button>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder={mode === "collection" ? "OrbitX Space Explorers" : "OrbitX Explorer #1"} className={inputClass} /></Field>
          <Field label="Symbol"><input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={10} placeholder="OBXNFT" className={inputClass} /></Field>
        </div>
        <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={`${inputClass} resize-none`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="External link"><input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" className={inputClass} /></Field>
          <Field label="Royalty %" hint="Recorded on-chain in metadata"><input type="number" min="0" max="25" step="0.5" value={royaltyPct} onChange={(e) => setRoyaltyPct(e.target.value)} className={inputClass} /></Field>
        </div>

        {mode === "nft" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Supply (copies)" hint="Each copy is its own real mint, up to 10"><input type="number" min="1" max="10" value={supply} onChange={(e) => setSupply(e.target.value)} className={inputClass} /></Field>
              <Field label="Collection (optional)">
                <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className={inputClass}>
                  <option value="">No collection</option>
                  {(myCollections ?? []).map((c: OrbitxNftCollection) => <option key={c.id} value={c.id} disabled={!c.mint_address}>{c.name}{!c.mint_address ? " (pending)" : ""}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Attributes / traits">
              <div className="space-y-2">
                {attributes.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={a.trait_type} onChange={(e) => updateAttribute(i, "trait_type", e.target.value)} placeholder="Trait (e.g. Background)" className={inputClass} />
                    <input value={a.value} onChange={(e) => updateAttribute(i, "value", e.target.value)} placeholder="Value (e.g. Nebula Blue)" className={inputClass} />
                    <button onClick={() => removeAttribute(i)} className="shrink-0 rounded-lg border border-[hsl(var(--pf-border))] px-2 text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-red))]"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <button onClick={addAttribute} className="pf-btn-ghost text-xs"><Plus className="h-3.5 w-3.5" /> Add trait</button>
              </div>
            </Field>
          </>
        )}

        {mode === "collection" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mint price (SOL)" hint="Informational for now — public minting flow is coming"><input type="number" min="0" step="0.01" value={mintPrice} onChange={(e) => setMintPrice(e.target.value)} className={inputClass} /></Field>
            <Field label="Mint limit (optional)"><input type="number" min="1" value={mintLimit} onChange={(e) => setMintLimit(e.target.value)} placeholder="Unlimited" className={inputClass} /></Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {NFT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--pf-border))] bg-white/[0.02] p-3 text-[11px] text-[hsl(var(--pf-muted))]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--pf-green))]" />
          Your connected wallet becomes the verified, permanent creator wallet on-chain. It cannot be changed after minting, and there is no manual payout-wallet field to fill in.
        </div>

        <button onClick={mode === "collection" ? createCollection : createNftItems} disabled={busy}
          className="pf-btn w-full justify-center">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {statusMsg || "Minting…"}</> : <><Rocket className="h-4 w-4" /> {mode === "collection" ? "Mint collection" : "Mint NFT"}</>}
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-[hsl(var(--og-gold))]/25 bg-[hsl(var(--og-gold))]/5 p-3 text-[11px] text-[hsl(var(--pf-muted))]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--og-gold))]" />
        Buying/selling on the marketplace (escrowed listings, offers, auctions) is being built on Metaplex Auction House and isn't live yet — minting and ownership here are fully real today. <Link to="/nft" className="underline">Back to NFT Market</Link>
      </div>
    </div>
  );
}
