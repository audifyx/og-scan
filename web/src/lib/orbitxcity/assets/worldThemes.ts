/** Per-city visual theme — fog, sky, accents. Used by CityEnvironment + prop scatter. */
import type { CityId } from "../types";

export interface WorldTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  neon: string;
  warm: string;
  magenta: string;
  background: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  groundTint: string;
}

const THEMES: Record<CityId, WorldTheme> = {
  nyc: {
    id: "nyc-midtown",
    name: "OrbitX NYC",
    primary: "#5b8def",
    secondary: "#3de7ff",
    neon: "#00ff9f",
    warm: "#c5a26f",
    magenta: "#ff4d6a",
    background: "#8eb4cc",
    fog: "#9cb8c8",
    hemiSky: "#d0e4f4",
    hemiGround: "#6a8a62",
    sun: "#fff4d8",
    groundTint: "#5a6a58",
  },
  boston: {
    id: "boston-lab",
    name: "OrbitX Boston",
    primary: "#5b8def",
    secondary: "#3de7ff",
    neon: "#00ff9f",
    warm: "#c5a26f",
    magenta: "#a78bfa",
    background: "#8aa8b8",
    fog: "#9ab0c0",
    hemiSky: "#c8d8e8",
    hemiGround: "#6a7a62",
    sun: "#fff4d8",
    groundTint: "#5a6a58",
  },
  miami: {
    id: "miami-coast",
    name: "OrbitX Miami",
    primary: "#3d9a6a",
    secondary: "#5b8def",
    neon: "#00ff9f",
    warm: "#c5a26f",
    magenta: "#ff4d6a",
    background: "#7eb8c8",
    fog: "#8ec4d0",
    hemiSky: "#d0eef4",
    hemiGround: "#6a9a72",
    sun: "#fff6d0",
    groundTint: "#5a8a68",
  },
  la: {
    id: "la-creator",
    name: "OrbitX LA",
    primary: "#b388ff",
    secondary: "#5b8def",
    neon: "#00ff9f",
    warm: "#c5a26f",
    magenta: "#ff4d6a",
    background: "#8aa0c0",
    fog: "#9aaccc",
    hemiSky: "#d4d8f0",
    hemiGround: "#7a6a62",
    sun: "#ffe8c8",
    groundTint: "#6a5a58",
  },
};

export function getWorldTheme(cityId: CityId): WorldTheme {
  return THEMES[cityId] ?? THEMES.nyc;
}

/** Mega-screen placements per city. */
export function getMarketScreenPlacements(cityId: CityId): Array<{
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
}> {
  switch (cityId) {
    case "miami":
      return [
        { position: [-9, 6.5, 24], rotationY: Math.PI * 0.08, width: 7.2, height: 4 },
        { position: [24, 6, -15], rotationY: Math.PI * 0.82, width: 6.2, height: 3.5 },
      ];
    case "la":
      return [
        { position: [0, 9.5, 13.8], rotationY: Math.PI, width: 8.4, height: 4.6 },
        { position: [38, 10.5, 4.8], rotationY: -Math.PI / 2, width: 7, height: 4 },
      ];
    case "nyc":
    case "boston":
    default:
      return [
        { position: [18, 11.5, 15.4], rotationY: Math.PI * 0.78, width: 8.5, height: 4.8 },
        { position: [-4.2, 6.2, 17.8], rotationY: Math.PI * -0.12, width: 6.5, height: 3.6 },
      ];
  }
}
