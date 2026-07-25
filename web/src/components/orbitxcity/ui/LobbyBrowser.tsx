import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, RadioTower, Users } from "lucide-react";
import {
  MAIN_LOBBY,
  makeLobby,
  watchLobbyDirectory,
  type DirectoryLobby,
  type LobbyDescriptor,
} from "@/lib/orbitxcity/realtime";
import { useCity } from "@/pages/orbitxcity/CityProvider";

export function LobbyBrowser({
  startAfterJoin = true,
  onJoined,
}: {
  startAfterJoin?: boolean;
  onJoined?: (lobby: LobbyDescriptor) => void;
}) {
  const { lobby: activeLobby, setLobby, setEntered } = useCity();
  const [directory, setDirectory] = useState<DirectoryLobby[]>([{ ...MAIN_LOBBY, count: 0 }]);
  const [publicName, setPublicName] = useState("");
  const [privateName, setPrivateName] = useState("");
  const [password, setPassword] = useState("");
  const [prepared, setPrepared] = useState<LobbyDescriptor>(activeLobby ?? MAIN_LOBBY);

  useEffect(() => watchLobbyDirectory(setDirectory), []);

  const publicLobbies = useMemo(
    () => directory.filter((lobby) => !lobby.isPrivate || lobby.id === MAIN_LOBBY.id),
    [directory],
  );

  const selectLobby = (lobby: LobbyDescriptor) => {
    setPrepared(lobby);
    setLobby(lobby);
    onJoined?.(lobby);
    if (startAfterJoin) setEntered(true);
  };

  const createPublic = () => {
    const lobby = makeLobby(publicName || "Public OrbitX Lobby");
    selectLobby(lobby);
  };

  const joinPrivate = () => {
    const lobby = makeLobby(privateName || "Private OrbitX Lobby", password);
    selectLobby(lobby);
  };

  return (
    <section className="oxc-lobby-browser">
      <div className="oxc-menu-section-head">
        <span className="oxc-kicker">Lobby browser</span>
        <h2>Choose your city room</h2>
        <p>Main Lobby is always ready. Public rooms appear live from the realtime directory.</p>
      </div>

      <div className="oxc-lobby-current">
        <div>
          <span>Selected lobby</span>
          <strong>{(activeLobby ?? prepared).label}</strong>
        </div>
        <button type="button" className="oxc-btn primary compact" onClick={() => selectLobby(MAIN_LOBBY)}>
          Main Lobby
        </button>
      </div>

      <div className="oxc-lobby-grid">
        <div className="oxc-lobby-card wide">
          <div className="oxc-settings-title">
            <RadioTower className="h-4 w-4" /> Public directory
          </div>
          <div className="oxc-lobby-list">
            {publicLobbies.map((lobby) => (
              <button
                key={lobby.id}
                type="button"
                className={`oxc-lobby-row ${(city.lobby ?? prepared).id === lobby.id ? "on" : ""}`}
                onClick={() => selectLobby({ id: lobby.id, label: lobby.label, isPrivate: lobby.isPrivate })}
              >
                <span>
                  <strong>{lobby.label}</strong>
                  <small>{lobby.id === MAIN_LOBBY.id ? "Official spawn" : "Public room"}</small>
                </span>
                <em>
                  <Users className="h-3.5 w-3.5" /> {lobby.count}
                </em>
              </button>
            ))}
          </div>
        </div>

        <div className="oxc-lobby-card">
          <div className="oxc-settings-title">
            <Plus className="h-4 w-4" /> Create public lobby
          </div>
          <label className="oxc-menu-field">
            <span>Lobby name</span>
            <input
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
              maxLength={32}
              placeholder="Neon Plaza"
            />
          </label>
          <button type="button" className="oxc-btn primary oxc-menu-wide" onClick={createPublic}>
            Create and join
          </button>
        </div>

        <div className="oxc-lobby-card private">
          <div className="oxc-settings-title">
            <Lock className="h-4 w-4" /> Private lobby
          </div>
          <label className="oxc-menu-field">
            <span>Room name</span>
            <input
              value={privateName}
              onChange={(e) => setPrivateName(e.target.value)}
              maxLength={32}
              placeholder="Whale Lounge"
            />
          </label>
          <label className="oxc-menu-field">
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={48}
              placeholder="Shared secret"
              type="password"
            />
          </label>
          <button type="button" className="oxc-btn primary oxc-menu-wide" onClick={joinPrivate} disabled={!password.trim()}>
            Join private
          </button>
        </div>
      </div>

      {!city.setLobby && (
        <p className="oxc-api-note">
          Lobby prepared locally until Multiplayer exposes setLobby on CityProvider.
        </p>
      )}
    </section>
  );
}
