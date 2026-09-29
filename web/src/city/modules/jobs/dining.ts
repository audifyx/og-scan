/**
 * Shared restaurant registry for the food-critic and restaurant jobs.
 * Ratings written by the critic change foot traffic here (diner spawn rate).
 * The restaurant job's "open your own" flow stores player-owned restaurants
 * in a separate key so seed data never mutates.
 */
import { HALF, PITCH, ROAD_W } from "../../core";

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  x: number;
  z: number;
  /** critic rating 1..5 (starts 3) */
  rating: number;
  reviews: number;
  /** avg meal price in paper CITY */
  price: number;
}

export interface PlayerRestaurant extends Restaurant {
  /** uncollected tip income (paper CITY) */
  pending: number;
}

const KEY = "orbitxcity.jobs.restaurants.v1";
const PLAYER_KEY = "orbitxcity.jobs.restaurants.player.v1";

function nodeCoord(i: number): number {
  return -HALF + ROAD_W / 2 + i * PITCH;
}

const SEED: Omit<Restaurant, "rating" | "reviews">[] = [
  { id: "neon-noodle", name: "Neon Noodle House", cuisine: "Ramen", x: nodeCoord(1) + 24, z: nodeCoord(1), price: 65 },
  { id: "orbit-burger", name: "Orbit Burger", cuisine: "Smash burgers", x: nodeCoord(3) - 24, z: nodeCoord(2), price: 45 },
  { id: "luna-taco", name: "Luna Taco Libre", cuisine: "Tacos", x: nodeCoord(2), z: nodeCoord(3) + 24, price: 40 },
  { id: "sol-steak", name: "Sol & Smoke", cuisine: "Steakhouse", x: nodeCoord(4) - 24, z: nodeCoord(4), price: 140 },
  { id: "pixel-sushi", name: "Pixel Sushi", cuisine: "Sushi", x: nodeCoord(1), z: nodeCoord(4) - 24, price: 95 },
  { id: "gravity-cafe", name: "Gravity Café", cuisine: "Brunch", x: nodeCoord(4) + 24, z: nodeCoord(1), price: 55 },
];

let cache: Restaurant[] | null = null;
let playerCache: PlayerRestaurant[] | null = null;

export function getRestaurants(): Restaurant[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, { rating: number; reviews: number }>;
      cache = SEED.map((s) => ({
        ...s,
        rating: saved[s.id]?.rating ?? 3,
        reviews: saved[s.id]?.reviews ?? 0,
      }));
      return cache;
    }
  } catch {
    /* seed fresh */
  }
  cache = SEED.map((s) => ({ ...s, rating: 3, reviews: 0 }));
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    const slim: Record<string, { rating: number; reviews: number }> = {};
    cache.forEach((r) => {
      slim[r.id] = { rating: r.rating, reviews: r.reviews };
    });
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* noop */
  }
}

/** Critic publishes a review: running-average rating. Returns new rating. */
export function publishReview(id: string, stars: number): number {
  const list = getRestaurants();
  const r = list.find((x) => x.id === id);
  if (!r) return 3;
  const s = Math.max(1, Math.min(5, Math.round(stars)));
  r.rating = (r.rating * r.reviews + s) / (r.reviews + 1);
  r.reviews += 1;
  persist();
  return r.rating;
}

/** Foot traffic multiplier from rating: 1★ ≈ 0.4 … 5★ ≈ 1.8 */
export function footTraffic(r: Restaurant): number {
  return 0.4 + ((r.rating - 1) / 4) * 1.4;
}

/** Meal buff granted when dining in: better-rated food, better buff. */
export function mealBuff(r: Restaurant): { label: string; payMult: number; xpMult: number; minutes: number } {
  return {
    label: `${r.cuisine} feast`,
    payMult: 1 + r.rating * 0.02,
    xpMult: 1.05,
    minutes: 20 + Math.round(r.rating) * 5,
  };
}

/** Player-owned restaurants (restaurant job empire-lite). */
export function getPlayerRestaurants(): PlayerRestaurant[] {
  if (playerCache) return playerCache;
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (raw) {
      playerCache = JSON.parse(raw) as PlayerRestaurant[];
      return playerCache;
    }
  } catch {
    /* fresh */
  }
  playerCache = [];
  return playerCache;
}

function persistPlayer() {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(playerCache ?? []));
  } catch {
    /* noop */
  }
}

export function openPlayerRestaurant(name: string, cuisine: string, x: number, z: number, price: number): PlayerRestaurant {
  const list = getPlayerRestaurants();
  const r: PlayerRestaurant = {
    id: `mine-${Date.now().toString(36)}`,
    name,
    cuisine,
    x,
    z,
    rating: 3,
    reviews: 0,
    price,
    pending: 0,
  };
  list.push(r);
  persistPlayer();
  return r;
}

/** Add tip income to a player restaurant (called by the restaurant job tick). */
export function addTips(id: string, amount: number, cap = 5000): void {
  const r = getPlayerRestaurants().find((x) => x.id === id);
  if (!r) return;
  r.pending = Math.min(cap, r.pending + amount);
  persistPlayer();
}

/** Collect unclaimed tips. Returns amount collected (0 if none). */
export function collectTips(id: string): number {
  const r = getPlayerRestaurants().find((x) => x.id === id);
  if (!r || r.pending <= 0) return 0;
  const amt = Math.floor(r.pending);
  r.pending = 0;
  persistPlayer();
  return amt;
}
