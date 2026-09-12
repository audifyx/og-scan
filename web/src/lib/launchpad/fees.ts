import type { LaunchIntent } from "./types";

export type FeeSplit = {
  holdersPct: number;
  bagworkPct: number;
  devPct: number;
  label: string;
};

export function feeSplitFor(intent: Pick<LaunchIntent, "type" | "holderRewards" | "bagwork">): FeeSplit {
  if (intent.type === "bagwork" || intent.bagwork) {
    return { holdersPct: 40, bagworkPct: 40, devPct: 20, label: "40% holders / 40% bagwork / 20% dev — frozen at launch" };
  }
  if (intent.type === "rewards" || intent.holderRewards) {
    return { holdersPct: 100, bagworkPct: 0, devPct: 0, label: "Creator fee → holder vault, pro-rata supply" };
  }
  if (intent.type === "predict") {
    return { holdersPct: 0, bagworkPct: 0, devPct: 100, label: "Creator vault + predict fees (1% default) → market / holders / pad" };
  }
  return { holdersPct: 0, bagworkPct: 0, devPct: 100, label: "Creator vault → registered dev wallet" };
}
