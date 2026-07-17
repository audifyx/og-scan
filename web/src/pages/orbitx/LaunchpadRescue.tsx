/**
 * OrbitX Rescue Console — CLAIM SCANNER + RENT REFUND + BURN + SELL ALL.
 * Non-custodial. All numbers are read live from mainnet:
 *   • Claim Scanner — sweeps EVERY claimable lamport it can find for the
 *     connected wallet: rent locked in empty token accounts (SPL + Token-2022),
 *     wrapped SOL ready to unwrap, pump.fun creator fees sitting in the
 *     creator vault, plus a DexScreener-priced estimate of token dust that
 *     Sell All can convert. One CLAIM ALL sweeps the lot.
 *   • Rent Refund — closes empty token accounts, rent comes back as SOL/USDC.
 *   • Burn — burns held tokens, then shows a full burn report (amount, % of
 *     supply, supply before/after, tx) and logs the verified burn event.
 *   • Sell All — Jupiter-swaps every holding into SOL or USDC.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Wallet, Loader2, RefreshCw, ExternalLink, CheckCircle2, Flame, Coins,
  ArrowRightLeft, Radar, Droplets, HandCoins, Share2, PartyPopper, X,
} from "lucide-react";
import {
  scanEmptyTokenAccounts, totalReclaimableSol, buildCloseAccountsTransactions,
  buildSolToUsdcSwapTransaction, scanBurnableTokens, resolvePercentBurnAmount,
  parseManualBurnAmount, buildBurnTransaction, buildSellAllQuotes, fetchBurnTokenMeta,
  scanNativeSolAccounts, buildUnwrapTransactions, estimateHoldingsUsd,
  SOL_MINT, USDC_MINT,
  type EmptyTokenAccount, type BurnableToken, type NativeSolAccount, type BurnTokenMeta,
} from "@/lib/orbitx/rescue";
import { getPumpClaimableSol, buildPumpClaimTransaction } from "@/lib/orbitx/claim";
import { supabase } from "@/lib/supabase";
import { Panel, useSolUsd } from "./lpx";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const BURN_PRESETS = [10, 25, 35, 50, 75, 100];

/* ═══════════════════ animation primitives ═══════════════════ */

/** rAF count-up from 0 → target. Re-runs when target changes. */
function useCountUp(target: number, durationMs = 1600, decimals = 4) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value.toFixed(decimals);
}

const CONFETTI_COLORS = [
  "hsl(132 100% 54%)", "hsl(44 96% 56%)", "hsl(158 92% 48%)",
  "hsl(300 100% 62%)", "#ffffff",
];

function ConfettiBurst({ count = 42 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${6 + Math.random() * 88}%`,
        top: `${18 + Math.random() * 30}%`,
        dx: `${(Math.random() - 0.5) * 220}px`,
        dy: `${-60 - Math.random() * 160}px`,
        rot: `${Math.random() * 720 - 360}deg`,
        t: `${1 + Math.random() * 1.1}s`,
        d: `${Math.random() * 0.35}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="lpx-confetti-piece"
          style={{
            left: p.left, top: p.top, background: p.color,
            "--dx": p.dx, "--dy": p.dy, "--rot": p.rot, "--t": p.t, "--d": p.d,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function Embers({ count = 26 }: { count?: number }) {
  const embers = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: `${8 + Math.random() * 84}%`,
        dx: `${(Math.random() - 0.5) * 60}px`,
        t: `${1.6 + Math.random() * 1.8}s`,
        d: `${Math.random() * 2}s`,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((e, i) => (
        <span
          key={i}
          className="lpx-ember"
          style={{
            left: e.left,
            "--dx": e.dx, "--t": e.t, "--d": e.d,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function RadarScan({ label }: { label: string }) {
  const blips = useMemo(
    () => Array.from({ length: 4 }, () => ({
      left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 60}%`, delay: `${Math.random() * 1.4}s`,
    })),
    [],
  );
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="lpx-radar h-28 w-28">
        {blips.map((b, i) => (
          <span key={i} className="blip" style={{ left: b.left, top: b.top, animationDelay: b.delay }} />
        ))}
      </div>
      <div className="lpx-term">
        {label}
        <span className="lpx-caret" />
      </div>
    </div>
  );
}

/* ═══════════════════ celebration dialogs ═══════════════════ */

interface ClaimCelebration {
  title: string;
  sol: number;            // expected claimable that was swept
  walletDeltaSol: number | null; // measured balance delta (net of fees)
  breakdown: { label: string; value: string }[];
  sigs: string[];
  swappedToUsdc?: boolean;
}

function ClaimCelebrationDialog({
  data, solUsd, onClose,
}: { data: ClaimCelebration | null; solUsd: number | null; onClose: () => void }) {
  const counted = useCountUp(data?.sol ?? 0, 1700, 5);
  if (!data) return null;
  const usd = solUsd != null ? data.sol * solUsd : null;
  const tweet = encodeURIComponent(
    `Just swept ${data.sol.toFixed(4)} SOL of forgotten value back into my wallet with the OrbitX Rescue Console 🛰️ orbitx.world/orbitxlaunch/rescue`,
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="lp-v3 lpx-pop max-w-md overflow-hidden border-[hsl(var(--og-lime))]/35 bg-[#03130a] p-0 shadow-[0_0_80px_-20px_hsl(132_100%_54%/0.5)]">
        <ConfettiBurst />
        <div className="relative p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[hsl(var(--og-lime))]/45 bg-[hsl(var(--og-lime))]/10">
            <PartyPopper className="h-7 w-7 text-[hsl(var(--og-lime))]" />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{data.title}</div>
          <div className="lpx-count mt-2 font-display text-5xl font-black text-[hsl(var(--og-lime))]">
            {counted}
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[hsl(var(--og-lime))]">
            SOL RECLAIMED{data.swappedToUsdc ? " → swapped to USDC" : ""}
          </div>
          {usd != null && (
            <div className="mt-0.5 font-mono text-xs text-[hsl(var(--og-gold))]">≈ ${usd.toFixed(2)} at live price</div>
          )}

          <div className="mt-5 space-y-1.5 rounded-xl border border-white/10 bg-black/40 p-3 text-left">
            {data.breakdown.map((b, i) => (
              <div key={i} className="lpx-row-in flex items-center justify-between font-mono text-[11px]" style={{ animationDelay: `${0.15 * i + 0.4}s` }}>
                <span className="text-muted-foreground">{b.label}</span>
                <span className="font-bold text-[hsl(var(--og-lime))]">{b.value}</span>
              </div>
            ))}
            {data.walletDeltaSol != null && (
              <>
                <Separator className="bg-white/10" />
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">measured wallet delta (net of fees)</span>
                  <span className="font-bold text-[hsl(var(--og-gold))]">+{data.walletDeltaSol.toFixed(6)} SOL</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {data.sigs.slice(0, 3).map((s) => (
              <a key={s} href={`https://solscan.io/tx/${s}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] text-[hsl(var(--og-cyan))] underline-offset-4 hover:underline">
                tx {short(s)} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a
              href={`https://x.com/intent/tweet?text=${tweet}`}
              target="_blank" rel="noopener noreferrer"
              className="lpx-btn lpx-btn--gold"
            >
              <Share2 className="h-3.5 w-3.5" /> Share the win
            </a>
            <button type="button" className="lpx-btn" onClick={onClose}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Done
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BurnCelebration {
  meta: BurnTokenMeta;
  mint: string;
  amountUi: number;
  pctOfSupply: number;
  supplyBefore: number;
  supplyAfter: number;
  sig: string;
}

function BurnResultDialog({ data, onClose }: { data: BurnCelebration | null; onClose: () => void }) {
  const counted = useCountUp(data?.amountUi ?? 0, 1700, data && data.amountUi < 1000 ? 4 : 0);
  const pctCounted = useCountUp(data?.pctOfSupply ?? 0, 1900, 4);
  if (!data) return null;
  const keptPct = Math.max(0, Math.min(100, (data.supplyAfter / (data.supplyBefore || 1)) * 100));
  const nf = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const tweet = encodeURIComponent(
    `🔥 Just burned ${nf(data.amountUi)} $${data.meta.symbol} — ${data.pctOfSupply.toFixed(3)}% of total supply, gone forever. Verified on-chain via OrbitX Rescue. solscan.io/tx/${data.sig}`,
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="lp-v3 lpx-pop max-w-md overflow-hidden border-[hsl(var(--og-blood))]/40 bg-[#160603] p-0 shadow-[0_0_80px_-20px_hsl(8_92%_50%/0.55)]">
        <Embers />
        <div className="relative p-6 text-center">
          <div className="lpx-flame-ring mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-[hsl(var(--og-blood))]/50 bg-[hsl(var(--og-blood))]/10">
            {data.meta.logoUrl
              ? <img src={data.meta.logoUrl} alt={data.meta.symbol} className="h-12 w-12 rounded-full object-cover" />
              : <Flame className="h-8 w-8 text-orange-400" />}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Burn confirmed on-chain</div>
          <div className="lpx-count lpx-count--fire mt-2 font-display text-4xl font-black text-orange-400">
            {Number(counted).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-orange-300">
            ${data.meta.symbol} DESTROYED FOREVER
          </div>
          <div className="mt-0.5 font-mono text-xs text-[hsl(var(--og-gold))]">
            {pctCounted}% of total supply
          </div>

          {/* supply before → after */}
          <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-3 text-left">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Supply impact</span>
              <span className="text-orange-400">-{nf(data.amountUi)}</span>
            </div>
            <div className="lpx-supplybar">
              <div className="keep" style={{ width: `${keptPct}%` }} />
              <div className="burnt" style={{ width: `${100 - keptPct}%` }} />
            </div>
            <div className="mt-2 space-y-1.5 font-mono text-[11px]">
              <div className="lpx-row-in flex items-center justify-between" style={{ animationDelay: "0.4s" }}>
                <span className="text-muted-foreground">supply before</span>
                <span className="font-bold text-foreground">{nf(data.supplyBefore)}</span>
              </div>
              <div className="lpx-row-in flex items-center justify-between" style={{ animationDelay: "0.55s" }}>
                <span className="text-muted-foreground">supply after</span>
                <span className="font-bold text-[hsl(var(--og-lime))]">{nf(data.supplyAfter)}</span>
              </div>
              <div className="lpx-row-in flex items-center justify-between" style={{ animationDelay: "0.7s" }}>
                <span className="text-muted-foreground">token</span>
                <span className="font-bold text-foreground">{data.meta.name} · {short(data.mint)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <a href={`https://solscan.io/tx/${data.sig}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-[hsl(var(--og-cyan))] underline-offset-4 hover:underline">
              verify burn tx {short(data.sig)} <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a href={`https://x.com/intent/tweet?text=${tweet}`} target="_blank" rel="noopener noreferrer" className="lpx-btn lpx-btn--gold">
              <Share2 className="h-3.5 w-3.5" /> Share the burn
            </a>
            <button type="button" className="lpx-btn" onClick={onClose}>
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════ omni claim scanner types ═══════════════════ */

interface OmniScan {
  rent: EmptyTokenAccount[];
  native: NativeSolAccount[];
  pumpFeesSol: number;
  dustUsd: number;
  dustCount: number;
  scannedAt: number;
}

export default function LaunchpadRescue() {
  const { connected, publicKey, connect, wallets, select, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const solUsd = useSolUsd();
  const [tab, setTab] = useState("scanner");

  const handleConnect = async () => {
    try {
      if (!wallets.length) return toast.error("No Solana wallet found — install Phantom");
      select(wallets[0].adapter.name);
      await connect();
    } catch { /* user closed modal */ }
  };

  /* ── celebrations ── */
  const [claimCelebration, setClaimCelebration] = useState<ClaimCelebration | null>(null);
  const [burnCelebration, setBurnCelebration] = useState<BurnCelebration | null>(null);

  /* ═══════════ OMNI CLAIM SCANNER ═══════════ */
  const [omni, setOmni] = useState<OmniScan | null>(null);
  const [omniScanning, setOmniScanning] = useState(false);
  const [omniLog, setOmniLog] = useState<string[]>([]);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");
  const logRef = useRef<string[]>([]);

  const pushLog = (line: string) => {
    logRef.current = [...logRef.current.slice(-7), line];
    setOmniLog(logRef.current);
  };

  const omniScan = useCallback(async () => {
    if (!publicKey) return;
    setOmniScanning(true);
    logRef.current = [];
    setOmniLog([]);
    try {
      pushLog("$ rescue --scan-all --wallet " + short(publicKey.toBase58()));
      const [rent, native] = await Promise.all([
        scanEmptyTokenAccounts(connection, publicKey),
        scanNativeSolAccounts(connection, publicKey),
      ]);
      pushLog(`[✓] token accounts swept — ${rent.length} empty (${totalReclaimableSol(rent).toFixed(5)} SOL rent locked)`);
      pushLog(`[✓] wrapped SOL — ${native.length} account${native.length === 1 ? "" : "s"} (${(native.reduce((a, b) => a + b.lamports, 0) / 1e9).toFixed(5)} SOL unwrappable)`);
      let pumpFeesSol = 0;
      try {
        pumpFeesSol = await getPumpClaimableSol(connection, publicKey);
        pushLog(`[✓] pump.fun creator vault — ${pumpFeesSol.toFixed(5)} SOL claimable`);
      } catch {
        pushLog("[!] pump.fun creator vault — unreachable, skipped");
      }
      let dustUsd = 0; let dustCount = 0;
      try {
        const held = await scanBurnableTokens(connection, publicKey);
        const values = await estimateHoldingsUsd(held);
        for (const v of Object.values(values)) { dustUsd += v; dustCount++; }
        pushLog(`[✓] holdings priced via DexScreener — ${dustCount} priceable (~$${dustUsd.toFixed(2)}) convertible via Sell All`);
      } catch {
        pushLog("[!] dust pricing unavailable — skipped");
      }
      pushLog("[✓] scan complete");
      setOmni({ rent, native, pumpFeesSol, dustUsd, dustCount, scannedAt: Date.now() });
    } catch (e) {
      console.error("[rescue] omni scan", e);
      toast.error("Claim scan failed — try again");
    } finally {
      setOmniScanning(false);
    }
  }, [connection, publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const omniRentSol = omni ? totalReclaimableSol(omni.rent) : 0;
  const omniNativeSol = omni ? omni.native.reduce((a, b) => a + b.lamports, 0) / 1e9 : 0;
  const omniPumpSol = omni?.pumpFeesSol ?? 0;
  const omniTotalSol = omniRentSol + omniNativeSol + omniPumpSol;
  const omniClaimableTxCount = omni ? (omni.rent.length > 0 ? 1 : 0) + (omni.native.length > 0 ? 1 : 0) + (omniPumpSol > 0.000005 ? 1 : 0) : 0;

  const claimAll = async () => {
    if (!publicKey || !signTransaction || !omni || omniTotalSol <= 0) return;
    setClaimingAll(true);
    try {
      const balanceBefore = await connection.getBalance(publicKey);
      const sigs: string[] = [];

      if (omni.rent.length > 0) {
        setClaimMsg(`Closing ${omni.rent.length} empty account${omni.rent.length === 1 ? "" : "s"}…`);
        for (const tx of buildCloseAccountsTransactions(publicKey, omni.rent)) {
          tx.feePayer = publicKey;
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          tx.recentBlockhash = blockhash;
          const signed = await signTransaction(tx);
          const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
          sigs.push(sig);
        }
      }

      if (omni.native.length > 0) {
        setClaimMsg(`Unwrapping ${omni.native.length} wSOL account${omni.native.length === 1 ? "" : "s"}…`);
        for (const tx of buildUnwrapTransactions(publicKey, omni.native)) {
          tx.feePayer = publicKey;
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          tx.recentBlockhash = blockhash;
          const signed = await signTransaction(tx);
          const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
          sigs.push(sig);
        }
      }

      if (omniPumpSol > 0.000005) {
        setClaimMsg("Collecting pump.fun creator fees…");
        try {
          const vtx = await buildPumpClaimTransaction(publicKey);
          const signed = await signTransaction(vtx);
          const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
          await connection.confirmTransaction(sig, "confirmed");
          sigs.push(sig);
        } catch (e) {
          console.error("[rescue] pump claim", e);
          toast.error("Creator-fee claim failed — rent + wSOL were still swept");
        }
      }

      const balanceAfter = await connection.getBalance(publicKey);
      const delta = (balanceAfter - balanceBefore) / 1e9;

      const breakdown: { label: string; value: string }[] = [];
      if (omni.rent.length > 0) breakdown.push({ label: `rent · ${omni.rent.length} accounts closed`, value: `+${omniRentSol.toFixed(6)} SOL` });
      if (omni.native.length > 0) breakdown.push({ label: `wrapped SOL unwrapped`, value: `+${omniNativeSol.toFixed(6)} SOL` });
      if (omniPumpSol > 0.000005) breakdown.push({ label: "pump.fun creator fees", value: `+${omniPumpSol.toFixed(6)} SOL` });

      setClaimCelebration({
        title: "Omni-claim sweep complete",
        sol: omniTotalSol,
        walletDeltaSol: Number.isFinite(delta) ? delta : null,
        breakdown,
        sigs,
      });
      omniScan();
      scanRent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) toast.error("Transaction cancelled");
      else toast.error(msg || "Claim sweep failed");
    } finally {
      setClaimingAll(false);
      setClaimMsg("");
    }
  };

  /* ═══════════ RENT REFUND (kept + celebration) ═══════════ */
  const [emptyAccounts, setEmptyAccounts] = useState<EmptyTokenAccount[]>([]);
  const [scanning, setScanning] = useState(false);
  const [payout, setPayout] = useState<"SOL" | "USDC">("SOL");
  const [refunding, setRefunding] = useState(false);

  const scanRent = useCallback(async () => {
    if (!publicKey) return;
    setScanning(true);
    try {
      setEmptyAccounts(await scanEmptyTokenAccounts(connection, publicKey));
    } catch (e) {
      console.error("[rescue] rent scan", e);
      toast.error("Could not scan wallet for unclaimed rent");
    } finally {
      setScanning(false);
    }
  }, [connection, publicKey]);

  const claimRent = async () => {
    if (!publicKey || !signTransaction || emptyAccounts.length === 0) return;
    setRefunding(true);
    try {
      const claimedSol = totalReclaimableSol(emptyAccounts);
      const accountCount = emptyAccounts.length;
      const balanceBefore = await connection.getBalance(publicKey);
      const sigs: string[] = [];
      for (const tx of buildCloseAccountsTransactions(publicKey, emptyAccounts)) {
        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        sigs.push(sig);
      }

      let swapped = false;
      if (payout === "USDC") {
        const lamportsReclaimed = Math.floor(claimedSol * 1e9);
        const swapLamports = Math.max(0, lamportsReclaimed - 8000);
        if (swapLamports > 0) {
          const { swapTransactionB64 } = await buildSolToUsdcSwapTransaction(publicKey, swapLamports);
          const vtx = VersionedTransaction.deserialize(Buffer.from(swapTransactionB64, "base64"));
          const signedVtx = signAllTransactions ? (await signAllTransactions([vtx]))[0] : vtx;
          const sig = await connection.sendRawTransaction(signedVtx.serialize(), { skipPreflight: false, maxRetries: 3 });
          await connection.confirmTransaction(sig, "confirmed");
          sigs.push(sig);
          swapped = true;
        }
      }

      const balanceAfter = await connection.getBalance(publicKey);
      const delta = (balanceAfter - balanceBefore) / 1e9;

      setClaimCelebration({
        title: "Rent refund complete",
        sol: claimedSol,
        walletDeltaSol: swapped ? null : delta,
        breakdown: [
          { label: `empty accounts closed`, value: String(accountCount) },
          { label: "rent reclaimed", value: `+${claimedSol.toFixed(6)} SOL` },
        ],
        sigs,
        swappedToUsdc: swapped,
      });
      scanRent();
      omniScan();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) toast.error("Transaction cancelled");
      else toast.error(msg || "Rent refund failed");
    } finally {
      setRefunding(false);
    }
  };

  /* ═══════════ BURN (kept + result dialog) ═══════════ */
  const [burnable, setBurnable] = useState<BurnableToken[]>([]);
  const [burnScanning, setBurnScanning] = useState(false);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [burning, setBurning] = useState(false);

  const scanBurn = useCallback(async () => {
    if (!publicKey) return;
    setBurnScanning(true);
    try {
      const list = await scanBurnableTokens(connection, publicKey);
      setBurnable(list);
      if (list.length && !selectedMint) setSelectedMint(list[0].mint);
    } catch (e) {
      console.error("[rescue] burn scan", e);
      toast.error("Could not load your token balances");
    } finally {
      setBurnScanning(false);
    }
  }, [connection, publicKey, selectedMint]);

  useEffect(() => {
    if (connected && publicKey) { omniScan(); scanRent(); scanBurn(); }
  }, [connected, publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedToken = burnable.find((t) => t.mint === selectedMint) || null;
  const manualRaw = selectedToken && manualAmount ? parseManualBurnAmount(manualAmount, selectedToken.decimals) : null;
  const presetRaw = selectedToken && percent !== null ? resolvePercentBurnAmount(selectedToken, percent) : null;
  const burnAmountRaw = manualAmount ? manualRaw : presetRaw;
  const burnAmountUi = selectedToken && burnAmountRaw !== null
    ? Number(burnAmountRaw) / 10 ** selectedToken.decimals
    : null;

  const executeBurn = async () => {
    if (!publicKey || !signTransaction || !selectedToken || !burnAmountRaw || burnAmountRaw <= BigInt(0)) return;
    if (burnAmountRaw > selectedToken.balanceRaw) {
      toast.error("You don't hold that many tokens");
      return;
    }
    setBurning(true);
    try {
      const tx = buildBurnTransaction(publicKey, selectedToken, burnAmountRaw);
      tx.feePayer = publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

      const divisor = 10 ** selectedToken.decimals;
      const supplyBefore = Number(selectedToken.supplyRaw) / divisor;
      const supplyAfter = Number(selectedToken.supplyRaw - burnAmountRaw) / divisor;
      const percentOfSupply = (Number(burnAmountRaw) / Number(selectedToken.supplyRaw)) * 100;
      const amountUi = Number(burnAmountRaw) / divisor;

      // Metadata for the report card (best-effort, fast).
      const meta = await fetchBurnTokenMeta(selectedToken.mint);
      setBurnCelebration({
        meta,
        mint: selectedToken.mint,
        amountUi,
        pctOfSupply: percentOfSupply,
        supplyBefore,
        supplyAfter,
        sig,
      });

      // Fire-and-forget: log the verified burn for the global feed.
      (async () => {
        try {
          await supabase.from("burn_events").insert({
            mint: selectedToken.mint,
            token_name: meta.name,
            token_symbol: meta.symbol,
            token_logo_url: meta.logoUrl,
            wallet: publicKey.toBase58(),
            amount_burned: amountUi,
            supply_before: supplyBefore,
            supply_after: supplyAfter,
            percent_of_supply: percentOfSupply,
            tx_signature: sig,
          });
        } catch (e) {
          console.error("[rescue] failed to log burn event", e);
        }
      })();

      setManualAmount("");
      setPercent(null);
      scanBurn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) toast.error("Transaction cancelled");
      else toast.error(msg || "Burn failed");
    } finally {
      setBurning(false);
    }
  };

  /* ═══════════ SELL ALL (kept) ═══════════ */
  const [sellTarget, setSellTarget] = useState<"SOL" | "USDC">("USDC");
  const [selling, setSelling] = useState(false);
  const [sellProgress, setSellProgress] = useState<{ done: number; total: number } | null>(null);
  const [sellResults, setSellResults] = useState<{ mint: string; ok: boolean; sig?: string; error?: string }[]>([]);

  const sellableCount = burnable.filter((t) => {
    const targetMintStr = sellTarget === "SOL" ? SOL_MINT.toBase58() : USDC_MINT.toBase58();
    return t.mint !== targetMintStr && t.balanceRaw > BigInt(0);
  }).length;

  const sellAll = async () => {
    if (!publicKey || !signTransaction || sellableCount === 0) return;
    setSelling(true);
    setSellResults([]);
    try {
      const targetMint = sellTarget === "SOL" ? SOL_MINT : USDC_MINT;
      const quotes = await buildSellAllQuotes(publicKey, burnable, targetMint);
      setSellProgress({ done: 0, total: quotes.length });
      const results: { mint: string; ok: boolean; sig?: string; error?: string }[] = [];
      for (let i = 0; i < quotes.length; i++) {
        const q = quotes[i];
        if (!q.ok) {
          const failed = q as Extract<typeof q, { ok: false }>;
          results.push({ mint: failed.mint, ok: false, error: failed.error });
          setSellProgress({ done: i + 1, total: quotes.length });
          continue;
        }
        try {
          const vtx = VersionedTransaction.deserialize(Buffer.from(q.swapTransactionB64, "base64"));
          const signedVtx = signAllTransactions ? (await signAllTransactions([vtx]))[0] : vtx;
          const sig = await connection.sendRawTransaction(signedVtx.serialize(), { skipPreflight: false, maxRetries: 3 });
          await connection.confirmTransaction(sig, "confirmed");
          results.push({ mint: q.mint, ok: true, sig });
        } catch (err) {
          results.push({ mint: q.mint, ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        setSellProgress({ done: i + 1, total: quotes.length });
      }
      setSellResults(results);
      const okCount = results.filter((r) => r.ok).length;
      if (okCount > 0) toast.success(`Sold ${okCount}/${results.length} holdings to ${sellTarget}`);
      else if (results.length > 0) toast.error("All sell orders failed — check per-token errors below");
      scanBurn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Sell all failed");
    } finally {
      setSelling(false);
    }
  };

  /* ═══════════════════════ render ═══════════════════════ */

  const usdOf = (sol: number) => (solUsd.data ? ` ≈ $${(sol * solUsd.data.price).toFixed(2)}` : "");

  return (
    <div className="space-y-5">
      <ClaimCelebrationDialog data={claimCelebration} solUsd={solUsd.data?.price ?? null} onClose={() => setClaimCelebration(null)} />
      <BurnResultDialog data={burnCelebration} onClose={() => setBurnCelebration(null)} />

      {/* Hero */}
      <Panel hot bodyClassName="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--og-lime))]">
              <Radar className="h-3.5 w-3.5" /> Rescue console
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
              Every claimable lamport. <span className="lpx-glow text-[hsl(var(--og-lime))]">Found and swept.</span>
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Scans this wallet for rent locked in empty accounts, wrapped SOL, unclaimed pump.fun creator fees and convertible dust — then claims it all, non-custodially.
            </p>
          </div>
          {!connected ? (
            <button type="button" onClick={handleConnect} className="lp-cta inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider">
              <Wallet className="h-4 w-4" /> Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-lime))]/35 bg-black/40 px-3 py-1.5 font-mono text-[11px] font-bold text-[hsl(var(--og-lime))]">
                <span className="lpx-led" /> {publicKey ? short(publicKey.toBase58()) : ""}
              </span>
              <button type="button" className="lpx-btn !px-2.5" onClick={() => { omniScan(); scanRent(); scanBurn(); }} title="Rescan">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </Panel>

      {connected && (
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-black/40">
            <TabsTrigger value="scanner"><Radar className="mr-1.5 h-3.5 w-3.5" /> Claim Scanner</TabsTrigger>
            <TabsTrigger value="refund"><Coins className="mr-1.5 h-3.5 w-3.5" /> Rent Refund</TabsTrigger>
            <TabsTrigger value="burn"><Flame className="mr-1.5 h-3.5 w-3.5" /> Burn</TabsTrigger>
            <TabsTrigger value="sellall"><ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Sell All</TabsTrigger>
          </TabsList>

          {/* ══════════ CLAIM SCANNER ══════════ */}
          <TabsContent value="scanner" className="mt-4 space-y-4">
            <Panel title="Omni-claim scan" icon={<Radar className="h-3.5 w-3.5" />} right={
              <button type="button" onClick={omniScan} disabled={omniScanning} className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground transition hover:text-[hsl(var(--og-lime))]">
                {omniScanning ? "scanning…" : "rescan"}
              </button>
            }>
              {omniScanning && !omni ? (
                <RadarScan label="sweeping mainnet for claimable SOL" />
              ) : omni ? (
                <div className="space-y-4">
                  {/* headline total */}
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-[hsl(var(--og-lime))]/25 bg-[hsl(var(--og-lime))]/[0.05] py-5 text-center">
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Claimable right now</div>
                    <div className="lpx-count font-display text-4xl font-black text-[hsl(var(--og-lime))]">
                      {omniTotalSol.toFixed(5)} <span className="text-lg">SOL</span>
                    </div>
                    <div className="font-mono text-xs text-[hsl(var(--og-gold))]">{solUsd.data ? `≈ $${(omniTotalSol * solUsd.data.price).toFixed(2)} at live price` : ""}</div>
                    <button
                      type="button"
                      onClick={claimAll}
                      disabled={claimingAll || omniTotalSol <= 0 || omniClaimableTxCount === 0}
                      className="lp-cta mt-3 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 font-display text-sm font-black uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {claimingAll
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> {claimMsg || "Sweeping…"}</>
                        : omniTotalSol > 0 ? <><HandCoins className="h-4 w-4" /> Claim it all</> : <><CheckCircle2 className="h-4 w-4" /> Wallet is clean</>}
                    </button>
                  </div>

                  {/* source breakdown */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><Coins className="h-3.5 w-3.5 text-[hsl(var(--og-gold))]" /> Locked rent</div>
                      <div className="mt-1 font-mono text-lg font-bold text-[hsl(var(--og-lime))]">{omniRentSol.toFixed(5)} SOL</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{omni.rent.length} empty account{omni.rent.length === 1 ? "" : "s"}{usdOf(omniRentSol)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><Droplets className="h-3.5 w-3.5 text-[hsl(var(--og-cyan))]" /> Wrapped SOL</div>
                      <div className="mt-1 font-mono text-lg font-bold text-[hsl(var(--og-lime))]">{omniNativeSol.toFixed(5)} SOL</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{omni.native.length} wSOL account{omni.native.length === 1 ? "" : "s"} to unwrap{usdOf(omniNativeSol)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><HandCoins className="h-3.5 w-3.5 text-[hsl(var(--og-gold))]" /> Creator fees</div>
                      <div className="mt-1 font-mono text-lg font-bold text-[hsl(var(--og-lime))]">{omniPumpSol.toFixed(5)} SOL</div>
                      <div className="font-mono text-[10px] text-muted-foreground">pump.fun creator vault{usdOf(omniPumpSol)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><ArrowRightLeft className="h-3.5 w-3.5 text-[hsl(var(--og-cyan))]" /> Convertible dust</div>
                      <div className="mt-1 font-mono text-lg font-bold text-[hsl(var(--og-gold))]">~${omni.dustUsd.toFixed(2)}</div>
                      <button type="button" onClick={() => setTab("sellall")} className="font-mono text-[10px] text-[hsl(var(--og-cyan))] underline-offset-4 hover:underline">
                        {omni.dustCount} priced holding{omni.dustCount === 1 ? "" : "s"} → Sell All
                      </button>
                    </div>
                  </div>

                  {/* scan terminal */}
                  <div className="rounded-xl border border-[hsl(var(--og-lime))]/15 bg-black/60 p-3">
                    <div className="lpx-term space-y-0.5">
                      {omniLog.map((l, i) => (
                        <div key={i} className={l.startsWith("$") ? "gold" : l.startsWith("[!]") ? "dim" : undefined}>{l}</div>
                      ))}
                      {omniScanning && <span className="lpx-caret" />}
                    </div>
                  </div>

                  <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                    // sources scanned: SPL + Token-2022 account rent · wrapped SOL · pump.fun creator vault · DexScreener-priced holdings. Airdrop claim programs each need their own signer flow — when your wallet has one we can wire it in.
                  </p>
                </div>
              ) : (
                <RadarScan label="connect + scan to sweep this wallet" />
              )}
            </Panel>
          </TabsContent>

          {/* ══════════ RENT REFUND ══════════ */}
          <TabsContent value="refund" className="mt-4">
            <Panel title="Rent refund" icon={<Coins className="h-3.5 w-3.5" />} right={
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">closes empty token accounts</span>
            }>
              <p className="mb-4 text-xs text-muted-foreground">
                Every token account locks ~0.002 SOL in rent. Once it's empty, closing it sends that SOL straight back to you.
              </p>

              {scanning ? (
                <RadarScan label="scanning token accounts" />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {emptyAccounts.length} empty account{emptyAccounts.length === 1 ? "" : "s"} found
                      </div>
                      <div className="lpx-count font-display text-3xl font-black text-[hsl(var(--og-lime))]">
                        {totalReclaimableSol(emptyAccounts).toFixed(6)} SOL
                      </div>
                      <div className="font-mono text-[11px] text-[hsl(var(--og-gold))]">{usdOf(totalReclaimableSol(emptyAccounts)).replace(" ≈ ", "≈ ")}</div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-1">
                        {(["SOL", "USDC"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPayout(p)}
                            className={`rounded-md px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                              payout === p ? "bg-[hsl(var(--og-lime))]/15 text-[hsl(var(--og-lime))]" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Pay in {p}
                          </button>
                        ))}
                      </div>
                      <Button onClick={claimRent} disabled={refunding || emptyAccounts.length === 0}
                        className="lp-cta border-0 font-display text-xs font-bold uppercase tracking-wider disabled:opacity-40">
                        {refunding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reclaiming…</> : <>Reclaim rent → {payout}</>}
                      </Button>
                    </div>
                  </div>

                  {emptyAccounts.length > 0 && (
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-black/40 p-2">
                      {emptyAccounts.map((a, i) => (
                        <div key={a.pubkey.toBase58()} className="lpx-row lpx-row-in flex items-center justify-between rounded-md px-2 py-1 font-mono text-[11px]" style={{ animationDelay: `${Math.min(i * 0.04, 0.6)}s` }}>
                          <span className="text-muted-foreground">mint {short(a.mint)}</span>
                          <span className="font-bold text-[hsl(var(--og-lime))]">+{(a.lamports / 1e9).toFixed(6)} SOL</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </TabsContent>

          {/* ══════════ BURN ══════════ */}
          <TabsContent value="burn" className="mt-4">
            <Panel title="Burn tokens" icon={<Flame className="h-3.5 w-3.5" />} right={
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">irreversible · on-chain</span>
            }>
              <p className="mb-4 text-xs text-muted-foreground">
                Burns only what this wallet holds. Percent presets are a share of total supply, capped at your balance. You'll get a full burn report when it confirms.
              </p>

              {burnScanning ? (
                <RadarScan label="loading token balances" />
              ) : burnable.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                  No tokens found in this wallet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Select token</div>
                    <div className="flex flex-wrap gap-2">
                      {burnable.map((t) => (
                        <button
                          key={t.mint}
                          type="button"
                          onClick={() => { setSelectedMint(t.mint); setPercent(null); setManualAmount(""); }}
                          className={`rounded-lg border px-3 py-2 font-mono text-xs transition ${
                            selectedMint === t.mint
                              ? "border-[hsl(var(--og-blood))]/50 bg-[hsl(var(--og-blood))]/10 text-[hsl(var(--og-blood))] shadow-[0_0_18px_-6px_hsl(var(--og-blood)/0.6)]"
                              : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
                          }`}
                        >
                          {short(t.mint)} · {(Number(t.balanceRaw) / 10 ** t.decimals).toLocaleString(undefined, { maximumFractionDigits: 2 })} held
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedToken && (
                    <>
                      <Separator className="bg-white/10" />
                      <div>
                        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Burn % of total supply (capped to your balance)</div>
                        <div className="flex flex-wrap gap-2">
                          {BURN_PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => { setPercent(p); setManualAmount(""); }}
                              className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition ${
                                percent === p && !manualAmount
                                  ? "border-[hsl(var(--og-blood))]/50 bg-[hsl(var(--og-blood))]/10 text-[hsl(var(--og-blood))]"
                                  : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
                              }`}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Or type an exact token amount</div>
                        <Input
                          inputMode="decimal"
                          placeholder="e.g. 10"
                          value={manualAmount}
                          onChange={(e) => { setManualAmount(e.target.value); setPercent(null); }}
                          className="border-white/15 bg-black/40 font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Will burn</div>
                          <div className="font-mono text-xl font-black text-[hsl(var(--og-blood))]">
                            {burnAmountUi !== null ? burnAmountUi.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"} tokens
                          </div>
                          {burnAmountRaw && selectedToken.supplyRaw > BigInt(0) && (
                            <div className="font-mono text-[10px] text-orange-400">
                              = {((Number(burnAmountRaw) / Number(selectedToken.supplyRaw)) * 100).toFixed(4)}% of total supply
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={executeBurn}
                          disabled={burning || !burnAmountRaw || burnAmountRaw <= BigInt(0)}
                          className="border border-[hsl(var(--og-blood))]/40 bg-[hsl(var(--og-blood))]/15 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-blood))] hover:bg-[hsl(var(--og-blood))]/25 disabled:opacity-40"
                        >
                          {burning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Burning…</> : <><Flame className="mr-2 h-4 w-4" /> Burn forever</>}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Panel>
          </TabsContent>

          {/* ══════════ SELL ALL ══════════ */}
          <TabsContent value="sellall" className="mt-4">
            <Panel title="Sell all holdings" icon={<ArrowRightLeft className="h-3.5 w-3.5" />} right={
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">routes through Jupiter</span>
            }>
              <p className="mb-4 text-xs text-muted-foreground">
                Swaps every token this wallet holds into one asset, in one go. A bad or illiquid mint just gets skipped — it won't block the rest.
              </p>

              {burnScanning ? (
                <RadarScan label="loading token balances" />
              ) : burnable.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                  No tokens found in this wallet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sell everything into</div>
                    <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-1">
                      {(["USDC", "SOL"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSellTarget(p)}
                          className={`rounded-md px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                            sellTarget === p ? "bg-[hsl(var(--og-cyan))]/15 text-[hsl(var(--og-cyan))]" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tokens to sell</div>
                      <div className="font-mono text-2xl font-black text-[hsl(var(--og-cyan))]">{sellableCount}</div>
                    </div>
                    <Button onClick={sellAll} disabled={selling || sellableCount === 0}
                      className="bg-[hsl(var(--og-cyan))] font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[hsl(var(--og-cyan))]/90 disabled:opacity-40">
                      {selling
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Selling {sellProgress ? `${sellProgress.done}/${sellProgress.total}` : "…"}</>
                        : <><ArrowRightLeft className="mr-2 h-4 w-4" /> Sell all → {sellTarget}</>}
                    </Button>
                  </div>

                  {selling && sellProgress && (
                    <div className="lpx-gauge"><div style={{ width: `${(sellProgress.done / Math.max(1, sellProgress.total)) * 100}%` }} /></div>
                  )}

                  {sellResults.length > 0 && (
                    <>
                      <Separator className="bg-white/10" />
                      <div className="space-y-1.5">
                        {sellResults.map((r, i) => (
                          <div key={r.mint} className="lpx-row-in flex items-center justify-between font-mono text-xs" style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
                            <span className="text-muted-foreground">{short(r.mint)}</span>
                            {r.ok ? (
                              <a href={`https://solscan.io/tx/${r.sig}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[hsl(var(--og-lime))] underline-offset-4 hover:underline">
                                <CheckCircle2 className="h-3 w-3" /> sold <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-[hsl(var(--og-blood))]">failed — {r.error}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Panel>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
