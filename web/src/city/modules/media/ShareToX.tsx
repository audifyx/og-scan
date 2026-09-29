/**
 * MEDIA MODULE — share-to-X composer.
 *
 * Draft-then-approve: composes the post text, opens the X web composer with the
 * draft pre-filled, and downloads the photo so the user attaches it in X.
 * The module never posts to X by itself.
 */
import { useState } from "react";
import type { GalleryShot } from "./types";
import { buildShareText, downloadPhoto, shotFilename, xIntentUrl } from "./share";

interface ShareToXProps {
  shot: GalleryShot;
  onClose: () => void;
}

export function ShareToX({ shot, onClose }: ShareToXProps) {
  const [text, setText] = useState(() => buildShareText(shot));
  const [downloaded, setDownloaded] = useState(false);

  function openComposer() {
    window.open(xIntentUrl(text), "_blank", "noopener,noreferrer");
  }

  function handleDownload() {
    downloadPhoto(shot.dataUrl, shotFilename(shot));
    setDownloaded(true);
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-zinc-900 p-5 text-white sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">𝕏 Share to X</div>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-sm">✕</button>
        </div>
        <img src={shot.dataUrl} alt={shot.caption} className="mb-3 max-h-48 w-full rounded-lg object-cover" />
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} rows={5}
          className="mb-1 w-full rounded-lg bg-white/10 p-3 text-sm outline-none" />
        <div className="mb-3 text-right text-xs text-white/40">{text.length}/280</div>
        <button onClick={handleDownload}
          className={`mb-2 w-full rounded-full py-3 text-sm font-semibold ${downloaded ? "bg-emerald-700" : "bg-white/10"}`}>
          {downloaded ? "✓ Photo downloaded" : "⬇ 1. Download photo"}
        </button>
        <button onClick={openComposer} className="w-full rounded-full bg-sky-600 py-3 text-sm font-semibold">
          2. Open X composer with this draft
        </button>
        <p className="mt-3 text-xs leading-relaxed text-white/50">
          X opens with your text pre-filled — you confirm the post there. Attach the
          downloaded photo in the composer. Nothing posts automatically.
        </p>
      </div>
    </div>
  );
}
