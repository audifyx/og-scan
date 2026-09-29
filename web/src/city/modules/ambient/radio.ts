import type { ChaosBus } from "./chaos";
import type { AmbientAudio } from "./audio";
import type { MarketQuote } from "./types";

/**
 * Conspiracy theorist radio host — "live on air" from a rooftop pirate
 * station. Rants about market manipulation on chaos events and big market
 * moves. Lines stream to UiState.radioLines; a static burst sells the "live"
 * feel. Flavor only.
 */

const KIND_RANTS: Record<string, string[]> = {
  fire: [
    "BREAKING: another 'accidental' fire downtown. The insurance lobby sends its regards.",
    "That fire? Started EXACTLY when the futures expired. Coincidence? The market says no.",
  ],
  crash: [
    "A crash on 5th! The market makers are liquidating CARS now, folks!",
    "Traffic's down because the whales shorted the commute. WAKE UP.",
  ],
  brawl: [
    "Fists flying on the corner — bears vs bulls, live and unregulated!",
    "That brawl was funded by dark-pool money. My sources are EVERYWHERE.",
  ],
  blackout: [
    "BLACKOUT. The grid didn't fail, the grid was TOLD to fail.",
    "No power, no charts, no truth. Exactly how they want it.",
  ],
  chase: [
    "Police chase LIVE — the SEC finally going after a real pump-and-dumper!",
    "He's running because his portfolio is 100% leverage and 0% exits.",
  ],
};

const MARKET_RANTS = [
  "This pump is a trap. I can SMELL the liquidity grab from here.",
  "Somebody just market-bought the whole order book. Somebody with a yacht.",
  "Red candles? That's not selling, that's THE MAN shaking you out.",
  "Green candles? Distribution, people. They're handing you their bags.",
  "The chart is flat because the printers are resting. They never sleep, but they rest.",
];

const IDLE_RANTS = [
  "You're listening to W-O-R-B, the only honest frequency in this rigged city.",
  "Caller, you're on the air. Make it quick, the feds triangulate.",
  "Gold is up, trust is down, and my landlord still wants rent. Connect the dots.",
  "They put fluoride in the tap water and slippage in your swaps. Same playbook.",
];

export class RadioHost {
  private bus: ChaosBus;
  private audio: AmbientAudio;
  private getQuotes: () => Record<string, MarketQuote>;
  private lines: string[] = [];
  private unsub: (() => void) | null = null;
  private lastQuoteCheck = 0;
  private lastMoveAt = new Map<string, number>();
  private idleTimer = 0;

  constructor(bus: ChaosBus, audio: AmbientAudio, getQuotes: () => Record<string, MarketQuote>) {
    this.bus = bus;
    this.audio = audio;
    this.getQuotes = getQuotes;
    this.unsub = this.bus.on((e) => {
      const pool = KIND_RANTS[e.kind] ?? IDLE_RANTS;
      this.say(pool[(Math.random() * pool.length) | 0]);
    });
    this.say("🎙️ W-O-R-B is LIVE. The truth has a frequency.");
  }

  private say(text: string) {
    this.lines.push(text);
    if (this.lines.length > 6) this.lines.shift();
    this.audio.radioBlip();
  }

  /** Most recent lines, newest last. */
  getLines(): string[] { return this.lines; }

  update(dt: number) {
    // Market-move rants: any tracked symbol moving >8% in 24h (throttled).
    const now = performance.now();
    if (now - this.lastQuoteCheck > 15000) {
      this.lastQuoteCheck = now;
      try {
        const quotes = this.getQuotes();
        for (const [sym, q] of Object.entries(quotes)) {
          const prev = this.lastMoveAt.get(sym) ?? 0;
          if (Math.abs(q.change24h) > 8 && now - prev > 120000) {
            this.lastMoveAt.set(sym, now);
            this.say(`🚨 ${sym} just moved ${q.change24h >= 0 ? "+" : ""}${q.change24h.toFixed(1)}%! ${MARKET_RANTS[(Math.random() * MARKET_RANTS.length) | 0]}`);
            break; // one rant per check
          }
        }
      } catch { /* quotes optional */ }
    }
    // Idle filler so the station never goes dead (~every 75s).
    this.idleTimer += dt;
    if (this.idleTimer > 75) {
      this.idleTimer = 0;
      this.say(IDLE_RANTS[(Math.random() * IDLE_RANTS.length) | 0]);
    }
  }

  dispose() { this.unsub?.(); }
}
