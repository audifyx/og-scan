import { PREDICT_LEGAL, type LaunchIntent, type MarketAmm, type ResolverKind } from "@/lib/launchpad/types";
import { AMM_COPY, MARKET_TEMPLATES, MARKET_QUESTION_MAX, defaultMarketSpec } from "@/lib/launchpad/market";
import { resolverCopy } from "@/lib/launchpad/resolve";
import { predictBlockedForCountry, type PadFlags } from "@/lib/launchpad/flags";

export function PredictPanel({
  intent,
  flags,
  onChange,
}: {
  intent: LaunchIntent;
  flags: PadFlags;
  onChange: (p: Partial<LaunchIntent>) => void;
}) {
  if (!flags.predict_markets) return null;
  const m = intent.market ?? defaultMarketSpec(intent.symbol || "TICKER");
  const blocked = predictBlockedForCountry(intent.geoCountry, flags);
  const patchMarket = (p: Partial<typeof m>) => onChange({ market: { ...m, ...p } });

  return (
    <div className="lp-id-block">
      <div className="lp-field-label">Yes / No market</div>
      <p className="lp-auth-copy">Born with the coin. Collateral = quote mint. On-chain program is not live — we index the question and keep SOL create working.</p>
      <div className="lp-grad">
        {MARKET_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`lp-mode ${m.question === t.question(intent.symbol || "TICKER") || (t.id === "custom" && !MARKET_TEMPLATES.slice(0, 3).some((x) => m.question === x.question(intent.symbol || "TICKER"))) ? "lp-mode--on" : ""}`}
            onClick={() => patchMarket({
              question: t.question(intent.symbol || "TICKER"),
              resolver: t.resolver,
              deadlineUnix: Math.floor(Date.now() / 1000) + t.hours * 3600,
            })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        className="lp-input lp-textarea"
        maxLength={MARKET_QUESTION_MAX}
        placeholder="Will this graduate within 48h?"
        value={m.question}
        onChange={(e) => patchMarket({ question: e.target.value })}
      />
      <div className="lp-id-links">
        <label className="lp-adv-field">
          Deadline
          <input
            className="lp-input"
            type="datetime-local"
            value={isoLocal(m.deadlineUnix)}
            onChange={(e) => patchMarket({ deadlineUnix: Math.floor(new Date(e.target.value).getTime() / 1000) })}
          />
        </label>
        <label className="lp-adv-field">
          Resolver
          <select className="lp-input" value={m.resolver} onChange={(e) => patchMarket({ resolver: e.target.value as ResolverKind })}>
            <option value="metric">On-chain metric</option>
            <option value="pyth">Pyth threshold</option>
            <option value="switchboard">Switchboard</option>
            <option value="mofn">M-of-N authority</option>
            <option value="optimistic">Optimistic + challenge</option>
          </select>
        </label>
        <label className="lp-adv-field">
          AMM
          <select className="lp-input" value={m.amm} onChange={(e) => patchMarket({ amm: e.target.value as MarketAmm })}>
            <option value="parimutuel">Parimutuel</option>
            <option value="lmsr">LMSR</option>
            <option value="cp">Constant product</option>
          </select>
        </label>
      </div>
      {m.resolver === "pyth" && (
        <div className="lp-id-links">
          <input className="lp-input" placeholder="Pyth feed id" value={m.feedId || ""} onChange={(e) => patchMarket({ feedId: e.target.value })} />
          <input className="lp-input" placeholder="Threshold" value={m.threshold || ""} onChange={(e) => patchMarket({ threshold: e.target.value })} />
        </div>
      )}
      <p className="lp-auth-copy">{resolverCopy(m.resolver)} {AMM_COPY[m.amm]}</p>
      <label className="lp-adv-field">
        Country (ISO)
        <input className="lp-input" maxLength={2} placeholder="DE" value={intent.geoCountry} onChange={(e) => onChange({ geoCountry: e.target.value.toUpperCase() })} />
      </label>
      <label className="lp-check">
        <input type="checkbox" checked={intent.geoAttest} onChange={(e) => onChange({ geoAttest: e.target.checked })} />
        I am 18+ and self-attest I am allowed to use event contracts here
      </label>
      {blocked && <p className="lp-preview-warn">Predict is off in this region until legal review. Coin still launches without a live market.</p>}
      <p className="lp-legal">{PREDICT_LEGAL}</p>
    </div>
  );
}

function isoLocal(unix: number): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
