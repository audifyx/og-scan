import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { checkAntiVamp, type AntiVampResult } from "../api/client";
import { detectCloneEdges } from "@/lib/intelligence";

export default function LaunchStudio() {
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [creatorFeeBps, setCreatorFeeBps] = useState(100);
  const [mintAuth, setMintAuth] = useState(false);
  const [freezeAuth, setFreezeAuth] = useState(false);
  const [result, setResult] = useState<AntiVampResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCheck(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await checkAntiVamp(name.trim(), ticker.trim());
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Client-side fallback clone check against empty set still useful for UX messaging
      const edges = detectCloneEdges(
        { mint: "draft", name, symbol: ticker },
        [],
        0.55,
      );
      setResult({
        ok: false,
        flagged: edges.length > 0,
        hardMatch: null,
        maxSim: edges[0]?.similarity ?? 0,
        note: "Server anti-vamp unreachable — local check only.",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  const blocked = !!(result?.blocked || result?.hardMatch);
  const flagged = !!(result?.flagged && !blocked);

  return (
    <div>
      <header className="oxc-hero">
        <h1>Launchpad studio</h1>
        <p>Token creation controls, metadata, authority renounce defaults, anti-clone protection, and creator fees.</p>
      </header>

      <div className="oxc-grid oxc-grid-2">
        <form className="oxc-panel" onSubmit={onCheck}>
          <h3>Identity & anti-clone</h3>
          <label className="oxc-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>
            Name
          </label>
          <input className="oxc-input" style={{ width: "100%", marginBottom: "0.75rem" }} value={name} onChange={(e) => setName(e.target.value)} required />
          <label className="oxc-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>
            Ticker
          </label>
          <input
            className="oxc-input"
            style={{ width: "100%", marginBottom: "0.75rem" }}
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            maxLength={10}
            required
          />
          <button className="oxc-btn" type="submit" disabled={loading || !name.trim() || !ticker.trim()}>
            {loading ? "Checking…" : "Run anti-clone check"}
          </button>
          {error && !result && <p style={{ color: "var(--oxc-red)", fontSize: "0.8rem" }}>{error}</p>}
          {result && (
            <div style={{ marginTop: "1rem" }}>
              <span
                className={`oxc-badge ${blocked ? "oxc-tone-critical" : flagged ? "oxc-tone-warn" : "oxc-tone-good"}`}
              >
                {blocked ? "Blocked" : flagged ? "Flagged" : "Clear"}
              </span>
              <p className="oxc-muted" style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
                {result.note ||
                  result.message ||
                  (blocked
                    ? "Hard name/ticker collision — launch must be blocked."
                    : flagged
                      ? "Soft match — route elevated creator fee / buyback penalty."
                      : "No significant clone matches.")}
              </p>
              {result.matches && result.matches.length > 0 && (
                <table className="oxc-table" style={{ marginTop: "0.5rem" }}>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Name</th>
                      <th>Ticker</th>
                      <th>Sim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.slice(0, 8).map((m, i) => (
                      <tr key={`${m.source}-${m.ticker}-${i}`}>
                        <td>{m.source}</td>
                        <td>{m.name}</td>
                        <td>{m.ticker}</td>
                        <td>{(m.sim * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </form>

        <div className="oxc-panel">
          <h3>Authority & creator fees</h3>
          <div className="oxc-factor">
            <span>Keep mint authority</span>
            <input type="checkbox" checked={mintAuth} onChange={(e) => setMintAuth(e.target.checked)} />
          </div>
          <div className="oxc-factor">
            <span>Keep freeze authority</span>
            <input type="checkbox" checked={freezeAuth} onChange={(e) => setFreezeAuth(e.target.checked)} />
          </div>
          {!mintAuth && !freezeAuth && (
            <p className="oxc-muted" style={{ fontSize: "0.8rem" }}>
              Recommended: renounce mint + freeze for safety ratings.
            </p>
          )}
          {(mintAuth || freezeAuth) && (
            <p style={{ color: "var(--oxc-amber)", fontSize: "0.8rem" }}>
              Live authorities lower safety rating and raise rug score.
            </p>
          )}
          <label className="oxc-muted" style={{ fontSize: "0.75rem", display: "block", margin: "0.75rem 0 0.25rem" }}>
            Creator fee (bps)
          </label>
          <input
            className="oxc-input"
            type="number"
            min={0}
            max={1000}
            value={creatorFeeBps}
            onChange={(e) => setCreatorFeeBps(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <p className="oxc-muted" style={{ fontSize: "0.78rem", marginTop: "0.5rem" }}>
            {flagged
              ? "Soft vamp match: elevated fee share routes to OBX buyback per anti-vamp policy."
              : `${(creatorFeeBps / 100).toFixed(2)}% creator fee on eligible volume.`}
          </p>
          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link
              to="/orbitxlaunch/create"
              className="oxc-btn"
              style={{
                textDecoration: "none",
                pointerEvents: blocked ? "none" : undefined,
                opacity: blocked ? 0.45 : 1,
              }}
            >
              Continue to create
            </Link>
            <a href="/ORBITX_DEX/metadata" className="oxc-btn oxc-btn-ghost" style={{ textDecoration: "none" }}>
              SPL metadata tools
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
