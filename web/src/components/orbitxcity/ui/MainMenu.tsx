/**
 * OrbitX City — FiveM-style launcher.
 *
 * Left rail = navigation. Centre = live server browser. Right = server detail
 * card with connect action. No tile dashboard.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
import { MenuBackdrop } from "./MenuBackdrop";
import { AudioToggle } from "./AudioToggle";
import { InstallCityPWA } from "./InstallCityPWA";

type RailId = "play" | "servers" | "characters" | "settings" | "quick";

const RAIL: { id: RailId; label: string; glyph: string; hint: string }[] = [
  { id: "play", label: "Play", glyph: "▶", hint: "Connect to selected server" },
  { id: "servers", label: "Servers", glyph: "▦", hint: "Browse districts" },
  { id: "characters", label: "Operatives", glyph: "☺", hint: "Pick your mascot" },
  { id: "settings", label: "Settings", glyph: "⚙", hint: "Audio · quality · input" },
  { id: "quick", label: "Direct Connect", glyph: "⇥", hint: "Skip setup · demo world" },
];

export function MainMenu() {
  const { setGate, setEntered, selectedCityId, setSelectedCityId } = useCity();
  const [visible, setVisible] = useState(false);
  const [rail, setRail] = useState<RailId>("play");
  const [filter, setFilter] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  const theme = resolveTitleTheme(selectedCityId);
  const cssVars = useMemo(() => titleCssVars(theme) as CSSProperties, [theme]);

  const rows = useMemo(() => buildServerRows(undefined, tick), [tick]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.blurb.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [rows, filter]);

  const active =
    rows.find((r) => r.id === selectedCityId) ?? rows[0] ?? undefined;

  const totalPlayers = rows.reduce((a, r) => a + r.players, 0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const id = window.setInterval(() => setTick(Date.now()), 20_000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, []);

  const connect = () => {
    if (connecting) return;
    void cityAudio.unlock();
    cityAudio.play("confirm");
    setConnecting(true);
    window.setTimeout(() => setGate("characters"), 620);
  };

  const run = (id: RailId) => {
    void cityAudio.unlock();
    setRail(id);
    switch (id) {
      case "play":
        connect();
        break;
      case "characters":
        cityAudio.play("confirm");
        window.setTimeout(() => setGate("characters"), 140);
        break;
      case "settings":
        cityAudio.play("ui");
        window.setTimeout(() => setGate("settings"), 140);
        break;
      case "quick":
        cityAudio.play("enter");
        window.setTimeout(() => {
          setGate("world");
          setEntered(true);
        }, 140);
        break;
      default:
        cityAudio.play("ui");
        break;
    }
  };

  return (
    <div
      className={`oxc-menu oxc-launcher ${visible ? "is-in" : ""} ${connecting ? "is-connecting" : ""}`}
      style={cssVars}
    >
      <MenuBackdrop cityId={selectedCityId} intensity="title" />
      <div className="oxc-launcher-scrim" aria-hidden />

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="oxc-lx-top">
        <div className="oxc-lx-brand">
          <span className="oxc-lx-mark">
            Orbit<em>X</em>
          </span>
          <span className="oxc-lx-sub">CITY</span>
        </div>
        <div className="oxc-lx-topmeta">
          <span className="oxc-lx-dot" aria-hidden />
          {totalPlayers.toLocaleString()} players in world
        </div>
        <div className="oxc-lx-topright">
          <AudioToggle />
          <button
            type="button"
            className="oxc-lx-icon"
            title="Next theme track"
            aria-label="Next track"
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

      <div className="oxc-lx-body">
        {/* ── Left rail ─────────────────────────────────────── */}
        <nav className="oxc-lx-rail" aria-label="Main menu">
          {RAIL.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`oxc-lx-railbtn ${rail === item.id ? "is-active" : ""} ${
                item.id === "play" ? "is-primary" : ""
              }`}
              onMouseEnter={() => setRail(item.id)}
              onFocus={() => setRail(item.id)}
              onClick={() => run(item.id)}
            >
              <span className="oxc-lx-glyph" aria-hidden>
                {item.glyph}
              </span>
              <span className="oxc-lx-railtext">
                <strong>{item.label}</strong>
                <em>{item.hint}</em>
              </span>
            </button>
          ))}
        </nav>

        {/* ── Server browser ────────────────────────────────── */}
        <section className="oxc-lx-list" aria-label="Server browser">
          <div className="oxc-lx-listhead">
            <h2>Districts</h2>
            <input
              className="oxc-lx-search"
              type="search"
              value={filter}
              placeholder="Filter by name or tag…"
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter servers"
            />
          </div>

          <div className="oxc-lx-cols" aria-hidden>
            <span>Server</span>
            <span>Players</span>
            <span>Ping</span>
            <span>Status</span>
          </div>

          <ul className="oxc-lx-rows">
            {filtered.map((s) => (
              <ServerRowItem
                key={s.id}
                server={s}
                active={s.id === selectedCityId}
                onSelect={() => {
                  cityAudio.play("ui");
                  setSelectedCityId(s.id as CityId);
                }}
                onConnect={connect}
              />
            ))}
            {!filtered.length && (
              <li className="oxc-lx-empty">No districts match “{filter}”.</li>
            )}
          </ul>
        </section>

        {/* ── Detail card ───────────────────────────────────── */}
        {active && (
          <aside className="oxc-lx-detail" aria-label="Server details">
            <div className="oxc-lx-banner" data-city={active.id}>
              <span className="oxc-lx-bannertag">{REGION_LABEL[active.region]}</span>
            </div>
            <h3 className="oxc-lx-dname">{active.name}</h3>
            <p className="oxc-lx-dblurb">{active.blurb}</p>

            <div className="oxc-lx-dstats">
              <div>
                <strong>
                  {active.players}
                  <small>/{active.maxPlayers}</small>
                </strong>
                <em>Players</em>
              </div>
              <div>
                <strong>{active.ping}ms</strong>
                <em>Ping</em>
              </div>
              <div>
                <strong>{statusLabel(active.status)}</strong>
                <em>Status</em>
              </div>
            </div>

            <div className="oxc-lx-bar" role="presentation">
              <span style={{ width: `${(active.players / active.maxPlayers) * 100}%` }} />
            </div>

            <ul className="oxc-lx-tags">
              {active.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>

            <button
              type="button"
              className="oxc-lx-connect"
              disabled={active.status === "offline" || connecting}
              onClick={connect}
            >
              {connecting
                ? "Connecting…"
                : active.status === "offline"
                  ? "Unavailable"
                  : `Connect to ${active.name}`}
            </button>
            {active.queue > 0 && (
              <p className="oxc-lx-queue">Queue: {active.queue} ahead of you</p>
            )}
          </aside>
        )}
      </div>

      <footer className="oxc-lx-foot">
        <span>WASD move · Shift sprint · Space jump · E interact</span>
        <span className="oxc-lx-build">OrbitX City · Alpha</span>
      </footer>

      {connecting && (
        <div className="oxc-lx-connecting" role="status">
          <div className="oxc-lx-spinner" aria-hidden />
          <p>Connecting to {active?.name}…</p>
        </div>
      )}
    </div>
  );
}

function ServerRowItem({
  server,
  active,
  onSelect,
  onConnect,
}: {
  server: ServerRow;
  active: boolean;
  onSelect: () => void;
  onConnect: () => void;
}) {
  const bars = pingBars(server.ping);
  return (
    <li>
      <button
        type="button"
        className={`oxc-lx-row ${active ? "is-active" : ""}`}
        data-status={server.status}
        onClick={onSelect}
        onDoubleClick={onConnect}
      >
        <span className="oxc-lx-rowmain">
          <span className="oxc-lx-rowname">
            {server.name}
            {server.status === "busy" && <i className="oxc-lx-flag">HOT</i>}
          </span>
          <span className="oxc-lx-rowblurb">{server.blurb}</span>
          <span className="oxc-lx-rowtags">
            {server.tags.slice(0, 3).map((t) => (
              <i key={t}>{t}</i>
            ))}
          </span>
        </span>

        <span className="oxc-lx-rowplayers">
          {server.players}
          <small>/{server.maxPlayers}</small>
        </span>

        <span className="oxc-lx-rowping" title={`${server.ping}ms`}>
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={i <= bars ? "on" : ""} />
          ))}
        </span>

        <span className="oxc-lx-rowstatus" data-status={server.status}>
          {statusLabel(server.status)}
        </span>
      </button>
    </li>
  );
}
