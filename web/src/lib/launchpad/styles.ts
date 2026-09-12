import type { LaunchStyle } from "./types";

export type StyleMeta = {
  id: LaunchStyle;
  label: string;
  hint: string;
  live: boolean;
  refuse?: string;
};

export const STYLE_CATALOG: StyleMeta[] = [
  { id: "curve", label: "Curve", hint: "Virtual CP / Pump create", live: true },
  {
    id: "delay",
    label: "Delay open",
    hint: "Pool exists, swaps revert until T",
    live: false,
    refuse: "Delay-open is indexed on the intent. On-chain swap gate ships with pad-router — coin still launches on curve now.",
  },
  {
    id: "dutch",
    label: "Dutch / LBP",
    hint: "Start high, weights fall",
    live: false,
    refuse: "Dutch/LBP needs Meteora time weights. Style is stored; create stays on curve until that venue is wired.",
  },
  {
    id: "batch",
    label: "Batch auction",
    hint: "Sealed bids, uniform clear",
    live: false,
    refuse: "Batch auction needs a custom program. Style is stored; create stays on curve.",
  },
  {
    id: "ido_then_curve",
    label: "IDO then curve",
    hint: "Cap sale, leftover on curve",
    live: false,
    refuse: "Fixed IDO window is not live. Style is stored; create stays on curve.",
  },
];

export function styleMeta(id: LaunchStyle): StyleMeta {
  return STYLE_CATALOG.find((s) => s.id === id) ?? STYLE_CATALOG[0];
}

export function visibleStyles(): StyleMeta[] {
  return STYLE_CATALOG;
}
