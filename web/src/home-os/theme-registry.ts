/**
 * OrbitX Home OS — theme registry + app registry (Vite port).
 *
 * Device themes re-skin the ENTIRE platform via CSS variables + chrome rules
 * in os-themes.css, keyed off data-os-* attributes on <html>. Background
 * themes and accent themes compose on top of any device theme.
 */

export type DeviceThemeId =
  | "orbitx"
  | "xbox360"
  | "ps4"
  | "wii"
  | "tds"
  | "gameboy"
  | "winpc"
  | "ios"
  | "macos"
  | "linux"
  | "cyberpunk"
  | "midnight"
  | "arcade";

export type BgThemeId = "default" | "starfield" | "grid" | "waves" | "aurora" | "none";

export type AccentId = "gold" | "teal" | "violet" | "ember" | "ice" | "rose";

export interface DeviceTheme {
  id: DeviceThemeId;
  name: string;
  tagline: string;
  blurb: string;
  /** preview swatches for the gallery card */
  preview: { bg: string; panel: string; accent: string; text: string };
}

export const DEVICE_THEMES: DeviceTheme[] = [
  {
    id: "orbitx",
    name: "OrbitX Classic",
    tagline: "The native pad",
    blurb: "The original OrbitX look. Deep space black, volt gold, glass panels.",
    preview: { bg: "#07080c", panel: "#101218", accent: "#d6ff3d", text: "#e9edf2" },
  },
  {
    id: "xbox360",
    name: "Xbox 360",
    tagline: "Blades",
    blurb: "Horizontal blades, glossy green panels, that 2005 dashboard energy.",
    preview: { bg: "#0c120c", panel: "#18241a", accent: "#7ac142", text: "#eef4e6" },
  },
  {
    id: "ps4",
    name: "PS4",
    tagline: "XMB waves",
    blurb: "Deep blue waves, floating icon strip, calm and cinematic.",
    preview: { bg: "#0a1428", panel: "#101d36", accent: "#2d7ff9", text: "#e8eefc" },
  },
  {
    id: "wii",
    name: "Wii",
    tagline: "Channels",
    blurb: "Bubbly rounded channels on clean white-blue. Playful and bright.",
    preview: { bg: "#eef3f7", panel: "#ffffff", accent: "#2aa9e0", text: "#1c2b3a" },
  },
  {
    id: "tds",
    name: "3DS",
    tagline: "Dual pane",
    blurb: "Playful dual-pane depth, candy gloss, pocket-console charm.",
    preview: { bg: "#1a1d29", panel: "#232838", accent: "#ff7a59", text: "#f2ecff" },
  },
  {
    id: "gameboy",
    name: "Game Boy",
    tagline: "Dot matrix",
    blurb: "Monochrome green, pixel type, chunky borders. 4 shades, no mercy.",
    preview: { bg: "#0f380f", panel: "#0f380f", accent: "#9bbc0f", text: "#9bbc0f" },
  },
  {
    id: "winpc",
    name: "Windows PC",
    tagline: "Desktop",
    blurb: "Taskbar, start menu energy, windowed panels with title bars.",
    preview: { bg: "#0d1626", panel: "#14202f", accent: "#3b9eff", text: "#e8eef4" },
  },
  {
    id: "ios",
    name: "iOS",
    tagline: "Springboard",
    blurb: "Rounded icons, dock, frosted blur. Pocket springboard vibes.",
    preview: { bg: "#000000", panel: "#14141a", accent: "#0a84ff", text: "#f2f2f7" },
  },
  {
    id: "macos",
    name: "macOS",
    tagline: "Aqua dock",
    blurb: "Menu bar up top, magnification dock energy, traffic-light panels.",
    preview: { bg: "#0b0d12", panel: "#16181f", accent: "#5ac8fa", text: "#eceef2" },
  },
  {
    id: "linux",
    name: "Linux",
    tagline: "Terminal",
    blurb: "Green-on-black terminal soul, monospace everywhere, hacker calm.",
    preview: { bg: "#050505", panel: "#0a0f0a", accent: "#33ff66", text: "#c8ffd8" },
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    tagline: "Night city",
    blurb: "Hot magenta on midnight violet, angular chrome, neon rain.",
    preview: { bg: "#0d0221", panel: "#160a33", accent: "#ff2a6d", text: "#ffe9f4" },
  },
  {
    id: "midnight",
    name: "Midnight OLED",
    tagline: "True black",
    blurb: "Pure black. Every pixel off that can be. Battery-saver luxury.",
    preview: { bg: "#000000", panel: "#0a0a0c", accent: "#d6ff3d", text: "#f2f4f6" },
  },
  {
    id: "arcade",
    name: "Retro Arcade",
    tagline: "Insert coin",
    blurb: "Neon grid cabinet glow, pixel type, high-score hunger.",
    preview: { bg: "#12041f", panel: "#1d0a30", accent: "#ffe74c", text: "#f6ecff" },
  },
];

export interface BgTheme {
  id: BgThemeId;
  name: string;
  blurb: string;
}

export const BG_THEMES: BgTheme[] = [
  { id: "default", name: "Default", blurb: "The theme's own backdrop" },
  { id: "starfield", name: "Starfield", blurb: "Drifting stars over deep space" },
  { id: "grid", name: "Grid", blurb: "Perspective grid floor" },
  { id: "waves", name: "Waves", blurb: "Slow aurora waves" },
  { id: "aurora", name: "Aurora", blurb: "Polar glow ribbons" },
  { id: "none", name: "None", blurb: "Flat, distraction-free" },
];

export interface AccentTheme {
  id: AccentId;
  name: string;
  swatch: string;
}

export const ACCENTS: AccentTheme[] = [
  { id: "gold", name: "Volt Gold", swatch: "#d6ff3d" },
  { id: "teal", name: "Arc Teal", swatch: "#3dffd0" },
  { id: "violet", name: "Nebula Violet", swatch: "#8b5cf6" },
  { id: "ember", name: "Ember", swatch: "#ff5a1f" },
  { id: "ice", name: "Ice", swatch: "#5ac8fa" },
  { id: "rose", name: "Rose", swatch: "#ff4b63" },
];

export interface ThemeSelection {
  device: DeviceThemeId;
  bg: BgThemeId;
  accent: AccentId;
}

export const DEFAULT_THEME: ThemeSelection = {
  device: "orbitx",
  bg: "default",
  accent: "gold",
};

export const THEME_STORAGE_KEY = "orbitx-os-theme";
export const ORDER_STORAGE_KEY = "orbitx-os-order";

/* ------------------------------------------------------------------ */
/* App registry — audited from web/src/App.tsx (Vite + react-router). */
/* Every major reachable route becomes an app on the home OS.         */
/* ------------------------------------------------------------------ */

export type AppCategory = "Trade" | "Launch" | "Social" | "Tools" | "Collect" | "Official";

export interface OsApp {
  id: string;
  name: string;
  route: string;
  description: string;
  category: AppCategory;
  /** 24x24 stroke SVG path */
  icon: string;
  badge?: string;
}

const I = {
  trade: "M3 17l6-6 4 4 8-8M21 7v6h-6",
  launch: "M12 19V5M5 12l7-7 7 7M5 21h14",
  drop: "M12 2v20M2 12h20M12 2l3 3M12 2L9 5",
  wallet: "M20 7H4a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16V7M16 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  margin: "M3 3v18h18M7 14l4-4 3 3 5-6",
  cards: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6",
  ledger: "M4 19.5A2.5 2.5 0 016.5 17H20V4H6.5A2.5 2.5 0 004 6.5v13zM4 19.5A2.5 2.5 0 006.5 22H20v-5",
  fee: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  you: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  shelf: "M4 20h16M6 20V8l6-5 6 5v12M10 12h4",
  week: "M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  crew: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  tools: "M14.7 6.3a4.5 4.5 0 00-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 006-6L14 13l-3-3 3.7-3.7z",
  bindings: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  token: "M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z",
  paper: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8",
  links: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  // Vite-app additions
  copy: "M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2zM7 2v4h10V2M9 12h6M9 16h6",
  calls: "M22 12h-4l-3 9L9 3l-3 9H2",
  nft: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  social: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z",
  voice: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  chat: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  agents: "M12 8V4H8M8 8h8v8h-8zM4 4h4v4H4zM16 16h4v4h-4z",
  city: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01",
  messages: "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6",
  ai: "M12 2a7 7 0 017 7c0 2.4-1.2 4.2-2.6 5.7-.5.5-.4 1.3.2 1.7.7.4 1.4.9 1.4 2.1V19a2 2 0 01-2 2h-8a2 2 0 01-2-2v-.5c0-1.2.7-1.7 1.4-2.1.6-.4.7-1.2.2-1.7C5.8 13.2 5 11.4 5 9a7 7 0 017-7zM9 22h6",
  dev: "M16 18l6-6-6-6M8 6l-6 6 6 6",
  edu: "M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 10v6",
  onchain: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  support: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  telegram: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  install: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  auth: "M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3",
  roadmap: "M9 20l-5.45-2.72A1 1 0 013 16.38V6a1 1 0 011-1h16a1 1 0 011 1v10.38a1 1 0 01-.55.9L15 20M9 20v-8h6v8M9 12V4h6v8",
  scan: "M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M3 12h18",
  super: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
};

export const OS_APPS: OsApp[] = [
  // Trade
  { id: "trade", name: "Trade", route: "/trade", description: "Pro trading terminal", category: "Trade", icon: I.trade },
  { id: "copy", name: "Copy Trade", route: "/copy", description: "Mirror top wallets live", category: "Trade", icon: I.copy, badge: "hot" },
  { id: "calls", name: "Calls", route: "/calls", description: "Alpha calls feed", category: "Trade", icon: I.calls },
  // Launch
  { id: "launch", name: "Launchpad", route: "/orbitxlaunch", description: "Launch your own token", category: "Launch", icon: I.launch, badge: "hot" },
  // Social
  { id: "social", name: "Social", route: "/orbitx-social", description: "Community HQ + feed", category: "Social", icon: I.social },
  { id: "vc", name: "Voice", route: "/vc", description: "Live voice lobbies", category: "Social", icon: I.voice },
  { id: "gc", name: "Group Chat", route: "/gc", description: "Group chats", category: "Social", icon: I.chat },
  { id: "agents", name: "Agents", route: "/orbitxagents", description: "OrbitX agent world", category: "Social", icon: I.agents },
  { id: "city", name: "City", route: "/orbitxcity", description: "OrbitX City", category: "Social", icon: I.city },
  { id: "messages", name: "Messages", route: "/messages", description: "Direct messages", category: "Social", icon: I.messages },
  { id: "aichat", name: "Alpha Chat", route: "/ai-chat", description: "AI trading chat", category: "Social", icon: I.chat },
  // Tools
  { id: "intel", name: "Intel", route: "/intel", description: "Token scanner + intel desk", category: "Tools", icon: I.scan },
  { id: "supercomputer", name: "Supercomputer", route: "/supercomputer", description: "MCP supercomputer", category: "Tools", icon: I.super },
  { id: "aihub", name: "AI Hub", route: "/ai-hub", description: "AI tools hub", category: "Tools", icon: I.ai },
  { id: "agentplus", name: "AgentPlus", route: "/agentplus", description: "Autonomous agent fleet", category: "Tools", icon: I.agents },
  { id: "orbitaix", name: "OrbitX AI", route: "/ai", description: "Wallet AI super app", category: "Tools", icon: I.ai },
  { id: "developer", name: "Developers", route: "/developer", description: "API + dev portal", category: "Tools", icon: I.dev },
  { id: "education", name: "Learn", route: "/education", description: "Trading education", category: "Tools", icon: I.edu },
  { id: "onchain", name: "On-Chain", route: "/onchain", description: "On-chain proofs", category: "Tools", icon: I.onchain },
  // Collect
  { id: "nft", name: "NFTs", route: "/nft", description: "NFT market + drops", category: "Collect", icon: I.nft },
  // Official
  { id: "whitepaper", name: "Paper", route: "/whitepaper", description: "How OrbitX works", category: "Official", icon: I.paper },
  { id: "roadmap", name: "Roadmap", route: "/roadmap", description: "Where we're headed", category: "Official", icon: I.roadmap },
  { id: "support", name: "Support", route: "/support", description: "Help center", category: "Official", icon: I.support },
  { id: "telegram", name: "Telegram", route: "/telegram", description: "Official Telegram", category: "Official", icon: I.telegram },
  { id: "install", name: "Install", route: "/install", description: "Install the app", category: "Official", icon: I.install },
  { id: "auth", name: "Sign In", route: "/auth", description: "Sign in / up", category: "Official", icon: I.auth },
];

export const APP_CATEGORIES: AppCategory[] = ["Trade", "Launch", "Social", "Tools", "Collect", "Official"];
