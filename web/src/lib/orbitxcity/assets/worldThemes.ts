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
    background: "#141c26",
    fog: "#1a2430",
    hemiSky: "#2a3848",
    hemiGround: "#12161c",
    sun: "#d0d8e0",
    groundTint: "#1a2228",
  },
  boston: {
    id: "boston-lab",
    name: "OrbitX Boston",
    primary: "#5b8def",
    secondary: "#3de7ff",
    neon: "#00ff9f",
    warm: "#c5a26f",
    magenta: "#a78bfa",
    background: "#141c26",
    fog: "#1a2430",
    hemiSky: "#2a3848",
    hemiGround: "#12161c",
    sun: "#d0d8e0",
    groundTint: "#1a2420",
  },
  miami: {
    id: "miami-coast",
    name: "OrbitX Miami",
    primary: "#3d9a6a",
    secondary: "#5b8def",
    neon: "#00ff9f",
    warm: "#c5a26f",
    magenta: "#ff4d6a",
    background: "#162028",
    fog: "#1c2a34",
    hemiSky: "#2a3c48",
    hemiGround: "#12181c",
    sun: "#c8d4dc",
    groundTint: "#1a2830",
  },
  la: {
    id: "la-creator",
    name: "OrbitX LA",
    primary: "#b388ff",
    secondary: "#5b8def",
    neon: "#00ff9f",
    warm: "#c5a26f",
    magenta: "#ff4d6a",
    background: "#1a1624",
    fog: "#241c30",
    hemiSky: "#322848",
    hemiGround: "#141018",
    sun: "#d4c8e0",
    groundTint: "#221828",
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
