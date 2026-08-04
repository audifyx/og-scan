import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useConnection } from "@solana/wallet-adapter-react";
import { Loader2, RefreshCw, Flame, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  scanBurnableTokens,
  resolvePercentBurnAmount,
  parseManualBurnAmount,
  buildBurnTransaction,
  burnReclaimsRent,
  fetchBurnTokenMeta,
  type BurnableToken,
} from "@/lib/orbitx/rescue";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const PRESETS = [10, 25, 50, 75, 100];

export default function TokenBurnerPanel() {
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
  const [tokens, setTokens] = useState<BurnableToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [percent, setPercent] = useState<number | null>(100);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const [meta, setMeta] = useState<Record<string, { symbol: string }>>({});

  const scan = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const list = await scanBurnableTokens(connection, publicKey);
      setTokens(list);
      if (!list.length) toast.message("No burnable token balances");
      else if (!selected) setSelected(list[0].mint);
      const next: Record<string, { symbol: string }> = {};
      await Promise.all(
        list.slice(0, 20).map(async (t) => {
          const m = await fetchBurnTokenMeta(t.mint);
          next[t.mint] = { symbol: m.symbol };
        }),
      );
      setMeta((prev) => ({ ...prev, ...next }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, selected]);

  const token = tokens.find((t) => t.mint === selected) || null;

  const amountRaw = (() => {
    if (!token) return BigInt(0);
    if (manual.trim()) {
      try {
        return parseManualBurnAmount(manual, token.decimals);
      } catch {
        return BigInt(0);
      }
    }
    if (percent != null) return resolvePercentBurnAmount(token, percent);
    return BigInt(0);
  })();

  const burn = async () => {
    if (!publicKey || !ready || !token || amountRaw <= BigInt(0)) return;
    if (amountRaw > token.balanceRaw) {
      toast.error("Amount exceeds balance");
      return;
    }
    setBusy(true);
    try {
      const { tx, rentLamports } = await buildBurnTransaction(connection, publicKey, token, amountRaw);
      tx.feePayer = publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      const s = await sendTx(connection, tx);
      await connection.confirmTransaction({ signature: s, blockhash, lastValidBlockHeight }, "confirmed");
      setSig(s);
      const rentNote =
        burnReclaimsRent(token, amountRaw) && rentLamports
          ? ` · +${(rentLamports / 1e9).toFixed(4)} SOL rent`
          : "";
      toast.success(`Burned${rentNote}`);
      void scan();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected")) toast.error("Cancelled");
      else toast.error(msg || "Burn failed");
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#050505] p-6 text-center">
        <Flame className="mx-auto h-8 w-8 text-white/30" />
        <p className="mt-3 text-sm text-white/55">
          {localActive
            ? "Set a default local trading wallet to burn tokens"
            : "Connect Phantom to burn tokens from your wallet"}
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

  const balUi = token ? Number(token.balanceRaw) / 10 ** token.decimals : 0;
  const burnUi = token ? Number(amountRaw) / 10 ** token.decimals : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#050505] p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold">Token Burner</span>
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
            Load holdings
          </button>
        </div>

        {tokens.length > 0 ? (
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-3 w-full rounded-xl border border-white/15 bg-black px-3 py-2.5 text-sm"
          >
            {tokens.map((t) => (
              <option key={t.mint} value={t.mint}>
                {meta[t.mint]?.symbol || short(t.mint)} ·{" "}
                {(Number(t.balanceRaw) / 10 ** t.decimals).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-3 text-xs text-white/40">Scan to load burnable balances</p>
        )}

        {token && (
          <>
            <div className="mt-3 text-xs text-white/45">
              Balance: {balUi.toLocaleString(undefined, { maximumFractionDigits: 6 })} · Mint {short(token.mint)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPercent(p);
                    setManual("");
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    percent === p && !manual
                      ? "bg-white text-black"
                      : "border border-white/15 text-white/60"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <input
              value={manual}
              onChange={(e) => {
                setManual(e.target.value);
                setPercent(null);
              }}
              placeholder="Or exact token amount"
              className="mt-3 h-11 w-full rounded-xl border border-white/15 bg-black px-3 text-sm outline-none focus:border-white/40"
            />
            <p className="mt-2 text-xs text-white/40">
              Will burn {burnUi.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              {burnReclaimsRent(token, amountRaw) ? " · closes ATA & refunds rent" : ""}
            </p>
            <button
              type="button"
              disabled={busy || amountRaw <= BigInt(0)}
              onClick={() => void burn()}
              className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Burning…
                </span>
              ) : (
                "Burn tokens"
              )}
            </button>
          </>
        )}
        {sig ? (
          <a
            href={`https://solscan.io/tx/${sig}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-white/50"
          >
            View tx <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
