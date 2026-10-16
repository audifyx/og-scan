import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * LivingAvatar — "Orbit", the living embodiment of the $ORBITX token.
 * It grows through evolution stages as market cap rises, its mood follows
 * 24h price action, and its orbit rings thicken with liquidity.
 * It remembers milestones in localStorage: first meeting, ATH, evolutions.
 */

export type AvatarMood = "ecstatic" | "happy" | "sleepy" | "dormant";

export interface AvatarStats {
  mcap: number | null;
  liquidity: number | null;
  change24h: number | null;
  burned: number | null;
  price: number | null;
}

interface Stage {
  name: string;
  min: number;
  max: number | null;
  blurb: string;
}

const STAGES: Stage[] = [
  { name: "Egg", min: 0, max: 10_000, blurb: "Dormant potential. Something stirs inside." },
  { name: "Sprout", min: 10_000, max: 25_000, blurb: "It hatched! Small, curious, hungry for volume." },
  { name: "Whelp", min: 25_000, max: 100_000, blurb: "Growing fast. Fins out, eyes on the charts." },
  { name: "Guardian", min: 100_000, max: 500_000, blurb: "Armored by liquidity. It protects the orbit." },
  { name: "Titan", min: 500_000, max: 2_000_000, blurb: "A crowned force. The trenches know its name." },
  { name: "Cosmic", min: 2_000_000, max: null, blurb: "Beyond markets. A living constellation." },
];

const MEM_KEY = "orbitx-avatar-memory-v1";

interface Memory {
  firstSeen: number;
  ath: number;
  evolutions: { stage: number; mcap: number; at: number }[];
}

function loadMemory(): Memory {
  try {
    const raw = localStorage.getItem(MEM_KEY);
    if (raw) return JSON.parse(raw) as Memory;
  } catch { /* ignore */ }
  return { firstSeen: Date.now(), ath: 0, evolutions: [] };
}

export function stageForMcap(mcap: number | null): number {
  if (mcap == null) return 1;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (mcap >= STAGES[i].min) return i;
  }
  return 0;
}

export function moodForChange(change24h: number | null): AvatarMood {
  if (change24h == null) return "happy";
  if (change24h >= 10) return "ecstatic";
  if (change24h >= 0) return "happy";
  if (change24h > -10) return "sleepy";
  return "dormant";
}

function fmtUsd(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function thoughtFor(stats: AvatarStats, stage: number, mood: AvatarMood): string {
  const { mcap, liquidity, change24h, burned } = stats;
  const pool = [
    mcap != null ? `Market cap ${fmtUsd(mcap)} — I can feel myself growing.` : null,
    liquidity != null ? `Liquidity ${fmtUsd(liquidity)} holding my orbit steady.` : null,
    change24h != null
      ? change24h >= 0
        ? `Up ${change24h.toFixed(1)}% today. The charts feed me.`
        : `Down ${Math.abs(change24h).toFixed(1)}% today. I'm resting, not worried.`
      : null,
    burned != null && burned > 0 ? `${burned.toLocaleString()} of me burned forever. Rarer every day.` : null,
    stage >= 4 ? "They said a token couldn't dream. Watch me." : null,
    stage <= 1 ? "Feed me volume and I'll evolve. I promise." : null,
    mood === "ecstatic" ? "GREEN CANDLES! I feel electric!" : null,
    mood === "dormant" ? "Even titans sleep. I'll be here when you wake." : null,
  ].filter(Boolean) as string[];
  return pool[Math.floor(Math.random() * pool.length)] ?? "Orbiting. Always orbiting.";
}

export function LivingAvatar({ stats, size = 220, compact = false }: { stats: AvatarStats; size?: number; compact?: boolean }) {
  const stage = stageForMcap(stats.mcap);
  const mood = moodForChange(stats.change24h);
  const [thought, setThought] = useState(() => thoughtFor(stats, stage, mood));
  const [justEvolved, setJustEvolved] = useState(false);
  const [memory, setMemory] = useState<Memory>(loadMemory);

  // Rotate thoughts
  useEffect(() => {
    const id = setInterval(() => setThought(thoughtFor(stats, stage, mood)), 9000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.mcap, stats.liquidity, stats.change24h, stage, mood]);

  // Track ATH + evolutions in memory
  useEffect(() => {
    if (stats.mcap == null) return;
    setMemory((prev) => {
      const next: Memory = { ...prev, evolutions: [...prev.evolutions] };
      let changed = false;
      if (stats.mcap! > prev.ath) { next.ath = stats.mcap!; changed = true; }
      const lastStage = prev.evolutions.length ? prev.evolutions[prev.evolutions.length - 1].stage : 1;
      if (stage > lastStage) {
        next.evolutions.push({ stage, mcap: stats.mcap!, at: Date.now() });
        changed = true;
        setJustEvolved(true);
        setTimeout(() => setJustEvolved(false), 4000);
      }
      if (!changed) return prev;
      try { localStorage.setItem(MEM_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.mcap, stage]);

  const stageInfo = STAGES[stage];
  const progress = useMemo(() => {
    if (stats.mcap == null || stageInfo.max == null) return 1;
    return Math.min(1, Math.max(0, (stats.mcap - stageInfo.min) / (stageInfo.max - stageInfo.min)));
  }, [stats.mcap, stageInfo]);

  const rings = stats.liquidity == null ? 1 : stats.liquidity >= 100_000 ? 3 : stats.liquidity >= 25_000 ? 2 : 1;
  const glowColor = mood === "dormant" ? "#3b4a6b" : mood === "sleepy" ? "#7c8db5" : mood === "ecstatic" ? "#ffd166" : "#5eead4";
  const floatSpeed = mood === "ecstatic" ? "2.2s" : mood === "dormant" ? "7s" : "4.5s";

  const memoryLine = useMemo(() => {
    if (memory.ath > 0 && stats.mcap != null && memory.ath > stats.mcap * 1.15)
      return `I remember my all-time high — ${fmtUsd(memory.ath)}. We'll get back there.`;
    if (memory.evolutions.length > 1)
      return `I've evolved ${memory.evolutions.length} times since we met.`;
    const days = Math.max(0, Math.floor((Date.now() - memory.firstSeen) / 86400000));
    if (days >= 1) return `You've known me ${days} day${days === 1 ? "" : "s"}. I'm still growing.`;
    return "We just met. Stick around — I evolve as the market cap grows.";
  }, [memory, stats.mcap]);

  return (
    <div className="flex flex-col items-center">
      <style>{`
        @keyframes orbitFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes orbitBlink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.08); } }
        @keyframes orbitSpin { to { transform: rotate(360deg); } }
        @keyframes orbitTwinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
        @keyframes orbitWobble { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        @keyframes orbitEvolve { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* Thought bubble */}
      {!compact && (
      <div className="relative mb-2 max-w-[260px] rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center backdrop-blur-md">
        <p key={thought} className="animate-[thoughtIn_0.5s_ease-out text-[13px] leading-snug text-white/85">{thought}</p>
        <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-[#0b0f1a]" />
      </div>
      )}
      <style>{`@keyframes thoughtIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div className="relative" style={{ width: size, height: size }}>
        {/* aura */}
        <div
          className="absolute inset-0 rounded-full blur-2xl transition-colors duration-1000"
          style={{ background: `radial-gradient(circle, ${glowColor}55 0%, transparent 65%)`, animation: `orbitFloat ${floatSpeed} ease-in-out infinite` }}
        />
        {justEvolved && (
          <div className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-300/40 bg-amber-400/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-200"
            style={{ animation: "orbitEvolve 0.8s ease-out" }}>
            ✨ Evolved: {stageInfo.name}
          </div>
        )}

        <div style={{ animation: `orbitFloat ${floatSpeed} ease-in-out infinite` }} className="h-full w-full">
          <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_0_25px_rgba(94,234,212,0.25)]">
            <defs>
              <radialGradient id="orbitBody" cx="35%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#a7f3d0" />
                <stop offset="45%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#0d5c46" />
              </radialGradient>
              <radialGradient id="orbitBodyDim" cx="35%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#8fa3c7" />
                <stop offset="45%" stopColor="#4a5d84" />
                <stop offset="100%" stopColor="#1c2740" />
              </radialGradient>
              <linearGradient id="orbitRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5eead4" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {/* orbit rings (liquidity) */}
            {stage >= 2 && (
              <g style={{ transformOrigin: "100px 100px", animation: "orbitSpin 14s linear infinite" }}>
                <ellipse cx="100" cy="100" rx="86" ry="30" fill="none" stroke="url(#orbitRing)" strokeWidth={rings >= 1 ? 3 : 0} opacity="0.8" transform="rotate(-18 100 100)" />
                {rings >= 2 && <ellipse cx="100" cy="100" rx="96" ry="36" fill="none" stroke="url(#orbitRing)" strokeWidth="2" opacity="0.5" transform="rotate(-18 100 100)" />}
                {rings >= 3 && <ellipse cx="100" cy="100" rx="106" ry="42" fill="none" stroke="url(#orbitRing)" strokeWidth="1.5" opacity="0.35" transform="rotate(-18 100 100)" />}
              </g>
            )}

            {/* cosmic starfield */}
            {stage >= 5 && (
              <g>
                {[[40, 40], [160, 55], [55, 160], [150, 150], [100, 25]].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={1.8} fill="#fef9c3" style={{ animation: `orbitTwinkle ${1.5 + i * 0.4}s ease-in-out infinite` }} />
                ))}
              </g>
            )}

            {/* BODY per stage */}
            {stage === 0 && (
              <g style={{ transformOrigin: "100px 115px", animation: "orbitWobble 3s ease-in-out infinite" }}>
                <ellipse cx="100" cy="118" rx="42" ry="52" fill={mood === "dormant" ? "url(#orbitBodyDim)" : "url(#orbitBody)"} />
                <path d="M78 100 l14 10 -8 14 M112 92 l-6 16 12 8 M96 128 l10 -6" stroke="#0b3d2e" strokeWidth="2.5" fill="none" opacity="0.7" strokeLinecap="round" />
                <ellipse cx="100" cy="118" rx="42" ry="52" fill="none" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="2" />
              </g>
            )}

            {stage >= 1 && (
              <g>
                {/* body */}
                <circle cx="100" cy="108" r={stage === 1 ? 38 : stage === 2 ? 46 : 54} fill={mood === "dormant" || mood === "sleepy" ? "url(#orbitBodyDim)" : "url(#orbitBody)"} />
                <ellipse cx={88} cy={92} rx="14" ry="9" fill="#ffffff" opacity="0.25" transform="rotate(-25 88 92)" />

                {/* sprout leaves (stage 1+) */}
                {stage >= 1 && stage <= 2 && (
                  <g stroke="#4ade80" strokeWidth="4" strokeLinecap="round" fill="#4ade80">
                    <line x1="100" y1={stage === 1 ? 72 : 64} x2="100" y2={stage === 1 ? 52 : 40} />
                    <ellipse cx="88" cy="52" rx="12" ry="6" transform="rotate(-30 88 52)" />
                    <ellipse cx="112" cy="48" rx="12" ry="6" transform="rotate(30 112 48)" />
                  </g>
                )}

                {/* fins (stage 2+) */}
                {stage >= 2 && stage <= 3 && (
                  <g fill="#10b981" opacity="0.9">
                    <ellipse cx={100 - (stage === 2 ? 46 : 54)} cy="112" rx="10" ry="16" transform="rotate(25 54 112)" />
                    <ellipse cx={100 + (stage === 2 ? 46 : 54)} cy="112" rx="10" ry="16" transform="rotate(-25 146 112)" />
                  </g>
                )}

                {/* armor plates (stage 3) */}
                {stage === 3 && (
                  <g fill="none" stroke="#a7f3d0" strokeWidth="4" opacity="0.85" strokeLinecap="round">
                    <path d="M62 84 Q100 60 138 84" />
                    <path d="M58 108 Q100 82 142 108" />
                  </g>
                )}

                {/* crown (stage 4+) */}
                {stage >= 4 && (
                  <g fill="#ffd166">
                    <polygon points="70,58 78,32 90,52 100,28 110,52 122,32 130,58" opacity="0.95" />
                    <circle cx="100" cy="30" r="4" fill="#fef9c3" style={{ animation: "orbitTwinkle 1.6s ease-in-out infinite" }} />
                  </g>
                )}

                {/* radiant aura (stage 5) */}
                {stage >= 5 && (
                  <g style={{ transformOrigin: "100px 108px", animation: "orbitSpin 24s linear infinite" }} opacity="0.5">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                      <line key={a} x1="100" y1="34" x2="100" y2="14" stroke="#fde68a" strokeWidth="3" strokeLinecap="round" transform={`rotate(${a} 100 108)`} />
                    ))}
                  </g>
                )}

                {/* eye */}
                <g style={{ transformOrigin: "100px 100px", animation: "orbitBlink 5s ease-in-out infinite" }}>
                  {mood === "ecstatic" || mood === "happy" ? (
                    <g>
                      <ellipse cx="100" cy="100" rx="16" ry="19" fill="#06281f" />
                      <circle cx="105" cy="94" r="6" fill="#ffffff" />
                      <circle cx="103" cy="97" r="2.5" fill="#5eead4" />
                    </g>
                  ) : (
                    <g stroke="#06281f" strokeWidth="5" strokeLinecap="round">
                      <line x1="86" y1="102" x2="114" y2="102" />
                    </g>
                  )}
                </g>

                {/* mouth */}
                {mood === "ecstatic" && <ellipse cx="100" cy="130" rx="10" ry="12" fill="#06281f" />}
                {mood === "happy" && <path d="M86 126 Q100 138 114 126" stroke="#06281f" strokeWidth="4" fill="none" strokeLinecap="round" />}
                {mood === "sleepy" && <path d="M90 130 Q100 134 110 130" stroke="#0f2c24" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
                {mood === "dormant" && (
                  <g fill="#8fa3c7" fontSize="14" fontWeight="bold">
                    <text x="128" y="76">z</text>
                    <text x="138" y="62" fontSize="18">z</text>
                    <text x="150" y="44" fontSize="22">z</text>
                  </g>
                )}
                {/* blush */}
                {(mood === "happy" || mood === "ecstatic") && (
                  <g fill="#f9a8d4" opacity="0.55">
                    <ellipse cx="76" cy="118" rx="7" ry="4.5" />
                    <ellipse cx="124" cy="118" rx="7" ry="4.5" />
                  </g>
                )}
              </g>
            )}

            {/* sparkles when thriving */}
            {(mood === "ecstatic" || mood === "happy") && stage >= 1 && (
              <g fill="#fef9c3">
                <circle cx="52" cy="70" r="2.4" style={{ animation: "orbitTwinkle 1.8s ease-in-out infinite" }} />
                <circle cx="150" cy="66" r="2" style={{ animation: "orbitTwinkle 2.3s ease-in-out infinite" }} />
                <circle cx="142" cy="150" r="2.6" style={{ animation: "orbitTwinkle 2s ease-in-out infinite" }} />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* stage + progress */}
      {!compact && (
      <div className="mt-3 w-full max-w-[260px] text-center">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-teal-300" />
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-white">
            {stageInfo.name}
          </span>
          <span className="text-[11px] text-white/40">Stage {stage + 1}/6</span>
        </div>
        <p className="mt-1 text-xs text-white/50">{stageInfo.blurb}</p>
        {stageInfo.max != null ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-amber-300 transition-all duration-1000"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-white/40">
              {fmtUsd(stageInfo.max - (stats.mcap ?? 0))} to evolve → {STAGES[stage + 1].name}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">Max evolution reached</p>
        )}
        <p className="mt-2 text-[11px] italic text-white/35">{memoryLine}</p>
      </div>
      )}
    </div>
  );
}
