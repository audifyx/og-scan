import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"logo" | "text" | "fade">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 800);
    const t2 = setTimeout(() => setPhase("fade"), 2200);
    const t3 = setTimeout(onComplete, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center transition-opacity duration-500 ${phase === "fade" ? "opacity-0" : "opacity-100"}`}>
      {/* Ambient gold glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/15 blur-[100px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-accent/10 blur-[80px] animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>

      {/* Logo */}
      <div className={`relative transition-all duration-700 ease-out ${phase === "logo" ? "scale-100 opacity-100" : "scale-110 opacity-100"}`}>
        <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-primary via-accent to-gold-dark flex items-center justify-center shadow-2xl shadow-primary/30">
          <Zap className="h-12 w-12 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div className="absolute inset-0 rounded-[28px] border-2 border-primary/30 animate-ping" style={{ animationDuration: "1.5s" }} />
      </div>

      {/* Text */}
      <div className={`mt-8 text-center transition-all duration-500 ${phase !== "logo" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <h1 className="font-display text-2xl font-bold tracking-wide text-foreground">SOL TOOLS</h1>
        <p className="text-xs text-primary/70 mt-2 font-mono tracking-widest">PRO TRADING SUITE</p>
      </div>

      {/* Loading bar */}
      <div className={`mt-10 w-32 h-0.5 rounded-full bg-muted overflow-hidden transition-opacity duration-300 ${phase !== "logo" ? "opacity-100" : "opacity-0"}`}>
        <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full animate-[loading_1.5s_ease-in-out_forwards]" />
      </div>
    </div>
  );
};
