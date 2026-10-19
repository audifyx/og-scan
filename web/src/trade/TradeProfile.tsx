import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PublicKey, Connection } from "@solana/web3.js";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";
import {
  Copy, Check, LogOut, Wallet, ExternalLink, Loader2, User, KeyRound,
  Download, TrendingUp, TrendingDown, Eye, EyeOff, ChevronRight, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { useTradeWalletPicker } from "./TradeWalletPicker";
import { shortAddr, fmtUsd } from "./tradeFmt";
import { toast } from "sonner";

interface Holding {
  mint: string;
  symbol?: string;
  name?: string;
  icon?: string;
  amount?: number;
  uiAmount?: number;
  priceUsd?: number;
  valueUsd?: number;
  change24h?: number;
}

export default function TradeProfile() {
  const { address: walletAddress, connected } = useActiveTradingWallet();
  const connection = useMemo(() => new Connection(browserWalletRpcUrl(), "confirmed"), []);
  const publicKey = walletAddress ? new PublicKey(walletAddress) : null;
  const { profile, user, loading: authLoading } = useAuth();
  const {
    address: activeAddr,
    localActive,
    label: activeLabel,
    localWallets,
    defaultWallet,
    mode: tradeMode,
  } = useActiveTradingWallet();
  const { openPicker, picker } = useTradeWalletPicker();
  const [sol, setSol] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);
  const [hideValues, setHideValues] = useState(false);

  const addr = activeAddr || publicKey?.toBase58();
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
    let pk: PublicKey;
    try {
      pk = new PublicKey(addr);
    } catch {
      setLoadingBal(false);
      return;
    }
    connection
      .getBalance(pk)
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

    // SOL price
    fetch("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112")
      .then((r) => r.json())
      .then((d) => {
        const p = d?.pairs?.[0]?.priceUsd;
        if (on && p) setSolPrice(Number(p));
      })
      .catch(() => {});

    return () => {
      on = false;
    };
  }, [addr, connection]);

  const holdings: Holding[] = useMemo(() => {
    const h = walletData?.holdings || walletData?.tokens || [];
    return (Array.isArray(h) ? h : []).map((t: any) => ({
      mint: t.mint || t.address || "",
      symbol: t.symbol || "???",
      name: t.name || t.symbol || "Unknown",
      icon: t.icon || t.image || t.logoURI,
      amount: t.uiAmount ?? t.amount ?? 0,
      priceUsd: t.priceUsd ?? t.price ?? 0,
      valueUsd: t.valueUsd ?? (t.uiAmount ?? 0) * (t.priceUsd ?? 0),
      change24h: t.change24h ?? t.priceChange24h ?? 0,
    })).filter((t) => t.mint && (t.valueUsd || 0) > 0.01);
  }, [walletData]);

  const totalValue = useMemo(() => {
    const holdingsValue = holdings.reduce((s, h) => s + (h.valueUsd || 0), 0);
    const solValue = (sol || 0) * (solPrice || 0);
    return holdingsValue + solValue;
  }, [holdings, sol, solPrice]);

  const copy = () => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Address copied");
  };

  const exportWallet = () => {
    if (!addr) return;
    const data = {
      address: addr,
      label: activeLabel || "OrbitX in-app wallet",
      exportedAt: new Date().toISOString(),
      sol: sol,
      solPriceUsd: solPrice,
      totalValueUsd: totalValue,
      holdings: holdings.map((h) => ({
        mint: h.mint,
        symbol: h.symbol,
        name: h.name,
        amount: h.amount,
        priceUsd: h.priceUsd,
        valueUsd: h.valueUsd,
      })),
      pnl: walletData?.pnl || null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbitx-wallet-${addr.slice(0, 6)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Wallet data exported");
  };

  const displayValue = (v: number | null | undefined, prefix = "$") => {
    if (hideValues) return "••••••";
    if (v == null) return "—";
    return `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="h-full overflow-y-auto bg-[#08080c] px-4 pb-8 pt-4">
      {/* Hero header with gradient */}
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-violet-600/30 via-[#0a0a12] to-cyan-500/20 p-5">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/25 shadow-lg"
            />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/40 to-cyan-500/40 ring-2 ring-white/20">
              <User className="h-8 w-8 text-white/80" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {authLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white/50" />
            ) : username ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="truncate text-xl font-black tracking-tight text-white">@{username}</p>
                  {(profile?.verified || profile?.is_official_account) && (
                    <Sparkles className="h-4 w-4 text-cyan-300 shrink-0" />
                  )}
                </div>
                <p className="mt-1 text-xs text-white/70">OrbitX account</p>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-white">Not signed in</p>
                <Link to="/auth" className="mt-1 inline-block text-xs text-cyan-300 underline">
                  Sign in to OrbitX
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setHideValues(!hideValues)}
            className="rounded-full border border-white/20 bg-black/40 p-2.5 text-white/70 hover:text-white"
            title={hideValues ? "Show values" : "Hide values"}
          >
            {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Level / Streak / Rep */}
        {profile && (
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Level", value: profile.current_level ?? "—" },
              { label: "Streak", value: profile.daily_streak ?? "—" },
              { label: "Rep", value: profile.reputation_score ?? "—" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/15 bg-black/50 backdrop-blur px-3 py-3 text-center"
              >
                <p className="text-[10px] uppercase tracking-widest text-white/60">{s.label}</p>
                <p className="mt-1 font-mono text-lg font-black text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wallet card */}
      <div className="mt-4 rounded-3xl border border-white/15 bg-white/[0.06] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">In-App Wallet</p>
              <p className="text-[11px] text-white/60">One wallet across OrbitX</p>
            </div>
          </div>
          {addr && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 font-mono text-xs text-white/80 hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {shortAddr(addr, 4)}
            </button>
          )}
        </div>

        {!addr ? (
          <div className="mt-4 text-center py-4">
            <p className="text-sm text-white/70">Connect your in-app wallet to see balances</p>
            {picker}
            <button
              type="button"
              onClick={openPicker}
              className="mt-3 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black"
            >
              Connect wallet
            </button>
          </div>
        ) : (
          <>
            {/* Total value hero */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-black/60 to-black/30 p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/60">Total value</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-white">
                {loadingBal ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  displayValue(totalValue)
                )}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/60">SOL</p>
                  <p className="mt-0.5 font-mono text-base font-bold text-white">
                    {hideValues ? "••••" : sol != null ? sol.toFixed(3) : "—"}
                    {solPrice && !hideValues && (
                      <span className="ml-1.5 text-xs font-normal text-white/60">
                        ≈ {displayValue((sol || 0) * solPrice)}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/60">Tokens</p>
                  <p className="mt-0.5 font-mono text-base font-bold text-white">
                    {hideValues ? "••••" : holdings.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={exportWallet}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] text-xs font-bold text-white hover:bg-white/[0.1]"
              >
                <Download className="h-4 w-4" /> Export wallet
              </button>
              <a
                href={`https://solscan.io/account/${addr}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] text-xs font-bold text-white hover:bg-white/[0.1]"
              >
                Solscan <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>


          </>
        )}
      </div>

      {/* Holdings */}
      {addr && holdings.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-white">What you hold</h2>
            <Link
              to={`/trade/wallet/${addr}`}
              className="inline-flex items-center gap-1 text-xs text-cyan-300"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-2 space-y-2">
            {holdings.slice(0, 8).map((h) => (
              <div
                key={h.mint}
                className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-3"
              >
                {h.icon ? (
                  <img
                    src={h.icon}
                    alt={h.symbol}
                    className="h-10 w-10 rounded-full object-cover bg-white/10"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-bold text-white/70">
                    {(h.symbol || "?").slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{h.symbol}</p>
                  <p className="truncate text-[11px] text-white/60">
                    {hideValues ? "••••" : Number(h.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{displayValue(h.valueUsd)}</p>
                  <p className={`text-[11px] flex items-center justify-end gap-0.5 ${((h.change24h || 0) >= 0) ? "text-emerald-300" : "text-red-300"}`}>
                    {(h.change24h || 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {((h.change24h || 0) >= 0 ? "+" : "")}{(h.change24h || 0).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PnL */}
      {addr && walletData?.pnl && (
        <div className="mt-4 rounded-3xl border border-white/15 bg-white/[0.06] p-5">
          <h2 className="text-sm font-bold text-white">Performance</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-black/50 border border-white/10 px-2 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/60">Realized</p>
              <p className={`mt-1 font-mono text-sm font-bold ${(walletData.pnl.realizedPnlUsd || 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {hideValues ? "••••" : fmtUsd(walletData.pnl.realizedPnlUsd)}
              </p>
            </div>
            <div className="rounded-2xl bg-black/50 border border-white/10 px-2 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/60">Win rate</p>
              <p className="mt-1 font-mono text-sm font-bold text-white">
                {walletData.pnl.winRate != null
                  ? `${(Number(walletData.pnl.winRate) > 1 ? Number(walletData.pnl.winRate) : Number(walletData.pnl.winRate) * 100).toFixed(0)}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-black/50 border border-white/10 px-2 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/60">Trades</p>
              <p className="mt-1 font-mono text-sm font-bold text-white">
                {walletData.pnl.closedTrades ?? "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trading wallets manager */}
      <div className="mt-4 rounded-3xl border border-white/15 bg-white/[0.06] p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
            <KeyRound className="h-5 w-5 text-white/70" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Trading wallets</p>
            <p className="mt-0.5 text-[11px] text-white/60">
              {localWallets.length
                ? `${localWallets.length} local · ${tradeMode === "local" ? "signing local" : "connected mode"}`
                : "Manage your trading wallets"}
            </p>
          </div>
        </div>
        <Link
          to="/trade/wallets"
          className="mt-3 flex h-11 items-center justify-center gap-1 rounded-2xl border border-white/20 text-xs font-bold text-white hover:bg-white/[0.08]"
        >
          Manage · Import / Export <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Quick actions */}
      {addr && (
        <div className="mt-4 space-y-2">
          <Link
            to={`/trade/wallet/${addr}`}
            className="flex h-13 items-center justify-center rounded-2xl bg-white py-3.5 text-sm font-bold text-black"
          >
            Open my portfolio
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/trade/portfolio"
              className="flex h-11 items-center justify-center rounded-2xl border border-white/20 text-xs font-bold text-white hover:bg-white/[0.08]"
            >
              Portfolio hub
            </Link>
            <Link
              to="/trade/desk"
              className="flex h-11 items-center justify-center rounded-2xl border border-white/20 text-xs font-bold text-white hover:bg-white/[0.08]"
            >
              Trade desk
            </Link>
          </div>
          {user && (
            <Link
              to="/profile"
              className="flex h-11 items-center justify-center rounded-2xl border border-white/20 text-xs font-bold text-white hover:bg-white/[0.08]"
            >
              Edit OrbitX profile
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
