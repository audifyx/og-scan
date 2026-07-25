/**
 * OrbitX City — procedural WebAudio sound engine.
 *
 * All sounds are synthesized at runtime (no audio assets to ship / load), so the
 * demo stays lightweight. A single shared AudioContext is created lazily on the
 * first user gesture to satisfy browser autoplay policies. Mute state persists
 * to localStorage so it survives reloads.
 */

export type SfxName =
  | "hover"
  | "click"
  | "open"
  | "close"
  | "interact"
  | "enter"
  | "pickup"
  | "step"
  | "deny";

const STORAGE_KEY = "oxc.sound.enabled";

type Listener = (enabled: boolean) => void;

class CitySound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private listeners = new Set<Listener>();
  private _enabled: boolean;

  constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    this._enabled = stored === null ? true : stored === "1";
  }

  get enabled(): boolean {
    return this._enabled;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this._enabled);
  }

  setEnabled(v: boolean) {
    this._enabled = v;
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore persistence errors (private mode etc.) */
    }
    if (!v) this.stopAmbient();
    this.emit();
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  /** Lazily create + resume the shared audio context. Call from a user gesture. */
  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    endFreq?: number,
  ) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, peak: number, cutoff: number) {
    if (!this.ctx || !this.master) return;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  play(name: SfxName) {
    if (!this._enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    switch (name) {
      case "hover":
        this.tone(880, t, 0.06, "sine", 0.06);
        break;
      case "click":
        this.tone(520, t, 0.08, "triangle", 0.12, 700);
        break;
      case "open":
        this.tone(420, t, 0.16, "sawtooth", 0.09, 880);
        this.tone(660, t + 0.02, 0.16, "sine", 0.06);
        break;
      case "close":
        this.tone(660, t, 0.14, "sawtooth", 0.08, 300);
        break;
      case "interact":
        this.tone(600, t, 0.1, "square", 0.09, 900);
        this.tone(1200, t + 0.05, 0.1, "sine", 0.06);
        break;
      case "enter":
        // Rising major arpeggio chord — "world boot".
        [392, 523.25, 659.25, 783.99].forEach((f, i) =>
          this.tone(f, t + i * 0.09, 0.5, "triangle", 0.12),
        );
        break;
      case "pickup":
        // Bright ascending shard chime.
        [659.25, 987.77, 1318.51].forEach((f, i) =>
          this.tone(f, t + i * 0.05, 0.18, "sine", 0.11),
        );
        break;
      case "step":
        this.noise(t, 0.07, 0.05, 500);
        break;
      case "deny":
        this.tone(200, t, 0.16, "sawtooth", 0.1, 120);
        break;
    }
  }

  /** Low neon city drone that loops while inside the world. */
  startAmbient() {
    if (!this._enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master || this.ambient) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const oscs = [55, 82.5, 110].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? "sine" : "sawtooth";
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      o.connect(filter);
      o.start();
      return o;
    });
    filter.connect(gain);
    gain.connect(this.master);
    this.ambient = { osc: oscs, gain };
  }

  stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const { osc, gain } = this.ambient;
    const now = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc.forEach((o) => o.stop(now + 0.7));
    } catch {
      /* context may be closed */
    }
    this.ambient = null;
  }
}

export const citySound = new CitySound();
