/**
 * ORBITXCITY sports — 2. Skate sponsors.
 * Sign with a brand, rep it at the plaza, clear challenges for paper.
 * Wearing a sponsor deck grants +10% style in skate sessions.
 * PRO contracts are a real-ORBITX premium upsell (billing-gated).
 */
import * as THREE from "three";
import { SportBase, type SportDeps } from "../base";
import { box, labelSprite } from "../venues";
import { SportsBus, type SportInput } from "../types";
import type { PaperLedger } from "../economy";
import { premiumBilling, PREMIUM_CATALOG } from "../billing";

export interface SponsorBrand {
  id: string;
  name: string;
  color: number;
  css: string;
  blurb: string;
}

export const SPONSOR_BRANDS: SponsorBrand[] = [
  { id: "orbitx", name: "ORBITX Decks", color: 0x22d3ee, css: "#22d3ee", blurb: "The home-team deck. Clean pops, clean burns." },
  { id: "neon", name: "NEON Wheels", color: 0xf0f, css: "#ff00ff", blurb: "Fast wheels for night sessions." },
  { id: "vanta", name: "VANTA Trucks", color: 0x111318, css: "#9aa3b2", blurb: "Bomb hills. Trust the metal." },
  { id: "pixel", name: "PIXEL Grip", color: 0x84cc16, css: "#84cc16", blurb: "Sticky grip for tech wizards." },
];

export type SponsorTier = "rookie" | "flow" | "pro";

export interface SponsorChallenge {
  id: string;
  label: string;
  target: number;
  reward: number; // paper
  match: (trickLabel: string) => boolean;
}

export const SPONSOR_CHALLENGES: Record<SponsorTier, SponsorChallenge[]> = {
  rookie: [
    { id: "rk-flip", label: "Land 5 flip tricks (Kickflip / Heelflip)", target: 5, reward: 15, match: (l) => /kickflip|heelflip/i.test(l) },
    { id: "rk-style", label: "Bank 300 style in one session", target: 300, reward: 20, match: (l) => l === "__session__" },
    { id: "rk-grind", label: "Grind 3 rails", target: 3, reward: 15, match: (l) => /grind|boardslide/i.test(l) },
  ],
  flow: [
    { id: "fl-tre", label: "Land 3x 360 Flip", target: 3, reward: 40, match: (l) => /360 flip/i.test(l) },
    { id: "fl-combo", label: "Hit a x5 combo", target: 5, reward: 50, match: (l) => l === "__combo5__" },
    { id: "fl-style", label: "Bank 1,000 style in one session", target: 1000, reward: 60, match: (l) => l === "__session__" },
  ],
  pro: [
    { id: "pr-tre5", label: "Land 5x 360 Flip", target: 5, reward: 120, match: (l) => /360 flip/i.test(l) },
    { id: "pr-combo8", label: "Hit a x8 combo", target: 8, reward: 150, match: (l) => l === "__combo8__" },
    { id: "pr-style3k", label: "Bank 3,000 style in one session", target: 3000, reward: 200, match: (l) => l === "__session__" },
  ],
};

const STORE_KEY = "orbitxcity:sports:sponsor:v1";
export const SPONSOR_STYLE_BONUS = 1.1;

interface SponsorState {
  brandId: string | null;
  tier: SponsorTier;
  progress: Record<string, number>;
  done: string[];
}

function loadState(): SponsorState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as SponsorState;
  } catch { /* ignore */ }
  return { brandId: null, tier: "rookie", progress: {}, done: [] };
}

export class SponsorTracker {
  private state: SponsorState = loadState();
  constructor(private bus: SportsBus, private ledger: PaperLedger) {
    // persistent: tracks skate sessions even when the Sponsors sim is idle
    bus.on((e) => {
      if (e.type !== "style" || e.sport !== "skate") return;
      if (e.label.startsWith("__")) this.feed(e.label, e.points);
      else this.feed(e.label, 1);
    });
  }

  getState(): SponsorState & { brand: SponsorBrand | null } {
    return { ...this.state, brand: SPONSOR_BRANDS.find((b) => b.id === this.state.brandId) ?? null };
  }

  signBrand(brandId: string): void {
    this.state = { brandId, tier: "rookie", progress: {}, done: [] };
    this.save();
    this.bus.emit({ type: "toast", message: `Signed with ${SPONSOR_BRANDS.find((b) => b.id === brandId)?.name}! +10% style while repping.` });
    this.bus.emit({ type: "tick", sport: "sponsors", state: this.getState() });
  }

  async upgradeTier(tier: SponsorTier): Promise<{ ok: boolean; reason: string }> {
    if (!this.state.brandId) return { ok: false, reason: "Sign with a brand first." };
    // check tier FIRST — never burn ORBITX for a tier the rider already holds
    const order: SponsorTier[] = ["rookie", "flow", "pro"];
    if (order.indexOf(tier) <= order.indexOf(this.state.tier)) {
      return { ok: false, reason: "Already at or above that tier." };
    }
    if (tier === "pro") {
      const item = PREMIUM_CATALOG.sponsorProContract;
      const res = await premiumBilling.spend(item.cost, "sponsorProContract");
      if (!res.ok) return res;
    }
    this.state.tier = tier;
    this.save();
    this.bus.emit({ type: "toast", message: `Promoted to ${tier.toUpperCase()} rider! New challenges unlocked.` });
    this.bus.emit({ type: "tick", sport: "sponsors", state: this.getState() });
    return { ok: true, reason: "Upgraded." };
  }

  private feed(label: string, amount: number): void {
    if (!this.state.brandId) return;
    let changed = false;
    for (const ch of SPONSOR_CHALLENGES[this.state.tier]) {
      if (this.state.done.includes(ch.id)) continue;
      if (!ch.match(label)) continue;
      const cur = Math.min(ch.target, (this.state.progress[ch.id] ?? 0) + amount);
      this.state.progress[ch.id] = cur;
      changed = true;
      if (cur >= ch.target) {
        this.state.done.push(ch.id);
        this.ledger.earn(ch.reward, `sponsor challenge: ${ch.label}`);
        this.bus.emit({ type: "toast", message: `✅ Challenge cleared: ${ch.label} (+${ch.reward} paper)` });
      }
    }
    if (changed) {
      this.save();
      this.bus.emit({ type: "tick", sport: "sponsors", state: this.getState() });
    }
  }

  private save(): void {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch { /* ignore */ }
  }
}

let trackerInstance: SponsorTracker | null = null;
/** Persistent tracker — call once at boot so challenges progress during skate sessions. */
export function getSponsorTracker(bus: SportsBus, ledger: PaperLedger): SponsorTracker {
  if (!trackerInstance) trackerInstance = new SponsorTracker(bus, ledger);
  return trackerInstance;
}

/** Currently equipped sponsor (read by SkatePark for the style bonus). */
export function equippedSponsor(): SponsorBrand | null {
  const s = loadState();
  return SPONSOR_BRANDS.find((b) => b.id === s.brandId) ?? null;
}

export class Sponsors extends SportBase {
  meta = {
    id: "sponsors" as const,
    name: "Skate Sponsors",
    tagline: "Get sponsored. Rep the brand.",
    icon: "🤝",
    venue: "Sponsor Row, Neon Plaza",
  };

  private tracker(): SponsorTracker {
    return getSponsorTracker(this.bus, this.ledger);
  }

  getState() {
    return this.tracker().getState();
  }

  signBrand(brandId: string): void {
    this.tracker().signBrand(brandId);
  }

  upgradeTier(tier: SponsorTier): Promise<{ ok: boolean; reason: string }> {
    return this.tracker().upgradeTier(tier);
  }

  buildVenue(): THREE.Object3D[] {
    const c = this.venues.skatePlaza;
    const g: THREE.Object3D[] = [];
    // sponsor wall: 4 branded panels along the plaza edge
    SPONSOR_BRANDS.forEach((b, i) => {
      const x = c.x - 15 + i * 10;
      const panel = box(8, 4, 0.5, 0x151b26, x, 2.4, c.z - 19.5);
      g.push(panel);
      const stripe = box(8, 0.6, 0.6, b.color, x, 4.6, c.z - 19.5);
      g.push(stripe);
      const label = labelSprite(b.name.toUpperCase(), { size: 7, color: b.css });
      label.position.set(x, 2.4, c.z - 19.2);
      g.push(label);
    });
    const sign = labelSprite("SPONSOR ROW — GET SIGNED", { size: 10 });
    sign.position.set(c.x, 7.5, c.z - 19.5);
    g.push(sign);
    return g;
  }

  start(): void {
    this._active = true;
    const c = this.venues.skatePlaza;
    this.spawnAthlete(new THREE.Vector3(c.x, 0, c.z - 14), 0xf59e0b);
    this.snapCam(
      new THREE.Vector3(c.x, 5, c.z - 8),
      new THREE.Vector3(c.x, 2.5, c.z - 19)
    );
    // challenge progress is tracked persistently by SponsorTracker;
    // the sim just shows the HQ view.
    this.toast("Sponsor HQ — sign a brand, clear challenges, get paid.");
    this.bus.emit({ type: "tick", sport: "sponsors", state: this.getState() });
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    this.despawnAthlete();
  }

  update(_dt: number, _input: SportInput): void {
    if (this.athlete) {
      this.chase(this.athlete.position, 8, 3.5);
    }
  }
}
