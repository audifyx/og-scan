import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

const BG_KEY = "hub-bgfx";
const WALLPAPER_KEY = "hub-wallpaper";
const EVENT = "ox-atmosphere";

/* Terminal v2 atmosphere — gold / silver glows only, one look across modes. */
const MODE_TINT: Record<string, string> = {
  nebula: "radial-gradient(900px 520px at 50% -10%, rgba(232,184,74,.20), transparent 55%), radial-gradient(700px 400px at 100% 10%, rgba(201,209,217,.12), transparent 50%)",
  starfield: "radial-gradient(800px 500px at 40% 0%, rgba(232,184,74,.16), transparent 55%)",
  grid3d: "linear-gradient(180deg, rgba(232,184,74,.10), transparent 40%), linear-gradient(0deg, rgba(201,209,217,.14), transparent 50%)",
  orbs: "radial-gradient(600px 400px at 20% 30%, rgba(232,184,74,.18), transparent 50%), radial-gradient(500px 360px at 80% 70%, rgba(201,209,217,.14), transparent 50%)",
  matrix: "radial-gradient(900px 600px at 50% 0%, rgba(232,184,74,.14), transparent 60%)",
  custom: "none",
  minimal: "none",
};

function readMode() {
  try {
    return localStorage.getItem(BG_KEY) || "nebula";
  } catch {
    return "nebula";
  }
}

function readWallpaper() {
  try {
    return localStorage.getItem(WALLPAPER_KEY) || localStorage.getItem("sol-wallpaper");
  } catch {
    return null;
  }
}

/** Reads the Hub theme from shared localStorage so DEX matches /app atmosphere. */
export function SharedAtmosphere() {
  const [mode, setMode] = useState(readMode);
  const [wallpaper, setWallpaper] = useState<string | null>(readWallpaper);

  useEffect(() => {
    const sync = () => {
      setMode(readMode());
      setWallpaper(readWallpaper());
    };
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.oxTheme = mode;
    document.body.classList.toggle("ox-has-wallpaper", !!wallpaper);
  }, [mode, wallpaper]);

  return (
    <div className="dex-shared-atm" aria-hidden>
      {wallpaper ? (
        <div className="dex-shared-atm__img" style={{ backgroundImage: `url(${wallpaper})` }} />
      ) : (
        <div className="dex-shared-atm__tint" style={{ background: MODE_TINT[mode] || MODE_TINT.nebula }} />
      )}
      <div className="dex-shared-atm__veil" />
    </div>
  );
}

const QUICK_MODES = ["nebula", "starfield", "grid3d", "orbs", "matrix", "minimal"] as const;

export function DexThemeButton() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(readMode);

  const pick = (m: string) => {
    try {
      localStorage.setItem(BG_KEY, m);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* noop */
    }
    setMode(m);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dex-theme-btn"
        title="Platform theme (shared with Hub)"
        aria-label="Platform theme"
      >
        <Palette className="w-4 h-4" style={{ color: "var(--term-gold)" }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="dex-theme-pop">
            <div className="dex-theme-pop__title">Platform theme</div>
            <p className="dex-theme-pop__hint">Same wallpaper as /app Hub</p>
            <div className="dex-theme-pop__grid">
              {QUICK_MODES.map((m) => (
                <button key={m} type="button" className={mode === m ? "is-on" : ""} onClick={() => pick(m)}>
                  {m}
                </button>
              ))}
            </div>
            <a href="/app" className="dex-theme-pop__hub">
              Open Hub for full picker →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
