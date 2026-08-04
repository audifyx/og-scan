/**
 * Unified Profile & Portfolio Page
 * Shows user identity, wallet balance, holdings with full metadata
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Copy, Check, ExternalLink, Loader2, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { useTradeWalletPicker } from "./TradeWalletPicker";
import {
  fetchWallet,
  type WalletData,
} from "./tradeApi";
import { fmtPct, fmtTok, fmtUsd, shortAddr } from "./tradeFmt";
import "./trade-profile-page.css";

type ProfileTab = "portfolio" | "profile";

export default function TradeProfilePage() {
  const navigate = useNavigate();
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();
  const { profile, user, loading: authLoading } = useAuth();
  const {
    address: activeAddr,
    localActive,
    label: activeLabel,
    localWallets,
    connected: walletConnected,
  } = useActiveTradingWallet();
  const { openPicker, picker } = useTradeWalletPicker();

  const [tab, setTab] = useState<ProfileTab>("portfolio");
  const [sol, setSol] = useState<number | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  // Show active trading wallet; fall back to Phantom
  const addr = activeAddr || publicKey?.toBase58();
  const username = profile?.username || profile?.display_name || null;
  const avatar = profile?.avatar_url || null;

  // Load wallet balance and portfolio
  useEffect(() => {
    if (!addr) {
      setSol(null);
      setWalletData(null);
      return;
    }

    let on = true;
    setLoadingBal(true);
    setLoadingPortfolio(true);

    let pk: PublicKey;
    try {
      pk = new PublicKey(addr);
    } catch {
      setLoadingBal(false);
      return;
    }

    // Fetch SOL balance
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

    // Fetch wallet portfolio data
    fetchWallet(addr)
      .then((data) => {
        if (on) setWalletData(data);
      })
      .catch(() => {
        if (on) setWalletData(null);
      })
      .finally(() => {
        if (on) setLoadingPortfolio(false);
      });

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

  const holdings = walletData?.ok ? walletData.holdings || [] : [];
  const totalValue = walletData?.totalUsd || 0;

  return (
    <div className="tpp">
      {/* Header */}
      <div className="tpp__header">
        <h1 className="tpp__title">Portfolio</h1>
        <p className="tpp__subtitle">Your holdings & assets</p>
      </div>

      {/* Profile Card */}
      <section className="tpp__section">
        <div className="tpp__profile-card">
          <div className="tpp__profile-top">
            {avatar ? (
              <img src={avatar} alt="" className="tpp__avatar" />
            ) : (
              <div className="tpp__avatar-fallback">
                <User className="h-6 w-6" />
              </div>
            )}
            <div className="tpp__profile-info">
              {authLoading ? (
                <p className="tpp__loading-text">Loading…</p>
              ) : username ? (
                <>
                  <p className="tpp__username">@{username}</p>
                  <p className="tpp__account-label">OrbitX Account</p>
                </>
              ) : (
                <>
                  <p className="tpp__username">Not Signed In</p>
                  <p className="tpp__account-label">Connect to get started</p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Balance & Deposit */}
      {addr ? (
        <section className="tpp__section">
          <div className="tpp__balance-header">
            <h3 className="tpp__section-title">Wallet Balance</h3>
            <p className="tpp__section-desc">{shortAddr(addr, 6)}</p>
          </div>

          <div className="tpp__balance-grid">
            <div className="tpp__balance-card">
              <span className="tpp__balance-label">SOL</span>
              <p className="tpp__balance-value">
                {loadingBal ? "—" : sol !== null ? sol.toFixed(3) : "—"}
              </p>
            </div>
            <div className="tpp__balance-card">
              <span className="tpp__balance-label">Portfolio Value</span>
              <p className="tpp__balance-value">{fmtUsd(totalValue)}</p>
            </div>
          </div>

          {/* Deposit Button & Copy */}
          <div className="tpp__actions">
            <button
              type="button"
              onClick={copy}
              className="tpp__btn tpp__btn--primary"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Address Copied!" : "Copy Address for Deposit"}
            </button>
            <p className="tpp__deposit-hint">Send SOL to this address to deposit</p>
          </div>
        </section>
      ) : null}

      {/* Holdings List */}
      <section className="tpp__section">
        <div className="tpp__holdings-header">
          <h3 className="tpp__section-title">
            Holdings {holdings.length > 0 && `(${holdings.length})`}
          </h3>
          {loadingPortfolio && <Loader2 className="tpp__spin" />}
        </div>

        {!addr ? (
          <div className="tpp__empty">
            <p>Connect a wallet to view holdings</p>
            {picker}
            <button type="button" onClick={openPicker} className="tpp__btn tpp__btn--secondary">
              Connect Wallet
            </button>
          </div>
        ) : loadingPortfolio && holdings.length === 0 ? (
          <div className="tpp__loading">
            <Loader2 className="tpp__spin" />
            <p>Loading holdings…</p>
          </div>
        ) : holdings.length === 0 ? (
          <div className="tpp__empty">
            <p>No holdings yet</p>
          </div>
        ) : (
          <div className="tpp__holdings-list">
            {holdings.map((h: any) => (
              <Link
                key={h.mint}
                to={`/trade/token/${h.mint}`}
                className="tpp__holding-item"
              >
                {/* Token Icon */}
                <div className="tpp__holding-icon">
                  {h.image ? (
                    <img src={h.image} alt="" className="tpp__token-img" />
                  ) : (
                    <div className="tpp__token-fallback">
                      {(h.symbol || "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Token Info */}
                <div className="tpp__holding-main">
                  <div className="tpp__holding-header">
                    <div className="tpp__token-names">
                      <p className="tpp__token-symbol">{h.symbol || shortAddr(h.mint, 4)}</p>
                      <p className="tpp__token-name">{h.name || "Unknown Token"}</p>
                    </div>
                    <div className="tpp__holding-price">
                      <p className="tpp__holding-value">{fmtUsd(h.uiAmount * (h.priceUsd || 0))}</p>
                      <p className={`tpp__holding-pct ${(h.change24h || 0) >= 0 ? "tpp__up" : "tpp__down"}`}>
                        {fmtPct(h.change24h || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="tpp__holding-meta">
                    <span className="tpp__meta-item">
                      <span className="tpp__meta-label">Amount:</span>
                      {fmtTok(h.uiAmount, 2)}
                    </span>
                    <span className="tpp__meta-item">
                      <span className="tpp__meta-label">Price:</span>
                      {fmtUsd(h.priceUsd || 0)}
                    </span>
                    {h.supply != null && (
                      <span className="tpp__meta-item">
                        <span className="tpp__meta-label">Supply:</span>
                        {fmtTok(h.supply, 0)}
                      </span>
                    )}
                  </div>

                  {/* Cost & Potential */}
                  <div className="tpp__holding-pnl">
                    <span className="tpp__pnl-item">
                      <span className="tpp__pnl-label">Cost:</span>
                      <span>{h.costUsd != null ? fmtUsd(h.costUsd) : "—"}</span>
                    </span>
                    <span className="tpp__pnl-item">
                      <span className="tpp__pnl-label">Current:</span>
                      <span className={h.potUsd >= h.costUsd ? "tpp__up" : "tpp__down"}>
                        {h.potUsd != null && h.potUsd > 0 ? fmtUsd(h.potUsd) : "—"}
                      </span>
                    </span>
                    {h.unpriced && (
                      <span className="tpp__pnl-item tpp__pnl-unpriced">Unpriced</span>
                    )}
                  </div>

                  {/* Additional Info */}
                  {(h.launchpad || h.createdAt) && (
                    <div className="tpp__holding-launch">
                      {h.launchpad && (
                        <span className="tpp__launch-badge">{h.launchpad}</span>
                      )}
                      {h.createdAt && (
                        <span className="tpp__launch-date">
                          Launched {new Date(h.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Link */}
                <div className="tpp__holding-action">
                  <ExternalLink className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="tpp__footer">
        <p className="tpp__footer-brand">OrbitX</p>
        <p className="tpp__footer-copy">Your portfolio on Solana</p>
      </div>
    </div>
  );
}
