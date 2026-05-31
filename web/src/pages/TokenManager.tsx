/**
 * Token Manager — Update on-chain token metadata for FREE.
 *
 * Flow:
 *   1. Connect wallet  (derived from wallet adapter state — no step management)
 *   2. Paste token mint OR auto-detect tokens with update authority
 *   3. View current on-chain metadata (name, symbol, image, description, links)
 *   4. Edit fields → upload new image to Supabase Storage → build new metadata JSON
 *   5. Upload metadata JSON to Supabase Storage
 *   6. Sign UpdateMetadataAccountV2 tx via Phantom
 *   7. Done — metadata updated on every platform
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { supabase } from "@/lib/supabase";
import {
  getMetadataPDA,
  deserializeMetadata,
  createUpdateMetadataAccountV2Instruction,
  fetchMetadataJson,
  parseToken2022Metadata,
  isToken2022Mutable,
  createToken2022UpdateFieldInstruction,
  TOKEN_2022_PROGRAM_ID,
  type OnChainTokenMetadata,
  type Token2022Metadata,
} from "@/lib/metaplex-raw";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Upload,
  Wallet,
  X,
  Zap,
} from "lucide-react";

/* ─── Types ─── */
interface TokenMetadataFull {
  onChain: OnChainTokenMetadata;
  offChain: Record<string, unknown> | null;
  imageUrl: string | null;
  /** "metaplex" for SPL Token + Metaplex, "token2022" for Token-2022 inline */
  tokenStandard: "metaplex" | "token2022";
}

/* The only "steps" we manage are post-connect: select → edit → signing → success */
type PostConnectStep = "select" | "edit" | "signing" | "success";

/* ─── Helpers ─── */
const HELIUS_KEY = "***REMOVED_HELIUS_KEY***";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

const shortAddr = (addr: string) =>
  addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;

async function fetchTokensByAuthority(
  walletAddress: string,
): Promise<{ mint: string; name: string; symbol: string; image: string }[]> {
  try {
    const resp = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "token-manager",
        method: "searchAssets",
        params: {
          ownerAddress: walletAddress,
          tokenType: "fungible",
          displayOptions: { showUnverifiedCollections: true },
        },
      }),
    });
    const json = await resp.json();
    const items = json?.result?.items ?? [];
    return items
      .filter(
        (item: any) =>
          item.authorities?.some(
            (a: any) =>
              a.address === walletAddress &&
              a.scopes?.includes("metadata"),
          ),
      )
      .map((item: any) => ({
        mint: item.id,
        name: item.content?.metadata?.name || "Unknown",
        symbol: item.content?.metadata?.symbol || "???",
        image:
          item.content?.links?.image ||
          item.content?.files?.[0]?.uri ||
          "",
      }));
  } catch (err) {
    console.error("Failed to fetch tokens by authority:", err);
    return [];
  }
}

/* ─── Main Component ─── */
export default function TokenManager() {
  const { publicKey, signTransaction, connected, wallets, select, connect, disconnect, wallet, connecting } = useWallet();
  const { connection } = useConnection();
  const availableWallets = wallets.filter(
    (w) => w.adapter.name === "Phantom",
  );

  /* Match ConnectedWalletTab: gate on `connected` only.
   * publicKey always arrives in the same render cycle as connected=true,
   * but using && publicKey can cause a 1-frame flash of the connect screen. */
  const walletReady = connected;

  /* (wallet connection is handled inline on the Connect buttons below,
   *  same pattern as ConnectedWalletTab: select → setTimeout → connect) */

  /* ─── State ─── */
  const [postStep, setPostStep] = useState<PostConnectStep>("select");
  const [mintInput, setMintInput] = useState("");
  const [myTokens, setMyTokens] = useState<
    { mint: string; name: string; symbol: string; image: string }[]
  >([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadataFull | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editSymbol, setEditSymbol] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editTwitter, setEditTwitter] = useState("");
  const [editTelegram, setEditTelegram] = useState("");
  const [editDiscord, setEditDiscord] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editBannerFile, setEditBannerFile] = useState<File | null>(null);
  const [editBannerPreview, setEditBannerPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  /* ─── Load tokens when wallet becomes ready ─── */
  const loadMyTokens = useCallback(async () => {
    if (!publicKey) return;
    setLoadingTokens(true);
    setError(null);
    try {
      const tokens = await fetchTokensByAuthority(publicKey.toBase58());
      setMyTokens(tokens);
      setTokensLoaded(true);
    } catch (err) {
      setError("Failed to load your tokens. Try again.");
    } finally {
      setLoadingTokens(false);
    }
  }, [publicKey]);

  /* Auto-load tokens whenever wallet becomes ready */
  useEffect(() => {
    if (walletReady && !tokensLoaded && !loadingTokens) {
      loadMyTokens();
    }
  }, [walletReady, tokensLoaded, loadingTokens, loadMyTokens]);

  /* Reset if wallet disconnects */
  useEffect(() => {
    if (!walletReady) {
      setPostStep("select");
      setTokensLoaded(false);
      setMyTokens([]);
      setMetadata(null);
      setSelectedMint(null);
    }
  }, [walletReady]);

  /* ─── Wallet connect handler ───────────────────────────────────────
   * Root cause of the long-standing breakage: on a normal MOBILE browser
   * there is NO injected wallet provider, so the adapter has nothing to
   * connect to and connect() silently fails (the old code also swallowed
   * the error). Copying ConnectedWalletTab can't help — it has the same
   * code. The real fix: deep-link mobile users INTO the wallet's in-app
   * browser, and on desktop/in-app browser select + connect via the
   * provider (so publicKey + signTransaction populate) while surfacing
   * real errors. */
  const [pendingConnect, setPendingConnect] = useState<string | null>(null);

  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  const getInjectedProvider = useCallback((name: string): unknown => {
    if (typeof window === "undefined") return null;
    const w = window as any;
    if (name === "Solflare") return w.solflare?.isSolflare ? w.solflare : null;
    if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
    if (w.solana?.isPhantom) return w.solana;
    return null;
  }, []);

  const buildWalletDeepLink = useCallback((name: string): string => {
    const url = window.location.href;
    const ref = window.location.origin;
    if (name === "Solflare") {
      return `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`;
    }
    return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`;
  }, []);

  const reportConnectError = useCallback((err: any) => {
    const msg = err?.message || String(err);
    if (!/user rejected|user denied|already pending|request reset|wallet not selected/i.test(msg)) {
      setError(msg);
    }
    console.error("wallet connect failed:", err);
  }, []);

  const handleConnect = useCallback(
    (name: string) => {
      setError(null);
      const target = wallets.find((w) => w.adapter.name === name);
      const injected =
        !!getInjectedProvider(name) || target?.adapter.readyState === "Installed";

      if (!injected) {
        if (isMobile) {
          window.location.href = buildWalletDeepLink(name);
          return;
        }
        setError(`${name} not detected. Install the ${name} extension, then refresh this page.`);
        return;
      }
      if (!target) {
        setError(`${name} is not available.`);
        return;
      }

      if (wallet?.adapter.name === name) {
        connect().catch(reportConnectError);
      } else {
        setPendingConnect(name);
        select(name as any);
      }
    },
    [wallets, wallet, select, connect, isMobile, getInjectedProvider, buildWalletDeepLink, reportConnectError],
  );

  useEffect(() => {
    if (
      pendingConnect &&
      wallet?.adapter.name === pendingConnect &&
      !connected &&
      !connecting
    ) {
      setPendingConnect(null);
      connect().catch(reportConnectError);
    }
  }, [pendingConnect, wallet, connected, connecting, connect, reportConnectError]);

  useEffect(() => {
    if (connected && pendingConnect) setPendingConnect(null);
  }, [connected, pendingConnect]);

  /* ─── Wallet connect handler (same as ConnectedWalletTab) ─── */

    /* ─── Helper: fill edit form from metadata ─── */
  const fillEditForm = useCallback((onChain: { name: string; symbol: string; uri?: string }, offChain: Record<string, unknown> | null, imageUrl: string | null) => {
    setEditName(onChain.name);
    setEditSymbol(onChain.symbol);
    setEditDescription((offChain?.description as string) || "");
    setEditWebsite((offChain?.external_url as string) || "");
    setEditTwitter((offChain as any)?.twitter || (offChain as any)?.socials?.twitter || "");
    setEditTelegram((offChain as any)?.telegram || (offChain as any)?.socials?.telegram || "");
    setEditDiscord((offChain as any)?.discord || (offChain as any)?.socials?.discord || "");
    setEditImagePreview(imageUrl);
    setEditImageFile(null);
    setEditBannerPreview((offChain?.banner_image as string) || (offChain?.header as string) || null);
    setEditBannerFile(null);
  }, []);

    /* ─── Load metadata for a selected mint (supports Metaplex + Token-2022) ─── */
  const loadMetadata = useCallback(
    async (mint: string) => {
      setLoadingMeta(true);
      setError(null);
      try {
        const mintPk = new PublicKey(mint);

        /* ── 1. Try Metaplex metadata PDA ── */
        const metaPDA = getMetadataPDA(mintPk);
        const [metaAccount, mintAccount] = await Promise.all([
          connection.getAccountInfo(metaPDA),
          connection.getAccountInfo(mintPk),
        ]);

        if (metaAccount) {
          /* ── Metaplex path (standard SPL Token) ── */
          const onChain = deserializeMetadata(Buffer.from(metaAccount.data));

          if (publicKey && onChain.updateAuthority !== publicKey.toBase58()) {
            setError(`You don't have update authority for this token. Authority: ${shortAddr(onChain.updateAuthority)}`);
            setLoadingMeta(false);
            return;
          }
          if (!onChain.isMutable) {
            setError("This token's metadata is immutable and cannot be updated.");
            setLoadingMeta(false);
            return;
          }

          const offChain = onChain.uri ? await fetchMetadataJson(onChain.uri) : null;
          const imageUrl = (offChain?.image as string) || null;
          const meta: TokenMetadataFull = { onChain, offChain, imageUrl, tokenStandard: "metaplex" };
          setMetadata(meta);
          setSelectedMint(mint);
          fillEditForm(onChain, offChain, imageUrl);
          setPostStep("edit");
          return;
        }

        /* ── 2. Try Token-2022 inline metadata ── */
        if (mintAccount) {
          const ownerProgram = mintAccount.owner.toBase58();
          const t22meta = parseToken2022Metadata(Buffer.from(mintAccount.data), ownerProgram);

          if (t22meta) {
            if (!isToken2022Mutable(t22meta)) {
              setError("This token's metadata is immutable (update authority revoked). It cannot be updated.");
              setLoadingMeta(false);
              return;
            }
            if (publicKey && t22meta.updateAuthority !== publicKey.toBase58()) {
              setError(`You don't have update authority for this token. Authority: ${shortAddr(t22meta.updateAuthority)}`);
              setLoadingMeta(false);
              return;
            }

            const offChain = t22meta.uri ? await fetchMetadataJson(t22meta.uri) : null;
            const imageUrl = (offChain?.image as string) || null;

            // Convert to OnChainTokenMetadata shape for unified UI
            const onChain: OnChainTokenMetadata = {
              key: 0,
              updateAuthority: t22meta.updateAuthority,
              mint: t22meta.mint,
              name: t22meta.name,
              symbol: t22meta.symbol,
              uri: t22meta.uri,
              sellerFeeBasisPoints: 0,
              creators: null,
              primarySaleHappened: false,
              isMutable: true,
            };

            const meta: TokenMetadataFull = { onChain, offChain, imageUrl, tokenStandard: "token2022" };
            setMetadata(meta);
            setSelectedMint(mint);
            fillEditForm(onChain, offChain, imageUrl);
            setPostStep("edit");
            return;
          }
        }

        setError("No metadata found. This token may not have on-chain metadata.");
        setLoadingMeta(false);
      } catch (err: any) {
        setError(err?.message || "Failed to load token metadata.");
      } finally {
        setLoadingMeta(false);
      }
    },
    [connection, publicKey],
  );

  /* ─── Handle manual mint input ─── */
  const handleMintSubmit = useCallback(() => {
    const trimmed = mintInput.trim();
    if (!trimmed) return;
    try {
      new PublicKey(trimmed);
      loadMetadata(trimmed);
    } catch {
      setError("Invalid mint address.");
    }
  }, [mintInput, loadMetadata]);

  /* ─── Handle image file select ─── */
  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be under 5 MB.");
        return;
      }
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) =>
        setEditImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    },
    [],
  );

  /* ─── Handle banner file select ─── */
  const handleBannerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setError("Banner must be under 5 MB.");
        return;
      }
      setEditBannerFile(file);
      const reader = new FileReader();
      reader.onload = (ev) =>
        setEditBannerPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    },
    [],
  );

  /* ─── Upload image + metadata JSON to Supabase Storage ─── */
  const uploadAndUpdate = useCallback(async () => {
    if (!publicKey || !signTransaction || !metadata || !selectedMint)
      return;

    setUploading(true);
    setError(null);
    setPostStep("signing");

    try {
      let imageUrl = metadata.imageUrl || "";

      // Upload new image if changed
      if (editImageFile) {
        const ext = editImageFile.name.split(".").pop() || "png";
        const path = `token-manager/${selectedMint}/image_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("profile-media")
          .upload(path, editImageFile, {
            contentType: editImageFile.type,
            upsert: true,
          });

        if (uploadErr) throw new Error(`Image upload failed: ${uploadErr.message}`);

        const { data: urlData } = supabase.storage
          .from("profile-media")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      // Upload new banner if changed
      let bannerUrl = (metadata.offChain?.banner_image as string) || (metadata.offChain?.header as string) || "";
      if (editBannerFile) {
        const ext = editBannerFile.name.split(".").pop() || "png";
        const path = `token-manager/${selectedMint}/banner_${Date.now()}.${ext}`;
        const { error: bannerErr } = await supabase.storage
          .from("profile-media")
          .upload(path, editBannerFile, {
            contentType: editBannerFile.type,
            upsert: true,
          });
        if (bannerErr) throw new Error(`Banner upload failed: ${bannerErr.message}`);
        const { data: bannerUrlData } = supabase.storage
          .from("profile-media")
          .getPublicUrl(path);
        bannerUrl = bannerUrlData.publicUrl;
      }

      // Build metadata JSON
      const metadataJson: Record<string, unknown> = {
        name: editName,
        symbol: editSymbol,
        description: editDescription,
        image: imageUrl,
        ...(bannerUrl ? { banner_image: bannerUrl, header: bannerUrl } : {}),
        external_url: editWebsite || undefined,
        attributes: [],
        properties: {
          files: [
            ...(imageUrl ? [{ uri: imageUrl, type: editImageFile?.type || "image/png" }] : []),
            ...(bannerUrl ? [{ uri: bannerUrl, type: editBannerFile?.type || "image/png" }] : []),
          ],
          category: "image",
        },
      };

      // Add socials if provided
      const socials: Record<string, string> = {};
      if (editTwitter) socials.twitter = editTwitter;
      if (editTelegram) socials.telegram = editTelegram;
      if (editDiscord) socials.discord = editDiscord;
      if (Object.keys(socials).length > 0) {
        (metadataJson as any).socials = socials;
      }

      // Upload metadata JSON to Supabase Storage
      const jsonPath = `token-manager/${selectedMint}/metadata_${Date.now()}.json`;
      const jsonBlob = new Blob([JSON.stringify(metadataJson, null, 2)], {
        type: "application/json",
      });
      const { error: jsonUploadErr } = await supabase.storage
        .from("profile-media")
        .upload(jsonPath, jsonBlob, {
          contentType: "application/json",
          upsert: true,
        });

      if (jsonUploadErr) throw new Error(`Metadata upload failed: ${jsonUploadErr.message}`);

      const { data: jsonUrlData } = supabase.storage
        .from("profile-media")
        .getPublicUrl(jsonPath);
      const newUri = jsonUrlData.publicUrl;

      // Build on-chain transaction
      const mintPk = new PublicKey(selectedMint);
      const tx = new Transaction();

      if (metadata.tokenStandard === "token2022") {
        /* ── Token-2022: top up rent first if the mint account must grow ──
         * UpdateField reallocs the mint in place, so it must stay rent-exempt
         * at the new (larger) size or the whole tx fails. Over-estimate the
         * new size and transfer only the shortfall; extra lamports remain in
         * the account. */
        const mintInfo = await connection.getAccountInfo(mintPk);
        if (mintInfo) {
          const extraBytes =
            Buffer.byteLength(editName, "utf8") +
            Buffer.byteLength(editSymbol, "utf8") +
            Buffer.byteLength(newUri, "utf8");
          const estNewLen = mintInfo.data.length + extraBytes;
          const needed = await connection.getMinimumBalanceForRentExemption(estNewLen);
          if (needed > mintInfo.lamports) {
            tx.add(
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: mintPk,
                lamports: needed - mintInfo.lamports,
              }),
            );
          }
        }

        /* ── one UpdateField instruction per changed field ── */
        if (editName !== metadata.onChain.name) {
          tx.add(createToken2022UpdateFieldInstruction(mintPk, publicKey, "name", editName));
        }
        if (editSymbol !== metadata.onChain.symbol) {
          tx.add(createToken2022UpdateFieldInstruction(mintPk, publicKey, "symbol", editSymbol));
        }
        // Always update URI (points to new metadata JSON with image/desc/links)
        tx.add(createToken2022UpdateFieldInstruction(mintPk, publicKey, "uri", newUri));
      } else {
        /* ── Metaplex: single UpdateMetadataAccountV2 instruction ── */
        const metaPDA = getMetadataPDA(mintPk);
        const existingCreators = metadata.onChain.creators?.map((c) => ({
          address: new PublicKey(c.address),
          verified: c.verified,
          share: c.share,
        })) || null;

        tx.add(createUpdateMetadataAccountV2Instruction({
          metadata: metaPDA,
          updateAuthority: publicKey,
          newName: editName,
          newSymbol: editSymbol,
          newUri: newUri,
          newSellerFeeBasisPoints: metadata.onChain.sellerFeeBasisPoints,
          creators: existingCreators,
        }));
      }
      tx.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      // Sign & send
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      setPostStep("success");
    } catch (err: any) {
      console.error("Update failed:", err);
      if (err?.message?.includes("User rejected")) {
        setError("Transaction cancelled by user.");
        setPostStep("edit");
      } else {
        setError(err?.message || "Update failed. Please try again.");
        setPostStep("edit");
      }
    } finally {
      setUploading(false);
    }
  }, [
    publicKey,
    signTransaction,
    metadata,
    selectedMint,
    editName,
    editSymbol,
    editDescription,
    editWebsite,
    editTwitter,
    editTelegram,
    editDiscord,
    editImageFile,
    editBannerFile,
    connection,
  ]);

  /* ─── Computed ─── */
  const hasChanges = useMemo(() => {
    if (!metadata) return false;
    return (
      editName !== metadata.onChain.name ||
      editSymbol !== metadata.onChain.symbol ||
      editDescription !==
        ((metadata.offChain?.description as string) || "") ||
      editWebsite !== ((metadata.offChain?.external_url as string) || "") ||
      editTwitter !== ((metadata.offChain as any)?.twitter || (metadata.offChain as any)?.socials?.twitter || "") ||
      editTelegram !== ((metadata.offChain as any)?.telegram || (metadata.offChain as any)?.socials?.telegram || "") ||
      editDiscord !== ((metadata.offChain as any)?.discord || (metadata.offChain as any)?.socials?.discord || "") ||
      editImageFile !== null ||
      editBannerFile !== null
    );
  }, [metadata, editName, editSymbol, editDescription, editWebsite, editTwitter, editTelegram, editDiscord, editImageFile, editBannerFile]);

  /* ────────────────────────────────────────────────────────────── */
  /* ─── RENDER ─── */
  /* ────────────────────────────────────────────────────────────── */

  /* Derive what to show purely from state — no step gating for connect/select */
  const showConnect = !walletReady; // visible the whole time until connected
  const showConnecting = connecting;
  const showPostConnect = walletReady;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* ── Header ── */}
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-og-lime/20 bg-og-lime/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-og-lime">
          <Zap className="h-3 w-3" /> Free On-Chain Update
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
          Token Manager
        </h1>
        <p className="mt-2 text-sm text-white/40">
          Update your token's image, description & links — changes show on{" "}
          <span className="text-white/60">every platform</span> (DexScreener,
          Jupiter, Birdeye, wallets).
        </p>
        {walletReady && (
          <p className="mt-1 text-[10px] text-white/20">
            Connected: <span className="font-mono text-og-cyan/60">{shortAddr(publicKey!.toBase58())}</span>
            <button onClick={() => disconnect()} className="ml-2 text-white/15 hover:text-white/40 underline">disconnect</button>
          </p>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="shrink-0 text-red-400/40 hover:text-red-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── VIEW: Connect Wallet ── */}
      {showConnect && (
        <div className="flex flex-col items-center justify-center gap-8 px-4 py-8">
          <div className="og-glass-card rounded-3xl p-8 max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[hsl(var(--og-lime))] to-[#22d3ee] flex items-center justify-center shadow-lg shadow-[hsl(var(--og-lime))/0.3]">
              <Wallet className="h-10 w-10 text-[hsl(var(--og-ink))]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Connect the wallet that deployed your token to update its metadata.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {wallets.filter(w => ["Phantom", "Solflare"].includes(w.adapter.name)).map(w => (
                <button key={w.adapter.name} onClick={() => handleConnect(w.adapter.name)} disabled={connecting || pendingConnect === w.adapter.name}
                  className="flex items-center gap-3 w-full px-5 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] hover:border-[hsl(var(--og-lime))/0.4] transition-all group">
                  {w.adapter.icon && <img src={w.adapter.icon} alt={w.adapter.name} className="w-7 h-7 rounded-lg" />}
                  <span className="font-semibold text-sm">{w.adapter.name}</span>
                  <span className="ml-auto text-[10px] text-white/30 group-hover:text-[hsl(var(--og-lime))] transition-colors">{(connecting || pendingConnect === w.adapter.name) ? "Connecting…" : (isMobile ? "Open app →" : "Connect →")}</span>
                </button>
              ))}
              {wallets.filter(w => ["Phantom", "Solflare"].includes(w.adapter.name)).length === 0 && (
                <div className="text-center text-sm text-white/40 py-4">
                  <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                  No wallets detected. Install <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--og-lime))] underline">Phantom</a> first.
                </div>
              )}
            </div>
            <p className="text-[11px] text-white/25">Your keys never leave your wallet.</p>
          </div>
        </div>
      )}

            {/* ══════════════════════════════════════════════ */}
      {/* ── VIEW: Post-Connect (select / edit / signing / success) ── */}
      {/* ══════════════════════════════════════════════ */}
      {showPostConnect && postStep === "select" && (
        <div className="space-y-4">
          {/* Manual mint input */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-white/30">
              Paste Token Mint Address
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                <input
                  value={mintInput}
                  onChange={(e) => setMintInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMintSubmit()}
                  placeholder="e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/15 focus:border-og-cyan/30 focus:outline-none"
                />
              </div>
              <button
                onClick={handleMintSubmit}
                disabled={!mintInput.trim() || loadingMeta}
                className="shrink-0 rounded-xl bg-og-cyan/10 px-5 py-3 text-xs font-bold text-og-cyan transition hover:bg-og-cyan/20 disabled:opacity-30"
              >
                {loadingMeta ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Load"
                )}
              </button>
            </div>
          </div>

          {/* Your tokens */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">
                Your Tokens (Update Authority)
              </h3>
              <button
                onClick={() => loadMyTokens()}
                disabled={loadingTokens}
                className="rounded-lg p-1.5 text-white/25 hover:bg-white/[0.05] hover:text-white/50"
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    loadingTokens && "animate-spin",
                  )}
                />
              </button>
            </div>

            {loadingTokens ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-og-cyan/50" />
              </div>
            ) : myTokens.length === 0 ? (
              <div className="py-6 text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-white/10" />
                <p className="mt-2 text-xs text-white/25">
                  No tokens found with update authority for this wallet.
                </p>
                <p className="mt-1 text-[10px] text-white/15">
                  You can still paste a mint address above.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {myTokens.map((t) => (
                  <button
                    key={t.mint}
                    onClick={() => loadMetadata(t.mint)}
                    disabled={loadingMeta}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-white/[0.02] px-3 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.04]"
                  >
                    {t.image ? (
                      <img
                        src={t.image}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                        <Sparkles className="h-4 w-4 text-white/20" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {t.name}
                      </p>
                      <p className="text-[10px] text-white/30">
                        {t.symbol} · {shortAddr(t.mint)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/15" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="rounded-2xl border border-og-lime/10 bg-og-lime/[0.02] p-4">
            <h4 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-og-lime/60">
              <Info className="h-3 w-3" /> How it works
            </h4>
            <ul className="space-y-1.5 text-xs text-white/30">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-og-lime/40">1.</span>
                <span>
                  Paste your token's mint or select from your tokens above
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-og-lime/40">2.</span>
                <span>
                  Update the image, description, website & social links
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-og-lime/40">3.</span>
                <span>
                  Sign one transaction — metadata updates on{" "}
                  <strong className="text-white/50">
                    DexScreener, Jupiter, Birdeye, Phantom
                  </strong>{" "}
                  and every platform automatically
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-og-lime/40">4.</span>
                <span>
                  Total cost: ~0.000005 SOL (standard tx fee). <strong className="text-og-lime/60">That's it.</strong>
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Post-Connect: Edit Metadata ── */}
      {showPostConnect && postStep === "edit" && metadata && (
        <div className="space-y-4">
          {/* Back button */}
          <button
            onClick={() => {
              setPostStep("select");
              setMetadata(null);
              setSelectedMint(null);
            }}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to token select
          </button>

          {/* Token identity header */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            {editImagePreview ? (
              <img
                src={editImagePreview}
                alt=""
                className="h-12 w-12 rounded-xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <ImageIcon className="h-5 w-5 text-white/20" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-black text-white">
                {metadata.onChain.name}
              </h2>
              <p className="flex items-center gap-2 text-xs text-white/30">
                <span>{metadata.onChain.symbol}</span>
                <span>·</span>
                <span className="font-mono">{shortAddr(selectedMint!)}</span>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(selectedMint!)
                  }
                  className="text-white/20 hover:text-white/50"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-og-lime/20 bg-og-lime/5 px-2.5 py-1 text-[9px] font-bold text-og-lime">
              <ShieldCheck className="h-3 w-3" /> Mutable
            </div>
          </div>

          {/* Edit form */}
          <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">
              <Pencil className="mr-1 inline h-3 w-3" /> Edit Metadata
            </h3>

            {/* Image upload */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/25">
                Token Image
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] transition hover:border-og-cyan/30"
                >
                  {editImagePreview ? (
                    <img
                      src={editImagePreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera className="h-6 w-6 text-white/15" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
                    <Upload className="h-5 w-5 text-white/70" />
                  </div>
                </button>
                <div className="text-xs text-white/25">
                  <p>Click to upload a new image</p>
                  <p className="text-[10px] text-white/15">
                    PNG, JPG, GIF or WEBP · Max 5 MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {/* Banner upload */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/25">
                Banner Image
              </label>
              <button
                onClick={() => bannerInputRef.current?.click()}
                className="group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] transition hover:border-og-cyan/30"
              >
                {editBannerPreview ? (
                  <img
                    src={editBannerPreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-white/15">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-[10px]">Click to upload banner (1500×500 recommended)</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
                  <Upload className="h-5 w-5 text-white/70" />
                </div>
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleBannerChange}
              />
              <p className="mt-1 text-[10px] text-white/15">
                Used on DexScreener, profile pages & embeds · Max 5 MB
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/25">
                Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={32}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/15 focus:border-og-cyan/30 focus:outline-none"
              />
              <p className="mt-1 text-right text-[10px] text-white/15">
                {editName.length}/32
              </p>
            </div>

            {/* Symbol */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/25">
                Symbol
              </label>
              <input
                value={editSymbol}
                onChange={(e) => setEditSymbol(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/15 focus:border-og-cyan/30 focus:outline-none"
              />
              <p className="mt-1 text-right text-[10px] text-white/15">
                {editSymbol.length}/10
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/25">
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Tell people about your token. Pro tip: include links here — they show up on every platform!"
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/15 focus:border-og-cyan/30 focus:outline-none"
              />
              <p className="mt-1 text-right text-[10px] text-white/15">
                {editDescription.length}/1000
              </p>
            </div>

            {/* Links */}
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-white/25">
                <Globe className="mr-1 inline h-3 w-3" /> Links & Socials
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold text-white/20">
                    Website
                  </span>
                  <input
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    placeholder="https://yourtoken.com"
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder:text-white/12 focus:border-og-cyan/30 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold text-white/20">
                    Twitter / X
                  </span>
                  <input
                    value={editTwitter}
                    onChange={(e) => setEditTwitter(e.target.value)}
                    placeholder="https://x.com/yourtoken"
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder:text-white/12 focus:border-og-cyan/30 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold text-white/20">
                    Telegram
                  </span>
                  <input
                    value={editTelegram}
                    onChange={(e) => setEditTelegram(e.target.value)}
                    placeholder="https://t.me/yourgroup"
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder:text-white/12 focus:border-og-cyan/30 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold text-white/20">
                    Discord
                  </span>
                  <input
                    value={editDiscord}
                    onChange={(e) => setEditDiscord(e.target.value)}
                    placeholder="https://discord.gg/invite"
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder:text-white/12 focus:border-og-cyan/30 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* What updates where */}
          <div className="rounded-2xl border border-og-cyan/10 bg-og-cyan/[0.02] p-4">
            <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-og-cyan/50">
              What gets updated where
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-lg bg-white/[0.02] px-2 py-1.5">
                <p className="font-bold text-og-lime/70">✓ Everywhere</p>
                <p className="text-white/25">
                  Name, Symbol, Image, Banner, Description
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.02] px-2 py-1.5">
                <p className="font-bold text-og-cyan/70">✓ In metadata JSON</p>
                <p className="text-white/25">
                  Website, Twitter, TG, Discord
                </p>
              </div>
            </div>
          </div>

          {/* Update button */}
          <button
            onClick={uploadAndUpdate}
            disabled={!hasChanges || uploading}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-widest transition",
              hasChanges
                ? "bg-og-lime/10 text-og-lime border border-og-lime/20 hover:bg-og-lime/15"
                : "bg-white/[0.03] text-white/20 border border-white/[0.06] cursor-not-allowed",
            )}
          >
            <Zap className="h-4 w-4" />
            {hasChanges ? "Update Metadata On-Chain" : "No Changes"}
          </button>

          <p className="text-center text-[10px] text-white/15">
            Transaction fee: ~0.000005 SOL · Image stored on Supabase
          </p>
        </div>
      )}

      {/* ── Post-Connect: Signing ── */}
      {showPostConnect && postStep === "signing" && (
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
          <Loader2 className="h-12 w-12 animate-spin text-og-cyan" />
          <div className="text-center">
            <h2 className="text-lg font-bold text-white">
              {uploading ? "Uploading & Signing..." : "Confirming..."}
            </h2>
            <p className="mt-1 text-xs text-white/35">
              Please approve the transaction in your wallet.
            </p>
          </div>
        </div>
      )}

      {/* ── Post-Connect: Success ── */}
      {showPostConnect && postStep === "success" && (
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-og-lime/20 bg-og-lime/[0.03] p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-og-lime/10">
            <CheckCircle2 className="h-8 w-8 text-og-lime" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-black text-white">
              Metadata Updated! 🎉
            </h2>
            <p className="mt-2 text-sm text-white/40">
              Your token's metadata has been updated on-chain. Changes will
              propagate to DexScreener, Jupiter, Birdeye, and all wallets
              within a few minutes.
            </p>
          </div>

          {txSig && (
            <a
              href={`https://solscan.io/tx/${txSig}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs text-white/50 transition hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View transaction on Solscan
            </a>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPostStep("select");
                setMetadata(null);
                setSelectedMint(null);
                setTxSig(null);
              }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-xs font-bold text-white/50 transition hover:text-white"
            >
              Update Another Token
            </button>
            <button
              onClick={() => loadMetadata(selectedMint!)}
              className="rounded-xl bg-og-cyan/10 px-6 py-2.5 text-xs font-bold text-og-cyan transition hover:bg-og-cyan/20"
            >
              View Updated Metadata
            </button>
          </div>
        </div>
      )}

      {/* ── Comparison callout (shown when not editing) ── */}
      {(showConnect || (showPostConnect && postStep === "select")) && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent">
          <div className="p-4">
            <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/25">
              OG Scan vs DexScreener
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-og-lime/15 bg-og-lime/[0.03] p-3">
                <p className="text-[10px] font-black text-og-lime/60">
                  OG SCAN
                </p>
                <p className="mt-1 text-xl font-black text-og-lime">FREE</p>
                <ul className="mt-2 space-y-1 text-[10px] text-white/30">
                  <li>✓ Update logo, banner & image</li>
                  <li>✓ Update description</li>
                  <li>✓ Add social links</li>
                  <li>✓ Changes everywhere</li>
                  <li>✓ Instant, no approval wait</li>
                </ul>
              </div>
              <div className="rounded-xl border border-red-400/15 bg-red-400/[0.03] p-3">
                <p className="text-[10px] font-black text-red-400/60">
                  DEXSCREENER
                </p>
                <p className="mt-1 text-xl font-black text-red-400">$299+</p>
                <ul className="mt-2 space-y-1 text-[10px] text-white/30">
                  <li>✓ Update logo & banner</li>
                  <li>✓ Add social links</li>
                  <li>✗ DS-only (not on-chain)</li>
                  <li>✗ Manual review process</li>
                  <li>✗ Takes 24-48 hours</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
