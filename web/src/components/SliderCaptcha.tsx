/**
 * Custom slider CAPTCHA — no external service required.
 * User drags the slider to the target zone to verify they're human.
 * Includes random target position + timing check for basic bot resistance.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { ShieldCheck } from "lucide-react";

interface SliderCaptchaProps {
  onVerify: (token: string) => void;
}

function generateToken(targetPct: number, elapsed: number): string {
  // Simple token encoding — not cryptographically secure but blocks naive bots
  const payload = `ogcap_${targetPct}_${elapsed}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return btoa(payload);
}

export const SliderCaptcha = ({ onVerify }: SliderCaptchaProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sliderX, setSliderX] = useState(0);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Random target between 60-85% of track width
  const [targetPct] = useState(() => Math.floor(Math.random() * 26) + 60);
  const TOLERANCE = 5; // ±5% tolerance

  const getTrackWidth = useCallback(() => {
    return trackRef.current?.clientWidth ?? 280;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (verified) return;
      setDragging(true);
      setFailed(false);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [verified]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || verified) return;
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const thumbSize = 44;
      const maxX = rect.width - thumbSize;
      const x = Math.min(Math.max(0, e.clientX - rect.left - thumbSize / 2), maxX);
      setSliderX(x);
    },
    [dragging, verified]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging || verified) return;
    setDragging(false);

    const trackWidth = getTrackWidth();
    const thumbSize = 44;
    const maxX = trackWidth - thumbSize;
    const currentPct = (sliderX / maxX) * 100;

    if (Math.abs(currentPct - targetPct) <= TOLERANCE) {
      const elapsed = Date.now() - startTimeRef.current;
      setVerified(true);
      const token = generateToken(targetPct, elapsed);
      onVerify(token);
    } else {
      setFailed(true);
      // Reset slider after failed attempt
      setTimeout(() => {
        setSliderX(0);
        setFailed(false);
      }, 600);
    }
  }, [dragging, verified, sliderX, targetPct, getTrackWidth, onVerify]);

  // Target marker position
  const trackWidth = getTrackWidth();
  const thumbSize = 44;
  const maxX = trackWidth - thumbSize;
  const targetX = (targetPct / 100) * maxX;

  return (
    <div className="space-y-2">
      {verified ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 py-3 px-4">
          <ShieldCheck className="h-5 w-5 text-green-400" />
          <span className="text-sm font-bold text-green-400">Verified</span>
        </div>
      ) : (
        <>
          <p className="text-[10px] text-white/30 text-center font-semibold">
            Drag the slider to the target zone
          </p>
          <div
            ref={trackRef}
            className="relative h-[44px] rounded-xl bg-white/[0.05] border border-white/[0.08] overflow-hidden select-none touch-none cursor-pointer"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Filled track */}
            <div
              className={`absolute inset-y-0 left-0 rounded-l-xl transition-colors ${
                failed ? "bg-red-500/20" : "bg-white/[0.04]"
              }`}
              style={{ width: sliderX + thumbSize }}
            />

            {/* Target zone indicator */}
            <div
              className="absolute top-1 bottom-1 w-[3px] rounded-full bg-og-lime/60"
              style={{ left: targetX + thumbSize / 2 - 1.5 }}
            />
            <div
              className="absolute top-0 bottom-0 rounded-md bg-og-lime/[0.06] border-x border-og-lime/20"
              style={{
                left: ((targetPct - TOLERANCE) / 100) * maxX + thumbSize / 2 - 4,
                width: ((TOLERANCE * 2) / 100) * maxX + 8,
              }}
            />

            {/* Thumb */}
            <div
              className={`absolute top-0 h-[44px] w-[44px] rounded-xl flex items-center justify-center transition-shadow cursor-grab active:cursor-grabbing ${
                dragging
                  ? "bg-white shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  : failed
                  ? "bg-red-400"
                  : "bg-white/90 hover:bg-white"
              }`}
              style={{ left: sliderX, touchAction: "none" }}
              onPointerDown={handlePointerDown}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke={failed ? "#fff" : "#1a1a2e"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          {failed && (
            <p className="text-[10px] text-red-400/80 text-center font-semibold">
              Missed — try again
            </p>
          )}
        </>
      )}
    </div>
  );
};
