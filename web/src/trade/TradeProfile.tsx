import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Copy, Check, LogOut, Wallet, ExternalLink, Loader2, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { shortAddr, fmtUsd } from "./tradeFmt";

export default function TradeProfile() {
  const { publicKey, connected, wallets, select, connect, disconnect } = useWallet();
  const { connection } = useConnection();
  const { profile, user, loading: authLoading } = useAuth();
  const [sol, setSol] = useState<number | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);

  const addr = publicKey?.toBase58();
  const username = profile?.username || profile?.display_name || null;
  const avatar = profile?.avatar_url || null;

  useEffect(() => {
    if (!addr) {
      setSol(null);
      setWalletData(null);
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
        if (on) setWalletData(d);
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
    <div className="h-full overflow-y-auto bg-[#060606] px-4 py-4">
      <h1
        className="text-[26px] font-black tracking-tight"
        style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}
      >
        You
      </h1>
      <p className="mt-0.5 text-[12px] text-white/40">OrbitX identity · wallet · shortcuts</p>

      {/* OrbitX account */}
      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/15" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
              <User className="h-7 w-7 text-white/40" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {authLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/30" />
            ) : username ? (
              <>
                <p className="truncate text-lg font-bold tracking-tight">@{username}</p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {profile?.verified || profile?.is_official_account ? "Verified · " : ""}
                  OrbitX account
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-white/70">Not signed in</p>
                <p className="mt-0.5 text-[11px] text-white/40">Sign in to show username & avatar</p>
              </>
            )}
          </div>
        </div>

        {profile && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-black/40 px-2 py-2">
              <p className="text-[9px] text-white/30">Level</p>
              <p className="font-mono text-sm font-bold">{profile.current_level ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-black/40 px-2 py-2">
              <p className="text-[9px] text-white/30">Streak</p>
              <p className="font-mono text-sm font-bold">{profile.daily_streak ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-black/40 px-2 py-2">
              <p className="text-[9px] text-white/30">Rep</p>
              <p className="font-mono text-sm font-bold">{profile.reputation_score ?? "—"}</p>
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {user ? (
            <Link
              to="/profile"
              className="flex h-10 flex-1 items-center justify-center rounded-xl border border-white/12 text-xs font-semibold"
            >
              Edit profile
            </Link>
          ) : (
            <Link
              to="/auth"
              className="flex h-10 flex-1 items-center justify-center rounded-xl bg-white text-xs font-bold text-black"
            >
              Sign in to OrbitX
            </Link>
          )}
        </div>
      </div>

      {/* Wallet */}
      {!connected || !addr ? (
        <div className="mt-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <Wallet className="mx-auto h-9 w-9 text-white/25" />
          <p className="mt-3 text-sm text-white/55">Connect Phantom for balances & trading</p>
          <button
            type="button"
            onClick={() => void connectPhantom()}
            className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black"
          >
            Connect Phantom
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30">Wallet</p>
                <p className="mt-1 font-mono text-sm font-semibold">{shortAddr(addr, 6)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-full border border-white/10 p-2 text-white/50 hover:text-white"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="rounded-full border border-white/10 p-2 text-white/50 hover:text-white"
                >
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
                <p className="font-mono text-lg font-bold">{fmtUsd(walletData?.totalUsd)}</p>
              </div>
            </div>
            {walletData?.pnl && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-white/30">Realized</p>
                  <p
                    className={`font-mono text-xs ${
                      (walletData.pnl.realizedPnlUsd || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {fmtUsd(walletData.pnl.realizedPnlUsd)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30">Win rate</p>
                  <p className="font-mono text-xs">
                    {walletData.pnl.winRate != null
                      ? `${
                          Number(walletData.pnl.winRate) > 1
                            ? Number(walletData.pnl.winRate).toFixed(0)
                            : (Number(walletData.pnl.winRate) * 100).toFixed(0)
                        }%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30">Closed</p>
                  <p className="font-mono text-xs">{walletData.pnl.closedTrades ?? "—"}</p>
                </div>
              </div>
            )}
            <a
              href={`https://solscan.io/account/${addr}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white"
            >
              Solscan <ExternalLink className="h-3 w-3" />
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
            className="flex h-12 items-center justify-center rounded-2xl border border-white/15 text-sm font-semibold"
          >
            Portfolio hub · track wallets
          </Link>
          <Link
            to="/trade/desk"
            className="flex h-12 items-center justify-center rounded-2xl border border-white/15 text-sm font-semibold"
          >
            Trade desk
          </Link>
        </div>
      )}
    </div>
  );
}
