/**
 * Music visualizer bridge — pumps live audio energy into the theme engine.
 *
 * Writes a smoothed 0..1 level to `--dt-pulse` on <html> ~30x/sec. The
 * "Pulse" animated wallpaper and visualizer.css react to it (rings scale,
 * glows breathe). Sources:
 *   - startMicPulse(): the user's microphone (permission prompt, user gesture)
 *   - startDemoPulse(): a synthesized beat (no permission, for trying it out)
 * Call stopPulse() to release the AudioContext / mic track.
 */

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let raf = 0;
let stream: MediaStream | null = null;
let demoNodes: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
let smoothed = 0;

function ensureCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function setPulse(v: number) {
  smoothed += (v - smoothed) * 0.35;
  document.documentElement.style.setProperty("--dt-pulse", smoothed.toFixed(3));
}

function loop() {
  if (!analyser || !ctx) return;
  const buf = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(buf);
  // Focus on low-mid energy (kick/bass) for the beat feel.
  let sum = 0;
  const n = Math.min(40, buf.length);
  for (let i = 0; i < n; i++) sum += buf[i];
  setPulse(Math.min(1, sum / n / 160));
  raf = requestAnimationFrame(loop);
}

function attachAnalyser(source: AudioNode) {
  const ac = ensureCtx();
  analyser = ac.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);
  cancelAnimationFrame(raf);
  loop();
  document.documentElement.dataset.audioPulse = "on";
}

export function isPulsing(): boolean {
  return analyser !== null;
}

/** Live mic input → pulse. Must be called from a user gesture. */
export async function startMicPulse(): Promise<void> {
  stopPulse();
  const ac = ensureCtx();
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  attachAnalyser(ac.createMediaStreamSource(stream));
}

/** Synthesized four-on-the-floor beat → pulse. No permissions needed. */
export function startDemoPulse(bpm = 122): void {
  stopPulse();
  const ac = ensureCtx();
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 55;
  const gain = ac.createGain();
  gain.gain.value = 0;
  const lfo = ac.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = bpm / 60;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.9;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  osc.connect(gain);
  // Keep it silent: route through a zero-gain mute, analyser taps pre-mute.
  const mute = ac.createGain();
  mute.gain.value = 0;
  gain.connect(mute);
  mute.connect(ac.destination);
  osc.start();
  lfo.start();
  demoNodes = { osc, gain, lfo };
  attachAnalyser(gain);
}

export function stopPulse(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  analyser = null;
  if (demoNodes) {
    try {
      demoNodes.osc.stop();
      demoNodes.lfo.stop();
    } catch {
      /* already stopped */
    }
    demoNodes = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--dt-pulse", "0");
    delete document.documentElement.dataset.audioPulse;
  }
}
