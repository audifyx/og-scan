import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CITY_CODE = "2026";
const STORAGE_KEY = "orbitx-city-unlocked";

/** 4-digit PIN gate for OrbitX City. Remembers the unlock on the device. */
export default function CityGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);

  const press = useCallback((d: string) => {
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + d;
      if (next.length === 4) {
        if (next === CITY_CODE) {
          try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
          setTimeout(() => setUnlocked(true), 220);
        } else {
          setShake((s) => s + 1);
          setTimeout(() => setPin(""), 450);
        }
      }
      return next;
    });
  }, []);

  const backspace = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (unlocked) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") backspace();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, backspace, unlocked]);

  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#04070f] px-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_30%,rgba(23,255,77,0.08),transparent_70%)]" />
      <motion.div
        key={shake}
        initial={false}
        animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="relative flex w-full max-w-[320px] flex-col items-center"
      >
        <div className="mb-2 text-4xl">🏙️</div>
        <h1 className="font-mono text-sm font-bold uppercase tracking-[0.35em] text-[#17ff4d]">
          OrbitX City
        </h1>
        <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
          Enter access code
        </p>
        <div className="mt-6 flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`grid h-14 w-14 place-items-center rounded-2xl border text-2xl font-mono font-bold transition-all ${
                pin.length > i
                  ? "border-[#17ff4d]/70 bg-[#17ff4d]/10 text-[#17ff4d]"
                  : "border-white/15 bg-white/5 text-transparent"
              }`}
            >
              {pin.length > i ? "•" : ""}
            </div>
          ))}
        </div>
        <div className="mt-7 grid w-full grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              className="grid h-16 place-items-center rounded-2xl border border-white/12 bg-white/[0.06] text-xl font-mono font-bold text-white/90 active:scale-95 active:bg-[#17ff4d]/20 active:text-[#17ff4d]"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => press("0")}
            className="grid h-16 place-items-center rounded-2xl border border-white/12 bg-white/[0.06] text-xl font-mono font-bold text-white/90 active:scale-95 active:bg-[#17ff4d]/20 active:text-[#17ff4d]"
          >
            0
          </button>
          <button
            onClick={backspace}
            aria-label="Delete"
            className="grid h-16 place-items-center rounded-2xl border border-white/12 bg-white/[0.06] text-xl text-white/60 active:scale-95"
          >
            &#9003;
          </button>
        </div>
        <AnimatePresence>
          {shake > 0 && pin === "" && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-red-400"
            >
              Wrong code
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
