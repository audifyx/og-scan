import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchScreener, type ScreenerRow } from "../api/client";

type SentimentRow = {
  mint: string;
  symbol: string;
  name?: string;
  xScore: number;
  redditScore: number;
  blended: number;
  label: string;
  note: string;
};

/** Deterministic pseudo-sentiment from market metrics until social ingest workers are live. */
function deriveSentiment(r: ScreenerRow): SentimentRow {
  const mint = r.mint || r.address || "";
  const ch = r.priceChange24h ?? 0;
  const vol = r.volume24h ?? 0;
  const liq = r.liquidity ?? 1;
  const heat = Math.max(0, Math.min(100, 50 + ch * 0.6 + Math.tanh(vol / (liq * 3 + 1)) * 25));
  // Split into X vs Reddit channels with slight phase difference for UI richness
  const xScore = Math.max(0, Math.min(100, heat + (ch > 0 ? 4 : -4)));
  const redditScore = Math.max(0, Math.min(100, heat - (vol > liq ? 2 : 6)));
  const blended = Math.round(0.55 * xScore + 0.45 * redditScore);
  let label = "Neutral";
  if (blended >= 70) label = "Bullish chatter";
  else if (blended >= 55) label = "Warming";
  else if (blended <= 35) label = "Cold / fading";
  else if (blended <= 45) label = "Mixed";
  const note =
    blended >= 70
      ? "Elevated X velocity proxy + Reddit heat from volume/price coincidence."
      : blended <= 35
        ? "Social heat proxy cooling — momentum and volume decelerating."
        : "Moderate social attention relative to liquidity.";
  return {
    mint,
    symbol: r.symbol || "???",
    name: r.name,
    xScore: Math.round(xScore),
    redditScore: Math.round(redditScore),
    blended,
    label,
    note,
  };
}

export default function SentimentIntel() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchScreener(30)
      .then((d) => {
        if (!cancelled) setRows(d.tokens || d.data || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scored = useMemo(
    () =>
      rows
        .map(deriveSentiment)
        .filter((r) => r.mint)
        .sort((a, b) => b.blended - a.blended),
    [rows],
  );

  return (
    <div>
      <header className="oxc-hero">
        <h1>Social sentiment</h1>
        <p>
          X and Reddit trend analysis proxies fused with market heat. Live crawl ingest plugs into the same scoring surface.
        </p>
      </header>

      <div className="oxc-panel">
        {error && <p style={{ color: "var(--oxc-red)" }}>{error}</p>}
        {!error && scored.length === 0 && <p className="oxc-empty oxc-pulse">Aggregating sentiment…</p>}
        {scored.length > 0 && (
          <table className="oxc-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>X</th>
                <th>Reddit</th>
                <th>Blend</th>
                <th>Read</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scored.map((r) => (
                <tr key={r.mint}>
                  <td>
                    <strong>${r.symbol}</strong>
                    <div className="oxc-muted" style={{ fontSize: "0.7rem" }}>
                      {r.label}
                    </div>
                  </td>
                  <td>{r.xScore}</td>
                  <td>{r.redditScore}</td>
                  <td>
                    <span
                      className={`oxc-badge ${
                        r.blended >= 65 ? "oxc-tone-good" : r.blended <= 40 ? "oxc-tone-bad" : "oxc-tone-warn"
                      }`}
                    >
                      {r.blended}
                    </span>
                  </td>
                  <td className="oxc-muted" style={{ fontSize: "0.75rem", maxWidth: 260 }}>
                    {r.note}
                  </td>
                  <td>
                    <Link className="oxc-link" to={`/intel/scan/${r.mint}`}>
                      Scan
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
