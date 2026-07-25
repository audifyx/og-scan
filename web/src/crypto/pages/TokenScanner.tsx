import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTokenIntel } from "../hooks/useTokenIntel";
import { RiskFactors, RiskGauge } from "../components/RiskGauge";
import { DevHistoryPanel, HolderTable, TokenOverview } from "../components/TokenPanels";
import { isValidMint } from "../api/client";

export default function TokenScanner() {
  const { mint: routeMint } = useParams<{ mint?: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(routeMint || "");
  const intel = useTokenIntel(routeMint || null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const m = draft.trim();
    if (!isValidMint(m)) return;
    navigate(`/intel/scan/${m}`);
  }

  return (
    <div>
      <header className="oxc-hero">
        <h1>Token scanner</h1>
        <p>Overview, contract flags, liquidity, holders, rug detection, and explainable safety ratings.</p>
      </header>

      <form className="oxc-panel" onSubmit={onSubmit} style={{ marginBottom: "1rem" }}>
        <div className="oxc-input-row">
          <input
            className="oxc-input"
            placeholder="Paste Solana mint address…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <button className="oxc-btn" type="submit" disabled={!isValidMint(draft.trim())}>
            Scan
          </button>
          {intel.mint && (
            <button className="oxc-btn oxc-btn-ghost" type="button" onClick={intel.refresh} disabled={intel.loading}>
              Refresh
            </button>
          )}
        </div>
      </form>

      {!intel.mint && <p className="oxc-empty">Enter a mint to run the full intelligence pass.</p>}
      {intel.loading && <p className="oxc-empty oxc-pulse">Composing safety · forensics · market…</p>}
      {intel.error && <p className="oxc-empty" style={{ color: "var(--oxc-red)" }}>{intel.error}</p>}

      {intel.mint && !intel.loading && (
        <div className="oxc-grid" style={{ gap: "1rem" }}>
          <TokenOverview mint={intel.mint} token={intel.token} safety={intel.safety} forensics={intel.forensics} />

          <div className="oxc-grid oxc-grid-2">
            <div className="oxc-panel">
              <h3>Risk score & safety rating</h3>
              {intel.risk ? <RiskGauge risk={intel.risk} /> : <p className="oxc-empty">No score</p>}
            </div>
            <div className="oxc-panel">
              <h3>Risk factors</h3>
              {intel.risk ? <RiskFactors risk={intel.risk} /> : null}
            </div>
          </div>

          <div className="oxc-grid oxc-grid-2">
            <HolderTable token={intel.token} forensics={intel.forensics} />
            <DevHistoryPanel forensics={intel.forensics} />
          </div>

          <div className="oxc-panel">
            <h3>Tradeability note</h3>
            <p className="oxc-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {intel.safety?.note || "Run completed — see Jupiter verdict above."}
            </p>
            <div style={{ marginTop: "0.75rem" }}>
              <a className="oxc-btn" href={`/intel/trade`} style={{ textDecoration: "none", display: "inline-block" }}>
                Trade this token
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
