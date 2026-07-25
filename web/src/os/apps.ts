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
  { id: "dex", name: "Trading Terminal", blurb: "OrbitX DEX · live execution", href: "/ORBITX_DEX", accent: "#3de7ff", category: "trade" },
  { id: "scanner", name: "Token Scanner", blurb: "Forensic OG score & risk", href: "/os/scanner", accent: "#f5c542", category: "trade" },
  { id: "launchpad", name: "Launchpad", blurb: "Fair launch console", href: "/orbitxlaunch", accent: "#ff6b35", category: "trade" },
  { id: "nft", name: "NFT Market", blurb: "Create, trade, collect", href: "/nft", accent: "#a78bfa", category: "trade" },
  { id: "games", name: "Games Hub", blurb: "Degen Tower & more", href: "/os/games", accent: "#17ff4d", category: "play" },
  { id: "predictions", name: "Prediction Markets", blurb: "Markets & 1v1 games", href: "/os/predictions", accent: "#f5c542", category: "play" },
  { id: "lobbies", name: "Game Lobbies", blurb: "Matchmaking & rooms", href: "/os/lobbies", accent: "#3de7ff", category: "play" },
  { id: "social", name: "Social Feed", blurb: "Posts, follows, signals", href: "/os/social", accent: "#ff4d9a", category: "social" },
  { id: "communities", name: "Communities", blurb: "Guilds & coin hubs", href: "/os/communities", accent: "#3de7ff", category: "social" },
  { id: "voice", name: "Voice Spaces", blurb: "Live rooms & plazas", href: "/os/voice", accent: "#17ff4d", category: "social" },
  { id: "leaderboards", name: "Leaderboards", blurb: "Ranks, streaks, glory", href: "/os/leaderboards", accent: "#f5c542", category: "play" },
  { id: "rewards", name: "Rewards", blurb: "XP, drops, claims", href: "/os/rewards", accent: "#17ff4d", category: "profile" },
  { id: "character", name: "Character", blurb: "Avatar & cosmetics", href: "/os/character", accent: "#3de7ff", category: "profile" },
  { id: "inventory", name: "Inventory", blurb: "Keys, badges, slots", href: "/os/inventory", accent: "#f5c542", category: "profile" },
  { id: "achievements", name: "Achievements", blurb: "Unlocks & titles", href: "/os/achievements", accent: "#ff4d9a", category: "profile" },
  { id: "hub", name: "User Hub", blurb: "Identity & loadout", href: "/os/hub", accent: "#17ff4d", category: "profile" },
  { id: "settings", name: "Settings", blurb: "Quality, privacy, prefs", href: "/os/settings", accent: "#8b9bb4", category: "system" },
];

export const OS_NAV = [
  { to: "/os", label: "Home", end: true },
  { to: "/os/dashboard", label: "Launcher" },
  { to: "/os/trading", label: "Trade" },
  { to: "/os/games", label: "Play" },
  { to: "/os/social", label: "Social" },
  { to: "/os/hub", label: "Hub" },
] as const;
