import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-display text-2xs font-semibold tracking-wider uppercase",
  {
    variants: {
      tone: {
        idle: "bg-warn/15 text-warn",
        live: "bg-live/15 text-live",
        buy: "bg-buy/15 text-buy",
        sell: "bg-sell/15 text-sell",
        burn: "bg-burn/15 text-burn",
        transfer: "bg-transfer/15 text-transfer",
        whale: "bg-whale/15 text-whale",
        launch: "bg-launch/15 text-launch",
        dim: "bg-fg/10 text-muted",
        tracked: "bg-live/15 text-live",
      },
    },
    defaultVariants: { tone: "dim" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
