import type { StreetSegment, WorldBlockConfig } from "./types";
import { FARTCOIN_CANONICAL_MINT, OGSCAN_TOKEN_MINT } from "@/lib/og";

/**
 * OrbitX NYC — full downtown map.
 * Core crossroads (HQ / Meme Market / Launch Arena / Trading Floor / Social Hub)
 * ringed by outer districts: Casino, Nightlife, NFT, Financial, Education,
 * Prediction, Token Mall, and City Park. Everything below is data — renderers
 * (streets, lamps, buildings, minimap, colliders) derive from this config.
 */

/** Street network — Ground, curbs, lamps, and the minimap all read this. */
export const STREETS: StreetSegment[] = [
  // Main avenue: HQ plaza → Cinema
  { o: "v", at: 0, from: -12, to: 38, w: 6, curbA: "#17ff4d", curbB: "#3de7ff" },
  // Main cross street
  { o: "h", at: 0, from: -54, to: 54, w: 6, curbA: "#ff4d9a", curbB: "#f5c542" },
  // Ring roads
  { o: "h", at: 28, from: -54, to: 54, w: 5, curbA: "#3de7ff", curbB: "#a78bfa" },
  { o: "h", at: -28, from: -54, to: 54, w: 5, curbA: "#f5c542", curbB: "#17ff4d" },
  { o: "v", at: 28, from: -54, to: 54, w: 5, curbA: "#a78bfa", curbB: "#ff4d9a" },
  { o: "v", at: -28, from: -54, to: 54, w: 5, curbA: "#17ff4d", curbB: "#3de7ff" },
];

export const WORLD_SIZE = 116;

export const NYC_DEMO_BLOCK: WorldBlockConfig = {
  cityId: "nyc",
  name: "OrbitX City · NYC Downtown",
  spawn: { x: 0, y: 0, z: 8 },
  bounds: { minX: -56, maxX: 56, minZ: -56, maxZ: 56 },
  districts: [
    { id: "hq", cityId: "nyc", kind: "hq", name: "OrbitX HQ", description: "Main headquarters and world entry plaza.", center: { x: 0, y: 0, z: -14 }, size: { width: 16, depth: 12 } },
    { id: "meme", cityId: "nyc", kind: "meme_market", name: "Meme Market", description: "Discover and buy real meme coins from virtual storefronts.", center: { x: -14, y: 0, z: 0 }, size: { width: 14, depth: 14 } },
    { id: "launch", cityId: "nyc", kind: "launch", name: "Launch Arena", description: "Live token launches powered by OrbitX Launchpad.", center: { x: 14, y: 0, z: 0 }, size: { width: 14, depth: 14 } },
    { id: "trading", cityId: "nyc", kind: "trading", name: "Trading Floor", description: "Live charts, market activity, trader energy.", center: { x: 0, y: 0, z: 14 }, size: { width: 16, depth: 12 } },
    { id: "social", cityId: "nyc", kind: "social", name: "Social District", description: "Communities and conversations.", center: { x: -14, y: 0, z: 14 }, size: { width: 12, depth: 10 } },
    { id: "ads", cityId: "nyc", kind: "advertising", name: "Advertising District", description: "Project billboards and sponsored skyline.", center: { x: 14, y: 0, z: 14 }, size: { width: 12, depth: 10 } },
    { id: "casino", cityId: "nyc", kind: "community", name: "Casino District", description: "Royal Orbit Casino, Hotel Nebula, and the Bank.", center: { x: 42, y: 0, z: 4 }, size: { width: 24, depth: 40 } },
    { id: "nftd", cityId: "nyc", kind: "creator", name: "NFT District", description: "Gallery, museum, and the AI Center.", center: { x: -42, y: 0, z: 4 }, size: { width: 24, depth: 40 } },
    { id: "night", cityId: "nyc", kind: "social", name: "Nightlife District", description: "PULSE club, arcade, and the cinema strip.", center: { x: 0, y: 0, z: 44 }, size: { width: 50, depth: 22 } },
    { id: "edu", cityId: "nyc", kind: "developer", name: "Uptown", description: "Academy, Prediction Center, and the Token Mall.", center: { x: 0, y: 0, z: -42 }, size: { width: 50, depth: 22 } },
    { id: "park", cityId: "nyc", kind: "community", name: "City Park", description: "Trees, pond, and a quiet skyline view.", center: { x: -42, y: 0, z: -42 }, size: { width: 22, depth: 22 } },
  ],
  buildings: [
    // ── Core block ──
    { id: "b-hq", districtId: "hq", kind: "hq", name: "OrbitX HQ", position: { x: 0, y: 0, z: -16 }, size: { width: 10, height: 14, depth: 8 }, color: "#16294a", accent: "#17ff4d", interaction: "hq", label: "HQ" },
    { id: "b-market", districtId: "meme", kind: "market", name: "Meme Market", position: { x: -16, y: 0, z: -2 }, size: { width: 9, height: 7, depth: 9 }, color: "#2a2140", accent: "#ff4d9a", interaction: "marketplace", label: "MARKET" },
    { id: "b-shop-a", districtId: "meme", kind: "shop", name: "Token Boutique", position: { x: -16, y: 0, z: 10 }, size: { width: 5, height: 5, depth: 5 }, color: "#232c40", accent: "#3de7ff", interaction: "marketplace", label: "SHOP" },
    { id: "b-launch", districtId: "launch", kind: "launch_arena", name: "Launch Arena", position: { x: 16, y: 0, z: -2 }, size: { width: 10, height: 9, depth: 10 }, color: "#332a12", accent: "#f5c542", interaction: "launch", label: "LAUNCH" },
    { id: "b-floor", districtId: "trading", kind: "trading_floor", name: "Trading Floor", position: { x: 0, y: 0, z: 18 }, size: { width: 12, height: 8, depth: 8 }, color: "#132e38", accent: "#3de7ff", interaction: "trading", label: "TRADE" },
    { id: "b-social", districtId: "social", kind: "social_hub", name: "Social Hub", position: { x: -16, y: 0, z: 20 }, size: { width: 7, height: 6, depth: 7 }, color: "#20283c", accent: "#a78bfa", interaction: "community", label: "SOCIAL" },
    { id: "b-adtower", districtId: "ads", kind: "ad_tower", name: "Ad Tower", position: { x: 18, y: 0, z: 18 }, size: { width: 5, height: 16, depth: 5 }, color: "#1d1d30", accent: "#17ff4d", interaction: "billboard", label: "ADS" },

    // ── Casino District (east) ──
    { id: "b-casino", districtId: "casino", kind: "generic", name: "Royal Orbit Casino", position: { x: 40, y: 0, z: 10 }, size: { width: 12, height: 12, depth: 12 }, color: "#33260e", accent: "#f5c542", interaction: "games", label: "CASINO" },
    { id: "b-hotel", districtId: "casino", kind: "generic", name: "Hotel Nebula", position: { x: 40, y: 0, z: -13 }, size: { width: 8, height: 19, depth: 8 }, color: "#12303a", accent: "#3de7ff", label: "HOTEL" },
    { id: "b-bank", districtId: "casino", kind: "generic", name: "OrbitX Bank", position: { x: 46, y: 0, z: 22 }, size: { width: 7, height: 9, depth: 7 }, color: "#15352a", accent: "#17ff4d", label: "BANK" },

    // ── NFT District (west) ──
    { id: "b-nft", districtId: "nftd", kind: "generic", name: "NFT Gallery", position: { x: -40, y: 0, z: 9 }, size: { width: 10, height: 7, depth: 10 }, color: "#251d3d", accent: "#a78bfa", interaction: "nft", label: "NFT" },
    { id: "b-museum", districtId: "nftd", kind: "generic", name: "Museum of Memes", position: { x: -40, y: 0, z: -14 }, size: { width: 9, height: 6, depth: 9 }, color: "#2b2d36", accent: "#e8f1ff", label: "MUSEUM" },
    { id: "b-ai", districtId: "nftd", kind: "generic", name: "AI Center", position: { x: -46, y: 0, z: 22 }, size: { width: 7, height: 11, depth: 7 }, color: "#0f3038", accent: "#3de7ff", label: "AI" },

    // ── Uptown (north) ──
    { id: "b-academy", districtId: "edu", kind: "generic", name: "OrbitX Academy", position: { x: -14, y: 0, z: -40 }, size: { width: 8, height: 8, depth: 8 }, color: "#33280f", accent: "#f5c542", label: "ACADEMY" },
    { id: "b-predict", districtId: "edu", kind: "generic", name: "Prediction Center", position: { x: 14, y: 0, z: -40 }, size: { width: 8, height: 10, depth: 8 }, color: "#3a1a2b", accent: "#ff4d9a", interaction: "games", label: "PREDICT" },
    { id: "b-mall", districtId: "edu", kind: "market", name: "Token Mall", position: { x: 0, y: 0, z: -44 }, size: { width: 14, height: 7, depth: 9 }, color: "#173526", accent: "#17ff4d", interaction: "marketplace", label: "MALL" },

    // ── Nightlife District (south) ──
    { id: "b-club", districtId: "night", kind: "generic", name: "PULSE Nightclub", position: { x: -14, y: 0, z: 42 }, size: { width: 10, height: 9, depth: 10 }, color: "#331226", accent: "#ff4d9a", interaction: "voice", label: "PULSE" },
    { id: "b-arcade", districtId: "night", kind: "generic", name: "Neon Arcade", position: { x: 14, y: 0, z: 42 }, size: { width: 8, height: 7, depth: 8 }, color: "#102c3d", accent: "#3de7ff", interaction: "games", label: "ARCADE" },
    { id: "b-cinema", districtId: "night", kind: "generic", name: "Starlight Cinema", position: { x: 0, y: 0, z: 46 }, size: { width: 10, height: 8, depth: 8 }, color: "#241d3b", accent: "#a78bfa", label: "CINEMA" },
    { id: "b-coffee", districtId: "night", kind: "shop", name: "Orbit Brew", position: { x: 22, y: 0, z: 34 }, size: { width: 5, height: 4, depth: 5 }, color: "#302416", accent: "#ffd166", label: "COFFEE" },
  ],
  billboards: [
    {
      id: "bb-1",
      position: { x: -8, y: 5, z: -10 },
      rotationY: Math.PI / 6,
      width: 6,
      height: 3.2,
      title: "ORBITX",
      subtitle: "Official token · real wallets",
      accent: "#17ff4d",
      projectName: "OrbitX",
      tokenMint: OGSCAN_TOKEN_MINT,
      website: "https://orbitx.world",
    },
    {
      id: "bb-2",
      position: { x: 8, y: 4.5, z: -8 },
      rotationY: -Math.PI / 5,
      width: 5.5,
      height: 3,
      title: "FARTCOIN",
      subtitle: "Sponsored · Trading District",
      accent: "#ff4d9a",
      projectName: "Fartcoin",
      tokenMint: FARTCOIN_CANONICAL_MINT,
    },
    {
      id: "bb-3",
      position: { x: 12, y: 6, z: 10 },
      rotationY: Math.PI * 0.85,
      width: 5,
      height: 2.8,
      title: "LAUNCH LIVE",
      subtitle: "Create on OrbitX Launchpad",
      accent: "#f5c542",
      projectName: "Launch Arena",
    },
    {
      id: "bb-4",
      position: { x: -10, y: 5.5, z: 12 },
      rotationY: -Math.PI * 0.7,
      width: 5.2,
      height: 2.9,
      title: "SCANNER",
      subtitle: "Origin intel before you ape",
      accent: "#3de7ff",
      projectName: "OrbitX Scanner",
      website: "https://orbitx.world/ORBITX_DEX/scanner",
    },
    {
      id: "bb-casino",
      position: { x: 33, y: 5.5, z: 18 },
      rotationY: -Math.PI * 0.35,
      width: 5.4,
      height: 3,
      title: "ROYAL ORBIT",
      subtitle: "Casino district · degen games",
      accent: "#f5c542",
      projectName: "Royal Orbit Casino",
    },
    {
      id: "bb-pulse",
      position: { x: -22, y: 5.5, z: 34 },
      rotationY: Math.PI * 0.2,
      width: 5.4,
      height: 3,
      title: "PULSE",
      subtitle: "Nightlife · voice · vibes",
      accent: "#ff4d9a",
      projectName: "PULSE Nightclub",
    },
    {
      id: "bb-park",
      position: { x: -30, y: 5, z: -22 },
      rotationY: Math.PI * 0.6,
      width: 5,
      height: 2.8,
      title: "CITY PARK",
      subtitle: "Touch grass · watch charts",
      accent: "#17ff4d",
      projectName: "City Park",
    },
  ],
  zones: [
    { id: "z-hq", kind: "hq", label: "OrbitX HQ", hint: "Enter headquarters · world map & profile", position: { x: 0, y: 0, z: -10 }, radius: 4.5, buildingId: "b-hq" },
    { id: "z-market", kind: "marketplace", label: "Meme Market", hint: "Browse live OrbitX tokens", position: { x: -16, y: 0, z: 4 }, radius: 5, buildingId: "b-market" },
    { id: "z-launch", kind: "launch", label: "Launch Arena", hint: "Open OrbitX Launchpad", position: { x: 16, y: 0, z: 4 }, radius: 5, buildingId: "b-launch" },
    { id: "z-trade", kind: "trading", label: "Trading Floor", hint: "Live market tape & charts", position: { x: 0, y: 0, z: 12 }, radius: 5, buildingId: "b-floor" },
    { id: "z-social", kind: "community", label: "Social Hub", hint: "Communities, feed & voice plaza", position: { x: -16, y: 0, z: 16 }, radius: 4, buildingId: "b-social" },
    { id: "z-voice", kind: "voice", label: "Voice Plaza", hint: "Join the live OrbitX City voice channel", position: { x: 0, y: 0, z: 0 }, radius: 3.5 },
    { id: "z-bb-orbitx", kind: "token", label: "OrbitX Billboard", hint: "View live token · buy with wallet", position: { x: -8, y: 0, z: -8 }, radius: 3.5, tokenMint: OGSCAN_TOKEN_MINT },
    { id: "z-bb-fart", kind: "token", label: "Fartcoin Billboard", hint: "View live token · buy with wallet", position: { x: 8, y: 0, z: -6 }, radius: 3.5, tokenMint: FARTCOIN_CANONICAL_MINT },
    // Outer districts
    { id: "z-casino", kind: "games", label: "Royal Orbit Casino", hint: "Degen games & predictions", position: { x: 40, y: 0, z: 18 }, radius: 4.5, buildingId: "b-casino" },
    { id: "z-arcade", kind: "games", label: "Neon Arcade", hint: "OrbitX games lounge", position: { x: 14, y: 0, z: 48 }, radius: 4, buildingId: "b-arcade" },
    { id: "z-predict", kind: "games", label: "Prediction Center", hint: "Market predictions & duels", position: { x: 14, y: 0, z: -34 }, radius: 4, buildingId: "b-predict" },
    { id: "z-nft", kind: "nft", label: "NFT Gallery", hint: "OrbitX NFT marketplace", position: { x: -40, y: 0, z: 17 }, radius: 4.5, buildingId: "b-nft" },
    { id: "z-mall", kind: "marketplace", label: "Token Mall", hint: "Launchpad storefronts", position: { x: 0, y: 0, z: -37 }, radius: 4.5, buildingId: "b-mall" },
    { id: "z-club", kind: "voice", label: "PULSE Nightclub", hint: "Voice room · nightlife district", position: { x: -14, y: 0, z: 49 }, radius: 4.5, buildingId: "b-club" },
    { id: "z-hotel", kind: "community", label: "Hotel Nebula", hint: "Enter the hotel lobby", position: { x: 40, y: 0, z: -8 }, radius: 4, buildingId: "b-hotel" },
    { id: "z-bank", kind: "marketplace", label: "OrbitX Bank", hint: "Enter the bank floor", position: { x: 46, y: 0, z: 26 }, radius: 3.8, buildingId: "b-bank" },
    { id: "z-museum", kind: "nft", label: "Museum of Memes", hint: "Enter the gallery hall", position: { x: -40, y: 0, z: -9 }, radius: 4, buildingId: "b-museum" },
    { id: "z-ai", kind: "community", label: "AI Center", hint: "Enter the AI lab", position: { x: -46, y: 0, z: 26 }, radius: 3.8, buildingId: "b-ai" },
    { id: "z-academy", kind: "community", label: "OrbitX Academy", hint: "Enter the academy hall", position: { x: -14, y: 0, z: -35 }, radius: 4, buildingId: "b-academy" },
    { id: "z-cinema", kind: "community", label: "Starlight Cinema", hint: "Enter the cinema lobby", position: { x: 0, y: 0, z: 51 }, radius: 4, buildingId: "b-cinema" },
    { id: "z-coffee", kind: "marketplace", label: "Orbit Brew", hint: "Enter the neighborhood café", position: { x: 22, y: 0, z: 37 }, radius: 3.8, buildingId: "b-coffee" },
  ],
  landmarks: [
    {
      id: "nyc-midtown-screen",
      modelId: "landmark-nyc",
      position: { x: 10, y: 0, z: -6 },
      rotationY: -0.4,
      size: { width: 10, height: 14, depth: 3 },
      label: "MIDTOWN SCREEN",
    },
  ],
};

/** Safe fast-travel landing spots per district (clear of colliders). */
export const TELEPORT_POINTS: Array<{ id: string; label: string; x: number; z: number; accent: string }> = [
  { id: "hq", label: "OrbitX HQ", x: 0, z: -9, accent: "#17ff4d" },
  { id: "meme", label: "Meme Market", x: -14, z: 4, accent: "#ff4d9a" },
  { id: "launch", label: "Launch Arena", x: 14, z: 4, accent: "#f5c542" },
  { id: "trading", label: "Trading Floor", x: 0, z: 11, accent: "#3de7ff" },
  { id: "social", label: "Social Hub", x: -14, z: 14, accent: "#a78bfa" },
  { id: "casino", label: "Casino District", x: 40, z: 19, accent: "#f5c542" },
  { id: "night", label: "Nightlife", x: -14, z: 34, accent: "#ff4d9a" },
  { id: "nftd", label: "NFT District", x: -40, z: 18, accent: "#a78bfa" },
  { id: "mall", label: "Token Mall", x: 0, z: -36, accent: "#17ff4d" },
  { id: "park", label: "City Park", x: -42, z: -34, accent: "#17ff4d" },
];

/** Simple AABB colliders derived from buildings (expanded footprint). */
export function buildingColliders(block: WorldBlockConfig) {
  return block.buildings.map((b) => ({
    minX: b.position.x - b.size.width / 2 - 0.4,
    maxX: b.position.x + b.size.width / 2 + 0.4,
    minZ: b.position.z - b.size.depth / 2 - 0.4,
    maxZ: b.position.z + b.size.depth / 2 + 0.4,
  }));
}
