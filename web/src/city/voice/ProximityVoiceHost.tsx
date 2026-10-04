/**
 * ProximityVoiceHost — mounts proximity voice inside OrbitX City.
 *
 * Rendered as a sibling of the HUD (NOT inside CityHud/GtaHud). Wires the
 * 3D player position from the game api into useProximityVoice and renders
 * the speaker overlay + a mic toggle button.
 *
 * Voice is opt-in: the player taps the mic button to join. Without a
 * Supabase session the token endpoint refuses, and we show a sign-in hint.
 */

import { useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProximityVoice } from "@/voice/useProximityVoice";
import { VoiceSpeakerOverlay } from "./VoiceSpeakerOverlay";

interface Props {
  /** The useGtaGame() api (has getWorld()). */
  api: { getWorld: () => any };
  displayName?: string;
}

export function ProximityVoiceHost({ api, displayName = "Trader" }: Props) {
  const getLocalPos = useCallback(() => {
    try {
      const w = api.getWorld();
      const p = w?.getPlayerState?.()?.pos;
      if (!p || typeof p.x !== "number" || typeof p.z !== "number") return null;
      return { x: p.x, z: p.z };
    } catch {
      return null;
    }
  }, [api]);

  // Stable guest identity per browser; token endpoint maps it to the authed user.
  const identity = useCallback(() => {
    try {
      let id = localStorage.getItem("orbitx.city.voice-id");
      if (!id) {
        id = `city-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("orbitx.city.voice-id", id);
      }
      return id;
    } catch {
      return `city-${Math.random().toString(36).slice(2, 10)}`;
    }
  }, [])();

  const voice = useProximityVoice({ getLocalPos, displayName, identity });

  const audible = voice.speakers.filter((s) => s.audible);

  return (
    <>
      <VoiceSpeakerOverlay
        speakers={voice.speakers}
        connected={voice.connected}
        maxRange={voice.maxRange}
      />
      {/* Mic toggle — bottom-right, above the safe area, clear of HUD clusters */}
      <div
        data-hud
        className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom,0px)+118px)] right-3 z-[70] flex flex-col items-center gap-1.5"
      >
        <button
          onClick={() => (voice.connected ? voice.toggleMute() : voice.join())}
          disabled={voice.connecting}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-xl transition",
            voice.connected && !voice.muted
              ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.45)]"
              : "border-white/15 bg-black/50 text-white/80"
          )}
          title={voice.connected ? (voice.muted ? "Unmute proximity voice" : "Mute") : "Join proximity voice"}
        >
          {voice.connecting ? (
            <Loader2 size={19} className="animate-spin" />
          ) : voice.connected && !voice.muted ? (
            <Mic size={19} />
          ) : voice.connected ? (
            <MicOff size={19} />
          ) : (
            <Volume2 size={19} />
          )}
        </button>
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">
          {voice.connected ? (voice.muted ? "muted" : `${audible.length} near`) : "voice"}
        </span>
        {voice.needsAuth && !voice.connected && (
          <span className="max-w-[90px] text-center text-[9px] leading-tight text-amber-200/90">
            Sign in to talk
          </span>
        )}
      </div>
    </>
  );
}
