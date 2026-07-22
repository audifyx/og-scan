// OrbitX NFT Marketplace — shared presentational bits.
import { useState } from "react";
import { ShieldCheck, ImageOff } from "lucide-react";

export function Media({ src, alt, className = "" }: { src?: string | null; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-[hsl(var(--mkt-panel-2))] ${className}`}>
        <ImageOff className="h-5 w-5 opacity-40" />
      </div>
    );
  }
  return <img src={src} alt={alt ?? ""} loading="lazy" draggable={false} onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

export function Verified({ show, className = "" }: { show?: boolean | null; className?: string }) {
  if (!show) return null;
  return <ShieldCheck className={`inline h-3.5 w-3.5 text-[hsl(var(--og-cyan))] ${className}`} aria-label="Verified" />;
}

const RARITY: Record<string, string> = {
  Mythic: "text-[hsl(320_90%_68%)] border-[hsl(320_90%_68%)]/40 bg-[hsl(320_90%_68%)]/10",
  Legendary: "text-[hsl(var(--og-gold))] border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10",
  Epic: "text-[hsl(var(--og-cyan))] border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10",
  Rare: "text-[hsl(var(--og-lime))] border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10",
  Common: "mkt-muted border-[hsl(var(--mkt-line))] bg-white/[0.03]",
};
export function RarityBadge({ tier, rank }: { tier?: string | null; rank?: number | null }) {
  if (!tier) return null;
  return <span className={`rounded-full border px-1.5 py-0.5 mkt-mono text-[8px] font-bold uppercase tracking-wide ${RARITY[tier] ?? RARITY.Common}`}>{tier}{rank ? ` #${rank}` : ""}</span>;
}

export function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[12px] mkt-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="mkt-panel flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <ImageOff className="h-7 w-7 opacity-40" />
      <p className="text-sm mkt-muted">{label}</p>
    </div>
  );
}
