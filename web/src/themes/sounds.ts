/**
 * Theme-native notification sounds (idea 27).
 *
 * Every device-theme family gets a signature blip, synthesized with
 * WebAudio — no audio assets to ship:
 *   Wii → soft "ding" · Xbox 360 → achievement "pop"
 *   PS4 → XMB "tick" · Game Boy → square-wave "blip"
 *   CRT → modem-ish "chirp" · everything else → OrbitX "ping"
 *
 * playNotify() picks the recipe from the active device theme.
 * Call from a user gesture at least once (AudioContext unlock).
 */

export const SOUND_PACK_KEY = "orbitx-sound-pack";
export type SoundPack = "theme" | "muted";

export function getSoundPack(): SoundPack {
  try {
    return localStorage.getItem(SOUND_PACK_KEY) === "muted" ? "muted" : "theme";
  } catch {
    return "theme";
  }
}

export function setSoundPack(p: SoundPack) {
  try {
    localStorage.setItem(SOUND_PACK_KEY, p);
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Blip {
  type: OscillatorType;
  from: number;
  to: number;
  dur: number;
  gain: number;
  delay?: number;
}

function playBlip(ac: AudioContext, b: Blip) {
  const t0 = ac.currentTime + (b.delay ?? 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = b.type;
  osc.frequency.setValueAtTime(b.from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, b.to), t0 + b.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(b.gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + b.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + b.dur + 0.05);
}

/** Signature recipes keyed by device-theme family. */
const RECIPES: Record<string, Blip[]> = {
  wii: [
    { type: "sine", from: 1568, to: 1568, dur: 0.35, gain: 0.22 },
    { type: "sine", from: 2093, to: 2093, dur: 0.5, gain: 0.16, delay: 0.09 },
  ],
  xbox360: [
    { type: "triangle", from: 660, to: 1320, dur: 0.16, gain: 0.25 },
    { type: "triangle", from: 990, to: 1980, dur: 0.22, gain: 0.2, delay: 0.1 },
  ],
  ps4: [{ type: "sine", from: 880, to: 880, dur: 0.09, gain: 0.2 }],
  n3ds: [
    { type: "square", from: 1046, to: 1046, dur: 0.07, gain: 0.08 },
    { type: "square", from: 1318, to: 1318, dur: 0.12, gain: 0.08, delay: 0.07 },
  ],
  gameboy: [{ type: "square", from: 440, to: 880, dur: 0.12, gain: 0.1 }],
  crt: [
    { type: "sawtooth", from: 300, to: 900, dur: 0.14, gain: 0.1 },
    { type: "sawtooth", from: 900, to: 300, dur: 0.14, gain: 0.08, delay: 0.12 },
  ],
  default: [
    { type: "sine", from: 740, to: 1180, dur: 0.18, gain: 0.2 },
    { type: "sine", from: 1180, to: 1480, dur: 0.2, gain: 0.14, delay: 0.1 },
  ],
};

function recipeFor(themeId: string): Blip[] {
  return RECIPES[themeId] ?? RECIPES.default;
}

/**
 * Play the active device theme's notification sound.
 * Pass an explicit theme id to preview a pack in the picker.
 */
export function playNotify(themeId?: string) {
  if (getSoundPack() === "muted") return;
  const ac = ensureCtx();
  if (!ac) return;
  const id =
    themeId ??
    (typeof document !== "undefined" ? document.documentElement.dataset.deviceTheme : "") ??
    "";
  for (const b of recipeFor(id)) playBlip(ac, b);
}

/** Short "achievement unlocked" flourish (achievement pop). */
export function playAchievement() {
  if (getSoundPack() === "muted") return;
  const ac = ensureCtx();
  if (!ac) return;
  const seq: Blip[] = [
    { type: "triangle", from: 523, to: 523, dur: 0.12, gain: 0.22 },
    { type: "triangle", from: 659, to: 659, dur: 0.12, gain: 0.22, delay: 0.1 },
    { type: "triangle", from: 784, to: 784, dur: 0.12, gain: 0.22, delay: 0.2 },
    { type: "triangle", from: 1046, to: 1568, dur: 0.3, gain: 0.25, delay: 0.3 },
  ];
  for (const b of seq) playBlip(ac, b);
}
