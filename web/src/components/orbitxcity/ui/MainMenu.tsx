/**
 * OrbitX City — Main Menu (holographic command bridge).
 * Matches recruitment-chamber art direction: gold/crypto + multi-neon accents.
 */
import { useEffect, useState } from "react";
import {
  Play,
  Users,
  Store,
  Backpack,
  Crosshair,
  Trophy,
  UserPlus,
  Settings,
  CalendarDays,
  RadioTower,
  type LucideIcon,
} from "lucide-react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import type { CityId } from "@/lib/orbitxcity/types";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { FEATURES_PER_SYSTEM } from "@/lib/orbitxcity/cityFeatureCatalog";
import { CosmicBackdrop } from "./CosmicBackdrop";
import { AudioToggle } from "./AudioToggle";
import { InstallCityPWA } from "./InstallCityPWA";

type MenuAction =
  | "play"
  | "characters"
  | "lobbies"
  | "marketplace"
  | "inventory"
  | "missions"
  | "leaderboards"
  | "friends"
  | "settings"
  | "events";

interface MenuTile {
  id: MenuAction;
  label: string;
  blurb: string;
  icon: LucideIcon;
  accent: string;
  primary?: boolean;
  badge?: string;
}

const TILES: MenuTile[] = [
  {
    id: "play",
    label: "Enter City",
    blurb: `${FEATURES_PER_SYSTEM} play-loop systems`,
    icon: Play,
    accent: "#c5a26f",
    primary: true,
    badge: "LIVE",
  },
  {
    id: "characters",
    label: "Operatives",
    blurb: `${FEATURES_PER_SYSTEM} character systems`,
    icon: Users,
    accent: "#b388ff",
    badge: "168",
  },
  {
    id: "lobbies",
    label: "Lobbies",
    blurb: `${FEATURES_PER_SYSTEM} lobby systems`,
    icon: RadioTower,
    accent: "#5b8def",
    badge: "168",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    blurb: `${FEATURES_PER_SYSTEM} market systems`,
    icon: Store,
    accent: "#ff4d6a",
    badge: "168",
  },
  {
    id: "inventory",
    label: "Inventory",
    blurb: `${FEATURES_PER_SYSTEM} bag systems`,
    icon: Backpack,
    accent: "#00ff9f",
    badge: "168",
  },
  {
    id: "missions",
    label: "Missions",
    blurb: `${FEATURES_PER_SYSTEM} mission rails`,
    icon: Crosshair,
    accent: "#c5a26f",
    badge: "168",
  },
  {
    id: "leaderboards",
    label: "Leaderboards",
    blurb: `${FEATURES_PER_SYSTEM} ranking systems`,
    icon: Trophy,
    accent: "#e0c48a",
    badge: "168",
  },
  {
    id: "friends",
    label: "Friends",
    blurb: `${FEATURES_PER_SYSTEM} social systems`,
    icon: UserPlus,
    accent: "#ff4d6a",
    badge: "168",
  },
  {
    id: "events",
    label: "Events",
    blurb: `${FEATURES_PER_SYSTEM} event systems`,
    icon: CalendarDays,
    accent: "#b388ff",
    badge: "LIVE",
  },
  {
    id: "settings",
    label: "Settings",
    blurb: `${FEATURES_PER_SYSTEM} system controls`,
    icon: Settings,
    accent: "#5b8def",
    badge: "168",
  },
];

const TILE_UI_ICONS: Partial<Record<MenuAction, string>> = {
  play: "/orbitxcity/ui/icon-play.svg",
  characters: "/orbitxcity/ui/icon-characters.svg",
  marketplace: "/orbitxcity/ui/icon-marketplace.svg",
  missions: "/orbitxcity/ui/icon-missions.svg",
};

export function MainMenu() {
  const { setGate, setEntered, openPanel, selectedCityId, setSelectedCityId } = useCity();
  const [visible, setVisible] = useState(false);
  const [flash, setFlash] = useState(false);
  const [isTouch, setIsTouch] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
  );

  const activeCity = ORBITX_CITIES.find((c) => c.id === selectedCityId) ?? ORBITX_CITIES[0]!;

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    const mq = window.matchMedia?.("(pointer: coarse)");
    const onChange = () => setIsTouch(Boolean(mq?.matches));
    mq?.addEventListener?.("change", onChange);
    return () => {
      cancelAnimationFrame(t);
      mq?.removeEventListener?.("change", onChange);
    };
  }, []);

  const pulseEnter = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 650);
  };

  const onTile = (tile: MenuTile) => {
    void cityAudio.unlock();
    cityAudio.play(tile.primary ? "confirm" : "ui");
    switch (tile.id) {
      case "play":
      case "characters":
        pulseEnter();
        window.setTimeout(() => setGate("characters"), 180);
        break;
      case "lobbies":
        pulseEnter();
        window.setTimeout(() => setGate("lobbies"), 180);
        break;
      case "marketplace":
        cityAudio.play("enter");
        pulseEnter();
        setGate("world");
        setEntered(true);
        openPanel("marketplace");
        break;
      case "inventory":
        cityAudio.play("enter");
        pulseEnter();
        setGate("world");
        setEntered(true);
        openPanel("inventory");
        break;
      case "settings":
      case "missions":
      case "leaderboards":
      case "friends":
      case "events":
        cityAudio.play("enter");
        pulseEnter();
        setGate("world");
        setEntered(true);
        openPanel(tile.id);
        break;
      default:
        break;
    }
  };

  const enterCharacters = () => {
    void cityAudio.unlock();
    cityAudio.play("confirm");
    pulseEnter();
    window.setTimeout(() => setGate("characters"), 180);
  };

  const exploreDemo = () => {
    void cityAudio.unlock();
    cityAudio.play("enter");
    pulseEnter();
    window.setTimeout(() => {
      setGate("world");
      setEntered(true);
    }, 160);
  };

  return (
    <div
      className={`oxc-menu ${visible ? "is-in" : ""}`}
      style={{ ["--menu-accent" as string]: activeCity.accent }}
    >
      <CosmicBackdrop variant="cosmos" />
      <div className={`oxc-menu-flash ${flash ? "is-on" : ""}`} aria-hidden />

      <div className="oxc-menu-status" role="status">
        <span className="oxc-menu-status-dot" />
        <span>SYSTEM ONLINE</span>
        <span className="oxc-menu-status-sep" aria-hidden>
          ·
        </span>
        <span>{activeCity.name.toUpperCase()}</span>
        <span className="oxc-menu-status-sep oxc-hide-sm" aria-hidden>
          ·
        </span>
        <span className="oxc-hide-sm">HOLO BRIDGE v2</span>
      </div>

      <header className="oxc-menu-brand">
        <p className="oxc-menu-kicker">Orbit Gate · Command Bridge</p>
        <div className="oxc-menu-logo" aria-label="OrbitX City">
          <span className="oxc-menu-logo-orbit">
            Orbit<span className="oxc-menu-logo-x">X</span>
          </span>
          <span className="oxc-menu-logo-city">CITY</span>
        </div>
        <p className="oxc-menu-tag">Persistent crypto-native Midtown. Trade, launch, socialize, play.</p>
        <div className="oxc-menu-audio">
          <AudioToggle />
          <button
            type="button"
            className="oxc-btn ghost compact"
            onClick={() => {
              void cityAudio.unlock().then(() => {
                cityAudio.setMusicOn(true);
                cityAudio.setTheme("menu");
                cityAudio.play("confirm");
              });
            }}
          >
            Play theme
          </button>
          <button
            type="button"
            className="oxc-btn ghost compact"
            onClick={() => {
              void cityAudio.unlock();
              cityAudio.nextTrack();
            }}
            title="Next theme track"
          >
            Next song
          </button>
          <InstallCityPWA />
        </div>
      </header>

      <section className="oxc-menu-districts" aria-labelledby="oxc-district-label">
        <div className="oxc-menu-section-label" id="oxc-district-label">
          <span>Select district</span>
          <em>{activeCity.tagline}</em>
        </div>
        <div className="oxc-menu-cities" role="group" aria-label="City server">
          {ORBITX_CITIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`oxc-menu-city ${selectedCityId === c.id ? "on" : ""}`}
              style={{ ["--chip" as string]: c.accent }}
              onClick={() => {
                cityAudio.play("ui");
                setSelectedCityId(c.id as CityId);
              }}
              aria-pressed={selectedCityId === c.id}
            >
              <span>{c.name.replace(/^OrbitX\s+/i, "")}</span>
              <small>
                {selectedCityId === c.id ? "LIVE" : "READY"} · {FEATURES_PER_SYSTEM}
              </small>
            </button>
          ))}
        </div>
      </section>

      <div className="oxc-menu-cta">
        <button type="button" className="oxc-menu-enter" onClick={enterCharacters}>
          Enter OrbitX City
          <span aria-hidden>→</span>
        </button>
        <button type="button" className="oxc-menu-demo" onClick={exploreDemo}>
          Quick Demo Mode
        </button>
      </div>

      <nav className="oxc-menu-grid" aria-label="Main menu">
        {TILES.map((tile, i) => {
          const Icon = tile.icon;
          const uiIcon = TILE_UI_ICONS[tile.id];
          return (
            <button
              key={tile.id}
              type="button"
              className={`oxc-menu-tile ${tile.primary ? "is-primary" : ""}`}
              style={{
                animationDelay: `${80 + i * 40}ms`,
                ["--tile" as string]: tile.accent,
              }}
              onClick={() => onTile(tile)}
            >
              {tile.badge && <span className="oxc-menu-tile-badge">{tile.badge}</span>}
              <span className="oxc-menu-tile-icon">
                {uiIcon ? (
                  <img src={uiIcon} alt="" width={18} height={18} draggable={false} />
                ) : (
                  <Icon size={18} strokeWidth={2.2} />
                )}
              </span>
              <span className="oxc-menu-tile-copy">
                <span className="oxc-menu-tile-label">{tile.label}</span>
                <span className="oxc-menu-tile-blurb">{tile.blurb}</span>
              </span>
              <span className="oxc-menu-tile-frame" aria-hidden />
            </button>
          );
        })}
      </nav>

      <footer className="oxc-menu-foot">
        <span className="oxc-menu-meta">
          {isTouch
            ? "Joystick · Jump · Sprint · Tap E to interact"
            : "WASD · E interact · Shift sprint · Space jump"}
        </span>
        <p className="oxc-menu-powered">Powered by OrbitX · holographic bridge v2</p>
      </footer>
    </div>
  );
}
