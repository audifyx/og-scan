/**
 * Ambient audio: wraps the core GameAudio (structural typing — no import)
 * and adds ambient-only synthesized sounds. No audio assets.
 */

export interface CoreAudioLike {
  cash(): void;
  click(): void;
}

export class AmbientAudio {
  private core: CoreAudioLike | null;
  private ctx: AudioContext | null = null;
  private siren: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;

  constructor(coreAudio: CoreAudioLike | null = null) {
    this.core = coreAudio;
  }

  private ac(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private blip(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.06, slide?: number) {
    const c = this.ac();
    if (!c) return;
    try {
      const t0 = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch { /* decorative */ }
  }

  /** Paper-CITY coin drop. */
  coin() {
    if (this.core) { try { this.core.cash(); } catch { /* noop */ } }
    else this.blip(1320, 0.1, "sine", 0.05);
  }

  pop() {
    if (this.core) { try { this.core.click(); } catch { /* noop */ } }
  }

  /** Magical chime (magician / fortune teller). */
  chime() {
    this.blip(880, 0.18, "sine", 0.06);
    setTimeout(() => this.blip(1174, 0.22, "sine", 0.06), 90);
    setTimeout(() => this.blip(1568, 0.3, "sine", 0.05), 180);
  }

  /** Radio static burst for the conspiracy host. */
  radioBlip() {
    this.blip(180, 0.08, "sawtooth", 0.03, 90);
    setTimeout(() => this.blip(1200, 0.05, "square", 0.02), 70);
  }

  /** Start the emergency wail. Call sirenLevel(0..1) per frame for distance. */
  sirenOn() {
    if (this.siren) return;
    const c = this.ac();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.value = 800;
      lfo.type = "sine";
      lfo.frequency.value = 0.55; // classic wail cycle
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain).connect(osc.frequency);
      gain.gain.value = 0;
      osc.connect(gain).connect(c.destination);
      osc.start();
      lfo.start();
      this.siren = { osc, lfo, gain };
    } catch { /* noop */ }
  }

  sirenLevel(v: number) {
    if (!this.siren || !this.ctx) return;
    this.siren.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.045, this.ctx.currentTime, 0.2);
  }

  sirenOff() {
    if (!this.siren) return;
    try {
      this.siren.osc.stop();
      this.siren.lfo.stop();
    } catch { /* noop */ }
    this.siren = null;
  }

  dispose() {
    this.sirenOff();
    try { void this.ctx?.close(); } catch { /* noop */ }
    this.ctx = null;
  }
}
