/**
 * Lightweight AAA lobby gate — wraps LobbyBrowser with cosmic chamber chrome.
 */
import { CosmicBackdrop } from "./CosmicBackdrop";
import { LobbyBrowser } from "./LobbyBrowser";
import { LobbiesSystemExtras } from "./CitySystemPanels";
import { FEATURES_PER_SYSTEM } from "@/lib/orbitxcity/cityFeatureCatalog";
import { useCity } from "@/pages/orbitxcity/CityProvider";

export function LobbiesGate() {
  const { setGate } = useCity();
  return (
    <div className="oxc-chars is-in oxc-lobbies-gate">
      <CosmicBackdrop variant="chamber" />
      <header className="oxc-chars-head">
        <button type="button" className="oxc-chars-back" onClick={() => setGate("characters")}>
          ← Characters
        </button>
        <h1 className="oxc-chars-title">
          ORBIT<span className="oxc-chars-title-x">X</span> LOBBIES
        </h1>
        <p className="oxc-chars-sub">
          Public directory · private rooms · main lobby · voice-ready · {FEATURES_PER_SYSTEM} lobby systems
        </p>
      </header>
      <div className="oxc-lobbies-body">
        <LobbyBrowser
          startAfterJoin
          onJoined={() => {
            /* setEntered handled inside LobbyBrowser */
          }}
        />
        <LobbiesSystemExtras />
      </div>
    </div>
  );
}
