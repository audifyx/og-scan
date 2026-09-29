# OrbitX Device Theme Engine + OS Home — Integration Guide

Workstream B deliverables live in two new directories. Nothing else in the
repo was touched.

- `web/src/themes/` — the platform-wide device theme engine
- `web/src/oshome/` — the new OS-style home screen (replaces `/`)

---

## 1. Wrap the app with `DeviceThemeProvider`

In `web/src/App.tsx`, import the provider and wrap the whole tree so ONE
theme choice re-skins every route:

```tsx
import { DeviceThemeProvider } from "@/themes/DeviceThemeProvider";

const App = () => (
  <ErrorBoundary>
  <MaintenanceLock>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SolanaWalletProvider>
      <EvmWalletProvider>
      <DeviceThemeProvider>   {/* ← ADD: outside ThemeProvider so it wins */}
      <ThemeProvider>
      ...
      </ThemeProvider>
      </DeviceThemeProvider>  {/* ← ADD */}
      </EvmWalletProvider>
      </SolanaWalletProvider>
    </AuthProvider>
  </QueryClientProvider>
  </MaintenanceLock>
  </ErrorBoundary>
);
```

Placement notes:

- Put it **outside** the existing `ThemeProvider` (hooks/useTheme) — the two
  systems are independent and do not conflict. The legacy `sol-theme` presets
  keep working; the device engine only adds `data-*` attributes + CSS vars.
- The provider **imports its own CSS** (`./css/index.css`) — no changes to
  `index.css`, `main.tsx`, or vite config needed.
- It is SSR-safe-ish: all DOM access is inside `useEffect`/event handlers.

## 2. Replace the `/` route with `OsHomePage`

```tsx
import OsHomePage from "@/oshome/OsHomePage";

// replace:
//   <Route path="/" element={<Splash />} />
// with:
<Route path="/" element={<OsHomePage />} />
```

### What to do with Splash

`Splash` (`web/src/pages/Splash.tsx`) is referenced in **exactly two** routes
and nowhere else (verified 2026-09-29):

- `/` → will become `OsHomePage`
- `/splash` → keep as-is

Recommended: keep `<Route path="/splash" element={<Splash />} />` untouched so
the marketing splash stays reachable, and do **not** delete `Splash.tsx`.
(`src/components/phone/SplashScreen.tsx` is a different, unrelated component —
leave it alone.)

`OsHomePage` is a default export and needs no props. It reads the device theme
from context itself, but degrades gracefully if the provider is ever missing
(the hook returns OrbitX-native defaults instead of throwing).

## 3. How the engine works

The provider sets three attributes on `<html>`:

```html
<html data-device-theme="xbox360" data-bg-theme="nebula" data-accent="lime">
```

- **Device theme** (`orbitx-device-theme` in localStorage) — 16 themes, each a
  CSS file under `web/src/themes/css/` keyed off `[data-device-theme="…"]`.
  Each theme sets `--dt-*` custom properties (fonts, colors, radii, spacing,
  motion) **and** structural chrome, so it transforms layout/typography/
  iconography/motion — not just colors. It also applies a gentle platform-wide
  reskin (body font + background, heading font, button/input radii, selection
  color, scrollbars, focus rings), all scoped under `html[data-device-theme]`
  so removing the provider is a zero-impact no-op.
- **Background** (`orbitx-bg-theme`) — 10 wallpapers (nebula, midnight, aurora,
  sunset, ocean, matrix, grid, bliss, paper, void). Rendered on the OS home
  wallpaper layer via `--dt-wallpaper`; three are animated with pure CSS
  (aurora drift, matrix rain, cyber grid). Independent of device theme.
- **Accent** (`orbitx-accent`) — 8 accents driving `--dt-accent` /
  `--dt-on-accent` / `--dt-accent-soft`. Independent of the other two axes.

Switching device theme disables transitions for one frame (`dt-no-transition`)
so the re-skin is instant rather than smeary.

### Device themes shipped

| id | homage | OS home layout |
|---|---|---|
| `orbitx` (default) | OrbitX native | orbit — apps circle a live core |
| `xbox360` | Xbox 360 blades | blades — angled category tabs |
| `ps4` | PS4 XMB | xmb — cross-media bar |
| `wii` | Wii channels | channels — bubbly tile grid |
| `n3ds` | Nintendo 3DS | dual — showcase top screen + touch grid |
| `gameboy` | Game Boy | pixel — monochrome list, Press Start 2P |
| `windows` | Windows PC | taskbar — desktop + Start menu |
| `ios` | iOS | grid — squircles + glass dock |
| `macos` | macOS | menubar — menu bar + magnifying dock |
| `linux` | Linux (GNOME) | taskbar — Activities top bar |
| `android` | Android | grid — Material You pills |
| `crt` | Retro CRT | terminal — phosphor CLI + scanlines |
| `seriesx` | Xbox Series X | grid — carbon dark, sharp tiles, green glow |
| `ps5` | PlayStation 5 | xmb — deep ink, frosted rail, pill items |
| `switch` | Nintendo Switch | channels — charcoal tiles, red hover ring |
| `wiiu` | Wii U | dual — TV showcase above gamepad grid |

Deliberate overrides: `gameboy` and `crt` force their own monochrome accent
(the accent picker still works everywhere else); `wii` forces a light
`color-scheme`.

## 3b. Cross-platform theme engine core (Phase 2)

`web/src/themes/crossPlatform.ts` — the portable core:

- **ThemeSnapshot** (`{ v:1, device, background, accent, updatedAt }`) — the
  cross-platform unit of theme state. `readThemeSnapshot()` / `applyThemeSnapshot()`
  work through plain localStorage keys + `<html>` data attributes — no React
  context needed — so the same snapshot applies on web, mobile webviews, and
  partner embeds. Applying fires `orbitx:theme-applied`, which the provider
  listens to and syncs its state from.
- **Theme presets** — named background + accent combos (optional device pin)
  that apply platform-wide with one tap. 10 built-ins (`BUILTIN_PRESETS`:
  Neon Nights, Solar Flare, Deep Trench, Greenhouse, Gridline, Rosé Protocol,
  Aurora Signal, Gold Standard, Alert State, Clean Room) + user-saved custom
  presets in localStorage (`orbitx-theme-presets-v1`, capped at 24).
  The provider exposes `applyPreset()`; the ThemePicker renders the presets
  section with save/delete.
- **Share** — `encodePresetShare()` / `decodePresetShare()` pack a preset into
  a portable `oxp1.…` string for copy/paste between devices.

No tokenomics imports anywhere in the theme system — themes are free cosmetics.

## 4. OS home details
- **App catalog** (`web/src/oshome/appsCatalog.ts`): 58 real routes audited
  from the App.tsx route table — trading terminal, DEX, scanner, launchpad,
  NFT market, social feed, messages, voice rooms, games hub, predictions,
  OrbitX City, AgentPlus, AI Hub, supercomputer, agents world, copy trading,
  dev portal, education, alerts, podcasts/simulcast/scheduler tooling,
  whitepaper, support, install, etc. Each entry: name, blurb, href, lucide
  icon, accent, category, optional `owner`/`new` badge.
- **Draggable icons**: pointer-based reorder (mouse = drag immediately,
  touch = long-press for edit mode, iOS jiggles). Order persists to
  `orbitx-os-layout-v1`; new apps auto-append.
- **Launcher**: ⌘K / Ctrl+K or the search pill — full-text search across all
  apps, keyboard navigable (↑↓ + Enter), Esc closes.
- **Settings panel**: `ThemePicker` (device + background + accent with live
  previews + reset).
- **Clock**: live, updates every second; boot splash plays once (~1.2s).
- Mobile: layouts collapse to grids/lists under 720px (orbit → grid).

## 5. For theme-aware components (optional, future)

Any component can read the theme:

```tsx
import { useDeviceTheme } from "@/themes/DeviceThemeProvider";
const { deviceTheme, background, accent, setDeviceTheme } = useDeviceTheme();
// deviceTheme.layout: "orbit" | "grid" | "xmb" | "blades" | "channels"
//   | "dual" | "pixel" | "taskbar" | "menubar" | "terminal"
```

And any CSS can hook the same contract:

```css
html[data-device-theme="ps4"] .my-widget { /* … */ }
.my-thing { color: var(--dt-fg); background: var(--dt-surface); border-radius: var(--dt-radius); }
```

Full token list is at the top of `web/src/themes/css/base.css`.

## 6. Verification checklist

- [x] `DeviceThemeProvider` wraps the app in `App.tsx` (Phase 2 — 2026-09-29)
- [x] `/` renders `OsHomePage`; `/splash` still renders `Splash` (Phase 2 — 2026-09-29)
- [ ] `npm run build` passes (workstream B did not run it — integration owns it)
- [ ] Open `/`, open Themes, switch to `gameboy` → whole page goes dot-matrix;
      switch to `ps4` → XMB layout; accent change recolors instantly
- [ ] Try `seriesx` / `ps5` / `switch` / `wiiu` → each re-skins the OS home
- [ ] Theme presets: apply "Solar Flare" → background + accent change everywhere;
      save a custom preset, reload, apply it; delete it
- [ ] Drag an icon → reload → order persists
- [ ] ⌘K opens the launcher, typing filters, Enter navigates
- [ ] Navigate to `/intel/trade` with `crt` theme → phosphor skin applies
