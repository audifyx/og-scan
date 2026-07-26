import type { CityDefinition } from "./types";

/** Four playable city districts, each backed by its own world block. */
export const ORBITX_CITIES: CityDefinition[] = [
  {
    id: "nyc",
    name: "OrbitX NYC",
    tagline: "Financial hub",
    purpose: "Trading district, launch events, Bloomberg-grade market energy.",
    accent: "#00ff9f",
    unlocked: true,
  },
  {
    id: "miami",
    name: "OrbitX Miami",
    tagline: "Coastal community",
    purpose: "Beach-adjacent plazas, community events, and social zones.",
    accent: "#00ffc3",
    unlocked: true,
  },
  {
    id: "la",
    name: "OrbitX LA",
    tagline: "Creator strip",
    purpose: "Creator launches, NFT culture, games, and entertainment stages.",
    accent: "#7dffb0",
    unlocked: true,
  },
  {
    id: "boston",
    name: "OrbitX Boston",
    tagline: "Innovation core",
    purpose: "Developers, AI labs, protocol R&D.",
    accent: "#c5a26f",
    unlocked: true,
  },
];

export function getCity(id: string): CityDefinition | undefined {
  return ORBITX_CITIES.find((c) => c.id === id);
}
