# OrbitX City — Gameplay Systems (Worker 3) · INTEGRATION.md

GTA-style open-world gameplay: missions, economy, wanted/heat, health,
reactive NPCs/traffic, and the HUD wiring. Everything below is live code —
no dead buttons, no placeholder panels.

## Stores (zustand — any component can use these)

### `missionStore.ts` — mission state machine
- `defs: MissionDef[]` — available missions, rebuilt per district via `setCity(cityId)`.
- `active: MissionInstance | null` — the current run (defId, startedAt, deadline, objectiveIndex, shardsAtStart, progress).
- `startMission(id, shardsNow)` → false if a run is already active.
- `advanceObjective()` — auto-completes (with payout) past the last objective.
- `setProgress(n)` — collector shard count; auto-completes at the target.
- `completeMission()` — pays `def.payout` into the economy, records history.
- `abortMission(failed?)` — `failed=true` adds +18 heat.
- `shiftDeadline(ms)` — pushes the timer forward (used on unpause/respawn).
- `history: MissionHistoryEntry[]` — last 24 runs (completed/failed/aborted).
- `useActiveMission()` helper returns `{ def, instance } | null`.

### `economyStore.ts` — credits (persisted)
- LocalStorage key `oxc-economy`. Starts at 500 credits.
- `credits`, `addCredits(n, reason)`, `spendCredits(n, reason)` (false if insufficient).
- `events` — last 40 ledger entries (at, delta, reason, balance).
- Mission payouts credit here. **Game credits only — never on-chain, never real ORBITX.**

### `gameStore.ts` — health / heat / motion (session only)
- `health` 0–100, `heat` 0–100, `speed` m/s (refreshed ~5 Hz by the director), `inCar`.
- `stars = ceil(heat/20)` (0–5). Cops deploy at 4+ stars.
- `damage(n)`, `addHeat(n)`, `tick(dt)` (heat decay after 4 s calm; HP regen after 8 s calm & heat < 20), `respawn()`, `setPaused(v)`, `cops: CopCar[]`.
- `gameOver` + `gameOverAt` for the WASTED flow.
- `readVehicleTelemetry()` — reads `window.__oxc_vehicle` if the vehicle system publishes it.

## Missions (`missions.ts`)

Four real missions, all coordinates **computed from the active `WorldBlockConfig`**
(spawn / bounds / streets via `getWorldBlock` + `getWorldStreets`, seeded RNG per
city, `collidesAt`-checked). Nothing is hardcoded to one district.

| id | name | type | timer | payout |
|---|---|---|---|---|
| `midtown-drop` | Midtown Drop | 📦 delivery to far drop-off | 100 s | 250 |
| `neon-sprint` | Neon Sprint | 🏁 checkpoints in order (5, from longest streets) | 150 s | 400 |
| `shard-rush` | Shard Rush | 💠 collect 6 coin shards (live `CoinField`/`collectShard` integration) | 180 s | 300 |
| `cab-runner` | Cab Runner | 🚕 pick up fare → drive to destination | 150 s | 350 |

Start a mission from the **Contracts** button (top bar), the Contracts board, or
by walking to a green ❗ beacon and pressing **E** (capture-phase, wins over the
talk prompt). Objectives are tracked live in the HUD (name, objective/progress,
countdown, distance, bearing arrow ▲ rotated by `playerYaw`).

Fail conditions: timer expiry (toast + heat +18), abort (no heat), busted
(mission void), WASTED (run survives; timer shifted by time spent down).

## Heat / wanted / cops

- Reckless: speed > 12.6 m/s (above max on-foot sprint) within 7 m of a
  pedestrian → +10 heat (2.5 s cooldown per event).
- Crash (speed > 9 → sudden stop): damage `10 + speed*0.7`, +8 heat.
- Mission fail: +18 heat. Heat decays 5/s after 4 s without trouble.
- 4–5 stars: 2 cop cars spawn on the nearest streets and chase (13.5 m/s, simple
  obstacle slide). Held within 3.4 m at < 3 m/s for 1.2 s → **BUSTED**:
  15% credit impound, heat cleared, mission void, respawn at district spawn.
- Cops stand down below 30 heat.

## Health

- Damage from high-speed crashes and (future) cop rams. Regen 2.5/s when calm.
- HP 0 → **WASTED** overlay: respawn at spawn, −10% credits hospital bill.
- "Stuck?" button and `resetPlayer()` still work as before.

## World reactions

- `NPCs.tsx`: pedestrians **flee** (4.6 m/s away, "AHH!" barks) when a fast car
  approaches (< 11 m) or heat ≥ 60 (< 13 m); resume wandering after 1.6 s calm.
  Exports `getLiveNpcPositions()` for the minimap + reckless checks.
- `Traffic.tsx`: cars **brake** (stop + flashing brake light) when the player is
  ~5.5 m ahead on their lane. Exports `getLiveCarPositions()` for the minimap.

## HUD (`CityHUD.tsx`)

- Vitals cluster (top-left): HP bar, 5 wanted stars, credit balance.
- Mission tracker: name, current objective + progress, countdown (red < 30 s),
  bearing arrow + distance, payout.
- Speed readout when driving (`inCar && speed > 2`).
- **ORBITX price chip** — live `fetchTokenDetail(ORBITX_MINT)`, read-only display.
- Contracts board (Flag button): full briefings, start/abort, run history.
- **Esc pause menu**: Resume, Restart mission, Contracts, Settings, Quit to menu
  (`exitToMenu()`). Pause freezes the mission timer via `shiftDeadline`.
- WASTED overlay on HP 0.

## Minimap (`Minimap.tsx`)

Adds: pulsing gold objective diamond + dashed guide line, green start beacons
(when idle), white NPC dots, orange traffic dots, red/blue cop dots, and the
objective distance in the caption.

## 3D (`MissionMarkers.tsx`)

Single exported component — the coordinator mounts it once inside the R3F
canvas (alongside CoinField/Traffic/NPCs). Contains:
- `MissionDirector` — per-frame: city sync, motion estimate, crash/reckless
  detection, mission proximity/timers, shard progress, cop chase + bust logic.
- `StartBeacons` — green light pillars + ❗ tags.
- `ObjectiveBeacon` — colored pillar, pulsing arrival ring, floating icon/label.
- `CopCars` — chase-car meshes with red/blue light bars.

## Vehicle integration contract (for the vehicle worker)

Publish telemetry so gameplay reacts to driving:
```ts
window.__oxc_vehicle = { inCar: true, speed: 18.2 };
```
- `inCar` drives the HUD speed readout and (with speed) reckless/crash logic.
- Without it, speed is estimated from `playerPos` deltas — everything still works on foot.
- `vehicleStore` (`@/lib/orbitxcity/vehicleStore`) did not exist at build time;
  nothing imports it. If it appears, prefer it over the window registry.

## What was cut / deferred and why

- **Cop ramming damage** — cops chase and bust; contact damage skipped to avoid
  cheap unavoidable deaths while cornered. Revisit after vehicle physics lands.
- **Mission start locked to beacons only** — rejected; the Contracts board starts
  runs anywhere so no button is ever dead.
- **Legacy one-shot claim board** (`CityProvider.claimMission`) — untouched; a
  separate system owned by another worker.
- **Cinematic wanted music / sirens** — audio files are another worker's; the
  director plays existing `cityAudio` cues (`confirm`/`coin`/`error`).
- **True screen-space off-screen arrow** — the tracker card's bearing arrow
  (▲ rotated by player yaw) covers direction-finding without canvas projection.

---

# OrbitX City — Audio + UX (Worker 4) · INTEGRATION.md

Owner files: `cityAudio.ts`, `saveGame.ts`, `useCityAudioEvents.ts`,
`input.ts` (driving extension), `ui/{CityAudioController,CitySaveController,
TouchControls,SettingsPanel,LoadingScreen}.tsx`.

Mount these two controllers next to each other in OrbitxCityPage (both render nothing):
```tsx
<CityAudioController />   {/* audio unlock, theme beds, heat→siren, engine/footstep loop */}
<CitySaveController />    {/* load save on world entry, debounced autosave */}
```

## 1. Audio API (`cityAudio` singleton)

All synthesized WebAudio — no audio assets. `cityAudio.unlock()` on first
gesture; `LoadingScreen`'s Enter City button unlocks before `onEnter()`.

**One-shot SFX** — `cityAudio.sfx(kind)` (alias of `play(kind)`).
`SfxKind` = `"ui" | "confirm" | "interact" | "coin" | "enter" | "deny" | "error" |
"whoosh" | "missionStart" | "missionComplete" | "missionFail" | "crash" | "horn"`.
Note: `"error"` was added for the mission director's existing
`cityAudio.play("error")` calls (it wasn't in the old union — TS-clean now).

**Continuous sounds**
- Engine hum: `engineStart()` / `engineSetSpeed(v: 0..1)` / `engineStop()`.
  The rAF loop in `useCityAudioEvents()` registers the vehicle store as the
  speed source (`|speed| / topSpeed` of the active car while `mode === "driving"`)
  and starts/stops/pitches the hum automatically. SFX bus.
- Footsteps: `cityAudio.footstep()` (110ms internal throttle). The character
  worker may call it per step; fallback cadence (430ms walk / 300ms sprint)
  already runs from `virtualInput` axes in the same loop.
- Wanted siren: `cityAudio.setHeat(heat: 0..100)` — siren loop starts at
  heat ≥ 60 (3 stars), stops below. `CityAudioController` subscribes to
  `useGameStore` heat and forwards it; no gameplay action needed.
- Ambient city bed: world mode pad + traffic hiss, plus a random distant horn
  or passing siren every ~9–26s at low volume through the ambient bed.

**Volumes**: `setMusicOn/Vol`, `setSfxOn/Vol` (existing buses) + new **master
mute** `setMasterMuted(on)` (kills master gain: music + sfx + engine + siren),
persisted as `oxc_master_muted`, snapshot field `muted`. SettingsPanel has
the switch.

## 2. Touch driving contract (`input.ts`)

`virtualInput` gained: `driving: boolean`, `steer: -1..1`, `throttle: 0..1`,
`brake: 0..1`. The vehicle worker already calls `setDrivingMode(true/false)`
on enter/exit (completeEnter/exitCar) — TouchControls swaps to steering
buttons (left) + gas/brake pedals (right) + E via `subscribeDriveMode`, and
writes analog input through `setDrive()`. `resetVirtualInput()` now also
zeroes the drive fields.

## 3. Save game (`saveGame.ts`, key `oxc-save-v1`)

```ts
{ version: 1, credits, avatar: AvatarAppearance, selectedCityId,
  quality: "high"|"lite", touchControls, audio: { masterMuted, musicOn, sfxOn, musicVol, sfxVol, trackId },
  missions: { completedIds, completions: Record<id, count>, lastCompletedAt }, updatedAt }
```
- **Credits**: source of truth is `economyStore` (`oxc-economy`). Every
  `saveGame()` snapshots `useEconomyStore.getState().credits`; on load,
  `restoreEconomyCredits()` balances the economy to the saved value (ledgered
  as "save restore"). The HUD credit balance is untouched.
- `CitySaveController` applies the save once on first `entered === true`
  (quality/touch/city/avatar via provider setters, credits via economy,
  audio prefs into `cityAudio`, claimed-mission union back to the provider's
  `oxc_claimed_missions` key) and then debounced-autosaves (500ms) on
  avatar/city/quality/touch/audio changes plus `useMissionStore` /
  `useEconomyStore` updates (mission start/complete/abort and payouts).
- `recordMissionComplete(id)` is available if a worker wants an explicit
  auto-save hook; SettingsPanel's Reset Save calls `resetSave()`.

## 4. Settings (SettingsPanel)

Adds: **master mute** switch and **Reset save** button. Quality High/Lite,
music/sfx toggles + sliders, and touch-controls toggle wire to the existing
`useCity()` setters / `cityAudio` prefs as before.

## 5. LoadingScreen (`ui/LoadingScreen.tsx`)

Props `{ progress?: number | null, status?: string, ready: boolean, onEnter }`.
Real progress drives the bar; otherwise a staged fake-but-fast bar climbs to
92% and parks until `ready`. Rotating tips; **Enter City unlocks WebAudio
first** (`await cityAudio.unlock()` + `play("enter")`). Self-contained styling
(inline + own spin keyframes), no `city.css` dependency.

## 6. PWA (InstallCityPWA)

Verified working, unchanged: manifest linked from `app.html` + `index.html`,
`public/sw.js` registered on load, `beforeinstallprompt` flow + iOS hint +
standalone detection intact.

## Cut / deferred and why

- Engine from touch throttle: skipped — the hum reads the vehicle store, so
  keyboard/gamepad driving sounds identical without a second path.
- `play("error")` for the mission director: added as its own cue instead of
  aliasing "deny", since Worker 3's code already called it.
- Settings Reset doesn't wipe `oxc-economy` or audio keys — live prefs owned
  by other systems; reset only removes `oxc-save-v1`.
