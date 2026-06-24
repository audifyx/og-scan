import { Link } from "react-router-dom";
import { KolDirEntry } from "../lib/kol";
import { BadgeCheck } from "lucide-react";

export function tagClass(tag: string): string {
  const t = tag.toLowerCase();
  if (t.includes("whale")) return "bg-purple-500/15 text-purple-300";
  if (t.includes("smart")) return "bg-accent2/15 text-accent2";
  if (t.includes("top holder")) return "bg-yellow-500/15 text-yellow-400";
  if (t.includes("pump")) return "bg-panel2 text-muted";
  if (t.includes("former") || t.includes("disputed")) return "bg-down/15 text-down";
  return "bg-accent/15 text-accent";
}

// Inline KOL label for holders/trade rows.
export default function KolBadge({ kol, size = "sm" }: { kol: KolDirEntry; size?: "sm" | "md" }) {
  const disputed = kol.status === "disputed";
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <Link to={`/kol/${kol.address}`} onClick={(e) => e.stopPropagation()} className={`font-semibold hover:text-accent inline-flex items-center gap-1 ${size === "md" ? "text-sm" : "text-xs"} ${disputed ? "text-muted line-through" : "text-white"}`}>
        {!disputed && <BadgeCheck className="w-3.5 h-3.5 text-accent" />}{kol.name}
      </Link>
      {kol.twitter && <span className="text-[10px] text-muted">{kol.twitter}</span>}
      {(kol.tags || []).slice(0, 2).map((t) => <span key={t} className={`pill text-[9px] !px-1.5 !py-0 ${tagClass(t)}`}>{t}</span>)}
    </span>
  );
}
