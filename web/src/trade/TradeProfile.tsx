import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Copy, Check, LogOut, Wallet, ExternalLink, Loader2, User, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { useTradeWalletPicker } from "./TradeWalletPicker";
import { shortAddr, fmtUsd } from "./tradeFmt";
import "./trade-profile.css";

export default function TradeProfile() {
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();
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
  const [loadingBal, setLoadingBal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);

  /** Show active trading wallet balance when Local mode; else Phantom. */
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

    return () => {
      on = false;
    };
  }, [addr, connection]);

  const copy = () => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="tp">
      <div className="tp__top">
        <h1 className="tp__title">You</h1>
        <p className="tp__subtitle">Profile · Wallets · Settings</p>
      </div>

      <div className="tp__content">
        {/* OrbitX account */}
        <section className="tp__section tp__section--identity">
          <div className="tp__avatar-row">
            {avatar ? (
              <img src={avatar} alt="" className="tp__avatar" />
            ) : (
              <div className="tp__avatar-fallback">
                <User className="h-6 w-6" />
              </div>
            )}
            <div className="tp__identity-info">
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/30" />
              ) : username ? (
                <>
                  <p className="tp__username">@{username}</p>
                  <p className="tp__identity-label">
                    {profile?.verified || profile?.is_official_account ? "Verified" : "OrbitX account"}
                  </p>
                </>
              ) : (
                <>
                  <p className="tp__username">Not signed in</p>
                  <p className="tp__identity-label">Sign in to get started</p>
                </>
              )}
            </div>
          </div>

          {profile && (
            <div className="tp__stats-grid">
              <div className="tp__stat-card">
                <span className="tp__stat-label">Level</span>
                <p className="tp__stat-value">{profile.current_level ?? "—"}</p>
              </div>
              <div className="tp__stat-card">
                <span className="tp__stat-label">Streak</span>
                <p className="tp__stat-value">{profile.daily_streak ?? "—"}</p>
              </div>
              <div className="tp__stat-card">
                <span className="tp__stat-label">Rep</span>
                <p className="tp__stat-value">{profile.reputation_score ?? "—"}</p>
              </div>
            </div>
          )}

          {user ? (
            <Link to="/profile" className="tp__btn tp__btn--secondary">
              Edit profile
            </Link>
          ) : (
            <Link to="/auth" className="tp__btn tp__btn--primary">
              Sign in to OrbitX
            </Link>
          )}
        </section>

        {/* Local trading wallets */}
        <section className="tp__section">
          <h3 className="tp__section-title">Trading wallets</h3>
          <p className="tp__section-desc">
            {localWallets.length
              ? `${localWallets.length} wallet${localWallets.length !== 1 ? "s" : ""}`
              : "Import keys to trade"}
          </p>
          <Link to="/trade/wallets" className="tp__btn tp__btn--secondary">
            Manage
          </Link>
        </section>

        {/* Active wallet balance */}
        {addr && (
          <section className="tp__section">
            <h3 className="tp__section-title">Balance</h3>
            <div className="tp__balance-row">
              <div>
                <p className="tp__balance-label">SOL</p>
                <p className="tp__balance-value">
                  {loadingBal ? "—" : sol != null ? sol.toFixed(3) : "—"}
                </p>
              </div>
              <div>
                <p className="tp__balance-label">Portfolio</p>
                <p className="tp__balance-value">{fmtUsd(walletData?.totalUsd)}</p>
              </div>
            </div>
            {addr && (
              <div className="tp__actions">
                <button type="button" onClick={copy} className="tp__action-btn" title="Copy address">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                {connected && !localActive && (
                  <button type="button" onClick={() => disconnect()} className="tp__action-btn" title="Disconnect">
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
                <a
                  href={`https://solscan.io/account/${addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tp__action-btn"
                  title="View on Solscan"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </section>
        )}

        {/* Quick actions */}
        <section className="tp__section">
          <div className="tp__action-grid">
            {!addr ? (
              <>
                {picker}
                <button type="button" onClick={openPicker} className="tp__btn tp__btn--primary">
                  {localActive ? "Manage wallets" : "Connect wallet"}
                </button>
              </>
            ) : (
              <>
                <Link to={`/trade/wallet/${addr}`} className="tp__btn tp__btn--primary">
                  My Portfolio
                </Link>
                <Link to="/trade/desk" className="tp__btn tp__btn--secondary">
                  Trade Desk
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
