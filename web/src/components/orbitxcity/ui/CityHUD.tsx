import { useEffect } from "react";
import { Link } from "react-router-dom";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { CityPanelHost, PANEL_NAV } from "./CityPanels";

export function CityHUD() {
  const { openPanel, closePanel, panel, prompt, interact, avatar, playerPos } = useCity();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyE") {
        e.preventDefault();
        interact();
      }
      if (e.code === "Escape") {
        e.preventDefault();
        closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact, closePanel]);

  return (
    <div className="oxc-hud">
      <header className="oxc-topbar">
        <div className="oxc-brand-lockup">
          <Link to="/" className="oxc-mini-brand">
            OrbitX<span>City</span>
          </Link>
          <div className="oxc-loc">
            <strong>{NYC_DEMO_BLOCK.name}</strong>
            <span>
              {playerPos.x.toFixed(0)}, {playerPos.z.toFixed(0)} · @{avatar.name}
            </span>
          </div>
        </div>
        <div className="oxc-top-actions">
          <WalletConnectButton />
        </div>
      </header>

      <nav className="oxc-dock" aria-label="City panels">
        {PANEL_NAV.map((item) => {
          const Icon = item.icon;
          const active = panel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`oxc-dock-btn ${active ? "active" : ""}`}
              onClick={() => (active ? closePanel() : openPanel(item.id))}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {prompt && (
        <div className="oxc-prompt">
          <div className="oxc-prompt-key">E</div>
          <div>
            <strong>{prompt.label}</strong>
            <span>{prompt.hint}</span>
          </div>
          <button type="button" className="oxc-btn primary compact" onClick={interact}>
            Interact
          </button>
        </div>
      )}

      <div className="oxc-help">
        <span>WASD / Arrows</span>
        <span>E Interact</span>
        <span>Esc Close</span>
      </div>

      <CityPanelHost />
    </div>
  );
}
