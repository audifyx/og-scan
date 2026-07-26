/**
 * OrbitX City ΓÇö Main Game Menu (AAA).
 * Full-bleed brand + glass tile grid over cosmic field.
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
  icon: LucideIcon;
  primary?: boolean;
}

const TILES: MenuTile[] = [
  { id: "play", label: "Play", icon: Play, primary: true },
  { id: "characters", label: "Characters", icon: Users },
  { id: "lobbies", label: "Lobbies", icon: RadioTower },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "missions", label: "Missions", icon: Crosshair },
  { id: "leaderboards", label: "Leaderboards", icon: Trophy },
  { id: "friends", label: "Friends", icon: UserPlus },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "events", label: "Events", icon: CalendarDays },
];

export function MainMenu() {
  const { setGate, setEntered, openPanel, selectedCityId, setSelectedCityId } = useCity();
  const [visible, setVisible] = useState(false);
  const [isTouch, setIsTouch] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
  );

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

  const onTile = (tile: MenuTile) => {
    void cityAudio.unlock();
    cityAudio.play(tile.primary ? "confirm" : "ui");
    switch (tile.id) {
      case "play":
      case "characters":
        setGate("characters");
        break;
      case "lobbies":
        setGate("lobbies");
        break;
      case "marketplace":
        cityAudio.play("enter");
        setGate("world");
        setEntered(true);
        openPanel("marketplace");
        break;
      case "inventory":
        cityAudio.play("enter");
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
        setGate("world");
        setEntered(true);
        openPanel(tile.id);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`oxc-menu ${visible ? "is-in" : ""}`}>
      <CosmicBackdrop variant="cosmos" />

      <header className="oxc-menu-brand">
        <div className="oxc-menu-logo" aria-label="OrbitX City">
          <span className="oxc-menu-logo-orbit">
            Orbit<span className="oxc-menu-logo-x">X</span>
          </span>
          <span className="oxc-menu-logo-city">CITY</span>
        </div>
        <p className="oxc-menu-tag">Enter a persistent crypto-native city.</p>
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

      <div className="oxc-menu-cities" role="group" aria-label="City server">
        {ORBITX_CITIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`oxc-menu-city ${selectedCityId === c.id ? "on" : ""}`}
            style={{ ["--chip" as string]: c.accent }}
            onClick={() => setSelectedCityId(c.id as CityId)}
          >
            <span>{c.name}</span>
            <small>{selectedCityId === c.id ? "LIVE" : "READY"}</small>
          </button>
        ))}
      </div>

      <nav className="oxc-menu-grid" aria-label="Main menu">
        {TILES.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              className={`oxc-menu-tile ${tile.primary ? "is-primary" : ""}`}
              style={{ animationDelay: `${80 + i * 45}ms` }}
              onClick={() => onTile(tile)}
            >
              <span className="oxc-menu-tile-icon">
                <Icon size={20} strokeWidth={2.2} />
              </span>
              <span className="oxc-menu-tile-label">{tile.label}</span>
              <span className="oxc-menu-tile-frame" aria-hidden />
            </button>
          );
        })}
      </nav>

      <footer className="oxc-menu-foot">
        <button
          type="button"
          className="oxc-menu-demo"
          onClick={() => {
            cityAudio.play("enter");
            setGate("world");
            setEntered(true);
          }}
        >
          Explore demo
        </button>
        <span className="oxc-menu-meta">
          {isTouch
            ? "Joystick ┬╖ Jump ┬╖ Sprint ┬╖ Tap E to interact"
            : "WASD ┬╖ E interact ┬╖ Shift sprint ┬╖ Space jump"}
        </span>
      </footer>
    </div>
  );
}
