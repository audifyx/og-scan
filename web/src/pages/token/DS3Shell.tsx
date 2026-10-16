import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Nintendo 3DS "OrbitX Edition" device shell.
 * Top screen = the game (3D world). Bottom screen = touch data + controls.
 */

/** Recessed screen bezel. */
function Bezel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-black p-2 shadow-[inset_0_2px_12px_rgba(0,0,0,0.9)]", className)}>
      <div className="overflow-hidden rounded-[4px] shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]">
        {children}
      </div>
    </div>
  );
}

/** Top screen: the game view. */
export function TopScreen({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-t-[18px] bg-gradient-to-b from-[#232838] to-[#161b28] px-3 pt-3">
      {/* camera dot like the 3DS */}
      <div className="flex items-center justify-center gap-2 pb-2">
        <div className="h-1.5 w-1.5 rounded-full bg-[#0a0c14] shadow-[inset_0_1px_2px_rgba(0,0,0,1)]">
          <div className="h-0.5 w-0.5 rounded-full bg-blue-900/60 ml-0.5 mt-0.5" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30">OrbitX 3DS</span>
      </div>
      <Bezel className="rounded-[10px]">
        <div className="relative aspect-[16/10] bg-[#04070d]">
          {children}
        </div>
      </Bezel>
    </div>
  );
}

/** The hinge between screens. */
export function Hinge() {
  return (
    <div className="relative bg-gradient-to-b from-[#161b28] via-[#0d1019] to-[#161b28] py-1.5">
      <div className="mx-auto h-1 w-24 rounded-full bg-black/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)]" />
      <div className="mx-auto mt-1 h-px w-16 bg-white/5" />
    </div>
  );
}

/** Bottom touch screen: data + controls. */
export function BottomScreen({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-b-[18px] bg-gradient-to-b from-[#161b28] to-[#232838] px-3 pb-3 pt-1">
      <Bezel className="rounded-[10px]">
        <div className="relative min-h-[420px] bg-[#0a0e18]">
          {children}
        </div>
      </Bezel>
      {/* home button row like the 3DS */}
      <div className="flex items-center justify-center gap-4 pt-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#2e3458] to-[#1a1f2e] shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)]">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0d1420] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="h-2 w-2 rounded-sm border-2 border-teal-300/70" />
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25">Touch to play</span>
      </div>
    </div>
  );
}

/** Chunky 3DS touch button with press effect. */
export function TouchButton({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number | null;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition-all duration-150 active:translate-y-0.5",
        active
          ? "border-teal-300/50 bg-gradient-to-b from-teal-400/30 to-teal-500/15 shadow-[0_0_16px_rgba(45,212,191,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]"
          : "border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]"
      )}
    >
      <Icon className={cn("h-5 w-5", active ? "text-teal-200" : "text-white/55")} />
      <span className={cn("text-[10px] font-bold", active ? "text-teal-100" : "text-white/45")}>{label}</span>
      {badge != null && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white shadow">
          {badge}
        </span>
      )}
    </button>
  );
}

/** Nintendo-style dialogue box for Orbit's thoughts. */
export function DialogueBox({ text, speaker }: { text: string; speaker: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2">
      <div className="rounded-xl border-2 border-white/85 bg-[#0a0f1e]/95 px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-300">{speaker}</p>
        <p key={text} className="animate-[thoughtIn_0.4s_ease-out text-[12px] leading-snug text-white/90">{text}</p>
      </div>
      <style>{`@keyframes thoughtIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
