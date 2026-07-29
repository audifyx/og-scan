import type { StreetSegment, WorldBlockConfig } from "../types";

export const BOSTON_STREETS: StreetSegment[] = [
  { o: "h", at: 0, from: -48, to: 48, w: 7, curbA: "#c5a26f", curbB: "#3de7ff" },
  { o: "h", at: 26, from: -44, to: 44, w: 5, curbA: "#17ff4d", curbB: "#c5a26f" },
  { o: "h", at: -26, from: -44, to: 44, w: 5, curbA: "#a78bfa", curbB: "#3de7ff" },
  { o: "v", at: -26, from: -34, to: 34, w: 5, curbA: "#3de7ff", curbB: "#17ff4d" },
  { o: "v", at: 0, from: -34, to: 34, w: 6, curbA: "#c5a26f", curbB: "#a78bfa" },
  { o: "v", at: 26, from: -34, to: 34, w: 5, curbA: "#17ff4d", curbB: "#3de7ff" },
];

export const BOSTON_TELEPORT_POINTS = [
  { id: "boston-hub", label: "Innovation Hub", x: 0, z: 10, accent: "#c5a26f" },
  { id: "boston-labs", label: "Protocol Labs", x: -28, z: 4, accent: "#3de7ff" },
  { id: "boston-forge", label: "Builder Forge", x: 28, z: 4, accent: "#17ff4d" },
  { id: "boston-academy", label: "Developer Academy", x: -24, z: -20, accent: "#a78bfa" },
  { id: "boston-demo", label: "Demo Theater", x: 22, z: -20, accent: "#c5a26f" },
];

export const BOSTON_BLOCK: WorldBlockConfig = {
  cityId: "boston",
  name: "OrbitX City · Boston Innovation Core",
  spawn: { x: 0, y: 0, z: 10 },
  bounds: { minX: -52, maxX: 52, minZ: -42, maxZ: 42 },
  districts: [
    { id: "boston-hub", cityId: "boston", kind: "hq", name: "Innovation Hub", description: "Research coordination and world engineering.", center: { x: 0, y: 0, z: 12 }, size: { width: 20, depth: 16 } },
    { id: "boston-labs", cityId: "boston", kind: "developer", name: "Protocol Labs", description: "Open build rooms for on-chain tools and AI.", center: { x: -28, y: 0, z: 4 }, size: { width: 22, depth: 20 } },
    { id: "boston-forge", cityId: "boston", kind: "creator", name: "Builder Forge", description: "Creator studios and community shipping bays.", center: { x: 28, y: 0, z: 4 }, size: { width: 22, depth: 20 } },
    { id: "boston-academy", cityId: "boston", kind: "developer", name: "Developer Academy", description: "Learn, workshop, and meet fellow builders.", center: { x: -24, y: 0, z: -22 }, size: { width: 24, depth: 16 } },
    { id: "boston-demo", cityId: "boston", kind: "community", name: "Demo Theater", description: "Live project demos, launches, and town halls.", center: { x: 24, y: 0, z: -22 }, size: { width: 24, depth: 16 } },
  ],
  buildings: [
    { id: "boston-hq", districtId: "boston-hub", kind: "hq", name: "OrbitX Innovation Hub", position: { x: 0, y: 0, z: 18 }, size: { width: 12, height: 12, depth: 9 }, color: "#2b3139", accent: "#c5a26f", interaction: "hq", label: "HUB" },
    { id: "boston-lab", districtId: "boston-labs", kind: "trading_floor", name: "Protocol Lab One", position: { x: -28, y: 0, z: 8 }, size: { width: 11, height: 9, depth: 8 }, color: "#142d38", accent: "#3de7ff", interaction: "trading", label: "LABS" },
    { id: "boston-ai", districtId: "boston-labs", kind: "generic", name: "AI Research Wing", position: { x: -36, y: 0, z: -10 }, size: { width: 8, height: 12, depth: 8 }, color: "#24213a", accent: "#a78bfa", interaction: "community", label: "AI" },
    { id: "boston-forge", districtId: "boston-forge", kind: "launch_arena", name: "Builder Forge", position: { x: 28, y: 0, z: 8 }, size: { width: 12, height: 9, depth: 9 }, color: "#213526", accent: "#17ff4d", interaction: "launch", label: "FORGE" },
    { id: "boston-academy", districtId: "boston-academy", kind: "social_hub", name: "Developer Academy", position: { x: -24, y: 0, z: -24 }, size: { width: 10, height: 8, depth: 8 }, color: "#332a19", accent: "#c5a26f", interaction: "community", label: "ACADEMY" },
    { id: "boston-theater", districtId: "boston-demo", kind: "generic", name: "Demo Theater", position: { x: 24, y: 0, z: -24 }, size: { width: 12, height: 9, depth: 9 }, color: "#301c36", accent: "#a78bfa", interaction: "games", label: "DEMO" },
  ],
  billboards: [
    { id: "boston-board-1", position: { x: -10, y: 5, z: 7 }, rotationY: 0.35, width: 5.5, height: 3, title: "BUILD IN PUBLIC", subtitle: "Protocol Labs · Boston", accent: "#3de7ff" },
    { id: "boston-board-2", position: { x: 12, y: 5.5, z: 6 }, rotationY: -0.5, width: 5.5, height: 3, title: "SHIP WEEKLY", subtitle: "Builder Forge · Live demos", accent: "#17ff4d" },
  ],
  zones: [
    { id: "z-boston-hq", kind: "hq", label: "Innovation Hub", hint: "Enter world operations", position: { x: 0, y: 0, z: 23 }, radius: 4.5, buildingId: "boston-hq" },
    { id: "z-boston-lab", kind: "trading", label: "Protocol Lab One", hint: "Enter the build floor", position: { x: -28, y: 0, z: 13 }, radius: 4.5, buildingId: "boston-lab" },
    { id: "z-boston-ai", kind: "community", label: "AI Research Wing", hint: "Enter the research lounge", position: { x: -36, y: 0, z: -5 }, radius: 4, buildingId: "boston-ai" },
    { id: "z-boston-forge", kind: "launch", label: "Builder Forge", hint: "Enter the builder stage", position: { x: 28, y: 0, z: 14 }, radius: 4.5, buildingId: "boston-forge" },
    { id: "z-boston-academy", kind: "community", label: "Developer Academy", hint: "Enter the academy lounge", position: { x: -24, y: 0, z: -19 }, radius: 4, buildingId: "boston-academy" },
    { id: "z-boston-theater", kind: "games", label: "Demo Theater", hint: "Enter the project demo hall", position: { x: 24, y: 0, z: -19 }, radius: 4.5, buildingId: "boston-theater" },
  ],
  landmarks: [
    {
      id: "boston-lab-dome",
      modelId: "landmark-boston",
      position: { x: 0, y: 0, z: 4 },
      rotationY: 0,
      size: { width: 10, height: 10, depth: 10 },
      label: "LAB DOME",
    },
  ],
};
