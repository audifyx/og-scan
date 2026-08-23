import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import { getTeleportPoints, getWorldBlock, OSM_ATTRIBUTION } from "@/lib/orbitxcity/worlds";
import {
  fetchCityMarketSnapshot,
  fmtPct,
  fmtUsd,
  shortMint,
} from "@/lib/orbitxcity/marketData";
import type { HudPanel } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { TokenBuyPanel } from "./TokenBuyPanel";
import { ChatPanel } from "./ChatPanel";
import { SocialFeedPanel } from "./SocialFeedPanel";
import { VoicePanel } from "./VoicePanel";
import { MemeStorePanel } from "./MemeStorePanel";
import { HelpPanel } from "./HelpPanel";
import { SettingsPanel } from "./SettingsPanel";
import { LobbyBrowser } from "./LobbyBrowser";
import { CharacterCreator } from "./CharacterCreator";
import {
  InventorySystemPanel,
  MissionsSystemPanel,
  LeaderboardsSystemPanel,
  FriendsSystemPanel,
  EventsSystemPanel,
  MarketplaceSystemExtras,
  SettingsSystemExtras,
  LobbiesSystemExtras,
  CityDistrictCatalog,
} from "./CitySystemPanels";
import { FEATURES_PER_SYSTEM } from "@/lib/orbitxcity/cityFeatureCatalog";
import { hasExplorerMapPerk } from "@/lib/orbitxcity/characterClasses";
import { X, ExternalLink, Rocket, LineChart, Store, Users, Map, Backpack, UserRound, Radio, MessageSquare, Mic, Gamepad2, Image as ImageIcon, Dices, Wand2 } from "lucide-react";

const TITLES: Partial<Record<Exclude<HudPanel, "none">, string>> = {
  map: "World Map",
  inventory: "Inventory",
  profile: "Profile",
  missions: "Missions",
  leaderboards: "Leaderboards",
  friends: "Friends",
  marketplace: "Meme Market · Store",
  live: "Live OrbitX Data",
  community: "Social District",
  events: "Event Calendar",
  token: "Token · Buy",
  trading: "Trading Floor",
  launch: "Launch Arena",
  chat: "World Chat",
  voice: "Voice Plaza",
  social: "Social Feed",
  games: "Gaming District",
  nft: "NFT Gallery",
  settings: "Settings",
  help: "Help",
  lobbies: "Lobbies",
  character: "Character",
};

export function CityPanelHost() {
  const { panel, closePanel } = useCity();
  if (panel === "none") return null;

  return (
    <aside className="oxc-panel" role="dialog" aria-label={TITLES[panel]}>
      <header className="oxc-panel-head">
        <div>
          <div className="oxc-kicker">{TITLES[panel]}</div>
          <h2>{TITLES[panel]}</h2>
        </div>
        <button type="button" className="oxc-icon-btn" onClick={closePanel} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="oxc-panel-body">
        {panel === "map" && <MapPanel />}
        {panel === "inventory" && <InventorySystemPanel />}
        {panel === "profile" && <ProfilePanel />}
        {panel === "missions" && <MissionsSystemPanel />}
        {panel === "leaderboards" && <LeaderboardsSystemPanel />}
        {panel === "friends" && <FriendsSystemPanel />}
        {panel === "marketplace" && (
          <>
            <MemeStorePanel />
            <MarketplaceSystemExtras />
          </>
        )}
        {panel === "live" && <LiveDataPanel />}
        {panel === "community" && <CommunityPanel />}
        {panel === "events" && <EventsSystemPanel />}
        {panel === "trading" && <TradingPanel />}
        {panel === "launch" && <LaunchPanel />}
        {panel === "token" && <TokenBuyPanel />}
        {panel === "chat" && <ChatPanel />}
        {panel === "voice" && <VoicePanel />}
        {panel === "social" && <SocialFeedPanel />}
        {panel === "games" && <GamesPanel />}
        {panel === "nft" && <NftPanel />}
        {panel === "settings" && (
          <>
            <SettingsPanel />
            <SettingsSystemExtras />
          </>
        )}
        {panel === "help" && <HelpPanel />}
        {panel === "lobbies" && (
          <>
            <LobbyBrowser startAfterJoin={false} />
            <LobbiesSystemExtras />
          </>
        )}
        {panel === "character" && <CharacterCreator onDone={() => closePanel()} />}
      </div>
    </aside>
  );
}

function GamesPanel() {
  return (
    <div className="oxc-stack">
      <div className="oxc-hero-tile launch">
        <Dices className="h-5 w-5" />
        <div>
          <div className="oxc-tile-title">Royal Orbit · Gaming District</div>
          <p className="oxc-muted">Casino, arcade, and the Prediction Center — powered by OrbitX games.</p>
        </div>
      </div>
      <div className="oxc-tile on">
        <div className="oxc-tile-title">Degen Tower</div>
        <p>Climb floors, cash out before the rug. Real SOL stakes.</p>
      </div>
      <div className="oxc-tile on">
        <div className="oxc-tile-title">Market Predictions</div>
        <p>Call the next candle. Win the pot. Prediction Center rails.</p>
      </div>
      <div className="oxc-actions">
        <Link className="oxc-btn primary" to="/games">
          <Gamepad2 className="h-3.5 w-3.5" /> Open Games
        </Link>
        <Link className="oxc-btn ghost" to="/ORBITX_DEX">Trade instead</Link>
      </div>
    </div>
  );
}

function NftPanel() {
  return (
    <div className="oxc-stack">
      <div className="oxc-hero-tile social">
        <ImageIcon className="h-5 w-5" />
        <div>
          <div className="oxc-tile-title">NFT Gallery</div>
          <p className="oxc-muted">The OrbitX NFT marketplace — mint, list, bid, and claim creator fees.</p>
        </div>
      </div>
      <ul className="oxc-list">
        <li>Magic-Eden-style home with trending collections</li>
        <li>Drops with countdowns and phases</li>
        <li>NFT-coin bonding-curve trading</li>
      </ul>
      <div className="oxc-actions">
        <Link className="oxc-btn primary" to="/nft">Open marketplace</Link>
        <Link className="oxc-btn ghost" to="/nft/drops">Drops</Link>
        <Link className="oxc-btn ghost" to="/nft/create">Create</Link>
      </div>
    </div>
  );
}

function MapPanel() {
  const { teleport, selectedCityId, playerPos, avatar } = useCity();
  const block = getWorldBlock(selectedCityId);
  const explorerPerk = hasExplorerMapPerk(avatar.classId);
  const teleports = getTeleportPoints(selectedCityId)
    .map((p) => ({
      ...p,
      dist: Math.hypot(playerPos.x - p.x, playerPos.z - p.z),
    }))
    .sort((a, b) => a.dist - b.dist);

  // Explorer perk: extended reveal — nearby venue zones as discoverable waypoints.
  const discoverRadius = explorerPerk ? 95 : 0;
  const discoveries =
    discoverRadius > 0
      ? block.zones
          .filter((z) => Math.hypot(playerPos.x - z.position.x, playerPos.z - z.position.z) <= discoverRadius)
          .map((z) => ({
            id: z.id,
            label: z.label,
            x: z.position.x,
            z: z.position.z,
            accent: z.kind === "hq" ? "#17ff4d" : "#3de7ff",
            dist: Math.hypot(playerPos.x - z.position.x, playerPos.z - z.position.z),
            hint: z.hint || "Venue",
          }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 8)
      : [];

  return (
    <div className="oxc-stack">
      <div className="oxc-section-label">
        <Map className="h-3.5 w-3.5" /> Fast travel
        {explorerPerk ? " · Explorer range" : ""}
      </div>
      <div className="oxc-teleport-grid">
        {teleports.map((p) => (
          <button
            key={p.id}
            type="button"
            className="oxc-teleport-btn"
            style={{ ["--tp" as string]: p.accent }}
            onClick={() => teleport(p.x, p.z)}
          >
            <span>{p.label}</span>
            <span className="oxc-muted" style={{ display: "block", fontSize: "0.68rem", marginTop: 2 }}>
              {Math.round(p.dist)}m · {p.x.toFixed(0)}, {p.z.toFixed(0)}
            </span>
          </button>
        ))}
      </div>

      {explorerPerk && discoveries.length > 0 && (
        <>
          <div className="oxc-section-label">Nearby venues · extended reveal</div>
          <div className="oxc-teleport-grid">
            {discoveries.map((d) => (
              <button
                key={`disc-${d.id}`}
                type="button"
                className="oxc-teleport-btn"
                style={{ ["--tp" as string]: d.accent }}
                onClick={() => teleport(d.x, d.z)}
                title={d.hint}
              >
                <span>{d.label}</span>
                <span className="oxc-muted" style={{ display: "block", fontSize: "0.68rem", marginTop: 2 }}>
                  {Math.round(d.dist)}m · walk-in / tools
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="oxc-muted">
        {explorerPerk
          ? "Explorer perk: teleports sorted by distance with venue discovery inside 95m."
          : `All four OrbitX City districts are playable — each ships ${FEATURES_PER_SYSTEM} district capabilities. Choose a district from the main menu, then fast travel between its landmarks.`}
      </p>
      {selectedCityId === "nyc" && (
        <p className="oxc-muted" style={{ fontSize: "0.72rem", opacity: 0.75 }}>
          {OSM_ATTRIBUTION}
        </p>
      )}
      <div className="oxc-grid-2">
        {ORBITX_CITIES.map((c) => (
          <div key={c.id} className="oxc-tile on" style={{ borderColor: c.accent }}>
            <div className="oxc-tile-title">{c.name}</div>
            <div className="oxc-muted">{c.tagline}</div>
            <p>{c.purpose}</p>
            <span className="oxc-pill on">{FEATURES_PER_SYSTEM} features</span>
          </div>
        ))}
      </div>
      <div className="oxc-tile on">
        <div className="oxc-tile-title">{block.name}</div>
        <ul className="oxc-list">
          {block.districts.map((d) => (
            <li key={d.id}>
              <strong>{d.name}</strong> — {d.description}
            </li>
          ))}
        </ul>
      </div>
      <CityDistrictCatalog city={selectedCityId} />
    </div>
  );
}

function ProfilePanel() {
  const { avatar, openPanel } = useCity();
  const { profile, user } = useAuth();
  const { publicKey, connected } = useWallet();
  return (
    <div className="oxc-stack">
      <div className="oxc-profile">
        <div className="oxc-avatar-preview" style={{ background: `linear-gradient(145deg, #10182a, ${avatar.accentColor}55)` }}>
          <span style={{ color: avatar.accentColor }}>◆</span>
        </div>
        <div>
          <div className="oxc-tile-title">@{profile?.username ?? avatar.name}</div>
          <div className="oxc-muted">{connected && publicKey ? shortMint(publicKey.toBase58(), 6) : "Wallet not linked"}</div>
          <div className="oxc-muted">
            {user ? "OrbitX account linked" : "Guest session"}
            {avatar.classId ? ` · ${avatar.classId}` : ""}
          </div>
        </div>
      </div>
      <button type="button" className="oxc-btn primary" onClick={() => openPanel("character")}>
        Customize character
      </button>
      <Link className="oxc-btn ghost" to="/profile">
        Open full OrbitX profile <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function useMarket() {
  return useQuery({
    queryKey: ["orbitxcity-market"],
    queryFn: fetchCityMarketSnapshot,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

function LiveDataPanel() {
  const { openToken } = useCity();
  const { data, isLoading } = useMarket();
  const rows = data?.trending ?? [];
  return (
    <div className="oxc-stack">
      <p className="oxc-muted">Live screener feed from OrbitX DEX APIs. Tap a row to open the in-world buy panel.</p>
      <div className="oxc-section-label"><Radio className="h-3.5 w-3.5" /> Trending · 24h</div>
      {isLoading && <div className="oxc-muted">Loading tape…</div>}
      <div className="oxc-token-list">
        {rows.map((r, i) => {
          const mint = r.mint ?? r.address;
          return (
            <button
              key={`${mint ?? r.symbol ?? i}`}
              type="button"
              className="oxc-token-row link"
              onClick={() => mint && openToken(mint)}
              disabled={!mint}
            >
              <div>
                <div className="oxc-tile-title">${r.symbol ?? "???"}</div>
                <div className="oxc-muted">{r.name ?? shortMint(mint)}</div>
              </div>
              <div className="oxc-token-stats">
                <span>{fmtUsd(r.priceUsd)}</span>
                <span className={Number(r.change24h) >= 0 ? "up" : "down"}>{fmtPct(r.change24h)}</span>
              </div>
            </button>
          );
        })}
        {!isLoading && rows.length === 0 && <div className="oxc-muted">Screener quiet — check /ORBITX_DEX.</div>}
      </div>
      <Link className="oxc-btn ghost" to="/ORBITX_DEX">
        Open OrbitX DEX <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function TradingPanel() {
  return (
    <div className="oxc-stack">
      <div className="oxc-hero-tile trade">
        <LineChart className="h-5 w-5" />
        <div>
          <div className="oxc-tile-title">Trading Floor</div>
          <p className="oxc-muted">Live charts, swaps, and market rooms — connected to OrbitX DEX rails.</p>
        </div>
      </div>
      <LiveDataPanel />
      <div className="oxc-actions">
        <Link className="oxc-btn primary" to="/ORBITX_DEX">Trade on DEX</Link>
        <Link className="oxc-btn ghost" to="/trade">Trade</Link>
      </div>
    </div>
  );
}

function LaunchPanel() {
  return (
    <div className="oxc-stack">
      <div className="oxc-hero-tile launch">
        <Rocket className="h-5 w-5" />
        <div>
          <div className="oxc-tile-title">Launch Arena</div>
          <p className="oxc-muted">Create and launch tokens live. Projects can host launch events inside the arena.</p>
        </div>
      </div>
      <MemeStorePanel />
      <Link className="oxc-btn primary" to="/orbitxlaunch/create">
        Launch a token <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function CommunityPanel() {
  const { openPanel, setVoiceOpen } = useCity();
  return (
    <div className="oxc-stack">
      <div className="oxc-hero-tile social">
        <Users className="h-5 w-5" />
        <div>
          <div className="oxc-tile-title">OrbitX Communities</div>
          <p className="oxc-muted">Live social feed, world chat, and voice — the same OrbitX community rails, inside the city.</p>
        </div>
      </div>
      <div className="oxc-actions">
        <button type="button" className="oxc-btn primary" onClick={() => openPanel("social")}>Social feed</button>
        <button type="button" className="oxc-btn ghost" onClick={() => openPanel("chat")}>World chat</button>
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
      </div>
      <SocialFeedPanel />
      <div className="oxc-actions">
        <Link className="oxc-btn ghost" to="/orbitx-social">Open Social app</Link>
        <Link className="oxc-btn ghost" to="/spaces">Spaces</Link>
        <Link className="oxc-btn ghost" to="/orbitx-social">HQ</Link>
      </div>
    </div>
  );
}

export const PANEL_NAV = [
  { id: "map" as const, label: "Map", icon: Map },
  { id: "live" as const, label: "Live", icon: Radio },
  { id: "marketplace" as const, label: "Market", icon: Store },
  { id: "chat" as const, label: "Chat", icon: MessageSquare },
  { id: "social" as const, label: "Social", icon: Users },
  { id: "voice" as const, label: "Voice", icon: Mic },
  { id: "character" as const, label: "Look", icon: Wand2 },
  { id: "events" as const, label: "Events", icon: Rocket },
  { id: "inventory" as const, label: "Bag", icon: Backpack },
  { id: "profile" as const, label: "Profile", icon: UserRound },
];

/** Phone dock — keep only the actions players need mid-run. */
export const MOBILE_DOCK = [
  { id: "map" as const, label: "Map", icon: Map },
  { id: "marketplace" as const, label: "Market", icon: Store },
  { id: "chat" as const, label: "Chat", icon: MessageSquare },
  { id: "voice" as const, label: "Voice", icon: Mic },
  { id: "inventory" as const, label: "Bag", icon: Backpack },
];

/** Overflow sheet on phones. */
export const MORE_PANELS = [
  { id: "live" as const, label: "Live", icon: Radio },
  { id: "social" as const, label: "Social", icon: Users },
  { id: "character" as const, label: "Look", icon: Wand2 },
  { id: "events" as const, label: "Events", icon: Rocket },
  { id: "profile" as const, label: "Profile", icon: UserRound },
  { id: "help" as const, label: "Help", icon: Gamepad2 },
];
