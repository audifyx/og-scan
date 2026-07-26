/**
 * OrbitX City audio — procedural theme music + UI/world SFX.
 * No external media files; everything is synthesized with Web Audio so it
 * works offline and stays under Vercel asset budgets.
 *
 * Browsers block autoplay until a user gesture — call `unlock()` from the
 * first click/key/touch on the City page.
 */

type ThemeMode = "menu" | "world" | "off";

export interface AudioSnapshot {
  unlocked: boolean;
  musicOn: boolean;
  sfxOn: boolean;
  musicVol: number;
  sfxVol: number;
  mode: ThemeMode;
}

const MUSIC_KEY = "oxc_music_on";
const SFX_KEY = "oxc_sfx_on";
const MUSIC_VOL_KEY = "oxc_music_vol";
const SFX_VOL_KEY = "oxc_sfx_vol";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "1" || v === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function readNum(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
  } catch {
    return fallback;
  }
}

function writeNum(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

/** A minor / cyber-city palette (Hz). */
const NOTE = {
  A2: 110,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  G3: 196,
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392,
  A4: 440,
  C5: 523.25,
  E5: 659.25,
} as const;

type Listener = () => void;

class CityAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private unlocked = false;
  private mode: ThemeMode = "off";
  private timer: number | null = null;
  private step = 0;
  private musicOn = readBool(MUSIC_KEY, true);
  private sfxOn = readBool(SFX_KEY, true);
  private musicVol = readNum(MUSIC_VOL_KEY, 0.45);
  private sfxVol = readNum(SFX_VOL_KEY, 0.7);
  // Cached immutable snapshot for useSyncExternalStore. MUST be a stable
  // reference between changes — rebuilt only inside notify() when state mutates.
  private snapshot: AudioSnapshot = this.buildSnapshot();
  private listeners = new Set<Listener>();
  /** BPM for the OrbitX City theme */
  private readonly bpm = 92;

  subscribe = (cb: Listener) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private notify() {
    // Rebuild the cached snapshot BEFORE notifying so subscribers (React's
    // useSyncExternalStore) read the fresh immutable object. getState() must
    // otherwise return a stable reference on every call, or React re-renders
    // endlessly ("Maximum update depth exceeded").
    this.snapshot = this.buildSnapshot();
    for (const cb of this.listeners) cb();
  }

  private buildSnapshot(): AudioSnapshot {
    return {
      unlocked: this.unlocked,
      musicOn: this.musicOn,
      sfxOn: this.sfxOn,
      musicVol: this.musicVol,
      sfxVol: this.sfxVol,
      mode: this.mode,
    };
  }

  getState(): AudioSnapshot {
    return this.snapshot;
  }

  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? this.musicVol : 0;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxOn ? this.sfxVol : 0;
      this.sfxGain.connect(this.master);
    }

    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* user gesture may still be required */
      }
    }

    const was = this.unlocked;
    this.unlocked = this.ctx.state === "running";
    if (this.unlocked && !was) {
      this.notify();
      if (this.mode !== "off" && this.musicOn) this.startLoop();
    }
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    writeBool(MUSIC_KEY, on);
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(on ? this.musicVol : 0, this.ctx.currentTime + 0.2);
    }
    if (on && this.unlocked && this.mode !== "off") this.startLoop();
    if (!on) this.stopLoop();
    this.notify();
  }

  setSfxOn(on: boolean) {
    this.sfxOn = on;
    writeBool(SFX_KEY, on);
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.value = on ? this.sfxVol : 0;
    }
    this.notify();
  }

  setMusicVol(v: number) {
    this.musicVol = Math.min(1, Math.max(0, v));
    writeNum(MUSIC_VOL_KEY, this.musicVol);
    if (this.musicGain && this.musicOn) this.musicGain.gain.value = this.musicVol;
    this.notify();
  }

  setSfxVol(v: number) {
    this.sfxVol = Math.min(1, Math.max(0, v));
    writeNum(SFX_VOL_KEY, this.sfxVol);
    if (this.sfxGain && this.sfxOn) this.sfxGain.gain.value = this.sfxVol;
    this.notify();
  }

  /** Switch bed: menu title theme vs in-world ambient bed. */
  setTheme(mode: ThemeMode) {
    const prev = this.mode;
    this.mode = mode;
    if (mode === "off") {
      this.stopLoop();
    } else if (this.unlocked && this.musicOn) {
      if (prev === "off" || !this.timer) this.startLoop();
    }
    this.notify();
  }

  private startLoop() {
    if (this.timer != null || !this.ctx) return;
    const stepMs = (60_000 / this.bpm) / 4; // 16th notes
    const tick = () => {
      this.scheduleBarStep(this.step);
      this.step = (this.step + 1) % 64; // 4 bars of 16ths
      this.timer = window.setTimeout(tick, stepMs);
    };
    tick();
  }

  private stopLoop() {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.step = 0;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    dest: GainNode,
    when = 0,
    slideTo?: number,
  ) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noiseBurst(dur: number, gain: number, dest: GainNode, when = 0, hp = 400) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur);
  }

  /** OrbitX City theme — cyber ambient loop (menu brighter, world softer). */
  private scheduleBarStep(step: number) {
    if (!this.ctx || !this.musicGain || !this.musicOn || this.mode === "off") return;
    const world = this.mode === "world";
    const mul = world ? 0.72 : 1;

    // Soft pulse on beats 1 & 3
    if (step % 8 === 0) {
      this.tone(55, 0.18, "sine", 0.22 * mul, this.musicGain);
      this.noiseBurst(0.06, 0.08 * mul, this.musicGain, 0, 200);
    }
    // Offbeat hush
    if (step % 8 === 4) {
      this.tone(82.4, 0.12, "triangle", 0.08 * mul, this.musicGain);
    }

    // Bass line (bar pattern)
    const bass = [NOTE.A2, NOTE.A2, NOTE.C3, NOTE.E3, NOTE.G3, NOTE.E3, NOTE.D3, NOTE.C3];
    if (step % 2 === 0) {
      const idx = Math.floor(step / 2) % bass.length;
      this.tone(bass[idx]!, 0.28, "sawtooth", 0.07 * mul, this.musicGain);
    }

    // Pad chords every half-bar
    if (step % 16 === 0) {
      const chords =
        Math.floor(step / 16) % 2 === 0
          ? [NOTE.A3, NOTE.C4, NOTE.E4]
          : [NOTE.G3, NOTE.C4, NOTE.D4];
      for (const f of chords) {
        this.tone(f, 1.6, "sine", 0.045 * mul, this.musicGain);
        this.tone(f * 2, 1.6, "triangle", 0.02 * mul, this.musicGain);
      }
    }

    // Arpeggio sparkle
    const arp = [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5, NOTE.G4, NOTE.A4, NOTE.E4, NOTE.C5];
    if (!world || step % 2 === 0) {
      if (step % 2 === 0) {
        const f = arp[(step / 2) % arp.length]!;
        this.tone(f, 0.22, "triangle", (world ? 0.035 : 0.055) * mul, this.musicGain);
      }
    }

    // Signature lead motif every 2 bars (OrbitX hook)
    // A4 → C5 → E5 → G4 → A4
    if (step === 0 || step === 32) {
      const motif = [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.G4, NOTE.A4];
      motif.forEach((f, i) => {
        this.tone(f, 0.35, "square", 0.04 * mul, this.musicGain, i * 0.18);
      });
    }
  }

  /** One-shot SFX */
  play(kind: "ui" | "confirm" | "interact" | "coin" | "enter" | "deny" | "whoosh") {
    void this.unlock();
    if (!this.ctx || !this.sfxGain || !this.sfxOn) return;

    switch (kind) {
      case "ui":
        this.tone(880, 0.06, "sine", 0.12, this.sfxGain);
        break;
      case "confirm":
        this.tone(523, 0.08, "sine", 0.14, this.sfxGain);
        this.tone(784, 0.12, "sine", 0.12, this.sfxGain, 0.07);
        break;
      case "interact":
        this.tone(660, 0.1, "triangle", 0.16, this.sfxGain);
        this.tone(990, 0.16, "sine", 0.1, this.sfxGain, 0.05);
        break;
      case "coin":
        this.tone(1200, 0.08, "square", 0.1, this.sfxGain);
        this.tone(1600, 0.14, "sine", 0.12, this.sfxGain, 0.05);
        break;
      case "enter":
        [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4].forEach((f, i) => {
          this.tone(f, 0.35, "sawtooth", 0.08, this.sfxGain, i * 0.1);
        });
        break;
      case "deny":
        this.tone(180, 0.2, "sawtooth", 0.12, this.sfxGain);
        break;
      case "whoosh":
        this.noiseBurst(0.25, 0.12, this.sfxGain, 0, 600);
        this.tone(400, 0.25, "sine", 0.06, this.sfxGain, 0, 120);
        break;
      default:
        break;
    }
  }

  dispose() {
    this.stopLoop();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
  }
}

export const cityAudio = new CityAudioEngine();
