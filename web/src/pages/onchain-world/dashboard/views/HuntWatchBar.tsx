import type { LiveDeskPayload } from "@/pages/onchain-world/api";
import { formatAddress } from "@/pages/onchain-world/lib/orbitx/format";
import { liveHuntList } from "../../../../../shared/orbitx-live-desk.js";
import { CopyMintButton } from "@/components/CopyMintButton";

export const CA_BTN =
  "rounded-full border-line bg-transparent px-2 py-0.5 text-[10px] font-semibold tracking-wide text-dim hover:border-fg hover:text-fg";

export function HuntWatchBar({ hunts }: { hunts?: LiveDeskPayload["hunt"] }) {
  const list = hunts?.length ? hunts : liveHuntList();
  if (!list.length) return null;
  return (
    <div className="border-b border-line bg-bg-sunken/80 px-4 py-2">
      {list.map((h) => (
        <div key={h.mint} className="flex flex-wrap items-center gap-2">
          <span className="ox-kicker text-accent">Hunt</span>
          <span className="text-2xs text-fg">${h.symbol}</span>
          <code className="truncate text-[10px] text-muted">{formatAddress(h.mint)}</code>
          <CopyMintButton mint={h.mint} label="copy CA" copiedLabel="copied" className={CA_BTN} iconClassName="h-3 w-3" />
          <span className="text-[10px] text-dim">
            ${Number(h.clipUsd || 1).toFixed(2)} clip now. Sell 41% at ${Math.round(Number(h.scaleMcap || 300000) / 1000)}k
            MC, flatten at ${Math.round(Number(h.flattenMcap || 600000) / 1000)}k.
          </span>
        </div>
      ))}
    </div>
  );
}
