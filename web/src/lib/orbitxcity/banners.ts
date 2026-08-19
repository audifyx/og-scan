/**
 * Building-face banner / ad placements.
 *
 * First version is data-only + runtime mesh. An admin UI can later CRUD
 * the same shape (buildingId + face + u/v + size + imageUrl).
 *
 * Resolution order:
 *   1. `building.banners` authored on the building
 *   2. `BANNER_REGISTRY` overrides by buildingId
 *   3. Default walk-in venue banner (south face) so HQ / DEX / Games read
 */
import * as THREE from "three";
import type { BuildingBanner, BuildingDefinition, InteractionKind } from "./types";

export type { BuildingBanner, BuildingFace } from "./types";

const KIND_AD: Partial<Record<BuildingDefinition["kind"] | InteractionKind, { title: string; subtitle: string; accent: string }>> = {
  hq: { title: "ORBITX HQ", subtitle: "DEX · LAUNCH · SOCIAL", accent: "#00ff9f" },
  trading_floor: { title: "ORBITX DEX", subtitle: "LIVE TAPE", accent: "#3de7ff" },
  trading: { title: "ORBITX DEX", subtitle: "LIVE TAPE", accent: "#3de7ff" },
  launch_arena: { title: "LAUNCHPAD", subtitle: "NEW TOKENS", accent: "#f5c542" },
  launch: { title: "LAUNCHPAD", subtitle: "NEW TOKENS", accent: "#f5c542" },
  market: { title: "MEME MARKET", subtitle: "BUY THE DIP", accent: "#ff4d9a" },
  marketplace: { title: "MEME MARKET", subtitle: "BUY THE DIP", accent: "#ff4d9a" },
  social_hub: { title: "COMMUNITY", subtitle: "HANG · CHAT", accent: "#a78bfa" },
  community: { title: "COMMUNITY", subtitle: "HANG · CHAT", accent: "#a78bfa" },
  shop: { title: "GAMES DISTRICT", subtitle: "PLAY NOW", accent: "#a78bfa" },
  games: { title: "GAMES DISTRICT", subtitle: "PLAY NOW", accent: "#a78bfa" },
  ad_tower: { title: "ORBITX ADS", subtitle: "YOUR BRAND HERE", accent: "#c5a26f" },
  token: { title: "TOKEN DESK", subtitle: "JUPITER SWAP", accent: "#00ff9f" },
  nft: { title: "NFT GALLERY", subtitle: "ON-CHAIN ART", accent: "#a78bfa" },
  voice: { title: "VOICE PLAZA", subtitle: "LIVE ROOM", accent: "#ff6bcb" },
};

/** Manual placements (admin / dev). Prefer buildingId from world data. */
export const BANNER_REGISTRY: BuildingBanner[] = [];

function copyOn(banner: BuildingBanner): boolean {
  return banner.enabled !== false;
}

function defaultForBuilding(building: BuildingDefinition): BuildingBanner[] {
  const key = building.interaction ?? building.kind;
  const ad = KIND_AD[key];
  if (!ad) return [];
  return [
    {
      id: `auto-${building.id}-south`,
      buildingId: building.id,
      face: "south",
      u: 0.5,
      v: 0.62,
      width: Math.min(4.8, Math.max(2.4, building.size.width * 0.55)),
      height: 1.15,
      title: ad.title,
      subtitle: ad.subtitle,
      accent: building.accent || ad.accent,
    },
  ];
}

/** Banners to draw on a building face this frame. */
export function resolveBuildingBanners(building: BuildingDefinition): BuildingBanner[] {
  const authored = (building.banners ?? []).filter(copyOn);
  const registered = BANNER_REGISTRY.filter((b) => b.buildingId === building.id && copyOn(b));
  if (authored.length || registered.length) return [...registered, ...authored];
  return defaultForBuilding(building);
}

/** Procedural neon ad card — used when `imageUrl` is missing or fails to load. */
export function createBannerTexture(banner: BuildingBanner): THREE.CanvasTexture {
  const w = 512;
  const h = Math.max(160, Math.round(512 * (banner.height / Math.max(banner.width, 0.4))));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#070c10";
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createLinearGradient(0, 0, w, h);
  glow.addColorStop(0, `${banner.accent}33`);
  glow.addColorStop(1, "#0a1218");
  ctx.fillStyle = glow;
  ctx.fillRect(10, 10, w - 20, h - 20);
  ctx.strokeStyle = banner.accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = banner.accent;
  ctx.font = "700 48px Orbitron, Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(banner.title.slice(0, 18), w / 2, h * 0.42, w - 48);
  if (banner.subtitle) {
    ctx.fillStyle = "#e8fff4";
    ctx.font = "600 26px Sora, sans-serif";
    ctx.fillText(banner.subtitle.slice(0, 28), w / 2, h * 0.68, w - 48);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** World-space local offset for a banner on a box of `size`. */
export function bannerLocalPose(
  banner: BuildingBanner,
  size: { width: number; height: number; depth: number },
): { position: [number, number, number]; rotationY: number } {
  const y = Math.min(size.height - banner.height * 0.55, Math.max(1.4, banner.v * size.height));
  const halfW = size.width / 2;
  const halfD = size.depth / 2;
  const inset = 0.08;
  switch (banner.face) {
    case "north":
      return {
        position: [(banner.u - 0.5) * size.width * 0.7, y, -halfD - inset],
        rotationY: Math.PI,
      };
    case "east":
      return {
        position: [halfW + inset, y, (0.5 - banner.u) * size.depth * 0.7],
        rotationY: Math.PI / 2,
      };
    case "west":
      return {
        position: [-halfW - inset, y, (banner.u - 0.5) * size.depth * 0.7],
        rotationY: -Math.PI / 2,
      };
    case "south":
    default:
      return {
        position: [(banner.u - 0.5) * size.width * 0.7, y, halfD + inset],
        rotationY: 0,
      };
  }
}
