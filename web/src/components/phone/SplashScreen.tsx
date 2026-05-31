import { useEffect, useState } from "react";
import { Radar, ShieldCheck } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"logo" | "text" | "fade">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 750);
    const t2 = setTimeout(() => setPhase("fade"), 2300);
    const t3 = setTimeout(onComplete, 2850);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#050914] transition-opacity duration-500 ${
        phase === "fade" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="og-aurora-1 absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-og-cyan/20 blur-[120px]" />
        <div className="og-aurora-2 absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-og-lime/15 blur-[100px]" />
      </div>
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-[0.10]" />

      <div
        className={`relative transition-all duration-700 ease-out ${
          phase === "logo" ? "scale-95 opacity-100" : "scale-100 opacity-100"
        }`}
      >
        <span className="og-ping-ring absolute inset-0 rounded-[30px] border border-og-lime/50" />
        <span
          className="og-ping-ring absolute inset-0 rounded-[30px] border border-og-cyan/40"
          style={{ animationDelay: "0.9s" }}
        />
        <div className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-[30px] border border-white/15 bg-gradient-to-br from-og-lime/25 via-[#0b1423] to-og-cyan/20 shadow-[0_24px_80px_-30px_hsl(var(--og-cyan))]">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, hsl(var(--og-lime) / 0.55) 60deg, transparent 130deg)",
              maskImage: "radial-gradient(circle, transparent 30%, black 31%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 30%, black 31%)",
            }}
          >
            <div className="og-radar-sweep h-full w-full" />
          </div>
          <Radar className="relative h-12 w-12 text-og-lime" strokeWidth={2.2} />
        </div>
      </div>

      <div
        className={`mt-9 text-center transition-all duration-500 ${
          phase !== "logo" ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <h1 className="text-4xl font-black tracking-tight">
          <span className="og-gradient-text">OGScan</span>
        </h1>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.32em] text-white/45">
          <ShieldCheck className="h-3.5 w-3.5 text-og-cyan" />
          Solana intel suite
        </p>
      </div>

      <div
        className={`mt-10 h-1 w-40 overflow-hidden rounded-full bg-white/10 transition-opacity duration-300 ${
          phase !== "logo" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="og-bar-grow h-full rounded-full bg-gradient-to-r from-og-lime via-og-cyan to-og-gold" />
      </div>
    </div>
  );
};
