/**
 * LifeInvasion feed engine (framework-free).
 *
 * NPC posts are generated ONLY from real market data (TokenDrama). When a
 * token moves beyond a threshold, trader-persona NPCs react with templated
 * posts that include the REAL symbol, REAL price and REAL 24h change.
 * Flavor banter is clearly non-market and never invents prices.
 */

import { NPCS } from "../data/socialData";
import type { FeedPost, TokenDrama } from "../types";

const PUMP_T = 8; // 24h % move that triggers a "pump" reaction
const DUMP_T = -8;
const VOLUME_SPIKE_USD = 5_000_000;

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const PUMP_LINES = [
  (s: string, p: string) => `${s} is AWAKE. ${p} in 24h. Charts don't lie, they just flex.`,
  (s: string, p: string) => `POV: you faded ${s} and it's ${p} today. Couldn't be me. (It was me.)`,
  (s: string, p: string) => `${s} ${p}. My paper stack is doing pushups.`,
  (s: string, p: string) => `Woke up, ${s} decided to go ${p}. The city eats tonight.`,
];

const DUMP_LINES = [
  (s: string, p: string) => `${s} down ${p}. Buying fear, selling my sleep schedule.`,
  (s: string, p: string) => `${s} ${p}?? My portfolio just filed for emotional damages.`,
  (s: string, p: string) => `Discount season on ${s}: ${p}. Long-term holders, assemble.`,
  (s: string, p: string) => `${s} took ${p} off the top. The dip is a personality test and I'm passing.`,
];

const VOLUME_LINES = [
  (s: string, v: string) => `${s} just printed ${v} in 24h volume. Somebody knows something.`,
  (s: string, v: string) => `Volume don't lie: ${s} did ${v} today. Watch this one.`,
];

const BANTER = [
  "Rooftop Friday. If your fit isn't neon, don't talk to me.",
  "Bonfire Point Saturday. Bring stories, leave your charts at home.",
  "Open mic Tuesday at The Gutter. I'm bombing on purpose. It's called art.",
  "East Docks Saturday night. My car is washed. Your move.",
  "Camping at Whisper Pines this weekend. No signal. No regrets.",
  "Club Eclipse is for sale. Somebody with real conviction, step up.",
  "Just saw the Channel 6 van downtown. Something's cooking.",
  "Paper stack looking healthy. Real stack looking... theoretical.",
];

export interface FeedInput {
  drama: TokenDrama[];
  playerPosts: FeedPost[];
  likedIds?: Set<string>;
}

/**
 * Build the full feed: player posts first, then drama-driven NPC posts
 * (newest first), then a few banter posts for flavor. Deterministic per
 * input so re-renders don't reshuffle.
 */
export function buildFeed({ drama, playerPosts }: FeedInput): FeedPost[] {
  const posts: FeedPost[] = [...playerPosts];
  const now = Date.now();
  let n = 0;

  const traders = NPCS.filter((p) => p.persona === "trader" || p.persona === "dev");
  const locals = NPCS.filter((p) => p.persona === "local" || p.persona === "dj" || p.persona === "comic");

  for (const d of drama) {
    if (!d.symbol || d.price <= 0) continue; // real data only — skip empties
    const author = pick(traders, d.symbol.length + Math.round(d.change24h));
    const base = {
      id: `drama-${d.symbol}-${n++}`,
      authorId: author.id,
      authorName: author.name,
      authorHandle: author.handle,
      authorInitials: author.initials,
      authorHue: author.hue,
      npc: true,
      verified: author.verified,
      tokens: [d.symbol],
      ts: now - n * 47_000,
      likes: 40 + ((Math.round(Math.abs(d.change24h)) * 13) % 400),
      reposts: 5 + ((Math.round(Math.abs(d.change24h)) * 7) % 80),
      kind: "drama" as const,
    };
    if (d.change24h >= PUMP_T) {
      posts.push({ ...base, text: pick(PUMP_LINES, n)(d.symbol, fmtPct(d.change24h)) });
    } else if (d.change24h <= DUMP_T) {
      posts.push({ ...base, text: pick(DUMP_LINES, n)(d.symbol, fmtPct(d.change24h)) });
    } else if (d.volume24h >= VOLUME_SPIKE_USD) {
      posts.push({ ...base, text: pick(VOLUME_LINES, n)(d.symbol, fmtUsd(d.volume24h)) });
    }
  }

  // banter for flavor (no market claims)
  locals.slice(0, 5).forEach((a, i) => {
    posts.push({
      id: `banter-${a.id}`,
      authorId: a.id,
      authorName: a.name,
      authorHandle: a.handle,
      authorInitials: a.initials,
      authorHue: a.hue,
      npc: true,
      verified: a.verified,
      text: BANTER[(i * 3 + drama.length) % BANTER.length],
      tokens: [],
      kind: "banter",
      likes: 20 + i * 17,
      reposts: 2 + i * 3,
      ts: now - (n + i + 1) * 120_000,
    });
  });

  // sponsored flavor
  posts.push({
    id: "ad-eclipse",
    authorId: "club-eclipse",
    authorName: "Club Eclipse",
    authorHandle: "@clubeclipse",
    authorInitials: "CE",
    authorHue: 280,
    npc: true,
    verified: true,
    text: "Own the night. Club Eclipse is on the market — three rooms, one legend. Ask about ownership inside the app.",
    tokens: [],
    kind: "ad",
    likes: 900,
    reposts: 120,
    ts: now - 999_000,
  });

  return posts.sort((a, b) => b.ts - a.ts);
}

/** Trending tokens right now, derived from real drama (for the feed sidebar). */
export function trendingFromDrama(drama: TokenDrama[]): { symbol: string; change24h: number; heat: number }[] {
  return drama
    .filter((d) => d.symbol && d.price > 0)
    .map((d) => ({
      symbol: d.symbol,
      change24h: d.change24h,
      heat: Math.min(100, Math.abs(d.change24h) * 4 + Math.min(40, d.volume24h / 1_000_000)),
    }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 5);
}
