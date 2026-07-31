/**
 * OrbitX City — Console title screen.
 * Full-bleed city art + brand + vertical nav. No tile dashboard.
 */
import { useEffect, useState } from "react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import type { CityId } from "@/lib/orbitxcity/types";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { MenuBackdrop } from "./MenuBackdrop";
import { AudioToggle } from "./AudioToggle";
import { InstallCityPWA } from "./InstallCityPWA";

type NavId = "play" | "multiplayer" | "settings" | "quick";

const NAV: { id: NavId; label: string; hint: string; primary?: boolean }[] = [
  { id: "play", label: "Play", hint: "Choose operative", primary: true },
  { id: "multiplayer", label: "Multiplayer", hint: "Lobbies & rooms" },
  { id: "settings", label: "Settings", hint: "Audio · quality · touch" },
  { id: "quick", label: "Quick Play", hint: "Skip setup · demo" },
];

export function MainMenu() {
  const { setGate, setEntered, openPanel, selectedCityId, setSelectedCityId } = useCity();
  const [visible, setVisible] = useState(false);
  const [flash, setFlash] = useState(false);
  const [focus, setFocus] = useState<NavId>("play");
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

  const pulse = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 550);
  };

  const run = (id: NavId) => {
    void cityAudio.unlock();
    setFocus(id);
    switch (id) {
      case "play":
        cityAudio.play("confirm");
        pulse();
        window.setTimeout(() => setGate("characters"), 160);
        break;
      case "multiplayer":
        cityAudio.play("confirm");
        pulse();
        window.setTimeout(() => setGate("lobbies"), 160);
        break;
      case "settings":
        cityAudio.play("enter");
        pulse();
        setGate("world");
        setEntered(true);
        openPanel("settings");
        break;
      case "quick":
        cityAudio.play("enter");
        pulse();
        window.setTimeout(() => {
          setGate("world");
          setEntered(true);
        }, 140);
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={`oxc-menu ${visible ? "is-in" : ""}`}
      style={{ ["--menu-accent" as string]: activeCity.accent }}
    >
      <MenuBackdrop cityId={selectedCityId} intensity="title" />
      <div className={`oxc-menu-flash ${flash ? "is-on" : ""}`} aria-hidden />

      <div className="oxc-menu-corner oxc-menu-corner--left">
        <AudioToggle />
        <button
          type="button"
          className="oxc-menu-iconbtn"
          onClick={() => {
            void cityAudio.unlock();
            cityAudio.nextTrack();
          }}
          title="Next theme track"
          aria-label="Next song"
        >
          ♫
        </button>
      </div>
      <div className="oxc-menu-corner oxc-menu-corner--right">
        <InstallCityPWA />
      </div>

      <div className="oxc-menu-stage">
        <header className="oxc-menu-brand">
          <p className="oxc-menu-kicker">OrbitX · Live District</p>
          <div className="oxc-menu-logo" aria-label="OrbitX City">
            <span className="oxc-menu-logo-orbit">
              Orbit<span className="oxc-menu-logo-x">X</span>
            </span>
            <span className="oxc-menu-logo-city">CITY</span>
          </div>
          <p className="oxc-menu-tag">{activeCity.tagline}. Walk Midtown. Trade. Launch. Play.</p>
        </header>

        <section className="oxc-menu-districts" aria-labelledby="oxc-district-label">
          <div className="oxc-menu-section-label" id="oxc-district-label">
            <span>District</span>
            <em>{activeCity.name.replace(/^OrbitX\s+/i, "")}</em>
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
              </button>
            ))}
          </div>
        </section>

        <nav className="oxc-menu-rail" aria-label="Main menu">
          {NAV.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`oxc-menu-rail-item ${item.primary ? "is-primary" : ""} ${focus === item.id ? "is-focus" : ""}`}
              style={{ animationDelay: `${90 + i * 55}ms` }}
              onMouseEnter={() => setFocus(item.id)}
              onFocus={() => setFocus(item.id)}
              onClick={() => run(item.id)}
            >
              <span className="oxc-menu-rail-marker" aria-hidden>
                {focus === item.id ? "▸" : "·"}
              </span>
              <span className="oxc-menu-rail-copy">
                <span className="oxc-menu-rail-label">{item.label}</span>
                <span className="oxc-menu-rail-hint">{item.hint}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <footer className="oxc-menu-foot">
        <span className="oxc-menu-meta">
          {isTouch
            ? "Joystick · Jump · Sprint · Tap E to interact"
            : "WASD · E interact · Shift sprint · Space jump"}
        </span>
      </footer>
    </div>
  );
}
