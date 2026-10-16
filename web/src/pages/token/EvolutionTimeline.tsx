import { Egg, Sprout, Dog, Shield, Rocket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { name: "Egg", world: "Pod", min: 0, icon: Egg, color: "#94a3b8" },
  { name: "Sprout", world: "Office", min: 10_000, icon: Sprout, color: "#4ade80" },
  { name: "Whelp", world: "Studio", min: 25_000, icon: Dog, color: "#5eead4" },
  { name: "Guardian", world: "Headquarters", min: 100_000, icon: Shield, color: "#38bdf8" },
  { name: "Titan", world: "Sky Tower", min: 500_000, icon: Rocket, color: "#a78bfa" },
  { name: "Cosmic", world: "Metropolis", min: 2_000_000, icon: Sparkles, color: "#fbbf24" },
];

/** Horizontal evolution timeline — the full journey. */
export function EvolutionTimeline({ stage }: { stage: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-extrabold">The evolution journey</p>
      <p className="text-[11px] text-white/45">Every stage unlocks a bigger world</p>
      <div className="mt-4 flex items-start">
        {STAGES.map((s, i) => {
          const unlocked = i <= stage;
          const current = i === stage;
          return (
            <div key={s.name} className={cn("flex flex-1 flex-col items-center", i > 0 && "-ml-2")}>
              <div className="flex w-full items-center">
                <div className={cn("h-0.5 flex-1", i === 0 && "opacity-0", unlocked ? "bg-gradient-to-r from-teal-400/60 to-teal-400/60" : "bg-white/10")} />
                <div
                  className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    current ? "scale-110 border-teal-300 bg-teal-400/20 shadow-[0_0_20px_rgba(45,212,191,0.5)]"
                      : unlocked ? "border-white/25 bg-white/10"
                        : "border-white/10 bg-black/40 opacity-50")}
                  style={unlocked ? { borderColor: s.color + "88" } : undefined}
                >
                  <s.icon className="h-4 w-4" style={{ color: unlocked ? s.color : "#ffffff55" }} />
                </div>
                <div className={cn("h-0.5 flex-1", i === STAGES.length - 1 && "opacity-0", i < stage ? "bg-teal-400/60" : "bg-white/10")} />
              </div>
              <p className={cn("mt-1.5 text-[10px] font-bold", current ? "text-teal-200" : unlocked ? "text-white/70" : "text-white/30")}>
                {s.name}
              </p>
              <p className="text-[9px] text-white/30">{s.world}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
