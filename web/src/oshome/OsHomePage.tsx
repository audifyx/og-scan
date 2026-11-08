import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair, X } from "lucide-react";
import "./oshome.css";
import { useDeviceTheme } from "../themes/DeviceThemeProvider";
import { LayoutSwitch, Launcher, useIsMobile, useOrderedApps } from "./layouts";
import ThemePicker from "./ThemePicker";
import type { OsHomeApp } from "./appsCatalog";
import { isValidMint } from "../crypto/api/client";

/**
 * Scanner v2 quick-scan strip — prominent placement on the OS home:
 * paste a mint, jump straight into /intel/scanner-v2. Black background,
 * white text, gold accent — high contrast at any width, 390px included
 * (input flexes, button never wraps below it).
 */
function ScannerQuickStrip() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const valid = isValidMint(draft.trim());
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        justifyContent: "center",
        padding: "8px 12px 4px",
        position: "relative",
        zIndex: 2,
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) navigate(`/intel/scanner-v2/${draft.trim()}`);
        }}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#050505",
          border: "1px solid rgba(232, 184, 74, 0.55)",
          borderRadius: 14,
          padding: "8px 10px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
          <Crosshair style={{ width: 18, height: 18, color: "#e8b84a", flexShrink: 0 }} aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Scan a token — paste mint address…"
            spellCheck={false}
            aria-label="Token mint address to scan"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#ffffff",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={!valid}
            style={{
              flexShrink: 0,
              background: valid ? "#e8b84a" : "#3a3a3a",
              color: valid ? "#000000" : "#9a9a9a",
              border: "none",
              borderRadius: 9,
              padding: "7px 14px",
              fontWeight: 800,
              fontSize: 13,
              cursor: valid ? "pointer" : "default",
              whiteSpace: "nowrap",
            }}
          >
            Scan
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "#d7d7d7" }}>
          <button
            type="button"
            onClick={() => navigate("/intel/scanner-v2")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "#e8b84a",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Open OG Scanner v2
          </button>
          {"  "}· live risk, bundle map, dev lineage — free, every check sourced.
        </div>
      </form>
    </div>
  );
}

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
        <ScannerQuickStrip />
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
