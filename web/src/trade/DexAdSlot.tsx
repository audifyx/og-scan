/* ══════════════════════════════════════════════════════════════
   DexAdSlot — placement-aware ad renderer for the DEX.
   Mount it once per placement and it shows the highest-priority
   ACTIVE ad the admin placed there (or renders nothing when none
   is live). Admin flow: DexAdsSection → save ad + placement →
   this slot picks it up on next mount/refresh. No code change.
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { getActiveAdForPlacement, type DexAd, type DexPlacement } from "@/lib/dexAds";

type Props = {
  placement: DexPlacement;
  /** Token mint — only used by the token-detail slot to prefer an ad targeted at this token. */
  mint?: string;
  className?: string;
};

export function DexAdSlot({ placement, mint, className }: Props) {
  const [ad, setAd] = useState<DexAd | null>(null);

  useEffect(() => {
    let on = true;
    getActiveAdForPlacement(placement, mint).then((row) => {
      if (on) setAd(row);
    });
    return () => {
      on = false;
    };
  }, [placement, mint]);

  if (!ad) return null;

  const body = (
    <>
      {ad.image_url ? (
        <img
          src={ad.image_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-white/10 object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#e8b84a]/25 bg-[#e8b84a]/10 text-[#e8b84a]">
          <Megaphone className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-white">{ad.title}</span>
          <span className="shrink-0 rounded border border-white/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white/45">
            Ad
          </span>
        </span>
        {ad.body ? (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-white/60">{ad.body}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-[11px] font-bold text-[#e8b84a]">Open</span>
    </>
  );

  const cls = `flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-[#e8b84a]/40 hover:bg-white/[0.05] ${className || ""}`;

  if (ad.link_url) {
    return (
      <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className={cls} data-dex-ad={ad.id} data-dex-placement={placement}>
        {body}
      </a>
    );
  }
  return (
    <div className={cls} data-dex-ad={ad.id} data-dex-placement={placement}>
      {body}
    </div>
  );
}

export default DexAdSlot;
