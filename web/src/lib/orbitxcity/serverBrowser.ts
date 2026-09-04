/**
 * OrbitX City — district server model.
 *
 * Player counts come from the live realtime presence directory. There is no
 * simulated or padded traffic: when realtime is unavailable, or nobody is in a
 * district, the count is 0 and the UI says so.
 */
import type { CityId } from "./types";
import { ORBITX_CITIES } from "./cities";
import { districtLobby, type DirectoryLobby } from "./realtime";

export type ServerStatus = "online" | "busy" | "full" | "empty" | "offline";

export interface CityServer {
  id: CityId;
  name: string;
  blurb: string;
  region: "na-east" | "na-west" | "eu-west" | "global";
  maxPlayers: number;
  tags: string[];
  unlocked: boolean;
  /** Realtime lobby id this district maps onto. */
  lobbyId: string;
}

export interface ServerRuntime {
  players: number;
  status: ServerStatus;
  /** True when a live presence figure was actually received. */
  live: boolean;
}

export type ServerRow = CityServer & ServerRuntime;

const SERVER_META: Record<CityId, Omit<CityServer, "id" | "name" | "unlocked" | "lobbyId">> = {
  nyc: {
    blurb: "Midtown financial core · launch desks · meme market",
    region: "na-east",
    maxPlayers: 256,
    tags: ["Trading", "Launchpad", "Voice"],
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
      lobbyId: districtLobby(c.id).id,
      ...meta,
    };
  });
}

function statusFor(server: CityServer, players: number, live: boolean): ServerStatus {
  if (!server.unlocked) return "offline";
  if (!live || players <= 0) return "empty";
  const ratio = players / server.maxPlayers;
  if (ratio >= 0.98) return "full";
  if (ratio >= 0.8) return "busy";
  return "online";
}

/**
 * Build display rows from the live lobby directory. Districts with no presence
 * report 0 — never a placeholder figure.
 */
export function buildServerRows(directory?: DirectoryLobby[] | null): ServerRow[] {
  const counts = new Map<string, number>();
  for (const lobby of directory ?? []) {
    counts.set(lobby.id, lobby.count);
  }
  const live = Array.isArray(directory);

  return getCityServers().map((s) => {
    const players = s.unlocked ? (counts.get(s.lobbyId) ?? 0) : 0;
    return { ...s, players, live, status: statusFor(s, players, live) };
  });
}

/** Total real players across all districts. */
export function totalPlayers(rows: ServerRow[]): number {
  return rows.reduce((a, r) => a + r.players, 0);
}

export function statusLabel(status: ServerStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "busy":
      return "Busy";
    case "full":
      return "Full";
    case "empty":
      return "Empty";
    default:
      return "Offline";
  }
}

/** Human label for a district's occupancy, used in the list. */
export function occupancyLabel(row: ServerRow): string {
  if (!row.unlocked) return "Locked";
  if (!row.live) return "—";
  return `${row.players}/${row.maxPlayers}`;
}
