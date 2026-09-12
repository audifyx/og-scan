import { STYLE_CATALOG } from "@/lib/launchpad/styles";
import { PAD_PARAMS } from "@/lib/launchpad/params";
import type { LaunchIntent, LaunchStyle } from "@/lib/launchpad/types";

export function StylePicker({
  intent,
  onChange,
}: {
  intent: LaunchIntent;
  onChange: (p: Partial<LaunchIntent>) => void;
}) {
  const meta = STYLE_CATALOG.find((s) => s.id === intent.style);
  return (
    <details className="lp-adv" open={intent.style !== "curve"}>
      <summary className="lp-field-label">Launch style · first-hour discovery</summary>
      <p className="lp-auth-copy">Orthogonal to mode. Invalid venues stay visible as indexed, not as fake live buttons.</p>
      <div className="lp-grad">
        {STYLE_CATALOG.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`lp-mode ${intent.style === s.id ? "lp-mode--on" : ""}`}
            onClick={() => onChange({
              style: s.id as LaunchStyle,
              delayOpenUnix: s.id === "delay"
                ? (intent.delayOpenUnix || Math.floor(Date.now() / 1000) + 5 * 60)
                : undefined,
            })}
          >
            <span>{s.label}</span>
            <em>{s.hint}{s.live ? "" : " · indexed"}</em>
          </button>
        ))}
      </div>
      {intent.style === "delay" && (
        <label className="lp-adv-field">
          Open in minutes (max {PAD_PARAMS.delayOpenMaxSec / 60})
          <input
            className="lp-input"
            type="number"
            min={1}
            max={60}
            value={intent.delayOpenUnix ? Math.max(1, Math.round((intent.delayOpenUnix - Date.now() / 1000) / 60)) : 5}
            onChange={(e) => onChange({ delayOpenUnix: Math.floor(Date.now() / 1000) + Number(e.target.value) * 60 })}
          />
        </label>
      )}
      <label className="lp-adv-field">
        Anti-snipe extra fee, first N blocks (max {PAD_PARAMS.antiSnipeMax}, 0 = off)
        <input
          className="lp-input"
          type="number"
          min={0}
          max={PAD_PARAMS.antiSnipeMax}
          value={intent.antiSnipeBlocks}
          onChange={(e) => onChange({ antiSnipeBlocks: Math.max(0, Math.min(PAD_PARAMS.antiSnipeMax, Number(e.target.value) || 0)) })}
        />
      </label>
      <label className="lp-adv-field">
        Per-wallet cap first 15 min (SOL, 0 = uncapped)
        <input
          className="lp-input"
          type="number"
          min={0}
          step="0.1"
          value={intent.perWalletCapSol || ""}
          onChange={(e) => onChange({ perWalletCapSol: Number(e.target.value) || 0 })}
        />
      </label>
      {meta && !meta.live && <p className="lp-preview-warn">{meta.refuse}</p>}
    </details>
  );
}
