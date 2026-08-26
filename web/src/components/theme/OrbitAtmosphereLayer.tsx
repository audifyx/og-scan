import { useLocation } from "react-router-dom";
import { BackgroundFX, BgCustomizeModal } from "@/components/BackgroundFX";
import { useOrbitAtmosphere } from "@/hooks/useOrbitAtmosphere";
import "./platform-shell.css";

/** Routes that keep their own full-bleed brand art (no shared FX). */
const EXCLUDE_PREFIXES = [
  "/",
  "/splash",
  "/beta",
  "/Orbitxcity",
  "/orbitxcity",
  "/AI",
  "/ai",
  "/os",
  "/play",
  "/embed",
  "/auth",
  "/app",
  "/hub",
  "/on-chain",
  "/education",
];

function shouldShowAtmosphere(pathname: string): boolean {
  if (pathname === "/") return false;
  return !EXCLUDE_PREFIXES.some((p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`)));
}

/**
 * Global Hub wallpaper / animated FX behind every platform route.
 * Theme is the same one you pick on /app → Account → Wallpaper.
 */
export function OrbitAtmosphereLayer() {
  const { pathname } = useLocation();
  const { mode, wallpaper, setMode, setWallpaper, themeOpen, closeTheme } = useOrbitAtmosphere();
  const show = shouldShowAtmosphere(pathname);

  return (
    <>
      {show && (
        <div className="ox-atmosphere" aria-hidden>
          <BackgroundFX mode={mode} wallpaper={wallpaper} />
          <div className="ox-atmosphere__veil" />
        </div>
      )}
      <BgCustomizeModal
        open={themeOpen}
        mode={mode}
        hasWallpaper={!!wallpaper}
        onClose={closeTheme}
        onMode={setMode}
        onWallpaper={setWallpaper}
      />
    </>
  );
}
