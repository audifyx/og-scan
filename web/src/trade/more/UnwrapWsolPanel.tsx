import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useConnection } from "@solana/wallet-adapter-react";
import { Loader2, RefreshCw, Droplets, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  scanNativeSolAccounts,
  buildUnwrapTransactions,
  type NativeSolAccount,
} from "@/lib/orbitx/rescue";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { useTradeWalletPicker } from "../TradeWalletPicker";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function UnwrapWsolPanel() {
  const { connection } = useConnection();
  const {
    publicKey,
    ready,
    localActive,
    label,
    shortAddress,
    sendTx,
  } = useActiveTradingWallet();
  const { openPicker, picker } = useTradeWalletPicker();
  const [accounts, setAccounts] = useState<NativeSolAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");

  const scan = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const native = await scanNativeSolAccounts(connection, publicKey);
      setAccounts(native);
      if (!native.length) toast.message("No wrapped SOL accounts found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  const unwrap = async () => {
    if (!publicKey || !ready || !accounts.length) return;
    setBusy(true);
    try {
      const txs = buildUnwrapTransactions(publicKey, accounts);
      let last = "";
      for (const tx of txs) {
        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        last = await sendTx(connection, tx);
        await connection.confirmTransaction({ signature: last, blockhash, lastValidBlockHeight }, "confirmed");
      }
      setSig(last);
      const sol = accounts.reduce((s, a) => s + a.lamports, 0) / 1e9;
      toast.success(`Unwrapped ~${sol.toFixed(4)} SOL`);
      setAccounts([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected")) toast.error("Cancelled");
      else toast.error(msg || "Unwrap failed");
    } finally {
      setBusy(false);
    }
  };

  const total = accounts.reduce((s, a) => s + a.lamports, 0) / 1e9;

  if (!ready || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#050505] p-6 text-center">
        <Droplets className="mx-auto h-8 w-8 text-white/30" />
        <p className="mt-3 text-sm text-white/55">
          {localActive
            ? "Set a default local trading wallet to unwrap wSOL"
            : "Connect a wallet to unwrap wSOL"}
        </p>
        {localActive ? (
          <Link
            to="/trade/wallets"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white text-sm font-bold text-black"
          >
            Manage wallets
          </Link>
        ) : (
          <>
            {picker}
            <button
              type="button"
              onClick={openPicker}
              className="mt-4 h-11 w-full rounded-2xl bg-white text-sm font-bold text-black"
            >
              Connect wallet
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050505] p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/35">wSOL accounts</div>
          <div className="text-xl font-bold">{accounts.length}</div>
          {shortAddress ? (
            <div className="mt-0.5 font-mono text-[10px] text-white/40">{label || shortAddress}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void scan()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs text-white/70"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Scan
        </button>
      </div>
      <p className="mt-2 text-sm text-white/50">
        Closing returns wrapped balance + rent (~{total.toFixed(4)} SOL)
      </p>
      <button
        type="button"
        disabled={!accounts.length || busy}
        onClick={() => void unwrap()}
        className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
      >
        {busy ? "Unwrapping…" : `Unwrap ${total.toFixed(4)} SOL`}
      </button>
      {sig ? (
        <a
          href={`https://solscan.io/tx/${sig}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-white/50"
        >
          View tx <ExternalLink className="h-3 w-3" /> · {short(sig)}
        </a>
      ) : null}
    </div>
  );
}
