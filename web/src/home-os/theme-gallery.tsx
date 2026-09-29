import { useEffect } from "react";
import {
  ACCENTS,
  BG_THEMES,
  DEVICE_THEMES,
  type DeviceTheme,
} from "./theme-registry";
import { useTheme } from "./os-theme-provider";

function DevicePreview({ theme, active }: { theme: DeviceTheme; active: boolean }) {
  const p = theme.preview;
  return (
    <div
      data-os-device={theme.id}
      className="relative overflow-hidden rounded-2xl border border-white/10"
      style={{ background: p.bg, aspectRatio: "4 / 3" }}
      aria-hidden
    >
      {/* mini nav */}
      <div
        className="glass-nav flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${p.accent}44` }}
      >
        <span className="size-3 rounded-full" style={{ background: p.accent }} />
        <span className="h-1.5 w-10 rounded-full" style={{ background: `${p.text}44` }} />
        <span className="h-1.5 w-6 rounded-full" style={{ background: `${p.text}22` }} />
      </div>
      <div className="grid grid-cols-4 gap-1.5 p-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="os-app-tile aspect-square w-full"
            style={{
              background: `linear-gradient(135deg, ${p.accent}${i % 3 === 0 ? "cc" : "55"}, ${p.panel})`,
              border: `1px solid ${p.accent}44`,
            }}
          />
        ))}
      </div>
      <div
        className="pad-panel mx-2.5 mb-2.5 rounded-xl p-2"
        style={{ background: `${p.panel}dd`, borderColor: `${p.accent}44` }}
      >
        <div className="h-1.5 w-2/3 rounded-full" style={{ background: `${p.text}55` }} />
        <div className="mt-1.5 h-1.5 w-1/2 rounded-full" style={{ background: `${p.text}30` }} />
      </div>
      {active ? (
        <span
          className="absolute right-2 top-2 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
          style={{ background: p.accent, color: p.bg }}
        >
          On
        </span>
      ) : null}
    </div>
  );
}

export function ThemeGallery({ onClose }: { onClose: () => void }) {
  const { theme, setDevice, setBg, setAccent, resetTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Theme gallery"
    >
      <div
        className="pad-panel max-h-[88dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
              Appearance
            </p>
            <h2 className="font-display text-2xl text-white">Theme OS</h2>
            <p className="mt-1 text-sm text-white/55">
              One theme skins the entire platform — every app, every screen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-white"
            aria-label="Close theme gallery"
          >
            ✕
          </button>
        </div>

        <h3 className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
          Device themes
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {DEVICE_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDevice(t.id)}
              className={`group rounded-2xl border p-1.5 text-left transition-transform hover:scale-[1.02] active:scale-95 ${
                theme.device === t.id
                  ? "border-[var(--color-gold)] shadow-[0_0_24px_rgb(214_255_61/20%)]"
                  : "border-white/10"
              }`}
            >
              <DevicePreview theme={t} active={theme.device === t.id} />
              <p className="mt-2 px-1 text-sm font-semibold text-white">{t.name}</p>
              <p className="px-1 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                {t.tagline}
              </p>
            </button>
          ))}
        </div>

        <h3 className="mb-2.5 mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
          Backgrounds
        </h3>
        <div className="flex flex-wrap gap-2">
          {BG_THEMES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBg(b.id)}
              title={b.blurb}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                theme.bg === b.id
                  ? "border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-white"
                  : "border-white/10 text-white/60 hover:text-white"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        <h3 className="mb-2.5 mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
          Accent color
        </h3>
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccent(a.id)}
              title={a.name}
              aria-label={`${a.name} accent`}
              className={`size-10 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                theme.accent === a.id ? "ring-2 ring-white ring-offset-2 ring-offset-black" : "ring-1 ring-white/20"
              }`}
              style={{ background: a.swatch }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={resetTheme}
          className="mt-7 w-full rounded-2xl border border-white/10 py-3 text-sm font-semibold text-white/70 hover:text-white"
        >
          Reset to OrbitX Classic
        </button>
      </div>
    </div>
  );
}
