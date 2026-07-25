/**
 * Cosmic / neon particle field for AAA menu screens.
 * Lightweight CSS + canvas-free DOM particles (mobile-safe).
 */
import { useMemo } from "react";

interface CosmicBackdropProps {
  /** Extra class for scoped variants (menu vs character chamber). */
  variant?: "cosmos" | "chamber";
}

export function CosmicBackdrop({ variant = "cosmos" }: CosmicBackdropProps) {
  const sparks = useMemo(
    () =>
      Array.from({ length: variant === "chamber" ? 28 : 42 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53) % 100}%`,
        delay: `${(i % 12) * 0.35}s`,
        size: 1 + (i % 3),
      })),
    [variant],
  );

  return (
    <div className={`oxc-cosmic oxc-cosmic--${variant}`} aria-hidden>
      <div className="oxc-cosmic-glow oxc-cosmic-glow--a" />
      <div className="oxc-cosmic-glow oxc-cosmic-glow--b" />
      <div className="oxc-cosmic-glow oxc-cosmic-glow--gold" />
      <div className="oxc-cosmic-grid" />
      <div className="oxc-cosmic-rays" />
      {sparks.map((s) => (
        <span
          key={s.id}
          className="oxc-cosmic-spark"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}
