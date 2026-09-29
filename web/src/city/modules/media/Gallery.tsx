/**
 * MEDIA MODULE — gallery browser (localStorage shots).
 */
import { useState } from "react";
import type { GalleryShot } from "./types";
import { getFilter } from "./photo";
import { listShots, removeShot } from "./gallery";
import { downloadPhoto, shotFilename } from "./share";

interface GalleryProps {
  onClose: () => void;
  onShare: (shot: GalleryShot) => void;
}

export function Gallery({ onClose, onShare }: GalleryProps) {
  const [shots, setShots] = useState<GalleryShot[]>(() => listShots());
  const [active, setActive] = useState<GalleryShot | null>(null);

  function del(id: string) {
    removeShot(id);
    setShots(listShots());
    setActive(null);
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => (active ? setActive(null) : onClose())} className="rounded-full bg-white/10 px-4 py-2 text-sm">
          {active ? "‹ Back" : "✕ Close"}
        </button>
        <div className="text-xs uppercase tracking-[0.3em] text-white/60">Gallery · {shots.length}</div>
        <div className="w-16" />
      </div>

      {!active && (
        shots.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="text-5xl">📷</div>
            <p className="text-white/60">No shots yet. Open photo mode and freeze a frame.</p>
            <button onClick={onClose} className="rounded-full bg-violet-600 px-6 py-2 text-sm">Back to the city</button>
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-3 gap-1 overflow-y-auto p-1">
            {shots.map((s) => (
              <button key={s.id} onClick={() => setActive(s)} className="relative aspect-square overflow-hidden">
                <img src={s.dataUrl} alt={s.caption} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )
      )}

      {active && (
        <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-6">
          <img src={active.dataUrl} alt={active.caption} className="w-full rounded-xl object-contain" />
          <div className="mt-3">
            <div className="font-semibold">{active.caption || "Untitled"}</div>
            <div className="mt-1 text-xs text-white/50">
              {new Date(active.createdAt).toLocaleString()} · {getFilter(active.filter).name} · {active.width}×{active.height}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onShare(active)} className="flex-1 rounded-full bg-sky-600 py-3 text-sm font-semibold">𝕏 Share</button>
            <button onClick={() => downloadPhoto(active.dataUrl, shotFilename(active))}
              className="flex-1 rounded-full bg-white/10 py-3 text-sm">⬇ Download</button>
            <button onClick={() => del(active.id)} className="rounded-full bg-red-900/60 px-5 py-3 text-sm">🗑</button>
          </div>
        </div>
      )}
    </div>
  );
}
