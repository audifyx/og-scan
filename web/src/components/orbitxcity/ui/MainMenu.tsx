/**
 * OrbitX City — GTA V pause-menu style launcher.
 *
 * Horizontal tab strip, a vertical list with a sliding inverted highlight bar,
 * and a contextual detail pane on the right. Keyboard/gamepad-first: arrows
 * move, Q/E swap tabs, Enter selects, Esc backs out.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import type { CityId } from "@/lib/orbitxcity/types";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { resolveTitleTheme, titleCssVars } from "@/lib/orbitxcity/titleTheme";
import {
  buildServerRows,
  pingBars,
  REGION_LABEL,
  statusLabel,
  type ServerRow,
} from "@/lib/orbitxcity/serverBrowser";
import {
  CHARACTER_CLASSES,
  appearanceFromClass,
  classPowerIndex,
  getRarityMeta,
  resolveClassId,
  type CharacterClassId,
} from "@/lib/orbitxcity/characterClasses";
import { MenuBackdrop } from "./MenuBackdrop";
import { MascotPortrait } from "./MascotPortrait";
import { AudioToggle } from "./AudioToggle";
import { InstallCityPWA } from "./InstallCityPWA";

type TabId = "play" | "operatives" | "settings" | "info";

const TABS: { id: TabId; label: string }[] = [
  { id: "play", label: "Play" },
  { id: "operatives", label: "Operatives" },
  { id: "settings", label: "Settings" },
  { id: "info", label: "Info" },
];

export function MainMenu() {
  const {
    setGate,
    setEntered,
    setAvatar,
    avatar,
    selectedCityId,
    setSelectedCityId,
    quality,
    setQuality,
  } = useCity();

  const [tab, setTab] = useState<TabId>("play");
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const listRef = useRef<HTMLUListElement>(null);

  const theme = resolveTitleTheme(selectedCityId);
  const cssVars = useMemo(() => titleCssVars(theme) as CSSProperties, [theme]);

  const servers = useMemo(() => buildServerRows(undefined, tick), [tick]);
  const totalPlayers = servers.reduce((a, s) => a + s.players, 0);

  const selectedClassId = resolveClassId(avatar.classId);

  /** Row count for the active tab, used by keyboard nav. */
  const rowCount =
    tab === "play"
      ? servers.length
      : tab === "operatives"
        ? CHARACTER_CLASSES.length
        : tab === "settings"
          ? 3
          : 0;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const id = window.setInterval(() => setTick(Date.now()), 20_000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, []);

  // Keep the highlighted row synced to the live selection when a tab opens.
  useEffect(() => {
    if (tab === "play") {
      const i = servers.findIndex((s) => s.id === selectedCityId);
      setIndex(i >= 0 ? i : 0);
    } else if (tab === "operatives") {
      const i = CHARACTER_CLASSES.findIndex((c) => c.id === selectedClassId);
      setIndex(i >= 0 ? i : 0);
    } else {
      setIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const connect = useCallback(() => {
    if (connecting) return;
    void cityAudio.unlock();
    cityAudio.play("confirm");
    setConnecting(true);
    window.setTimeout(() => setGate("characters"), 640);
  }, [connecting, setGate]);

  const quickPlay = useCallback(() => {
    void cityAudio.unlock();
    cityAudio.play("enter");
    setGate("world");
    setEntered(true);
  }, [setGate, setEntered]);

  const activate = useCallback(() => {
    void cityAudio.unlock();
    if (tab === "play") {
      const s = servers[index];
      if (!s || s.status === "offline") return;
      setSelectedCityId(s.id as CityId);
      connect();
    } else if (tab === "operatives") {
      const c = CHARACTER_CLASSES[index];
      if (!c) return;
      cityAudio.play("confirm");
      setAvatar(appearanceFromClass(c, avatar.name));
      window.setTimeout(() => setGate("characters"), 160);
    } else if (tab === "settings") {
      cityAudio.play("ui");
      if (index === 0) setQuality(quality === "high" ? "lite" : "high");
      else if (index === 1) setGate("settings");
      else quickPlay();
    }
  }, [
    tab,
    index,
    servers,
    setSelectedCityId,
    connect,
    setAvatar,
    avatar.name,
    setGate,
    quality,
    setQuality,
    quickPlay,
  ]);

  // Keyboard / gamepad-style navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const tabIdx = TABS.findIndex((t) => t.id === tab);

      switch (e.key) {
        case "ArrowDown":
        case "s":
          e.preventDefault();
          if (rowCount) {
            cityAudio.play("ui");
            setIndex((i) => (i + 1) % rowCount);
          }
          break;
        case "ArrowUp":
        case "w":
          e.preventDefault();
          if (rowCount) {
            cityAudio.play("ui");
            setIndex((i) => (i - 1 + rowCount) % rowCount);
          }
          break;
        case "ArrowRight":
        case "e":
          e.preventDefault();
          cityAudio.play("ui");
          setTab(TABS[(tabIdx + 1) % TABS.length]!.id);
          break;
        case "ArrowLeft":
        case "q":
          e.preventDefault();
          cityAudio.play("ui");
          setTab(TABS[(tabIdx - 1 + TABS.length) % TABS.length]!.id);
          break;
        case "Enter":
          e.preventDefault();
          activate();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, rowCount, activate]);

  // Keep the highlighted row in view on long lists.
  useEffect(() => {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const activeServer = servers[index] ?? servers[0];
  const activeClass = CHARACTER_CLASSES[index] ?? CHARACTER_CLASSES[0]!;

  return (
    <div
      className={`oxc-gta ${visible ? "is-in" : ""} ${connecting ? "is-connecting" : ""}`}
      style={cssVars}
    >
      <MenuBackdrop cityId={selectedCityId} intensity="title" />
      <div className="oxc-gta-wash" aria-hidden />
      <div className="oxc-gta-scan" aria-hidden />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="oxc-gta-head">
        <div className="oxc-gta-title">
          <span className="oxc-gta-logo">
            Orbit<em>X</em>
          </span>
          <span className="oxc-gta-city">CITY</span>
        </div>
        <div className="oxc-gta-headright">
          <span className="oxc-gta-online">
            <i aria-hidden /> {totalPlayers.toLocaleString()} online
          </span>
          <AudioToggle />
          <button
            type="button"
            className="oxc-gta-ico"
            aria-label="Next track"
            title="Next theme track"
            onClick={() => {
              void cityAudio.unlock();
              cityAudio.nextTrack();
            }}
          >
            ♫
          </button>
          <InstallCityPWA />
        </div>
      </header>

      {/* ── Tab strip ──────────────────────────────────────── */}
      <nav className="oxc-gta-tabs" role="tablist" aria-label="Menu sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`oxc-gta-tab ${tab === t.id ? "is-on" : ""}`}
            onClick={() => {
              cityAudio.play("ui");
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Panel ──────────────────────────────────────────── */}
      <div className="oxc-gta-panel">
        <ul className="oxc-gta-list" ref={listRef} role="listbox" aria-label={tab}>
          {tab === "play" &&
            servers.map((s, i) => (
              <ServerLine
                key={s.id}
                server={s}
                on={i === index}
                onHover={() => setIndex(i)}
                onPick={() => {
                  setIndex(i);
                  setSelectedCityId(s.id as CityId);
                  connect();
                }}
              />
            ))}

          {tab === "operatives" &&
            CHARACTER_CLASSES.map((c, i) => {
              const r = getRarityMeta(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    className={`oxc-gta-row ${i === index ? "is-on" : ""}`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => {
                      setIndex(i);
                      cityAudio.play("confirm");
                      setAvatar(appearanceFromClass(c, avatar.name));
                      window.setTimeout(() => setGate("characters"), 160);
                    }}
                  >
                    <span className="oxc-gta-rowlabel">{c.name}</span>
                    <span
                      className="oxc-gta-rowval"
                      style={{ color: r.color }}
                    >
                      {r.label}
                    </span>
                  </button>
                </li>
              );
            })}

          {tab === "settings" && (
            <>
              <li>
                <button
                  type="button"
                  className={`oxc-gta-row ${index === 0 ? "is-on" : ""}`}
                  onMouseEnter={() => setIndex(0)}
                  onClick={() => {
                    setIndex(0);
                    cityAudio.play("ui");
                    setQuality(quality === "high" ? "lite" : "high");
                  }}
                >
                  <span className="oxc-gta-rowlabel">Graphics</span>
                  <span className="oxc-gta-rowval">
                    ‹ {quality === "high" ? "High" : "Lite"} ›
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`oxc-gta-row ${index === 1 ? "is-on" : ""}`}
                  onMouseEnter={() => setIndex(1)}
                  onClick={() => {
                    setIndex(1);
                    cityAudio.play("ui");
                    setGate("settings");
                  }}
                >
                  <span className="oxc-gta-rowlabel">All Settings</span>
                  <span className="oxc-gta-rowval">›</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`oxc-gta-row ${index === 2 ? "is-on" : ""}`}
                  onMouseEnter={() => setIndex(2)}
                  onClick={() => {
                    setIndex(2);
                    quickPlay();
                  }}
                >
                  <span className="oxc-gta-rowlabel">Direct Connect</span>
                  <span className="oxc-gta-rowval">Skip setup</span>
                </button>
              </li>
            </>
          )}

          {tab === "info" && (
            <li className="oxc-gta-static">
              <p>
                OrbitX City is a live crypto metaverse. Walk Midtown, trade from
                in-world terminals, launch tokens at the arena, and meet other
                operatives in voice plazas.
              </p>
              <p>
                <strong>WASD</strong> move · <strong>Shift</strong> sprint ·{" "}
                <strong>Space</strong> jump · <strong>E</strong> interact
              </p>
            </li>
          )}
        </ul>

        {/* ── Detail pane ──────────────────────────────────── */}
        <aside className="oxc-gta-detail">
          {tab === "play" && activeServer && (
            <>
              <div className="oxc-gta-art" data-city={activeServer.id}>
                <span>{REGION_LABEL[activeServer.region]}</span>
              </div>
              <h3>{activeServer.name}</h3>
              <p className="oxc-gta-blurb">{activeServer.blurb}</p>
              <dl className="oxc-gta-facts">
                <div>
                  <dt>Players</dt>
                  <dd>
                    {activeServer.players}/{activeServer.maxPlayers}
                  </dd>
                </div>
                <div>
                  <dt>Ping</dt>
                  <dd>{activeServer.ping}ms</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd data-status={activeServer.status}>
                    {statusLabel(activeServer.status)}
                  </dd>
                </div>
              </dl>
              <div className="oxc-gta-meter">
                <span
                  style={{
                    width: `${(activeServer.players / activeServer.maxPlayers) * 100}%`,
                  }}
                />
              </div>
              <ul className="oxc-gta-tags">
                {activeServer.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}

          {tab === "operatives" && (
            <>
              <div className="oxc-gta-portrait" data-rarity={activeClass.rarity}>
                <MascotPortrait id={activeClass.id as CharacterClassId} />
              </div>
              <h3>{activeClass.name}</h3>
              <p className="oxc-gta-blurb">{activeClass.tagline}</p>
              <ul className="oxc-gta-stats">
                {activeClass.stats.map((s) => (
                  <li key={s.label}>
                    <span>{s.label}</span>
                    <i>
                      <b style={{ width: `${s.value}%` }} />
                    </i>
                    <em>{s.value}</em>
                  </li>
                ))}
              </ul>
              <div className="oxc-gta-facts">
                <div>
                  <dt>Power</dt>
                  <dd>{classPowerIndex(activeClass.id)}</dd>
                </div>
              </div>
            </>
          )}

          {(tab === "settings" || tab === "info") && (
            <div className="oxc-gta-art oxc-gta-art--plain">
              <span>OrbitX City · Alpha</span>
            </div>
          )}
        </aside>
      </div>

      {/* ── Button hints ───────────────────────────────────── */}
      <footer className="oxc-gta-hints">
        <span>
          <kbd>↑↓</kbd> Navigate
        </span>
        <span>
          <kbd>Q</kbd>
          <kbd>E</kbd> Tabs
        </span>
        <span>
          <kbd>Enter</kbd> Select
        </span>
        <span className="oxc-gta-spacer" />
        <button type="button" className="oxc-gta-cta" onClick={connect}>
          Play Now
        </button>
      </footer>

      {connecting && (
        <div className="oxc-gta-loading" role="status">
          <div className="oxc-gta-bars" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <p>Connecting to {activeServer?.name ?? "OrbitX City"}…</p>
        </div>
      )}
    </div>
  );
}

function ServerLine({
  server,
  on,
  onHover,
  onPick,
}: {
  server: ServerRow;
  on: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const bars = pingBars(server.ping);
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={on}
        className={`oxc-gta-row ${on ? "is-on" : ""}`}
        data-status={server.status}
        onMouseEnter={onHover}
        onClick={onPick}
      >
        <span className="oxc-gta-rowlabel">{server.name}</span>
        <span className="oxc-gta-rowmeta">
          <span className="oxc-gta-pips" title={`${server.ping}ms`}>
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={i <= bars ? "on" : ""} />
            ))}
          </span>
          <span className="oxc-gta-rowval">
            {server.players}/{server.maxPlayers}
          </span>
        </span>
      </button>
    </li>
  );
}
