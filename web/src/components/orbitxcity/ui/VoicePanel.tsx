import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const LiveKitVoicePanel = lazy(() =>
  import("@/components/lobbies/LiveKitVoicePanel").then((m) => ({ default: m.LiveKitVoicePanel })),
);

/** Voice plaza — wraps OrbitX LiveKit rails for the city social district. */
export function VoicePanel() {
  const { user } = useAuth();
  const { voiceOpen, setVoiceOpen } = useCity();

  if (!user) {
    return (
      <div className="oxc-stack">
        <p className="oxc-muted">Sign in with your wallet to join the OrbitX City voice channel.</p>
        <Link className="oxc-btn primary" to="/auth">
          Sign in <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="oxc-stack">
      <p className="oxc-muted">
        Live voice plaza powered by OrbitX Spaces / LiveKit. Talk while you walk the Midtown block.
      </p>

      {!voiceOpen ? (
        <button type="button" className="oxc-btn primary" onClick={() => setVoiceOpen(true)}>
          Join voice channel
        </button>
      ) : (
        <>
          <div className="oxc-voice-shell">
            <Suspense fallback={<div className="oxc-muted">Loading voice…</div>}>
              <LiveKitVoicePanel
                lobbyId="oxc-nyc-plaza"
                lobbyName="OrbitX City · NYC Plaza"
                autoJoin
                compact
                initialRole="speaker"
              />
            </Suspense>
          </div>
          <button type="button" className="oxc-btn ghost" onClick={() => setVoiceOpen(false)}>
            Leave voice UI
          </button>
        </>
      )}

      <Link className="oxc-btn ghost" to="/spaces">
        Open Spaces <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
