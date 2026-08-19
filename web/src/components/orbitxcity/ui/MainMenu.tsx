/**
 * OrbitX City — console title screen.
 * Cinematic 3D skyline + extruded metallic nav. No tile dashboard, no arcade lime.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import type { CityId } from "@/lib/orbitxcity/types";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { TITLE_NAV, resolveTitleTheme, titleCssVars, type TitleNavId } from "@/lib/orbitxcity/titleTheme";
import { MenuBackdrop } from "./MenuBackdrop";
import { Menu3DButton, Menu3DChip } from "./Menu3DButton";
import { AudioToggle } from "./AudioToggle";
import { InstallCityPWA } from "./InstallCityPWA";

export function MainMenu() {
  const { setGate, setEntered, selectedCityId, setSelectedCityId } = useCity();
  const [visible, setVisible] = useState(false);
  const [flash, setFlash] = useState(false);
  const [focus, setFocus] = useState<TitleNavId>("play");
  const [isTouch, setIsTouch] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
  );

  const activeCity = ORBITX_CITIES.find((c) => c.id === selectedCityId) ?? ORBITX_CITIES[0]!;
  const theme = resolveTitleTheme(selectedCityId);
  const cssVars = useMemo(() => titleCssVars(theme) as CSSProperties, [theme]);

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

  const run = (id: TitleNavId) => {
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
        cityAudio.play("ui");
        pulse();
        window.setTimeout(() => setGate("settings"), 140);
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
    <div className={`oxc-menu oxc-menu--title ${visible ? "is-in" : ""}`} style={cssVars}>
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
          <p className="oxc-menu-kicker">OrbitX World · Live District</p>
          <div className="oxc-menu-logo" aria-label="OrbitX City">
            <span className="oxc-menu-logo-orbit">
              Orbit<span className="oxc-menu-logo-x">X</span>
            </span>
            <span className="oxc-menu-logo-city">CITY</span>
          </div>
          <p className="oxc-menu-tag">Financial hub. Walk Midtown. Trade. Launch. Play.</p>
        </header>

        <section className="oxc-menu-districts" aria-labelledby="oxc-district-label">
          <div className="oxc-menu-section-label" id="oxc-district-label">
            <span>District</span>
            <em>{activeCity.name.replace(/^OrbitX\s+/i, "")}</em>
          </div>
          <div className="oxc-menu-cities" role="group" aria-label="City server">
            {ORBITX_CITIES.map((c) => (
              <Menu3DChip
                key={c.id}
                label={c.name.replace(/^OrbitX\s+/i, "")}
                accent={resolveTitleTheme(c.id).uiAccent}
                active={selectedCityId === c.id}
                onClick={() => {
                  cityAudio.play("ui");
                  setSelectedCityId(c.id as CityId);
                }}
              />
            ))}
          </div>
        </section>

        <nav className="oxc-menu-rail oxc-menu-rail--3d" aria-label="Main menu">
          {TITLE_NAV.map((item, i) => (
            <Menu3DButton
              key={item.id}
              label={item.label}
              hint={item.hint}
              primary={item.primary}
              focused={focus === item.id}
              delayMs={90 + i * 55}
              accent={item.primary ? theme.key : theme.uiAccent}
              onFocus={() => setFocus(item.id)}
              onClick={() => run(item.id)}
            />
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
