import {
  ArrowLeftRight,
  Flame,
  Droplets,
  Rocket,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { EVENT_META } from "@/pages/onchain-world/lib/orbitx/constants";
import type { EventKind } from "@/pages/onchain-world/lib/orbitx/types";
import { cn } from "@/lib/utils";

const ICONS: Record<EventKind, typeof ShoppingBag> = {
  kol_buy: Sparkles,
  kol_sell: Sparkles,
  orbitx_buy: ShoppingBag,
  orbitx_sell: TrendingDown,
  sol_transfer: ArrowLeftRight,
  orbitx_burn: Flame,
  whale_sell: TrendingDown,
  token_buy: ShoppingBag,
  token_sell: TrendingDown,
  token_swap: ArrowLeftRight,
  token_launch: Rocket,
  liquidity_add: Droplets,
  other: Wallet,
};

const TONE: Record<string, string> = {
  buy: "bg-buy/15 text-buy",
  sell: "bg-sell/15 text-sell",
  burn: "bg-burn/15 text-burn",
  transfer: "bg-transfer/15 text-transfer",
  whale: "bg-whale/15 text-whale",
  launch: "bg-launch/15 text-launch",
  dim: "bg-fg/10 text-muted",
};

export function EventKindGlyph({
  kind,
  className,
}: {
  kind: EventKind;
  className?: string;
}) {
  const Icon = ICONS[kind];
  const meta = EVENT_META[kind];
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-sm",
        TONE[meta.tone],
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={1.8} />
    </span>
  );
}
