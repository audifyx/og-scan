import { Link } from "react-router-dom";
import type { PredMarket } from "@/lib/predictions/types";
import { yesPrice, noPrice, fmtCents, fmtUsd } from "@/lib/predictions/types";

export function MarketCard({ m }: { m: PredMarket }) {
  const yp = yesPrice(m);
  const np = noPrice(m);
  return (
    <Link to={`/predictions/market/${m.slug || m.id}`} className="pm-card">
      <span className="pm-card-tag">{m.category}</span>
      {m.featured && <span className="pm-card-tag" style={{ marginLeft: 6, background: "rgba(212,175,55,0.15)", color: "#f0c75e" }}>Featured</span>}
      <h3 className="pm-card-q">{m.question}</h3>
      <div className="pm-card-odds">
        <div className="pm-odd pm-odd--yes">
          <span className="pm-odd-label">Yes</span>
          {fmtCents(yp)}
        </div>
        <div className="pm-odd pm-odd--no">
          <span className="pm-odd-label">No</span>
          {fmtCents(np)}
        </div>
      </div>
      <div className="pm-card-foot">
        <span>Vol {fmtUsd(m.volume_usdc, true)}</span>
        <span>{Math.round(yp * 100)}% chance</span>
      </div>
    </Link>
  );
}
