import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getAssets, type TokenAsset } from "@/lib/solana-api";
import { Link } from "react-router-dom";

function fmtUsd(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function amountUi(a: TokenAsset) {
  const bal = a.token_info?.balance ?? 0;
  const dec = a.token_info?.decimals ?? 0;
  return bal / Math.pow(10, dec || 0);
}

export default function PortfolioDesk() {
  const { publicKey, connected } = useWallet();
  const [assets, setAssets] = useState<TokenAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAssets(publicKey.toBase58())
      .then((res) => {
        if (!cancelled) setAssets(res.items || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const total = assets.reduce((s, a) => s + (a.token_info?.price_info?.total_price ?? 0), 0);

  return (
    <div>
      <header className="oxc-hero">
        <h1>Portfolio</h1>
        <p>Wallet balances and positions for the connected Solana account.</p>
      </header>

      {!connected && (
        <div className="oxc-panel">
          <p className="oxc-empty" style={{ margin: 0 }}>
            Connect a wallet to load balances. You can also trade from the{" "}
            <Link className="oxc-link" to="/intel/trade">
              trade desk
            </Link>
            .
          </p>
        </div>
      )}

      {connected && (
        <>
          <div className="oxc-grid oxc-grid-3" style={{ marginBottom: "1rem" }}>
            <div className="oxc-panel oxc-stat">
              <div className="label">Est. value</div>
              <div className="value">{loading ? "…" : fmtUsd(total)}</div>
            </div>
            <div className="oxc-panel oxc-stat">
              <div className="label">Positions</div>
              <div className="value">{loading ? "…" : assets.length}</div>
            </div>
            <div className="oxc-panel oxc-stat">
              <div className="label">Wallet</div>
              <div className="value oxc-mono" style={{ fontSize: "0.85rem" }}>
                {publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "—"}
              </div>
            </div>
          </div>

          <div className="oxc-panel">
            <h3>Holdings</h3>
            {error && <p style={{ color: "var(--oxc-red)" }}>{error}</p>}
            {loading && <p className="oxc-empty oxc-pulse">Fetching balances…</p>}
            {!loading && assets.length === 0 && <p className="oxc-empty">No SPL balances found.</p>}
            {assets.length > 0 && (
              <table className="oxc-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Amount</th>
                    <th>Value</th>
                    <th>Scan</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.slice(0, 40).map((a) => {
                    const mint = a.id;
                    const symbol = a.content?.metadata?.symbol || "???";
                    const name = a.content?.metadata?.name || "";
                    return (
                      <tr key={mint || symbol}>
                        <td>
                          <strong>${symbol}</strong>
                          <div className="oxc-muted" style={{ fontSize: "0.7rem" }}>
                            {name}
                          </div>
                        </td>
                        <td>{amountUi(a).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                        <td>{fmtUsd(a.token_info?.price_info?.total_price ?? 0)}</td>
                        <td>
                          {mint ? (
                            <Link className="oxc-link" to={`/intel/scan/${mint}`}>
                              Scan
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
