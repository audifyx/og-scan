import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import { getTeleportPoints, getWorldBlock } from "@/lib/orbitxcity/worlds";
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
import { X, ExternalLink, Rocket, LineChart, Store, Users, Map, Backpack, UserRound, Radio, MessageSquare, Mic, Gamepad2, Image as ImageIcon, Dices } from "lucide-react";

const TITLES: Partial<Record<Exclude<HudPanel, "none">, string>> = {
  map: "World Map",
  inventory: "Inventory",
  profile: "Profile",
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
        {panel === "inventory" && <InventoryPanel />}
        {panel === "profile" && <ProfilePanel />}
        {panel === "marketplace" && <MemeStorePanel />}
        {panel === "live" && <LiveDataPanel />}
        {panel === "community" && <CommunityPanel />}
        {panel === "events" && <EventsPanel />}
        {panel === "trading" && <TradingPanel />}
        {panel === "launch" && <LaunchPanel />}
        {panel === "token" && <TokenBuyPanel />}
        {panel === "chat" && <ChatPanel />}
        {panel === "voice" && <VoicePanel />}
        {panel === "social" && <SocialFeedPanel />}
        {panel === "games" && <GamesPanel />}
        {panel === "nft" && <NftPanel />}
        {panel === "settings" && <SettingsPanel />}
        {panel === "help" && <HelpPanel />}
        {panel === "lobbies" && <LobbyBrowser startAfterJoin={false} />}
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
  const { teleport, selectedCityId } = useCity();
  const block = getWorldBlock(selectedCityId);
  const teleports = getTeleportPoints(selectedCityId);
  return (
    <div className="oxc-stack">
      <div className="oxc-section-label"><Map className="h-3.5 w-3.5" /> Fast travel</div>
      <div className="oxc-teleport-grid">
        {teleports.map((p) => (
          <button
            key={p.id}
            type="button"
            className="oxc-teleport-btn"
            style={{ ["--tp" as string]: p.accent }}
            onClick={() => teleport(p.x, p.z)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="oxc-muted">NYC, Miami, and LA are playable. Boston unlocks later.</p>
      <div className="oxc-grid-2">
        {ORBITX_CITIES.map((c) => (
          <div key={c.id} className={`oxc-tile ${c.unlocked ? "on" : ""}`} style={{ borderColor: c.accent }}>
            <div className="oxc-tile-title">{c.name}</div>
            <div className="oxc-muted">{c.tagline}</div>
            <p>{c.purpose}</p>
            <span className="oxc-pill">{c.unlocked ? "Playable" : "Locked"}</span>
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
    </div>
  );
}

function InventoryPanel() {
  const { inventory, shards } = useCity();
  return (
    <div className="oxc-stack">
      <p className="oxc-muted">Inventory expands with holder keys, ad slots, and community badges.</p>
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
    </div>
  );
}

function ProfilePanel() {
  const { avatar } = useCity();
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
          <div className="oxc-muted">{user ? "OrbitX account linked" : "Guest session"}</div>
        </div>
      </div>
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
        <Link className="oxc-btn ghost" to="/terminal">Terminal</Link>
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
          <div className="oxc-tile-title">Social District</div>
          <p className="oxc-muted">Feed, world chat, and voice plaza — OrbitX social as a place you walk into.</p>
        </div>
      </div>
      <div className="oxc-actions">
        <button type="button" className="oxc-btn primary" onClick={() => openPanel("social")}>Social feed</button>
        <button type="button" className="oxc-btn ghost" onClick={() => openPanel("chat")}>World chat</button>
        <button type="button" className="oxc-btn ghost" onClick={() => { setVoiceOpen(true); openPanel("voice"); }}>Voice plaza</button>
      </div>
      <ul className="oxc-list">
        <li>Post to the live OrbitX social feed</li>
        <li>Chat with traders in the Midtown block</li>
        <li>Join the city voice channel (LiveKit)</li>
      </ul>
      <div className="oxc-actions">
        <Link className="oxc-btn ghost" to="/orbitx-social">Open Social</Link>
        <Link className="oxc-btn ghost" to="/spaces">Spaces</Link>
      </div>
    </div>
  );
}

function EventsPanel() {
  const events = [
    { t: "Now", title: "NYC Demo Block open", place: "OrbitX HQ Plaza" },
    { t: "Soon", title: "Launch Arena showcase", place: "Launch District" },
    { t: "Soon", title: "Miami community weekend", place: "OrbitX Miami (locked)" },
  ];
  return (
    <div className="oxc-stack">
      <p className="oxc-muted">World events calendar — projects can host inside owned/rented buildings.</p>
      {events.map((e) => (
        <div key={e.title} className="oxc-tile">
          <span className="oxc-pill">{e.t}</span>
          <div className="oxc-tile-title">{e.title}</div>
          <div className="oxc-muted">{e.place}</div>
        </div>
      ))}
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
  { id: "events" as const, label: "Events", icon: Rocket },
  { id: "inventory" as const, label: "Bag", icon: Backpack },
  { id: "profile" as const, label: "Profile", icon: UserRound },
];
