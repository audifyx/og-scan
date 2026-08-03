import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Loader2, RefreshCw, HandCoins, ExternalLink, Rocket } from "lucide-react";
import { toast } from "sonner";
import { listByCreator, type OrbitxToken } from "@/lib/orbitx/registry";
import {
  getPumpClaimableSol,
  getCustomClaimable,
  buildCustomClaimTransactions,
  buildPumpClaimWithSkim,
  buildCustomSwapToSolWithSkim,
  type CustomClaimable,
} from "@/lib/orbitx/claim";
import { DEFAULT_ROUTED_FEE_BPS, bpsToPct } from "@/lib/orbitx/feeRouting";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function CreatorFeeClaimPanel() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction, wallets, select, connect } = useWallet();
  const [pumpSol, setPumpSol] = useState<number | null>(null);
  const [pumpLoading, setPumpLoading] = useState(false);
  const [pumpClaiming, setPumpClaiming] = useState(false);
  const [pumpSig, setPumpSig] = useState("");
  const [tokens, setTokens] = useState<OrbitxToken[]>([]);
  const [claimables, setClaimables] = useState<Record<string, CustomClaimable | "loading" | "error">>({});
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});

  const connectPhantom = async () => {
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (phantom) select(phantom.adapter.name as any);
    setTimeout(() => {
      connect().catch(() => {});
    }, 120);
  };

  const refreshPump = useCallback(async () => {
    if (!publicKey) return;
    setPumpLoading(true);
    try {
      setPumpSol(await getPumpClaimableSol(connection, publicKey));
    } catch {
      setPumpSol(null);
    } finally {
      setPumpLoading(false);
    }
  }, [connection, publicKey]);

  const refreshTokens = useCallback(async () => {
    if (!publicKey) return;
    try {
      const list = await listByCreator(publicKey.toBase58());
      setTokens(list);
      for (const t of list.filter((x) => x.launch_type === "custom")) {
        setClaimables((c) => ({ ...c, [t.mint_address]: "loading" }));
        getCustomClaimable(connection, t.mint_address)
          .then((info) => setClaimables((c) => ({ ...c, [t.mint_address]: info })))
          .catch(() => setClaimables((c) => ({ ...c, [t.mint_address]: "error" })));
      }
    } catch {
      toast.error("Could not load launched tokens");
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      void refreshPump();
      void refreshTokens();
    }
  }, [connected, publicKey, refreshPump, refreshTokens]);

  const claimPump = async () => {
    if (!publicKey || !signTransaction) return;
    setPumpClaiming(true);
    try {
      const plan = await buildPumpClaimWithSkim(connection, publicKey);
      if (plan.grossLamports <= 0) {
        toast.error("Nothing to claim");
        return;
      }
      const signed = await signTransaction(plan.tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(sig, "confirmed");
      setPumpSig(sig);
      toast.success(
        `Claimed ${(plan.netLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL (${bpsToPct(DEFAULT_ROUTED_FEE_BPS)}% platform fee)`,
      );
      void refreshPump();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected")) toast.error("Cancelled");
      else toast.error(msg || "Claim failed");
    } finally {
      setPumpClaiming(false);
    }
  };

  const claimCustom = async (t: OrbitxToken) => {
    const info = claimables[t.mint_address];
    if (!publicKey || !signTransaction || !info || info === "loading" || info === "error") return;
    if (info.withdrawAuthority && info.withdrawAuthority !== publicKey.toBase58()) {
      toast.error("Only the fee authority can claim");
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
      try {
        const plan = await buildCustomSwapToSolWithSkim(connection, publicKey, t.mint_address, info.totalRaw);
        const signedSwap = await signTransaction(plan.tx);
        lastSig = await connection.sendRawTransaction(signedSwap.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
        await connection.confirmTransaction(lastSig, "confirmed");
        toast.success(`${t.ticker} claimed → ${(plan.netLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      } catch {
        toast.success(`${t.ticker} fees claimed as tokens`);
      }
      const fresh = await getCustomClaimable(connection, t.mint_address).catch(() => null);
      if (fresh) setClaimables((c) => ({ ...c, [t.mint_address]: fresh }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected")) toast.error("Cancelled");
      else toast.error(msg || "Claim failed");
    } finally {
      setClaiming((c) => ({ ...c, [t.mint_address]: false }));
    }
  };

  if (!connected || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#050505] p-6 text-center">
        <HandCoins className="mx-auto h-8 w-8 text-white/30" />
        <p className="mt-3 text-sm text-white/55">Connect the wallet you launched with to claim creator fees</p>
        <button
          type="button"
          onClick={() => void connectPhantom()}
          className="mt-4 h-11 w-full rounded-2xl bg-white text-sm font-bold text-black"
        >
          Connect Phantom
        </button>
      </div>
    );
  }

  const custom = tokens.filter((t) => t.launch_type === "custom");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#050505] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-white/70" />
            <span className="text-sm font-bold">Pump.fun creator fees</span>
          </div>
          <button
            type="button"
            onClick={() => {
              void refreshPump();
              void refreshTokens();
            }}
            className="rounded-full border border-white/15 p-2 text-white/60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pumpLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="mt-2 text-xs text-white/40">One claim collects fees across all pump coins this wallet created.</p>
        <div className="mt-3 text-2xl font-bold">
          {pumpLoading ? "…" : pumpSol != null ? `${pumpSol.toFixed(4)} SOL` : "—"}
        </div>
        <button
          type="button"
          disabled={pumpClaiming || !pumpSol}
          onClick={() => void claimPump()}
          className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
        >
          {pumpClaiming ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Claiming…
            </span>
          ) : (
            "Claim pump fees"
          )}
        </button>
        {pumpSig ? (
          <a
            href={`https://solscan.io/tx/${pumpSig}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-white/50"
          >
            View tx <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {custom.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-white/35">Custom lane (Token-2022)</div>
          {custom.map((t) => {
            const info = claimables[t.mint_address];
            const ui =
              info && info !== "loading" && info !== "error" ? `${info.totalUi.toFixed(4)} ${t.ticker}` : "—";
            return (
              <div key={t.mint_address} className="rounded-2xl border border-white/10 bg-[#050505] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold">${t.ticker}</div>
                    <div className="font-mono text-[10px] text-white/35">{short(t.mint_address)}</div>
                  </div>
                  <div className="text-right text-xs text-white/60">{info === "loading" ? "…" : ui}</div>
                </div>
                <button
                  type="button"
                  disabled={
                    claiming[t.mint_address] ||
                    !info ||
                    info === "loading" ||
                    info === "error" ||
                    (info !== "error" && info.totalRaw <= BigInt(0))
                  }
                  onClick={() => void claimCustom(t)}
                  className="mt-3 h-10 w-full rounded-xl bg-white/90 text-xs font-bold text-black disabled:opacity-40"
                >
                  {claiming[t.mint_address] ? "Claiming…" : "Claim fees"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
