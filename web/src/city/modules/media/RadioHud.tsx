/**
 * MEDIA MODULE — radio HUD.
 *
 * Bottom-sheet station picker: 4 live stations (3 generative music + ORBITX
 * CHATTER read aloud via Web Speech API), volume, now-playing readout.
 * Wraps RadioController; persists station/volume/on-off in the media store.
 */
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { RADIO_STATIONS, RadioController, getStation } from "./radio";
import type { RadioStationId } from "./types";
import { MediaRuntime, updateMediaSettings, useMediaSettings } from "./store";

interface RadioHudProps {
  onClose: () => void;
  /** Optional X authCode (dashboard paste flow) enabling real X timeline reads on the chatter station. */
  xAuthCode?: string | null;
}

export function RadioHud({ onClose, xAuthCode = null }: RadioHudProps) {
  const settings = useMediaSettings();
  const ctrlRef = useRef<RadioController | null>(null);
  const [nowPlaying, setNowPlaying] = useState("tuning in…");
  const [speaking, setSpeaking] = useState(false);
  const dragStart = useRef<{ y: number; top: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  // live ref so the unmount cleanup sees the latest setting
  const radioOnRef = useRef(settings.radioOn);
  radioOnRef.current = settings.radioOn;

  if (!ctrlRef.current) {
    ctrlRef.current = new RadioController({
      station: settings.radioStation,
      volume: settings.radioVolume,
      xAuthCode,
    });
  }
  const ctrl = ctrlRef.current;

  // sync settings → controller
  useEffect(() => {
    ctrl.setVolume(settings.radioVolume);
    ctrl.setXAuthCode(xAuthCode);
    if (ctrl.getStation() !== settings.radioStation) ctrl.setStation(settings.radioStation);
    if (settings.radioOn && !ctrl.isPlaying()) ctrl.play();
    if (!settings.radioOn && ctrl.isPlaying()) ctrl.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.radioOn, settings.radioStation, settings.radioVolume, xAuthCode]);

  // now-playing ticker
  useEffect(() => {
    const t = window.setInterval(() => {
      setNowPlaying(ctrl.nowPlaying());
      setSpeaking(ctrl.isPlaying() && ctrl.getStation() === "chatter");
    }, 1000);
    setNowPlaying(ctrl.nowPlaying());
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pause on unmount so audio never leaks behind the HUD (unless the user left it on)
  useEffect(() => () => { if (!radioOnRef.current) ctrl.pause(); }, [ctrl]);

  function pick(id: RadioStationId) {
    updateMediaSettings({ radioStation: id, radioOn: true });
    MediaRuntime.emit({ type: "radio", on: true, station: id });
  }

  function togglePower() {
    const on = !settings.radioOn;
    updateMediaSettings({ radioOn: on });
    MediaRuntime.emit({ type: "radio", on, station: settings.radioStation });
  }

  function onSheetDragStart(e: RPointerEvent) {
    const el = sheetRef.current;
    if (!el) return;
    dragStart.current = { y: e.clientY, top: el.getBoundingClientRect().top };
  }
  function onSheetDragMove(e: RPointerEvent) {
    const d = dragStart.current;
    const el = sheetRef.current;
    if (!d || !el) return;
    const dy = e.clientY - d.y;
    if (dy > 120) onClose();
    else el.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }
  function onSheetDragEnd() {
    dragStart.current = null;
    if (sheetRef.current) sheetRef.current.style.transform = "";
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}>
      <div ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onSheetDragStart}
        onPointerMove={onSheetDragMove}
        onPointerUp={onSheetDragEnd}
        className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-zinc-950/95 p-5 text-white backdrop-blur sm:rounded-3xl"
        style={{ touchAction: "pan-y" }}>
        {/* drag handle */}
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20" />
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.3em] text-white/60">📻 Radio</div>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-sm">✕</button>
        </div>

        {/* now playing */}
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <button onClick={togglePower} aria-label={settings.radioOn ? "Turn radio off" : "Turn radio on"}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${settings.radioOn ? "bg-violet-600" : "bg-white/10"}`}>
            {settings.radioOn ? "⏸" : "▶"}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {getStation(settings.radioStation).name}
              {speaking && <span className="ml-2 animate-pulse text-emerald-400">● LIVE</span>}
            </div>
            <div className="truncate text-xs text-white/50">{nowPlaying}</div>
          </div>
        </div>

        {/* stations */}
        <div className="grid grid-cols-2 gap-2">
          {RADIO_STATIONS.map((s) => {
            const active = s.id === settings.radioStation && settings.radioOn;
            return (
              <button key={s.id} onClick={() => pick(s.id)}
                className={`rounded-xl border p-3 text-left transition ${active ? "border-violet-400 bg-violet-950/60" : "border-white/10 bg-white/5"}`}>
                <div className="text-sm font-semibold">
                  {s.kind === "chatter" ? "🗣 " : "🎵 "}{s.name}
                </div>
                <div className="mt-0.5 text-[11px] text-white/50">{s.tagline}</div>
                {s.kind === "chatter" && !xAuthCode && (
                  <div className="mt-1 text-[10px] text-amber-300/80">no X link — market commentary</div>
                )}
              </button>
            );
          })}
        </div>

        {/* volume */}
        <label className="mt-4 flex items-center gap-3 text-sm text-white/70">
          <span>🔊</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.radioVolume}
            onChange={(e) => updateMediaSettings({ radioVolume: Number(e.target.value) })}
            className="flex-1" aria-label="Radio volume" />
          <span className="w-10 text-right text-xs">{Math.round(settings.radioVolume * 100)}%</span>
        </label>

        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          Music stations are synthesized live in your browser — royalty-free, no files.
          Chatter reads real crypto talk aloud{!xAuthCode && " (link X on orbitx.world/x for the live timeline)"}.
        </p>
      </div>
    </div>
  );
}
