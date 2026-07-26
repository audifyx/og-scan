import { useEffect, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2, Gem, Sparkles, Users } from "lucide-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { fetchCityMarketSnapshot, fmtPct } from "@/lib/orbitxcity/marketData";
import { emptySnapshotGetter, noopSubscribe } from "@/lib/orbitxcity/realtime";
import { CityPanelHost, PANEL_NAV } from "./CityPanels";
import { Minimap } from "./Minimap";
import { TouchControls } from "./TouchControls";
import { ChatToastHost } from "./ChatToastHost";

function TickerBar() {
  const { data } = useQuery({
    queryKey: ["orbitxcity-market"],
    queryFn: fetchCityMarketSnapshot,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const rows = data?.trending ?? [];
  if (rows.length === 0) return null;
  const loop = [...rows, ...rows];

  return (
    <div className="oxc-tickerbar" aria-hidden>
      <div className="oxc-ticker-track">
        {loop.map((r, i) => {
          const ch = Number(r.change24h);
          return (
            <span key={`${r.symbol ?? "?"}-${i}`} className="oxc-tick-item">
              <b>${(r.symbol ?? "???").toUpperCase()}</b>
              <em className={Number.isFinite(ch) && ch < 0 ? "down" : "up"}>{fmtPct(r.change24h)}</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function OnlineBadge() {
  const { realtime } = useCity();
  const snap = useSyncExternalStore(
    realtime?.subscribe ?? noopSubscribe,
    realtime?.getSnapshot ?? emptySnapshotGetter,
  );
  return (
    <div className="oxc-online" title={snap.connected ? "Realtime connected" : "Local / connecting"}>
      <Users className="h-3.5 w-3.5" />
      <span>{snap.online}</span>
      <i className={snap.connected ? "on" : ""} />
    </div>
  );
}

export function CityHUD() {
  const {
    openPanel,
    closePanel,
    panel,
    prompt,
    interact,
    avatar,
    playerPos,
    shards,
    touchControls,
    setTouchControls,
    quality,
    setQuality,
    triggerEmote,
    exitToMenu,
    lobby,
  } = useCity();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyE") {
        e.preventDefault();
        interact();
      }
      if (e.code === "KeyB") {
        e.preventDefault();
        triggerEmote();
      }
      if (e.code === "Enter") {
        e.preventDefault();
        openPanel("chat");
      }
      if (e.code === "Escape") {
        e.preventDefault();
        closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact, closePanel, openPanel, triggerEmote]);

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
          <button
            type="button"
            className="oxc-lobby-chip"
            onClick={() => openPanel("lobbies")}
            title={lobby.label}
          >
            <span>{lobby.label}</span>
          </button>
          <button
            type="button"
            className="oxc-toggle-btn"
            onClick={exitToMenu}
            title="Return to main menu"
          >
            Menu
          </button>
          <button
            type="button"
            className={`oxc-toggle-btn ${touchControls ? "on" : ""}`}
            onClick={() => setTouchControls(!touchControls)}
            title={touchControls ? "Hide touch controls" : "Show touch controls"}
            aria-pressed={touchControls}
          >
            <Gamepad2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={`oxc-toggle-btn ${quality === "high" ? "on" : ""}`}
            onClick={() => setQuality(quality === "high" ? "lite" : "high")}
            title={`Graphics: ${quality === "high" ? "High (FX on)" : "Lite (fast)"}`}
            aria-pressed={quality === "high"}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
          <OnlineBadge />
          <div className="oxc-shards" title="OBX shards collected">
            <Gem className="h-3.5 w-3.5" />
            <span>{shards}</span>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      <TickerBar />
      <Minimap />

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
        <span>WASD · Shift sprint · Space jump · B dance</span>
        <span>E Interact / Exit · Enter Chat · Esc Close</span>
      </div>

      {touchControls && <TouchControls />}

      <ChatToastHost />
      <CityPanelHost />
    </div>
  );
}
