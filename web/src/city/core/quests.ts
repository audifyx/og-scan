/**
 * OrbitX City — daily quests.
 *
 * 3 quests reset daily: walk 500m, scan 3 POIs, visit all 4 shops.
 * Progress persists per wallet + day in localStorage. Claiming pays
 * CITY points via the shared cityState store.
 */
import { addCityPoints } from "./cityState";

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  target: number;
  reward: number;
}

export const QUESTS: QuestDef[] = [
  { id: "walk", name: "Street Walker", desc: "Walk 500m", target: 500, reward: 25 },
  { id: "scan", name: "Eagle Eye", desc: "Scan 3 POIs", target: 3, reward: 25 },
  { id: "shops", name: "Window Shopper", desc: "Visit all 4 shops", target: 4, reward: 50 },
];

/** The four walkable shop POIs (labels must match CityWorld BUILDINGS). */
export const SHOP_POIS = ["OrbitX Shop", "Ramen House", "Neon Arcade", "Corner Deli"];

interface QuestStore {
  walkM: number;
  scanned: string[];
  visited: string[];
  claimed: string[];
}

function dayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function storeKey(wallet: string | null): string {
  return `oxc-quests-${wallet ?? "anon"}-${dayStr()}`;
}

const EMPTY: QuestStore = { walkM: 0, scanned: [], visited: [], claimed: [] };

export function loadQuestStore(wallet: string | null): QuestStore {
  try {
    const raw = localStorage.getItem(storeKey(wallet));
    if (!raw) return { ...EMPTY };
    const s = JSON.parse(raw) as Partial<QuestStore>;
    return {
      walkM: Math.max(0, Math.floor(s.walkM ?? 0)),
      scanned: Array.isArray(s.scanned) ? s.scanned : [],
      visited: Array.isArray(s.visited) ? s.visited : [],
      claimed: Array.isArray(s.claimed) ? s.claimed : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveQuestStore(wallet: string | null, s: QuestStore): void {
  try {
    localStorage.setItem(storeKey(wallet), JSON.stringify(s));
  } catch { /* noop */ }
}

export interface QuestProgress {
  def: QuestDef;
  have: number;
  done: boolean;
  claimed: boolean;
}

export interface SessionStats {
  dist: number;
  scanned: string[];
  visited: string[];
}

/** Merge live session stats into the daily store; return display progress. */
export function questProgress(wallet: string | null, session: SessionStats): QuestProgress[] {
  const s = loadQuestStore(wallet);
  const walkM = Math.max(s.walkM, Math.floor(session.dist));
  const scanned = [...new Set([...s.scanned, ...session.scanned])];
  const visited = [...new Set([...s.visited, ...session.visited])];
  saveQuestStore(wallet, { walkM, scanned, visited, claimed: s.claimed });
  const shops = visited.filter((v) => SHOP_POIS.includes(v)).length;
  const haves: Record<string, number> = { walk: walkM, scan: scanned.length, shops };
  return QUESTS.map((def) => ({
    def,
    have: Math.min(def.target, haves[def.id] ?? 0),
    done: (haves[def.id] ?? 0) >= def.target,
    claimed: s.claimed.includes(def.id),
  }));
}

/** Claim a completed quest: marks claimed, pays CITY points. Returns points paid (0 if invalid). */
export function claimQuest(wallet: string | null, id: string): number {
  const def = QUESTS.find((q) => q.id === id);
  if (!def) return 0;
  const s = loadQuestStore(wallet);
  if (s.claimed.includes(id)) return 0;
  s.claimed.push(id);
  saveQuestStore(wallet, s);
  return addCityPoints(def.reward);
}
