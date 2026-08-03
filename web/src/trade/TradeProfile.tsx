import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Copy, Check, LogOut, Wallet, ExternalLink, Loader2 } from "lucide-react";
import { shortAddr, fmtUsd } from "./tradeFmt";

export default function TradeProfile() {
  const { publicKey, connected, wallets, select, connect, disconnect } = useWallet();
  const { connection } = useConnection();
  const [sol, setSol] = useState<number | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pnl, setPnl] = useState<any>(null);

  const addr = publicKey?.toBase58();

  useEffect(() => {
    if (!addr) {
      setSol(null);
      setPnl(null);
      return;
    }
    let on = true;
    setLoadingBal(true);
    connection
      .getBalance(publicKey!)
      .then((lamports) => {
        if (on) setSol(lamports / 1e9);
      })
      .catch(() => {
        if (on) setSol(null);
      })
      .finally(() => {
        if (on) setLoadingBal(false);
      });

    fetch(`/api/ogdex/wallet?address=${encodeURIComponent(addr)}`)
      .then((r) => r.json())
      .then((d) => {
        if (on) setPnl(d);
      })
      .catch(() => {});

    return () => {
      on = false;
    };
  }, [addr, connection, publicKey]);

  const connectPhantom = async () => {
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (phantom) select(phantom.adapter.name as any);
    setTimeout(() => {
      connect().catch(() => {});
    }, 120);
  };

  const copy = () => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full overflow-y-auto bg-black px-4 py-6">
      <h1 className="text-base font-bold">Profile</h1>
      <p className="mt-1 text-xs text-white/40">Wallet, balances, and your trade desk</p>

      {!connected || !addr ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#050505] p-6 text-center">
          <Wallet className="mx-auto h-10 w-10 text-white/25" />
          <p className="mt-3 text-sm text-white/60">Connect Phantom to trade and track PnL</p>
          <button
            type="button"
            onClick={() => void connectPhantom()}
            className="mt-5 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black"
          >
            Connect Phantom
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#050505] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30">Wallet</p>
                <p className="mt-1 font-mono text-sm font-semibold">{shortAddr(addr, 6)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={copy} className="rounded-full border border-white/10 p-2 text-white/50 hover:text-white">
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => disconnect()} className="rounded-full border border-white/10 p-2 text-white/50 hover:text-white">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-black/50 px-3 py-2.5">
                <p className="text-[9px] text-white/30">SOL</p>
                <p className="font-mono text-lg font-bold">
                  {loadingBal ? <Loader2 className="h-4 w-4 animate-spin" /> : sol != null ? sol.toFixed(3) : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-black/50 px-3 py-2.5">
                <p className="text-[9px] text-white/30">Portfolio</p>
                <p className="font-mono text-lg font-bold">{fmtUsd(pnl?.totalUsd)}</p>
              </div>
            </div>
            {pnl?.pnl && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-white/30">Realized</p>
                  <p className={`font-mono text-xs ${(pnl.pnl.realizedPnlUsd || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmtUsd(pnl.pnl.realizedPnlUsd)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30">Win rate</p>
                  <p className="font-mono text-xs">
                    {pnl.pnl.winRate != null
                      ? `${Number(pnl.pnl.winRate) > 1 ? Number(pnl.pnl.winRate).toFixed(0) : (Number(pnl.pnl.winRate) * 100).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30">Closed</p>
                  <p className="font-mono text-xs">{pnl.pnl.closedTrades ?? "—"}</p>
                </div>
              </div>
            )}
            <a
              href={`https://solscan.io/account/${addr}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white"
            >
              View on Solscan <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <Link
            to={`/trade/wallet/${addr}`}
            className="flex h-12 items-center justify-center rounded-2xl bg-white text-sm font-bold text-black"
          >
            Open my portfolio
          </Link>
          <Link
            to="/trade/portfolio"
            className="flex h-12 items-center justify-center rounded-2xl border border-white/15 text-sm font-semibold text-white"
          >
            Portfolio hub · wallets & holders
          </Link>
          <Link
            to="/trade/desk"
            className="flex h-12 items-center justify-center rounded-2xl border border-white/15 text-sm font-semibold text-white"
          >
            Open trade desk
          </Link>
          <Link to="/profile" className="block text-center text-[11px] text-white/35 hover:text-white">
            OrbitX account profile →
          </Link>
        </div>
      )}
    </div>
  );
}
