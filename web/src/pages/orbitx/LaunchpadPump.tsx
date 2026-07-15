// Orbitx Launchpad — Pump.fun-style launcher (moved in-house under /orbitxlaunch/create/pump).
// Recolored from pump purple to the OrbitX accent palette. Launch logic unchanged.
/**
 * Launch — Token launcher hub for OrbitX.
 *
 * Two views:
 *  1. Gallery (default) — browse all tokens launched through OrbitX
 *  2. Create  — the launch form (accessed via "Launch Token" button)
 *
 * Launched tokens are stored in localStorage and enriched with live
 * price data from DexScreener on each visit.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { HELIUS_API_KEY } from "@/lib/og";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Keypair, VersionedTransaction, Transaction,
  SystemProgram, PublicKey, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import { PLATFORM_WALLET, LAUNCHPAD_FEE_USD } from "@/lib/platformFee";
import { registerToken } from "@/lib/orbitx/registry";
import { Link } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import {
  Rocket, Upload, Globe, Twitter, Send,
  Loader2, CheckCircle, Copy, ExternalLink, Wallet, AlertTriangle,
  Sparkles, Zap, ArrowRight, X, Info, DollarSign, Plus,
  TrendingUp, TrendingDown, Clock, BarChart3, Droplets,
  Users, ArrowLeft, RefreshCw, Search, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/* ─── Constants ──────────────────────────────────────────────────────── */

const MAX_IMG_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMG = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const STORAGE_KEY = "ogscan_launched_tokens";

/* ─── Types ──────────────────────────────────────────────────────────── */

interface LaunchedToken {
  mintAddress: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
  metadataUri?: string;
  txSignature: string;
  launchedAt: string; // ISO
  twitter?: string;
  telegram?: string;
  website?: string;
  devBuySol?: number;
  launcherWallet?: string;
}

interface LiveData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  imageUrl?: string;
  pairAddress?: string;
}

interface FormData {
  name: string;
  symbol: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  devBuySol: string;
}

type LaunchStep = "form" | "uploading" | "signing" | "sending" | "success" | "error";
type PageView = "gallery" | "create";

const STEP_LABELS = ["IPFS", "Sign", "Send"];

/* ─── Persistence helpers ────────────────────────────────────────────── */

function loadLaunches(): LaunchedToken[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLaunch(token: LaunchedToken) {
  const existing = loadLaunches();
  // Avoid duplicates
  if (!existing.some((t) => t.mintAddress === token.mintAddress)) {
    existing.unshift(token); // Newest first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }
}

/* ─── Formatting helpers ─────────────────────────────────────────────── */

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(6)}`;
  return "$0";
}

function fmtPrice(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n > 0) return `$${n.toFixed(8)}`;
  return "$0";
}

/* ═══════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════ */

export default function LaunchpadPump() {
  const [view, setView] = useState<PageView>("gallery");

  return view === "gallery" ? (
    <TokenGallery onCreateClick={() => setView("create")} />
  ) : (
    <CreateTokenForm onBack={() => setView("gallery")} onSuccess={() => setView("gallery")} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Token Gallery
   ═══════════════════════════════════════════════════════════════════════ */

function TokenGallery({ onCreateClick }: { onCreateClick: () => void }) {
  const [launches, setLaunches] = useState<LaunchedToken[]>([]);
  const [liveData, setLiveData] = useState<Record<string, LiveData>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load launches from localStorage
  useEffect(() => {
    setLaunches(loadLaunches());
    setLoading(false);
  }, []);

  // Fetch live data for all launched tokens
  useEffect(() => {
    if (launches.length === 0) return;

    const fetchLive = async () => {
      const addresses = launches.map((t) => t.mintAddress);
      // DexScreener supports up to 30 addresses in a single call
      const chunks: string[][] = [];
      for (let i = 0; i < addresses.length; i += 30) {
        chunks.push(addresses.slice(i, i + 30));
      }

      const allData: Record<string, LiveData> = {};

      for (const chunk of chunks) {
        try {
          const res = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`
          );
          const json = await res.json();
          const pairs = json.pairs || [];

          // Pick the best pair per token (highest liquidity)
          for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (!addr) continue;
            const existing = allData[addr];
            if (!existing || (pair.liquidity?.usd || 0) > existing.liquidity) {
              allData[addr] = {
                price: parseFloat(pair.priceUsd) || 0,
                priceChange24h: pair.priceChange?.h24 || 0,
                volume24h: pair.volume?.h24 || 0,
                liquidity: pair.liquidity?.usd || 0,
                marketCap: pair.fdv || pair.marketCap || 0,
                imageUrl: pair.info?.imageUrl,
                pairAddress: pair.pairAddress,
              };
            }
          }
        } catch (err) {
          console.error("DexScreener fetch error:", err);
        }
      }

      setLiveData(allData);
    };

    fetchLive();
    const interval = setInterval(fetchLive, 30_000);
    return () => clearInterval(interval);
  }, [launches]);

  const filteredLaunches = useMemo(() => {
    if (!searchQuery.trim()) return launches;
    const q = searchQuery.toLowerCase();
    return launches.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.mintAddress.toLowerCase().includes(q)
    );
  }, [launches, searchQuery]);

  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] px-4 py-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => navigate("/trading-hub")} className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--og-cyan))]/20 bg-[hsl(var(--og-cyan))]/5 px-4 py-1.5">
                <Rocket className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                <span className="text-xs font-bold text-[hsl(var(--og-cyan))] uppercase tracking-widest">OG Token Launcher</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Launched Tokens
            </h1>
            <p className="text-sm text-white/40 mt-1">
              All tokens created through OrbitX's launcher
            </p>
          </div>

          <button
            onClick={onCreateClick}
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--og-cyan))] to-[hsl(var(--og-lime))] px-5 py-3 text-sm font-black text-black hover:from-[hsl(var(--og-cyan))] hover:to-[hsl(var(--og-cyan))] transition-all shadow-lg shadow-[hsl(var(--og-cyan))]/20 shrink-0"
          >
            <Plus className="h-4.5 w-4.5" />
            Launch Token
          </button>
        </div>

        {/* Search bar (show when there are tokens) */}
        {launches.length > 0 && (
          <div className="mb-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
            <Input
              placeholder="Search by name, ticker, or address…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus:border-[hsl(var(--og-cyan))]/40 h-11"
            />
          </div>
        )}

        {/* Token grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-[hsl(var(--og-cyan))] animate-spin" />
          </div>
        ) : filteredLaunches.length === 0 ? (
          <EmptyState onCreateClick={onCreateClick} hasSearch={searchQuery.length > 0} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLaunches.map((token) => (
              <TokenCard
                key={token.mintAddress}
                token={token}
                live={liveData[token.mintAddress]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Empty State ────────────────────────────────────────────────────── */

function EmptyState({ onCreateClick, hasSearch }: { onCreateClick: () => void; hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Search className="h-12 w-12 text-white/10 mb-4" />
        <h3 className="text-lg font-bold text-white/50">No tokens found</h3>
        <p className="text-sm text-white/25 mt-1">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-[hsl(var(--og-cyan))]/5 border border-[hsl(var(--og-cyan))]/10">
        <Rocket className="h-12 w-12 text-[hsl(var(--og-cyan))]/30" />
      </div>
      <h3 className="text-xl font-black text-white mb-2">No tokens launched yet</h3>
      <p className="text-sm text-white/35 max-w-sm mb-6">
        Create your first token on pump.fun directly from OrbitX. It only takes a few seconds.
      </p>
      <button
        onClick={onCreateClick}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(var(--og-cyan))] to-[hsl(var(--og-lime))] px-6 py-3 text-sm font-bold text-black hover:from-[hsl(var(--og-cyan))] hover:to-[hsl(var(--og-cyan))] transition-all"
      >
        <Rocket className="h-4 w-4" />
        Launch Your First Token
      </button>
    </div>
  );
}

/* ─── Token Card ─────────────────────────────────────────────────────── */

function TokenCard({ token, live }: { token: LaunchedToken; live?: LiveData }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(token.mintAddress);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const imgSrc = live?.imageUrl || token.imageUrl;
  const priceUp = (live?.priceChange24h || 0) >= 0;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:border-[hsl(var(--og-cyan))]/20 transition-all group">
      <CardContent className="p-4 md:p-5">
        {/* Top row: image + name + price */}
        <div className="flex items-start gap-3.5 mb-4">
          {/* Token image */}
          <div className="relative shrink-0">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={token.name}
                className="h-14 w-14 rounded-xl border border-white/[0.08] object-cover bg-white/[0.03]"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="h-14 w-14 rounded-xl border border-white/[0.08] bg-[hsl(var(--og-cyan))]/10 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-[hsl(var(--og-cyan))]/40" />
              </div>
            )}
          </div>

          {/* Name + ticker */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-base font-black text-white truncate">{token.name}</h3>
              <Badge className="bg-[hsl(var(--og-cyan))]/10 text-[hsl(var(--og-cyan))] border-[hsl(var(--og-cyan))]/20 text-[10px] font-bold shrink-0">
                ${token.symbol}
              </Badge>
            </div>

            {/* Contract address */}
            <div className="flex items-center gap-1.5 mt-1">
              <code className="text-[10px] text-white/30 font-mono">
                {token.mintAddress.slice(0, 6)}…{token.mintAddress.slice(-4)}
              </code>
              <button onClick={copyAddress} className="text-white/20 hover:text-white/50 transition-colors">
                {copied ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>

            {/* Age */}
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-white/15" />
              <span className="text-[10px] text-white/25">
                {formatDistanceToNow(new Date(token.launchedAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Price + change */}
          <div className="text-right shrink-0">
            {live ? (
              <>
                <p className="text-sm font-bold text-white">{fmtPrice(live.price)}</p>
                <div className={`flex items-center justify-end gap-0.5 mt-0.5 ${priceUp ? "text-green-400" : "text-red-400"}`}>
                  {priceUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span className="text-[11px] font-bold">{Math.abs(live.priceChange24h).toFixed(1)}%</span>
                </div>
              </>
            ) : (
              <span className="text-xs text-white/15">Loading…</span>
            )}
          </div>
        </div>

        {/* Stats row */}
        {live && (
          <div className="grid grid-cols-3 gap-3 mb-4 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
            <div>
              <p className="text-[9px] text-white/25 uppercase tracking-widest mb-0.5">Market Cap</p>
              <p className="text-xs font-bold text-white/70">{fmtUsd(live.marketCap)}</p>
            </div>
            <div>
              <p className="text-[9px] text-white/25 uppercase tracking-widest mb-0.5">Volume 24h</p>
              <p className="text-xs font-bold text-white/70">{fmtUsd(live.volume24h)}</p>
            </div>
            <div>
              <p className="text-[9px] text-white/25 uppercase tracking-widest mb-0.5">Liquidity</p>
              <p className="text-xs font-bold text-white/70">{fmtUsd(live.liquidity)}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {token.description && (
          <p className="text-[11px] text-white/30 line-clamp-2 mb-3 leading-relaxed">{token.description}</p>
        )}

        {/* Bottom row: socials + links */}
        <div className="flex items-center justify-between">
          {/* Social links */}
          <div className="flex items-center gap-2">
            {token.twitter && (
              <a href={token.twitter} target="_blank" rel="noopener noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/25 hover:text-white/60 hover:border-white/10 transition-colors">
                <Twitter className="h-3.5 w-3.5" />
              </a>
            )}
            {token.telegram && (
              <a href={token.telegram} target="_blank" rel="noopener noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/25 hover:text-white/60 hover:border-white/10 transition-colors">
                <Send className="h-3.5 w-3.5" />
              </a>
            )}
            {token.website && (
              <a href={token.website} target="_blank" rel="noopener noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/25 hover:text-white/60 hover:border-white/10 transition-colors">
                <Globe className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Action links */}
          <div className="flex items-center gap-2">
            <a
              href={`https://pump.fun/${token.mintAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--og-cyan))]/5 border border-[hsl(var(--og-cyan))]/15 px-3 py-1.5 text-[10px] font-bold text-[hsl(var(--og-cyan))]/70 hover:text-[hsl(var(--og-cyan))] hover:border-[hsl(var(--og-cyan))]/30 transition-all uppercase tracking-wider"
            >
              Pump.fun <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={`https://solscan.io/token/${token.mintAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-white/30 hover:text-white/60 hover:border-white/10 transition-all uppercase tracking-wider"
            >
              Solscan <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Create Token Form
   ═══════════════════════════════════════════════════════════════════════ */

function CreateTokenForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const { publicKey, signTransaction, sendTransaction, connected, connect, wallets, select } = useWallet();
  const { connection } = useConnection();
  const { isAdmin } = useAdmin();

  const [form, setForm] = useState<FormData>({
    name: "", symbol: "", description: "",
    twitter: "", telegram: "", website: "",
    devBuySol: "0",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [step, setStep] = useState<LaunchStep>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [metadataUri, setMetadataUri] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Fetch SOL price ──────────────────────────────────────────────── */

  useEffect(() => {
    const fetchPrice = async () => {
      // Try Helius price first, then CoinGecko fallback
      try {
        const res = await fetch(
          `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: "sol-price", method: "getAsset",
              params: { id: "So11111111111111111111111111111111111111112" },
            }),
          }
        );
        const data = await res.json();
        const price = data?.result?.token_info?.price_info?.price_per_token;
        if (price && price > 0) { setSolPrice(price); return; }
      } catch {}
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        const data = await res.json();
        if (data?.solana?.usd) setSolPrice(data.solana.usd);
      } catch {}
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => clearInterval(interval);
  }, []);

  /* ─── Image handling ───────────────────────────────────────────────── */

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_IMG.includes(file.type)) { toast.error("Invalid format — use PNG, JPG, GIF, or WebP"); return; }
    if (file.size > MAX_IMG_SIZE) { toast.error("Image too large — max 5 MB"); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const removeImage = () => {
    setImageFile(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateField = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canLaunch =
    connected && publicKey && signTransaction && sendTransaction &&
    form.name.trim().length > 0 && form.symbol.trim().length > 0 &&
    !!imageFile;

  /* ─── Launch flow ──────────────────────────────────────────────────── */

  const handleLaunch = async () => {
    if (!canLaunch || !publicKey || !signTransaction || !sendTransaction || !imageFile) return;

    try {
      /* Step 0 — Platform launch fee ($1.50 in SOL, Solana only) */
      if (LAUNCHPAD_FEE_USD > 0) {
        setStep("uploading");
        setStatusMsg("Paying launch fee…");
        const px = solPrice || 150;
        const feeLamports = Math.ceil((LAUNCHPAD_FEE_USD / px) * LAMPORTS_PER_SOL);
        const feeTx = new Transaction().add(
          SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(PLATFORM_WALLET), lamports: feeLamports }),
        );
        feeTx.feePayer = publicKey;
        feeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signedFee = await signTransaction(feeTx);
        await connection.sendRawTransaction(signedFee.serialize());
      }

      /* Step 1 — Upload to IPFS */
      setStep("uploading");
      setStatusMsg("Uploading image & metadata to IPFS…");

      const base64 = await fileToBase64(imageFile);
      const ipfsRes = await fetch("/api/pump-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "ipfs", imageBase64: base64, imageMimeType: imageFile.type,
          name: form.name.trim(), symbol: form.symbol.trim().toUpperCase(),
          description: form.description.trim(), twitter: form.twitter.trim(),
          telegram: form.telegram.trim(), website: form.website.trim(),
        }),
      });
      if (!ipfsRes.ok) {
        const err = await ipfsRes.json().catch(() => ({ error: "IPFS upload failed" }));
        throw new Error(err.error || "IPFS upload failed");
      }
      const { metadataUri: uri } = await ipfsRes.json();
      setMetadataUri(uri);

      /* Step 2 — Generate vanity mint keypair ending with "obx" */
      setStatusMsg("Generating custom token address (ending with 'obx')…");
      let vanityRes = await fetch("/api/vanity-mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suffix: "obx", maxIterations: 5000000 }),
      });
      if (!vanityRes.ok && vanityRes.status === 504) {
        // Probabilistic search — one retry before giving up.
        setStatusMsg("Still searching for a matching address, retrying…");
        vanityRes = await fetch("/api/vanity-mint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suffix: "obx", maxIterations: 5000000 }),
        });
      }
      if (!vanityRes.ok) {
        const err = await vanityRes.json().catch(() => ({ error: "Vanity mint generation failed" }));
        throw new Error(err.error || "Vanity mint generation failed");
      }
      const { publicKey: vanityPubKey, secretKey: vanitySecretKeyBase58, attempts, timeMs } = await vanityRes.json();
      console.log(`[v0] Generated vanity mint ${vanityPubKey} after ${attempts} attempts in ${timeMs}ms`);
      
      // Reconstruct the keypair from the base58-encoded secret key
      const secretKeyBytes = bs58.decode(vanitySecretKeyBase58);
      const mintKeypair = Keypair.fromSecretKey(new Uint8Array(secretKeyBytes));
      setMintAddress(vanityPubKey);

      /* Step 3 — Get unsigned transaction from PumpPortal */
      setStatusMsg("Building launch transaction…");
      const devBuy = parseFloat(form.devBuySol) || 0;
      const createRes = await fetch("/api/pump-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "create", publicKey: publicKey.toBase58(), metadataUri: uri,
          name: form.name.trim(), symbol: form.symbol.trim().toUpperCase(),
          mintPublicKey: mintKeypair.publicKey.toBase58(), devBuySol: devBuy, slippage: 15,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({ error: "Transaction build failed" }));
        throw new Error(err.error || "Transaction build failed");
      }
      const { transaction: txBase64 } = await createRes.json();

      /* Step 4 — Deserialize, sign with mint keypair, then sign with Phantom */
      setStep("signing");
      setStatusMsg("Sign the token creation transaction in Phantom…");
      const txBytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBytes);
      tx.sign([mintKeypair]);
      const signedTx = await signTransaction(tx);

      /* Step 5 — Send */
      setStep("sending");
      setStatusMsg("Broadcasting to Solana…");
      const sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: false, maxRetries: 3 });
      setStatusMsg("Confirming…");
      const confirmation = await connection.confirmTransaction(sig, "confirmed");
      if (confirmation.value.err) throw new Error("Transaction failed on-chain: " + JSON.stringify(confirmation.value.err));

      setTxSignature(sig);

      const mintAddr = mintKeypair.publicKey.toBase58();
      saveLaunch({
        mintAddress: mintAddr,
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        description: form.description.trim(),
        imageUrl: imagePreview || undefined,
        metadataUri: uri,
        txSignature: sig,
        launchedAt: new Date().toISOString(),
        twitter: form.twitter.trim() || undefined,
        telegram: form.telegram.trim() || undefined,
        website: form.website.trim() || undefined,
        devBuySol: devBuy || undefined,
        launcherWallet: publicKey.toBase58(),
      });

      // Shared OrbitX registry — powers the Home feed + the Claim Fees page.
      try {
        await registerToken({
          mint_address: mintAddr,
          name: form.name.trim(),
          ticker: form.symbol.trim().toUpperCase(),
          creator_wallet: publicKey.toBase58(),
          decimals: 6,
          supply: 1_000_000_000,
          dex: "pumpfun",
          mint_signature: sig,
          metadata_uri: uri,
          fee_route: "creator",
          cluster: "mainnet-beta",
          launch_type: "pump",
        });
      } catch (regErr) {
        // duplicate names/tickers or transient registry errors must not eat a live launch
        console.warn("[orbitx] pump registry insert failed", regErr);
      }

      setStep("success");
      toast.success("Token launched! 🚀");
    } catch (err: any) {
      console.error("Launch error:", err);
      if (err.message?.includes("User rejected")) { setStep("form"); toast.error("Transaction cancelled"); return; }
      setErrorMsg(err.message || "Unknown error");
      setStep("error");
      toast.error("Launch failed");
    }
  };

    const resetForm = () => {
    setStep("form"); setStatusMsg(""); setTxSignature(""); setMintAddress("");
    setErrorMsg(""); setMetadataUri("");
    setForm({ name: "", symbol: "", description: "", twitter: "", telegram: "", website: "", devBuySol: "0" });
    removeImage();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleConnectWallet = () => {
    select("Phantom" as any);
    setTimeout(() => connect().catch(() => {}), 100);
  };

  const getStepIndex = (): number => {
    switch (step) {
      case "uploading": return 0;
      case "signing": return 1;
      case "sending": return 2;
      default: return -1;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] px-4 py-6 md:py-10">
      <div className="mx-auto max-w-2xl">

        {/* Back button + Header */}
        <div className="mb-8">
          <button onClick={onBack} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Launched Tokens
          </button>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--og-cyan))]/20 bg-[hsl(var(--og-cyan))]/5 px-4 py-1.5 mb-4">
              <Rocket className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
              <span className="text-xs font-bold text-[hsl(var(--og-cyan))] uppercase tracking-widest">Create Token</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-2">Launch on Pump.fun</h1>
            <p className="text-sm text-white/40 max-w-md mx-auto">
              Fill in the details and launch your token with a custom "obx" vanity address—completely free!
            </p>
          </div>
        </div>

        {/* ─── Success Screen ──────────────────────────────── */}
        {step === "success" && (
          <Card className="border-green-500/30 bg-green-500/[0.03] backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-10 w-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Token Launched! 🚀</h2>
              <p className="text-sm text-white/50 mb-6">Your token is now live on pump.fun</p>

              <div className="mb-4 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Contract Address</p>
                <div className="flex items-center gap-2 justify-center">
                  <code className="text-sm text-[hsl(var(--og-cyan))] font-mono break-all">{mintAddress}</code>
                  <button onClick={() => copyToClipboard(mintAddress, "Address")} className="text-white/30 hover:text-white transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Transaction</p>
                <div className="flex items-center gap-2 justify-center">
                  <code className="text-xs text-white/60 font-mono">{txSignature.slice(0, 20)}…{txSignature.slice(-8)}</code>
                  <button onClick={() => copyToClipboard(txSignature, "Signature")} className="text-white/30 hover:text-white transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/orbitxlaunch/claim"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--og-gold))] px-6 py-3 text-sm font-bold text-black hover:bg-[hsl(var(--og-gold))]/90 transition-colors">
                  <DollarSign className="h-4 w-4" /> Claim Creator Fees
                </Link>
                <a href={`https://pump.fun/${mintAddress}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--og-cyan))] px-6 py-3 text-sm font-bold text-black hover:bg-[hsl(var(--og-cyan))] transition-colors">
                  <ExternalLink className="h-4 w-4" /> View on Pump.fun
                </a>
                <a href={`https://solscan.io/tx/${txSignature}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm font-bold text-white/60 hover:text-white hover:border-white/20 transition-colors">
                  <ExternalLink className="h-4 w-4" /> Solscan
                </a>
                <button onClick={() => { resetForm(); onSuccess(); }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm font-bold text-white/60 hover:text-white hover:border-white/20 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> View All Tokens
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Error Screen ──────────────────────────────────── */}
        {step === "error" && (
          <Card className="border-red-500/30 bg-red-500/[0.03] backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-10 w-10 text-red-400" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Launch Failed</h2>
              <p className="text-sm text-red-400/80 mb-6 font-mono break-all max-w-md mx-auto">{errorMsg}</p>
              <Button onClick={() => setStep("form")} variant="outline" className="border-white/10 text-white/60 hover:text-white">
                ← Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── Loading / In-Progress ─────────────────────────── */}
        {(step === "uploading" || step === "signing" || step === "sending") && (
          <Card className="border-[hsl(var(--og-cyan))]/20 bg-[hsl(var(--og-cyan))]/[0.02] backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--og-cyan))]/10 border border-[hsl(var(--og-cyan))]/20 animate-pulse">
                <Loader2 className="h-10 w-10 text-[hsl(var(--og-cyan))] animate-spin" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">
                {step === "uploading" ? "Uploading…" : step === "signing" ? "Sign Transaction" : "Broadcasting…"}
              </h2>
              <p className="text-sm text-white/50">{statusMsg}</p>

              <div className="mt-8 flex items-center justify-center gap-2">
                {STEP_LABELS.map((label, i) => {
                  const currentIdx = getStepIndex();
                  const isActive = i === currentIdx;
                  const isDone = i < currentIdx;
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                        isDone ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                        isActive ? "bg-[hsl(var(--og-cyan))]/20 text-[hsl(var(--og-cyan))] border border-[hsl(var(--og-cyan))]/30 animate-pulse" :
                        "bg-white/[0.03] text-white/20 border border-white/[0.06]"
                      }`}>
                        {isDone ? "✓" : i + 1}
                      </div>
                      <span className={`text-[10px] uppercase tracking-widest ${isDone ? "text-green-400/60" : isActive ? "text-[hsl(var(--og-cyan))]/80" : "text-white/20"}`}>
                        {label}
                      </span>
                      {i < STEP_LABELS.length - 1 && (
                        <ArrowRight className={`h-3 w-3 ${i < currentIdx ? "text-green-500/30" : "text-white/10"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Form ──────────────────────────────────────────── */}
        {step === "form" && (
          <div className="space-y-5">
            {/* Token Info Card */}
            <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
              <CardContent className="p-5 md:p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Token Info</h3>
                </div>

                {/* Image upload */}
                <div>
                  <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Logo *</Label>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleImageSelect} />
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img src={imagePreview} alt="Token logo" className="h-24 w-24 rounded-xl border-2 border-[hsl(var(--og-cyan))]/30 object-cover" />
                      <button onClick={removeImage} className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()} className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] text-white/20 hover:border-[hsl(var(--og-cyan))]/30 hover:text-[hsl(var(--og-cyan))]/60 transition-all">
                      <div className="text-center"><Upload className="h-5 w-5 mx-auto mb-1" /><span className="text-[9px] uppercase tracking-widest">Upload</span></div>
                    </button>
                  )}
                  <p className="text-[10px] text-white/20 mt-1.5">PNG, JPG, GIF, or WebP · Max 5 MB</p>
                </div>

                {/* Name + Symbol */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Token Name *</Label>
                    <Input placeholder="e.g. Doge Coin" value={form.name} onChange={(e) => updateField("name", e.target.value)} maxLength={32}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[hsl(var(--og-cyan))]/40" />
                  </div>
                  <div>
                    <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Ticker *</Label>
                    <Input placeholder="e.g. DOGE" value={form.symbol} onChange={(e) => updateField("symbol", e.target.value.toUpperCase())} maxLength={10}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[hsl(var(--og-cyan))]/40 uppercase" />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Description</Label>
                  <Textarea placeholder="What's your token about? (optional)" value={form.description} onChange={(e) => updateField("description", e.target.value)} maxLength={500} rows={3}
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[hsl(var(--og-cyan))]/40 resize-none" />
                  <p className="text-[10px] text-white/15 text-right mt-1">{form.description.length}/500</p>
                </div>
              </CardContent>
            </Card>

            {/* Socials Card */}
            <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
              <CardContent className="p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Socials</h3>
                  <Badge className="bg-white/[0.04] text-white/25 border-white/[0.06] text-[9px]">Optional</Badge>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Twitter className="h-4 w-4 text-white/20 shrink-0" />
                    <Input placeholder="https://x.com/yourtoken" value={form.twitter} onChange={(e) => updateField("twitter", e.target.value)}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[hsl(var(--og-cyan))]/40" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Send className="h-4 w-4 text-white/20 shrink-0" />
                    <Input placeholder="https://t.me/yourgroup" value={form.telegram} onChange={(e) => updateField("telegram", e.target.value)}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[hsl(var(--og-cyan))]/40" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-white/20 shrink-0" />
                    <Input placeholder="https://yourtoken.com" value={form.website} onChange={(e) => updateField("website", e.target.value)}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[hsl(var(--og-cyan))]/40" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dev Buy Card */}
            <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
              <CardContent className="p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Initial Buy</h3>
                  <Badge className="bg-white/[0.04] text-white/25 border-white/[0.06] text-[9px]">Optional</Badge>
                </div>
                <div>
                  <Label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Dev Buy (SOL)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0" value={form.devBuySol} onChange={(e) => updateField("devBuySol", e.target.value)}
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/15 focus:border-[hsl(var(--og-cyan))]/40 max-w-[200px]" />
                  <p className="text-[10px] text-white/20 mt-1.5 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Buy your own token at launch. Set 0 for no initial buy.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Connect wallet / Launch button */}
            {!connected ? (
              <>
                <button onClick={handleConnectWallet}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-[hsl(var(--og-cyan))]/20 bg-[hsl(var(--og-cyan))]/5 px-6 py-4 text-[hsl(var(--og-cyan))] font-bold hover:bg-[hsl(var(--og-cyan))]/10 transition-all">
                  <Wallet className="h-5 w-5" /> Connect Wallet to Launch
                </button>

              </>
            ) : (
              <button onClick={handleLaunch} disabled={!canLaunch}
                className={`w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-base font-black transition-all ${
                  canLaunch ? "bg-gradient-to-r from-[hsl(var(--og-cyan))] to-[hsl(var(--og-lime))] text-black hover:from-[hsl(var(--og-cyan))] hover:to-[hsl(var(--og-cyan))] shadow-lg shadow-[hsl(var(--og-cyan))]/20" : "bg-white/[0.04] text-white/20 cursor-not-allowed"
                }`}>
                <Rocket className="h-5 w-5" />
                {!form.name.trim() || !form.symbol.trim() ? "Fill in token details" : !imageFile ? "Upload a logo" : `Launch ${form.symbol.trim()} 🚀`}
              </button>
            )}

  <p className="text-center text-[10px] text-white/15 leading-relaxed">
By launching, you agree to pump.fun's terms. Tokens are deployed on Solana mainnet with a custom vanity address ending in "obx".<br />A $1.50 platform launch fee (paid in SOL) applies — the same flat fee as the custom lane — plus the standard network fee (~0.02 SOL).<br />You earn pump.fun creator fees on every buy/sell (0.30% on the bonding curve, dynamic after graduation) — claim them in-app under Claim Fees.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
