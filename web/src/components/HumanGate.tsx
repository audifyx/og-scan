import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * HumanGate — proof-of-humanity check, on demand only.
 *
 * The overlay NEVER mounts on page load. Public content (landing, /app,
 * /terms, /privacy, /about, /contact, scanner, social) is readable with no
 * check. A protected action calls `requireHuman()` first; only then, and
 * only when the 6-hour session is unverified, does the challenge appear.
 * Session stored in localStorage.
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
    /* storage unavailable — gate will show again next time */
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

function randomTarget(): string {
  return TARGETS[Math.floor(Math.random() * TARGETS.length)];
}

export interface HumanGateApi {
  /**
   * Resolve true when the user passes the human check (or already holds a
   * valid 6-hour session). Resolves false when the user cancels ("Not now")
   * — callers must abort the protected action in that case.
   */
  requireHuman: () => Promise<boolean>;
}

const HumanGateContext = createContext<HumanGateApi | null>(null);

/** Outside the provider (tests, embeds) there is no gate — allow the action. */
const NO_GATE: HumanGateApi = { requireHuman: () => Promise.resolve(true) };

export function useHumanGate(): HumanGateApi {
  return useContext(HumanGateContext) ?? NO_GATE;
}

export function HumanGateProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(() => randomTarget());
  const [tiles, setTiles] = useState<Tile[]>(() => buildRound(target));
  const [picked, setPicked] = useState<number[]>([]);
  const [shake, setShake] = useState(false);
  const [failed, setFailed] = useState(0);

  const close = useCallback((ok: boolean) => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(ok);
  }, []);

  const requireHuman = useCallback((): Promise<boolean> => {
    if (isVerified()) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      const t = randomTarget();
      setTarget(t);
      setTiles(buildRound(t));
      setPicked([]);
      setRound(0);
      setFailed(0);
      setShake(false);
      setOpen(true);
    });
  }, []);

  const api = useMemo<HumanGateApi>(() => ({ requireHuman }), [requireHuman]);

  const remaining = useMemo(() => 3 - picked.length, [picked]);

  const nextRound = useCallback(() => {
    if (round + 1 >= TOTAL_ROUNDS) {
      markVerified();
      close(true);
      return;
    }
    const t = randomTarget();
    setTarget(t);
    setTiles(buildRound(t));
    setPicked([]);
    setRound((r) => r + 1);
  }, [round, close]);

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

  return (
    <HumanGateContext.Provider value={api}>
      {children}
      {open && (
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
            <button
              type="button"
              onClick={() => close(false)}
              className="mt-5 inline-flex min-h-9 items-center rounded-full border border-white/15 px-5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 transition hover:border-white/35 hover:text-white"
            >
              Not now
            </button>
            <p className="mt-4 text-[11px] leading-relaxed text-white/30">
              One quick check before wallet and sign-in actions.
              <br />
              Verified sessions last 6 hours.
            </p>
          </div>
        </div>
      )}
    </HumanGateContext.Provider>
  );
}
