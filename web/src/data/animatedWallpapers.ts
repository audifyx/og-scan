export interface AnimatedWallpaperPreset {
  id: string;
  name: string;
  category: string;
  type: "css-3d";
  config: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    shapes: { kind: "cube" | "pyramid" | "torus" | "icosa" | "ring" | "sphere"; count: number; size: number; spread: number; speed: number; opacity: number }[];
    grid?: { show: boolean; opacity: number; color: string };
    perspective: number;
    ambientLight: boolean;
  };
}

const COLORS = {
  neonPink: "#ff2d95",
  neonPurple: "#b026ff",
  neonCyan: "#00f0ff",
  neonBlue: "#0066ff",
  neonGreen: "#39ff14",
  neonYellow: "#f7ff00",
  neonOrange: "#ff6a00",
  deepSpace: "#05070a",
  obsidian: "#0a0a0f",
  midnight: "#020205",
  eclipse: "#12001b",
  arctic: "#e0f7fa",
  frost: "#b2ebf2",
  emerald: "#00e676",
  gold: "#ffd700",
  rose: "#ff4081",
  violet: "#7c4dff",
  sky: "#29b6f6",
  coral: "#ff6e40",
  mint: "#69f0ae",
  lavender: "#b388ff",
  peach: "#ffab91",
  teal: "#1de9b6",
  amber: "#ffab00",
  indigo: "#3d5afe",
};

function makePreset(
  id: string,
  name: string,
  category: string,
  c: { primary: string; secondary: string; accent: string; background: string; shapes: AnimatedWallpaperPreset["config"]["shapes"]; grid?: { show: boolean; opacity: number; color: string }; perspective?: number; ambientLight?: boolean }
): AnimatedWallpaperPreset {
  return {
    id,
    name,
    category,
    type: "css-3d",
    config: {
      primary: c.primary,
      secondary: c.secondary,
      accent: c.accent,
      background: c.background,
      shapes: c.shapes,
      grid: c.grid,
      perspective: c.perspective ?? 1000,
      ambientLight: c.ambientLight ?? true,
    },
  };
}

export const ANIMATED_WALLPAPERS: AnimatedWallpaperPreset[] = [
  // ── NEON NEXUS (6) ──
  makePreset("neon-nexus-classic", "Neon Nexus Classic", "Neon Nexus", {
    primary: COLORS.neonPink, secondary: COLORS.neonPurple, accent: COLORS.neonCyan, background: COLORS.deepSpace,
    perspective: 900,
    shapes: [
      { kind: "cube", count: 8, size: 90, spread: 70, speed: 18, opacity: 0.85 },
      { kind: "ring", count: 4, size: 160, spread: 50, speed: 24, opacity: 0.65 },
      { kind: "torus", count: 3, size: 120, spread: 60, speed: 20, opacity: 0.7 },
    ],
  }),
  makePreset("neon-nexus-blue", "Neon Nexus Blue", "Neon Nexus", {
    primary: COLORS.neonCyan, secondary: COLORS.neonBlue, accent: COLORS.neonPurple, background: COLORS.obsidian,
    perspective: 1000,
    shapes: [
      { kind: "icosa", count: 6, size: 100, spread: 65, speed: 16, opacity: 0.8 },
      { kind: "ring", count: 5, size: 180, spread: 55, speed: 22, opacity: 0.6 },
    ],
  }),
  makePreset("neon-nexus-green", "Neon Nexus Green", "Neon Nexus", {
    primary: COLORS.neonGreen, secondary: COLORS.mint, accent: COLORS.neonCyan, background: COLORS.midnight,
    perspective: 1100,
    shapes: [
      { kind: "pyramid", count: 10, size: 80, spread: 75, speed: 14, opacity: 0.9 },
      { kind: "cube", count: 5, size: 110, spread: 60, speed: 20, opacity: 0.75 },
    ],
  }),
  makePreset("neon-nexus-gold", "Neon Nexus Gold", "Neon Nexus", {
    primary: COLORS.gold, secondary: COLORS.neonOrange, accent: COLORS.neonYellow, background: "#0a0800",
    perspective: 950,
    shapes: [
      { kind: "torus", count: 6, size: 130, spread: 68, speed: 19, opacity: 0.8 },
      { kind: "sphere", count: 8, size: 70, spread: 80, speed: 15, opacity: 0.65 },
    ],
  }),
  makePreset("neon-nexus-rose", "Neon Nexus Rose", "Neon Nexus", {
    primary: COLORS.rose, secondary: COLORS.neonPink, accent: COLORS.lavender, background: COLORS.eclipse,
    perspective: 850,
    shapes: [
      { kind: "icosa", count: 7, size: 95, spread: 72, speed: 17, opacity: 0.85 },
      { kind: "cube", count: 4, size: 140, spread: 55, speed: 21, opacity: 0.7 },
    ],
  }),
  makePreset("neon-nexus-amber", "Neon Nexus Amber", "Neon Nexus", {
    primary: COLORS.amber, secondary: COLORS.coral, accent: COLORS.neonYellow, background: "#0d0800",
    perspective: 1050,
    shapes: [
      { kind: "pyramid", count: 9, size: 85, spread: 78, speed: 13, opacity: 0.88 },
      { kind: "ring", count: 6, size: 150, spread: 58, speed: 23, opacity: 0.62 },
    ],
  }),

  // ── CRYSTAL VOID (6) ──
  makePreset("crystal-void-ice", "Crystal Void Ice", "Crystal Void", {
    primary: COLORS.frost, secondary: COLORS.arctic, accent: "#ffffff", background: COLORS.midnight,
    perspective: 1300,
    shapes: [
      { kind: "icosa", count: 5, size: 140, spread: 60, speed: 22, opacity: 0.9 },
      { kind: "cube", count: 6, size: 100, spread: 70, speed: 18, opacity: 0.75 },
    ],
    grid: { show: true, opacity: 0.15, color: COLORS.frost },
  }),
  makePreset("crystal-void-purple", "Crystal Void Purple", "Crystal Void", {
    primary: COLORS.neonPurple, secondary: COLORS.violet, accent: COLORS.lavender, background: COLORS.eclipse,
    perspective: 1200,
    shapes: [
      { kind: "icosa", count: 8, size: 110, spread: 65, speed: 20, opacity: 0.85 },
      { kind: "torus", count: 4, size: 160, spread: 50, speed: 25, opacity: 0.7 },
    ],
    grid: { show: true, opacity: 0.1, color: COLORS.neonPurple },
  }),
  makePreset("crystal-void-emerald", "Crystal Void Emerald", "Crystal Void", {
    primary: COLORS.emerald, secondary: COLORS.mint, accent: "#a7ffeb", background: "#011a0f",
    perspective: 1400,
    shapes: [
      { kind: "pyramid", count: 7, size: 100, spread: 68, speed: 17, opacity: 0.88 },
      { kind: "ring", count: 5, size: 170, spread: 55, speed: 21, opacity: 0.65 },
    ],
    grid: { show: true, opacity: 0.12, color: COLORS.emerald },
  }),
  makePreset("crystal-void-rose", "Crystal Void Rose", "Crystal Void", {
    primary: COLORS.rose, secondary: "#ff80ab", accent: "#ffc1e3", background: "#120008",
    perspective: 1100,
    shapes: [
      { kind: "torus", count: 6, size: 120, spread: 70, speed: 19, opacity: 0.82 },
      { kind: "icosa", count: 5, size: 130, spread: 58, speed: 23, opacity: 0.78 },
    ],
    grid: { show: true, opacity: 0.08, color: COLORS.rose },
  }),
  makePreset("crystal-void-blue", "Crystal Void Blue", "Crystal Void", {
    primary: COLORS.neonBlue, secondary: COLORS.sky, accent: COLORS.neonCyan, background: COLORS.obsidian,
    perspective: 1250,
    shapes: [
      { kind: "cube", count: 7, size: 95, spread: 72, speed: 16, opacity: 0.84 },
      { kind: "sphere", count: 9, size: 75, spread: 80, speed: 14, opacity: 0.68 },
    ],
    grid: { show: true, opacity: 0.11, color: COLORS.neonBlue },
  }),
  makePreset("crystal-void-amber", "Crystal Void Amber", "Crystal Void", {
    primary: COLORS.amber, secondary: COLORS.gold, accent: "#fff8e1", background: "#0d0700",
    perspective: 1150,
    shapes: [
      { kind: "pyramid", count: 8, size: 105, spread: 66, speed: 21, opacity: 0.86 },
      { kind: "ring", count: 3, size: 190, spread: 48, speed: 26, opacity: 0.72 },
    ],
    grid: { show: true, opacity: 0.09, color: COLORS.amber },
  }),

  // ── HYPERSPACE (6) ──
  makePreset("hyperspace-warp", "Hyperspace Warp", "Hyperspace", {
    primary: COLORS.neonCyan, secondary: COLORS.neonPurple, accent: "#ffffff", background: COLORS.deepSpace,
    perspective: 600,
    shapes: [
      { kind: "ring", count: 12, size: 80, spread: 40, speed: 30, opacity: 0.9 },
      { kind: "torus", count: 6, size: 140, spread: 55, speed: 28, opacity: 0.75 },
    ],
    grid: { show: true, opacity: 0.2, color: COLORS.neonCyan },
  }),
  makePreset("hyperspace-drift", "Hyperspace Drift", "Hyperspace", {
    primary: COLORS.neonBlue, secondary: "#4fc3f7", accent: COLORS.neonCyan, background: "#000814",
    perspective: 700,
    shapes: [
      { kind: "sphere", count: 15, size: 40, spread: 50, speed: 24, opacity: 0.7 },
      { kind: "cube", count: 8, size: 90, spread: 60, speed: 18, opacity: 0.8 },
    ],
    grid: { show: true, opacity: 0.18, color: COLORS.neonBlue },
  }),
  makePreset("hyperspace-void", "Hyperspace Void", "Hyperspace", {
    primary: COLORS.neonPurple, secondary: COLORS.violet, accent: "#e040fb", background: "#05000a",
    perspective: 500,
    shapes: [
      { kind: "icosa", count: 9, size: 120, spread: 45, speed: 22, opacity: 0.85 },
      { kind: "ring", count: 8, size: 100, spread: 38, speed: 32, opacity: 0.7 },
    ],
    grid: { show: true, opacity: 0.22, color: COLORS.neonPurple },
  }),
  makePreset("hyperspace-nebula", "Hyperspace Nebula", "Hyperspace", {
    primary: COLORS.rose, secondary: COLORS.neonPink, accent: COLORS.lavender, background: "#0a0008",
    perspective: 800,
    shapes: [
      { kind: "torus", count: 7, size: 130, spread: 58, speed: 20, opacity: 0.78 },
      { kind: "sphere", count: 12, size: 50, spread: 65, speed: 26, opacity: 0.65 },
    ],
    grid: { show: true, opacity: 0.12, color: COLORS.rose },
  }),
  makePreset("hyperspace-gold", "Hyperspace Gold", "Hyperspace", {
    primary: COLORS.gold, secondary: COLORS.amber, accent: "#fff176", background: "#080500",
    perspective: 750,
    shapes: [
      { kind: "pyramid", count: 10, size: 85, spread: 62, speed: 19, opacity: 0.83 },
      { kind: "ring", count: 7, size: 140, spread: 52, speed: 27, opacity: 0.68 },
    ],
    grid: { show: true, opacity: 0.15, color: COLORS.gold },
  }),
  makePreset("hyperspace-mint", "Hyperspace Mint", "Hyperspace", {
    primary: COLORS.mint, secondary: COLORS.emerald, accent: "#b9f6ca", background: "#000d05",
    perspective: 900,
    shapes: [
      { kind: "cube", count: 9, size: 100, spread: 68, speed: 21, opacity: 0.82 },
      { kind: "icosa", count: 5, size: 150, spread: 50, speed: 17, opacity: 0.76 },
    ],
    grid: { show: true, opacity: 0.14, color: COLORS.mint },
  }),

  // ── SYNTHWAVE (6) ──
  makePreset("synthwave-classic", "Synthwave Classic", "Synthwave", {
    primary: "#ff71ce", secondary: "#01cdfe", accent: "#b967ff", background: "#120024",
    perspective: 800,
    shapes: [
      { kind: "ring", count: 10, size: 90, spread: 45, speed: 25, opacity: 0.9 },
      { kind: "torus", count: 5, size: 150, spread: 55, speed: 22, opacity: 0.75 },
    ],
    grid: { show: true, opacity: 0.25, color: "#ff71ce" },
  }),
  makePreset("synthwave-retro", "Synthwave Retro", "Synthwave", {
    primary: "#ff9e00", secondary: "#ff0055", accent: "#ffd500", background: "#1a0011",
    perspective: 700,
    shapes: [
      { kind: "pyramid", count: 8, size: 95, spread: 60, speed: 20, opacity: 0.85 },
      { kind: "sphere", count: 10, size: 65, spread: 70, speed: 24, opacity: 0.7 },
    ],
    grid: { show: true, opacity: 0.2, color: "#ff9e00" },
  }),
  makePreset("synthwave-purple", "Synthwave Purple", "Synthwave", {
    primary: "#b967ff", secondary: "#5e17eb", accent: "#ff71ce", background: "#0f0020",
    perspective: 950,
    shapes: [
      { kind: "icosa", count: 7, size: 110, spread: 65, speed: 18, opacity: 0.82 },
      { kind: "cube", count: 6, size: 130, spread: 58, speed: 21, opacity: 0.68 },
    ],
    grid: { show: true, opacity: 0.18, color: "#b967ff" },
  }),
  makePreset("synthwave-cyan", "Synthwave Cyan", "Synthwave", {
    primary: "#01cdfe", secondary: "#05ffa1", accent: "#b967ff", background: "#001a1a",
    perspective: 850,
    shapes: [
      { kind: "torus", count: 8, size: 120, spread: 62, speed: 19, opacity: 0.78 },
      { kind: "ring", count: 6, size: 170, spread: 50, speed: 26, opacity: 0.64 },
    ],
    grid: { show: true, opacity: 0.22, color: "#01cdfe" },
  }),
  makePreset("synthwave-sunset", "Synthwave Sunset", "Synthwave", {
    primary: "#ff5e62", secondary: "#ff9966", accent: "#ffc371", background: "#1a0505",
    perspective: 600,
    shapes: [
      { kind: "sphere", count: 12, size: 55, spread: 48, speed: 22, opacity: 0.75 },
      { kind: "cube", count: 7, size: 110, spread: 60, speed: 17, opacity: 0.82 },
    ],
    grid: { show: true, opacity: 0.28, color: "#ff5e62" },
  }),
  makePreset("synthwave-laser", "Synthwave Laser", "Synthwave", {
    primary: "#00ff87", secondary: "#60efff", accent: "#ff00ff", background: "#000a00",
    perspective: 1000,
    shapes: [
      { kind: "ring", count: 9, size: 100, spread: 52, speed: 28, opacity: 0.88 },
      { kind: "pyramid", count: 6, size: 120, spread: 58, speed: 20, opacity: 0.74 },
    ],
    grid: { show: true, opacity: 0.16, color: "#00ff87" },
  }),

  // ── CYBER GRID (6) ──
  makePreset("cyber-grid-matrix", "Cyber Grid Matrix", "Cyber Grid", {
    primary: COLORS.neonGreen, secondary: "#00ff41", accent: "#008f11", background: "#000a00",
    perspective: 500,
    shapes: [
      { kind: "cube", count: 20, size: 50, spread: 30, speed: 12, opacity: 0.9 },
    ],
    grid: { show: true, opacity: 0.4, color: COLORS.neonGreen },
  }),
  makePreset("cyber-grid-tron", "Cyber Grid TRON", "Cyber Grid", {
    primary: COLORS.neonCyan, secondary: "#00d4ff", accent: "#ffffff", background: "#000510",
    perspective: 600,
    shapes: [
      { kind: "ring", count: 15, size: 70, spread: 35, speed: 20, opacity: 0.95 },
    ],
    grid: { show: true, opacity: 0.35, color: COLORS.neonCyan },
  }),
  makePreset("cyber-grid-ghost", "Cyber Grid Ghost", "Cyber Grid", {
    primary: "#e0e0e0", secondary: "#9e9e9e", accent: "#ffffff", background: "#0a0a0a",
    perspective: 700,
    shapes: [
      { kind: "cube", count: 16, size: 60, spread: 42, speed: 15, opacity: 0.8 },
    ],
    grid: { show: true, opacity: 0.3, color: "#e0e0e0" },
  }),
  makePreset("cyber-grid-synth", "Cyber Grid Synth", "Cyber Grid", {
    primary: COLORS.neonPink, secondary: COLORS.neonPurple, accent: COLORS.neonCyan, background: "#0a0014",
    perspective: 550,
    shapes: [
      { kind: "torus", count: 10, size: 80, spread: 38, speed: 22, opacity: 0.85 },
    ],
    grid: { show: true, opacity: 0.32, color: COLORS.neonPink },
  }),
  makePreset("cyber-grid-amber", "Cyber Grid Amber", "Cyber Grid", {
    primary: COLORS.amber, secondary: COLORS.gold, accent: "#fff8e1", background: "#0a0500",
    perspective: 650,
    shapes: [
      { kind: "pyramid", count: 14, size: 55, spread: 40, speed: 18, opacity: 0.88 },
    ],
    grid: { show: true, opacity: 0.28, color: COLORS.amber },
  }),
  makePreset("cyber-grid-teal", "Cyber Grid Teal", "Cyber Grid", {
    primary: COLORS.teal, secondary: COLORS.mint, accent: "#a7ffeb", background: "#000d0a",
    perspective: 750,
    shapes: [
      { kind: "icosa", count: 12, size: 65, spread: 45, speed: 16, opacity: 0.82 },
    ],
    grid: { show: true, opacity: 0.26, color: COLORS.teal },
  }),

  // ── VOID GEOMETRY (6) ──
  makePreset("void-geometry-dark", "Void Geometry Dark", "Void Geometry", {
    primary: "#424242", secondary: "#9e9e9e", accent: "#ffffff", background: COLORS.deepSpace,
    perspective: 1200,
    shapes: [
      { kind: "icosa", count: 5, size: 160, spread: 55, speed: 26, opacity: 0.9 },
      { kind: "cube", count: 4, size: 180, spread: 50, speed: 22, opacity: 0.75 },
    ],
  }),
  makePreset("void-geometry-neon", "Void Geometry Neon", "Void Geometry", {
    primary: COLORS.neonCyan, secondary: COLORS.neonPink, accent: "#ffffff", background: "#020205",
    perspective: 1000,
    shapes: [
      { kind: "torus", count: 6, size: 150, spread: 60, speed: 24, opacity: 0.88 },
      { kind: "pyramid", count: 5, size: 170, spread: 55, speed: 20, opacity: 0.72 },
    ],
  }),
  makePreset("void-geometry-mono", "Void Geometry Mono", "Void Geometry", {
    primary: "#f5f5f5", secondary: "#bdbdbd", accent: "#e0e0e0", background: "#000000",
    perspective: 1400,
    shapes: [
      { kind: "cube", count: 8, size: 120, spread: 65, speed: 19, opacity: 0.9 },
      { kind: "ring", count: 4, size: 200, spread: 48, speed: 25, opacity: 0.75 },
    ],
  }),
  makePreset("void-geometry-warm", "Void Geometry Warm", "Void Geometry", {
    primary: COLORS.coral, secondary: COLORS.amber, accent: COLORS.gold, background: "#0d0500",
    perspective: 1100,
    shapes: [
      { kind: "sphere", count: 10, size: 90, spread: 70, speed: 17, opacity: 0.85 },
      { kind: "icosa", count: 4, size: 160, spread: 52, speed: 23, opacity: 0.78 },
    ],
  }),
  makePreset("void-geometry-cool", "Void Geometry Cool", "Void Geometry", {
    primary: COLORS.sky, secondary: COLORS.neonCyan, accent: COLORS.frost, background: "#00080a",
    perspective: 1300,
    shapes: [
      { kind: "torus", count: 7, size: 140, spread: 62, speed: 21, opacity: 0.82 },
      { kind: "cube", count: 5, size: 150, spread: 55, speed: 24, opacity: 0.7 },
    ],
  }),
  makePreset("void-geometry-royal", "Void Geometry Royal", "Void Geometry", {
    primary: COLORS.neonPurple, secondary: COLORS.indigo, accent: COLORS.lavender, background: "#050008",
    perspective: 1150,
    shapes: [
      { kind: "pyramid", count: 6, size: 140, spread: 58, speed: 22, opacity: 0.86 },
      { kind: "ring", count: 5, size: 180, spread: 50, speed: 26, opacity: 0.72 },
    ],
  }),

  // ── LIQUID CHROME (6) ──
  makePreset("liquid-chrome-classic", "Liquid Chrome Classic", "Liquid Chrome", {
    primary: "#e0e0e0", secondary: "#9e9e9e", accent: "#ffffff", background: "#0a0a0a",
    perspective: 900,
    shapes: [
      { kind: "sphere", count: 6, size: 140, spread: 65, speed: 22, opacity: 0.9 },
      { kind: "torus", count: 4, size: 160, spread: 58, speed: 26, opacity: 0.75 },
    ],
  }),
  makePreset("liquid-chrome-blue", "Liquid Chrome Blue", "Liquid Chrome", {
    primary: COLORS.neonBlue, secondary: "#4fc3f7", accent: "#ffffff", background: "#000810",
    perspective: 950,
    shapes: [
      { kind: "icosa", count: 7, size: 130, spread: 62, speed: 20, opacity: 0.88 },
      { kind: "cube", count: 5, size: 145, spread: 55, speed: 24, opacity: 0.73 },
    ],
  }),
  makePreset("liquid-chrome-rose", "Liquid Chrome Rose", "Liquid Chrome", {
    primary: COLORS.rose, secondary: "#ff80ab", accent: "#ffffff", background: "#0a0005",
    perspective: 870,
    shapes: [
      { kind: "torus", count: 6, size: 135, spread: 60, speed: 21, opacity: 0.85 },
      { kind: "sphere", count: 8, size: 100, spread: 68, speed: 19, opacity: 0.72 },
    ],
  }),
  makePreset("liquid-chrome-purple", "Liquid Chrome Purple", "Liquid Chrome", {
    primary: COLORS.neonPurple, secondary: COLORS.violet, accent: "#ffffff", background: "#06000a",
    perspective: 1000,
    shapes: [
      { kind: "pyramid", count: 8, size: 120, spread: 66, speed: 23, opacity: 0.87 },
      { kind: "icosa", count: 4, size: 170, spread: 52, speed: 18, opacity: 0.76 },
    ],
  }),
  makePreset("liquid-chrome-green", "Liquid Chrome Green", "Liquid Chrome", {
    primary: COLORS.emerald, secondary: COLORS.mint, accent: "#ffffff", background: "#000a05",
    perspective: 1050,
    shapes: [
      { kind: "cube", count: 7, size: 125, spread: 64, speed: 19, opacity: 0.83 },
      { kind: "ring", count: 5, size: 185, spread: 50, speed: 25, opacity: 0.7 },
    ],
  }),
  makePreset("liquid-chrome-gold", "Liquid Chrome Gold", "Liquid Chrome", {
    primary: COLORS.gold, secondary: COLORS.amber, accent: "#ffffff", background: "#0a0800",
    perspective: 920,
    shapes: [
      { kind: "torus", count: 5, size: 155, spread: 57, speed: 24, opacity: 0.86 },
      { kind: "pyramid", count: 6, size: 140, spread: 60, speed: 20, opacity: 0.74 },
    ],
  }),

  // ── AURORA (6) ──
  makePreset("aurora-borealis", "Aurora Borealis", "Aurora", {
    primary: "#00ff87", secondary: "#60efff", accent: "#ff00ff", background: "#000a0a",
    perspective: 800,
    shapes: [
      { kind: "ring", count: 8, size: 120, spread: 60, speed: 20, opacity: 0.8 },
      { kind: "icosa", count: 5, size: 140, spread: 55, speed: 22, opacity: 0.7 },
    ],
    grid: { show: true, opacity: 0.08, color: "#00ff87" },
  }),
  makePreset("aurora-sydney", "Aurora Sydney", "Aurora", {
    primary: "#ff00ff", secondary: "#9d00ff", accent: "#4d00ff", background: "#050005",
    perspective: 750,
    shapes: [
      { kind: "torus", count: 7, size: 130, spread: 58, speed: 21, opacity: 0.78 },
      { kind: "cube", count: 6, size: 110, spread: 62, speed: 19, opacity: 0.72 },
    ],
    grid: { show: true, opacity: 0.1, color: "#ff00ff" },
  }),
  makePreset("aurora-yukon", "Aurora Yukon", "Aurora", {
    primary: "#00ff41", secondary: "#00e5ff", accent: "#76ff03", background: "#000a02",
    perspective: 850,
    shapes: [
      { kind: "pyramid", count: 9, size: 100, spread: 68, speed: 18, opacity: 0.82 },
      { kind: "ring", count: 5, size: 170, spread: 52, speed: 24, opacity: 0.68 },
    ],
    grid: { show: true, opacity: 0.07, color: "#00ff41" },
  }),
  makePreset("aurora-iceland", "Aurora Iceland", "Aurora", {
    primary: COLORS.sky, secondary: "#e1f5fe", accent: COLORS.frost, background: "#000510",
    perspective: 900,
    shapes: [
      { kind: "icosa", count: 6, size: 130, spread: 60, speed: 20, opacity: 0.8 },
      { kind: "sphere", count: 8, size: 90, spread: 70, speed: 17, opacity: 0.68 },
    ],
    grid: { show: true, opacity: 0.09, color: COLORS.sky },
  }),
  makePreset("aurora-norway", "Aurora Norway", "Aurora", {
    primary: "#1de9b6", secondary: "#00bfa5", accent: "#a7ffeb", background: "#000d08",
    perspective: 780,
    shapes: [
      { kind: "torus", count: 6, size: 140, spread: 62, speed: 19, opacity: 0.76 },
      { kind: "cube", count: 7, size: 115, spread: 65, speed: 22, opacity: 0.7 },
    ],
    grid: { show: true, opacity: 0.08, color: "#1de9b6" },
  }),
  makePreset("aurora-scandinavia", "Aurora Scandinavia", "Aurora", {
    primary: COLORS.lavender, secondary: "#7c4dff", accent: "#b388ff", background: "#050008",
    perspective: 830,
    shapes: [
      { kind: "ring", count: 7, size: 135, spread: 56, speed: 23, opacity: 0.77 },
      { kind: "pyramid", count: 5, size: 150, spread: 52, speed: 20, opacity: 0.73 },
    ],
    grid: { show: true, opacity: 0.1, color: COLORS.lavender },
  }),

  // ── DEEP OCEAN (4) ──
  makePreset("deep-ocean-abyss", "Deep Ocean Abyss", "Deep Ocean", {
    primary: "#0277bd", secondary: "#01579b", accent: "#4fc3f7", background: "#000510",
    perspective: 1600,
    shapes: [
      { kind: "sphere", count: 12, size: 60, spread: 75, speed: 16, opacity: 0.7 },
      { kind: "torus", count: 5, size: 150, spread: 55, speed: 20, opacity: 0.6 },
    ],
  }),
  makePreset("deep-ocean-reef", "Deep Ocean Reef", "Deep Ocean", {
    primary: "#00bfa5", secondary: COLORS.teal, accent: "#a7ffeb", background: "#000d0a",
    perspective: 1500,
    shapes: [
      { kind: "icosa", count: 8, size: 100, spread: 68, speed: 18, opacity: 0.75 },
      { kind: "pyramid", count: 6, size: 110, spread: 62, speed: 22, opacity: 0.65 },
    ],
  }),
  makePreset("deep-ocean-trench", "Deep Ocean Trench", "Deep Ocean", {
    primary: "#0d47a1", secondary: "#1a237e", accent: "#448aff", background: "#000208",
    perspective: 1800,
    shapes: [
      { kind: "cube", count: 10, size: 80, spread: 72, speed: 14, opacity: 0.82 },
      { kind: "ring", count: 4, size: 190, spread: 48, speed: 24, opacity: 0.68 },
    ],
  }),
  makePreset("deep-ocean-surface", "Deep Ocean Surface", "Deep Ocean", {
    primary: COLORS.sky, secondary: "#4fc3f7", accent: "#e1f5fe", background: "#000a14",
    perspective: 1400,
    shapes: [
      { kind: "torus", count: 7, size: 130, spread: 60, speed: 19, opacity: 0.72 },
      { kind: "sphere", count: 10, size: 70, spread: 78, speed: 15, opacity: 0.62 },
    ],
  }),
];

export const ANIMATED_WALLPAPER_CATEGORIES = [...new Set(ANIMATED_WALLPAPERS.map((w) => w.category))];
