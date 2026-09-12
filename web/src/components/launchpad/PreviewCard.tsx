import type { LaunchIntent, QuoteAsset } from "@/lib/launchpad/types";
import { feeSplitFor } from "@/lib/launchpad/fees";
import { vanityEta, vanityPatternLength, onChainCreateSupported } from "@/lib/launchpad/intent";
import { PREDICT_LEGAL, STOCK_LEGAL } from "@/lib/launchpad/types";
import { isStockQuote } from "@/lib/launchpad/quotes";
import { styleMeta } from "@/lib/launchpad/styles";
import { trackCopy } from "@/lib/launchpad/rewards";
import { impliedProbability } from "@/lib/launchpad/market";

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
  const style = styleMeta(intent.style);
  const rewards = trackCopy(intent.rewards.track);
  const pYes = intent.market ? impliedProbability(1n, 1n) : null;
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
        <div><dt>Style</dt><dd>{style.label}{style.live ? "" : " · indexed"}</dd></div>
        <div><dt>Quote</dt><dd>{quote?.symbol || intent.quoteSymbol}</dd></div>
        <div><dt>Grad</dt><dd>{intent.graduationDest}</dd></div>
        <div><dt>Rewards</dt><dd>{intent.rewards.track}</dd></div>
        <div><dt>First buy</dt><dd>{intent.firstBuySol || 0} SOL</dd></div>
        <div><dt>Fees</dt><dd>{split.label}</dd></div>
        {intent.type === "vanity" && <div><dt>Grind</dt><dd>{eta.label}</dd></div>}
        {intent.market && <div><dt>YES</dt><dd>{pYes != null ? `${Math.round(pYes * 100)}¢` : "—"}</dd></div>}
      </dl>
      {intent.market && <p className="lp-auth-copy">{intent.market.question}</p>}
      {mintPreview && <div className="lp-mint-preview">{mintPreview}</div>}
      <p className="lp-auth-copy">{rewards.body}</p>
      {!live && (
        <p className="lp-preview-warn">
          {quote?.awaitingAllowlist
            ? `${quote.symbol} is awaiting QuoteControl — button stays honest, not broken.`
            : "Non-SOL create_v2 is not live on this path yet."}
        </p>
      )}
      {!style.live && style.refuse && <p className="lp-preview-warn">{style.refuse}</p>}
      {quote && isStockQuote(quote.mint) && <p className="lp-legal">{STOCK_LEGAL}</p>}
      {intent.market && <p className="lp-legal">{PREDICT_LEGAL}</p>}
    </aside>
  );
}
