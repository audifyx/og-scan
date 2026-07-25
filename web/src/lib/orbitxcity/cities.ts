import type { CityDefinition } from "./types";

/** Multi-city roadmap. NYC, Miami, and LA are playable blocks; Boston remains roadmap-only. */
export const ORBITX_CITIES: CityDefinition[] = [
  {
    id: "nyc",
    name: "OrbitX NYC",
    tagline: "Financial hub",
    purpose: "Trading district, launch events, Bloomberg-grade market energy.",
    accent: "#17ff4d",
    unlocked: true,
  },
  {
    id: "miami",
    name: "OrbitX Miami",
    tagline: "Coastal community",
    purpose: "Beach-adjacent plazas, community events, and social zones.",
    accent: "#3de7ff",
    unlocked: true,
  },
  {
    id: "la",
    name: "OrbitX LA",
    tagline: "Creator strip",
    purpose: "Creator launches, NFT culture, games, and entertainment stages.",
    accent: "#ff4d9a",
    unlocked: true,
  },
  {
    id: "boston",
    name: "OrbitX Boston",
    tagline: "Innovation core",
    purpose: "Developers, AI labs, protocol R&D.",
    accent: "#f5c542",
    unlocked: false,
  },
];

export function getCity(id: string): CityDefinition | undefined {
  return ORBITX_CITIES.find((c) => c.id === id);
}
