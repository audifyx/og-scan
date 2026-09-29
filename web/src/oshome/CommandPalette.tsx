import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Dices,
  FolderLock,
  Keyboard,
  Moon,
  Palette,
  Sparkles,
  Sun,
  Timer,
  Tv,
  Volume2,
  Eye,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import { APP_CATALOG, type OsHomeApp } from "./appsCatalog";
import { useDeviceTheme } from "../themes/DeviceThemeProvider";
import { rollRandomTheme, getSurpriseOnLogin, setSurpriseOnLogin } from "../themes/randomizer";
import { getTimeAuto, setTimeAutoLS } from "../themes/timeThemes";
import { getCrtFx, setCrtFxEnabled } from "../themes/crtFx";
import { isStreamerMode, setStreamerMode, isGuestMode, setGuestMode } from "../themes/modes";
import { isPulsing, startDemoPulse, stopPulse } from "../themes/audioPulse";
import { lockVault, hasVaultPattern, isVaultUnlocked } from "../themes/vault";
import { screenshotToX } from "../themes/shareX";
import "./oshome.css";

/**
 * Command palette (idea 38) — Ctrl/⌘K, run any action from anywhere.
 * Superset of the phase-1 app Launcher: same app search UX (↑↓ + Enter,
 * Esc) plus an ACTIONS section — theme dice, CRT, pulse, screenshot→X,
 * streamer/guest, vault lock, and settings deep-links.
 */

export interface PaletteAction {
  id: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
  hint?: string;
  run: () => void | Promise<void>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onLaunch: (a: OsHomeApp) => void;
  /** open settings, optionally deep-linked to a ThemeStudio section */
  onOpenSettings: (section?: string) => void;
  onShowShortcuts: () => void;
}

type Row = { kind: "action"; action: PaletteAction } | { kind: "app"; app: OsHomeApp };

export default function CommandPalette({ open, onClose, onLaunch, onOpenSettings, onShowShortcuts }: Props) {
  const { setDeviceTheme, setBackground, setAccent } = useDeviceTheme();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setFlash(null);
    }
  }, [open ]);

  const say = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash((f) => (f === msg ? null : f)), 2200);
  };

  const actions: PaletteAction[] = useMemo(
    () => [
      {
        id: "dice",
        name: "Surprise me",
        blurb: "Roll a random device theme, background + accent",
        icon: Dices,
        hint: "dice",
        run: () => {
          const roll = rollRandomTheme();
          setDeviceTheme(roll.device);
          setBackground(roll.bg);
          setAccent(roll.accent);
          say("Rolled a fresh look");
        },
      },
      {
        id: "surprise-login",
        name: getSurpriseOnLogin() ? "Disable surprise-on-login" : "Enable surprise-on-login",
        blurb: "New random device theme every session",
        icon: Sparkles,
        run: () => {
          setSurpriseOnLogin(!getSurpriseOnLogin());
          say(getSurpriseOnLogin() ? "Surprise on login: on" : "Surprise on login: off");
        },
      },
      {
        id: "time-auto",
        name: getTimeAuto() ? "Disable time-based themes" : "Enable time-based themes",
        blurb: "Game Boy by day, phosphor by night — auto-switch",
        icon: getTimeAuto() ? Sun : Moon,
        run: () => {
          setTimeAutoLS(!getTimeAuto());
          say(getTimeAuto() ? "Time themes: off" : "Time themes: on");
        },
      },
      {
        id: "crt",
        name: getCrtFx().enabled ? "Disable CRT filter" : "Enable CRT filter",
        blurb: "Scanlines + phosphor glow over any theme",
        icon: Tv,
        run: () => {
          setCrtFxEnabled(!getCrtFx().enabled);
          say(getCrtFx().enabled ? "CRT filter: off" : "CRT filter: on");
        },
      },
      {
        id: "pulse",
        name: isPulsing() ? "Stop music pulse" : "Pulse to music (demo beat)",
        blurb: "Wallpaper breathes with the beat",
        icon: Volume2,
        run: () => {
          if (isPulsing()) {
            stopPulse();
            say("Pulse stopped");
          } else {
            startDemoPulse();
            say("Pulsing to the beat");
          }
        },
      },
      {
        id: "screenshot",
        name: "Screenshot → X",
        blurb: "Capture the screen and open the X composer",
        icon: Camera,
        hint: "share",
        run: async () => {
          say("Pick a window to capture…");
          const r = await screenshotToX();
          say(r.message);
        },
      },
      {
        id: "streamer",
        name: isStreamerMode() ? "Disable streamer mode" : "Enable streamer mode",
        blurb: "Hide balances for screenshots & streams",
        icon: isStreamerMode() ? Eye : EyeOff,
        run: () => {
          setStreamerMode(!isStreamerMode());
          say(isStreamerMode() ? "Streamer mode: off" : "Streamer mode: on");
        },
      },
      {
        id: "guest",
        name: isGuestMode() ? "Exit guest mode" : "Enter guest mode",
        blurb: "Demo the platform without an account",
        icon: Eye,
        run: () => {
          setGuestMode(!isGuestMode());
          say(isGuestMode() ? "Guest mode: off" : "Guest mode: on");
        },
      },
      {
        id: "vault-lock",
        name: "Lock the vault",
        blurb: "Hide vaulted apps until the pattern is drawn",
        icon: FolderLock,
        run: () => {
          if (!hasVaultPattern()) {
            onOpenSettings("studio-vault");
            return;
          }
          lockVault();
          say(isVaultUnlocked() ? "Vault locked" : "Vault is already locked");
        },
      },
      { id: "open-palette", name: "Palette builder", blurb: "Design & share custom accents", icon: Palette, run: () => onOpenSettings("studio-palette") },
      { id: "open-screensaver", name: "Screensaver settings", blurb: "Idle scenes + timeout", icon: Timer, run: () => onOpenSettings("studio-screensaver") },
      { id: "open-shortcuts", name: "Keyboard shortcuts", blurb: "Every shortcut, one cheat sheet", icon: Keyboard, hint: "?", run: onShowShortcuts },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  const rows: Row[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matchA = !needle
      ? actions
      : actions.filter((a) => `${a.name} ${a.blurb}`.toLowerCase().includes(needle));
    const matchP = !needle
      ? APP_CATALOG
      : APP_CATALOG.filter((a) => `${a.name} ${a.blurb} ${a.category}`.toLowerCase().includes(needle));
    return [
      ...matchA.map((action): Row => ({ kind: "action", action })),
      ...matchP.map((app): Row => ({ kind: "app", app })),
    ];
  }, [q, actions]);

  useEffect(() => setActive(0), [q ]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  const go = (row: Row) => {
    if (row.kind === "app") {
      onClose();
      onLaunch(row.app);
    } else {
      // Actions that open settings close the palette first; the rest
      // stay open so you can chain commands (flash confirms the run).
      const closes = row.action.id.startsWith("open-") || row.action.id === "vault-lock";
      void row.action.run();
      if (closes) onClose();
      else setActive((a) => a); // keep palette open
    }
  };

  let lastKind: Row["kind"] | null = null;

  return (
    <div className="osh-launcher" onClick={onClose} role="dialog" aria-label="Command palette">
      <div className="osh-launcher-panel" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="osh-launcher-input"
          placeholder="Type a command or search apps…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && rows[active]) go(rows[active]);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, rows.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
          }}
        />
        {flash && <div className="osh-palette-flash" role="status">{flash}</div>}
        <div className="osh-launcher-results">
          {rows.map((row, i) => {
            const header =
              row.kind !== lastKind ? (
                <div key={`h-${row.kind}`} className="osh-palette-sec">
                  {row.kind === "action" ? "Actions" : "Apps"}
                </div>
              ) : null;
            lastKind = row.kind;
            const Icon = row.kind === "action" ? row.action.icon : row.app.icon;
            const name = row.kind === "action" ? row.action.name : row.app.name;
            const blurb = row.kind === "action" ? row.action.blurb : row.app.blurb;
            const accent = row.kind === "action" ? "var(--dt-accent)" : row.app.accent;
            return (
              <div key={row.kind === "action" ? `a-${row.action.id}` : `p-${row.app.id}`}>
                {header}
                <button
                  className="osh-launcher-hit"
                  data-active={i === active || undefined}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(row)}
                >
                  <span className="osh-icon-tile">
                    <Icon className="osh-icon-glyph" style={{ color: accent }} />
                  </span>
                  <span>
                    <b style={{ fontSize: 13 }}>{name}</b>
                    <small>{blurb}</small>
                  </span>
                  {row.kind === "action" && row.action.hint && (
                    <kbd className="osh-palette-hint">{row.action.hint}</kbd>
                  )}
                </button>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="osh-launcher-empty">Nothing matches “{q}”.</div>
          )}
        </div>
      </div>
    </div>
  );
}
