import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useConnection } from "@solana/wallet-adapter-react";
import { Loader2, RefreshCw, Coins, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  scanEmptyTokenAccounts,
  totalReclaimableSol,
  buildCloseAccountsTransactions,
  type EmptyTokenAccount,
} from "@/lib/orbitx/rescue";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function RentRefundPanel() {
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
  const [accounts, setAccounts] = useState<EmptyTokenAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [sig, setSig] = useState("");

  const scan = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const empty = await scanEmptyTokenAccounts(connection, publicKey);
      setAccounts(empty);
      if (!empty.length) toast.message("No empty token accounts — nothing to reclaim");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  const reclaim = async () => {
    if (!publicKey || !ready || !accounts.length) return;
    setClaiming(true);
    try {
      const txs = buildCloseAccountsTransactions(publicKey, accounts);
      let last = "";
      for (const tx of txs) {
        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        last = await sendTx(connection, tx);
        await connection.confirmTransaction({ signature: last, blockhash, lastValidBlockHeight }, "confirmed");
      }
      setSig(last);
      toast.success(`Reclaimed ~${totalReclaimableSol(accounts).toFixed(4)} SOL`);
      setAccounts([]);
      await scan();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected")) toast.error("Cancelled");
      else toast.error(msg || "Reclaim failed");
    } finally {
      setClaiming(false);
    }
  };

  const sol = totalReclaimableSol(accounts);

  if (!ready || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#050505] p-6 text-center">
        <Coins className="mx-auto h-8 w-8 text-white/30" />
        <p className="mt-3 text-sm text-white/55">
          {localActive
            ? "Set a default local trading wallet to reclaim rent"
            : "Connect Phantom to scan empty ATAs and reclaim rent"}
        </p>
        {localActive ? (
          <Link
            to="/trade/wallets"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white text-sm font-bold text-black"
          >
            Manage wallets
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void connectPhantom()}
            className="mt-4 h-11 w-full rounded-2xl bg-white text-sm font-bold text-black"
          >
            Connect Phantom
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#050505] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/35">Wallet</div>
            <div className="font-mono text-sm">{shortAddress || short(publicKey.toBase58())}</div>
            {label ? <div className="mt-0.5 text-[10px] text-white/40">{label}</div> : null}
          </div>
          <button
            type="button"
            onClick={() => void scan()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs text-white/70 hover:bg-white/5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Scan
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/35">Empty accounts</div>
            <div className="mt-1 text-xl font-bold">{accounts.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/35">Reclaimable</div>
            <div className="mt-1 text-xl font-bold">{sol.toFixed(4)} SOL</div>
          </div>
        </div>
        <button
          type="button"
          disabled={!accounts.length || claiming}
          onClick={() => void reclaim()}
          className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
        >
          {claiming ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Closing accounts…
            </span>
          ) : (
            `Reclaim ${sol.toFixed(4)} SOL`
          )}
        </button>
        {sig ? (
          <a
            href={`https://solscan.io/tx/${sig}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
          >
            View last tx <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      {accounts.length > 0 && (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#050505] p-2">
          {accounts.map((a) => (
            <div
              key={a.pubkey.toBase58()}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-white/60"
            >
              <span className="font-mono">{short(a.mint)}</span>
              <span>{(a.lamports / 1e9).toFixed(4)} SOL</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
