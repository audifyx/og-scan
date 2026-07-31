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
      <header className="oxc-chars-bar">
        <button type="button" className="oxc-chars-back" onClick={() => setGate("characters")}>
          ← Operatives
        </button>
        <div className="oxc-chars-bar-center">
          <p className="oxc-chars-kicker">Multiplayer</p>
          <h1 className="oxc-chars-title">
            ORBIT<span className="oxc-chars-title-x">X</span> LOBBIES
          </h1>
        </div>
        <span className="oxc-chars-bar-spacer" aria-hidden />
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
