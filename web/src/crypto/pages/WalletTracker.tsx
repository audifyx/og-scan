import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchWallet } from "../api/client";

export default function WalletTracker() {
  const { address } = useParams<{ address: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    fetchWallet(address)
      .then((d) => {
        if (!cancelled) setData(d);
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
  }, [address]);

  const holdings = Array.isArray(data?.holdings)
    ? (data!.holdings as Array<Record<string, unknown>>)
    : Array.isArray(data?.tokens)
      ? (data!.tokens as Array<Record<string, unknown>>)
      : [];

  return (
    <div>
      <header className="oxc-hero">
        <h1>Wallet tracking</h1>
        <p className="oxc-mono" style={{ color: "var(--oxc-muted)" }}>
          {address}
        </p>
      </header>

      <div className="oxc-panel">
        {loading && <p className="oxc-empty oxc-pulse">Loading wallet intel…</p>}
        {error && (
          <p className="oxc-muted">
            {error} — try{" "}
            <a className="oxc-link" href={`/ORBITX_DEX/wallet/${address}`} target="_blank" rel="noreferrer">
              DEX wallet view
            </a>
            .
          </p>
        )}
        {!loading && !error && holdings.length === 0 && (
          <p className="oxc-empty">
            No structured holdings in response. Open the{" "}
            <a className="oxc-link" href={`/ORBITX_DEX/wallet/${address}`} target="_blank" rel="noreferrer">
              full wallet radar
            </a>
            .
          </p>
        )}
        {holdings.length > 0 && (
          <table className="oxc-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Amt / %</th>
                <th>Scan</th>
              </tr>
            </thead>
            <tbody>
              {holdings.slice(0, 30).map((h, i) => {
                const mint = String(h.mint || h.address || "");
                return (
                  <tr key={mint || i}>
                    <td>${String(h.symbol || "???")}</td>
                    <td>{String(h.uiAmount ?? h.amount ?? h.pct ?? "—")}</td>
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
    </div>
  );
}
