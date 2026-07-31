/**
 * Multiplayer gate — lobby browser on shared cinematic backdrop.
 */
import { MenuBackdrop } from "./MenuBackdrop";
import { LobbyBrowser } from "./LobbyBrowser";
import { useCity } from "@/pages/orbitxcity/CityProvider";

export function LobbiesGate() {
  const { setGate, selectedCityId } = useCity();
  return (
    <div className="oxc-chars is-in oxc-lobbies-gate">
      <MenuBackdrop cityId={selectedCityId} intensity="chamber" />
      <header className="oxc-chars-top">
        <div className="oxc-chars-top-row">
          <button type="button" className="oxc-chars-back" onClick={() => setGate("characters")}>
            ← Operatives
          </button>
          <span className="oxc-chars-kicker" style={{ margin: 0 }}>
            Multiplayer
          </span>
        </div>
        <h1 className="oxc-chars-title">
          ORBIT<span className="oxc-chars-title-x">X</span> LOBBIES
        </h1>
        <p className="oxc-chars-sub">Main lobby · public rooms · private password sessions.</p>
      </header>
      <div className="oxc-lobbies-body">
        <LobbyBrowser
          startAfterJoin
          onJoined={() => {
            /* setEntered handled inside LobbyBrowser */
          }}
        />
      </div>
    </div>
  );
}
