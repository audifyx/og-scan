import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ambient synth — a dreamy generated pad via WebAudio (no audio files).
 * Chord progression in A minor-ish space tones + slow filter LFO.
 */
export function AmbientToggle() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ osc: OscillatorNode[]; gain: GainNode } | null>(null);

  const stop = () => {
    const n = nodesRef.current;
    if (n) {
      try {
        n.gain.gain.linearRampToValueAtTime(0, ctxRef.current!.currentTime + 1.2);
        setTimeout(() => n.osc.forEach((o) => { try { o.stop(); } catch { /* ignore */ } }), 1400);
      } catch { /* ignore */ }
      nodesRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
  };

  const start = () => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 2.5);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 2;
    // slow LFO on the filter for movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    filter.connect(master).connect(ctx.destination);

    // Am9 → Fmaj9 → Cmaj9 → G6/9 progression, each chord 8s
    const chords = [
      [110, 164.81, 246.94, 293.66],   // Am9
      [87.31, 130.81, 174.61, 261.63], // Fmaj9
      [130.81, 164.81, 196, 293.66],   // Cmaj9
      [98, 146.83, 196, 246.94],       // G6/9
    ];
    const oscs: OscillatorNode[] = [];
    chords.forEach((chord, ci) => {
      chord.forEach((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0;
        const t0 = ctx.currentTime + ci * 8;
        g.gain.linearRampToValueAtTime(0.22, t0 + 3);
        g.gain.linearRampToValueAtTime(0, t0 + 8.5);
        o.connect(g).connect(filter);
        o.start(t0);
        o.stop(t0 + 9);
        oscs.push(o);
      });
    });
    // shimmer: high sine an octave dance
    const shim = ctx.createOscillator();
    shim.type = "sine";
    shim.frequency.value = 880;
    const shimG = ctx.createGain();
    shimG.gain.value = 0.015;
    shim.connect(shimG).connect(master);
    shim.start();
    oscs.push(shim, lfo);

    nodesRef.current = { osc: oscs, gain: master };
  };

  const toggle = () => {
    if (on) { stop(); setOn(false); }
    else { start(); setOn(true); }
  };

  useEffect(() => () => stop(), []);

  return (
    <button
      onClick={toggle}
      aria-label={on ? "Mute ambient sound" : "Play ambient sound"}
      className={cn("flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95",
        on ? "border-teal-300/40 bg-teal-400/20 text-teal-200 shadow-[0_0_14px_rgba(45,212,191,0.4)]"
          : "border-white/15 bg-white/5 text-white/50 hover:text-white/80")}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  );
}
