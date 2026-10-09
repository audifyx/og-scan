/**
 * OrbitX City audio — uploaded theme MP3s + procedural UI/world SFX.
 * Theme tracks live in /orbitxcity/music. Browsers block autoplay until a
 * user gesture — call `unlock()` from the first click/key/touch.
 */

import {
  DEFAULT_THEME_TRACK_ID,
  THEME_TRACKS,
  getThemeTrack,
  type ThemeTrack,
} from "./themeTracks";

type ThemeMode = "menu" | "world" | "off";

export interface AudioSnapshot {
  unlocked: boolean;
  musicOn: boolean;
  sfxOn: boolean;
  musicVol: number;
  sfxVol: number;
  mode: ThemeMode;
  trackId: string;
  trackTitle: string;
  tracks: ThemeTrack[];
}

const MUSIC_KEY = "oxc_music_on";
const SFX_KEY = "oxc_sfx_on";
const MUSIC_VOL_KEY = "oxc_music_vol";
const SFX_VOL_KEY = "oxc_sfx_vol";
const TRACK_KEY = "oxc_theme_track";

const FADE_MS = 1400;

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

function readTrackId(): string {
  try {
    const v = localStorage.getItem(TRACK_KEY);
    if (v && THEME_TRACKS.some((t) => t.id === v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME_TRACK_ID;
}

function writeTrackId(id: string) {
  try {
    localStorage.setItem(TRACK_KEY, id);
  } catch {
    /* ignore */
  }
}

/** A minor / cyber-city palette (Hz) — used for SFX only. */
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
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode[] = [];
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientStopTimer: number | null = null;
  private ambientRunning = false;
  private mediaEl: HTMLAudioElement | null = null;
  private mediaNode: MediaElementAudioSourceNode | null = null;
  private graphOk = false;
  private kickedPlay = false;
  private fadeTimer: number | null = null;
  private unlocked = false;
  private mode: ThemeMode = "off";
  private musicOn = readBool(MUSIC_KEY, true);
  private sfxOn = readBool(SFX_KEY, true);
  private musicVol = readNum(MUSIC_VOL_KEY, 0.45);
  private sfxVol = readNum(SFX_VOL_KEY, 0.7);
  private trackId = readTrackId();
  private snapshot: AudioSnapshot = this.buildSnapshot();
  private listeners = new Set<Listener>();

  subscribe = (cb: Listener) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private notify() {
    this.snapshot = this.buildSnapshot();
    for (const cb of this.listeners) cb();
  }

  private buildSnapshot(): AudioSnapshot {
    const track = getThemeTrack(this.trackId);
    return {
      unlocked: this.unlocked,
      musicOn: this.musicOn,
      sfxOn: this.sfxOn,
      musicVol: this.musicVol,
      sfxVol: this.sfxVol,
      mode: this.mode,
      trackId: track.id,
      trackTitle: track.title,
      tracks: THEME_TRACKS,
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
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxOn ? this.sfxVol : 0;
      this.sfxGain.connect(this.master);

      this.ensureMedia();
    }

    // Kick the media element synchronously inside the raw gesture, before any
    // awaits, so Safari/Chrome treat playback as user-initiated.
    const wantTheme = this.mode === "menu" && this.musicOn;
    if (wantTheme && this.mediaEl && this.mediaEl.paused) {
      this.kickedPlay = true;
      const p = this.mediaEl.play();
      if (p) {
        p.catch(() => {
          this.kickedPlay = false;
        });
      }
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
    if (this.unlocked !== was) this.notify();
    // Retry on every gesture until the theme is actually playing — autoplay
    // can reject media playback even when the AudioContext is running.
    // Re-evaluate here: musicOn/mode may have changed while resume() awaited.
    const wantThemeNow = this.mode === "menu" && this.musicOn;
    if (this.unlocked && wantThemeNow && (this.kickedPlay || !this.mediaEl || this.mediaEl.paused)) {
      this.kickedPlay = false;
      void this.playTheme({ fadeIn: true });
    }
    if (this.unlocked && this.mode === "world" && this.musicOn) this.startWorldAmbient();
  }

  private ensureMedia() {
    if (typeof window === "undefined" || this.mediaEl || !this.ctx || !this.musicGain) return;
    const el = new Audio();
    el.preload = "auto";
    el.loop = true;
    el.src = getThemeTrack(this.trackId).src;
    // Wire through Web Audio so volume fades stay smooth with the graph. If
    // that fails (HMR double-connect, odd browsers) the element outputs
    // directly and we drive el.volume instead.
    try {
      this.mediaNode = this.ctx.createMediaElementSource(el);
      this.mediaNode.connect(this.musicGain);
      this.graphOk = true;
    } catch {
      this.graphOk = false;
      el.volume = this.musicOn ? this.musicVol : 0;
    }
    el.addEventListener("ended", () => {
      if (this.mode === "menu" && this.musicOn) void el.play().catch(() => undefined);
    });
    this.mediaEl = el;
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    writeBool(MUSIC_KEY, on);
    if (on && this.unlocked && this.mode === "menu") {
      void this.playTheme({ fadeIn: true });
    } else if (!on) {
      void this.fadeThemeTo(0, true);
      this.stopWorldAmbient();
    }
    if (on && this.unlocked && this.mode === "world") this.startWorldAmbient();
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
    if (this.musicGain && this.ctx && this.musicOn && this.mode === "menu") {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(this.musicVol, this.ctx.currentTime);
    }
    if (!this.graphOk && this.mediaEl && this.musicOn) this.mediaEl.volume = this.musicVol;
    this.notify();
  }

  setSfxVol(v: number) {
    this.sfxVol = Math.min(1, Math.max(0, v));
    writeNum(SFX_VOL_KEY, this.sfxVol);
    if (this.sfxGain && this.sfxOn) this.sfxGain.gain.value = this.sfxVol;
    this.notify();
  }

  setTrack(id: string) {
    const track = getThemeTrack(id);
    if (track.id === this.trackId && this.mediaEl) {
      // Re-selecting current track restarts it when music is on.
      if (this.musicOn && this.mode === "menu") void this.playTheme({ restart: true, fadeIn: true });
      return;
    }
    this.trackId = track.id;
    writeTrackId(track.id);
    this.ensureMedia();
    if (this.mediaEl) {
      const wasPlaying = !this.mediaEl.paused;
      this.mediaEl.src = track.src;
      this.mediaEl.load();
      if (wasPlaying || (this.musicOn && this.mode === "menu" && this.unlocked)) {
        void this.playTheme({ restart: true, fadeIn: true });
      }
    }
    this.notify();
  }

  nextTrack() {
    const idx = THEME_TRACKS.findIndex((t) => t.id === this.trackId);
    const next = THEME_TRACKS[(idx + 1) % THEME_TRACKS.length]!;
    this.setTrack(next.id);
  }

  prevTrack() {
    const idx = THEME_TRACKS.findIndex((t) => t.id === this.trackId);
    const prev = THEME_TRACKS[(idx - 1 + THEME_TRACKS.length) % THEME_TRACKS.length]!;
    this.setTrack(prev.id);
  }

  /** Switch bed: menu plays theme; world fades theme + starts soft city pad; off stops. */
  setTheme(mode: ThemeMode) {
    const prev = this.mode;
    this.mode = mode;
    if (mode === "off") {
      void this.fadeThemeTo(0, true);
      this.stopWorldAmbient();
    } else if (mode === "world") {
      // Fade menu theme; keep a soft procedural Midtown bed under the streets.
      void this.fadeThemeTo(0, true);
      if (this.unlocked && this.musicOn) this.startWorldAmbient();
    } else if (mode === "menu") {
      this.stopWorldAmbient();
      if (this.unlocked && this.musicOn) {
        void this.playTheme({ fadeIn: prev !== "menu" });
      }
    }
    this.notify();
  }

  /** Soft pad + distant traffic hiss while walking the city. */
  private startWorldAmbient() {
    if (!this.ctx || !this.master || !this.musicOn || this.ambientRunning) return;
    if (this.ambientStopTimer != null) {
      window.clearTimeout(this.ambientStopTimer);
      this.ambientStopTimer = null;
    }
    this.teardownAmbientNodes();

    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(this.master);
    this.ambientGain = g;

    const mkOsc = (freq: number, type: OscillatorType, level: number) => {
      const o = this.ctx!.createOscillator();
      const og = this.ctx!.createGain();
      o.type = type;
      o.frequency.value = freq;
      og.gain.value = level;
      o.connect(og);
      og.connect(g);
      o.start();
      this.ambientOsc.push(o);
    };
    mkOsc(NOTE.A2, "sine", 0.045);
    mkOsc(NOTE.E3, "triangle", 0.022);
    mkOsc(NOTE.A3, "sine", 0.012);

    // Looped filtered noise = distant traffic / AC hum.
    const seconds = 2.5;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.028;
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(g);
    noise.start();
    this.ambientNoise = noise;

    const target = Math.max(0.04, this.musicVol * 0.38);
    const t0 = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(target, t0 + 1.4);
    this.ambientRunning = true;
  }

  private stopWorldAmbient() {
    if (!this.ambientGain || !this.ctx || !this.ambientRunning) {
      this.teardownAmbientNodes();
      return;
    }
    const t0 = this.ctx.currentTime;
    this.ambientGain.gain.cancelScheduledValues(t0);
    this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), t0);
    this.ambientGain.gain.linearRampToValueAtTime(0.0001, t0 + 0.85);
    if (this.ambientStopTimer != null) window.clearTimeout(this.ambientStopTimer);
    this.ambientStopTimer = window.setTimeout(() => {
      this.ambientStopTimer = null;
      this.teardownAmbientNodes();
    }, 920);
    this.ambientRunning = false;
  }

  private teardownAmbientNodes() {
    for (const o of this.ambientOsc) {
      try {
        o.stop();
        o.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.ambientOsc = [];
    if (this.ambientNoise) {
      try {
        this.ambientNoise.stop();
        this.ambientNoise.disconnect();
      } catch {
        /* already stopped */
      }
      this.ambientNoise = null;
    }
    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch {
        /* ignore */
      }
      this.ambientGain = null;
    }
    this.ambientRunning = false;
  }

  private async playTheme(opts: { fadeIn?: boolean; restart?: boolean } = {}) {
    this.ensureMedia();
    if (!this.mediaEl || !this.musicGain || !this.ctx || !this.musicOn) return;
    if (this.mode !== "menu") return;

    if (opts.restart) {
      try {
        this.mediaEl.currentTime = 0;
      } catch {
        /* ignore */
      }
    }

    try {
      await this.mediaEl.play();
    } catch {
      // Autoplay still blocked — wait for next gesture.
      return;
    }

    const target = this.musicVol;
    if (!this.graphOk) {
      this.mediaEl.volume = target;
      return;
    }
    if (opts.fadeIn) {
      this.rampMusicGain(0.0001, target, FADE_MS);
    } else {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
  }

  private async fadeThemeTo(target: number, pauseWhenSilent: boolean) {
    if (!this.musicGain || !this.ctx) return;
    if (!this.graphOk && this.mediaEl) {
      this.mediaEl.volume = Math.min(1, Math.max(0, target));
    }
    const from = Math.max(0.0001, this.musicGain.gain.value || 0.0001);
    this.rampMusicGain(from, Math.max(0.0001, target), FADE_MS);

    if (this.fadeTimer != null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (pauseWhenSilent && target <= 0.001) {
      this.fadeTimer = window.setTimeout(() => {
        this.fadeTimer = null;
        try {
          this.mediaEl?.pause();
        } catch {
          /* ignore */
        }
      }, FADE_MS + 40);
    }
  }

  private rampMusicGain(from: number, to: number, ms: number) {
    if (!this.musicGain || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t0);
    this.musicGain.gain.setValueAtTime(Math.max(0.0001, from), t0);
    this.musicGain.gain.linearRampToValueAtTime(Math.max(0.0001, to), t0 + ms / 1000);
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
    if (this.fadeTimer != null) window.clearTimeout(this.fadeTimer);
    if (this.ambientStopTimer != null) window.clearTimeout(this.ambientStopTimer);
    this.teardownAmbientNodes();
    try {
      this.mediaEl?.pause();
    } catch {
      /* ignore */
    }
    this.mediaEl = null;
    this.mediaNode = null;
    this.graphOk = false;
    this.kickedPlay = false;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
  }
}

export const cityAudio = new CityAudioEngine();
