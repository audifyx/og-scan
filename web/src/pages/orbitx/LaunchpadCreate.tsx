/**
 * OrbitxLaunch — the Orbitx Launch Console (mounted at /orbitxlaunch).
 *
 * Premium space-themed CUSTOM Solana launchpad — REAL on-chain launch on
 * mainnet: own Token-2022 SPL mint + on-chain metadata + 0.30% creator fee
 * on every buy/sell (pump.fun's creator-fee rate, claimable in-app at
 * /orbitxlaunch/claim) + optional Raydium CPMM pool. NOT pump.fun.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Rocket, Wallet, Globe, Twitter, Send, MessagesSquare, Upload, Image as ImageIcon,
  Coins, ShieldCheck, Droplets, Sparkles, Lock, Flame, Gauge, Timer, AlertCircle,
  CheckCircle2, AlertTriangle, Info, Wand2, ChevronRight, Loader2, Copy, Check,
} from "lucide-react";
import { computeFee, getSolUsd, ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, BASE_LAUNCH_FEE_USD, type FeeBreakdown } from "@/lib/orbitx/fee";
import { checkAntiVamp, registerToken, recordReferralEarning } from "@/lib/orbitx/registry";
import { buildCustomLaunchTransaction, launchFeeLamports } from "@/lib/orbitx/token22";
import { createCpmmPool, buildBurnLpTransaction } from "@/lib/orbitx/pool";
import { supabase } from "@/lib/supabase";
import { Confetti } from "./lpx";

const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMG = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const LAUNCH_TYPES = [
  { value: "fair", label: "Fair Launch", hint: "No presale · everyone buys at open" },
  { value: "bonding", label: "Bonding Curve", hint: "On-curve price discovery" },
  { value: "presale", label: "Presale + LP", hint: "Raise, then seed liquidity" },
] as const;

// Custom launchpad — no pump.fun / PumpSwap. Own SPL mint, then seed
// liquidity into an independent DEX pool we create directly via their SDK.
const DEXES = [
  { value: "raydium", label: "Raydium (CPMM)" },
  { value: "meteora", label: "Meteora (DLMM)" },
  { value: "orca", label: "Orca (Whirlpools)" },
] as const;

const SECTIONS = [
  { id: "identity", label: "Identity", icon: Sparkles },
  { id: "socials", label: "Socials", icon: Globe },
  { id: "supply", label: "Supply", icon: Coins },
  { id: "authorities", label: "Authorities", icon: ShieldCheck },
  { id: "tokenomics", label: "Tokenomics", icon: Gauge },
  { id: "liquidity", label: "Liquidity", icon: Droplets },
  { id: "protections", label: "Protections", icon: ShieldCheck },
  { id: "vanity", label: "Vanity (OBX)", icon: Wand2 },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const ALLOC_COLORS: Record<string, string> = {
  dev: "hsl(var(--og-blood))",
  community: "hsl(var(--og-lime))",
  marketing: "hsl(var(--og-cyan))",
  treasury: "hsl(var(--og-gold))",
};

interface Alloc { dev: number; community: number; marketing: number; treasury: number; }

interface LaunchConfig {
  name: string; ticker: string; description: string; logoDataUrl: string | null;
  website: string; twitter: string; telegram: string; discord: string;
  decimals: number; supply: string; initialPriceUsd: string; launchType: string; launchDelayMin: number;
  revokeMint: boolean; revokeFreeze: boolean; immutableMetadata: boolean;
  alloc: Alloc; burnPct: number;
  addLiquidity: boolean; liquiditySol: string; dex: string; lpLockDays: number; burnLp: boolean;
  maxWalletPct: number; maxTxPct: number; cooldownSec: number;
  antiBot: boolean; antiSandwich: boolean; sniperProtection: boolean;
  vanityPrefix: string;
}

const DEFAULT_CONFIG: LaunchConfig = {
  name: "", ticker: "", description: "", logoDataUrl: null,
  website: "", twitter: "", telegram: "", discord: "",
  decimals: 9, supply: "1000000000", initialPriceUsd: "0.0001", launchType: "bonding", launchDelayMin: 0,
  revokeMint: true, revokeFreeze: true, immutableMetadata: false,
  alloc: { dev: 5, community: 80, marketing: 10, treasury: 5 }, burnPct: 0,
  addLiquidity: false, liquiditySol: "0", dex: "raydium", lpLockDays: 30, burnLp: false,
  maxWalletPct: 2, maxTxPct: 1, cooldownSec: 0,
  antiBot: true, antiSandwich: true, sniperProtection: true,
  vanityPrefix: "OBX",
};

type LaunchPhase = "idle" | "checking" | "uploading" | "signing" | "confirming" | "pool" | "registering" | "done";

interface LaunchedInfo {
  mint: string; sig: string; poolId?: string; poolTx?: string; lpBurned: boolean; flagged: boolean;
}

/** Upload logo + metadata JSON to storage; returns public logo URL + metadata URI. */
async function uploadLaunchAssets(mintAddr: string, cfg: LaunchConfig, creator: string): Promise<{ logoUrl: string; uri: string }> {
  const dataUrl = cfg.logoDataUrl as string;
  const mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/png";
  const ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg");
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const logoPath = `orbitxlaunch/${mintAddr}/logo.${ext}`;
  const { error: logoErr } = await supabase.storage.from("profile-media")
    .upload(logoPath, new Blob([bytes], { type: mime }), { contentType: mime, upsert: true });
  if (logoErr) throw new Error(`Logo upload failed: ${logoErr.message}`);
  const logoUrl = supabase.storage.from("profile-media").getPublicUrl(logoPath).data.publicUrl;
  const metaJson = {
    name: cfg.name.trim(),
    symbol: cfg.ticker.trim().toUpperCase(),
    description: cfg.description.trim(),
    image: logoUrl,
    showName: true,
    createdOn: "https://orbitx.world",
    external_url: cfg.website || "https://orbitx.world",
    extensions: {
      website: cfg.website || undefined, twitter: cfg.twitter || undefined,
      telegram: cfg.telegram || undefined, discord: cfg.discord || undefined,
    },
    creator, tags: ["orbitx-launch"],
  };
  const jsonPath = `orbitxlaunch/${mintAddr}/metadata.json`;
  const { error: jsonErr } = await supabase.storage.from("profile-media")
    .upload(jsonPath, new Blob([JSON.stringify(metaJson, null, 2)], { type: "application/json" }), { contentType: "application/json", upsert: true });
  if (jsonErr) throw new Error(`Metadata upload failed: ${jsonErr.message}`);
  const uri = supabase.storage.from("profile-media").getPublicUrl(jsonPath).data.publicUrl;
  return { logoUrl, uri };
}

const fieldClass =
  "bg-black/40 border-white/10 focus-visible:ring-[hsl(var(--og-lime))] focus-visible:border-[hsl(var(--og-lime))]/60";

function StatChip({ label, value, tone = "gold" }: { label: string; value: string; tone?: "gold" | "cyan" | "lime" | "blood" }) {
  const toneMap: Record<string, string> = {
    gold: "text-[hsl(var(--og-gold))]", cyan: "text-[hsl(var(--og-cyan))]",
    lime: "text-[hsl(var(--og-lime))]", blood: "text-[hsl(var(--og-blood))]",
  };
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-semibold ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--og-lime))]/35 bg-[hsl(var(--og-lime))]/10 shadow-[0_0_16px_-6px_hsl(var(--og-lime)/0.6)]">
        <Icon className="h-[18px] w-[18px] text-[hsl(var(--og-lime))]" />
      </div>
      <div>
        <h3 className="font-display text-lg font-black uppercase tracking-wide">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function AllocationBar({ alloc, height = 10 }: { alloc: Alloc; height?: number }) {
  const total = Math.max(1, alloc.dev + alloc.community + alloc.marketing + alloc.treasury);
  return (
    <div className="flex w-full overflow-hidden rounded-full border border-white/10" style={{ height }}>
      {(["dev", "community", "marketing", "treasury"] as (keyof Alloc)[]).map((k) => (
        <div key={k} style={{ width: `${(alloc[k] / total) * 100}%`, background: ALLOC_COLORS[k] }} title={`${k}: ${alloc[k]}%`} />
      ))}
    </div>
  );
}

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

export default function LaunchpadCreate() {
  const { connected, publicKey, connect, wallets, select, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [cfg, setCfg] = useState<LaunchConfig>(DEFAULT_CONFIG);
  const [active, setActive] = useState<SectionId>("identity");
  const [launching, setLaunching] = useState(false);
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [phaseMsg, setPhaseMsg] = useState("");
  const [launched, setLaunched] = useState<LaunchedInfo | null>(null);
  const [nameTaken, setNameTaken] = useState(false);
  const [checkingName, setCheckingName] = useState(false);
  const [blockedMatch, setBlockedMatch] = useState<{ name: string; ticker: string } | null>(null);
  const [checkError, setCheckError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameCheckTimer = useRef<NodeJS.Timeout>();

  // Debounced OrbitX Anti-Vamp check on BOTH name and ticker
  // similarity on both fields in one RPC call, so a duplicate ticker with a
  // different name blocks live here too, not just at final submit.
  useEffect(() => {
    if (!cfg.name.trim() && !cfg.ticker.trim()) {
      setNameTaken(false);
      setBlockedMatch(null);
      setCheckError(false);
      return;
    }
    clearTimeout(nameCheckTimer.current);
    setCheckingName(true);
    nameCheckTimer.current = setTimeout(async () => {
      try {
        // Unified check: OrbitX registry + pump.fun + DexScreener, live as you type.
        const result = await checkAntiVamp(cfg.name, cfg.ticker);
        setNameTaken(result.blocked);
        setCheckError(!!result.error);
        setBlockedMatch(result.hardMatch ? { name: result.hardMatch.name, ticker: result.hardMatch.ticker } : null);
      } catch (err) {
        console.error("Anti-vamp check failed:", err);
        setNameTaken(true);
        setCheckError(true);
        setBlockedMatch(null);
      } finally {
        setCheckingName(false);
      }
    }, 500);
    return () => clearTimeout(nameCheckTimer.current);
  }, [cfg.name, cfg.ticker]);

  const set = useCallback(<K extends keyof LaunchConfig>(key: K, value: LaunchConfig[K]) => {
    setCfg((c) => ({ ...c, [key]: value }));
  }, []);
  const setAlloc = useCallback((key: keyof Alloc, value: number) => {
    setCfg((c) => ({ ...c, alloc: { ...c.alloc, [key]: value } }));
  }, []);

  const allocTotal = cfg.alloc.dev + cfg.alloc.community + cfg.alloc.marketing + cfg.alloc.treasury;
  const allocValid = allocTotal === 100;

  const sectionDone = useMemo<Record<SectionId, boolean>>(() => ({
    identity: !!cfg.name.trim() && !!cfg.ticker.trim() && !!cfg.description.trim() && !!cfg.logoDataUrl && !nameTaken && !checkingName && !checkError,
    socials: !!(cfg.website || cfg.twitter || cfg.telegram || cfg.discord),
    supply: /^\d+$/.test(cfg.supply) && Number(cfg.supply) > 0 && Number(cfg.initialPriceUsd) > 0,
    authorities: cfg.revokeMint && cfg.revokeFreeze,
    tokenomics: allocValid,
    liquidity: !cfg.addLiquidity || cfg.burnLp || cfg.lpLockDays > 0,
    protections: cfg.antiBot || cfg.antiSandwich || cfg.sniperProtection,
    vanity: true,
  }), [cfg, allocValid]);
  const readiness = useMemo(() => {
    const keys = Object.keys(sectionDone) as SectionId[];
    return Math.round((keys.filter((k) => sectionDone[k]).length / keys.length) * 100);
  }, [sectionDone]);
  const trust = useMemo(() => {
    let s = 0;
    if (cfg.revokeMint) s += 30;
    if (cfg.revokeFreeze) s += 25;
    if (cfg.burnLp) s += 25; else if (cfg.lpLockDays >= 30) s += 15;
    if (cfg.immutableMetadata) s += 10;
    if (allocValid && cfg.alloc.dev <= 10) s += 10;
    return Math.min(100, s);
  }, [cfg, allocValid]);
  const trustTone = trust >= 80 ? "lime" : trust >= 50 ? "gold" : "blood";
  const toneHsl: Record<string, string> = {
    lime: "hsl(var(--og-lime))", gold: "hsl(var(--og-gold))", blood: "hsl(var(--og-blood))", cyan: "hsl(var(--og-cyan))",
  };

  const [grinding, setGrinding] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [foundKey, setFoundKey] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
  const grindStop = useRef(false);
  const foundKpRef = useRef<Keypair | null>(null);
  const vanityEst = useMemo(() => estimateVanity(cfg.vanityPrefix, rate || 8000), [cfg.vanityPrefix, rate]);

  const runGrind = useCallback(() => {
    const target = cfg.vanityPrefix.trim();
    if (!target) return;
    setGrinding(true); setFoundKey(null); setAttempts(0);
    grindStop.current = false;
    const started = performance.now();
    let count = 0;
    const CHUNK = 1200;
    const targetLower = target.toLowerCase();
    const step = () => {
      if (grindStop.current) { setGrinding(false); return; }
      for (let i = 0; i < CHUNK; i++) {
        const kp = Keypair.generate();
        count++;
        const addr = kp.publicKey.toBase58();
        if (addr.toLowerCase().startsWith(targetLower)) {
          foundKpRef.current = kp;
          setFoundKey(addr); setAttempts(count);
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
  }, [cfg.vanityPrefix]);
  useEffect(() => () => { grindStop.current = true; }, []);

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_IMG.includes(file.type)) return toast.error("Use PNG, JPG, GIF or WebP");
    if (file.size > MAX_LOGO_SIZE) return toast.error("Logo must be under 5MB");
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!cfg.name.trim()) e.push("Token name is required");
    if (!cfg.ticker.trim()) e.push("Ticker is required");
    if (!/^\d+$/.test(cfg.supply) || Number(cfg.supply) <= 0) e.push("Supply must be a positive number");
    if (!allocValid) e.push(`Allocations must total 100% (currently ${allocTotal}%)`);
    return e;
  }, [cfg, allocValid, allocTotal]);

  const handleConnect = async () => {
    try {
      if (!wallets?.length) return toast.error("No wallet detected — install Phantom, Solflare, Backpack or Glow");
      const ready = wallets.find((w) => w.readyState === "Installed") || wallets[0];
      select(ready.adapter.name);
      await connect();
    } catch { toast.error("Wallet connection cancelled"); }
  };

  const [fee, setFee] = useState<FeeBreakdown | null>(null);
  useEffect(() => {
    let alive = true;
    const seed = cfg.addLiquidity ? (Number(cfg.liquiditySol) || 0) : 0;
    computeFee(cfg.addLiquidity, seed).then((f) => { if (alive) setFee(f); }).catch(() => {});
    return () => { alive = false; };
  }, [cfg.addLiquidity, cfg.liquiditySol]);

  const handleLaunch = async () => {
    if (errors.length) { toast.error(errors[0]); return; }
    if (!connected || !publicKey || !signTransaction) { toast.error("Connect a wallet first"); return; }
    if (!cfg.logoDataUrl) { toast.error("Upload a logo — it becomes your token image"); return; }
    setLaunching(true);
    try {
      /* 1 — OrbitX Anti-Vamp identity check (unified: OrbitX registry +
         pump.fun + DexScreener), same protection as the pump.fun lane.
         Re-run fresh right before any fee/on-chain action. Fails CLOSED on
         a check error, so a broken check can never let a duplicate slip
         through. */
      setPhase("checking"); setPhaseMsg("OrbitX Anti-Vamp check…");
      let flagged = false;
      const preLaunchCheck = await checkAntiVamp(cfg.name, cfg.ticker).catch((err) => {
        console.error("[orbitx] custom anti-vamp check failed", err);
        return { blocked: true, flagged: true, hardMatch: null, matches: [], message: "Originality verification failed — please try again." } as const;
      });
      if (preLaunchCheck.blocked) {
        setNameTaken(true);
        setBlockedMatch(preLaunchCheck.hardMatch ? { name: preLaunchCheck.hardMatch.name, ticker: preLaunchCheck.hardMatch.ticker } : null);
        toast.error(
          preLaunchCheck.hardMatch
            ? `Blocked — "${cfg.name}" / ${cfg.ticker} is too close to ${preLaunchCheck.hardMatch.name} ($${preLaunchCheck.hardMatch.ticker}). Anti-vamp requires a unique identity.`
            : preLaunchCheck.message || "Originality verification failed — please try again."
        );
        setPhase("idle");
        setLaunching(false);
        return;
      }
      if (preLaunchCheck.flagged) {
        flagged = true;
        toast.warning(`${preLaunchCheck.matches.length} similar token(s) exist — launching FLAGGED: creator fees route to OBX buybacks.`);
      }

      /* 2 — mint keypair (vanity-ground if available) */
      const mintKeypair = foundKpRef.current ?? Keypair.generate();
      const mintAddr = mintKeypair.publicKey.toBase58();

      /* 3 — upload logo + metadata */
      setPhase("uploading"); setPhaseMsg("Uploading logo + metadata…");
      const { logoUrl, uri } = await uploadLaunchAssets(mintAddr, cfg, publicKey.toBase58());

      /* 4 — build, sign, send the on-chain mint transaction (mainnet) */
      setPhase("signing"); setPhaseMsg("Approve the launch transaction in your wallet…");
      const { price } = await getSolUsd();
      const feeLamports = launchFeeLamports(ORBITX_FEE_USD, price);
      const { tx } = await buildCustomLaunchTransaction({
        connection,
        creator: publicKey,
        mintKeypair,
        name: cfg.name.trim(),
        symbol: cfg.ticker.trim().toUpperCase(),
        metadataUri: uri,
        decimals: cfg.decimals,
        supply: BigInt(cfg.supply),
        burnPct: cfg.burnPct,
        revokeMint: cfg.revokeMint,
        revokeFreeze: cfg.revokeFreeze,
        immutableMetadata: cfg.immutableMetadata,
        launchFeeLamports: feeLamports,
        vampFlagged: flagged,
      });
      tx.feePayer = publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.partialSign(mintKeypair);
      const signed = await signTransaction(tx);
      setPhase("confirming"); setPhaseMsg("Broadcasting to Solana mainnet…");
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      if (conf.value.err) throw new Error("Mint transaction failed on-chain: " + JSON.stringify(conf.value.err));

      /* 5 — optional Raydium CPMM pool */
      let poolId: string | undefined; let poolTx: string | undefined; let lpBurned = false;
      const seedSol = Number(cfg.liquiditySol) || 0;
      if (cfg.addLiquidity && seedSol > 0 && signAllTransactions) {
        setPhase("pool"); setPhaseMsg("Creating the Raydium CPMM pool…");
        try {
          const supplyNum = Number(cfg.supply);
          const priceUsd = Number(cfg.initialPriceUsd) || 0;
          const maxPoolTokens = supplyNum * ((100 - cfg.burnPct) / 100) * 0.95;
          const tokensForPool = priceUsd > 0 ? Math.min((seedSol * price) / priceUsd, maxPoolTokens) : supplyNum * 0.5;
          const tokenAmountRaw = BigInt(Math.max(1, Math.floor(tokensForPool))) * BigInt(10) ** BigInt(cfg.decimals);
          const pool = await createCpmmPool({
            connection, owner: publicKey, signAllTransactions,
            mint: mintAddr, decimals: cfg.decimals,
            tokenAmountRaw, solLamports: BigInt(Math.floor(seedSol * LAMPORTS_PER_SOL)),
          });
          poolId = pool.poolId; poolTx = pool.txId;
          if (cfg.burnLp && pool.lpMint) {
            setPhaseMsg("Burning LP forever…");
            const burn = await buildBurnLpTransaction(connection, publicKey, pool.lpMint);
            if (burn) {
              burn.tx.feePayer = publicKey;
              burn.tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
              const signedBurn = await signTransaction(burn.tx);
              const burnSig = await connection.sendRawTransaction(signedBurn.serialize(), { maxRetries: 3 });
              await connection.confirmTransaction(burnSig, "confirmed");
              lpBurned = true;
            }
          }
        } catch (poolErr) {
          console.error("[orbitx] pool creation failed", poolErr);
          const msg = poolErr instanceof Error ? poolErr.message : String(poolErr);
          toast.error(`Token is LIVE, but pool creation failed: ${msg}. You can create the pool on Raydium any time.`);
        }
      }

      /* 6 — register in the OrbitX index. The Anti-Vamp verdict was already
         established (and enforced) in Step 1, before any fee/on-chain
         action — the mint has already landed on Solana by this point. */
      setPhase("registering"); setPhaseMsg("Registering in the OrbitX index…");
      try {
        await registerToken({
          mint_address: mintAddr,
          name: cfg.name.trim(),
          ticker: cfg.ticker.trim().toUpperCase(),
          creator_wallet: publicKey.toBase58(),
          decimals: cfg.decimals,
          supply: Number(cfg.supply),
          dex: poolId ? "raydium-cpmm" : null,
          lp_pool_address: poolId ?? null,
          lp_signature: poolTx ?? null,
          mint_signature: sig,
          metadata_uri: uri,
          logo_url: logoUrl,
          is_vamp: flagged,
          fee_route: flagged ? "orbitx_buyback" : "creator",
          cluster: "mainnet-beta",
          launch_type: "custom",
        });
        // Credit this launcher's referrer (if any) a share of the real launch fee paid.
        await recordReferralEarning(publicKey.toBase58(), mintAddr, ORBITX_FEE_USD);
      } catch (regErr) {
        // token is live on-chain regardless — registry failure must not eat the launch
        console.warn("[orbitx] registry insert failed", regErr);
      }

      setLaunched({ mint: mintAddr, sig, poolId, poolTx, lpBurned, flagged });
      setPhase("done");
      toast.success(`${cfg.ticker.toUpperCase()} is LIVE on Solana mainnet`);
    } catch (err) {
      console.error("[orbitx] launch error", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) toast.error("Transaction cancelled");
      else toast.error(msg || "Launch failed");
      setPhase("idle");
    } finally {
      setLaunching(false);
    }
  };

  const renderSection = () => {
    const nameInvalid = nameTaken || checkingName;
    
    // Lock entire form if name is not valid
    if (nameInvalid && active !== "identity") {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <AlertCircle className="h-12 w-12 text-[hsl(var(--og-blood))]" />
          <div>
            <div className="text-xl font-bold text-[hsl(var(--og-blood))]">🚫 Complete Token Identity First</div>
            <div className="text-sm text-muted-foreground mt-2">All fields are locked. Go back to the Identity section and choose an original name.</div>
          </div>
        </div>
      );
    }
    
    switch (active) {
      case "identity":
        const nameInvalid = nameTaken || checkingName;
        return (
          <div className="space-y-5">
            {nameTaken && (
              <div className="rounded-lg border-2 border-[hsl(var(--og-blood))]/60 bg-[hsl(var(--og-blood))]/15 p-4 flex items-start gap-3 shadow-[0_0_30px_-8px_hsl(var(--og-blood)/0.6)]">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--og-blood))] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-black uppercase tracking-wide text-[hsl(var(--og-blood))]">🚫 OrbitX Anti-Vamp Protection — Launch Blocked</div>
                  <div className="text-sm text-white/90 mt-1">
                    {checkError
                      ? "Couldn't verify this name/ticker is original right now — retrying automatically. Launch stays locked until verification succeeds."
                      : <>This name or ticker is already in use{blockedMatch ? <> — too close to <strong>{blockedMatch.name}</strong> (${blockedMatch.ticker})</> : null}. Change the name or ticker to continue. All other fields are locked until this is resolved.</>}
                  </div>
                </div>
              </div>
            )}
            <SectionHeading icon={Sparkles} title="Token Identity" desc="Name, ticker, story and logo — the face of your launch." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Token Name {checkingName && <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--og-gold))]" />}</Label>
                </div>
                <Input 
                  className={`${fieldClass} ${nameTaken ? 'border-[hsl(var(--og-blood))]' : ''}`} 
                  placeholder="Orbit Protocol" 
                  value={cfg.name} 
                  onChange={(e) => set("name", e.target.value)} 
                />
              </div>
              <div className="space-y-2"><Label>Ticker</Label>
                <Input className={`${fieldClass} ${nameTaken ? 'border-[hsl(var(--og-blood))]' : ''}`} placeholder="ORBIT" maxLength={10} value={cfg.ticker} onChange={(e) => set("ticker", e.target.value.toUpperCase())} /></div>
            </div>
            {nameTaken && (
              <div className="flex items-start gap-2 text-sm text-[hsl(var(--og-blood))]">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>OrbitX Anti-Vamp: too close to {blockedMatch?.name} (${blockedMatch?.ticker}). Change the name or ticker to launch.</span>
              </div>
            )}
            <div className="space-y-2"><Label>Description</Label>
              <Textarea disabled={nameInvalid} className={fieldClass} rows={4} placeholder="What is this token? Why does it exist?" value={cfg.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="space-y-2"><Label>Logo</Label>
              <div className={`flex items-center gap-4 ${nameInvalid ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  {cfg.logoDataUrl ? <img src={cfg.logoDataUrl} alt="logo" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                </div>
                <input ref={fileRef} type="file" accept={ACCEPTED_IMG.join(",")} className="hidden" onChange={onLogo} disabled={nameInvalid} />
                <Button disabled={nameInvalid} variant="outline" onClick={() => fileRef.current?.click()} className="border-white/15"><Upload className="mr-2 h-4 w-4" /> Upload logo</Button>
              </div></div>
          </div>
        );
      case "socials":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Globe} title="Socials & Links" desc="Where your community lives. All optional, all shown on the token page." />
            {[
              { key: "website", label: "Website", icon: Globe, ph: "https://…" },
              { key: "twitter", label: "Twitter / X", icon: Twitter, ph: "https://x.com/…" },
              { key: "telegram", label: "Telegram", icon: Send, ph: "https://t.me/…" },
              { key: "discord", label: "Discord", icon: MessagesSquare, ph: "https://discord.gg/…" },
            ].map((f) => (
              <div key={f.key} className="space-y-2">
                <Label className="flex items-center gap-2"><f.icon className="h-3.5 w-3.5 text-[hsl(var(--og-cyan))]" /> {f.label}</Label>
                <Input className={fieldClass} placeholder={f.ph} value={(cfg as any)[f.key]} onChange={(e) => set(f.key as keyof LaunchConfig, e.target.value as any)} />
              </div>
            ))}
          </div>
        );
      case "supply":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Coins} title="Supply & Launch" desc="Mint economics and how trading opens." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Total Supply</Label>
                <Input className={fieldClass} inputMode="numeric" value={cfg.supply} onChange={(e) => set("supply", e.target.value.replace(/[^\d]/g, ""))} /></div>
              <div className="space-y-2"><Label>Decimals</Label>
                <Select value={String(cfg.decimals)} onValueChange={(v) => set("decimals", Number(v))}>
                  <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 2, 4, 6, 9].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Initial Price (USD)</Label>
                <Input className={fieldClass} value={cfg.initialPriceUsd} onChange={(e) => set("initialPriceUsd", e.target.value)} /></div>
              <div className="space-y-2"><Label>Launch Delay (minutes)</Label>
                <Input className={fieldClass} inputMode="numeric" value={String(cfg.launchDelayMin)} onChange={(e) => set("launchDelayMin", Number(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div>
            </div>
            <div className="space-y-2"><Label>Launch Type</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {LAUNCH_TYPES.map((t) => (
                  <button key={t.value} onClick={() => set("launchType", t.value)}
                    className={`rounded-xl border p-3 text-left transition-all ${cfg.launchType === t.value ? "border-[hsl(var(--og-gold))]/60 bg-[hsl(var(--og-gold))]/10 shadow-og-gold" : "border-white/10 bg-black/30 hover:border-white/25"}`}>
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.hint}</div>
                  </button>
                ))}
              </div></div>
          </div>
        );
      case "authorities":
        return (
          <div className="space-y-5">
            <SectionHeading icon={ShieldCheck} title="Mint Authorities" desc="Revoking authorities is the strongest trust signal you can give holders." />
            {[
              { key: "revokeMint", label: "Revoke Mint Authority", desc: "No one can ever mint more supply. Recommended." },
              { key: "revokeFreeze", label: "Revoke Freeze Authority", desc: "Wallets can never be frozen. Recommended." },
              { key: "immutableMetadata", label: "Immutable Metadata", desc: "Name, ticker and image can never be changed." },
            ].map((a) => (
              <div key={a.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="pr-4"><div className="text-sm font-semibold">{a.label}</div><div className="text-xs text-muted-foreground">{a.desc}</div></div>
                <Switch checked={(cfg as any)[a.key]} onCheckedChange={(v) => set(a.key as keyof LaunchConfig, v as any)} />
              </div>
            ))}
          </div>
        );
      case "tokenomics":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Gauge} title="Tokenomics" desc="Allocate supply across buckets. Must total 100%." />
            <AllocationBar alloc={cfg.alloc} height={14} />
            <div className="flex flex-wrap gap-3 text-xs">
              {(["dev", "community", "marketing", "treasury"] as (keyof Alloc)[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5 capitalize text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: ALLOC_COLORS[k] }} /> {k} {cfg.alloc[k]}%
                </span>
              ))}
            </div>
            {(["dev", "community", "marketing", "treasury"] as (keyof Alloc)[]).map((k) => (
              <div key={k} className="space-y-2">
                <div className="flex items-center justify-between"><Label className="capitalize">{k} allocation</Label>
                  <span className="font-mono text-sm text-[hsl(var(--og-gold))]">{cfg.alloc[k]}%</span></div>
                <Slider value={[cfg.alloc[k]]} min={0} max={100} step={1} onValueChange={([v]) => setAlloc(k, v)} />
              </div>
            ))}
            <div className={`flex items-center justify-between rounded-xl border p-3 text-sm ${allocValid ? "border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10" : "border-[hsl(var(--og-blood))]/40 bg-[hsl(var(--og-blood))]/10"}`}>
              <span className="flex items-center gap-2">{allocValid ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--og-lime))]" /> : <AlertTriangle className="h-4 w-4 text-[hsl(var(--og-blood))]" />} Total allocation</span>
              <span className="font-mono font-semibold">{allocTotal}%</span>
            </div>
            <Separator className="bg-white/10" />
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Flame className="h-3.5 w-3.5 text-[hsl(var(--og-blood))]" /> Burn at launch</Label>
                <span className="font-mono text-sm text-[hsl(var(--og-blood))]">{cfg.burnPct}%</span></div>
              <Slider value={[cfg.burnPct]} min={0} max={50} step={1} onValueChange={([v]) => set("burnPct", v)} />
            </div>
          </div>
        );
      case "liquidity":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Droplets} title="Liquidity" desc="Optional. Launch the token on its own, or auto-create a pool so it's instantly tradable." />
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="pr-4"><div className="text-sm font-semibold">Add liquidity at launch</div><div className="text-xs text-muted-foreground">Off = just launch the token (mint only). On = auto-create a DEX pool with the SOL you seed. You can add liquidity later either way.</div></div>
              <Switch checked={cfg.addLiquidity} onCheckedChange={(v) => set("addLiquidity", v)} />
            </div>
            {!cfg.addLiquidity && (
              <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--og-lime))]/25 bg-[hsl(var(--og-lime))]/5 p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--og-lime))]" />
                No liquidity required — your token launches for just the ~0.01 SOL network cost{isLaunchFeePromoActive() ? " — the Orbitx launch fee is FREE right now" : ` + the ${fmtUsd(ORBITX_FEE_USD)} Orbitx fee`}. Add a pool whenever you're ready.
              </div>
            )}
            {cfg.addLiquidity && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Initial Liquidity (SOL)</Label>
                    <Input className={fieldClass} value={cfg.liquiditySol} onChange={(e) => set("liquiditySol", e.target.value)} /></div>
                  <div className="space-y-2"><Label>DEX</Label>
                    <Select value={cfg.dex} onValueChange={(v) => set("dex", v)}>
                      <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                      <SelectContent>{DEXES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-[hsl(var(--og-cyan))]" /> LP Lock Duration</Label>
                    <span className="font-mono text-sm text-[hsl(var(--og-cyan))]">{cfg.lpLockDays} days</span></div>
                  <Slider value={[cfg.lpLockDays]} min={0} max={365} step={1} onValueChange={([v]) => set("lpLockDays", v)} disabled={cfg.burnLp} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="pr-4"><div className="text-sm font-semibold">Burn LP tokens</div><div className="text-xs text-muted-foreground">Permanently burns liquidity — the strongest lock, but irreversible.</div></div>
                  <Switch checked={cfg.burnLp} onCheckedChange={(v) => set("burnLp", v)} />
                </div>
              </>
            )}
          </div>
        );
      case "protections":
        return (
          <div className="space-y-5">
            <SectionHeading icon={ShieldCheck} title="Trading Protections" desc="Anti-bot and limit controls." />
            <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--og-gold))]/30 bg-[hsl(var(--og-gold))]/10 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--og-gold))]" />
              <span>On-chain enforcement of limits, cooldowns and anti-sandwich needs a custom Anchor program (audited before mainnet). These configure that program; standard SPL tokens can't enforce them alone.</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><div className="flex items-center justify-between"><Label>Max Wallet</Label><span className="font-mono text-sm text-[hsl(var(--og-gold))]">{cfg.maxWalletPct}%</span></div>
                <Slider value={[cfg.maxWalletPct]} min={0} max={10} step={0.5} onValueChange={([v]) => set("maxWalletPct", v)} /></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><Label>Max Transaction</Label><span className="font-mono text-sm text-[hsl(var(--og-gold))]">{cfg.maxTxPct}%</span></div>
                <Slider value={[cfg.maxTxPct]} min={0} max={10} step={0.5} onValueChange={([v]) => set("maxTxPct", v)} /></div>
            </div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> Trading cooldown</Label><span className="font-mono text-sm text-[hsl(var(--og-gold))]">{cfg.cooldownSec}s</span></div>
              <Slider value={[cfg.cooldownSec]} min={0} max={60} step={1} onValueChange={([v]) => set("cooldownSec", v)} /></div>
            {[
              { key: "antiBot", label: "Anti-bot", desc: "Block known bot signatures at open." },
              { key: "antiSandwich", label: "Anti-sandwich", desc: "Mitigate MEV sandwich attacks." },
              { key: "sniperProtection", label: "Sniper protection", desc: "Throttle block-0 snipers." },
            ].map((p) => (
              <div key={p.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="pr-4"><div className="text-sm font-semibold">{p.label}</div><div className="text-xs text-muted-foreground">{p.desc}</div></div>
                <Switch checked={(cfg as any)[p.key]} onCheckedChange={(v) => set(p.key as keyof LaunchConfig, v as any)} />
              </div>
            ))}
          </div>
        );
      case "vanity":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Wand2} title="Vanity Mint Address" desc="Grind a mint address that starts with your prefix — right here in your browser." />
            <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--og-cyan))]/30 bg-[hsl(var(--og-cyan))]/10 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--og-cyan))]" />
              <span><b className="text-foreground">Honest math:</b> a 3-char prefix like <span className="font-mono">OBX</span> is realistic (seconds–minutes). Each extra character is ~29× harder, so <span className="font-mono">ORBITX</span> can take hours–days and isn't guaranteed. Grinding runs locally; the mint keypair never leaves your device.</span>
            </div>
            <div className="space-y-2"><Label>Desired prefix</Label>
              <Input className={`${fieldClass} font-mono`} value={cfg.vanityPrefix} maxLength={8} onChange={(e) => set("vanityPrefix", e.target.value.replace(/[^1-9A-HJ-NP-Za-km-z]/g, ""))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <StatChip label="Length" value={String(vanityEst.n)} tone="cyan" />
              <StatChip label="Est. tries" value={vanityEst.expected >= 1e6 ? vanityEst.expected.toExponential(1) : Math.round(vanityEst.expected).toLocaleString()} tone="gold" />
              <StatChip label="Est. time" value={humanTime(vanityEst.seconds)} tone={vanityEst.n > 4 ? "blood" : "lime"} />
            </div>
            <div className="flex items-center gap-3">
              {!grinding
                ? <Button onClick={runGrind} className="bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90"><Wand2 className="mr-2 h-4 w-4" /> Start grinding</Button>
                : <Button onClick={() => { grindStop.current = true; }} variant="outline" className="border-[hsl(var(--og-blood))]/50 text-[hsl(var(--og-blood))]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Stop</Button>}
              {attempts > 0 && <span className="font-mono text-xs text-muted-foreground">{attempts.toLocaleString()} tries{rate ? ` · ${rate.toLocaleString()}/s` : ""}</span>}
            </div>
            {foundKey && (
              <div className="rounded-xl border border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10 p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--og-lime))]"><CheckCircle2 className="h-4 w-4" /> Match found</div>
                <div className="flex items-center gap-2">
                  <code className="truncate font-mono text-xs">{foundKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(foundKey); toast.success("Copied"); }} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        );
    }
  };


  if (launched) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Card className="lpx-panel lpx-panel--hot relative overflow-hidden border-0 bg-transparent">
          <Confetti />
          <CardContent className="relative space-y-5 p-8 text-center">
            <div className="lpx-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[hsl(var(--og-lime))]/45 bg-[hsl(var(--og-lime))]/10">
              <CheckCircle2 className="h-9 w-9 text-[hsl(var(--og-lime))]" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Deployment complete</div>
              <h2 className="lpx-glow font-display text-2xl font-black text-[hsl(var(--og-lime))]">TOKEN LIVE ON MAINNET</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {cfg.name.trim()} (${cfg.ticker.trim().toUpperCase()}) is live{launched.poolId ? " and instantly tradable on Raydium" : ""}.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-left">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Contract address</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="break-all font-mono text-sm text-[hsl(var(--og-cyan))]">{launched.mint}</code>
                <button onClick={() => { navigator.clipboard.writeText(launched.mint); toast.success("Copied"); }} className="text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Badge className={launched.flagged ? "border-[hsl(var(--og-blood))]/40 bg-[hsl(var(--og-blood))]/10 text-[hsl(var(--og-blood))]" : "border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10 text-[hsl(var(--og-lime))]"}>
                0.30% creator fee → {launched.flagged ? "OBX buybacks (flagged)" : "your wallet"}
              </Badge>
              {launched.poolId && <Badge className="border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10 text-[hsl(var(--og-cyan))]">Raydium pool live</Badge>}
              {launched.lpBurned && <Badge className="border-[hsl(var(--og-blood))]/40 bg-[hsl(var(--og-blood))]/10 text-[hsl(var(--og-blood))]">LP burned</Badge>}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <a href={`https://solscan.io/tx/${launched.sig}`} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--og-cyan))] underline-offset-4 hover:underline">Mint tx</a>
              <a href={`https://solscan.io/token/${launched.mint}`} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--og-cyan))] underline-offset-4 hover:underline">Solscan</a>
              {launched.poolId && (
                <a href={`https://raydium.io/swap/?inputMint=sol&outputMint=${launched.mint}`} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--og-cyan))] underline-offset-4 hover:underline">Trade on Raydium</a>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {!launched.flagged && (
                <Link to="/orbitxlaunch/claim">
                  <Button className="w-full bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90 sm:w-auto"><Coins className="mr-2 h-4 w-4" /> Claim creator fees</Button>
                </Link>
              )}
              <Button variant="outline" className="border-white/15" onClick={() => { setLaunched(null); setPhase("idle"); setCfg(DEFAULT_CONFIG); foundKpRef.current = null; setFoundKey(null); }}>
                Launch another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-6">
        {/* Deploy console header */}
        <div className="lpx-panel lpx-panel--hot relative mb-6 overflow-hidden">
          <div className="lpx-sweep" />
          <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-[hsl(var(--og-lime))]">{"//"} deploy console — custom lane</div>
              <h1 className="mt-1 font-display text-2xl font-black tracking-tight sm:text-3xl">
                BUILD YOUR <span className="lpx-glow text-[hsl(var(--og-lime))]">MINT</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Own SPL mint · Metaplex metadata · optional Raydium pool · on-chain creator fees · OBX vanity address. No pump.fun.
              </p>
              <div className="mt-4 grid max-w-md grid-cols-2 gap-4">
                <div>
                  <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest">
                    <span className="text-muted-foreground">Launch readiness</span>
                    <span className="font-bold text-[hsl(var(--og-lime))]">{readiness}%</span>
                  </div>
                  <div className="lpx-gauge"><div style={{ width: `${readiness}%` }} /></div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest">
                    <span className="text-muted-foreground">Trust score</span>
                    <span className="font-bold" style={{ color: toneHsl[trustTone] }}>{trust}/100</span>
                  </div>
                  <div className="lpx-gauge"><div style={{ width: `${trust}%`, background: toneHsl[trustTone], boxShadow: `0 0 10px ${toneHsl[trustTone]}` }} /></div>
                </div>
              </div>
            </div>
            {connected ? (
              <span className="flex items-center gap-1.5 self-start rounded-lg border border-[hsl(var(--og-lime))]/35 bg-black/40 px-3 py-2 font-mono text-[11px] font-bold text-[hsl(var(--og-lime))]">
                <span className="lpx-led" /> {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[hsl(var(--pf-border))] px-3 py-1.5 text-xs text-[hsl(var(--pf-muted))]"><Wallet className="h-3.5 w-3.5" /> Connect via the wallet button up top</span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr_320px]">
          {/* Section nav with completion ticks */}
          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s, idx) => {
              const Icon = s.icon; const on = active === s.id; const done = sectionDone[s.id];
              return (
                <button key={s.id} onClick={() => setActive(s.id)} data-on={on}
                  className="lpx-step shrink-0 lg:w-full">
                  <span className="idx">{String(idx + 1).padStart(2, "0")}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${on ? "text-[hsl(var(--og-lime))]" : "text-muted-foreground"}`} />
                  <span className={`flex-1 text-left font-mono text-[11px] font-bold uppercase tracking-wider ${on ? "text-[hsl(var(--og-lime))]" : "text-muted-foreground"}`}>{s.label}</span>
                  {done && <Check className="h-3.5 w-3.5 text-[hsl(var(--og-lime))]" />}
                </button>
              );
            })}
          </nav>

          {/* Active section */}
          <div className="lpx-panel"><div className="p-6">{renderSection()}</div></div>

          {/* Live summary */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="lpx-panel"><header className="lpx-panel-title">Launch telemetry</header><div className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  {cfg.logoDataUrl ? <img src={cfg.logoDataUrl} alt="" className="h-full w-full object-cover" /> : <Coins className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{cfg.name || "Untitled Token"}</div>
                  <div className="font-mono text-xs text-[hsl(var(--og-gold))]">${cfg.ticker || "TICKER"}</div>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Trust score</span>
                  <span className="font-mono font-semibold" style={{ color: toneHsl[trustTone] }}>{trust}/100</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${trust}%`, background: toneHsl[trustTone] }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Supply" value={Number(cfg.supply || 0).toLocaleString()} />
                <StatChip label="Type" value={LAUNCH_TYPES.find((t) => t.value === cfg.launchType)?.label.split(" ")[0] || "—"} tone="cyan" />
                <StatChip label="Liquidity" value={cfg.addLiquidity ? `${cfg.liquiditySol || 0} SOL` : "Optional"} tone="lime" />
                <StatChip label="LP" value={cfg.burnLp ? "Burned" : `${cfg.lpLockDays}d lock`} tone="cyan" />
                <StatChip label="Burn" value={`${cfg.burnPct}%`} tone="blood" />
                <StatChip label="Vanity" value={cfg.vanityPrefix || "—"} tone="gold" />
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Allocation</div>
                <AllocationBar alloc={cfg.alloc} />
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Mint authority</span><span className={cfg.revokeMint ? "text-[hsl(var(--og-lime))]" : "text-[hsl(var(--og-blood))]"}>{cfg.revokeMint ? "Revoked" : "Retained"}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Freeze authority</span><span className={cfg.revokeFreeze ? "text-[hsl(var(--og-lime))]" : "text-[hsl(var(--og-blood))]"}>{cfg.revokeFreeze ? "Revoked" : "Retained"}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">DEX</span><span className="text-foreground">{DEXES.find((d) => d.value === cfg.dex)?.label || "—"}</span></div>
              </div>

              <Separator className="my-4 bg-white/10" />
              <div className="mb-3 space-y-1.5 text-xs">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">Launch cost</span>
                  {fee && <span className="text-[10px] text-muted-foreground">SOL ≈ ${fee.solUsd.toFixed(0)}{!fee.priceLive && " (est)"}</span>}
                </div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Mint + metadata</span><span className="font-mono">{fee ? fee.mintCostSol.toFixed(3) : "…"} SOL</span></div>
                {fee && fee.poolFeeSol > 0 && (
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">DEX pool creation</span><span className="font-mono">{fee.poolFeeSol.toFixed(3)} SOL</span></div>
                )}
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Orbitx fee {isLaunchFeePromoActive() ? <><s className="opacity-50">{fmtUsd(BASE_LAUNCH_FEE_USD)}</s> <span className="font-bold text-[hsl(var(--og-lime))]">FREE</span></> : <>({fmtUsd(ORBITX_FEE_USD)})</>}</span><span className="font-mono text-[hsl(var(--og-gold))]">{fee ? fee.orbitxFeeSol.toFixed(4) : "…"} SOL</span></div>
                {fee && fee.liquiditySol > 0 && (
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Liquidity you seed <span className="text-[9px] opacity-70">(your capital)</span></span><span className="font-mono">{fee.liquiditySol.toFixed(3)} SOL</span></div>
                )}
                <Separator className="my-1.5 bg-white/10" />
                <div className="flex items-center justify-between text-sm font-semibold"><span className="text-foreground">Total from wallet</span><span className="font-mono text-[hsl(var(--og-gold))]">{fee ? fee.totalOutOfPocketSol.toFixed(3) : "…"} SOL</span></div>
              </div>

              {launching && (
                <div className="lpx-term mb-3 rounded-lg border border-[hsl(var(--og-lime))]/20 bg-black/60 p-2.5">
                  <div className="gold">$ orbitx deploy --lane custom</div>
                  <div>[{phase}] {phaseMsg || "working…"}<span className="lpx-caret" /></div>
                </div>
              )}
              <Button onClick={handleLaunch} disabled={launching || errors.length > 0}
                className="lp-cta w-full border-0 font-display text-sm font-black uppercase tracking-wider disabled:opacity-50">
                {launching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {phaseMsg || "Working…"}</> : <><Rocket className="mr-2 h-4 w-4" /> Deploy token — mainnet</>}
              </Button>
              {errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {errors.map((e) => (
                    <div key={e} className="flex items-center gap-1.5 text-xs text-[hsl(var(--og-blood))]"><AlertTriangle className="h-3 w-3" /> {e}</div>
                  ))}
                </div>
              )}
            </div></div>

            <button onClick={() => { const i = SECTIONS.findIndex((s) => s.id === active); setActive(SECTIONS[(i + 1) % SECTIONS.length].id); }}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/20 py-2 text-sm text-muted-foreground hover:text-foreground">
              Next section <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
