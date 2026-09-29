# MEDIA MODULE — OrbitXCity

Photo mode, gallery, share-to-X, live radio, drive-in movie theater.
GTA 6 vibes, realistic (not blocky), mobile-friendly.

**Exclusive area:** `web/src/city/modules/media/**`. No imports from other city
modules. **Never** import `@/tokenomics/*` — the directory doesn't exist yet
and the import would break the build.

## 1. File map

| File | What it is |
|---|---|
| `index.ts` | Public barrel — the integrator imports from here |
| `types.ts` | Shared types: adapter, billing provider, photo/radio/theater/settings |
| `store.ts` | Settings (`localStorage`) + React hook + internal `MediaRuntime` event bus |
| `photo.ts` | Freeze-frame photo math: filters, pan/zoom/rotate, JPEG export |
| `PhotoMode.tsx` | Photo-mode overlay: viewfinder, filter carousel, shutter, review |
| `gallery.ts` | localStorage gallery storage (quota-safe, newest-first, cap 60) |
| `Gallery.tsx` | Gallery browser: grid, detail view, download, delete, share |
| `share.ts` | Share-to-X: draft text builder, `x.com/intent/post` URL, photo download |
| `ShareToX.tsx` | Draft-then-approve composer: editable text, download-then-open-composer |
| `radio.ts` | `RadioController`: 3 generative-music stations + ORBITX CHATTER (Web Speech API) |
| `RadioHud.tsx` | Bottom-sheet radio HUD: station picker, volume, now-playing |
| `drivein.ts` | Drive-in lot 3D build (additive meshes), playlist, NOW SHOWING texture |
| `DriveInHud.tsx` | Theater overlay: video player, lineup, community submissions, "take me there" |

## 2. Feature status

- **Photo mode — BUILT.** World freeze via adapter → single frame capture →
  2D reframing (drag pan, two-pointer pinch zoom, wheel zoom via a native
  non-passive listener — React attaches `onWheel` as passive at the root, so
  the synthetic event's `preventDefault()` warns instead of working — rotate
  slider, thirds grid) → 6 filters (CSS strings baked into the JPEG export) →
  caption → gallery. Oversized shots surface a save error instead of failing
  silently (`addShot` returns false → "Shot too large to store").
- **Gallery — BUILT.** localStorage, JPEG data URLs downscaled to ≤1280px at
  save time, hard cap 60 shots, quota-overflow trims oldest first.
- **Share to X — BUILT (draft-then-approve).** Module composes the draft text,
  opens `x.com/intent/post` with the text pre-filled, and downloads the photo
  so the user attaches it in the X composer. The module **never posts by
  itself**. Media-upload via the platform's X OAuth write flow (authCode) is a
  documented upgrade path (§6) — not silent posting; the user still confirms.
- **Radio: NEON DRIVE / MIDNIGHT LOFI / BASS CITY — BUILT.** 100% generative
  Web Audio (oscillators + noise hats + 808 kicks, no audio files, no samples)
  — royalty-free by construction. Mobile requires a user gesture to start
  `AudioContext`; the HUD play button is that gesture.
- **Radio: ORBITX CHATTER — BUILT.** Reads aloud via the Web Speech API.
  Data path, in order: (1) real X timeline via the platform X MCP read-only
  tools (`x_user_tweets`) when the integrator injects an X `authCode` (same
  dashboard paste flow the billing contract uses); (2) live market commentary
  generated from the game's real price feed (`setMarketQuotes`); (3) honest
  fallback line saying no live feed is connected. No mocked tweets, ever.
- **Drive-in theater — BUILT.** `buildDriveIn(scene, spot)` places the lot
  additively (screen, poles, lot, slot markers, projector glow, marquee strip).
  `DriveInHud` plays the playlist (official trailer slot + community clips via
  `setPlaylist()`/`addCommunityClip()`), swaps the in-world screen to a NOW
  SHOWING canvas texture while a clip plays, and teleports the player to the
  lot on "take me there".

## 3. Integrator wiring

```tsx
import {
  PhotoMode, Gallery, ShareToX, RadioHud, DriveInHud,
  buildDriveIn, setPlaylist, type MediaWorldAdapter, type MediaBillingProvider,
} from "@/city/modules/media/index"; // or relative: ../../city/modules/media

const adapter: MediaWorldAdapter = {
  getCanvas: () => canvasRef.current,
  captureFrame: () => {
    // call inside the same rAF as the world render, or use preserveDrawingBuffer
    const gl = renderer.domElement;
    return renderer.domElement.toDataURL("image/png");
  },
  setPaused: (p) => world.setPaused(p),
  teleport: (x, z, heading) => player.teleport(x, z, heading),
  getPlayerSnapshot: () => ({ pos, heading, speedKmh, isNight }),
};

// drive-in lot (once): const build = buildDriveIn(scene, { x, z, heading, name });
// feed market quotes to chatter: radioCtrlRef.setMarketQuotes(quotes)
// community playlist: setPlaylist(await fetchCommunityClips())
```

Mount `PhotoMode` on camera button / `P` key with `billing` (or `null` until
tokenomics lands — premium UI then shows "wallet auth required").

## 4. Billing (per `web/src/city/BILLING_CONTRACT.md`)

- The module codes against the **`MediaBillingProvider`** interface in
  `types.ts`, which mirrors the contract's expected primitive
  (`ready`, `balance`, `spend({amount, reason, ref})`, `beginAuth()`).
- Until `@/tokenomics/useOrbitxBilling` exists, the integrator passes
  `billing={null}`: premium UI renders "coming soon / auth required" and
  **no parallel burn path is built**.
- Current premium item: `PREMIUM_FILTER_PACK` ("Night Ops" filter pack) —
  **10 whole ORBITX, burned**, reason `city:media:filter-pack`, idempotency
  ref via `crypto.randomUUID()`.
- **Rule #20:** every in-game purchase burns. The premium pack is a burn, not
  a transfer. Free features (photo mode, gallery, radio, theater) cost nothing.
- Currency split respected: no paper CITY ledger in this module (no earnings);
  real ORBITX only for the premium filter pack.

## 5. Core API needs (camera frame capture hooks)

Photo mode v1 needs **zero core changes** — it works on a frozen 2D frame.
To upgrade to a true free-orbit 3D photo camera later, core would need to
expose (not yet requested as a build task):

1. A way to capture the current GL frame reliably — either core renders with
   `preserveDrawingBuffer: true` (perf cost) or core exposes a
   `captureFrame(): string | null` that runs inside the world's own rAF.
2. A camera detach/reattach hook: pause the follow camera, hand a free-orbit
   camera to photo mode, restore on exit.
3. Optional: world-pause that keeps rendering one final frame (traffic/peds
   frozen but scene visible) instead of a full loop halt.

Until then, the freeze-frame + 2D reframe pass in `photo.ts` is the shipped
approach — it reads as a real camera reframing pass to the player.

## 6. Assumptions & caveats

- **localStorage keys (module-owned):** `orbitxcity.media.settings.v1`,
  `orbitxcity.media.gallery.v1`. ~4.5MB budget enforced by the 60-shot cap +
  per-shot char cap + oldest-first trimming on quota errors.
- **Chatter MCP read path:** `POST https://www.orbitx.world/api/x/mcp`
  (JSON-RPC `tools/call`, tool `x_user_tweets`, args `{username, max_results,
  authCode}`), envelope parsed shape-tolerantly. If the platform changes the
  envelope, `extractLines` degrades to the market-commentary path — it never
  invents tweets.
- **Chatter accounts** default to `["orbitx_wrld"]` (matches the platform's
  no-auth watcher policy); extend the list in `radio.ts` if more handles are
  wanted.
- **Trailer slot URLs** (`https://www.orbitx.world/trailer.mp4`,
  `trailer-poster.jpg`) are placeholders until the real trailer ships —
  replace via `setPlaylist()`; the module never hardcodes mock video content.
- **Mobile:** all overlays are bottom-sheets, touch-action tuned, pinch zoom
  on the viewfinder via pointer events; radio `AudioContext` starts on the
  HUD play tap (autoplay policy).
- **Events:** `MediaRuntime` emits `photo-mode`, `radio`, `theater`,
  `shot-saved` for HUD coordination — no prop drilling, no other-module deps.
