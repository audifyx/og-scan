import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchScreener, type ScreenerRow } from "../api/client";

export default function IntelHome() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchScreener(12)
      .then((d) => {
        if (cancelled) return;
        const list = d.tokens || d.data || [];
        setRows(Array.isArray(list) ? list.slice(0, 8) : []);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="oxc-hero">
        <h1>OrbitX</h1>
        <p>
          Token scanner, risk scoring, trading desk, launchpad tools, and smart-money intelligence — one command surface for Solana.
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link to="/intel/scan" className="oxc-btn" style={{ textDecoration: "none" }}>
            Scan a mint
          </Link>
          <Link to="/intel/trade" className="oxc-btn oxc-btn-ghost" style={{ textDecoration: "none" }}>
            Open trade desk
          </Link>
        </div>
      </header>

      <div className="oxc-grid oxc-grid-3" style={{ marginBottom: "1rem" }}>
        {[
          { t: "Token scanner", d: "Contract, liquidity, holders, rug & clone signals.", href: "/intel/scan" },
          { t: "Trading terminal", d: "Live charts, Jupiter routes, balances, history.", href: "/intel/trade" },
          { t: "Launchpad studio", d: "SPL create, metadata, anti-clone, creator fees.", href: "/intel/launch" },
        ].map((c) => (
          <Link key={c.href} to={c.href} className="oxc-panel" style={{ textDecoration: "none", color: "inherit" }}>
            <h3>{c.t}</h3>
            <p className="oxc-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {c.d}
            </p>
          </Link>
        ))}
      </div>

      <div className="oxc-panel">
        <h2>Live screener pulse</h2>
        {err && <p className="oxc-empty">{err}</p>}
        {!err && rows.length === 0 && <p className="oxc-empty oxc-pulse">Loading market pulse…</p>}
        {rows.length > 0 && (
          <table className="oxc-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Liq</th>
                <th>Vol 24h</th>
                <th>Δ 24h</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const mint = r.mint || r.address || "";
                const ch = r.priceChange24h;
                return (
                  <tr key={mint || i}>
                    <td>
                      <strong>${r.symbol || "—"}</strong>
                      <div className="oxc-muted" style={{ fontSize: "0.7rem" }}>
                        {r.name}
                      </div>
                    </td>
                    <td>{r.liquidity != null ? `$${Math.round(r.liquidity).toLocaleString()}` : "—"}</td>
                    <td>{r.volume24h != null ? `$${Math.round(r.volume24h).toLocaleString()}` : "—"}</td>
                    <td style={{ color: (ch ?? 0) >= 0 ? "var(--oxc-green)" : "var(--oxc-red)" }}>
                      {ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%` : "—"}
                    </td>
                    <td>
                      {mint ? (
                        <Link className="oxc-link" to={`/intel/scan/${mint}`}>
                          Scan
                        </Link>
                      ) : null}
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
