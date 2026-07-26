/**
 * OrbitX City — feature matrices (exactly 168 capabilities per system).
 * Generated from curated lanes × nodes so each menu destination ships a full catalog.
 */
export type FeatureStatus = "live" | "beta" | "planned";

export type CitySystemId =
  | "play"
  | "characters"
  | "lobbies"
  | "marketplace"
  | "inventory"
  | "missions"
  | "leaderboards"
  | "friends"
  | "settings"
  | "events"
  | "nyc"
  | "miami"
  | "la"
  | "boston";

export interface CityFeature {
  id: string;
  system: CitySystemId;
  title: string;
  blurb: string;
  lane: string;
  status: FeatureStatus;
  index: number;
}

export interface CitySystemMeta {
  id: CitySystemId;
  label: string;
  accent: string;
  tagline: string;
  count: 168;
}

const LANES = [
  "Core Loop",
  "Presence",
  "Economy",
  "Social Graph",
  "Realtime Rails",
  "Progression",
  "Cosmetics",
  "District Ops",
  "Security",
  "Mobile",
  "Analytics",
  "Creator Tools",
] as const;

const NODES = [
  "Boot",
  "Sync",
  "Match",
  "Claim",
  "Broadcast",
  "Relay",
  "Forge",
  "Scan",
  "Bridge",
  "Pulse",
  "Vault",
  "Orbit",
  "Signal",
  "Deploy",
] as const;

/** 12 lanes × 14 nodes = 168 */
export const FEATURES_PER_SYSTEM = LANES.length * NODES.length;

const SYSTEM_META: Record<CitySystemId, Omit<CitySystemMeta, "count">> = {
  play: {
    id: "play",
    label: "Play",
    accent: "#c5a26f",
    tagline: "Gate → recruit → lobby → Midtown run",
  },
  characters: {
    id: "characters",
    label: "Characters",
    accent: "#b388ff",
    tagline: "Classes, dossiers, cosmetics, callsigns",
  },
  lobbies: {
    id: "lobbies",
    label: "Lobbies",
    accent: "#5b8def",
    tagline: "Public rooms, private codes, city servers",
  },
  marketplace: {
    id: "marketplace",
    label: "Marketplace",
    accent: "#ff4d6a",
    tagline: "Meme store, launches, Jupiter buy rails",
  },
  inventory: {
    id: "inventory",
    label: "Inventory",
    accent: "#3d9a6a",
    tagline: "Shards, keys, badges, loadout slots",
  },
  missions: {
    id: "missions",
    label: "Missions",
    accent: "#c5a26f",
    tagline: "Daily contracts, streaks, district bounties",
  },
  leaderboards: {
    id: "leaderboards",
    label: "Leaderboards",
    accent: "#e0c48a",
    tagline: "Shard heat, lobby ranks, season boards",
  },
  friends: {
    id: "friends",
    label: "Friends",
    accent: "#ff4d6a",
    tagline: "Mutuals, invites, lobby crew, HQ links",
  },
  settings: {
    id: "settings",
    label: "Settings",
    accent: "#5b8def",
    tagline: "Audio, quality, touch, accessibility",
  },
  events: {
    id: "events",
    label: "Events",
    accent: "#b388ff",
    tagline: "Live drops, district shows, launch windows",
  },
  nyc: {
    id: "nyc",
    label: "OrbitX NYC",
    accent: "#c5a26f",
    tagline: "Financial hub · OSM Midtown footprints",
  },
  miami: {
    id: "miami",
    label: "OrbitX Miami",
    accent: "#3d9a6a",
    tagline: "Coastal community · plazas · social heat",
  },
  la: {
    id: "la",
    label: "OrbitX LA",
    accent: "#b388ff",
    tagline: "Creator strip · stages · NFT culture",
  },
  boston: {
    id: "boston",
    label: "OrbitX Boston",
    accent: "#5b8def",
    tagline: "Innovation core · labs · protocol forge",
  },
};

function statusFor(index: number): FeatureStatus {
  if (index < 72) return "live";
  if (index < 120) return "beta";
  return "planned";
}

function buildSystemFeatures(system: CitySystemId): CityFeature[] {
  const meta = SYSTEM_META[system];
  const out: CityFeature[] = [];
  let index = 0;
  for (const lane of LANES) {
    for (const node of NODES) {
      index += 1;
      out.push({
        id: `${system}-${index.toString().padStart(3, "0")}`,
        system,
        title: `${meta.label} · ${lane} ${node}`,
        blurb: `${meta.tagline}. Capability ${index}/${FEATURES_PER_SYSTEM}: ${lane.toLowerCase()} ${node.toLowerCase()} rail for ${meta.label}.`,
        lane,
        status: statusFor(index - 1),
        index,
      });
    }
  }
  return out;
}

const CACHE = new Map<CitySystemId, CityFeature[]>();

export function getSystemMeta(id: CitySystemId): CitySystemMeta {
  return { ...SYSTEM_META[id], count: FEATURES_PER_SYSTEM };
}

export function getSystemFeatures(id: CitySystemId): CityFeature[] {
  let list = CACHE.get(id);
  if (!list) {
    list = buildSystemFeatures(id);
    CACHE.set(id, list);
  }
  return list;
}

export function countByStatus(id: CitySystemId): Record<FeatureStatus, number> {
  const list = getSystemFeatures(id);
  return {
    live: list.filter((f) => f.status === "live").length,
    beta: list.filter((f) => f.status === "beta").length,
    planned: list.filter((f) => f.status === "planned").length,
  };
}

export const MENU_SYSTEMS: CitySystemId[] = [
  "play",
  "characters",
  "lobbies",
  "marketplace",
  "inventory",
  "missions",
  "leaderboards",
  "friends",
  "settings",
  "events",
];

export const CITY_SYSTEMS: CitySystemId[] = ["nyc", "miami", "la", "boston"];

/** City mission board — claimable in-world objectives beyond the starter three. */
export interface CityMissionDef {
  id: string;
  title: string;
  detail: string;
  reward: number;
  /** Predicate keys evaluated by the missions panel */
  require: "entered" | "shards10" | "shards25" | "shards50" | "voice" | "always";
  city?: "nyc" | "miami" | "la" | "boston" | "any";
}

export const CITY_MISSION_BOARD: CityMissionDef[] = [
  { id: "first-steps", title: "First steps", detail: "Enter any OrbitX City district.", reward: 25, require: "entered", city: "any" },
  { id: "street-sweep", title: "Street sweep", detail: "Collect 10 OBX shards in the world.", reward: 50, require: "shards10", city: "any" },
  { id: "voice-check", title: "Open channel", detail: "Open the live Voice Plaza.", reward: 35, require: "voice", city: "any" },
  { id: "shard-hunter", title: "Shard hunter", detail: "Bank 25 OBX shards on the streets.", reward: 75, require: "shards25", city: "any" },
  { id: "midtown-marathon", title: "Midtown marathon", detail: "Hold 50 shards while running NYC.", reward: 120, require: "shards50", city: "nyc" },
  { id: "coast-collector", title: "Coast collector", detail: "Enter Miami and gather 10 shards.", reward: 60, require: "shards10", city: "miami" },
  { id: "creator-pass", title: "Creator pass", detail: "Boot LA district and stay online.", reward: 55, require: "entered", city: "la" },
  { id: "lab-access", title: "Lab access", detail: "Enter Boston innovation core.", reward: 55, require: "entered", city: "boston" },
  { id: "degen-warmup", title: "Degen warmup", detail: "Stay in-world after enter (any city).", reward: 40, require: "entered", city: "any" },
  { id: "plaza-pulse", title: "Plaza pulse", detail: "Open voice while shards ≥ 10.", reward: 80, require: "voice", city: "any" },
  { id: "tape-walker", title: "Tape walker", detail: "NYC run with 25+ shards banked.", reward: 90, require: "shards25", city: "nyc" },
  { id: "neon-sprint", title: "Neon sprint", detail: "LA presence with 10 shards.", reward: 70, require: "shards10", city: "la" },
];

export interface CityEventDef {
  id: string;
  title: string;
  place: string;
  status: "Live" | "Soon" | "Scheduled";
  city: "nyc" | "miami" | "la" | "boston" | "all";
  blurb: string;
}

export const CITY_EVENTS: CityEventDef[] = [
  { id: "nyc-market-run", title: "NYC Market Run", place: "Meme Market · Midtown", status: "Live", city: "nyc", blurb: "Tape walls + launch desks stay hot every lobby." },
  { id: "nyc-hq-brief", title: "OrbitX HQ Briefing", place: "OrbitX HQ boardroom", status: "Live", city: "nyc", blurb: "DEX / launch / social stations inside HQ." },
  { id: "miami-weekend", title: "Miami Community Weekend", place: "OrbitX Miami Coast", status: "Live", city: "miami", blurb: "Plaza meetups, voice circles, coastal social heat." },
  { id: "miami-sunset", title: "Sunset Voice Circle", place: "Miami pier plaza", status: "Soon", city: "miami", blurb: "Scheduled voice plaza sessions for crews." },
  { id: "la-showcase", title: "Creator Strip Showcase", place: "LA stages", status: "Live", city: "la", blurb: "Creator launches, NFT drops, entertainment stages." },
  { id: "la-drop-night", title: "Neon Drop Night", place: "LA gallery row", status: "Scheduled", city: "la", blurb: "Timed NFT drop windows with city markers." },
  { id: "boston-forge", title: "Protocol Forge Hours", place: "Boston labs", status: "Live", city: "boston", blurb: "Builder pods and R&D walkthroughs." },
  { id: "boston-ai", title: "AI Lab Open House", place: "Boston innovation core", status: "Soon", city: "boston", blurb: "Dev-facing demos inside lab interiors." },
  { id: "global-launch", title: "Launch Arena Showcase", place: "All cities · Launch desks", status: "Live", city: "all", blurb: "Cross-district launch spotlight." },
  { id: "global-social", title: "HQ Social Relay", place: "Social lounges · all districts", status: "Live", city: "all", blurb: "Feed + chat + voice linked across cities." },
  { id: "global-games", title: "Games District Heat", place: "Arcade / prediction rails", status: "Soon", city: "all", blurb: "City markers into OrbitX games." },
  { id: "global-season", title: "Season 1 · Neon Dawn", place: "City-wide progression", status: "Live", city: "all", blurb: "Missions, shards, and battle-pass style climbs." },
];

export const INVENTORY_CATALOG = [
  { id: "obx-shard", kind: "currency", label: "OBX Shards", detail: "Street currency — walk glowing coins." },
  { id: "holder-key", kind: "key", label: "Holder Key", detail: "Unlocks VIP building interiors." },
  { id: "ad-slot-a", kind: "ad_slot", label: "Billboard Slot A", detail: "Rentable Midtown ad face." },
  { id: "ad-slot-b", kind: "ad_slot", label: "Billboard Slot B", detail: "Secondary plaza screen." },
  { id: "badge-founder", kind: "badge", label: "Founder Badge", detail: "Early OrbitX City operative." },
  { id: "badge-trader", kind: "badge", label: "Tape Predator", detail: "Trader class clearance." },
  { id: "badge-builder", kind: "badge", label: "Systems Seal", detail: "Builder class clearance." },
  { id: "badge-gamer", kind: "badge", label: "Arena Mark", detail: "Gamer class clearance." },
  { id: "badge-creator", kind: "badge", label: "Signal Crest", detail: "Creator class clearance." },
  { id: "badge-explorer", kind: "badge", label: "Frontier Pin", detail: "Explorer class clearance." },
  { id: "token-obx", kind: "token", label: "OBX Watchlist Slot", detail: "Pin a mint on your HUD tape." },
  { id: "loadout-neon", kind: "badge", label: "Neon Fit Unlock", detail: "Extra cosmetic loadout slot." },
] as const;
