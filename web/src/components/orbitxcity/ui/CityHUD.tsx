import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Coins,
  Download,
  Ellipsis,
  Flag,
  Gamepad2,
  Gem,
  LogOut,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Star,
  Timer,
  Users,
  X,
} from "lucide-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { getNearestLandmark, getWorldBlock } from "@/lib/orbitxcity/worlds";
import { fetchCityMarketSnapshot, fmtPct } from "@/lib/orbitxcity/marketData";
import { fetchTokenDetail } from "@/lib/orbitxcity/tokenApi";
import { emptySnapshotGetter, noopSubscribe } from "@/lib/orbitxcity/realtime";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { resetVirtualInput } from "@/lib/orbitxcity/input";
import { useMissionStore } from "@/lib/orbitxcity/missionStore";
import { objectiveProgressLabel, currentObjective } from "@/lib/orbitxcity/missions";
import { useEconomyStore } from "@/lib/orbitxcity/economyStore";
import { heatStars, useGameStore } from "@/lib/orbitxcity/gameStore";
import { CityPanelHost, MOBILE_DOCK, MORE_PANELS, PANEL_NAV } from "./CityPanels";
import { Minimap } from "./Minimap";
import { TouchControls } from "./TouchControls";
import { ChatToastHost } from "./ChatToastHost";
import { AudioToggle } from "./AudioToggle";

/** Official ORBITX mint (orbitx.world) — read-only price display. */
const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

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

/** Read-only ORBITX price chip — display only, payouts are game credits. */
function OrbitxPriceChip() {
  const { data } = useQuery({
    queryKey: ["orbitxcity-orbitx-price"],
    queryFn: () => fetchTokenDetail(ORBITX_MINT),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
  const price = data?.priceUsd;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return (
    <span
      className="oxc-shards"
      title="Live ORBITX price (read-only)"
      style={{ borderColor: "rgba(255,210,63,0.4)" }}
    >
      <Coins className="h-3.5 w-3.5" style={{ color: "#ffd23f" }} />
      <span>ORBITX ${price < 0.01 ? price.toFixed(5) : price.toFixed(3)}</span>
    </span>
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

const glass: React.CSSProperties = {
  background: "rgba(6, 8, 14, 0.82)",
  border: "1px solid rgba(61, 231, 255, 0.18)",
  borderRadius: 12,
  backdropFilter: "blur(8px)",
};

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Health / heat / credits cluster. */
function VitalsCluster() {
  const health = useGameStore((s) => s.health);
  const heat = useGameStore((s) => s.heat);
  const credits = useEconomyStore((s) => s.credits);
  const stars = heatStars(heat);
  const hpColor = health > 55 ? "#17ff4d" : health > 25 ? "#ffd23f" : "#ff3b5c";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ ...glass, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: "#8b93a3", marginBottom: 4 }}>HP</div>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div
              style={{
                width: `${health}%`,
                height: "100%",
                background: hpColor,
                transition: "width 0.25s",
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: hpColor, minWidth: 30, textAlign: "right" }}>
          {Math.round(health)}
        </div>
      </div>
      <div style={{ ...glass, padding: "8px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 2 }} title={`Wanted level ${stars}/5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className="h-3.5 w-3.5"
              style={{ color: i <= stars ? "#ff3b5c" : "rgba(255,255,255,0.18)" }}
              fill={i <= stars ? "#ff3b5c" : "transparent"}
            />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }} title="Game credits">
          <Coins className="h-3.5 w-3.5" style={{ color: "#ffd23f" }} />
          <span style={{ fontWeight: 800, fontSize: 13, color: "#ffd23f" }}>
            {credits.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Active-mission tracker: objective, progress, countdown, distance + bearing. */
function MissionTracker() {
  const defs = useMissionStore((s) => s.defs);
  const active = useMissionStore((s) => s.active);
  const { playerPos, playerYaw } = useCity();
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;
  const def = defs.find((d) => d.id === active.defId);
  if (!def) return null;
  const obj = currentObjective(def, active);
  if (!obj) return null;

  const dist = Math.hypot(obj.x - playerPos.x, obj.z - playerPos.z);
  const bearing = Math.atan2(obj.x - playerPos.x, obj.z - playerPos.z);
  const relDeg = ((bearing - playerYaw) * 180) / Math.PI;
  const remain = active.deadline > 0 ? active.deadline - nowTick : 0;
  const urgent = remain > 0 && remain < 30_000;

  return (
    <div style={{ ...glass, padding: "10px 12px", borderLeft: `3px solid ${def.color}`, minWidth: 210 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Flag className="h-3.5 w-3.5" style={{ color: def.color }} />
        <strong style={{ fontSize: 13 }}>{def.name}</strong>
        {remain > 0 && (
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: urgent ? "#ff3b5c" : "#e8f1ff",
            }}
          >
            <Timer className="h-3.5 w-3.5" />
            {fmtTime(remain)}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#c8d2e0", marginBottom: 6 }}>
        {objectiveProgressLabel(def, active)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            transform: `rotate(${relDeg}deg)`,
            fontSize: 18,
            color: def.color,
            transition: "transform 0.2s",
          }}
          title="Objective direction"
        >
          ▲
        </span>
        <span style={{ fontSize: 12, color: "#8b93a3" }}>{Math.round(dist)}m</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#ffd23f", fontWeight: 700 }}>
          +{def.payout} cr
        </span>
      </div>
    </div>
  );
}

/** Contracts board — start / abort missions. Every button is live. */
function ContractsBoard({ onClose }: { onClose: () => void }) {
  const defs = useMissionStore((s) => s.defs);
  const active = useMissionStore((s) => s.active);
  const history = useMissionStore((s) => s.history);
  const startMission = useMissionStore((s) => s.startMission);
  const abortMission = useMissionStore((s) => s.abortMission);
  const { shards } = useCity();

  const activeDef = active ? defs.find((d) => d.id === active.defId) : null;

  return (
    <div
      role="dialog"
      aria-label="Mission contracts"
      style={{
        position: "fixed",
        top: 64,
        right: 12,
        width: 340,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "calc(100vh - 160px)",
        overflowY: "auto",
        ...glass,
        padding: 14,
        zIndex: 60,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <Flag className="h-4 w-4" style={{ color: "#ffd23f" }} />
        <strong style={{ marginLeft: 8, fontSize: 14 }}>Contracts</strong>
        <button
          type="button"
          className="oxc-toggle-btn"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            cityAudio.play("ui");
            onClose();
          }}
          aria-label="Close contracts"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {activeDef && active && (
        <div style={{ ...glass, padding: 10, marginBottom: 10, borderLeft: `3px solid ${activeDef.color}` }}>
          <div style={{ fontSize: 12, color: "#8b93a3" }}>IN PROGRESS</div>
          <div style={{ fontWeight: 700 }}>{activeDef.name}</div>
          <div style={{ fontSize: 12, color: "#c8d2e0", margin: "4px 0 8px" }}>
            {objectiveProgressLabel(activeDef, active)}
          </div>
          <button
            type="button"
            className="oxc-btn compact"
            onClick={() => {
              abortMission(false);
              cityAudio.play("ui");
            }}
          >
            Abort run
          </button>
        </div>
      )}

      {defs.map((d) => {
        const isActive = active?.defId === d.id;
        return (
          <div key={d.id} style={{ ...glass, padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{d.icon}</span>
              <strong style={{ fontSize: 13 }}>{d.name}</strong>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#ffd23f", fontWeight: 700 }}>
                +{d.payout} cr
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#8b93a3", margin: "2px 0 4px" }}>
              {d.tagline}{d.timeLimit > 0 ? ` · ${d.timeLimit}s limit` : ""}
            </div>
            <p style={{ fontSize: 12, color: "#c8d2e0", margin: "0 0 8px" }}>{d.briefing}</p>
            <button
              type="button"
              className="oxc-btn primary compact"
              disabled={!!active}
              onClick={() => {
                if (startMission(d.id, shards)) {
                  onClose();
                }
              }}
              title={active ? "Finish or abort the current run first" : `Start ${d.name}`}
            >
              <Play className="h-3.5 w-3.5" /> {isActive ? "In progress" : "Start"}
            </button>
          </div>
        );
      })}

      {history.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: "#8b93a3", marginBottom: 6 }}>
            RECENT RUNS
          </div>
          {history.slice(0, 5).map((h, i) => (
            <div
              key={`${h.at}-${i}`}
              style={{ display: "flex", fontSize: 12, color: "#c8d2e0", padding: "3px 0" }}
            >
              <span>{h.name}</span>
              <span
                style={{
                  marginLeft: "auto",
                  color: h.status === "completed" ? "#17ff4d" : h.status === "failed" ? "#ff3b5c" : "#8b93a3",
                }}
              >
                {h.status}{h.payout > 0 ? ` +${h.payout}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: "#8b93a3", marginTop: 8 }}>
        Walk to a green ❗ beacon and press <b>E</b> to start on the spot.
      </p>
    </div>
  );
}

function PauseMenu({
  onResume,
  onOpenContracts,
}: {
  onResume: () => void;
  onOpenContracts: () => void;
}) {
  const active = useMissionStore((s) => s.active);
  const defs = useMissionStore((s) => s.defs);
  const startMission = useMissionStore((s) => s.startMission);
  const abortMission = useMissionStore((s) => s.abortMission);
  const { openPanel, exitToMenu, shards } = useCity();

  const restart = () => {
    if (!active) return;
    const id = active.defId;
    abortMission(false);
    startMission(id, shards);
    onResume();
  };

  const btn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(61,231,255,0.15)",
    color: "#e8f1ff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <div
      role="dialog"
      aria-label="Paused"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,4,8,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
      }}
      onClick={onResume}
    >
      <div
        style={{ ...glass, padding: 22, width: 300, display: "flex", flexDirection: "column", gap: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, marginBottom: 6 }}>PAUSED</div>
        <button type="button" style={btn} onClick={onResume}>
          <Play className="h-4 w-4" /> Resume
        </button>
        {active && defs.some((d) => d.id === active.defId) && (
          <button type="button" style={btn} onClick={restart}>
            <RotateCcw className="h-4 w-4" /> Restart mission
          </button>
        )}
        <button type="button" style={btn} onClick={onOpenContracts}>
          <Flag className="h-4 w-4" /> Contracts
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => {
            onResume();
            openPanel("settings");
          }}
        >
          <Settings className="h-4 w-4" /> Settings
        </button>
        <button
          type="button"
          style={{ ...btn, borderColor: "rgba(255,59,92,0.35)", color: "#ff8fa3" }}
          onClick={() => {
            cityAudio.play("ui");
            exitToMenu();
          }}
        >
          <LogOut className="h-4 w-4" /> Quit to menu
        </button>
        <div style={{ fontSize: 11, color: "#8b93a3", marginTop: 4 }}>Esc · resume</div>
      </div>
    </div>
  );
}

function GameOverOverlay() {
  const gameOverAt = useGameStore((s) => s.gameOverAt);
  const { teleport, selectedCityId } = useCity();

  const respawn = () => {
    const deadMs = Date.now() - gameOverAt;
    const econ = useEconomyStore.getState();
    const penalty = Math.max(25, Math.round(econ.credits * 0.1));
    econ.spendCredits(penalty, "Wasted — hospital bill");
    useMissionStore.getState().shiftDeadline(deadMs);
    useGameStore.getState().respawn();
    const spawn = getWorldBlock(selectedCityId).spawn;
    teleport(spawn.x, spawn.z);
    cityAudio.play("confirm");
  };

  return (
    <div
      role="alertdialog"
      aria-label="Wasted"
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(ellipse at center, rgba(120,0,10,0.55), rgba(2,0,0,0.9))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 90,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: 10,
            color: "#ff3b5c",
            textShadow: "0 0 40px rgba(255,59,92,0.6)",
          }}
        >
          WASTED
        </div>
        <p style={{ color: "#c8d2e0", margin: "8px 0 20px" }}>
          The district chewed you up. Hospital bill: 10% of credits.
        </p>
        <button
          type="button"
          className="oxc-btn primary"
          style={{ fontSize: 16, padding: "12px 34px" }}
          onClick={respawn}
          autoFocus
        >
          Respawn
        </button>
      </div>
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
    playerYaw,
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
    teleport,
  } = useCity();
  const isPhone = useIsPhone();
  const [moreOpen, setMoreOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);
  const gameOver = useGameStore((s) => s.gameOver);
  const speed = useGameStore((s) => s.speed);
  const inCar = useGameStore((s) => s.inCar);
  const defs = useMissionStore((s) => s.defs);
  const active = useMissionStore((s) => s.active);
  const startMission = useMissionStore((s) => s.startMission);
  const pauseStartedAt = useRef(0);
  const block = getWorldBlock(selectedCityId);
  const nearest = useMemo(() => getNearestLandmark(block, playerPos), [block, playerPos]);
  const locationName = nearest.label;
  const locationDetail = `${Math.round(nearest.dist)}m · ${block.name}`;

  const dockItems = useMemo(
    () => (isPhone ? MOBILE_DOCK : PANEL_NAV),
    [isPhone],
  );

  // Mission start beacon proximity → E prompt.
  const nearStartDef = useMemo(() => {
    if (active) return null;
    for (const d of defs) {
      if (Math.hypot(d.start.x - playerPos.x, d.start.z - playerPos.z) < 5) return d;
    }
    return null;
  }, [defs, active, playerPos]);

  const togglePause = () => {
    if (gameOver) return;
    if (paused) {
      useMissionStore.getState().shiftDeadline(Date.now() - pauseStartedAt.current);
      setPaused(false);
    } else {
      pauseStartedAt.current = Date.now();
      setPaused(true);
    }
    setBoardOpen(false);
  };

  useEffect(() => {
    if (!isPhone) return;
    // Phones always need the on-screen stick unless the player hides it.
    if (!touchControls) setTouchControls(true);
  }, [isPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture-phase E: start a mission at a beacon before the bubble interact() fires.
  useEffect(() => {
    const onKeyCapture = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyE" && nearStartDef && !active) {
        e.preventDefault();
        e.stopPropagation();
        startMission(nearStartDef.id, shards);
      }
    };
    window.addEventListener("keydown", onKeyCapture, true);
    return () => window.removeEventListener("keydown", onKeyCapture, true);
  }, [nearStartDef, active, startMission, shards]);

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
        if (panel !== "none") {
          setMoreOpen(false);
          setBoardOpen(false);
          closePanel();
          return;
        }
        if (moreOpen) {
          setMoreOpen(false);
          return;
        }
        if (boardOpen) {
          setBoardOpen(false);
          return;
        }
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact, closePanel, openPanel, triggerEmote, panel, moreOpen, boardOpen, paused, gameOver]);

  useEffect(() => {
    if (panel !== "none") {
      setMoreOpen(false);
      resetVirtualInput();
    }
  }, [panel]);

  void playerYaw;
  void teleport;

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
          <OrbitxPriceChip />

          <button
            type="button"
            className={`oxc-toggle-btn ${boardOpen ? "on" : ""}`}
            onClick={() => {
              cityAudio.play("ui");
              setBoardOpen((v) => !v);
            }}
            title="Mission contracts"
            aria-pressed={boardOpen}
          >
            <Flag className="h-3.5 w-3.5" />
            <span className="oxc-hide-phone">Contracts</span>
          </button>
          <button
            type="button"
            className="oxc-toggle-btn"
            onClick={() => {
              resetVirtualInput();
              exitToMenu();
            }}
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

      {/* Gameplay vitals + mission tracker (Worker 3) */}
      <div
        style={{
          position: "fixed",
          top: 66,
          left: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 40,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <VitalsCluster />
        </div>
        <div style={{ pointerEvents: "auto" }}>
          <MissionTracker />
        </div>
        {inCar && speed > 2 && (
          <div style={{ ...glass, padding: "6px 12px", alignSelf: "flex-start", fontSize: 12, fontWeight: 700 }}>
            🚗 {Math.round(speed * 3.6)} km/h
          </div>
        )}
      </div>

      {boardOpen && <ContractsBoard onClose={() => setBoardOpen(false)} />}
      {paused && !gameOver && (
        <PauseMenu
          onResume={togglePause}
          onOpenContracts={() => {
            togglePause();
            setBoardOpen(true);
          }}
        />
      )}
      {gameOver && <GameOverOverlay />}

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
          const activePanel = panel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`oxc-dock-btn ${activePanel ? "active" : ""}`}
              onClick={() => {
                cityAudio.play("ui");
                activePanel ? closePanel() : openPanel(item.id);
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

      {nearStartDef && !active && panel === "none" && (
        <div className="oxc-prompt">
          <div className="oxc-prompt-key">E</div>
          <div className="oxc-prompt-copy">
            <strong>Start: {nearStartDef.name}</strong>
            <span>{nearStartDef.tagline} · +{nearStartDef.payout} credits</span>
          </div>
          <button
            type="button"
            className="oxc-btn primary compact"
            onClick={() => startMission(nearStartDef.id, shards)}
          >
            Go
          </button>
        </div>
      )}

      {prompt && panel === "none" && !nearStartDef && (
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
        <span>E Interact / Exit · Enter Chat · Esc Pause</span>
      </div>

      {touchControls && <TouchControls />}

      <ChatToastHost />
      <CityPanelHost />
    </div>
  );
}
