import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Ellipsis,
  Gamepad2,
  Gem,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { getNearestLandmark, getWorldBlock } from "@/lib/orbitxcity/worlds";
import { fetchCityMarketSnapshot, fmtPct } from "@/lib/orbitxcity/marketData";
import { emptySnapshotGetter, noopSubscribe } from "@/lib/orbitxcity/realtime";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { CityPanelHost, MOBILE_DOCK, MORE_PANELS, PANEL_NAV } from "./CityPanels";
import { Minimap } from "./Minimap";
import { TouchControls } from "./TouchControls";
import { ChatToastHost } from "./ChatToastHost";
import { AudioToggle } from "./AudioToggle";

function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return phone;
}

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

function InstallChip() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred || hidden) return null;
  return (
    <button
      type="button"
      className="oxc-toggle-btn on"
      title="Install OrbitX app"
      onClick={async () => {
        try {
          await deferred.prompt();
          await deferred.userChoice;
        } catch {
          /* ignore */
        }
        setDeferred(null);
      }}
    >
      <Download className="h-3.5 w-3.5" />
      <span className="oxc-install-label">Install</span>
    </button>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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
    selectedCityId,
    resetPlayer,
  } = useCity();
  const isPhone = useIsPhone();
  const [moreOpen, setMoreOpen] = useState(false);
  const block = getWorldBlock(selectedCityId);
  const nearest = useMemo(() => getNearestLandmark(block, playerPos), [block, playerPos]);
  const locationName = nearest.label;
  const locationDetail = `${Math.round(nearest.dist)}m · ${block.name}`;

  const dockItems = useMemo(
    () => (isPhone ? MOBILE_DOCK : PANEL_NAV),
    [isPhone],
  );

  useEffect(() => {
    if (!isPhone) return;
    // Phones always need the on-screen stick unless the player hides it.
    if (!touchControls) setTouchControls(true);
  }, [isPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyE") {
        e.preventDefault();
        cityAudio.play("interact");
        interact();
      }
      if (e.code === "KeyB") {
        e.preventDefault();
        cityAudio.play("whoosh");
        triggerEmote();
      }
      if (e.code === "Enter") {
        e.preventDefault();
        cityAudio.play("ui");
        openPanel("chat");
      }
      if (e.code === "Escape") {
        e.preventDefault();
        cityAudio.play("ui");
        setMoreOpen(false);
        closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact, closePanel, openPanel, triggerEmote]);

  useEffect(() => {
    if (panel !== "none") setMoreOpen(false);
  }, [panel]);

  return (
    <div className={`oxc-hud ${touchControls ? "oxc-hud--touch" : ""} ${isPhone ? "oxc-hud--phone" : ""}`}>
      <header className="oxc-topbar">
        <div className="oxc-brand-lockup">
          <Link to="/" className="oxc-mini-brand">
            OrbitX<span>City</span>
          </Link>
          <div className="oxc-loc">
            <strong>{locationName}</strong>
            <span className="oxc-loc-detail">
              {locationDetail} · {playerPos.x.toFixed(0)}, {playerPos.z.toFixed(0)} · @{avatar.name}
            </span>
            <span className="oxc-loc-mobile">{locationName}</span>
          </div>
        </div>

        <div className="oxc-top-actions">
          <div className="oxc-shards" title="OBX shards collected">
            <Gem className="h-3.5 w-3.5" />
            <span>{shards}</span>
          </div>

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
            className="oxc-toggle-btn"
            onClick={() => {
              cityAudio.play("ui");
              resetPlayer();
            }}
            title="Unstuck — return to district spawn"
          >
            Stuck?
          </button>

          {/* Desktop / tablet extras */}
          <button
            type="button"
            className="oxc-lobby-chip oxc-hide-phone"
            onClick={() => openPanel("lobbies")}
            title={lobby.label}
          >
            <span>{lobby.label}</span>
          </button>
          <button
            type="button"
            className={`oxc-toggle-btn oxc-hide-phone ${touchControls ? "on" : ""}`}
            onClick={() => setTouchControls(!touchControls)}
            title={touchControls ? "Hide touch controls" : "Show touch controls"}
            aria-pressed={touchControls}
          >
            <Gamepad2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={`oxc-toggle-btn oxc-hide-phone ${quality === "high" ? "on" : ""}`}
            onClick={() => setQuality(quality === "high" ? "lite" : "high")}
            title={`Graphics: ${quality === "high" ? "High" : "Lite"}`}
            aria-pressed={quality === "high"}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
          <span className="oxc-hide-phone">
            <AudioToggle />
          </span>
          <span className="oxc-hide-phone">
            <OnlineBadge />
          </span>
          <div className="oxc-wallet-slot oxc-hide-phone">
            <WalletConnectButton />
          </div>

          {/* Phone: one overflow button instead of a crowded top bar */}
          <button
            type="button"
            className={`oxc-toggle-btn oxc-show-phone ${moreOpen ? "on" : ""}`}
            aria-label="More"
            aria-expanded={moreOpen}
            onClick={() => {
              cityAudio.play("ui");
              setMoreOpen((v) => !v);
            }}
          >
            {moreOpen ? <X className="h-3.5 w-3.5" /> : <Ellipsis className="h-3.5 w-3.5" />}
          </button>
        </div>
      </header>

      {moreOpen && (
        <div className="oxc-more-sheet" role="dialog" aria-label="More controls">
          <div className="oxc-more-grid">
            {MORE_PANELS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="oxc-more-btn"
                  onClick={() => {
                    cityAudio.play("ui");
                    setMoreOpen(false);
                    openPanel(item.id);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="oxc-more-tools">
            <InstallChip />
            <button
              type="button"
              className={`oxc-toggle-btn ${quality === "high" ? "on" : ""}`}
              onClick={() => setQuality(quality === "high" ? "lite" : "high")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {quality === "high" ? "High FX" : "Lite FX"}
            </button>
            <button
              type="button"
              className={`oxc-toggle-btn ${touchControls ? "on" : ""}`}
              onClick={() => setTouchControls(!touchControls)}
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              Touch
            </button>
            <AudioToggle />
            <OnlineBadge />
            <button type="button" className="oxc-toggle-btn" onClick={() => { setMoreOpen(false); openPanel("lobbies"); }}>
              Lobby
            </button>
            <button type="button" className="oxc-toggle-btn" onClick={() => { setMoreOpen(false); openPanel("settings"); }}>
              Settings
            </button>
            <div className="oxc-more-wallet">
              <WalletConnectButton />
            </div>
          </div>
        </div>
      )}

      <div className="oxc-ticker-wrap">
        <TickerBar />
      </div>
      <Minimap />

      <nav className="oxc-dock" aria-label="City panels">
        {dockItems.map((item) => {
          const Icon = item.icon;
          const active = panel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`oxc-dock-btn ${active ? "active" : ""}`}
              onClick={() => {
                cityAudio.play("ui");
                active ? closePanel() : openPanel(item.id);
              }}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
        {isPhone && (
          <button
            type="button"
            className={`oxc-dock-btn ${moreOpen ? "active" : ""}`}
            onClick={() => {
              cityAudio.play("ui");
              setMoreOpen((v) => !v);
            }}
          >
            <Ellipsis className="h-4 w-4" />
            <span>More</span>
          </button>
        )}
      </nav>

      {prompt && (
        <div className="oxc-prompt">
          <div className="oxc-prompt-key">E</div>
          <div className="oxc-prompt-copy">
            <strong>{prompt.label}</strong>
            <span>{prompt.hint}</span>
          </div>
          <button type="button" className="oxc-btn primary compact" onClick={interact}>
            Go
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
