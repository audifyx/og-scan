import { Link } from "react-router-dom";
import { timeAgo } from "@/pages/orbitx/_shared";

export type TapeItem = {
  mint: string;
  symbol: string;
  name: string;
  quote?: string | null;
  mode?: string | null;
  created_at: string;
};

export function Tape({ items }: { items: TapeItem[] }) {
  if (!items.length) return null;
  const loop = [...items, ...items];
  return (
    <div className="lp-tape" aria-label="Live tape">
      <div className="lp-tape-track">
        {loop.map((t, i) => (
          <Link key={`${t.mint}-${i}`} to={`/orbitxlaunch/token/${t.mint}`} className="lp-tape-item">
            <span className="lp-tape-sym">${t.symbol}</span>
            <span>{t.quote || "SOL"}</span>
            {t.mode && t.mode !== "normal" && <span className="lp-tape-mode">{t.mode}</span>}
            <span>{timeAgo(t.created_at)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
