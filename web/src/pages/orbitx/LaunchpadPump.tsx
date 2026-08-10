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
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { ANTI_VAMP_ENFORCEMENT_ENABLED, PLATFORM_WALLET, LAUNCHPAD_FEE_USD, BASE_LAUNCH_FEE_USD, isLaunchFeePromoActive, launchFeePromoDaysLeft, CREATOR_FEE_BPS, TRADE_FEE_CREATOR_SHARE_PCT, TRADE_FEE_PLATFORM_SHARE_PCT, tradeFeeSharePerDollar } from "@/lib/platformFee";
import { registerToken, checkAntiVamp, recordReferralEarning } from "@/lib/orbitx/registry";
import { setCollectionCoin } from "@/lib/orbitx/nftRegistry";
import {
  consumeTokenCreatePrefill, peekTokenCreatePrefill, dataUrlToFile, urlToFile,
} from "@/lib/orbitx/tokenCreatePrefill";
import { Link } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import {
  Rocket, Upload, Globe, Twitter, Send,
  Loader2, CheckCircle, Copy, ExternalLink, Wallet, AlertTriangle, AlertCircle,
  Sparkles, Zap, ArrowRight, X, Info, DollarSign, Plus,
  TrendingUp, TrendingDown, Clock, BarChart3, Droplets,
  Users, ArrowLeft, RefreshCw, Search, ChevronRight, Wand2, CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Confetti } from "./lpx";

/* ─── Constants ──────────────────────────────────────────────────────── */

const MAX_IMG_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMG = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const STORAGE_KEY = "ogscan_launched_tokens";

function estimateVanity(prefix: string, ratePerSec: number) {
  const clean = prefix.replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
  const n = clean.length;
  const perCharSpace = 58 / 2;
  const expected = Math.pow(perCharSpace, n);
  const seconds = ratePerSec > 0 ? expected / ratePerSec : Infinity;
  return { n, expected, seconds };
}
function humanTime(sec: number) {
  if (!isFinite(sec)) return "—";
  if (sec < 1) return "<1s";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}

function VanityStatChip({ label, value, tone = "gold" }: { label: string; value: string; tone?: "gold" | "cyan" | "lime" | "blood" }) {
  const toneHsl =
    tone === "cyan" ? "hsl(var(--og-cyan))" :
    tone === "lime" ? "hsl(var(--og-lime))" :
    tone === "blood" ? "hsl(var(--og-blood))" :
    "hsl(var(--og-gold))";
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-white">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold" style={{ color: toneHsl }}>{value}</div>
    </div>
  );
}

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
  const [params] = useSearchParams();
  const fromNft = params.get("from") === "nft" || !!peekTokenCreatePrefill();
  const [view, setView] = useState<PageView>(fromNft ? "create" : "gallery");

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
    <div className="px-0 py-1">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => navigate("/trading-hub")} className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="inline-flex items-center gap-2 rounded-lg border border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.08)] px-4 py-1.5">
                <Rocket className="h-4 w-4 text-[#60A5FA]" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#60A5FA]">Pump lane · launch archive</span>
              </div>
            </div>
            <h1 className="font-display text-2xl font-black text-white md:text-3xl">
              Launched <span className="text-[#F0C75E]">tokens</span>
            </h1>
            <p className="mt-1 text-sm text-white">
              Every token deployed through the OrbitX pump lane — live-priced via DexScreener
            </p>
          </div>

          <button
            onClick={onCreateClick}
            className="pf-btn flex shrink-0 items-center gap-2.5"
          >
            <Plus className="h-4.5 w-4.5" />
            Launch Token
          </button>
        </div>

        {/* Search bar (show when there are tokens) */}
        {launches.length > 0 && (
          <div className="ox-board-toolbar mb-6" role="search">
            <div className="ox-board-search">
              <Search className="ox-board-search-icon" aria-hidden />
              <Input
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Search by name, ticker, or address…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search launched tokens"
                className="h-11 border-white/[0.08] bg-white/[0.03] pl-10 text-white placeholder:text-white focus:border-[hsl(var(--og-cyan))]/40"
              />
            </div>
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
        <Search className="h-12 w-12 text-white mb-4" />
        <h3 className="text-lg font-bold text-white">No tokens found</h3>
        <p className="text-sm text-white mt-1">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-[hsl(var(--og-cyan))]/5 border border-[hsl(var(--og-cyan))]/10">
        <Rocket className="h-12 w-12 text-[hsl(var(--og-cyan))]/30" />
      </div>
      <h3 className="text-xl font-black text-white mb-2">No tokens launched yet</h3>
      <p className="text-sm text-white max-w-sm mb-6">
        Create your first token on pump.fun directly from OrbitX. It only takes a few seconds.
      </p>
      <button
        onClick={onCreateClick}
        className="lp-cta flex items-center gap-2 rounded-xl px-6 py-3 font-display text-sm font-black uppercase tracking-wider"
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
              <code className="text-[10px] text-white font-mono">
                {token.mintAddress.slice(0, 6)}…{token.mintAddress.slice(-4)}
              </code>
              <button onClick={copyAddress} className="text-white hover:text-white transition-colors">
                {copied ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>

            {/* Age */}
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-white" />
              <span className="text-[10px] text-white">
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
              <span className="text-xs text-white">Loading…</span>
            )}
          </div>
        </div>

        {/* Stats row */}
        {live && (
          <div className="grid grid-cols-3 gap-3 mb-4 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
            <div>
              <p className="text-[9px] text-white uppercase tracking-widest mb-0.5">Market Cap</p>
              <p className="text-xs font-bold text-white">{fmtUsd(live.marketCap)}</p>
            </div>
            <div>
              <p className="text-[9px] text-white uppercase tracking-widest mb-0.5">Volume 24h</p>
              <p className="text-xs font-bold text-white">{fmtUsd(live.volume24h)}</p>
            </div>
            <div>
              <p className="text-[9px] text-white uppercase tracking-widest mb-0.5">Liquidity</p>
              <p className="text-xs font-bold text-white">{fmtUsd(live.liquidity)}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {token.description && (
          <p className="text-[11px] text-white line-clamp-2 mb-3 leading-relaxed">{token.description}</p>
        )}

        {/* Bottom row: socials + links */}
        <div className="flex items-center justify-between">
          {/* Social links */}
          <div className="flex items-center gap-2">
            {token.twitter && (
              <a href={token.twitter} target="_blank" rel="noopener noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-white hover:text-white hover:border-white/10 transition-colors">
                <Twitter className="h-3.5 w-3.5" />
              </a>
            )}
            {token.telegram && (
              <a href={token.telegram} target="_blank" rel="noopener noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-white hover:text-white hover:border-white/10 transition-colors">
                <Send className="h-3.5 w-3.5" />
              </a>
            )}
            {token.website && (
              <a href={token.website} target="_blank" rel="noopener noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-white hover:text-white hover:border-white/10 transition-colors">
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
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-white hover:text-white hover:border-white/10 transition-all uppercase tracking-wider"
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
  const [params] = useSearchParams();
  const linkCollectionId = useRef<string | null>(null);
  const [nftPrefillBanner, setNftPrefillBanner] = useState(false);

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
  const [nameTaken, setNameTaken] = useState(false);
  const [checkingName, setCheckingName] = useState(false);
  const [blockedMatch, setBlockedMatch] = useState<{ name: string; ticker: string } | null>(null);
  const [checkError, setCheckError] = useState(false);
  const antiVampBlocked = ANTI_VAMP_ENFORCEMENT_ENABLED && nameTaken;
  const nameCheckTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom vanity mint grind (same UX as /orbitxlaunch/create custom lane).
  const [vanityPrefix, setVanityPrefix] = useState("OBX");
  const [grinding, setGrinding] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [foundKey, setFoundKey] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
  const grindStop = useRef(false);
  const foundKpRef = useRef<Keypair | null>(null);
  const vanityEst = useMemo(() => estimateVanity(vanityPrefix, rate || 8000), [vanityPrefix, rate]);

  // Auto-fill from NFT / collection handoff
  useEffect(() => {
    if (params.get("from") !== "nft" && !peekTokenCreatePrefill()) return;
    const draft = consumeTokenCreatePrefill();
    if (!draft) return;
    linkCollectionId.current = draft.collectionId ?? null;
    setForm((f) => ({
      ...f,
      name: draft.name || f.name,
      symbol: draft.symbol || f.symbol,
      description: draft.description || f.description,
      website: draft.website || f.website,
      twitter: draft.twitter || f.twitter,
      telegram: draft.telegram || f.telegram,
    }));
    setNftPrefillBanner(true);
    void (async () => {
      try {
        let file: File | null = null;
        if (draft.imageDataUrl) file = await dataUrlToFile(draft.imageDataUrl, `${draft.symbol || "token"}-logo`);
        else if (draft.imageUrl) file = await urlToFile(draft.imageUrl, `${draft.symbol || "token"}-logo`);
        if (file) {
          setImageFile(file);
          setImagePreview(draft.imageDataUrl || URL.createObjectURL(file));
        }
        toast.success("NFT details pasted into Create Token — review and launch.");
      } catch (e) {
        console.warn("[orbitx] prefill image failed", e);
        toast.message("Name & ticker filled from NFT — upload the logo if it did not load.");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runGrind = useCallback(() => {
    const target = vanityPrefix.trim();
    if (!target) {
      toast.error("Enter a vanity prefix (e.g. OBX)");
      return;
    }
    setGrinding(true);
    setFoundKey(null);
    setAttempts(0);
    foundKpRef.current = null;
    grindStop.current = false;
    const started = performance.now();
    let count = 0;
    const CHUNK = 1200;
    const targetLower = target.toLowerCase();
    const step = () => {
      if (grindStop.current) {
        setGrinding(false);
        return;
      }
      for (let i = 0; i < CHUNK; i++) {
        const kp = Keypair.generate();
        count++;
        const addr = kp.publicKey.toBase58();
        if (addr.toLowerCase().startsWith(targetLower)) {
          foundKpRef.current = kp;
          setFoundKey(addr);
          setAttempts(count);
          setRate(Math.round((count / (performance.now() - started)) * 1000));
          setGrinding(false);
          toast.success(`Found ${target}… address in ${count.toLocaleString()} tries`);
          return;
        }
      }
      setAttempts(count);
      setRate(Math.round((count / (performance.now() - started)) * 1000));
      if (count > 2_500_000) {
        setGrinding(false);
        toast.error("Grind ceiling reached — try a shorter prefix (OBX is realistic, longer isn't).");
        return;
      }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }, [vanityPrefix]);

  useEffect(() => () => { grindStop.current = true; }, []);

  // Debounced OrbitX Anti-Vamp check on BOTH name and ticker
  // similarity on both fields in one RPC call, so a duplicate ticker with a
  // different name blocks live here too, not just at final submit.
  useEffect(() => {
    if (!ANTI_VAMP_ENFORCEMENT_ENABLED) {
      setNameTaken(false);
      setBlockedMatch(null);
      setCheckError(false);
      setCheckingName(false);
      return;
    }
    if (!form.name.trim() && !form.symbol.trim()) { setNameTaken(false); setBlockedMatch(null); setCheckError(false); return; }
    clearTimeout(nameCheckTimer.current);
    setCheckingName(true);
    nameCheckTimer.current = setTimeout(async () => {
      try {
        // Unified check: OrbitX registry + pump.fun + DexScreener, live as you type.
        const result = await checkAntiVamp(form.name, form.symbol);
        // Block on any blocked verdict — a real collision OR a degraded/unavailable check.
        // Only use hardMatch for the specific "too close to X" messaging.
        setNameTaken(!!result.blocked);
        setCheckError(!!result.error || !!result.warning);
        setBlockedMatch(result.hardMatch ? { name: result.hardMatch.name, ticker: result.hardMatch.ticker } : null);
      } catch (err) {
        console.error("Anti-vamp check failed:", err);
        // Fail closed — an unavailable originality check must be retried before launch.
        setNameTaken(true);
        setCheckError(true);
        setBlockedMatch(null);
      } finally {
        setCheckingName(false);
      }
    }, 500);
    return () => clearTimeout(nameCheckTimer.current);
  }, [form.name, form.symbol]);

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
    !!imageFile && !antiVampBlocked && (!ANTI_VAMP_ENFORCEMENT_ENABLED || !checkingName) && !grinding;

  /* Launch flow */

  const handleLaunch = async () => {
    if (!canLaunch || !publicKey || !signTransaction || !sendTransaction || !imageFile) return;

    let flagged = false;
    /* Step -1 - Anti-vamp is temporarily paused; launch normally with creator fee routing. */
    if (ANTI_VAMP_ENFORCEMENT_ENABLED) {
    setStep("uploading");
    setStatusMsg("OrbitX Anti-Vamp check...");
    const result = await checkAntiVamp(form.name, form.symbol).catch((err) => {
      console.error("[orbitx] pump anti-vamp check failed", err);
      return { blocked: false, flagged: true, hardMatch: null, matches: [], warning: "verification_degraded", message: "Originality verification failed - continuing with caution." } as const;
    });
    if (result.warning === "verification_degraded") {
      setNameTaken(true);
      toast.error("Anti-vamp verification is unavailable. Retry before launching.");
      setStep("form");
      return;
    }
    if (result.blocked) {
      setNameTaken(true);
      if (result.hardMatch) {
        setBlockedMatch({ name: result.hardMatch.name, ticker: result.hardMatch.ticker });
        toast.error(
          `Blocked - "${form.name}" / ${form.symbol} is too close to ${result.hardMatch.name} ($${result.hardMatch.ticker}). Anti-vamp requires a unique identity.`
        );
      } else {
        toast.error(result.message || "Launch blocked. Choose a new token name and ticker.");
      }
      setStep("form");
      return;
    }
    if (result.flagged) {
      flagged = true;
      toast.warning(
        result.matches.length
          ? `${result.matches.length} similar token(s) exist - launching FLAGGED: creator fees route to OBX buybacks.`
          : result.message || "Anti-vamp caution - launching with elevated fee-routing.",
      );
    }
    }

    try {
      /* Step 0 — Platform launch fee ($0.50 in SOL, Solana only) */
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

      /* Step 2 — Vanity mint keypair (browser grind if ready, else server fallback) */
      let mintKeypair: Keypair;
      if (foundKpRef.current) {
        mintKeypair = foundKpRef.current;
        setStatusMsg(`Using your vanity mint (${vanityPrefix}…)…`);
        setMintAddress(mintKeypair.publicKey.toBase58());
      } else {
        const suffix = (vanityPrefix.trim() || "obx").toLowerCase().slice(0, 5);
        setStatusMsg(`Generating vanity address (…${suffix})…`);
        let vanityRes = await fetch("/api/vanity-mint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suffix, maxIterations: 5000000 }),
        });
        if (!vanityRes.ok && vanityRes.status === 504) {
          setStatusMsg("Still searching for a matching address, retrying…");
          vanityRes = await fetch("/api/vanity-mint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ suffix, maxIterations: 5000000 }),
          });
        }
        if (!vanityRes.ok) {
          const err = await vanityRes.json().catch(() => ({ error: "Vanity mint generation failed" }));
          throw new Error(err.error || "Vanity mint generation failed");
        }
        const { publicKey: vanityPubKey, secretKey: vanitySecretKeyBase58, attempts: vanityAttempts, timeMs } = await vanityRes.json();
        console.log(`[orbitx] Generated vanity mint ${vanityPubKey} after ${vanityAttempts} attempts in ${timeMs}ms`);
        const secretKeyBytes = bs58.decode(vanitySecretKeyBase58);
        mintKeypair = Keypair.fromSecretKey(new Uint8Array(secretKeyBytes));
        setMintAddress(vanityPubKey);
      }

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
      // Some wallet adapters return a rebuilt transaction and drop client-side
      // partial signatures. Re-apply the mint signature before serialization.
      signedTx.sign([mintKeypair]);
      if (!signedTx.verifySignatures()) {
        throw new Error(`Launch transaction is missing a required signature for ${mintKeypair.publicKey.toBase58()}. Please reconnect your wallet and retry.`);
      }

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

      // Shared OrbitX registry - powers the Home feed + the Claim Fees page.
      // Anti-vamp enforcement is currently paused; launch proceeds normally.
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
          is_vamp: flagged,
          fee_route: flagged ? "orbitx_buyback" : "creator",
          cluster: "mainnet-beta",
          launch_type: "pump",
        });
        // Credit this launcher's referrer (if any) a share of the real launch fee paid.
        await recordReferralEarning(publicKey.toBase58(), mintAddr, LAUNCHPAD_FEE_USD);
      } catch (regErr) {
        // duplicate names/tickers or transient registry errors must not eat a live launch
        console.warn("[orbitx] pump registry insert failed", regErr);
      }

      // Link pump coin back to the NFT collection when launched from NFT handoff.
      if (linkCollectionId.current) {
        try {
          await setCollectionCoin(linkCollectionId.current, mintAddr, publicKey.toBase58());
          toast.success("Token linked to your NFT collection");
        } catch (linkErr) {
          console.warn("[orbitx] setCollectionCoin failed", linkErr);
        }
        linkCollectionId.current = null;
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
    const __w = wallets.find(w => w.readyState === "Installed") || wallets.find(w => ["Phantom","Jupiter","Solflare","Backpack"].includes(w.adapter.name)) || wallets[0]; if (__w) select(__w.adapter.name);
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
    <div className="px-0 py-1">
      <div className="mx-auto max-w-2xl">

        {/* Back button + Header */}
        <div className="mb-8">
          <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm text-white transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Launched Tokens
          </button>
          <div className="ox-tab-hero mb-2">
            <div className="ox-tab-hero-glow" style={{ background: "radial-gradient(500px 180px at 0% 0%, #60A5FA28, transparent 70%)" }} />
            <div className="relative text-center">
              <div className="pf-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#60A5FA]">Deploy · pump lane</div>
              <h1 className="mt-1 font-display text-2xl font-black text-white md:text-3xl">
                Launch on <span className="text-[#F0C75E]">Pump.fun</span>
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-white">
                {isLaunchFeePromoActive() ? <>Launch fee <span className="font-bold text-[#F0C75E]">FREE for {launchFeePromoDaysLeft()} more days</span> — fill in the details, optionally grind a custom vanity mint, then deploy.</> : <>Fill in the details, optionally grind a custom vanity mint, then launch.</>}
              </p>
            </div>
          </div>
        </div>

        {/* ─── Success Screen ──────────────────────────────── */}
        {step === "success" && (
          <Card className="ox-panel ox-panel--accent pf-card relative overflow-hidden border-0 bg-transparent">
            <Confetti />
            <CardContent className="relative p-8 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.1)]">
                <CheckCircle className="h-10 w-10 text-[#F0C75E]" />
              </div>
              <h2 className="font-display text-2xl font-black text-[#F0C75E] mb-2">Deployment complete</h2>
              <p className="text-sm text-white mb-6">Your token is now live on pump.fun</p>

              <div className="mb-4 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-[10px] text-white uppercase tracking-widest mb-1">Contract Address</p>
                <div className="flex items-center gap-2 justify-center">
                  <code className="text-sm text-[hsl(var(--og-cyan))] font-mono break-all">{mintAddress}</code>
                  <button onClick={() => copyToClipboard(mintAddress, "Address")} className="text-white hover:text-white transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-[10px] text-white uppercase tracking-widest mb-1">Transaction</p>
                <div className="flex items-center gap-2 justify-center">
                  <code className="text-xs text-white font-mono">{txSignature.slice(0, 20)}…{txSignature.slice(-8)}</code>
                  <button onClick={() => copyToClipboard(txSignature, "Signature")} className="text-white hover:text-white transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/orbitxlaunch/claim" className="pf-btn inline-flex items-center justify-center gap-2">
                  <DollarSign className="h-4 w-4" /> Claim Creator Fees
                </Link>
                <a href={`https://pump.fun/${mintAddress}`} target="_blank" rel="noopener noreferrer"
                  className="ox-btn ox-btn--blue inline-flex items-center justify-center gap-2">
                  <ExternalLink className="h-4 w-4" /> View on Pump.fun
                </a>
                <a href={`https://solscan.io/tx/${txSignature}`} target="_blank" rel="noopener noreferrer"
                  className="ox-btn inline-flex items-center justify-center gap-2">
                  <ExternalLink className="h-4 w-4" /> Solscan
                </a>
                <button onClick={() => { resetForm(); onSuccess(); }}
                  className="ox-btn inline-flex items-center justify-center gap-2">
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
              <Button onClick={() => setStep("form")} variant="outline" className="border-white/10 text-white hover:text-white">
                ← Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─���─ Loading / In-Progress ────────────────────��────── */}
        {(step === "uploading" || step === "signing" || step === "sending") && (
          <Card className="ox-panel ox-panel--accent pf-card relative overflow-hidden border-0 bg-transparent">
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--og-cyan))]/10 border border-[hsl(var(--og-cyan))]/20 animate-pulse">
                <Loader2 className="h-10 w-10 text-[hsl(var(--og-cyan))] animate-spin" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">
                {step === "uploading" ? "Uploading…" : step === "signing" ? "Sign Transaction" : "Broadcasting…"}
              </h2>
              <p className="text-sm text-white">{statusMsg}</p>

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
                        "bg-white/[0.03] text-white border border-white/[0.06]"
                      }`}>
                        {isDone ? "✓" : i + 1}
                      </div>
                      <span className={`text-[10px] uppercase tracking-widest ${isDone ? "text-green-400/60" : isActive ? "text-[hsl(var(--og-cyan))]/80" : "text-white"}`}>
                        {label}
                      </span>
                      {i < STEP_LABELS.length - 1 && (
                        <ArrowRight className={`h-3 w-3 ${i < currentIdx ? "text-green-500/30" : "text-white"}`} />
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
            {nftPrefillBanner && (
              <div className="rounded-xl border border-[hsl(var(--pf-green))]/40 bg-[hsl(var(--pf-green))]/10 p-4 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-[hsl(var(--pf-green))] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-[hsl(var(--pf-green))]">Filled from your NFT</div>
                  <div className="mt-1 text-sm text-white">
                    Name, ticker, description, and logo were pasted automatically. Review, then launch when ready — no need to re-enter anything.
                  </div>
                </div>
              </div>
            )}
            {ANTI_VAMP_ENFORCEMENT_ENABLED && nameTaken && (
              <div className="rounded-lg border-2 border-[hsl(var(--og-blood))]/60 bg-[hsl(var(--og-blood))]/15 p-4 flex items-start gap-3 shadow-[0_0_30px_-8px_hsl(var(--og-blood)/0.6)]">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--og-blood))] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-black uppercase tracking-wide text-[hsl(var(--og-blood))]">🚫 OrbitX Anti-Vamp Protection — Launch Blocked</div>
                  <div className="text-sm text-white mt-1">
                    This name or ticker collides with an existing token
                    {blockedMatch?.name ? <> — too close to <strong>{blockedMatch.name}</strong>{blockedMatch.ticker && blockedMatch.ticker !== "—" ? <> (${blockedMatch.ticker})</> : null}</> : null}.
                    Change the name or ticker to continue.
                  </div>
                </div>
              </div>
            )}
            {ANTI_VAMP_ENFORCEMENT_ENABLED && checkError && !nameTaken && (
              <div className="rounded-lg border border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10 p-3 text-sm text-white">
                Anti-vamp verification is degraded — launch is blocked until verification recovers. Retry once sources are back online.
              </div>
            )}
            {/* Token Info Card */}
            <Card className="ox-panel pf-card border-0 bg-transparent">
              <CardContent className="p-5 md:p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Token Info</h3>
                </div>

                {/* Image upload */}
                <div>
                  <Label className="text-xs text-white uppercase tracking-widest mb-2 block">Logo *</Label>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleImageSelect} disabled={nameTaken} />
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img src={imagePreview} alt="Token logo" className="h-24 w-24 rounded-xl border-2 border-[hsl(var(--og-cyan))]/30 object-cover" />
                      <button onClick={removeImage} disabled={nameTaken} className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()} disabled={nameTaken} className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] text-white hover:border-[hsl(var(--og-cyan))]/30 hover:text-[hsl(var(--og-cyan))]/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      <div className="text-center"><Upload className="h-5 w-5 mx-auto mb-1" /><span className="text-[9px] uppercase tracking-widest">Upload</span></div>
                    </button>
                  )}
                  <p className="text-[10px] text-white mt-1.5">PNG, JPG, GIF, or WebP · Max 5 MB</p>
                </div>

                {/* Name + Symbol */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-white uppercase tracking-widest mb-2 flex items-center gap-1.5">Token Name * {checkingName && <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--og-gold))]" />}</Label>
                    <Input placeholder="e.g. Doge Coin" value={form.name} onChange={(e) => updateField("name", e.target.value)} maxLength={32}
                      className={`bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white focus:border-[hsl(var(--og-cyan))]/40 ${nameTaken ? "border-[hsl(var(--og-blood))]" : ""}`} />
                  </div>
                  <div>
                    <Label className="text-xs text-white uppercase tracking-widest mb-2 block">Ticker *</Label>
                    <Input placeholder="e.g. DOGE" value={form.symbol} onChange={(e) => updateField("symbol", e.target.value.toUpperCase())} maxLength={10}
                      className={`bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white focus:border-[hsl(var(--og-cyan))]/40 uppercase ${nameTaken ? "border-[hsl(var(--og-blood))]" : ""}`} />
                  </div>
                </div>
                {ANTI_VAMP_ENFORCEMENT_ENABLED && nameTaken && blockedMatch?.name && (
                  <div className="flex items-start gap-1.5 text-xs text-[hsl(var(--og-blood))]">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      OrbitX Anti-Vamp: too close to {blockedMatch.name}
                      {blockedMatch.ticker && blockedMatch.ticker !== "—" ? ` ($${blockedMatch.ticker})` : ""}. Change the name or ticker to launch.
                    </span>
                  </div>
                )}

                {/* Description */}
                <div>
                  <Label className="text-xs text-white uppercase tracking-widest mb-2 block">Description</Label>
                  <Textarea placeholder="What's your token about? (optional)" value={form.description} onChange={(e) => updateField("description", e.target.value)} maxLength={500} rows={3} disabled={nameTaken}
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white focus:border-[hsl(var(--og-cyan))]/40 resize-none disabled:opacity-40" />
                  <p className="text-[10px] text-white text-right mt-1">{form.description.length}/500</p>
                </div>
              </CardContent>
            </Card>

            {/* Socials Card */}
            <Card className="ox-panel pf-card border-0 bg-transparent">
              <CardContent className="p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Socials</h3>
                  <Badge className="bg-white/[0.04] text-white border-white/[0.06] text-[9px]">Optional</Badge>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Twitter className="h-4 w-4 text-white shrink-0" />
                    <Input placeholder="https://x.com/yourtoken" value={form.twitter} onChange={(e) => updateField("twitter", e.target.value)} disabled={nameTaken}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white focus:border-[hsl(var(--og-cyan))]/40 disabled:opacity-40" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Send className="h-4 w-4 text-white shrink-0" />
                    <Input placeholder="https://t.me/yourgroup" value={form.telegram} onChange={(e) => updateField("telegram", e.target.value)} disabled={nameTaken}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white focus:border-[hsl(var(--og-cyan))]/40 disabled:opacity-40" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-white shrink-0" />
                    <Input placeholder="https://yourtoken.com" value={form.website} onChange={(e) => updateField("website", e.target.value)} disabled={nameTaken}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white focus:border-[hsl(var(--og-cyan))]/40 disabled:opacity-40" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dev Buy Card */}
            <Card className="ox-panel pf-card border-0 bg-transparent">
              <CardContent className="p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Initial Buy</h3>
                  <Badge className="bg-white/[0.04] text-white border-white/[0.06] text-[9px]">Optional</Badge>
                </div>
                <div>
                  <Label className="text-xs text-white uppercase tracking-widest mb-2 block">Dev Buy (SOL)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0" value={form.devBuySol} onChange={(e) => updateField("devBuySol", e.target.value)} disabled={nameTaken}
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white focus:border-[hsl(var(--og-cyan))]/40 max-w-[200px] disabled:opacity-40" />
                  <p className="text-[10px] text-white mt-1.5 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Buy your own token at launch. Set 0 for no initial buy.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Vanity Mint Card — same custom selection as Custom launches */}
            <Card className="ox-panel pf-card border-0 bg-transparent">
              <CardContent className="p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wand2 className="h-4 w-4 text-[hsl(var(--og-gold))]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Vanity Mint Address</h3>
                  <Badge className="bg-[hsl(var(--og-gold))]/10 text-[hsl(var(--og-gold))] border-[hsl(var(--og-gold))]/25 text-[9px]">Custom</Badge>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--og-cyan))]/30 bg-[hsl(var(--og-cyan))]/10 p-3 text-xs text-white">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--og-cyan))]" />
                  <span>
                    <b className="text-white">Same as Custom launches:</b> grind a mint that <b className="text-white">starts with</b> your prefix in-browser.
                    A 3-char prefix like <span className="font-mono text-[hsl(var(--og-gold))]">OBX</span> is realistic. Longer prefixes get ~29× harder per character.
                    If you skip grinding, launch falls back to a server vanity search for <span className="font-mono">…{vanityPrefix.trim().toLowerCase() || "obx"}</span>.
                  </span>
                </div>
                <div>
                  <Label className="text-xs text-white uppercase tracking-widest mb-2 block">Desired prefix</Label>
                  <Input
                    value={vanityPrefix}
                    maxLength={8}
                    disabled={nameTaken || grinding}
                    onChange={(e) => {
                      const next = e.target.value.replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
                      setVanityPrefix(next);
                      foundKpRef.current = null;
                      setFoundKey(null);
                    }}
                    className="bg-white/[0.03] border-white/[0.08] text-white font-mono uppercase placeholder:text-white focus:border-[hsl(var(--og-gold))]/40 max-w-[220px] disabled:opacity-40"
                    placeholder="OBX"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <VanityStatChip label="Length" value={String(vanityEst.n)} tone="cyan" />
                  <VanityStatChip
                    label="Est. tries"
                    value={vanityEst.expected >= 1e6 ? vanityEst.expected.toExponential(1) : Math.round(vanityEst.expected).toLocaleString()}
                    tone="gold"
                  />
                  <VanityStatChip label="Est. time" value={humanTime(vanityEst.seconds)} tone={vanityEst.n > 4 ? "blood" : "lime"} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {!grinding ? (
                    <Button
                      type="button"
                      onClick={runGrind}
                      disabled={nameTaken || !vanityPrefix.trim()}
                      className="bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90"
                    >
                      <Wand2 className="mr-2 h-4 w-4" /> Start grinding
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => { grindStop.current = true; }}
                      variant="outline"
                      className="border-[hsl(var(--og-blood))]/50 text-[hsl(var(--og-blood))]"
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Stop
                    </Button>
                  )}
                  {attempts > 0 && (
                    <span className="font-mono text-xs text-white">
                      {attempts.toLocaleString()} tries{rate ? ` · ${rate.toLocaleString()}/s` : ""}
                    </span>
                  )}
                </div>
                {foundKey && (
                  <div className="rounded-xl border border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10 p-3">
                    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--og-lime))]">
                      <CheckCircle2 className="h-4 w-4" /> Match found — will be used on launch
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="truncate font-mono text-xs text-white">{foundKey}</code>
                      <button
                        type="button"
                        onClick={() => { void navigator.clipboard.writeText(foundKey); toast.success("Copied"); }}
                        className="text-white hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Connect wallet / Launch button */}
            {!connected ? (
              <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--pf-border))] px-6 py-4 text-sm text-[hsl(var(--pf-muted))]">
                <Wallet className="h-4 w-4" /> Connect via the wallet button up top to launch
              </div>
            ) : (
              <button onClick={handleLaunch} disabled={!canLaunch}
                className={`w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-base font-black transition-all ${
                  canLaunch ? "lp-cta font-display uppercase tracking-wider" : "bg-white/[0.04] text-white cursor-not-allowed"
                }`}>
                <Rocket className="h-5 w-5" />
                {!form.name.trim() || !form.symbol.trim() ? "Fill in token details" : !imageFile ? "Upload a logo" : `Launch ${form.symbol.trim()} 🚀`}
              </button>
            )}

  <p className="text-center text-[10px] text-white leading-relaxed">
By launching, you agree to pump.fun's terms. Tokens are deployed on Solana mainnet with a custom vanity mint (grind your own prefix, or fall back to a server vanity search).<br />{isLaunchFeePromoActive() ? <>Launch fee: <span className="font-bold text-[hsl(var(--og-lime))]">FREE for a limited time</span> (normally ${BASE_LAUNCH_FEE_USD.toFixed(2)}) — you only pay the standard network fee (~0.02 SOL).</> : <>A ${BASE_LAUNCH_FEE_USD.toFixed(2)} platform launch fee (paid in SOL) applies — the same flat fee as the custom lane — plus the standard network fee (~0.02 SOL).</>}<br />OrbitX trade fee on launchpad tokens: {(CREATOR_FEE_BPS / 100).toFixed(2)}% on every buy/sell. Of every $1 in fees: ${tradeFeeSharePerDollar(TRADE_FEE_CREATOR_SHARE_PCT)} to you (claim in-app) · ${tradeFeeSharePerDollar(TRADE_FEE_PLATFORM_SHARE_PCT)} to OrbitX (Admin Desk).
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
    reader.onerror = () => reject(new Error(`Could not read the image file (${file.name || "unnamed"}, ${(file.size / 1024).toFixed(0)}KB) — try a different photo or a smaller file size.`));
    reader.readAsDataURL(file);
  });
}
