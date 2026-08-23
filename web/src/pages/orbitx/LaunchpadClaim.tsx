/**
 * Orbitx Launchpad — CLAIM CREATOR FEES (both lanes, in-app, non-custodial).
 */
import { useState, useCallback, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Coins, Wallet, Loader2, RefreshCw, CheckCircle2, AlertTriangle, Rocket, HandCoins,
} from "lucide-react";
import { listByCreator, type OrbitxToken } from "@/lib/orbitx/registry";
import {
  getPumpClaimableSol,
  getCustomClaimable, buildCustomClaimTransactions, type CustomClaimable,
  buildPumpClaimWithSkim, buildPumpBuyTransaction, buildCustomSwapToSolWithSkim,
} from "@/lib/orbitx/claim";
import { CREATOR_FEE_BPS, TRADE_FEE_CREATOR_SHARE_PCT, TRADE_FEE_PLATFORM_SHARE_PCT, tradeFeeSharePerDollar } from "@/lib/platformFee";
import { DEFAULT_ROUTED_FEE_BPS, bpsToPct } from "@/lib/orbitx/feeRouting";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { confirmSentTransaction } from "@/lib/orbitx/sendWalletTx";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TabHero } from "./TabHero";
import { IndexOnChainTx, SolscanLink } from "@/components/onchain";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function LaunchpadClaim() {
  const { connection } = useConnection();
  const {
    publicKey,
    ready,
    localActive,
    label,
    shortAddress,
    sendTx,
    connectPhantom,
  } = useActiveTradingWallet();

  const [pumpSol, setPumpSol] = useState<number | null>(null);
  const [pumpLoading, setPumpLoading] = useState(false);
  const [pumpClaiming, setPumpClaiming] = useState(false);
  const [pumpSig, setPumpSig] = useState("");
  const [autoBuyback, setAutoBuyback] = useState(false);
  const [buybackMint, setBuybackMint] = useState("");

  const [tokens, setTokens] = useState<OrbitxToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [claimables, setClaimables] = useState<Record<string, CustomClaimable | "loading" | "error">>({});
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});
  const [claimSigs, setClaimSigs] = useState<Record<string, string>>({});

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
    if (ready && publicKey) { refreshPump(); refreshTokens(); }
  }, [ready, publicKey, refreshPump, refreshTokens]);

  const claimPump = async () => {
    if (!publicKey || !ready) return;
    setPumpClaiming(true);
    try {
      const plan = await buildPumpClaimWithSkim(connection, publicKey);
      if (plan.grossLamports <= 0) { toast.error("Nothing to claim right now"); return; }
      const sig = await sendTx(connection, plan.tx);
      await confirmSentTransaction(connection, sig, { commitment: "confirmed" });
      setPumpSig(sig);
      const netSol = plan.netLamports / LAMPORTS_PER_SOL;
      toast.success(`Claimed ${netSol.toFixed(4)} SOL (${bpsToPct(DEFAULT_ROUTED_FEE_BPS)}% platform fee routed)`);

      if (autoBuyback) {
        const mint = buybackMint || pumpTokens[0]?.mint_address || "";
        const buyLamports = plan.netLamports - Math.floor(0.01 * LAMPORTS_PER_SOL);
        if (!mint) {
          toast.error("Pick a coin to buy back");
        } else if (buyLamports <= 0) {
          toast.error("Claimed amount too small to buy back");
        } else {
          try {
            const buySol = buyLamports / LAMPORTS_PER_SOL;
            const buyTx = await buildPumpBuyTransaction(publicKey, mint, buySol);
            const buySig = await sendTx(connection, buyTx);
            await confirmSentTransaction(connection, buySig, { commitment: "confirmed" });
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
    if (!publicKey || !ready || !info || info === "loading" || info === "error") return;
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
        lastSig = await sendTx(connection, tx);
        await confirmSentTransaction(connection, lastSig, { blockhash, lastValidBlockHeight, commitment: "confirmed" });
      }
      try {
        const plan = await buildCustomSwapToSolWithSkim(connection, publicKey, t.mint_address, info.totalRaw);
        const swapSig = await sendTx(connection, plan.tx);
        await confirmSentTransaction(connection, swapSig, { commitment: "confirmed" });
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
      <TabHero
        icon={HandCoins}
        accent="gold"
        eyebrow="Claim · creator fees"
        title="Claim your creator fees"
        subtitle={`Same wallet you launched with. ${(CREATOR_FEE_BPS / 100).toFixed(2)}% on every buy & sell — you keep ${TRADE_FEE_CREATOR_SHARE_PCT}%, platform ${TRADE_FEE_PLATFORM_SHARE_PCT}%.`}
        actions={
          !ready ? (
            localActive ? (
              <Link to="/trade/wallets" className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(192,198,210,0.16)] px-3 py-1.5 text-xs text-[#A8B0BC]">
                <Wallet className="h-3.5 w-3.5" /> Set default wallet
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void connectPhantom()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(192,198,210,0.16)] px-3 py-1.5 text-xs text-[#A8B0BC]"
              >
                <Wallet className="h-3.5 w-3.5" /> Connect Phantom
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              <span className="ox-wallet-chip">
                <span className="ox-wallet-dot" />
                <span className="pf-mono text-[11px] font-bold text-white">{label || shortAddress || ""}</span>
              </span>
              <button type="button" className="ox-btn !px-2.5" onClick={() => { refreshPump(); refreshTokens(); }}>
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        }
      />

      {ready && (
        <>
          <div className="ox-claim-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-[#60A5FA]" />
                <span className="font-display text-sm font-bold uppercase tracking-wider text-white">Pump lane — pump.fun creator fees</span>
              </div>
              <span className="ox-lane-badge text-[#A8B0BC]">native pump.fun system</span>
            </div>
            <p className="mb-4 text-xs text-[#A8B0BC]">
              One claim collects your creator fees across <span className="text-white">all</span> coins this wallet created on pump.fun (bonding curve + graduated), including launches made here.
            </p>
            <div className="ox-claim-inner mb-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#A8B0BC]">
                <span>Trade fee (every buy &amp; sell)</span>
                <span className="pf-mono text-white">{(CREATOR_FEE_BPS / 100).toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between text-[#A8B0BC]">
                <span>Your share (buyer / creator)</span>
                <span className="pf-mono text-[#60A5FA]">{TRADE_FEE_CREATOR_SHARE_PCT}%</span>
              </div>
              <div className="flex items-center justify-between text-[#A8B0BC]">
                <span>Platform share (admin claim)</span>
                <span className="pf-mono text-white">{bpsToPct(DEFAULT_ROUTED_FEE_BPS)}%</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#A8B0BC]/80">
                Of every $1 in fees: ${tradeFeeSharePerDollar(TRADE_FEE_CREATOR_SHARE_PCT)} to you · ${tradeFeeSharePerDollar(TRADE_FEE_PLATFORM_SHARE_PCT)} to OrbitX (claimable on Admin Desk).
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={autoBuyback} onChange={(e) => setAutoBuyback(e.target.checked)} className="h-4 w-4 accent-[#F0C75E]" />
                <span className="font-semibold text-white">Claim &amp; auto-buyback</span>
              </label>
              {autoBuyback && (
                pumpTokens.length > 0 ? (
                  <select value={buybackMint || pumpTokens[0].mint_address} onChange={(e) => setBuybackMint(e.target.value)}
                    className="mt-2 w-full rounded-md border border-[rgba(192,198,210,0.16)] bg-[#0a0a0a] px-2 py-1.5 text-white">
                    {pumpTokens.map((t) => (
                      <option key={t.mint_address} value={t.mint_address}>${t.ticker} · {short(t.mint_address)}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-2 text-[11px] text-[#A8B0BC]">No pump launches from this wallet to buy back yet.</p>
                )
              )}
              {autoBuyback && <p className="mt-2 text-[11px] text-[#A8B0BC]">Right after claiming, your net SOL is used to market-buy the selected coin.</p>}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#A8B0BC]">Claimable now</div>
                <div className="pf-mono text-2xl font-bold text-[#F0C75E]">
                  {pumpLoading ? "…" : pumpSol === null ? "—" : `${pumpSol.toFixed(6)} SOL`}
                </div>
              </div>
              <button type="button" onClick={claimPump} disabled={pumpClaiming || pumpLoading || pumpSol === 0} className="pf-btn disabled:opacity-50">
                {pumpClaiming ? <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</> : <><Coins className="h-4 w-4" /> Claim pump.fun fees</>}
              </button>
            </div>
            {pumpSig && (
              <div className="mt-3">
                <IndexOnChainTx signature={pumpSig} kind="claim" />
                <SolscanLink signature={pumpSig} className="inline-flex items-center gap-1 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Claimed — view tx
                </SolscanLink>
              </div>
            )}
            {pumpTokens.length > 0 && (
              <>
                <div className="my-4 h-px bg-[rgba(192,198,210,0.16)]" />
                <div className="text-[10px] uppercase tracking-widest text-[#A8B0BC]">Your pump launches here</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pumpTokens.map((t) => (
                    <a key={t.mint_address} href={`https://pump.fun/${t.mint_address}`} target="_blank" rel="noopener noreferrer">
                      <span className="ox-lane-badge font-mono text-xs hover:border-[rgba(59,130,246,0.5)]">${t.ticker} · {short(t.mint_address)}</span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="ox-claim-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-[#F0C75E]" />
                <span className="font-display text-sm font-bold uppercase tracking-wider text-white">Custom lane — {(CREATOR_FEE_BPS / 100).toFixed(2)}% on-chain trading fees</span>
              </div>
              <span className="ox-lane-badge text-[#A8B0BC]">Token-2022 transfer fee</span>
            </div>
            <p className="mb-4 text-xs text-[#A8B0BC]">
              Every buy/sell withholds {(CREATOR_FEE_BPS / 100).toFixed(2)}% on-chain (paid in your token). Claiming withdraws it and swaps to <span className="text-white">SOL</span> — you keep {TRADE_FEE_CREATOR_SHARE_PCT}%, platform takes {TRADE_FEE_PLATFORM_SHARE_PCT}% (Admin Desk). Only your creator wallet can claim. If the pool is too thin to swap, you keep the tokens.
            </p>

            {tokensLoading ? (
              <div className="py-8 text-center text-sm text-[#A8B0BC]"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading your launches…</div>
            ) : customTokens.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[rgba(192,198,210,0.16)] p-6 text-center text-sm text-[#A8B0BC]">
                No custom-lane launches from this wallet yet.
                <div className="mt-3"><Link to="/orbitxlaunch/create/custom" className="ox-btn ox-btn--blue inline-flex"><Rocket className="h-3.5 w-3.5" /> Launch one</Link></div>
              </div>
            ) : (
              <div className="space-y-3">
                {customTokens.map((t) => {
                  const info = claimables[t.mint_address];
                  const busy = !!claiming[t.mint_address];
                  const sig = claimSigs[t.mint_address];
                  const isBuyback = t.fee_route !== "creator";
                  return (
                    <div key={t.mint_address} className="ox-claim-row">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          {t.logo_url ? <img src={t.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5"><Coins className="h-4 w-4 text-[#A8B0BC]" /></div>}
                          <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">{t.name} <span className="text-[#A8B0BC]">${t.ticker}</span>
                              {isBuyback && <span className="ox-lane-badge border-[rgba(255,77,109,0.4)] bg-[rgba(255,77,109,0.1)] text-[#ff4d6d]"><AlertTriangle className="mr-1 inline h-3 w-3" /> flagged — fees → OBX buyback</span>}
                            </div>
                            <SolscanLink mint={t.mint_address} className="pf-mono text-xs text-[#A8B0BC] hover:text-white">{short(t.mint_address)}</SolscanLink>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-widest text-[#A8B0BC]">Unclaimed</div>
                            <div className="pf-mono text-sm font-bold text-[#F0C75E]">
                              {info === "loading" || !info ? "…" : info === "error" ? "scan failed" : `${info.totalUi.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${t.ticker}`}
                            </div>
                          </div>
                          <button type="button" onClick={() => claimCustom(t)}
                            disabled={busy || isBuyback || !info || info === "loading" || info === "error" || info.totalRaw <= BigInt(0)}
                            className="pf-btn !px-4 !py-2 text-xs disabled:opacity-40">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
                          </button>
                        </div>
                      </div>
                      {sig && (
                        <div className="mt-2">
                          <IndexOnChainTx signature={sig} kind="claim" refId={t.mint_address} />
                          <SolscanLink signature={sig} className="inline-flex items-center gap-1 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Claimed — view tx
                          </SolscanLink>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
