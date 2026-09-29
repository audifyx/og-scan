/** Minimal WebAudio: engine hum + UI SFX. No assets. */

export class GameAudio {
  private ctx: AudioContext | null = null;
  private engOsc: OscillatorNode | null = null;
  private engGain: GainNode | null = null;
  enabled = true;

  private ac(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.engineStop();
  }

  /** Call on first user gesture to unlock audio. */
  unlock() {
    this.ac();
  }

  private blip(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.08, slide?: number) {
    const c = this.ac();
    if (!c) return;
    try {
      const t0 = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch { /* decorative */ }
  }

  click() { this.blip(660, 0.06, "square", 0.04); }
  door() { this.blip(160, 0.14, "triangle", 0.14, 80); this.blip(320, 0.08, "sine", 0.06); }
  horn() { this.blip(370, 0.35, "sawtooth", 0.07); this.blip(466, 0.35, "sawtooth", 0.05); }
  crash() { this.blip(120, 0.25, "sawtooth", 0.12, 50); }
  cash() { this.blip(880, 0.09, "sine", 0.07); this.blip(1320, 0.12, "sine", 0.07); }

  /** Two-tone police siren wail (integrator: pursuit audio). Decorative. */
  siren(cycles = 2) {
    for (let i = 0; i < cycles; i++) {
      const delay = i * 0.9;
      setTimeout(() => this.blip(700, 0.42, "triangle", 0.06, 950), delay * 1000);
      setTimeout(() => this.blip(950, 0.42, "triangle", 0.06, 700), (delay + 0.45) * 1000);
    }
  }

  engineStart() {
    const c = this.ac();
    if (!c || this.engOsc) return;
    try {
      this.engOsc = c.createOscillator();
      this.engGain = c.createGain();
      this.engOsc.type = "sawtooth";
      this.engOsc.frequency.value = 55;
      this.engGain.gain.value = 0;
      const filt = c.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 320;
      this.engOsc.connect(filt).connect(this.engGain).connect(c.destination);
      this.engOsc.start();
    } catch { /* noop */ }
  }

  engineLevel(speed01: number, on: boolean) {
    if (!this.engOsc || !this.engGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.15);
    this.engOsc.frequency.setTargetAtTime(55 + speed01 * 90, t, 0.2);
  }

  engineStop() {
    try {
      this.engOsc?.stop();
    } catch { /* noop */ }
    this.engOsc = null;
    this.engGain = null;
  }
}
