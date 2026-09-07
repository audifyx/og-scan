import { detectQueryKind } from "../../../../../shared/orbitx-chain-intel.js";
import type { CenterView } from "./types";

export type ExploreTarget = {
  path: string;
  view: CenterView;
  label: string;
};

export function exploreTargetsForQuery(q: string): ExploreTarget[] {
  const kind = detectQueryKind(q);
  if (kind.kind === "signature") {
    return [{ path: `/on-chain/tx/${kind.value}`, view: "tx", label: "Open transaction" }];
  }
  if (kind.kind === "slot") {
    return [{ path: `/on-chain/block/${kind.value}`, view: "block", label: `Open slot ${kind.value}` }];
  }
  if (kind.kind === "address") {
    return [
      { path: `/on-chain/token/${kind.value}`, view: "world", label: "Open as token" },
      { path: `/on-chain/wallet/${kind.value}`, view: "wallets", label: "Open as account" },
    ];
  }
  return [];
}
