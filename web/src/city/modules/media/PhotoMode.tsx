/**
 * MEDIA MODULE — photo mode overlay.
 *
 * Mount on user action (camera button / P key). Freezes the world via the
 * adapter, captures one frame, then offers GTA-style camera controls on the
 * frozen frame: drag to pan, pinch/wheel to zoom, rotate, filters, grid, shutter.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaBillingProvider, MediaWorldAdapter, PhotoFilterId, PhotoView } from "./types";
import {
  PHOTO_FILTERS, PREMIUM_FILTER_PACK, buildShotCaption, clampView, defaultView,
  downscaleImage, exportPhoto, getFilter, makeShot, viewToCssTransform,
} from "./photo";
import { addShot } from "./gallery";
import { MediaRuntime, getMediaSettings, updateMediaSettings } from "./store";
import { burnPurchase } from "@/tokenomics/burnFlow";

interface PhotoModeProps {
  adapter: MediaWorldAdapter;
  billing: MediaBillingProvider | null;
  onClose: () => void;
  onShare: (shotId: string) => void;
}

type Stage = "capturing" | "framing" | "review";

export function PhotoMode({ adapter, billing, onClose, onShare }: PhotoModeProps) {
  const [stage, setStage] = useState<Stage>("capturing");
  const [frame, setFrame] = useState<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<PhotoView>(defaultView());
  const [filterId, setFilterId] = useState<PhotoFilterId>("none");
  const [grid, setGrid] = useState(true);
  const [caption, setCaption] = useState("");
  const [exported, setExported] = useState<string | null>(null);
  const [shotId, setShotId] = useState<string | null>(null);
  const [captureErr, setCaptureErr] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyErr, setBuyErr] = useState<string | null>(null);

  const settings = getMediaSettings();
  const unlocked = useMemo(
    () => new Set(settings.unlockedFilterPacks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.unlockedFilterPacks.join(",")],
  );

  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  /** Active touch pointers for pinch-zoom (pointerId → client coords). */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  /** Pinch baseline: finger distance + zoom at pinch start. */
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // freeze + capture on mount
  useEffect(() => {
    adapter.setPaused(true);
    MediaRuntime.emit({ type: "photo-mode", active: true });
    const url = adapter.captureFrame();
    if (!url) {
      setCaptureErr("Couldn't grab a frame — try again while the world is rendering.");
      return;
    }
    downscaleImage(url)
      .then((c) => { setFrame(c); setStage("framing"); })
      .catch(() => setCaptureErr("Frame decode failed — try again."));
    return () => { adapter.setPaused(false); MediaRuntime.emit({ type: "photo-mode", active: false }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filter = getFilter(filterId);
  const filterLocked = filter.premium && !unlocked.has(PREMIUM_FILTER_PACK.id);

  function updateView(patch: Partial<PhotoView>) {
    setView((v) => clampView({ ...v, ...patch }));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointersRef.current.values()];
    if (pts.length === 2) {
      // second finger down: pinch takes over from pan
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartRef.current = { dist, zoom: view.zoom };
      dragRef.current = null;
    } else if (pts.length === 1) {
      dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const map = pointersRef.current;
    if (!map.has(e.pointerId)) return;
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...map.values()];
    const pinch = pinchStartRef.current;
    if (pts.length === 2 && pinch && pinch.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      updateView({ zoom: pinch.zoom * (dist / pinch.dist) });
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const r = previewRef.current?.getBoundingClientRect();
    if (!r) return;
    updateView({ x: d.vx - (e.clientX - d.x) / r.width, y: d.vy - (e.clientY - d.y) / r.height });
  }

  function onPointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  }

  // Wheel zoom needs a non-passive native listener: React 17+ attaches onWheel
  // as passive at the root, so preventDefault() on the synthetic event warns
  // and doesn't stop the page from scrolling under the viewfinder.
  useEffect(() => {
    const el = previewRef.current;
    if (!el || stage !== "framing") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => clampView({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.08 : 0.92) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stage]);

  function shutter() {
    if (!frame) return;
    const url = exportPhoto(frame, view, filter);
    setExported(url);
    setStage("review");
    const snap = adapter.getPlayerSnapshot();
    setCaption(buildShotCaption({
      filter,
      isNight: snap?.isNight ?? false,
      speedKmh: snap?.speedKmh ?? 0,
    }));
  }

  function saveToGallery() {
    if (!exported || !frame) return;
    const shot = makeShot(exported, frame.width, frame.height, filterId, caption.trim() || buildShotCaption({ filter, isNight: false, speedKmh: 0 }));
    if (!addShot(shot)) { setSaveErr("Shot too large to store — zoom out or retake and try again."); return; }
    setSaveErr(null);
    updateMediaSettings({ photoCount: getMediaSettings().photoCount + 1 });
    setShotId(shot.id);
    MediaRuntime.emit({ type: "shot-saved", id: shot.id });
  }

  async function buyFilterPack() {
    if (!billing) { setBuyErr("Wallet auth required — connect your wallet to buy the pack."); return; }
    if (!billing.ready) { billing.beginAuth(); setBuyErr("Finish wallet auth, then tap buy again."); return; }
    setBuying(true); setBuyErr(null);
    try {
      // Canonical buy-and-burn — dry-run safe, normalized reason, shared ledger.
      const res = await burnPurchase(billing, {
        amount: PREMIUM_FILTER_PACK.price,
        itemId: PREMIUM_FILTER_PACK.id,
        label: PREMIUM_FILTER_PACK.name,
        reason: PREMIUM_FILTER_PACK.reason,
        module: "media",
      });
      if (!res.ok) throw new Error(res.message);
      updateMediaSettings({ unlockedFilterPacks: [...getMediaSettings().unlockedFilterPacks, PREMIUM_FILTER_PACK.id] });
      setFilterId("nightops");
    } catch (err) {
      setBuyErr(err instanceof Error ? err.message : "Purchase failed.");
    } finally { setBuying(false); }
  }

  const frameUrl = useMemo(() => frame?.toDataURL("image/jpeg", 0.9) ?? null, [frame, stage]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white select-none">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm">✕ Close</button>
        <div className="text-xs uppercase tracking-[0.3em] text-white/60">Photo Mode</div>
        <button onClick={() => setGrid((g) => !g)} className={`rounded-full px-4 py-2 text-sm ${grid ? "bg-violet-600" : "bg-white/10"}`}>
          Grid
        </button>
      </div>

      {stage === "capturing" && (
        <div className="flex flex-1 items-center justify-center">
          {captureErr
            ? <div className="px-8 text-center"><p className="text-white/70">{captureErr}</p>
              <button onClick={onClose} className="mt-4 rounded-full bg-violet-600 px-6 py-2">Back</button></div>
            : <p className="animate-pulse text-white/60">Freezing frame…</p>}
        </div>
      )}

      {stage !== "capturing" && frameUrl && (
        <>
          {/* viewfinder */}
          <div className="relative mx-3 flex-1 overflow-hidden rounded-xl bg-black"
            ref={previewRef}
            onPointerDown={stage === "framing" ? onPointerDown : undefined}
            onPointerMove={stage === "framing" ? onPointerMove : undefined}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: "none", cursor: stage === "framing" ? "move" : "default" }}>
            <img
              src={stage === "review" && exported ? exported : frameUrl}
              alt="photo preview"
              draggable={false}
              className="h-full w-full object-cover"
              style={stage === "framing"
                ? { transform: viewToCssTransform(view), filter: filterLocked ? "none" : filter.css }
                : { filter: "none" }}
            />
            {grid && stage === "framing" && (
              <div className="pointer-events-none absolute inset-0">
                {[1 / 3, 2 / 3].map((f) => (
                  <div key={f}>
                    <div className="absolute bg-white/25" style={{ left: `${f * 100}%`, top: 0, bottom: 0, width: 1 }} />
                    <div className="absolute bg-white/25" style={{ top: `${f * 100}%`, left: 0, right: 0, height: 1 }} />
                  </div>
                ))}
              </div>
            )}
            {stage === "framing" && (
              <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[11px] text-white/60">
                drag to pan · scroll / pinch to zoom
              </div>
            )}
          </div>

          {stage === "framing" && (
            <div className="px-3 pb-2">
              {/* filter carousel */}
              <div className="flex gap-2 overflow-x-auto py-2">
                {PHOTO_FILTERS.map((f) => {
                  const locked = f.premium && !unlocked.has(PREMIUM_FILTER_PACK.id);
                  const active = f.id === filterId;
                  return (
                    <button key={f.id}
                      onClick={() => { if (!locked) setFilterId(f.id); }}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${active ? "border-violet-400" : "border-transparent"}`}>
                      <img src={frameUrl} alt={f.name} className="h-full w-full object-cover" style={{ filter: locked ? "grayscale(1) brightness(0.4)" : f.css }} />
                      {locked && <span className="absolute inset-0 flex items-center justify-center text-lg">🔒</span>}
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px]">{f.name}</span>
                    </button>
                  );
                })}
              </div>
              {/* camera controls */}
              <div className="flex items-center gap-3 py-1 text-xs text-white/70">
                <label className="flex flex-1 items-center gap-2">Zoom
                  <input type="range" min={1} max={4} step={0.05} value={view.zoom}
                    onChange={(e) => updateView({ zoom: Number(e.target.value) })} className="flex-1" />
                </label>
                <label className="flex flex-1 items-center gap-2">Tilt
                  <input type="range" min={-15} max={15} step={0.5} value={view.rot}
                    onChange={(e) => updateView({ rot: Number(e.target.value) })} className="flex-1" />
                </label>
                <button onClick={() => setView(defaultView())} className="rounded-full bg-white/10 px-3 py-1">Reset</button>
              </div>
              {filterLocked && (
                <div className="mt-1 rounded-lg bg-violet-950/60 p-3 text-sm">
                  <div className="font-semibold">🔒 {PREMIUM_FILTER_PACK.name} — {PREMIUM_FILTER_PACK.price} ORBITX (burned)</div>
                  {buyErr && <div className="mt-1 text-red-300">{buyErr}</div>}
                  <button onClick={buyFilterPack} disabled={buying}
                    className="mt-2 rounded-full bg-violet-600 px-5 py-2 text-sm disabled:opacity-50">
                    {buying ? "Burning…" : `Unlock for ${PREMIUM_FILTER_PACK.price} ORBITX`}
                  </button>
                  {!billing && <div className="mt-1 text-xs text-white/50">Wallet not connected — coming soon / auth required.</div>}
                </div>
              )}
              {/* shutter */}
              <div className="flex justify-center py-3">
                <button onClick={shutter} aria-label="Take photo"
                  className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/40" />
              </div>
            </div>
          )}

          {stage === "review" && (
            <div className="px-4 pb-6">
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption…"
                maxLength={120}
                className="mb-3 w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/40" />
              {saveErr && <div className="mb-3 rounded-lg bg-red-950/60 p-2 text-xs text-red-300">{saveErr}</div>}
              <div className="flex gap-2">
                {!shotId ? (
                  <button onClick={saveToGallery} className="flex-1 rounded-full bg-violet-600 py-3 text-sm font-semibold">💾 Save to gallery</button>
                ) : (
                  <button onClick={() => shotId && onShare(shotId)} className="flex-1 rounded-full bg-sky-600 py-3 text-sm font-semibold">𝕏 Share to X</button>
                )}
                <button onClick={() => { setStage("framing"); setExported(null); setShotId(null); setSaveErr(null); }}
                  className="flex-1 rounded-full bg-white/10 py-3 text-sm">↺ Retake</button>
                <button onClick={onClose} className="flex-1 rounded-full bg-white/10 py-3 text-sm">Done</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
