/**
 * Generative DJ engine — live party audio with zero assets.
 *
 * WebAudio 16-step sequencer with per-genre patterns (drums, bass, chords,
 * lead). No MP3s, no network, works offline and on mobile. The UI wires
 * start/stop/volume/genre; everything else is automatic.
 */

export type DjGenre = "synthwave" | "hard techno" | "deep house" | "glitch/bass" | "lo-fi house";

interface Pattern {
  bpm: number;
  root: number; // Hz, bass root (A1 ~ 55)
  kick: number[]; // steps with kick
  hat: number[]; // closed hats
  openHat: number[];
  snare: number[];
  bass: (number | null)[]; // semitone offsets, 16 steps
  stab: (number | null)[]; // chord stab offsets
  lead: (number | null)[]; // lead arp offsets
}

const K = (steps: number[]) => steps;
const FF = [0, 4, 8, 12]; // four on the floor

const PATTERNS: Record<DjGenre, Pattern> = {
  synthwave: {
    bpm: 102, root: 55,
    kick: K(FF), hat: K([2, 6, 10, 14]), openHat: K([6, 14]), snare: K([4, 12]),
    bass: [0, null, 0, null, 3, null, 0, null, -2, null, -2, null, 5, null, 3, 2],
    stab: [null, null, null, null, 7, null, null, null, null, null, 10, null, null, null, null, null],
    lead: [12, null, null, 15, null, null, 19, null, null, 17, null, 15, null, 12, null, null],
  },
  "hard techno": {
    bpm: 140, root: 49,
    kick: K(FF), hat: K([0, 2, 4, 6, 8, 10, 12, 14]), openHat: K([]), snare: K([4, 12]),
    bass: [0, 0, null, 0, 0, null, 0, 3, 0, 0, null, 0, -2, null, 1, 0],
    stab: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    lead: [null, 12, null, null, 13, null, null, 12, null, null, 10, null, null, 12, null, null],
  },
  "deep house": {
    bpm: 122, root: 55,
    kick: K(FF), hat: K([2, 6, 10, 14]), openHat: K([2, 10]), snare: K([4, 12]),
    bass: [0, null, null, 0, null, null, 3, null, null, 0, null, null, -2, null, 5, null],
    stab: [7, null, null, null, null, null, null, 10, null, null, null, null, 12, null, null, null],
    lead: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  "glitch/bass": {
    bpm: 100, root: 41.2,
    kick: K([0, 7, 10]), hat: K([2, 6, 11, 14]), openHat: K([4]), snare: K([4, 12]),
    bass: [0, null, null, 0, null, null, null, -5, null, null, 0, null, 3, null, -2, null],
    stab: [null, null, 12, null, null, null, null, null, null, 15, null, null, null, null, null, null],
    lead: [null, null, null, 19, null, null, 22, null, null, null, null, 17, null, null, 15, null],
  },
  "lo-fi house": {
    bpm: 108, root: 55,
    kick: K([0, 8]), hat: K([2, 6, 10, 14]), openHat: K([14]), snare: K([4, 12]),
    bass: [0, null, null, null, null, null, 3, null, null, null, null, 5, null, null, -2, null],
    stab: [3, null, null, 7, null, null, 10, null, null, 7, null, null, 5, null, null, null],
    lead: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
};

const semi = (root: number, s: number) => root * Math.pow(2, s / 12);

export interface DjHandle {
  setVolume(v: number): void; // 0..1
  stop(): void;
  readonly genre: DjGenre;
  readonly bpm: number;
}

export function startDjSet(genre: DjGenre, volume = 0.7): DjHandle | null {
  const pat = PATTERNS[genre];
  if (!pat) return null;
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return null; // audio unavailable — UI shows a notice
  }
  const master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);

  const stepDur = 60 / pat.bpm / 4;
  let step = 0;
  let nextT = ctx.currentTime + 0.06;
  let alive = true;

  function noiseBuf(dur: number): AudioBufferSourceNode {
    const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = b;
    return s;
  }

  function kick(t: number) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.26);
  }
  function hat(t: number, open: boolean) {
    const n = noiseBuf(open ? 0.3 : 0.05);
    const f = ctx.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(open ? 0.28 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.28 : 0.045));
    n.connect(f); f.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.32);
  }
  function snare(t: number) {
    const n = noiseBuf(0.18);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.2);
  }
  function bass(t: number, semitone: number, dur: number) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = semi(pat.root, semitone);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.34, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function stab(t: number, semitone: number) {
    [0, 3, 7].forEach((iv) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = semi(pat.root * 4, semitone + iv);
      o.detune.value = (Math.random() - 0.5) * 14;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 2400;
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.55);
    });
  }
  function lead(t: number, semitone: number) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = semi(pat.root * 4, semitone);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 3200;
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + stepDur * 2);
  }

  const timer = setInterval(() => {
    if (!alive) return;
    while (nextT < ctx.currentTime + 0.15) {
      const s = step % 16;
      const t = nextT;
      if (pat.kick.includes(s)) kick(t);
      if (pat.hat.includes(s)) hat(t, false);
      if (pat.openHat.includes(s)) hat(t, true);
      if (pat.snare.includes(s)) snare(t);
      const b = pat.bass[s];
      if (b !== null && b !== undefined) bass(t, b, stepDur * 0.9);
      const st = pat.stab[s];
      if (st !== null && st !== undefined) stab(t, st);
      const ld = pat.lead[s];
      if (ld !== null && ld !== undefined) lead(t, ld);
      step++;
      nextT += stepDur;
    }
  }, 30);

  return {
    genre,
    bpm: pat.bpm,
    setVolume(v: number) {
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.05);
    },
    stop() {
      alive = false;
      clearInterval(timer);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      setTimeout(() => ctx.close().catch(() => undefined), 400);
    },
  };
}

export const DJ_GENRES: DjGenre[] = ["synthwave", "hard techno", "deep house", "glitch/bass", "lo-fi house"];

/** Map a bookable DJ's genre string to the closest synth pattern. */
export function genreForDj(genre: string): DjGenre {
  const g = genre.toLowerCase();
  if (g.includes("techno")) return "hard techno";
  if (g.includes("house") && g.includes("lo")) return "lo-fi house";
  if (g.includes("house")) return "deep house";
  if (g.includes("glitch") || g.includes("bass")) return "glitch/bass";
  return "synthwave";
}
