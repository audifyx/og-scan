import { useId } from "react";
import { cn } from "@/lib/utils";

/** Gold verified globe shown only on the official OrbitX account. */
export function OrbitxGoldGlobe({ className, title = "OrbitX verified" }: { className?: string; title?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-6 shrink-0 items-center justify-center",
        "drop-shadow-[0_0_10px_rgba(251,191,36,0.65)]",
        className,
      )}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id={`oxGoldGlobe-${gid}`} cx="32%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#fff3c4" />
            <stop offset="42%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill={`url(#oxGoldGlobe-${gid})`} stroke="#fde68a" strokeWidth="1.2" />
        <ellipse cx="12" cy="12" rx="4.2" ry="9.2" fill="none" stroke="#7c4a08" strokeWidth="1.15" />
        <path d="M3.2 12h17.6" fill="none" stroke="#7c4a08" strokeWidth="1.15" />
        <path d="M5.1 7.4c2.1 1.1 4.5 1.7 6.9 1.7s4.8-.6 6.9-1.7" fill="none" stroke="#7c4a08" strokeWidth="1.05" />
        <path d="M5.1 16.6c2.1-1.1 4.5-1.7 6.9-1.7s4.8.6 6.9 1.7" fill="none" stroke="#7c4a08" strokeWidth="1.05" />
        <path d="M12 2.8v18.4" fill="none" stroke="#7c4a08" strokeWidth="1.05" />
      </svg>
    </span>
  );
}
