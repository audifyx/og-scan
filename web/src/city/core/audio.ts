/**
 * GameAudio — procedural WebAudio SFX for OrbitXcity GTA mode.
 *
 * Zero external assets: every sound is synthesized with the Web Audio API,
 * so there are no audio files to 404 (verified: web/public/orbitxcity/music
 * tracks are owned by the module-stack cityAudio, not this core engine).
 * Everything routes through a master bus so mute / phase changes fade
 * instead of cutting.
 *
 * Public surface (stable — used by World.ts + integration CitySystemsHost):
 *   click, door, horn, crash, cash, siren(cycles), engineStart/Level/Stop,
 *   sirenStart/sirenLevel/sirenStop (looped pursuit wail, new),
 *   unlock, setEnabled
 */

interface SirenLoop {
  osc: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  gain: GainNode;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engOsc: OscillatorNode | null = null;
  private engGain: GainNode | null = null;
  private sirenLoop: SirenLoop | null = null;
  enabled = true;

  private ac(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        // master bus — every voice connects here; fades keep transitions clean
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Clean fade in/out; stops all voices on mute. */
  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      // fade the master bus out fast, then kill voices — no clicks/pops
      try {
        const c = this.ctx;
        if (c && this.master) {
          const t = c.currentTime;
          this.master.gain.cancelScheduledValues(t);
          this.master.gain.setTargetAtTime(0, t, 0.06);
          window.setTimeout(() => {
            this.engineStop();
            this.trafficStop();
            this.rainStop();
            this.sirenStop(true);
          }, 220);
        } else {
          this.engineStop();
          this.sirenStop(true);
        }
      } catch {
        this.engineStop();
        this.sirenStop(true);
      }
    } else {
      const c = this.ac();
      if (c && this.master) {
        try {
          const t = c.currentTime;
          this.master.gain.cancelScheduledValues(t);
          this.master.gain.setTargetAtTime(1, t, 0.1);
        } catch { /* decorative */ }
      }
    }
  }

  /** Call on first user gesture to unlock audio. */
  unlock() {
    this.ac();
  }

  private out(): GainNode | null {
    const c = this.ac();
    return c && this.master ? this.master : null;
  }

  private blip(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.08, slide?: number) {
    const c = this.ac();
    const dest = this.out();
    if (!c || !dest) return;
    try {
      const t0 = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(dest);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch { /* decorative */ }
  }

  click() { this.blip(660, 0.06, "square", 0.04); }

  /** Lightning thunder: filtered noise crack + sub-bass rumble tail. */
  thunder() {
    const c = this.ac();
    const dest = this.out();
    if (!c || !dest) return;
    try {
      const t0 = c.currentTime + 0.05;
      const dur = 2.0;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.4);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 380;
      const g = c.createGain();
      g.gain.value = 0.55;
      src.connect(lp).connect(g).connect(dest);
      src.start(t0);
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(52, t0);
      o.frequency.exponentialRampToValueAtTime(26, t0 + dur);
      const og = c.createGain();
      og.gain.setValueAtTime(0.24, t0);
      og.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(og).connect(dest);
      o.start(t0);
      o.stop(t0 + dur + 0.1);
    } catch { /* decorative */ }
  }
  door() { this.blip(160, 0.14, "triangle", 0.14, 80); this.blip(320, 0.08, "sine", 0.06); }
  horn() { this.blip(370, 0.35, "sawtooth", 0.07); this.blip(466, 0.35, "sawtooth", 0.05); }
  crash() { this.blip(120, 0.25, "sawtooth", 0.12, 50); }
  cash() { this.blip(880, 0.09, "sine", 0.07); this.blip(1320, 0.12, "sine", 0.07); }

  /**
   * One-shot two-tone siren blasts. Wired by the integrator:
   * CitySystemsHost fires `api.audio.siren(2)` on pursuit "spotted".
   */
  siren(cycles = 2) {
    for (let i = 0; i < cycles; i++) {
      const delay = i * 0.9;
      setTimeout(() => this.blip(700, 0.42, "triangle", 0.06, 950), delay * 1000);
      setTimeout(() => this.blip(950, 0.42, "triangle", 0.06, 700), (delay + 0.45) * 1000);
    }
  }

  /**
   * Looped pursuit wail: one oscillator, a slow square LFO sweeps the
   * frequency 700↔950 Hz. Drive per-frame with sirenLevel(0..1) for
   * distance; sirenStop() fades it out cleanly.
   */
  sirenStart() {
    const c = this.ac();
    const dest = this.out();
    if (!c || !dest || this.sirenLoop) return;
    try {
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 825; // midpoint of the wail
      const lfo = c.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 0.55; // ~1.8s wail cycle
      const lfoGain = c.createGain();
      lfoGain.gain.value = 125; // ±125 Hz sweep
      const gain = c.createGain();
      gain.gain.value = 0;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(gain).connect(dest);
      osc.start();
      lfo.start();
      this.sirenLoop = { osc, lfo, lfoGain, gain };
      this.sirenLevel(0.6);
    } catch { /* decorative */ }
  }

  sirenLevel(v: number) {
    if (!this.sirenLoop || !this.ctx) return;
    try {
      this.sirenLoop.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.06, this.ctx.currentTime, 0.2);
    } catch { /* decorative */ }
  }

  sirenStop(immediate = false) {
    const loop = this.sirenLoop;
    if (!loop || !this.ctx) { this.sirenLoop = null; return; }
    this.sirenLoop = null;
    try {
      const t = this.ctx.currentTime;
      loop.gain.gain.cancelScheduledValues(t);
      loop.gain.gain.setTargetAtTime(0, t, immediate ? 0.02 : 0.35);
      window.setTimeout(() => {
        try { loop.osc.stop(); loop.lfo.stop(); } catch { /* noop */ }
        try { loop.osc.disconnect(); loop.lfo.disconnect(); loop.gain.disconnect(); loop.lfoGain.disconnect(); } catch { /* noop */ }
      }, immediate ? 120 : 900);
    } catch { /* decorative */ }
  }

  engineStart() {
    const c = this.ac();
    const dest = this.out();
    if (!c || !dest || this.engOsc) return;
    try {
      this.engOsc = c.createOscillator();
      this.engGain = c.createGain();
      this.engOsc.type = "sawtooth";
      this.engOsc.frequency.value = 55;
      this.engGain.gain.value = 0;
      const filt = c.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 320;
      this.engOsc.connect(filt).connect(this.engGain).connect(dest);
      this.engOsc.start();
    } catch { /* noop */ }
  }

  engineLevel(speed01: number, on: boolean) {
    if (!this.engOsc || !this.engGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.15);
    this.engOsc.frequency.setTargetAtTime(55 + speed01 * 90, t, 0.2);
  }

  /** Distant traffic bed: one looped voice, level driven per-frame by proximity. */
  private trafOsc: OscillatorNode | null = null;
  private trafGain: GainNode | null = null;

  trafficStart() {
    const c = this.ac();
    const dest = this.out();
    if (!c || !dest || this.trafOsc) return;
    try {
      this.trafOsc = c.createOscillator();
      this.trafGain = c.createGain();
      this.trafOsc.type = "sawtooth";
      this.trafOsc.frequency.value = 46;
      this.trafGain.gain.value = 0;
      const filt = c.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 240;
      this.trafOsc.connect(filt).connect(this.trafGain).connect(dest);
      this.trafOsc.start();
    } catch { /* noop */ }
  }

  trafficLevel(v: number) {
    if (!this.trafOsc || !this.trafGain || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this.trafGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.045, t, 0.25);
      this.trafOsc.frequency.setTargetAtTime(46 + v * 26, t, 0.3);
    } catch { /* noop */ }
  }

  trafficStop() {
    try { this.trafOsc?.stop(); } catch { /* noop */ }
    this.trafOsc = null;
    this.trafGain = null;
  }

  /** Rain patter bed: looped band-passed noise, level driven by weather. */
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGainN: GainNode | null = null;

  rainStart() {
    const c = this.ac();
    const dest = this.out();
    if (!c || !dest || this.rainSrc) return;
    try {
      const len = c.sampleRate * 2;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.rainSrc = c.createBufferSource();
      this.rainSrc.buffer = buf;
      this.rainSrc.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2600;
      bp.Q.value = 0.5;
      this.rainGainN = c.createGain();
      this.rainGainN.gain.value = 0;
      this.rainSrc.connect(bp).connect(this.rainGainN).connect(dest);
      this.rainSrc.start();
    } catch { /* noop */ }
  }

  rainLevel(v: number) {
    if (!this.rainGainN || !this.ctx) return;
    try {
      this.rainGainN.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.09, this.ctx.currentTime, 0.4);
    } catch { /* noop */ }
  }

  rainStop() {
    try { this.rainSrc?.stop(); } catch { /* noop */ }
    this.rainSrc = null;
    this.rainGainN = null;
  }

  /** Short filtered noise tick — call on stride. */
  footstep(run: boolean) {
    const c = this.ac();
    const dest = this.out();
    if (!c || !dest) return;
    try {
      const t0 = c.currentTime;
      const dur = 0.09;
      const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = c.createBufferSource();
      src.buffer = buf;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = run ? 720 : 480;
      const g = c.createGain();
      g.gain.value = run ? 0.15 : 0.09;
      src.connect(lp).connect(g).connect(dest);
      src.start(t0);
    } catch { /* decorative */ }
  }

  /** Door chime: bright two-tone ding on shop entry. */
  chime() {
    this.blip(880, 0.16, "sine", 0.06);
    window.setTimeout(() => this.blip(1174, 0.22, "sine", 0.06), 130);
  }

  engineStop() {
    try {
      this.engOsc?.stop();
    } catch { /* noop */ }
    this.engOsc = null;
    this.engGain = null;
  }
}
