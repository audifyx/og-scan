/**
 * OrbitX OS — app launcher catalog (frontend-only deep links).
 * Points at existing product surfaces; no backend ownership.
 */
export type OsAppId =
  | "city"
  | "dex"
  | "scanner"
  | "launchpad"
  | "games"
  | "predictions"
  | "social"
  | "communities"
  | "voice"
  | "leaderboards"
  | "rewards"
  | "nft"
  | "settings"
  | "character"
  | "inventory"
  | "achievements"
  | "lobbies"
  | "hub";

export interface OsAppDef {
  id: OsAppId;
  name: string;
  blurb: string;
  href: string;
  external?: boolean;
  accent: string;
  category: "world" | "trade" | "social" | "play" | "profile" | "system";
}

export const OS_APPS: OsAppDef[] = [
  { id: "city", name: "OrbitX City", blurb: "Enter the 3D crypto city", href: "/Orbitxcity", accent: "#17ff4d", category: "world" },
  { id: "dex", name: "Trading Terminal", blurb: "OrbitX DEX · live execution", href: "/intel/trade", accent: "#3de7ff", category: "trade" },
  { id: "scanner", name: "Token Scanner", blurb: "Forensic OG score & risk", href: "/intel/scan", accent: "#f5c542", category: "trade" },
  { id: "launchpad", name: "Launchpad", blurb: "Fair launch console", href: "/intel/launch", accent: "#ff6b35", category: "trade" },
  { id: "nft", name: "NFT Market", blurb: "Create, trade, collect", href: "/nft", accent: "#a78bfa", category: "trade" },
  { id: "games", name: "Games Hub", blurb: "Play Studio · classes & missions", href: "/play", accent: "#17ff4d", category: "play" },
  { id: "predictions", name: "Prediction Markets", blurb: "Markets & 1v1 games", href: "/play", accent: "#f5c542", category: "play" },
  { id: "lobbies", name: "Game Lobbies", blurb: "Matchmaking & rooms", href: "/play/multiplayer", accent: "#3de7ff", category: "play" },
  { id: "social", name: "Social Feed", blurb: "Posts, follows, signals", href: "/orbitx-social", accent: "#ff4d9a", category: "social" },
  { id: "communities", name: "Communities", blurb: "Guilds & coin hubs", href: "/orbitx-social", accent: "#3de7ff", category: "social" },
  { id: "voice", name: "Voice Spaces", blurb: "Live rooms & plazas", href: "/orbitx-social", accent: "#17ff4d", category: "social" },
  { id: "leaderboards", name: "Leaderboards", blurb: "Ranks, streaks, glory", href: "/orbitx-social", accent: "#f5c542", category: "play" },
  { id: "rewards", name: "Rewards", blurb: "XP, drops, claims", href: "/orbitx-social", accent: "#17ff4d", category: "profile" },
  { id: "character", name: "Character", blurb: "Avatar & cosmetics", href: "/play/character", accent: "#3de7ff", category: "profile" },
  { id: "inventory", name: "Inventory", blurb: "Keys, badges, slots", href: "/play/inventory", accent: "#f5c542", category: "profile" },
  { id: "achievements", name: "Achievements", blurb: "Unlocks & titles", href: "/play/progression", accent: "#ff4d9a", category: "profile" },
  { id: "hub", name: "User Hub", blurb: "Identity & loadout", href: "/os/hub", accent: "#17ff4d", category: "profile" },
  { id: "settings", name: "Settings", blurb: "Quality, privacy, prefs", href: "/os/settings", accent: "#8b9bb4", category: "system" },
];

export const OS_NAV = [
  { to: "/os", label: "Home", end: true },
  { to: "/os/dashboard", label: "Launcher" },
  { to: "/intel", label: "Trade" },
  { to: "/play", label: "Play" },
  { to: "/orbitx-social", label: "Social" },
  { to: "/os/hub", label: "Hub" },
] as const;
