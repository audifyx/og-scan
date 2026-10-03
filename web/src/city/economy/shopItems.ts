/**
 * OrbitX City — in-game shop catalog.
 *
 * Premium items are priced in whole ORBITX and BURNED on purchase through the
 * canonical burnPurchase() flow (backend-signed desk-wallet burn, real
 * on-chain). Style items unlock trader looks in the Select Trader screen;
 * parts unlock accessories; boosts are timed gameplay buffs.
 */

export type CityShopKind = "style" | "part" | "boost";

export interface CityShopItem {
  id: string;
  name: string;
  blurb: string;
  /** Whole ORBITX burned on purchase. */
  priceOrbitx: number;
  kind: CityShopKind;
  /** Emoji fallback glyph shown on the card. */
  glyph: string;
  accent: "cyan" | "gold" | "purple";
}

export const CITY_SHOP_ITEMS: CityShopItem[] = [
  { id: "style-degen", name: "DEGEN", blurb: "Default trader. Teal hoodie, beanie, gold chain.", priceOrbitx: 0, kind: "style", glyph: "🧥", accent: "cyan" },
  { id: "style-sniper", name: "SNIPER", blurb: "Black cap, cyan visor eyes, tactical jacket.", priceOrbitx: 500, kind: "style", glyph: "🎯", accent: "cyan" },
  { id: "style-visor", name: "VISOR", blurb: "Cyan visor, black jacket, scanner-ready.", priceOrbitx: 750, kind: "style", glyph: "🕶️", accent: "cyan" },
  { id: "style-bomber", name: "BOMBER", blurb: "Purple-accent bomber jacket.", priceOrbitx: 750, kind: "style", glyph: "🧨", accent: "purple" },
  { id: "style-fox", name: "FOX", blurb: "Fox head mesh. Same body, full attitude.", priceOrbitx: 1000, kind: "style", glyph: "🦊", accent: "gold" },
  { id: "style-suit", name: "SUIT", blurb: "Gold-trim suit. For serious money.", priceOrbitx: 1500, kind: "style", glyph: "🤵", accent: "gold" },
  { id: "part-chain", name: "Gold chain", blurb: "Chunky gold chain accessory.", priceOrbitx: 250, kind: "part", glyph: "⛓️", accent: "gold" },
  { id: "part-scanner", name: "Scanner tablet", blurb: "Handheld scanner with live waveform.", priceOrbitx: 300, kind: "part", glyph: "📟", accent: "cyan" },
  { id: "part-phone", name: "OrbitX phone", blurb: "Gold-trim phone, always in hand.", priceOrbitx: 200, kind: "part", glyph: "📱", accent: "cyan" },
  { id: "boost-run", name: "Turbo boots", blurb: "+25% run speed for 24h.", priceOrbitx: 200, kind: "boost", glyph: "🥾", accent: "cyan" },
  { id: "boost-scan", name: "Deep scan", blurb: "SCAN reveals 2x radius for 24h.", priceOrbitx: 150, kind: "boost", glyph: "📡", accent: "purple" },
  { id: "boost-pps", name: "PPS overdrive", blurb: "PPS charges 2x faster for 24h.", priceOrbitx: 300, kind: "boost", glyph: "⚡", accent: "gold" },
];

export function shopItemById(id: string): CityShopItem | undefined {
  return CITY_SHOP_ITEMS.find((i) => i.id === id);
}
