import { useMemo, useState } from "react";
import { GateFrame } from "./GateFrame";
import { MascotPortrait } from "./MascotPortrait";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { ORBITX_CITIES } from "@/lib/orbitxcity/cities";
import { resolveClassId } from "@/lib/orbitxcity/characterClasses";
import { CHARACTER_FLAVOR } from "@/lib/orbitxcity/characterFlavor";
import { resolveTitleTheme } from "@/lib/orbitxcity/titleTheme";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import type { CityId } from "@/lib/orbitxcity/types";

export function QuickPlayGate() {
  const { setGate, setEntered, setSelectedCityId, selectedCityId, avatar } = useCity();
  const [cityId, setCityId] = useState<CityId>(selectedCityId);
  const mascotId = resolveClassId(avatar.classId);
  const flavor = CHARACTER_FLAVOR[mascotId];
  const city = useMemo(
    () => ORBITX_CITIES.find((c) => c.id === cityId) ?? ORBITX_CITIES[0]!,
    [cityId],
  );

  const dropIn = () => {
    cityAudio.play("enter");
    setSelectedCityId(cityId);
    window.setTimeout(() => {
      setEntered(true);
    }, 80);
  };

  return (
    <GateFrame
      gate="quick"
      footer={
        <div className="oxc-chars-actions has-secondary">
          <button type="button" className="oxc-chars-cta oxc-chars-cta--primary" onClick={dropIn}>
            Drop into {city.name.replace(/^OrbitX\s+/i, "")}
          </button>
          <button type="button" className="oxc-chars-cta oxc-chars-cta--ghost" onClick={() => setGate("characters")}>
            Change mascot
          </button>
        </div>
      }
    >
      <div className="oxc-quick">
        <section className="oxc-quick-mascot" aria-label="Current mascot">
          <div className="oxc-quick-mascot-fig">
            <MascotPortrait id={mascotId} />
          </div>
          <div>
            <p className="oxc-gate-kicker">You drop in as</p>
            <h2>{avatar.name || mascotId}</h2>
            <p>
              {flavor.handle} · {flavor.perk}
            </p>
          </div>
        </section>

        <div className="oxc-quick-grid" role="listbox" aria-label="District drop-in">
          {ORBITX_CITIES.map((c) => {
            const theme = resolveTitleTheme(c.id);
            const on = c.id === cityId;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`oxc-quick-card ${on ? "is-on" : ""}`}
                style={{ ["--card-accent" as string]: theme.uiAccent }}
                onClick={() => {
                  cityAudio.play("ui");
                  setCityId(c.id);
                  setSelectedCityId(c.id);
                }}
              >
                <span className="oxc-quick-card-kicker">{c.id.toUpperCase()}</span>
                <strong>{c.name.replace(/^OrbitX\s+/i, "")}</strong>
                <em>{c.tagline}</em>
                <span>{c.purpose}</span>
              </button>
            );
          })}
        </div>
      </div>
    </GateFrame>
  );
}
