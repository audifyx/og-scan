/**
 * Orbitx Launchpad — CLAIM CREATOR FEES (both lanes, in-app, non-custodial).
 *
 * Connect the SAME WALLET you launched with:
 *  - Pump lane: claims pump.fun creator fees (the Pump program's own
 *    collectCreatorFee system — one claim collects across ALL your pump
 *    coins, bonding curve + graduated).
 *  - Custom lane: claims the 0.30% Token-2022 transfer fee accrued on every
 *    buy/sell of tokens you launched. Paid in your own token; swap anytime.
 */
import { useState, useCallback, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Coins, Wallet, Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle, Rocket, HandCoins,
} from "lucide-react";
import { listByCreator, type OrbitxToken } from "@/lib/orbitx/registry";
import {
  getPumpClaimableSol, buildPumpClaimTransaction,
  getCustomClaimable, buildCustomClaimTransactions, type CustomClaimable,
  buildPumpClaimWithSkim, buildPumpBuyTransaction, buildCustomSwapToSolWithSkim,
} from "@/lib/orbitx/claim";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { DEFAULT_ROUTED_FEE_BPS, bpsToPct } from "@/lib/orbitx/feeRouting";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function LaunchpadClaim() {
  const { connected, publicKey, connect, wallets, select, signTransaction } = useWallet();
  const { connection } = useConnection();

  /* pump lane */
  const [pumpSol, setPumpSol] = useState<number | null>(null);
  const [pumpLoading, setPumpLoading] = useState(false);
  const [pumpClaiming, setPumpClaiming] = useState(false);
  const [pumpSig, setPumpSig] = useState("");
  const [autoBuyback, setAutoBuyback] = useState(false);
  const [buybackMint, setBuybackMint] = useState("");

  /* custom lane */
  const [tokens, setTokens] = useState<OrbitxToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [claimables, setClaimables] = useState<Record<string, CustomClaimable | "loading" | "error">>({});
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});
  const [claimSigs, setClaimSigs] = useState<Record<string, string>>({});

  const handleConnect = async () => {
    try {
      if (!wallets.length) return toast.error("No Solana wallet found — install Phantom");
      select(wallets[0].adapter.name);
      await connect();
    } catch { /* user closed modal */ }
  };

  const refreshPump = useCallback(async () => {
    if (!publicKey) return;
    setPumpLoading(true);
    try {
      setPumpSol(await getPumpClaimableSol(connection, publicKey));
    } catch (e) {
      console.error("[claim] pump balance", e);
      setPumpSol(null);
    } finally {
      setPumpLoading(false);
    }
  }, [connection, publicKey]);

  const refreshTokens = useCallback(async () => {
    if (!publicKey) return;
    setTokensLoading(true);
    try {
      const list = await listByCreator(publicKey.toBase58());
      setTokens(list);
      const custom = list.filter((t) => t.launch_type === "custom");
      for (const t of custom) {
        setClaimables((c) => ({ ...c, [t.mint_address]: "loading" }));
        getCustomClaimable(connection, t.mint_address)
          .then((info) => setClaimables((c) => ({ ...c, [t.mint_address]: info })))
          .catch((e) => { console.error("[claim] scan", t.mint_address, e); setClaimables((c) => ({ ...c, [t.mint_address]: "error" })); });
      }
    } catch (e) {
      console.error("[claim] registry", e);
      toast.error("Could not load your launched tokens");
    } finally {
      setTokensLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (connected && publicKey) { refreshPump(); refreshTokens(); }
  }, [connected, publicKey, refreshPump, refreshTokens]);

  const claimPump = async () => {
    if (!publicKey || !signTransaction) return;
    setPumpClaiming(true);
    try {
      // Claim + 2.5% platform skim, atomic in one signed tx.
      const plan = await buildPumpClaimWithSkim(connection, publicKey);
      if (plan.grossLamports <= 0) { toast.error("Nothing to claim right now"); return; }
      const signed = await signTransaction(plan.tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(sig, "confirmed");
      setPumpSig(sig);
      const netSol = plan.netLamports / LAMPORTS_PER_SOL;
      toast.success(`Claimed ${netSol.toFixed(4)} SOL (${bpsToPct(DEFAULT_ROUTED_FEE_BPS)}% platform fee routed)`);

      // Optional: use the freshly-claimed SOL to buy back your own coin.
      if (autoBuyback) {
        const mint = buybackMint || pumpTokens[0]?.mint_address || "";
        const buyLamports = plan.netLamports - Math.floor(0.01 * LAMPORTS_PER_SOL); // leave gas
        if (!mint) {
          toast.error("Pick a coin to buy back");
        } else if (buyLamports <= 0) {
          toast.error("Claimed amount too small to buy back");
        } else {
          try {
            const buySol = buyLamports / LAMPORTS_PER_SOL;
            const buyTx = await buildPumpBuyTransaction(publicKey, mint, buySol);
            const signedBuy = await signTransaction(buyTx);
            const buySig = await connection.sendRawTransaction(signedBuy.serialize(), { skipPreflight: false, maxRetries: 3 });
            await connection.confirmTransaction(buySig, "confirmed");
            toast.success(`Bought back ${buySol.toFixed(4)} SOL of your coin`);
          } catch (e) {
            toast.error(e instanceof Error ? `Buyback failed: ${e.message}` : "Buyback failed");
          }
        }
      }
      refreshPump();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) toast.error("Transaction cancelled");
      else toast.error(msg || "Claim failed");
    } finally {
      setPumpClaiming(false);
    }
  };

  const claimCustom = async (t: OrbitxToken) => {
    const info = claimables[t.mint_address];
    if (!publicKey || !signTransaction || !info || info === "loading" || info === "error") return;
    if (info.withdrawAuthority && info.withdrawAuthority !== publicKey.toBase58()) {
      toast.error("Only the fee authority wallet can claim this token's fees");
      return;
    }
    setClaiming((c) => ({ ...c, [t.mint_address]: true }));
    try {
      const txs = buildCustomClaimTransactions(t.mint_address, publicKey, info);
      let lastSig = "";
      for (const tx of txs) {
        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        const signed = await signTransaction(tx);
        lastSig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
        await connection.confirmTransaction({ signature: lastSig, blockhash, lastValidBlockHeight }, "confirmed");
      }
      // Custom-lane fees accrue in-token; swap the withdrawn amount to SOL
      // (+2.5% platform skim) so the creator is paid in SOL like the pump lane.
      try {
        const plan = await buildCustomSwapToSolWithSkim(connection, publicKey, t.mint_address, info.totalRaw);
        const signedSwap = await signTransaction(plan.tx);
        const swapSig = await connection.sendRawTransaction(signedSwap.serialize(), { skipPreflight: false, maxRetries: 3 });
        await connection.confirmTransaction(swapSig, "confirmed");
        lastSig = swapSig;
        toast.success(`${t.ticker} fees claimed & swapped to ${(plan.netLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      } catch (e) {
        const em = e instanceof Error ? e.message : "no swap route";
        toast.success(`${t.ticker} fees claimed as tokens (SOL swap unavailable: ${em})`);
      }
      setClaimSigs((c) => ({ ...c, [t.mint_address]: lastSig }));
      const fresh = await getCustomClaimable(connection, t.mint_address).catch(() => null);
      if (fresh) setClaimables((c) => ({ ...c, [t.mint_address]: fresh }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) toast.error("Transaction cancelled");
      else toast.error(msg || "Claim failed");
    } finally {
      setClaiming((c) => ({ ...c, [t.mint_address]: false }));
    }
  };

  const customTokens = tokens.filter((t) => t.launch_type === "custom");
  const pumpTokens = tokens.filter((t) => t.launch_type === "pump");

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="glass-card relative overflow-hidden rounded-2xl border border-white/10 p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[hsl(var(--og-gold))]/10 blur-3xl" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge className="border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10 text-[hsl(var(--og-gold))]"><HandCoins className="mr-1 h-3 w-3" /> Creator Fees</Badge>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Claim your creator fees</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Connect the <span className="text-foreground">same wallet you launched with</span>. You earn {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every buy and sell — pump.fun's creator rate — on both lanes.
            </p>
          </div>
          {!connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--pf-border))] px-3 py-1.5 text-xs text-[hsl(var(--pf-muted))]"><Wallet className="h-3.5 w-3.5" /> Connect via the wallet button up top</span>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-[hsl(var(--og-lime))]/40 font-mono text-[hsl(var(--og-lime))]">{publicKey ? short(publicKey.toBase58()) : ""}</Badge>
              <Button variant="outline" size="sm" className="border-white/15" onClick={() => { refreshPump(); refreshTokens(); }}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {connected && (
        <>
          {/* ── Pump lane ── */}
          <Card className="glass-card border-white/10 bg-black/30">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
                  <span className="font-display text-sm font-bold uppercase tracking-wider">Pump lane — pump.fun creator fees</span>
                </div>
                <Badge variant="outline" className="border-white/15 text-[10px] text-muted-foreground">native pump.fun system</Badge>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                One claim collects your creator fees across <span className="text-foreground">all</span> coins this wallet created on pump.fun (bonding curve + graduated), including launches made here.
              </p>
              <div className="mb-4 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Platform fee on claim</span>
                  <span className="font-mono text-foreground">{bpsToPct(DEFAULT_ROUTED_FEE_BPS)}%</span>
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={autoBuyback} onChange={(e) => setAutoBuyback(e.target.checked)}
                    className="h-4 w-4 accent-[hsl(var(--og-gold))]" />
                  <span className="font-semibold text-foreground">Claim &amp; auto-buyback</span>
                </label>
                {autoBuyback && (
                  pumpTokens.length > 0 ? (
                    <select value={buybackMint || pumpTokens[0].mint_address} onChange={(e) => setBuybackMint(e.target.value)}
                      className="mt-2 w-full rounded-md border border-white/10 bg-black/50 px-2 py-1.5 text-foreground">
                      {pumpTokens.map((t) => (
                        <option key={t.mint_address} value={t.mint_address}>${t.ticker} · {short(t.mint_address)}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">No pump launches from this wallet to buy back yet.</p>
                  )
                )}
                {autoBuyback && <p className="mt-2 text-[11px] text-muted-foreground">Right after claiming, your net SOL is used to market-buy the selected coin.</p>}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Claimable now</div>
                  <div className="font-mono text-2xl font-bold text-[hsl(var(--og-gold))]">
                    {pumpLoading ? "…" : pumpSol === null ? "—" : `${pumpSol.toFixed(6)} SOL`}
                  </div>
                </div>
                <Button onClick={claimPump} disabled={pumpClaiming || pumpLoading || pumpSol === 0}
                  className="bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90 disabled:opacity-50">
                  {pumpClaiming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming…</> : <><Coins className="mr-2 h-4 w-4" /> Claim pump.fun fees</>}
                </Button>
              </div>
              {pumpSig && (
                <a href={`https://solscan.io/tx/${pumpSig}`} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-[hsl(var(--og-lime))] underline-offset-4 hover:underline">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Claimed — view tx <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {pumpTokens.length > 0 && (
                <>
                  <Separator className="my-4 bg-white/10" />
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your pump launches here</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pumpTokens.map((t) => (
                      <a key={t.mint_address} href={`https://pump.fun/${t.mint_address}`} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="border-white/15 font-mono text-xs hover:border-[hsl(var(--og-cyan))]/50">${t.ticker} · {short(t.mint_address)}</Badge>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Custom lane ── */}
          <Card className="glass-card border-white/10 bg-black/30">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[hsl(var(--og-gold))]" />
                  <span className="font-display text-sm font-bold uppercase tracking-wider">Custom lane — {(CREATOR_FEE_BPS / 100).toFixed(2)}% on-chain trading fees</span>
                </div>
                <Badge variant="outline" className="border-white/15 text-[10px] text-muted-foreground">Token-2022 transfer fee</Badge>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Every buy/sell of your custom tokens withholds {(CREATOR_FEE_BPS / 100).toFixed(2)}% on-chain (paid in your token). Claiming withdraws it and swaps it to <span className="text-foreground">SOL</span>, minus a {bpsToPct(DEFAULT_ROUTED_FEE_BPS)}% platform fee. Only your creator wallet can claim. If the pool is too thin to swap, you keep the tokens.
              </p>

              {tokensLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading your launches…</div>
              ) : customTokens.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                  No custom-lane launches from this wallet yet.
                  <div className="mt-3"><Link to="/orbitxlaunch/create/custom"><Button variant="outline" size="sm" className="border-white/15"><Rocket className="mr-2 h-3.5 w-3.5" /> Launch one</Button></Link></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {customTokens.map((t) => {
                    const info = claimables[t.mint_address];
                    const busy = !!claiming[t.mint_address];
                    const sig = claimSigs[t.mint_address];
                    const isBuyback = t.fee_route !== "creator";
                    return (
                      <div key={t.mint_address} className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            {t.logo_url ? <img src={t.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5"><Coins className="h-4 w-4 text-muted-foreground" /></div>}
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold">{t.name} <span className="text-muted-foreground">${t.ticker}</span>
                                {isBuyback && <Badge className="border-[hsl(var(--og-blood))]/40 bg-[hsl(var(--og-blood))]/10 text-[10px] text-[hsl(var(--og-blood))]"><AlertTriangle className="mr-1 h-3 w-3" /> flagged — fees → OBX buyback</Badge>}
                              </div>
                              <a href={`https://solscan.io/token/${t.mint_address}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-muted-foreground hover:text-foreground">{short(t.mint_address)}</a>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Unclaimed</div>
                              <div className="font-mono text-sm font-bold text-[hsl(var(--og-gold))]">
                                {info === "loading" || !info ? "…" : info === "error" ? "scan failed" : `${info.totalUi.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${t.ticker}`}
                              </div>
                            </div>
                            <Button size="sm" onClick={() => claimCustom(t)}
                              disabled={busy || isBuyback || !info || info === "loading" || info === "error" || info.totalRaw <= BigInt(0)}
                              className="bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90 disabled:opacity-40">
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
                            </Button>
                          </div>
                        </div>
                        {sig && (
                          <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-[hsl(var(--og-lime))] underline-offset-4 hover:underline">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Claimed — view tx <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
