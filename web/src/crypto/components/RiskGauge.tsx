import type { ComposedRisk } from "../risk/composeRisk";
import { ratingToneClass } from "../risk/composeRisk";

export function RiskGauge({ risk }: { risk: ComposedRisk }) {
  const tone = ratingToneClass(risk.rating);
  const pct = Math.round(risk.score);
  return (
    <div className="oxc-gauge">
      <div className={`oxc-gauge-ring ${tone}`} style={{ ["--oxc-pct" as string]: pct }}>
        <span className="oxc-gauge-val">{pct}</span>
      </div>
      <div>
        <div className={`oxc-badge ${tone}`}>Rating {risk.rating}</div>
        <div style={{ marginTop: "0.45rem", fontFamily: "var(--oxc-display)", fontWeight: 700, fontSize: "1.1rem" }}>
          {risk.label}
        </div>
        <p className="oxc-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", maxWidth: "22rem" }}>
          {risk.summary}
        </p>
        <p className="oxc-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.75rem" }}>
          Rug probability model: ~{Math.round(risk.rugProbability)}%
        </p>
      </div>
    </div>
  );
}

export function RiskFactors({ risk }: { risk: ComposedRisk }) {
  if (!risk.factors.length) {
    return <p className="oxc-empty">No risk factors detected from available feeds.</p>;
  }
  return (
    <div>
      {risk.factors.map((f) => (
        <div key={f.id} className="oxc-factor">
          <div>
            <div style={{ fontWeight: 600 }}>{f.label}</div>
            <div className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
              {f.detail}
            </div>
          </div>
          <div className={`oxc-badge oxc-tone-${f.severity === "critical" || f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : "good"}`}>
            {f.severity}
          </div>
        </div>
      ))}
    </div>
  );
}
