/**
 * Orbitx Launchpad — RESCUE (rent refund + burn), non-custodial.
 *
 * Rent Refund: scans the connected wallet for empty (zero-balance) token
 * accounts and closes them, reclaiming the locked-up rent SOL. User picks
 * SOL (direct) or USDC (auto-swapped via Jupiter after closing).
 *
 * Burn: connect wallet, pick a held token, choose a % of total supply
 * (capped to what's held) or type an exact token count to burn.
 */
import { useState, useCallback, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Wallet, Loader2, RefreshCw, ExternalLink, CheckCircle2, Flame, Coins, Sparkles, ArrowRightLeft,
} from "lucide-react";
import {
  scanEmptyTokenAccounts, totalReclaimableSol, buildCloseAccountsTransactions,
  buildSolToUsdcSwapTransaction, scanBurnableTokens, resolvePercentBurnAmount,
  parseManualBurnAmount, buildBurnTransaction, buildSellAllQuotes, fetchBurnTokenMeta, SOL_MINT, USDC_MINT,
  type EmptyTokenAccount, type BurnableToken,
} from "@/lib/orbitx/rescue";
import { supabase } from "@/lib/supabase";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const BURN_PRESETS = [10, 25, 35, 50, 75, 100];

export default function LaunchpadRescue() {
  const { connected, publicKey, connect, wallets, select, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();

  const handleConnect = async () => {
    try {
      if (!wallets.length) return toast.error("No Solana wallet found — install Phantom");
      select(wallets[0].adapter.name);
      await connect();
    } catch { /* user closed modal */ }
  };

  /* ── Rent refund state ── */
  const [emptyAccounts, setEmptyAccounts] = useState<EmptyTokenAccount[]>([]);
  const [scanning, setScanning] = useState(false);
  const [payout, setPayout] = useState<"SOL" | "USDC">("SOL");
  const [refunding, setRefunding] = useState(false);
  const [refundSig, setRefundSig] = useState("");

  const scanRent = useCallback(async () => {
    if (!publicKey) return;
    setScanning(true);
    setRefundSig("");
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
      const closeTxs = buildCloseAccountsTransactions(publicKey, emptyAccounts);
      let lastSig = "";
      for (const tx of closeTxs) {
        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        const signed = await signTransaction(tx);
        lastSig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
        await connection.confirmTransaction({ signature: lastSig, blockhash, lastValidBlockHeight }, "confirmed");
      }

      if (payout === "USDC") {
        const lamportsReclaimed = Math.floor(totalReclaimableSol(emptyAccounts) * 1e9);
        // leave a little SOL for the swap's own network fee
        const swapLamports = Math.max(0, lamportsReclaimed - 8000);
        if (swapLamports > 0) {
          const { swapTransactionB64 } = await buildSolToUsdcSwapTransaction(publicKey, swapLamports);
          const vtx = VersionedTransaction.deserialize(Buffer.from(swapTransactionB64, "base64"));
          const signedVtx = signAllTransactions ? (await signAllTransactions([vtx]))[0] : vtx;
          lastSig = await connection.sendRawTransaction(signedVtx.serialize(), { skipPreflight: false, maxRetries: 3 });
          await connection.confirmTransaction(lastSig, "confirmed");
        }
      }

      setRefundSig(lastSig);
      toast.success(payout === "USDC" ? "Rent reclaimed and swapped to USDC" : "Rent reclaimed as SOL");
      scanRent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) toast.error("Transaction cancelled");
      else toast.error(msg || "Rent refund failed");
    } finally {
      setRefunding(false);
    }
  };

  /* ── Burn state ── */
  const [burnable, setBurnable] = useState<BurnableToken[]>([]);
  const [burnScanning, setBurnScanning] = useState(false);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [burning, setBurning] = useState(false);
  const [burnSig, setBurnSig] = useState("");

  const scanBurn = useCallback(async () => {
    if (!publicKey) return;
    setBurnScanning(true);
    setBurnSig("");
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
    if (connected && publicKey) { scanRent(); scanBurn(); }
  }, [connected, publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sell all state (reuses the burnable/holdings scan) ── */
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
          results.push({ mint: q.mint, ok: false, error: q.error });
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
      setBurnSig(sig);
      toast.success("Tokens burned");

      // Fire-and-forget: log the verified burn with token metadata so every
      // page's BurnAnnouncementListener can show the "thanks for burning" card.
      (async () => {
        try {
          const meta = await fetchBurnTokenMeta(selectedToken.mint);
          const divisor = 10 ** selectedToken.decimals;
          const supplyBefore = Number(selectedToken.supplyRaw) / divisor;
          const supplyAfter = Number(selectedToken.supplyRaw - burnAmountRaw) / divisor;
          const percentOfSupply = (Number(burnAmountRaw) / Number(selectedToken.supplyRaw)) * 100;
          await supabase.from("burn_events").insert({
            mint: selectedToken.mint,
            token_name: meta.name,
            token_symbol: meta.symbol,
            token_logo_url: meta.logoUrl,
            wallet: publicKey.toBase58(),
            amount_burned: burnAmountUi,
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

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="glass-card relative overflow-hidden rounded-2xl border border-white/10 p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[hsl(var(--og-cyan))]/10 blur-3xl" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge className="border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10 text-[hsl(var(--og-cyan))]"><Sparkles className="mr-1 h-3 w-3" /> Rescue</Badge>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Reclaim rent. Burn tokens.</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Scan this wallet for dust-locked SOL sitting in empty token accounts, or burn a chosen amount of any token you hold.
            </p>
          </div>
          {!connected ? (
            <Button onClick={handleConnect} className="bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90"><Wallet className="mr-2 h-4 w-4" /> Connect Wallet</Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-[hsl(var(--og-lime))]/40 font-mono text-[hsl(var(--og-lime))]">{publicKey ? short(publicKey.toBase58()) : ""}</Badge>
              <Button variant="outline" size="sm" className="border-white/15" onClick={() => { scanRent(); scanBurn(); }}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {connected && (
        <Tabs defaultValue="refund" className="w-full">
          <TabsList className="bg-black/30">
            <TabsTrigger value="refund"><Coins className="mr-1.5 h-3.5 w-3.5" /> Rent Refund</TabsTrigger>
            <TabsTrigger value="burn"><Flame className="mr-1.5 h-3.5 w-3.5" /> Burn Tokens</TabsTrigger>
            <TabsTrigger value="sellall"><ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Sell All</TabsTrigger>
          </TabsList>

          {/* ── Rent refund ── */}
          <TabsContent value="refund" className="mt-4">
            <Card className="glass-card border-white/10 bg-black/30">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-[hsl(var(--og-gold))]" />
                    <span className="font-display text-sm font-bold uppercase tracking-wider">Unclaimed rent</span>
                  </div>
                  <Badge variant="outline" className="border-white/15 text-[10px] text-muted-foreground">closes empty token accounts</Badge>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Every token account locks ~0.002 SOL in rent. Once it's empty (sold, burned, or dusted out), closing it sends that SOL straight back to you.
                </p>

                {scanning ? (
                  <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Scanning wallet…</div>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {emptyAccounts.length} empty account{emptyAccounts.length === 1 ? "" : "s"} found
                      </div>
                      <div className="font-mono text-2xl font-bold text-[hsl(var(--og-gold))]">
                        {totalReclaimableSol(emptyAccounts).toFixed(6)} SOL
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-1">
                        {(["SOL", "USDC"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPayout(p)}
                            className={`rounded-md px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                              payout === p ? "bg-[hsl(var(--og-gold))]/15 text-[hsl(var(--og-gold))]" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Pay in {p}
                          </button>
                        ))}
                      </div>
                      <Button onClick={claimRent} disabled={refunding || emptyAccounts.length === 0}
                        className="bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90 disabled:opacity-40">
                        {refunding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reclaiming…</> : <>Reclaim rent → {payout}</>}
                      </Button>
                    </div>
                  </div>
                )}

                {refundSig && (
                  <a href={`https://solscan.io/tx/${refundSig}`} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-[hsl(var(--og-lime))] underline-offset-4 hover:underline">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Reclaimed — view tx <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Burn ── */}
          <TabsContent value="burn" className="mt-4">
            <Card className="glass-card border-white/10 bg-black/30">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[hsl(var(--og-blood))]" />
                  <span className="font-display text-sm font-bold uppercase tracking-wider">Burn tokens</span>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Burns only what this wallet holds. Percent presets are a share of total supply, capped at your balance. Manual entry burns an exact token count — never a dollar amount.
                </p>

                {burnScanning ? (
                  <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading balances…</div>
                ) : burnable.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                    No tokens found in this wallet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">Select token</div>
                      <div className="flex flex-wrap gap-2">
                        {burnable.map((t) => (
                          <button
                            key={t.mint}
                            type="button"
                            onClick={() => { setSelectedMint(t.mint); setPercent(null); setManualAmount(""); setBurnSig(""); }}
                            className={`rounded-lg border px-3 py-2 font-mono text-xs transition ${
                              selectedMint === t.mint
                                ? "border-[hsl(var(--og-blood))]/50 bg-[hsl(var(--og-blood))]/10 text-[hsl(var(--og-blood))]"
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
                          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">Burn % of total supply (capped to your balance)</div>
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
                          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">Or type an exact token amount</div>
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
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Will burn</div>
                            <div className="font-mono text-lg font-bold text-[hsl(var(--og-blood))]">
                              {burnAmountUi !== null ? burnAmountUi.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"} tokens
                            </div>
                          </div>
                          <Button
                            onClick={executeBurn}
                            disabled={burning || !burnAmountRaw || burnAmountRaw <= BigInt(0)}
                            className="border border-[hsl(var(--og-blood))]/40 bg-[hsl(var(--og-blood))]/15 text-[hsl(var(--og-blood))] hover:bg-[hsl(var(--og-blood))]/25 disabled:opacity-40"
                          >
                            {burning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Burning…</> : <><Flame className="mr-2 h-4 w-4" /> Burn</>}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {burnSig && (
                  <a href={`https://solscan.io/tx/${burnSig}`} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-[hsl(var(--og-lime))] underline-offset-4 hover:underline">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Burned — view tx <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Sell all ── */}
          <TabsContent value="sellall" className="mt-4">
            <Card className="glass-card border-white/10 bg-black/30">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                    <span className="font-display text-sm font-bold uppercase tracking-wider">Sell all holdings</span>
                  </div>
                  <Badge variant="outline" className="border-white/15 text-[10px] text-muted-foreground">routes through Jupiter</Badge>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Swaps every token this wallet holds into one asset, in one go. Each token is quoted and swapped for its <span className="text-foreground">entire</span> balance — a bad or illiquid mint just gets skipped, it won't block the rest.
                </p>

                {burnScanning ? (
                  <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading balances…</div>
                ) : burnable.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                    No tokens found in this wallet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">Sell everything into</div>
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
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Tokens to sell</div>
                        <div className="font-mono text-2xl font-bold text-[hsl(var(--og-cyan))]">{sellableCount}</div>
                      </div>
                      <Button onClick={sellAll} disabled={selling || sellableCount === 0}
                        className="bg-[hsl(var(--og-cyan))] text-black hover:bg-[hsl(var(--og-cyan))]/90 disabled:opacity-40">
                        {selling
                          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Selling {sellProgress ? `${sellProgress.done}/${sellProgress.total}` : "…"}</>
                          : <><ArrowRightLeft className="mr-2 h-4 w-4" /> Sell all → {sellTarget}</>}
                      </Button>
                    </div>

                    {sellResults.length > 0 && (
                      <>
                        <Separator className="bg-white/10" />
                        <div className="space-y-1.5">
                          {sellResults.map((r) => (
                            <div key={r.mint} className="flex items-center justify-between font-mono text-xs">
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
