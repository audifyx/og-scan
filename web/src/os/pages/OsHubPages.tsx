import { Link } from "react-router-dom";
import { OxButton, OxPanel, OxXpBar } from "../components/primitives";
import {
  AchievementsBoard,
  CharacterCreatorPanel,
  InventoryGrid,
  LobbyBrowserUi,
  MatchmakingPanel,
  PlayerProfileCard,
  loadCharacter,
} from "../components/gaming";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export function OsUserHubPage() {
  const { profile, user } = useAuth();
  const [saved, setSaved] = useState(false);
  const character = loadCharacter();

  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <div className="ox-kicker">User hub</div>
      <h1 className="ox-title" style={{ fontSize: "1.8rem" }}>
        Operator loadout
      </h1>
      <p className="ox-lead">Identity, cosmetics, progression, and shortcuts into live OrbitX surfaces.</p>

      <PlayerProfileCard name={profile?.username || character.name || "Traveler"} />

      {!user && (
        <OxPanel>
          <p className="ox-lead">Connect a wallet to sync your hub across devices.</p>
          <Link to="/os/login?next=/os/hub">
            <OxButton type="button" variant="primary">
              Connect wallet
            </OxButton>
          </Link>
        </OxPanel>
      )}

      <div className="ox-kicker">Quick links</div>
      <div className="ox-cta-row">
        <Link to="/os/character">
          <OxButton type="button">Character</OxButton>
        </Link>
        <Link to="/os/inventory">
          <OxButton type="button">Inventory</OxButton>
        </Link>
        <Link to="/os/achievements">
          <OxButton type="button">Achievements</OxButton>
        </Link>
        <Link to="/os/rewards">
          <OxButton type="button" variant="primary">
            Rewards
          </OxButton>
        </Link>
      </div>

      <h2 className="ox-title" style={{ fontSize: "1.15rem" }}>
        Customize
      </h2>
      <CharacterCreatorPanel onSaved={() => setSaved(true)} />
      {saved && <div className="ox-badge">Loadout saved locally</div>}
    </div>
  );
}

export function OsCharacterPage() {
  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <div className="ox-kicker">Character creation</div>
      <h1 className="ox-title" style={{ fontSize: "1.7rem" }}>
        Avatar lab
      </h1>
      <p className="ox-lead">Sims-style cosmetics that carry into OrbitX City visuals.</p>
      <CharacterCreatorPanel />
    </div>
  );
}

export function OsInventoryPage() {
  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <div className="ox-kicker">Inventory</div>
      <h1 className="ox-title" style={{ fontSize: "1.7rem" }}>
        Gear locker
      </h1>
      <InventoryGrid />
    </div>
  );
}

export function OsAchievementsPage() {
  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <div className="ox-kicker">Achievements</div>
      <h1 className="ox-title" style={{ fontSize: "1.7rem" }}>
        Trophy feed
      </h1>
      <AchievementsBoard />
    </div>
  );
}

export function OsLobbiesPage() {
  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <div className="ox-kicker">Multiplayer</div>
      <h1 className="ox-title" style={{ fontSize: "1.7rem" }}>
        Lobbies & matchmaking
      </h1>
      <MatchmakingPanel />
      <LobbyBrowserUi />
    </div>
  );
}

export function OsRewardsPage() {
  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <div className="ox-kicker">Rewards</div>
      <h1 className="ox-title" style={{ fontSize: "1.7rem" }}>
        Drop bay
      </h1>
      <OxPanel>
        <OxXpBar level={12} xp={1840} nextXp={2500} label="Season XP" />
        <div className="ox-list" style={{ marginTop: "1rem" }}>
          {[
            { t: "Daily login", s: "+40 XP", c: true },
            { t: "First trade of the day", s: "+100 XP", c: false },
            { t: "Voice plaza check-in", s: "+60 XP", c: false },
            { t: "Billboard slot claim", s: "1 slot", c: false },
          ].map((r) => (
            <div key={r.t} className="ox-list-item">
              <span>{r.t}</span>
              <OxButton type="button" size="sm" variant={r.c ? "ghost" : "primary"} disabled={r.c}>
                {r.c ? "Claimed" : `Claim ${r.s}`}
              </OxButton>
            </div>
          ))}
        </div>
      </OxPanel>
    </div>
  );
}

export function OsSettingsPage() {
  const [quality, setQuality] = useState<"high" | "lite">("high");
  const [touch, setTouch] = useState(false);
  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <div className="ox-kicker">Settings</div>
      <h1 className="ox-title" style={{ fontSize: "1.7rem" }}>
        System prefs
      </h1>
      <OxPanel>
        <div className="ox-list">
          <div className="ox-list-item">
            <div>
              <strong>Graphics quality</strong>
              <div style={{ color: "var(--ox-muted)", fontSize: "0.8rem" }}>High enables bloom FX in City</div>
            </div>
            <OxButton type="button" size="sm" onClick={() => setQuality(quality === "high" ? "lite" : "high")}>
              {quality.toUpperCase()}
            </OxButton>
          </div>
          <div className="ox-list-item">
            <div>
              <strong>Touch controls</strong>
              <div style={{ color: "var(--ox-muted)", fontSize: "0.8rem" }}>On-screen joystick for mobile</div>
            </div>
            <OxButton type="button" size="sm" onClick={() => setTouch(!touch)}>
              {touch ? "ON" : "OFF"}
            </OxButton>
          </div>
          <div className="ox-list-item">
            <div>
              <strong>Classic Hub</strong>
              <div style={{ color: "var(--ox-muted)", fontSize: "0.8rem" }}>Legacy /app command deck</div>
            </div>
            <Link to="/app">
              <OxButton type="button" size="sm" variant="ghost">
                Open
              </OxButton>
            </Link>
          </div>
        </div>
      </OxPanel>
    </div>
  );
}
