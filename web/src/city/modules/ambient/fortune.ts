import * as THREE from "three";
import { buildFigure } from "./npcs";
import type { CityLedger } from "./ledger";
import type { AmbientAudio } from "./audio";
import type { Interactable, FortuneCard, MarketQuote } from "./types";

/**
 * Fortune teller: "predicts your next trade". Costs 5 paper CITY per reading.
 * Picks a random tracked symbol, invents a bullish/bearish prophecy from its
 * live price — pure flavor, zero predictive power (say so on the card).
 */

const COST = 5;

const OPENERS = [
  "The cards whisper…",
  "I see candles in your future…",
  "The spirits of the order book speak…",
  "Your aura smells like leverage…",
];

const BULLISH = [
  "a green dawn breaks over this chart",
  "the bulls are gathering at the gates",
  "diamond hands shall be rewarded",
  "a whale smiles upon this token",
];

const BEARISH = [
  "red tides approach — guard your stops",
  "the bears sharpen their claws",
  "a shadow crosses this chart",
  "paper hands will weep at dawn",
];

const LUCKY = [
  "Your lucky number is 21 — the block reward of legends.",
  "Avoid trading at 3:33 AM. The bots feed then.",
  "Wear something green. The charts notice.",
  "Tip a busker today. Karma compounds.",
  "The moon is waxing. So is your portfolio, allegedly.",
];

export class FortuneTeller {
  private scene: THREE.Scene;
  private ledger: CityLedger;
  private audio: AmbientAudio;
  private getQuotes: () => Record<string, MarketQuote>;
  private fig: ReturnType<typeof buildFigure>;
  private pos = new THREE.Vector3(24, 0, -8);
  private cooldownUntil = 0;
  private phase = 0;
  private onFortune: (f: FortuneCard) => void;
  private onToast: (t: string) => void;

  constructor(
    scene: THREE.Scene, ledger: CityLedger, audio: AmbientAudio,
    getQuotes: () => Record<string, MarketQuote>,
    onFortune: (f: FortuneCard) => void, onToast: (t: string) => void,
  ) {
    this.scene = scene;
    this.ledger = ledger;
    this.audio = audio;
    this.getQuotes = getQuotes;
    this.onFortune = onFortune;
    this.onToast = onToast;
    this.fig = buildFigure({ shirt: 0x5a2a6b, pants: 0x2a1a3a, hair: 0x111111, scale: 0.98 });
    this.fig.group.position.copy(this.pos);
    // crystal ball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x99ccff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.75, emissive: 0x224466, emissiveIntensity: 0.6 }),
    );
    ball.position.set(0, 1.35, 0.35);
    this.fig.group.add(ball);
    // table
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.45, 0.75, 10),
      new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.7 }),
    );
    table.position.set(this.pos.x, 0.375, this.pos.z + 0.8);
    table.castShadow = false;
    this.scene.add(this.fig.group, table);
    (this as any).__table = table;
    (this as any).__ball = ball;
  }

  /** Interact: spend 5 paper CITY for a prophecy. */
  read(): void {
    const now = performance.now();
    if (now < this.cooldownUntil) {
      this.onToast("Madame Zola is consulting the spirits… wait a moment.");
      return;
    }
    if (!this.ledger.spend(COST, "fortune-reading")) {
      this.onToast(`A reading costs ${COST} paper CITY. The spirits don't take IOUs.`);
      return;
    }
    this.cooldownUntil = now + 20000;
    this.audio.chime();

    let symbol = "ORBITX", price = 0, change = 0;
    try {
      const quotes = this.getQuotes();
      const syms = Object.keys(quotes);
      if (syms.length) {
        symbol = syms[(Math.random() * syms.length) | 0];
        price = quotes[symbol].price;
        change = quotes[symbol].change24h;
      }
    } catch { /* flavor without live data is fine */ }

    const bullish = Math.random() < 0.5;
    const prophecy = bullish
      ? BULLISH[(Math.random() * BULLISH.length) | 0]
      : BEARISH[(Math.random() * BEARISH.length) | 0];
    this.onFortune({
      title: "🔮 Madame Zola's Prophecy",
      body: `${OPENERS[(Math.random() * OPENERS.length) | 0]} For ${symbol}, ${prophecy}. (For entertainment only — the spirits are not financial advisors.)`,
      symbol,
      price: price > 0 ? `$${price.toFixed(price < 1 ? 6 : 2)}` : "—",
      change: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      lucky: LUCKY[(Math.random() * LUCKY.length) | 0],
    });
  }

  getInteractable(): Interactable {
    return {
      x: this.pos.x, z: this.pos.z, radius: 3.4,
      label: `🔮 Ask Madame Zola (${COST} CITY)`,
      act: () => this.read(),
    };
  }

  update(dt: number) {
    this.phase += dt * 2;
    this.fig.update(dt, 0.03);
    const ball = (this as any).__ball as THREE.Mesh;
    (ball.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.sin(this.phase) * 0.25;
  }

  dispose() {
    this.scene.remove(this.fig.group, (this as any).__table);
    this.fig.dispose();
  }
}

export const FORTUNE_COST = COST;
