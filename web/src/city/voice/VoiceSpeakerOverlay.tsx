/**
 * VoiceSpeakerOverlay — who’s talking, as a lightweight HUD overlay.
 *
 * Separate from CityHud/GtaHud (owned by another agent). Shows up to 4
 * nearby audible speakers with a pulsing indicator while they talk,
 * plus a compact "N nearby" count. Pointer-events none — purely visual.
 */

import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProximitySpeaker } from "@/voice/useProximityVoice";

interface Props {
  speakers: ProximitySpeaker[];
  connected: boolean;
  maxRange: number;
}

export function VoiceSpeakerOverlay({ speakers, connected, maxRange }: Props) {
  if (!connected) return null;
  const audible = speakers
    .filter((s) => s.audible)
    .sort((a, b) => a.distance - b.distance);
  if (audible.length === 0) return null;
  const shown = audible.slice(0, 4);

  return (
    <div
      data-hud
      className="pointer-events-none fixed left-3 top-[calc(env(safe-area-inset-top,0px)+64px)] z-[70] flex flex-col gap-1.5"
    >
      {shown.map((s) => (
        <div
          key={s.identity}
          className={cn(
            "flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 backdrop-blur-xl transition",
            s.speaking
              ? "border-emerald-300/60 bg-emerald-400/15"
              : "border-white/10 bg-black/45"
          )}
        >
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/80">
            {(s.name || "?").slice(0, 1).toUpperCase()}
            {s.speaking && (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
            )}
          </span>
          <span className="max-w-[110px] truncate text-[11px] font-semibold text-white/90">
            {s.name}
          </span>
          {s.speaking ? (
            <Volume2 size={12} className="shrink-0 text-emerald-300" />
          ) : (
            <span className="shrink-0 text-[10px] tabular-nums text-white/40">
              {s.distance < maxRange ? `${Math.round(s.distance)}m` : "far"}
            </span>
          )}
        </div>
      ))}
      {audible.length > shown.length && (
        <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-center text-[10px] font-semibold text-white/60 backdrop-blur-xl">
          +{audible.length - shown.length} more nearby
        </div>
      )}
    </div>
  );
}
