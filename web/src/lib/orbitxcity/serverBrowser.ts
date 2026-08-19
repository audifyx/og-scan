/**
 * OrbitX City — FiveM-style server browser model.
 *
 * The title screen is a server list, not a tile dashboard: each district is a
 * "server" with a live player count, ping, tags and a connect action.
 */
import type { CityId } from "./types";
import { ORBITX_CITIES } from "./cities";

export type ServerStatus = "online" | "busy" | "full" | "offline";

export interface CityServer {
  id: CityId;
  /** Display name in the browser row. */
  name: string;
  /** Short banner line under the name. */
  blurb: string;
  region: "na-east" | "na-west" | "eu-west" | "global";
  maxPlayers: number;
  tags: string[];
  /** Whether the district is playable yet. */
  unlocked: boolean;
}

export interface ServerRuntime {
  players: number;
  ping: number;
  status: ServerStatus;
  queue: number;
}

export type ServerRow = CityServer & ServerRuntime;

const SERVER_META: Record<CityId, Omit<CityServer, "id" | "name" | "unlocked">> = {
  nyc: {
    blurb: "Midtown financial core · launch desks · meme market",
    region: "na-east",
    maxPlayers: 256,
    tags: ["Trading", "Launchpad", "Roleplay", "Voice"],
  },
  miami: {
    blurb: "Coastal social district · plazas and voice circles",
    region: "na-east",
    maxPlayers: 192,
    tags: ["Social", "Voice", "Chill"],
  },
  la: {
    blurb: "Creator strip · NFT galleries and stage drops",
    region: "na-west",
    maxPlayers: 192,
    tags: ["Creator", "NFT", "Events"],
  },
  boston: {
    blurb: "Innovation core · builder pods and protocol labs",
    region: "na-east",
    maxPlayers: 128,
    tags: ["Builders", "Dev", "Quiet"],
  },
};

export const REGION_LABEL: Record<CityServer["region"], string> = {
  "na-east": "NA East",
  "na-west": "NA West",
  "eu-west": "EU West",
  global: "Global",
};

export function getCityServers(): CityServer[] {
  return ORBITX_CITIES.map((c) => {
    const meta = SERVER_META[c.id as CityId] ?? SERVER_META.nyc;
    return {
      id: c.id as CityId,
      name: c.name.replace(/^OrbitX\s+/i, ""),
      unlocked: c.unlocked !== false,
      ...meta,
    };
  });
}

/**
 * Deterministic pseudo-live runtime so the browser never renders empty while
 * real presence counts are still loading. Real counts overwrite this when the
 * lobby directory resolves.
 */
export function simulateRuntime(server: CityServer, seed = Date.now()): ServerRuntime {
  const bucket = Math.floor(seed / 20_000);
  const h = hash(`${server.id}:${bucket}`);
  const load = server.id === "nyc" ? 0.62 : server.id === "boston" ? 0.24 : 0.42;
  const jitter = ((h % 1000) / 1000 - 0.5) * 0.18;
  const players = server.unlocked
    ? Math.max(1, Math.round(server.maxPlayers * clamp01(load + jitter)))
    : 0;
  const ping = 18 + (h % 46);
  const ratio = players / server.maxPlayers;

  let status: ServerStatus = "online";
  if (!server.unlocked) status = "offline";
  else if (ratio >= 0.98) status = "full";
  else if (ratio >= 0.8) status = "busy";

  return {
    players,
    ping,
    status,
    queue: status === "full" ? 1 + (h % 7) : 0,
  };
}

export function buildServerRows(
  live?: Partial<Record<CityId, Partial<ServerRuntime>>>,
  seed?: number,
): ServerRow[] {
  return getCityServers().map((s) => {
    const sim = simulateRuntime(s, seed);
    const override = live?.[s.id] ?? {};
    return { ...s, ...sim, ...override };
  });
}

export function statusLabel(status: ServerStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "busy":
      return "Busy";
    case "full":
      return "Full";
    default:
      return "Offline";
  }
}

export function pingBars(ping: number): 1 | 2 | 3 | 4 {
  if (ping < 30) return 4;
  if (ping < 55) return 3;
  if (ping < 90) return 2;
  return 1;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
