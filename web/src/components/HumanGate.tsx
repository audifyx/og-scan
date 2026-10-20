import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * HumanGate — proof-of-humanity gate at the OrbitX entrance.
 * Shows a tap-the-target challenge on first visit and re-verifies
 * every 6 hours. Session stored in localStorage.
 */

const STORE_KEY = "ox-human-gate-v1";
const SESSION_MS = 6 * 60 * 60 * 1000; // 6 hours

interface Stored {
  t: number; // verified-at timestamp
}

function isVerified(): boolean {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as Stored;
    return typeof s.t === "number" && Date.now() - s.t < SESSION_MS;
  } catch {
    return false;
  }
}

function markVerified() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ t: Date.now() } satisfies Stored));
  } catch {
    /* storage unavailable — gate will show again next load */
  }
}

const TARGETS = ["🚀", "🛸", "🪐", "💎"];
const DECOYS = ["⭐", "🌙", "🔥", "⚡", "🌍", "👾", "🤖", "🛰️", "☄️", "🌟", "💫", "🪙"];

interface Tile {
  emoji: string;
  isTarget: boolean;
}

function buildRound(target: string): Tile[] {
  // 9 tiles, exactly 3 targets, 6 decoys shuffled
  const decoys = [...DECOYS].sort(() => Math.random() - 0.5).slice(0, 6);
  const tiles: Tile[] = [
    ...decoys.map((emoji) => ({ emoji, isTarget: false })),
    { emoji: target, isTarget: true },
    { emoji: target, isTarget: true },
    { emoji: target, isTarget: true },
  ];
  return tiles.sort(() => Math.random() - 0.5);
}

const TOTAL_ROUNDS = 2;

export function HumanGate() {
  const [verified, setVerified] = useState<boolean>(() => isVerified());
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(() => TARGETS[Math.floor(Math.random() * TARGETS.length)]);
  // Tiles must be built from the SAME target shown in the instruction —
  // building from a fixed TARGETS[0] made round 1 ask for an emoji
  // that wasn't in the grid.
  const [tiles, setTiles] = useState<Tile[]>(() => buildRound(target));
  const [picked, setPicked] = useState<number[]>([]);
  const [shake, setShake] = useState(false);
  const [failed, setFailed] = useState(0);

  // Re-check on visibility return (session may have expired while tab was open)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && !isVerified()) {
        setVerified(false);
        setRound(0);
        const t = TARGETS[Math.floor(Math.random() * TARGETS.length)];
        setTarget(t);
        setTiles(buildRound(t));
        setPicked([]);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const remaining = useMemo(() => 3 - picked.length, [picked]);

  const nextRound = useCallback(() => {
    if (round + 1 >= TOTAL_ROUNDS) {
      markVerified();
      setVerified(true);
      return;
    }
    const t = TARGETS[Math.floor(Math.random() * TARGETS.length)];
    setTarget(t);
    setTiles(buildRound(t));
    setPicked([]);
    setRound((r) => r + 1);
  }, [round]);

  const onTile = (i: number) => {
    if (picked.includes(i) || shake) return;
    if (tiles[i].isTarget) {
      const next = [...picked, i];
      setPicked(next);
      if (next.length === 3) {
        // small beat before advancing so the user sees all three lit
        setTimeout(nextRound, 350);
      }
    } else {
      // wrong tile — shake and reset the round
      setShake(true);
      setFailed((f) => f + 1);
      setTimeout(() => {
        setShake(false);
        setPicked([]);
        setTiles(buildRound(target));
      }, 450);
    }
  };

  if (verified) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05080c]/98 p-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0e17] p-6 text-center shadow-2xl ${
          shake ? "animate-[gateShake_0.45s_ease]" : ""
        }`}
      >
        <style>{`@keyframes gateShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>

        <div className="mb-1 text-2xl">🛡️</div>
        <h2 className="text-lg font-bold text-white">Are you human?</h2>
        <p className="mt-1 text-sm text-white/55">
          Tap all <span className="text-xl">{target}</span> tiles{" "}
          <span className="text-white/35">
            ({remaining} left · step {round + 1}/{TOTAL_ROUNDS})
          </span>
        </p>

        <div className="mx-auto mt-5 grid max-w-[280px] grid-cols-3 gap-2">
          {tiles.map((tile, i) => {
            const hit = picked.includes(i);
            return (
              <button
                key={`${round}-${i}`}
                onClick={() => onTile(i)}
                className={`flex aspect-square items-center justify-center rounded-xl border text-3xl transition-all active:scale-95 ${
                  hit
                    ? "border-emerald-400/60 bg-emerald-400/15 shadow-[0_0_18px_rgba(52,211,153,0.35)]"
                    : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                }`}
                aria-label={`tile ${i + 1}`}
              >
                {tile.emoji}
              </button>
            );
          })}
        </div>

        {failed > 0 && (
          <p className="mt-4 text-xs text-red-400/80">
            Wrong tile — try again. ({failed} miss{failed === 1 ? "" : "es"})
          </p>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-white/30">
          One quick check keeps the bots out.
          <br />
          Verified sessions last 6 hours.
        </p>
      </div>
    </div>
  );
}
