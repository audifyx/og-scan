import { impliedProbability, marketStatus } from "@/lib/launchpad/market";
import { resolverCopy } from "@/lib/launchpad/resolve";
import type { MarketStatus, ResolverKind } from "@/lib/launchpad/types";
import { Link } from "react-router-dom";

export type MarketRow = {
  mint: string;
  question: string;
  deadline_unix: number;
  resolver: ResolverKind;
  amm: string;
  status: MarketStatus | string;
  yes_pool?: number | string | null;
  no_pool?: number | string | null;
  outcome?: string | null;
  evidence_uri?: string | null;
};

export function MarketTicket({ market }: { market: MarketRow }) {
  const yes = BigInt(Math.max(0, Math.floor(Number(market.yes_pool || 0))));
  const no = BigInt(Math.max(0, Math.floor(Number(market.no_pool || 0))));
  const pYes = impliedProbability(yes || 1n, no || 1n);
  const now = Math.floor(Date.now() / 1000);
  const status = marketStatus(now, market.deadline_unix, market.status === "resolved", market.status === "void", market.status === "halted");
  return (
    <section className="lp-ticket">
      <div className="lp-field-label">Market ticket</div>
      <p className="lp-ticket-q">{market.question}</p>
      <div className="lp-ticket-odds">
        <div>
          <span>YES</span>
          <strong>{Math.round(pYes * 100)}%</strong>
        </div>
        <div>
          <span>NO</span>
          <strong>{Math.round((1 - pYes) * 100)}%</strong>
        </div>
      </div>
      <dl className="lp-preview-dl">
        <div><dt>Status</dt><dd>{status}</dd></div>
        <div><dt>AMM</dt><dd>{market.amm}</dd></div>
        <div><dt>Deadline</dt><dd>{new Date(market.deadline_unix * 1000).toLocaleString()}</dd></div>
      </dl>
      <p className="lp-auth-copy">Bets stay indexed until pm-core is live. Winning side redeems 1:1; losing side redeems 0.</p>
    </section>
  );
}

export function ResolverCard({ market }: { market: MarketRow }) {
  return (
    <section className="lp-ticket">
      <div className="lp-field-label">Resolver</div>
      <p className="lp-auth-copy">{resolverCopy(market.resolver)}</p>
      {market.outcome && <p className="lp-mint-preview">Outcome · {market.outcome}</p>}
      {market.evidence_uri && <a className="lp-auth-copy" href={market.evidence_uri} target="_blank" rel="noreferrer">Evidence</a>}
      <p className="lp-auth-copy">Anyone can crank resolve after T. Stale oracle voids, it does not steal.</p>
      <Link className="lp-auth-copy" to={`/orbitxlaunch/claim/${market.mint}`}>Claim / redeem →</Link>
    </section>
  );
}
