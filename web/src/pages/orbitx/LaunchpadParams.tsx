import { Link } from "react-router-dom";
import { PAD_PARAMS } from "@/lib/launchpad/params";
import { DEFAULT_PAD_FLAGS } from "@/lib/launchpad/flags";
import { STYLE_CATALOG } from "@/lib/launchpad/styles";
import { TabHero } from "./TabHero";
import { SlidersHorizontal } from "lucide-react";

export default function LaunchpadParams() {
  const rows: Array<[string, string]> = [
    ["Pad take on curve", `${PAD_PARAMS.padTakeCurveBps} bps`],
    ["Pad take on predict", `${PAD_PARAMS.padTakePredictBps} bps`],
    ["Creator take range", `${PAD_PARAMS.creatorTakeMinBps}–${PAD_PARAMS.creatorTakeMaxBps} bps`],
    ["Default predict fee", `${PAD_PARAMS.defaultPredictFeeBps} bps`],
    ["Delay open max", `${PAD_PARAMS.delayOpenMaxSec / 60} min`],
    ["Anti-snipe max", `${PAD_PARAMS.antiSnipeMax} blocks`],
    ["Epoch default", `${PAD_PARAMS.epochDefaultSec / 3600}h`],
    ["Predict boost cap", `${PAD_PARAMS.predictBoostCap}×`],
    ["Insurance buffer", `${PAD_PARAMS.insuranceBuffer * 100}%`],
    ["Grace resolve", `${PAD_PARAMS.graceResolveSec / 60} min`],
    ["Question max", `${PAD_PARAMS.questionMax}`],
    ["Ticker max", `${PAD_PARAMS.tickerMax}`],
    ["Slippage default", `${PAD_PARAMS.slippageDefaultBps / 100}%`],
    ["Quote stale", `${PAD_PARAMS.quoteStaleMs / 1000}s`],
  ];
  return (
    <div className="lp-create">
      <TabHero
        icon={SlidersHorizontal}
        accent="gold"
        eyebrow="Public parameters"
        title="Pad params"
        subtitle="Documented defaults. Timelock to change pad take. Feature flags freeze params without a fake APY."
      />
      <dl className="lp-preview-dl lp-params">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div className="lp-id-block">
        <div className="lp-field-label">Feature flags</div>
        <ul className="lp-auth-copy">
          {Object.entries(DEFAULT_PAD_FLAGS).map(([k, v]) => (
            <li key={k}>{k}: {String(v)}</li>
          ))}
        </ul>
      </div>
      <div className="lp-id-block">
        <div className="lp-field-label">Launch styles</div>
        {STYLE_CATALOG.map((s) => (
          <p key={s.id} className="lp-auth-copy">{s.label} — {s.live ? "live" : "indexed"} · {s.hint}</p>
        ))}
      </div>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-widest">
        Agent surface <Link to="/llms.txt" className="text-[#E8C547]">/llms.txt</Link>
        {" · "}
        <a href="/api/v1/openapi" className="text-[#E8C547]">OpenAPI</a>
      </p>
    </div>
  );
}
