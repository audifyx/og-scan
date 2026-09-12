import { cn } from "@/lib/utils";
import type { QuoteAsset } from "@/lib/launchpad/types";
import { fmtCompactUsd } from "@/pages/orbitx/lpx";

export function QuotePicker({
  quotes,
  value,
  onChange,
}: {
  quotes: QuoteAsset[];
  value: string;
  onChange: (q: QuoteAsset) => void;
}) {
  const curated = quotes.filter((q) => ["SOL", "USDC", "NVDAX", "TSLAX", "SPYX", "wBTC"].includes(q.symbol) || q.allowed);
  return (
    <div>
      <div className="lp-field-label">Quote · pairing is permanent</div>
      <div className="lp-quote-grid">
        {curated.map((q) => {
          const on = q.mint === value;
          const live = q.allowed && !q.awaitingAllowlist;
          return (
            <button
              key={q.mint}
              type="button"
              disabled={!q.allowed && q.awaitingAllowlist && q.kind === "stock" ? false : false}
              className={cn("lp-quote", on && "lp-quote--on", q.awaitingAllowlist && "lp-quote--wait")}
              onClick={() => onChange(q)}
            >
              <span className="lp-quote-sym">{q.symbol}</span>
              <span className="lp-quote-name">{q.name}</span>
              <span className="lp-quote-meta">
                {q.awaitingAllowlist && !live
                  ? "awaiting allowlist"
                  : q.depthUsd != null
                    ? `${fmtCompactUsd(q.depthUsd)} depth`
                    : q.kind === "stock"
                      ? "fees in quote"
                      : "live"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
