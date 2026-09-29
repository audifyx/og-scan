/**
 * MEDIA MODULE — drive-in theater overlay.
 *
 * HTML video player HUD for the in-world drive-in lot built by buildDriveIn().
 * Playlist = official trailer slot + community clips fed via setPlaylist() /
 * addCommunityClip() by the integrator (community submissions endpoint).
 *
 * "Take me there" teleports the player to the lot via the adapter. While a
 * clip plays, the in-world screen texture is swapped to a NOW SHOWING card.
 */
import { useEffect, useRef, useState } from "react";
import { FALLBACK_DRIVE_IN, addCommunityClip, getPlaylist, onPlaylistChange, setNowShowing } from "./drivein";
import type { DriveInBuild } from "./drivein";
import type { DriveInSpot, MediaWorldAdapter, MovieClip } from "./types";
import { MediaRuntime } from "./store";

interface DriveInHudProps {
  adapter: MediaWorldAdapter;
  /** Build handle from buildDriveIn() — enables the in-world NOW SHOWING texture. */
  build?: DriveInBuild | null;
  /** Where the lot lives (used by "take me there"). Defaults to FALLBACK_DRIVE_IN. */
  spot?: DriveInSpot;
  onClose: () => void;
}

export function DriveInHud({ adapter, build = null, spot = FALLBACK_DRIVE_IN, onClose }: DriveInHudProps) {
  const [clips, setClips] = useState<MovieClip[]>(() => getPlaylist());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => onPlaylistChange(() => setClips(getPlaylist())), []);

  const current = clips.find((c) => c.id === currentId) ?? null;

  function play(clip: MovieClip) {
    setVideoErr(null);
    setCurrentId(clip.id);
    if (build) setNowShowing(build, clip.title);
    MediaRuntime.emit({ type: "theater", playing: true, clipId: clip.id });
    // autoplay once the element mounts with the new src
    requestAnimationFrame(() => videoRef.current?.play().catch(() => { /* user gesture needed */ }));
  }

  function stop() {
    videoRef.current?.pause();
    setCurrentId(null);
    MediaRuntime.emit({ type: "theater", playing: false, clipId: null });
  }

  function takeMeThere() {
    adapter.teleport(spot.x, spot.z, spot.heading);
    onClose();
  }

  function submitClip() {
    const title = newTitle.trim();
    const url = newUrl.trim();
    if (!title || !url) return;
    if (!/^https?:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(url)) {
      setVideoErr("Link must be a direct https mp4/webm URL.");
      return;
    }
    addCommunityClip({
      id: `community_${Date.now().toString(36)}`,
      title,
      by: "community",
      src: url,
    });
    setNewTitle("");
    setNewUrl("");
    setVideoErr(null);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-zinc-950 text-white sm:rounded-3xl">
        {/* marquee header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-violet-900 via-fuchsia-900 to-violet-900 px-5 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-200/80">★ {spot.name} ★</div>
            <div className="text-lg font-bold tracking-wide">NOW SHOWING</div>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-sm">✕</button>
        </div>

        <div className="overflow-y-auto px-4 pb-5">
          {/* player */}
          {current ? (
            <div className="mt-3">
              <video ref={videoRef} key={current.id} src={current.src} poster={current.poster}
                controls playsInline className="aspect-video w-full rounded-xl bg-black"
                onError={() => setVideoErr("Couldn't load this clip — the link may be dead or blocked.")}
                onEnded={stop} />
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{current.title}</div>
                  <div className="text-xs text-white/50">by {current.by}</div>
                </div>
                <button onClick={stop} className="rounded-full bg-white/10 px-4 py-2 text-sm">⏹ Stop</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-white/20 p-6 text-center text-sm text-white/50">
              🎬 Pick a clip below to start the show.
            </div>
          )}
          {videoErr && <div className="mt-2 rounded-lg bg-red-950/60 p-2 text-xs text-red-300">{videoErr}</div>}

          {/* playlist */}
          <div className="mt-4 text-xs uppercase tracking-[0.25em] text-white/50">Tonight's lineup</div>
          <div className="mt-2 space-y-2">
            {clips.map((c) => (
              <button key={c.id} onClick={() => play(c)}
                className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${c.id === currentId ? "bg-violet-950/70 ring-1 ring-violet-500" : "bg-white/5"}`}>
                <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
                  {c.poster
                    ? <img src={c.poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                    : <span className="text-2xl">🎞</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.title}</div>
                  <div className="text-xs text-white/50">by {c.by}{c.durationSec ? ` · ${Math.round(c.durationSec / 60)} min` : ""}</div>
                </div>
                <span className="pr-2 text-xl">{c.id === currentId ? "⏸" : "▶"}</span>
              </button>
            ))}
          </div>

          {/* community submissions */}
          <div className="mt-4 text-xs uppercase tracking-[0.25em] text-white/50">Submit a clip</div>
          <div className="mt-2 space-y-2 rounded-xl bg-white/5 p-3">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Clip title"
              maxLength={80} className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/40" />
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="Direct mp4/webm link (https://…)"
              inputMode="url" className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/40" />
            <button onClick={submitClip} className="w-full rounded-full bg-violet-600 py-2 text-sm font-semibold">
              ➕ Add to tonight's lineup
            </button>
            <p className="text-[11px] text-white/40">Clips are community-provided. The integrator can also feed the playlist from a submissions endpoint via setPlaylist().</p>
          </div>

          {/* teleport */}
          <button onClick={takeMeThere}
            className="mt-4 w-full rounded-full bg-fuchsia-700 py-3 text-sm font-semibold">
            🚗 Take me to the drive-in
          </button>
        </div>
      </div>
    </div>
  );
}
