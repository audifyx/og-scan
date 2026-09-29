import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import "./oshome.css";
import { useDeviceTheme } from "../themes/DeviceThemeProvider";
import { LayoutSwitch, Launcher, useIsMobile, useOrderedApps } from "./layouts";
import ThemePicker from "./ThemePicker";
import type { OsHomeApp } from "./appsCatalog";

/**
 * OrbitX OS Home — the `/` route.
 * An OS-style home screen: every app on the platform, draggable icons,
 * launcher (⌘K), live clock, wallpapers, and the theme engine picker.
 * The visible layout is driven by the active device theme.
 */
export default function OsHomePage() {
  const navigate = useNavigate();
  const { deviceTheme } = useDeviceTheme();
  const [apps, setOrder] = useOrderedApps();
  const isMobile = useIsMobile();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [booted, setBooted] = useState(false);

  const launch = useCallback((a: OsHomeApp) => navigate(a.href), [navigate]);
  const reorder = useCallback((ids: string[]) => setOrder(ids), [setOrder]);
  const openLauncher = useCallback(() => setLauncherOpen(true), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setLauncherOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  return (
    <div className="osh-root">
      {!booted && (
        <div className="osh-boot" aria-hidden>
          <div className="osh-boot-logo">ORBITX</div>
          <div className="osh-boot-bar"><i /></div>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", opacity: 0.7 }}>LOADING SYSTEM</div>
        </div>
      )}
      <div className="osh-wallpaper" aria-hidden />
      <div className="osh-stage">
        <LayoutSwitch
          layout={deviceTheme.layout}
          themeId={deviceTheme.id}
          apps={apps}
          onLaunch={launch}
          onOpenLauncher={openLauncher}
          onOpenSettings={openSettings}
          onReorder={reorder}
          isMobile={isMobile}
        />
      </div>

      <Launcher open={launcherOpen} onClose={() => setLauncherOpen(false)} onLaunch={launch} />

      {settingsOpen && (
        <div className="osh-settings" onClick={() => setSettingsOpen(false)} role="dialog" aria-label="System themes">
          <div className="osh-settings-card" onClick={(e) => e.stopPropagation()}>
            <div className="osh-settings-head">
              <h2>System Themes</h2>
              <button className="osh-x-btn" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--dt-muted)" }}>
              Device theme re-skins the whole platform — every app, every route. Background and
              accent are independent.
            </p>
            <ThemePicker />
          </div>
        </div>
      )}
    </div>
  );
}
