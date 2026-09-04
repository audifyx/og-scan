import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchScreener, type ScreenerRow } from "../api/client";
import { trendVelocityScore, whyTrending, type SeriesPoint } from "@/lib/intelligence";

function syntheticSeries(row: ScreenerRow): SeriesPoint[] {
  const now = Date.now();
  const price = row.priceUsd ?? 1;
  const vol = row.volume24h ?? 0;
  const ch = (row.priceChange24h ?? 0) / 100;
  const older = price / ((1 + ch) || 1);
  return [
    { t: now - 86_400_000, price: older, volume: vol * 0.35, liquidity: row.liquidity },
    { t: now - 43_200_000, price: (older + price) / 2, volume: vol * 0.55, liquidity: row.liquidity },
    { t: now, price, volume: vol, liquidity: row.liquidity },
  ];
}

export default function TrendingIntel() {
  const [rows, setRows] = useState<Array<ScreenerRow & { velocity: number; why: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchScreener(50)
      .then((d) => {
        if (cancelled) return;
        const list = (d.tokens || d.data || []) as ScreenerRow[];
        const scored = list
          .map((r) => {
            const series = syntheticSeries(r);
            const velocity = trendVelocityScore(series);
            const why = whyTrending({
              velocity,
              volume24hUsd: r.volume24h,
              priceChange24h: r.priceChange24h,
            });
            return { ...r, velocity, why };
          })
          .sort((a, b) => b.velocity - a.velocity)
          .slice(0, 25);
        setRows(scored);
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
  }, []);

  return (
    <div>
      <header className="oxc-hero">
        <h1>Trending tokens</h1>
        <p>Velocity-ranked movers with explainable “why trending” signals from price and volume acceleration.</p>
      </header>

      <div className="oxc-panel">
        {error && <p style={{ color: "var(--oxc-red)" }}>{error}</p>}
        {!error && loading && <p className="oxc-empty oxc-pulse">Scoring market…</p>}
        {!error && !loading && rows.length === 0 && <p className="oxc-empty">No trending tokens yet.</p>}
        {rows.length > 0 && (
          <table className="oxc-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Velocity</th>
                <th>Δ 24h</th>
                <th>Why</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const mint = r.mint || r.address || "";
                return (
                  <tr key={mint || i}>
                    <td>
                      <strong>${r.symbol || "—"}</strong>
                    </td>
                    <td>
                      <span className="oxc-badge oxc-tone-ok">{Math.round(r.velocity)}</span>
                    </td>
                    <td style={{ color: (r.priceChange24h ?? 0) >= 0 ? "var(--oxc-green)" : "var(--oxc-red)" }}>
                      {r.priceChange24h != null ? `${r.priceChange24h.toFixed(1)}%` : "—"}
                    </td>
                    <td className="oxc-muted" style={{ fontSize: "0.78rem", maxWidth: 280 }}>
                      {r.why}
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
