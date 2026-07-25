import { useMemo, useState } from "react";
import { Globe2, HelpCircle, Play, Settings, Sparkles, UserRound, Users } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAuth } from "@/hooks/useAuth";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import type { CityId } from "@/lib/orbitxcity/types";
import { MAIN_LOBBY } from "@/lib/orbitxcity/realtime";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { CharacterCreator } from "./CharacterCreator";
import { HelpPanel } from "./HelpPanel";
import { LobbyBrowser } from "./LobbyBrowser";
import { SettingsPanel } from "./SettingsPanel";

type MenuView = "home" | "lobbies" | "character" | "settings" | "help" | "worlds";

export function MainMenu() {
  const {
    setEntered,
    setLobby,
    lobby,
    selectedCityId,
    setSelectedCityId,
  } = useCity();
  const { connected, publicKey } = useWallet();
  const { user, profile } = useAuth();
  const [view, setView] = useState<MenuView>("home");

  const selectedCity = useMemo(
    () => ORBITX_CITIES.find((c) => c.id === selectedCityId) ?? ORBITX_CITIES[0],
    [selectedCityId],
  );

  const startMainLobby = () => {
    setLobby(MAIN_LOBBY);
    setEntered(true);
  };

  const selectCity = (id: CityId) => {
    setSelectedCityId(id);
  };

  const walletLabel =
    connected && publicKey
      ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
      : user
        ? profile?.username ?? "OrbitX account"
        : "Guest ready";

  return (
    <main className="oxc-main-menu" aria-label="OrbitX City main menu">
      <div className="oxc-menu-bg" aria-hidden />
      <div className="oxc-menu-stars" aria-hidden />

      <section className="oxc-menu-hero">
        <div className="oxc-menu-brand-block">
          <div className="oxc-kicker">OrbitX World · live city demo</div>
          <h1 className="oxc-menu-brand">
            OrbitX<span>City</span>
          </h1>
          <p>
            Drop into neon trading districts, social plazas, launch arenas, token billboards,
            and multiplayer lobbies built for mobile-first play.
          </p>
        </div>

        <div className="oxc-menu-status">
          <span>{walletLabel}</span>
          <strong>{lobby.label}</strong>
          <em>{selectedCity?.name ?? "OrbitX NYC"}</em>
        </div>
      </section>

      <section className="oxc-menu-body">
        <nav className="oxc-menu-actions" aria-label="Main menu actions">
          <button type="button" className="oxc-menu-action primary" onClick={startMainLobby}>
            <Play className="h-5 w-5" />
            <span>
              <b>Start Game</b>
              <small>Enter Main Lobby · {selectedCity?.name}</small>
            </span>
          </button>
          <button type="button" className="oxc-menu-action" onClick={() => setView("lobbies")}>
            <Users className="h-5 w-5" />
            <span>
              <b>Join Lobby</b>
              <small>Main · public · private password</small>
            </span>
          </button>
          <button type="button" className="oxc-menu-action" onClick={() => setView("character")}>
            <UserRound className="h-5 w-5" />
            <span>
              <b>Character</b>
              <small>Hair · outfit · face · colors</small>
            </span>
          </button>
          <button type="button" className="oxc-menu-action" onClick={() => setView("settings")}>
            <Settings className="h-5 w-5" />
            <span>
              <b>Settings</b>
              <small>Quality · touch controls</small>
            </span>
          </button>
          <button type="button" className="oxc-menu-action" onClick={() => setView("help")}>
            <HelpCircle className="h-5 w-5" />
            <span>
              <b>Help</b>
              <small>Desktop + mobile controls</small>
            </span>
          </button>
          <button type="button" className="oxc-menu-action" onClick={() => setView("worlds")}>
            <Globe2 className="h-5 w-5" />
            <span>
              <b>World Select</b>
              <small>NYC · Miami · LA</small>
            </span>
          </button>
        </nav>

        <div className="oxc-menu-panel-stage">
          {view === "home" && (
            <div className="oxc-menu-home-card">
              <div className="oxc-kicker">
                <Sparkles className="h-3.5 w-3.5" /> Ready to drop
              </div>
              <h2>Full game UI</h2>
              <p>
                Start in the public Main Lobby, create custom rooms with friends, or jump into a
                private password lobby. Customize your Sims-style look before you enter.
              </p>
              <div className="oxc-menu-home-actions">
                <WalletConnectButton />
                <button type="button" className="oxc-btn primary" onClick={startMainLobby}>
                  Enter Main Lobby
                </button>
              </div>
            </div>
          )}
          {view === "lobbies" && <LobbyBrowser />}
          {view === "character" && <CharacterCreator onDone={() => setView("home")} />}
          {view === "settings" && <SettingsPanel />}
          {view === "help" && <HelpPanel />}
          {view === "worlds" && (
            <div className="oxc-world-select">
              <div className="oxc-menu-section-head">
                <span className="oxc-kicker">Worlds</span>
                <h2>Choose your city</h2>
                <p>NYC, Miami, and LA are unlocked. Boston stays on the roadmap.</p>
              </div>
              <div className="oxc-world-grid">
                {ORBITX_CITIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`oxc-world-chip ${selectedCityId === c.id ? "on" : ""} ${c.unlocked ? "live" : "locked"}`}
                    style={{ ["--chip" as string]: c.accent }}
                    disabled={!c.unlocked}
                    onClick={() => selectCity(c.id)}
                  >
                    <strong>{c.name}</strong>
                    <span>{c.tagline}</span>
                    <small>{c.unlocked ? (selectedCityId === c.id ? "SELECTED" : "LIVE") : "SOON"}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {view !== "home" && (
        <button type="button" className="oxc-menu-back" onClick={() => setView("home")}>
          Back to menu
        </button>
      )}
    </main>
  );
}
