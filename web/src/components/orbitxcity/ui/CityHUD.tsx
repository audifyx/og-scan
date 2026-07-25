import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Volume2, VolumeX, Gem } from "lucide-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { citySound } from "@/lib/orbitxcity/sound";
import { CityPanelHost, PANEL_NAV } from "./CityPanels";
import { Minimap } from "./Minimap";

export function CityHUD() {
  const {
    openPanel,
    closePanel,
    panel,
    prompt,
    interact,
    avatar,
    playerPos,
    soundEnabled,
    toggleSound,
    shardsCollected,
    shardTotal,
  } = useCity();

  const allShards = shardTotal > 0 && shardsCollected >= shardTotal;

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
        citySound.play("close");
        closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact, closePanel]);

  // Resume the ambient drone if sound is enabled (e.g. after a reload).
  useEffect(() => {
    if (soundEnabled) citySound.startAmbient();
    return () => citySound.stopAmbient();
  }, [soundEnabled]);

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
          <div className={`oxc-shard-count ${allShards ? "done" : ""}`} title="$OBX shards collected">
            <Gem className="h-4 w-4" />
            <span>{shardsCollected}/{shardTotal}</span>
          </div>
          <button
            type="button"
            className="oxc-icon-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
            title={soundEnabled ? "Sound on" : "Sound off"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <WalletConnectButton />
        </div>
      </header>

      <Minimap />

      {allShards && (
        <div className="oxc-toast" role="status">
          <Gem className="h-4 w-4" /> All {shardTotal} $OBX shards collected — nice run!
        </div>
      )}

      <nav className="oxc-dock" aria-label="City panels">
        {PANEL_NAV.map((item) => {
          const Icon = item.icon;
          const active = panel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`oxc-dock-btn ${active ? "active" : ""}`}
              onPointerEnter={() => citySound.play("hover")}
              onClick={() => {
                if (active) {
                  citySound.play("close");
                  closePanel();
                } else {
                  openPanel(item.id);
                }
              }}
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
