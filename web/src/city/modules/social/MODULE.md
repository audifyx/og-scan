# OrbitXCity — Social Module

GTA-style social life for OrbitXCity: in-game phone (calls, texts, camera,
in-world web), a LifeInvasion-style social feed driven by REAL market data, a
Channel 6 news channel (real events only), rooftop parties with a live
generative WebAudio DJ, beach bonfires + firm recruiting, camping with a
campfire voice channel, a comedy club with open-mic sets, the ownable
nightclub, and weekly docks car meets. Self-contained under
`web/src/city/modules/social/**` — no imports from other city modules, core,
or `@/tokenomics` (only `@/tokenomics` mentions are comments in
`billing.ts` and `NightclubUi.tsx`). Only external deps: `react`, and
`livekit-client` via dynamic import — only if the integrator constructs
`LiveKitVoiceProvider` (never in the initial bundle).

## Files

| File | What it is |
|---|---|
| `index.ts` | Public API (re-exports everything the integrator needs); imports `./styles.css` |
| `types.ts` | Shared types: `TokenDrama`, `NpcProfile`, `FeedPost`, `NewsItem`, phone types (`PhoneContact`, `PhoneMessage`, `PhoneCall`, `PhonePhoto`, `PhoneAppId`, `PhoneSnapshotFn`), `Venue`/`HangoutEvent`/`FirmRecruit`, `NightclubState`/`DjBooking`, `ComedySet`/`OpenMicSlot`, `CarMeetEntry`/`CarMeetEvent`, voice types, `SocialBilling`, `SocialModuleProps` |
| `billing.ts` | Defensive billing adapter: `injectSocialBilling` / `useSocialBilling` / `premiumButtonState`. NEVER imports `@/tokenomics/*` |
| `styles.css` | All `oxs-*` classes (imported by the barrel) |
| `components/SocialHub.tsx` | Tabbed full-screen mount: `SocialTab` = feed \| news \| party \| beach \| camp \| comedy \| club \| cars |
| `components/PhoneUi.tsx` | In-game phone overlay (8 apps); opened from the integrator's HUD button |
| `components/FeedUi.tsx` | LifeInvasion feed UI (composer, posts, trending sidebar) |
| `components/NewsUi.tsx` | Channel 6 news UI |
| `components/PartyUi.tsx` | Rooftop party UI (DJ start/stop/volume/genre) |
| `components/BeachUi.tsx` | Beach bonfire hangout + recruit hiring UI |
| `components/CampUi.tsx` | Campsite + campfire voice UI |
| `components/ComedyUi.tsx` | Comedy club: NPC sets + open-mic signup/recording UI |
| `components/NightclubUi.tsx` | Ownable nightclub UI (buy/lease, DJ booking, cover, hype, nightly reports) |
| `components/CarMeetUi.tsx` | Weekly car meet UI (entries, judging results, prize pool) |
| `components/VoiceChannelPanel.tsx` | Voice channel UI (push-to-talk, mute, mic meter) |
| `components/NpcAvatar.tsx` | Avatar: gradient-disc initials fallback (`initials` + `hue`) |
| `data/socialData.ts` | `NPCS`, `VENUES`, `DJ_ROSTER`, `COMEDY_SETS`, `RECRUIT_POOL`, `PHONE_CONTACTS`, `CALL_SCRIPTS`, `IN_WORLD_SITES`, `npcById`, `venueById` |
| `data/venueCoords.ts` | `VENUE_COORDS`, `venueCoord` (placeholder grid coords — see Assumptions) |
| `engine/feedEngine.ts` | `buildFeed`, `trendingFromDrama` — feed content from `TokenDrama[]` only |
| `engine/newsEngine.ts` | `buildNews` — Channel 6 items from `TokenDrama[]` only |
| `engine/dramaAdapter.ts` | `dramaFromPrices`, `ORBITX_MINT`, `DramaMeta`, `LivePriceLike` — live-quote → `TokenDrama[]`, drops mints with no quote |
| `engine/hangoutEngine.ts` | `getHangoutStatus`, `getCarMeetWindow`, `getOpenMicWindow`, `fmtCountdown` — schedule logic on player-local time |
| `engine/djEngine.ts` | `startDjSet`, `genreForDj`, `DJ_GENRES`, `DjGenre`/`DjHandle` — WebAudio 16-step generative sequencer, 5 genres, zero audio assets |
| `engine/nightclubEngine.ts` | `simulateNight`, `hypeCost`, `defaultClubState`, `CLUB_PRICE_ORBITX` (25), `CLUB_LEASE_CITY` (10,000), `NightResult` |
| `engine/carMeetEngine.ts` | `scoreEntry`, `judgeMeet`, `currentMeetId`, `CAR_MEET_CATEGORIES`, `CAR_MEET_ENTRY_FEE_CITY`, `NPC_MEET_ENTRIES`, `JudgedEntry` |
| `engine/comedyEngine.ts` | `startSetRecording`, `npcCrowdScore`, `playerCrowdScore`, `RecordedSet` — local MediaRecorder, session-scoped blob URLs |
| `engine/paperLedger.ts` | `paperLedger`, `PaperTx` — local paper-CITY ledger |
| `engine/voiceArchitecture.ts` | `VoiceProvider` seam: `LocalVoiceStub` (default) + `LiveKitVoiceProvider` (dynamic import; GAP-1…GAP-4 marked) |
| `hooks/useSocialFeed.ts` | `useSocialFeed` — composer + likes persistence + feed build |
| `hooks/useNews.ts` | `useNews` — news build + read state |
| `hooks/usePhone.ts` | `usePhone` — calls/texts/camera/gallery state, scripted NPC replies |
| `hooks/useHangouts.ts` | `useHangouts` — hangout schedules/status |
| `hooks/useNightclub.ts` | `useNightclub` — ownership, DJ booking, cover, nightly simulation |
| `hooks/useCarMeet.ts` | `useCarMeet` — entries, weekly bucket, judging |
| `hooks/useComedy.ts` | `useComedy`, `NpcSetView` — sets, open-mic slots, recording |
| `hooks/useRecruits.ts` | `useRecruits` — beach firm recruiting, daily wage claims (paper CITY) |
| `hooks/useVoice.ts` | `useVoice`, `UseVoiceOpts` — channel join, push-to-talk, mute-by-default |

## Public API (from `index.ts`)

```tsx
import {
  // mounts
  SocialHub, PhoneUi,                 // main UI mounts
  // surfaces
  FeedUi, NewsUi, PartyUi, BeachUi, CampUi, ComedyUi,
  NightclubUi, CarMeetUi, VoiceChannelPanel, NpcAvatar,
  // hooks
  useSocialFeed, useNews, usePhone, useHangouts, useNightclub,
  useCarMeet, useComedy, useRecruits, useVoice,
  // engines (pure logic)
  buildFeed, trendingFromDrama, buildNews, dramaFromPrices, ORBITX_MINT,
  getHangoutStatus, getCarMeetWindow, getOpenMicWindow, fmtCountdown,
  startDjSet, genreForDj, DJ_GENRES,
  simulateNight, hypeCost, defaultClubState,
  CLUB_PRICE_ORBITX, CLUB_LEASE_CITY,
  scoreEntry, judgeMeet, currentMeetId,
  CAR_MEET_CATEGORIES, CAR_MEET_ENTRY_FEE_CITY, NPC_MEET_ENTRIES,
  paperLedger, startSetRecording, npcCrowdScore, playerCrowdScore,
  createVoiceProvider, LocalVoiceStub, LiveKitVoiceProvider,
  // billing
  injectSocialBilling, useSocialBilling, premiumButtonState,
  // data
  NPCS, VENUES, DJ_ROSTER, COMEDY_SETS, RECRUIT_POOL,
  PHONE_CONTACTS, CALL_SCRIPTS, IN_WORLD_SITES,
  npcById, venueById, VENUE_COORDS, venueCoord,
} from "@/city/modules/social";
// plus: export type * from "./types" (all shared types incl. SocialBilling)
```

## Feature status (all 9 approved ideas)

| # | Idea | Status | Files | Notes |
|---|---|---|---|---|
| 1 | In-game phone | **BUILT** | `PhoneUi`, `usePhone`, `socialData` (contacts/scripts/sites) | 8 apps: calls (outgoing + simulated incoming NPC calls, scripted subtitle lines, ringing → active → ended), texts (scripted delayed NPC replies, persisted threads), camera (integrator-fed `PhoneSnapshotFn` → canvas snapshot → gallery in localStorage, captions), in-game web (`IN_WORLD_SITES` surfable pages), LifeInvasion + Channel 6 embedded apps, maps (venue list → teleport), settings. Contacts: `PHONE_CONTACTS` |
| 2 | LifeInvasion feed | **BUILT** | `FeedUi`, `useSocialFeed`, `feedEngine`, `dramaAdapter` | Player composer (280 chars, persisted), like persistence, trending sidebar via `trendingFromDrama`. NPC posts come **only** from real market data: pump ≥ +8% 24h, dump ≤ −8%, volume spikes ≥ $5M (`PUMP_T`, `DUMP_T`, `VOLUME_SPIKE_USD` in `feedEngine.ts`). Flavor banter never invents prices |
| 3 | News channel | **BUILT** | `NewsUi`, `useNews`, `newsEngine` | Channel 6 items derived from live `TokenDrama` only: BREAKING at ≥ ±10% 24h, DEVELOPING at ±5%, whale-volume ≥ $20M. Calm recap when nothing moves. No prices ever invented |
| 4 | Rooftop parties | **BUILT** | `PartyUi`, `useHangouts`, `hangoutEngine`, `djEngine` | Live generative DJ audio: `djEngine` is a WebAudio 16-step sequencer (5 genre patterns — synthwave, hard techno, deep house, glitch/bass, lo-fi house). Zero audio assets, no network, works offline and on mobile. `PartyUi` wires start/stop/volume/genre |
| 5 | Beach parties | **BUILT** | `BeachUi`, `useHangouts`, `useRecruits`, `RECRUIT_POOL` | Bonfire hangout schedule (Sat 19:00–23:00 player-local) + **firm recruiting**: hire NPC recruits from `RECRUIT_POOL` (signing bonus in paper CITY), each earns a daily wage claim (`useRecruits`, paper only) |
| 6 | Camping | **BUILT** | `CampUi`, `useHangouts`, `useVoice`, `VoiceChannelPanel`, `voiceArchitecture` | Campsite hangout (Sat–Sun) with campfire voice channel UI: push-to-talk, mute-by-default, mic meter. Multiplayer-ready architecture; gaps marked GAP-1…GAP-4 in `voiceArchitecture.ts` (see below) |
| 7 | Comedy club | **BUILT** | `ComedyUi`, `useComedy`, `comedyEngine` | NPC sets with timing playback (`npcCrowdScore`) + open-mic signup (weekly slots, `getOpenMicWindow`, Tue evenings) with **local-only MediaRecorder voice sets** (session-scoped blob URLs, no upload). Crowd scoring for NPC and player sets |
| 8 | Ownable nightclub | **BUILT** | `NightclubUi`, `useNightclub`, `nightclubEngine`, `DJ_ROSTER` | Buy with real ORBITX via injected premium billing (25 ORBITX — `CLUB_PRICE_ORBITX`) or lease-to-own with paper CITY (10,000 CITY — `CLUB_LEASE_CITY`). Book NPC DJs from `DJ_ROSTER`, set cover, hype spend (`hypeCost`), `simulateNight` produces nightly earnings reports. Popularity 0–100 drives density and earnings |
| 9 | Weekly car meets | **BUILT** | `CarMeetUi`, `useCarMeet`, `carMeetEngine` | Weekly bucket (`currentMeetId`, Sat nights), entry fee in paper CITY (`CAR_MEET_ENTRY_FEE_CITY`), NPC entries (`NPC_MEET_ENTRIES`), deterministic judging across `CAR_MEET_CATEGORIES` (`scoreEntry`/`judgeMeet`), prize pool = entry fees |

## Integration

### 1. Mount the social hub

```tsx
const [socialOpen, setSocialOpen] = useState(false);
const [tab, setTab] = useState<SocialTab>("feed");

{socialOpen && (
  <SocialHub
    playerName={playerName}
    playerHandle={playerHandle}
    drama={drama}            // see §3 — live TokenDrama[]
    initialTab={tab}         // optional
  />
)}
```

Suggested mount points (integrator's choice):
- A **HUD button** ("📱 Social") → opens the hub at the last/feed tab.
- **3D world markers**: rooftop / beach / campsite / comedy club / nightclub /
  docks markers → open the hub with the matching `initialTab` when the player
  is near (via core's module APIs on the `GTAWorld` instance from the
  `useGtaGame` hook's `getWorld()`: `world.sceneRef` for additive scene work,
  `world.getPlayerState()` for proximity checks, `world.teleport(x, z,
  heading)` for fast-travel. Do NOT import core from this module — keep the
  self-containment rule; the integrator owns that glue).

### 2. Mount the phone (separate overlay, not a hub tab)

```tsx
const [phoneOpen, setPhoneOpen] = useState(false);

{phoneOpen && (
  <PhoneUi
    playerName={playerName}
    playerHandle={playerHandle}
    drama={drama}            // feeds the phone's embedded feed/news apps
    takeSnapshot={() => canvas.toDataURL("image/jpeg", 0.7)}  // §4
    teleport={(coord) => world.teleport(coord.x, coord.z, coord.heading)} // §4
    onClose={() => setPhoneOpen(false)}
  />
)}
```

Suggested mount point: a **persistent HUD phone button** (GTA-style: open
anytime), or a keybind (e.g. `P` / up-arrow).

### 3. Live token data (required for feed + news — real data only)

The module never fetches prices itself. Feed it from the app's live prices:

```ts
import { useLivePrices } from "@/hooks/useLivePrices";
import { dramaFromPrices, ORBITX_MINT } from "@/city/modules/social";

const prices = useLivePrices([ORBITX_MINT, /* other mints */]);
// when prices arrive:
const drama = dramaFromPrices(prices, [
  { mint: ORBITX_MINT, symbol: "ORBITX" },
  /* … */
]);
// <SocialHub drama={drama} playerName={…} playerHandle={…} />
```

`dramaFromPrices` **drops mints with no live quote — never mocks**. Feed and
news engines build content exclusively from `TokenDrama[]`.

### 4. Phone camera snapshot + maps teleport (optional)

- `takeSnapshot?: PhoneSnapshotFn` (`() => string | null`) — wire to the game
  canvas snapshot. Photos land in the camera gallery (localStorage).
- `teleport?: TeleportFn` — the maps app calls it with `VenueCoord` from
  `venueCoords.ts`. Additive only; no player-control fights (the module never
  moves the player itself).

### 5. Paper-CITY ledger sync (optional)

The module keeps a local `paperLedger` for gameplay money (car-meet entries,
recruit wages, nightclub lease/hype, covers). If the integrator owns a
canonical paper wallet, sync on spends: report `paperLedger` transactions
(`PaperTx` records) into it. There is no required prop for this today —
**known inconsistency**: `types.ts` exports a `SocialModuleProps` interface
(`cityBalance`, `takeSnapshot`, `onCitySpend`) but **no exported component
accepts it** (`SocialHub` only takes `playerName/playerHandle/drama/
initialTab`). Until that prop type is wired to a component, treat it as
documentation of intent and sync `paperLedger` from the outside.

### 6. ORBITX premium billing (tokenomics primitives have landed)

`web/src/tokenomics/useOrbitxBilling.ts` now exists. The integrator injects
the real implementation once, from a component where hooks run
unconditionally (calling a hook *inside* the factory breaks hooks rules when
`useSocialBilling` falls back to NOT_READY, so use the bridge pattern):

```tsx
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { injectSocialBilling } from "@/city/modules/social";

function SocialBillingBridge() {
  const b = useOrbitxBilling(); // unconditional hook call
  useMemo(() => {
    injectSocialBilling(() => ({
      premium: true,
      ready: b.ready,
      balance: b.balance,
      burnForPremium: (o) =>
        b.spend({
          amount: o.amount,            // whole ORBITX
          reason: `city-social:${o.reason}`,
          ref: o.ref ?? crypto.randomUUID(),
        }),
    }));
  }, [b]);
  return null;
}
```

Behavior when nothing is injected (or `ready === false`): premium UI renders
the fallback via `premiumButtonState` — "Premium — coming soon" /
"Connect ORBITX" — and the world runs on paper CITY. The nightclub's 25-ORBITX
purchase is the only ORBITX premium spend in the module. All burns are
backend-signed through `burnForPremium` (auth-once up front per
`BILLING_CONTRACT.md`); the module never builds a parallel burn path, never
custodies keys or funds, never shows a wallet popup.

## Props / mount summary

| Prop | Type | Required | Notes |
|---|---|---|---|
| `SocialHub`: `playerName` | `string` | yes | |
| `SocialHub`: `playerHandle` | `string` | yes | |
| `SocialHub`: `drama` | `TokenDrama[]` | yes | live data via `dramaFromPrices` (§3) |
| `SocialHub`: `initialTab` | `SocialTab` | no | default `"feed"` |
| `PhoneUi`: `playerName` / `playerHandle` / `drama` | as above | yes | same as `SocialHub` |
| `PhoneUi`: `takeSnapshot` | `PhoneSnapshotFn` | no | game-canvas → camera gallery |
| `PhoneUi`: `teleport` | `TeleportFn` | no | maps app → fast-travel |
| `PhoneUi`: `onClose` | `() => void` | yes | dismiss overlay |

## Voice architecture (multiplayer-ready, gaps marked)

`engine/voiceArchitecture.ts` defines a `VoiceProvider` seam. Default:
`LocalVoiceStub` (simulated participants, real mic meter). Real multiplayer
via `LiveKitVoiceProvider` (`livekit-client` dynamically imported — never in
the initial bundle — needs a token function). Marked gaps for the
integrator/backend team:

- **GAP-1** — no LiveKit token endpoint (`POST /api/voice/token`) yet; the
  provider throws a clear error so UI can show it.
- **GAP-2** — no LiveKit Cloud project / API key provisioned.
- **GAP-3** — no moderation/consent copy approved (recording indicators,
  mute-by-default consent posture is already implemented in `useVoice`).
- **GAP-4** — no spatial-audio mapping; rooms are flat channels, not
  positional.

Used by: campfire (camping), open-mic (comedy club), party voice
(`VoiceChannelKind`: `"campfire"` \| `"openmic"` \| `"party"`).

## Assumptions (for the integrator)

1. **`web/src/tokenomics/` now exists** (`useOrbitxBilling` shipped
   2026-09-29) — premium billing is injectable today via
   `injectSocialBilling` (§6). Verified 2026-09-29.
2. Venue coordinates are placeholders. `data/venueCoords.ts` uses best-guess
   positions on the city grid. The team that owns 3D venue placement should
   replace these numbers. The module only ever calls the integrator's
   `teleport` callback.
3. Schedules run on player-local time (matches the core day/night cycle):
   rooftop Fri 21:00–02:00, beach bonfires Sat 19:00–23:00, campsites Sat–Sun,
   open mic Tue evenings, car meet Sat nights (`hangoutEngine`).
4. All state is per-device localStorage (paper ledger, phone threads, camera
   gallery, nightclub, recruits, open-mic slots, car-meet entries, news read
   state). No server sync; multiplayer social state (shared car meets, shared
   club leaderboards) is a future backend task.
5. NPC copy is flavor; market copy is runtime-generated from real data.
   Nothing in `socialData.ts` invents a price.
6. Comedy recordings are session-scoped blob URLs — they vanish on reload;
   persistence (blob storage) is a future task.
7. Mobile-friendly: all UI is touch-native (no hover dependence);
   push-to-talk uses pointer events; DJ audio unlocks on the first user tap
   (WebAudio autoplay policy); layout uses fluid `oxs-*` classes sized for
   small screens. No camera/GPS permission flows inside the module except the
   mic for open-mic recording and voice stub (prompted on demand only).

## What was NOT built

- No 3D world markers / venue meshes — integrator's call via core APIs (§1).
- No global player registry / multiplayer roster — NPCs + by-name players
  only; `resolvePlayerId`-style identity is a future task.
- No server sync for social state (see Assumptions 4).
- No LiveKit backend (GAP-1…GAP-4 above).
- No persistence for comedy recordings (session blob URLs only).
- No notification toasts for social events (new feed drama, meet results).
- No admin/moderation surface for open-mic content.
- Known inconsistency: `SocialModuleProps` in `types.ts` is exported but no
  component accepts it (see §5). Either wire it into `SocialHub`/`PhoneUi`
  or delete the type.
- Known caution: the docstring example in `billing.ts` calls
  `useOrbitxBilling()` inside the `injectSocialBilling` factory — that breaks
  hooks rules on the NOT_READY path. Use the §6 bridge-component pattern
  instead.

## Type check

`tsc --noEmit -p web/tsconfig.app.json` — zero errors in
`city/modules/social/**` (verified 2026-09-29). No prod build was run
(per instructions).
