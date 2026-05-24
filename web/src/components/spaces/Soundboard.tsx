/**
 * Soundboard — Audio effects for hosts during live Spaces.
 * Built-in sound effects using Web Audio API oscillator tones (no external files needed).
 */
import React, { useState, useRef, useCallback } from "react";
import { Volume2, VolumeX, ChevronUp, Sparkles, Zap, Trophy, AlertTriangle, Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface SoundEffect {
  id: string;
  name: string;
  emoji: string;
  color: string;
  play: (ctx: AudioContext) => void;
}

// Generate tones using Web Audio API — no external files needed
const createEffects = (): SoundEffect[] => {
  const beep = (ctx: AudioContext, freq: number, dur: number, type: OscillatorType = "sine") => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  };

  return [
    {
      id: "airhorn", name: "Air Horn", emoji: "📢", color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      play: (ctx) => {
        [523, 659, 784].forEach((f, i) => setTimeout(() => beep(ctx, f, 0.3, "sawtooth"), i * 100));
      },
    },
    {
      id: "applause", name: "Applause", emoji: "👏", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      play: (ctx) => {
        for (let i = 0; i < 30; i++) {
          setTimeout(() => {
            const b = ctx.createBufferSource();
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * 0.1;
            b.buffer = buf; const g = ctx.createGain();
            g.gain.setValueAtTime(0.15, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            b.connect(g); g.connect(ctx.destination); b.start();
          }, i * 50);
        }
      },
    },
    {
      id: "drumroll", name: "Drum Roll", emoji: "🥁", color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      play: (ctx) => {
        for (let i = 0; i < 20; i++) {
          setTimeout(() => beep(ctx, 100 + Math.random() * 50, 0.08, "triangle"), i * 50);
        }
        setTimeout(() => beep(ctx, 200, 0.5, "triangle"), 1050);
      },
    },
    {
      id: "tada", name: "Ta-da!", emoji: "🎉", color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      play: (ctx) => {
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(ctx, f, 0.4, "sine"), i * 150));
      },
    },
    {
      id: "buzzer", name: "Buzzer", emoji: "🚨", color: "bg-red-500/10 text-red-400 border-red-500/20",
      play: (ctx) => beep(ctx, 150, 0.8, "square"),
    },
    {
      id: "ding", name: "Ding", emoji: "🔔", color: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      play: (ctx) => beep(ctx, 1200, 0.6, "sine"),
    },
    {
      id: "whoosh", name: "Whoosh", emoji: "💨", color: "bg-teal-500/10 text-teal-400 border-teal-500/20",
      play: (ctx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(200, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.3);
        g.gain.setValueAtTime(0.2, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.5);
      },
    },
    {
      id: "coin", name: "Coin", emoji: "🪙", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      play: (ctx) => {
        beep(ctx, 988, 0.1, "square");
        setTimeout(() => beep(ctx, 1319, 0.3, "square"), 100);
      },
    },
    {
      id: "boom", name: "Boom", emoji: "💥", color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      play: (ctx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(150, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.6);
      },
    },
  ];
};

interface SoundboardProps {
  isHost: boolean;
}

const Soundboard: React.FC<SoundboardProps> = ({ isHost }) => {
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const effects = useRef(createEffects()).current;

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }, []);

  const playEffect = (effect: SoundEffect) => {
    if (muted) return;
    try {
      effect.play(getCtx());
      setLastPlayed(effect.id);
      setTimeout(() => setLastPlayed(null), 500);
    } catch {}
  };

  if (!isHost) return null;

  return (
    <div className="space-y-1">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full px-1">
        <div className="flex items-center gap-2">
          <Music className="h-3.5 w-3.5 text-pink-400" />
          <span className="text-[11px] font-bold text-white/50">Soundboard</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
            className={cn("p-1 rounded-lg transition-all", muted ? "bg-red-500/10 text-red-400" : "bg-white/[0.04] text-white/20")}>
            {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          </button>
          <ChevronUp className={cn("h-3 w-3 text-white/20 transition-transform", !expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {effects.map(e => (
            <button key={e.id} onClick={() => playEffect(e)}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border transition-all",
                e.color,
                lastPlayed === e.id && "scale-95 brightness-125",
                muted && "opacity-30"
              )}>
              <span className="text-xl">{e.emoji}</span>
              <span className="text-[9px] font-bold">{e.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Soundboard;
