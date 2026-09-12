import type { LaunchIntent, QuoteAsset } from "@/lib/launchpad/types";
import { feeSplitFor } from "@/lib/launchpad/fees";
import { vanityEta, vanityPatternLength, onChainCreateSupported } from "@/lib/launchpad/intent";
import { STOCK_LEGAL } from "@/lib/launchpad/types";
import { isStockQuote } from "@/lib/launchpad/quotes";

export function PreviewCard({
  intent,
  quote,
  image,
  mintPreview,
}: {
  intent: LaunchIntent;
  quote: QuoteAsset | undefined;
  image: string | null;
  mintPreview: string | null;
}) {
  const split = feeSplitFor(intent);
  const eta = vanityEta(vanityPatternLength(intent));
  const live = onChainCreateSupported(intent);
  return (
    <aside className="lp-preview">
      <div className="lp-preview-kicker">Live ticket</div>
      <div className="lp-preview-hero">
        {image ? <img src={image} alt="" /> : <div className="lp-preview-ph">{(intent.symbol || "?").slice(0, 2)}</div>}
        <div>
          <div className="lp-preview-name">{intent.name || "Untitled"}</div>
          <div className="lp-preview-tick">${intent.symbol || "TICKER"}</div>
        </div>
      </div>
      <dl className="lp-preview-dl">
        <div><dt>Mode</dt><dd>{intent.type}</dd></div>
        <div><dt>Quote</dt><dd>{quote?.symbol || intent.quoteSymbol}</dd></div>
        <div><dt>Grad</dt><dd>{intent.graduationDest}</dd></div>
        <div><dt>First buy</dt><dd>{intent.firstBuySol || 0} SOL</dd></div>
        <div><dt>Fees</dt><dd>{split.label}</dd></div>
        {intent.type === "vanity" && <div><dt>Grind</dt><dd>{eta.label}</dd></div>}
      </dl>
      {mintPreview && <div className="lp-mint-preview">{mintPreview}</div>}
      {!live && (
        <p className="lp-preview-warn">
          {quote?.awaitingAllowlist
            ? `${quote.symbol} is awaiting QuoteControl — button stays honest, not broken.`
            : "Non-SOL create_v2 is not live on this path yet."}
        </p>
      )}
      {quote && isStockQuote(quote.mint) && <p className="lp-legal">{STOCK_LEGAL}</p>}
    </aside>
  );
}
