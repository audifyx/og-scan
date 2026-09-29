import { useEffect, useState } from "react";
import WallpaperCanvas from "./WallpaperCanvas";
import {
  getScreensaverScene,
  getScreensaverTimeout,
  useIdle,
  type ScreensaverScene,
} from "../themes/screensaver";

/**
 * Idle screensaver host (ideas 30 + 31).
 *   "orbiting" — tokens orbiting a core
 *   "flyover"  — neon city flyover canvas (reuses the wallpaper engine scene)
 * Any input dismisses (the useIdle hook re-arms on activity).
 */

const TOKENS = ["◉", "◎", "⬢", "◆", "⬣", "⬔"];

function OrbitingScene() {
  const rings = [
    { size: "62%", dur: "14s", tokens: 5, reverse: false },
    { size: "84%", dur: "22s", tokens: 7, reverse: true },
    { size: "104%", dur: "32s", tokens: 9, reverse: false },
  ];
  return (
    <div className="osh-ss-orbit">
      <div className="osh-ss-core" />
      {rings.map((r, ri) => (
        <div
          key={ri}
          className="osh-ss-ring"
          style={{
            width: r.size, height: r.size, inset: 0, margin: "auto",
            animationDuration: r.dur,
            animationDirection: r.reverse ? "reverse" : "normal",
          }}
        >
          {Array.from({ length: r.tokens }).map((_, i) => {
            const ang = (i / r.tokens) * Math.PI * 2;
            return (
              <span
                key={i}
                className="osh-ss-token"
                style={{
                  transform: `rotate(${ang}rad) translateX(calc(min(78vmin,560px) * ${[0.31, 0.42, 0.52][ri]})) rotate(${-ang}rad)`,
                }}
              >
                {TOKENS[(ri * 3 + i) % TOKENS.length]}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function FlyoverScene() {
  // City flyover scene, forced regardless of the wallpaper setting.
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <WallpaperCanvas forceScene="cityflyover" />
    </div>
  );
}

export default function Screensaver() {
  const [scene, setScene] = useState<ScreensaverScene>(getScreensaverScene);
  const [timeoutMin, setTimeoutMin] = useState(getScreensaverTimeout);
  const idle = useIdle(timeoutMin, scene === "off");

  useEffect(() => {
    const fn = () => {
      setScene(getScreensaverScene());
      setTimeoutMin(getScreensaverTimeout());
    };
    window.addEventListener("orbitx:screensaver", fn);
    return () => window.removeEventListener("orbitx:screensaver", fn);
  }, []);

  if (!idle || scene === "off") return null;
  return (
    <div className="osh-screensaver" aria-hidden>
      {scene === "orbiting" ? <OrbitingScene /> : <FlyoverScene />}
      <div className="osh-ss-hint">MOVE TO WAKE</div>
    </div>
  );
}
