/**
 * OrbitXCity — Gadgets module catalog.
 *
 * Every price is whole ORBITX and is BURNED (backend-signed) on purchase —
 * the city is a burn engine (billing rule #20). The game never custodies keys.
 */
import type { GadgetId } from "./types";

export interface GadgetCatalogItem {
  id: GadgetId;
  label: string;
  tagline: string;
  description: string;
  priceOrbitx: number; // whole ORBITX, burned on purchase
  icon: string; // emoji/text glyph — no asset deps
  controls: string; // how to use it in-world
  category: "traversal" | "intel";
}

/** Tokens the scanner can overlay. Same mints the core HUD tracks. */
export const SCAN_MINTS = [
  "So11111111111111111111111111111111111111112",
  "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPBAA7",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "EKpQGSJtjMFqKZ9KQanSqYXRcwiUd5R8ZEWHz5MCFG4rq",
] as const;

export const SCAN_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9": "ORBITX",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPBAA7: "BONK",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
  EKpQGSJtjMFqKZ9KQanSqYXRcwiUd5R8ZEWHz5MCFG4rq: "WIF",
};

/** Friendly display names for scanned buildings. */
export const SCAN_BUILDING_NAMES = [
  "Meridian Tower",
  "Helios Exchange",
  "Nova Spire",
  "Cobalt Plaza",
  "Aurora Block",
];

export const GADGET_CATALOG: GadgetCatalogItem[] = [
  {
    id: "grappling-hook",
    label: "Grapple Hook",
    tagline: "Own the skyline.",
    description:
      "Fire a cable at any rooftop, ledge or tower and reel yourself in. Swing across streets, scale skyscrapers, escape on foot. Pure traversal freedom.",
    priceOrbitx: 25,
    icon: "🪝",
    controls: "Equip, then press G (or the GRAPPLE button) to fire at whatever you're aiming at. Press G again or jump to release.",
    category: "traversal",
  },
  {
    id: "token-scanner",
    label: "Token Scanner",
    tagline: "Read the city like a chart.",
    description:
      "Aim at any tagged tower to overlay LIVE token data — price, 24h change, volume, liquidity and market cap streamed straight from DexScreener.",
    priceOrbitx: 15,
    icon: "📡",
    controls: "Equip, then press V (or the SCAN button) to toggle the scanner. Aim at a building to read its token.",
    category: "intel",
  },
];

export function getGadget(id: GadgetId): GadgetCatalogItem {
  const item = GADGET_CATALOG.find((g) => g.id === id);
  if (!item) throw new Error(`Unknown gadget: ${id}`);
  return item;
}

/** Total ORBITX burned to own the full catalog (shown in the shop header). */
export function catalogBurnTotal(): number {
  return GADGET_CATALOG.reduce((sum, g) => sum + g.priceOrbitx, 0);
}
