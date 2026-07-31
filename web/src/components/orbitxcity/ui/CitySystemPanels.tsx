/**
 * Fully built OrbitX City system panels (Inventory → Events) + Play overview.
 * Each includes a live ops tab and a 168-capability FeatureCatalog.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Backpack,
  CheckCircle2,
  Copy,
  Crosshair,
  ExternalLink,
  Trophy,
  UserPlus,
  CalendarDays,
  Play,
} from "lucide-react";
import { useFriends } from "@/hooks/useFriends";
import { useAuth } from "@/hooks/useAuth";
import {
  CITY_EVENTS,
  CITY_MISSION_BOARD,
  FEATURES_PER_SYSTEM,
  INVENTORY_CATALOG,
  getSystemMeta,
  type CitySystemId,
} from "@/lib/orbitxcity/cityFeatureCatalog";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import {
  hasBuilderMissionPerk,
  missionClaimCooldownMs,
} from "@/lib/orbitxcity/characterClasses";
import { getWorldBlock } from "@/lib/orbitxcity/worlds";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { FeatureCatalog, SystemTabs } from "./FeatureCatalog";
import { DAILY_MISSIONS, WEEKLY_MISSIONS } from "@/gaming/catalogs/progressionCatalog";
import { claimMission as claimGameMission } from "@/gaming/state/GameProfileStore";
import { useGameProfile } from "@/gaming/state/useGameProfile";

function PanelShell({
  system,
  hero,
  children,
}: {
  system: CitySystemId;
  hero: ReactNode;
  children: ReactNode;
}) {
  const meta = getSystemMeta(system);
  const [tab, setTab] = useState("live");
  return (
    <div className="oxc-stack oxc-sys-panel" style={{ ["--sys" as string]: meta.accent }}>
      {hero}
      <SystemTabs
        tabs={[
          { id: "live", label: "Live ops" },
          { id: "catalog", label: `${FEATURES_PER_SYSTEM} features` },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "live" ? children : <FeatureCatalog system={system} />}
    </div>
  );
}

export function PlaySystemPanel() {
  const { setGate, selectedCityId, openPanel } = useCity();
  const city = ORBITX_CITIES.find((c) => c.id === selectedCityId);
  return (
    <PanelShell
      system="play"
      hero={
        <div className="oxc-hero-tile launch">
          <Play className="h-5 w-5" />
          <div>
            <div className="oxc-tile-title">Play · Orbit Gate</div>
            <p className="oxc-muted">
              {FEATURES_PER_SYSTEM} play-loop capabilities · active district {city?.name ?? "NYC"}.
            </p>
          </div>
        </div>
      }
    >
      <div className="oxc-actions">
        <button type="button" className="oxc-btn primary" onClick={() => setGate("characters")}>
          Recruit operative
        </button>
        <button type="button" className="oxc-btn ghost" onClick={() => setGate("lobbies")}>
          Open lobbies
        </button>
        <button type="button" className="oxc-btn ghost" onClick={() => openPanel("map")}>
          World map
        </button>
      </div>
      <div className="oxc-grid-2">
        {ORBITX_CITIES.map((c) => (
          <div key={c.id} className="oxc-tile on" style={{ borderColor: c.accent }}>
            <div className="oxc-tile-title">{c.name}</div>
            <div className="oxc-muted">{c.tagline}</div>
            <p>{c.purpose}</p>
            <span className="oxc-pill on">{FEATURES_PER_SYSTEM} district features</span>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

export function InventorySystemPanel() {
  const { inventory, shards, avatar } = useCity();
  const ownedIds = new Set(inventory.map((i) => i.id));
  return (
    <PanelShell
      system="inventory"
      hero={
        <div className="oxc-hero-tile trade">
          <Backpack className="h-5 w-5" />
          <div>
            <div className="oxc-tile-title">Inventory · loadout vault</div>
            <p className="oxc-muted">
              {shards} ◈ OBX shards · {avatar.classId ?? "operative"} clearance · {FEATURES_PER_SYSTEM} bag systems.
            </p>
          </div>
        </div>
      }
    >
      <div className="oxc-inv-grid">
        <div className="oxc-inv-item shard">
          <div className="oxc-inv-kind">currency</div>
          <div className="oxc-tile-title">OBX Shards ◈ {shards}</div>
          <div className="oxc-muted">Collected on the streets — walk over glowing coins.</div>
        </div>
        {inventory.map((item) => (
          <div key={item.id} className="oxc-inv-item">
            <div className="oxc-inv-kind">{item.kind}</div>
            <div className="oxc-tile-title">{item.label}</div>
            <div className="oxc-muted">{item.detail}</div>
          </div>
        ))}
      </div>
      <div className="oxc-section-label">City catalog</div>
      <div className="oxc-inv-grid">
        {INVENTORY_CATALOG.map((item) => (
          <div key={item.id} className={`oxc-inv-item ${ownedIds.has(item.id) ? "owned" : ""}`}>
            <div className="oxc-inv-kind">{item.kind}</div>
            <div className="oxc-tile-title">{item.label}</div>
            <div className="oxc-muted">{item.detail}</div>
            <span className={`oxc-pill ${ownedIds.has(item.id) ? "on" : ""}`}>
              {ownedIds.has(item.id) ? "Owned" : "Locked"}
            </span>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function missionReady(
  require: (typeof CITY_MISSION_BOARD)[number]["require"],
  ctx: { entered: boolean; shards: number; voiceOpen: boolean },
) {
  switch (require) {
    case "entered":
      return ctx.entered;
    case "shards10":
      return ctx.shards >= 10;
    case "shards25":
      return ctx.shards >= 25;
    case "shards50":
      return ctx.shards >= 50;
    case "voice":
      return ctx.voiceOpen;
    case "always":
      return true;
    default:
      return false;
  }
}

export function MissionsSystemPanel() {
  const {
    shards,
    entered,
    voiceOpen,
    claimedMissionIds,
    claimMission,
    selectedCityId,
    avatar,
    interiorBuildingId,
    activeZone,
    missionClaimReadyAt,
  } = useCity();
  const { profile, updateProfile } = useGameProfile();
  const ctx = { entered, shards, voiceOpen };
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (missionClaimReadyAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [missionClaimReadyAt]);

  const builder = hasBuilderMissionPerk(avatar.classId);
  const block = getWorldBlock(selectedCityId);
  const interior = interiorBuildingId
    ? block.buildings.find((b) => b.id === interiorBuildingId)
    : null;
  const atHq =
    interior?.kind === "hq" || interior?.interaction === "hq" || activeZone?.kind === "hq";
  const cooldownMs = missionClaimCooldownMs(avatar.classId, atHq);
  const cooldownLeft = Math.max(0, missionClaimReadyAt - now);

  const board = useMemo(
    () =>
      CITY_MISSION_BOARD.filter((m) => m.city === "any" || m.city === selectedCityId || !m.city),
    [selectedCityId],
  );

  return (
    <PanelShell
      system="missions"
      hero={
        <div className="oxc-hero-tile launch">
          <Crosshair className="h-5 w-5" />
          <div>
            <div className="oxc-tile-title">Missions · city contracts</div>
            <p className="oxc-muted">
              District bounties + Play progression dailies · {FEATURES_PER_SYSTEM} mission rails.
              {builder
                ? ` Builder perk: ${atHq ? "2s HQ" : "8s"} claim cooldown.`
                : ` Claim cooldown ${Math.round(cooldownMs / 1000)}s.`}
            </p>
          </div>
        </div>
      }
    >
      {cooldownLeft > 0 && (
        <p className="oxc-muted">
          Next city claim in {Math.ceil(cooldownLeft / 1000)}s
          {builder && atHq ? " · HQ fast lane" : builder ? " · Builder lane" : ""}
        </p>
      )}
      <div className="oxc-section-label">City board · {selectedCityId.toUpperCase()}</div>
      {board.map((mission) => {
        const claimed = claimedMissionIds.includes(mission.id);
        const ready = missionReady(mission.require, ctx);
        const cooling = cooldownLeft > 0;
        return (
          <div key={mission.id} className="oxc-tile on">
            <div className="oxc-tile-title">{mission.title}</div>
            <p className="oxc-muted">{mission.detail}</p>
            <div className="oxc-actions">
              <span className={`oxc-pill ${claimed || ready ? "on" : ""}`}>
                {claimed ? "Claimed" : cooling && ready ? "Cooldown" : ready ? "Ready" : "In progress"}
              </span>
              <button
                type="button"
                className="oxc-btn primary compact"
                disabled={!ready || claimed || cooling}
                onClick={() => claimMission(mission.id, mission.reward)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Claim {mission.reward} ◈
              </button>
            </div>
          </div>
        );
      })}

      <div className="oxc-section-label">Play hub dailies / weeklies</div>
      {[...DAILY_MISSIONS, ...WEEKLY_MISSIONS].map((m) => {
        const progress = profile.progression.missionProgress[m.id];
        const done = progress?.status === "claimed";
        const ready = progress?.status === "completed";
        return (
          <div key={m.id} className="oxc-tile">
            <div className="oxc-tile-title">{m.title}</div>
            <p className="oxc-muted">{m.description}</p>
            <div className="oxc-actions">
              <span className={`oxc-pill ${done || ready ? "on" : ""}`}>
                {done ? "Claimed" : ready ? "Ready" : progress?.status ?? m.kind}
              </span>
              <button
                type="button"
                className="oxc-btn ghost compact"
                disabled={!ready || done}
                onClick={() => updateProfile((p) => claimGameMission(p, m.id))}
              >
                Claim {m.shardReward} ◈ / {m.xp} XP
              </button>
            </div>
          </div>
        );
      })}
    </PanelShell>
  );
}

export function LeaderboardsSystemPanel() {
  const { realtime, avatar, shards, selectedCityId } = useCity();
  const players = Array.from(realtime?.players.values() ?? [])
    .map((p) => ({ id: p.id, name: p.name, score: Math.max(1, Math.floor((Date.now() - p.updatedAt) / 1000) % 40) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 16);

  const rows = [
    { id: "you", name: avatar.name, score: shards, you: true },
    ...players,
  ].sort((a, b) => b.score - a.score);

  return (
    <PanelShell
      system="leaderboards"
      hero={
        <div className="oxc-hero-tile trade">
          <Trophy className="h-5 w-5" />
          <div>
            <div className="oxc-tile-title">Leaderboards · {selectedCityId.toUpperCase()}</div>
            <p className="oxc-muted">Shard heat + live lobby presence · {FEATURES_PER_SYSTEM} ranking systems.</p>
          </div>
        </div>
      }
    >
      <Link className="oxc-btn ghost" to="/Leaderboard">
        Open platform leaderboard <ExternalLink className="h-3.5 w-3.5" />
      </Link>
      {rows.map((row, index) => (
        <div key={row.id} className={`oxc-tile ${"you" in row && row.you ? "on" : ""}`}>
          <div className="oxc-tile-title">
            #{index + 1} · {row.name}
            {"you" in row && row.you ? " · You" : ""}
          </div>
          <div className="oxc-muted">{row.score} ◈ heat</div>
        </div>
      ))}
      {!players.length && <p className="oxc-muted">Invite friends into this lobby to fill the live board.</p>}
    </PanelShell>
  );
}

export function FriendsSystemPanel() {
  const { realtime, lobby, openPanel, setVoiceOpen } = useCity();
  const { user } = useAuth();
  const { followers, following, mutuals, loading } = useFriends();
  const players = Array.from(realtime?.players.values() ?? []);

  const copyInvite = async () => {
    const url = `${window.location.origin}/Orbitxcity?lobby=${encodeURIComponent(lobby.id)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this lobby invite", url);
    }
  };

  return (
    <PanelShell
      system="friends"
      hero={
        <div className="oxc-hero-tile social">
          <UserPlus className="h-5 w-5" />
          <div>
            <div className="oxc-tile-title">Friends · crew graph</div>
            <p className="oxc-muted">
              Lobby presence + OrbitX mutuals · {FEATURES_PER_SYSTEM} social systems.
            </p>
          </div>
        </div>
      }
    >
      <div className="oxc-actions">
        <button type="button" className="oxc-btn primary" onClick={() => void copyInvite()}>
          <Copy className="h-3.5 w-3.5" /> Copy lobby invite
        </button>
        <button type="button" className="oxc-btn ghost" onClick={() => openPanel("social")}>
          Social feed
        </button>
        <button
          type="button"
          className="oxc-btn ghost"
          onClick={() => {
            setVoiceOpen(true);
            openPanel("voice");
          }}
        >
          Voice plaza
        </button>
        <Link className="oxc-btn ghost" to="/orbitx-social">
          Open HQ
        </Link>
      </div>

      <div className="oxc-section-label">In lobby · {lobby.label}</div>
      {players.map((player) => (
        <div key={player.id} className="oxc-tile on">
          <div className="oxc-tile-title">{player.name}</div>
          <div className="oxc-muted">Online now</div>
        </div>
      ))}
      {!players.length && <p className="oxc-muted">Nobody else in this lobby yet — send the invite.</p>}

      <div className="oxc-section-label">OrbitX graph {user ? "" : "(sign in)"}</div>
      {loading && <p className="oxc-muted">Loading friends…</p>}
      {!loading && user && (
        <>
          <p className="oxc-muted">
            {mutuals.length} mutuals · {following.length} following · {followers.length} followers
          </p>
          {mutuals.slice(0, 12).map((f) => (
            <div key={f.user_id} className="oxc-tile on">
              <div className="oxc-tile-title">@{f.username ?? f.display_name ?? "operative"}</div>
              <div className="oxc-muted">{f.badge ?? "Mutual"}</div>
            </div>
          ))}
          {!mutuals.length && <p className="oxc-muted">No mutuals yet — grow your graph on /hq.</p>}
        </>
      )}
      {!user && <p className="oxc-muted">Connect your OrbitX account to sync followers and mutuals.</p>}
    </PanelShell>
  );
}

export function EventsSystemPanel() {
  const { selectedCityId, openPanel, setGate } = useCity();
  const events = CITY_EVENTS.filter((e) => e.city === "all" || e.city === selectedCityId);

  return (
    <PanelShell
      system="events"
      hero={
        <div className="oxc-hero-tile social">
          <CalendarDays className="h-5 w-5" />
          <div>
            <div className="oxc-tile-title">Events · district calendar</div>
            <p className="oxc-muted">
              Live shows for {selectedCityId.toUpperCase()} · {FEATURES_PER_SYSTEM} event systems online.
            </p>
          </div>
        </div>
      }
    >
      <div className="oxc-actions">
        <button type="button" className="oxc-btn primary" onClick={() => openPanel("launch")}>
          Launch arena
        </button>
        <button type="button" className="oxc-btn ghost" onClick={() => openPanel("marketplace")}>
          Marketplace
        </button>
        <Link className="oxc-btn ghost" to="/nft/drops">
          NFT drops
        </Link>
        <button type="button" className="oxc-btn ghost" onClick={() => setGate("lobbies")}>
          Event lobbies
        </button>
      </div>
      {events.map((e) => (
        <div key={e.id} className="oxc-tile on">
          <span className={`oxc-pill ${e.status === "Live" ? "on" : ""}`}>{e.status}</span>
          <div className="oxc-tile-title">{e.title}</div>
          <div className="oxc-muted">{e.place}</div>
          <p>{e.blurb}</p>
        </div>
      ))}
    </PanelShell>
  );
}

export function MarketplaceSystemExtras() {
  return (
    <div className="oxc-stack" style={{ marginTop: "0.75rem" }}>
      <FeatureCatalog system="marketplace" />
    </div>
  );
}

export function SettingsSystemExtras() {
  return (
    <div className="oxc-stack" style={{ marginTop: "0.75rem" }}>
      <FeatureCatalog system="settings" />
    </div>
  );
}

export function CharactersSystemExtras() {
  return <FeatureCatalog system="characters" />;
}

export function LobbiesSystemExtras() {
  return <FeatureCatalog system="lobbies" />;
}

export function CityDistrictCatalog({ city }: { city: "nyc" | "miami" | "la" | "boston" }) {
  return <FeatureCatalog system={city} />;
}
