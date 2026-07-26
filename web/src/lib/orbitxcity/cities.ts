import type { CityDefinition } from "./types";

/** Multi-city roadmap. Milestone 1 unlocks OrbitX NYC demo block only. */
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
    tagline: "Community coast",
    purpose: "Conferences, social plazas, community events.",
    accent: "#00ffc3",
    unlocked: false,
  },
  {
    id: "la",
    name: "OrbitX LA",
    tagline: "Creator strip",
    purpose: "Creators, marketing, entertainment stages.",
    accent: "#7dffb0",
    unlocked: false,
  },
  {
    id: "boston",
    name: "OrbitX Boston",
    tagline: "Innovation core",
    purpose: "Developers, AI labs, protocol R&D.",
    accent: "#c5a26f",
    unlocked: false,
  },
];

export function getCity(id: string): CityDefinition | undefined {
  return ORBITX_CITIES.find((c) => c.id === id);
}
