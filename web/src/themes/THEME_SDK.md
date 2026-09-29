# OrbitX Theme SDK v1.0.0

Build and publish your own **device themes** — full platform re-skins that
live next to the built-in Xbox 360 / PS4 / Wii / Game Boy / CRT homages.
Third-party themes use the same engine the built-ins use: one
`data-device-theme` attribute on `<html>`, CSS custom properties, and a
registry entry. No fork, no PR required to run one locally.

## What a theme is

Two pieces:

1. **A definition** — metadata + which OS layout it uses — registered at
   runtime with `registerDeviceTheme()` (from `web/src/themes/themes.ts`).
2. **A CSS file** — everything scoped under
   `html[data-device-theme="<your-id>"]`, styling with `--dt-*` variables.

```ts
import { registerDeviceTheme } from "@/themes/themes";
import { validateDeviceTheme } from "@/themes/sdk";

const def = {
  id: "vaporwave",
  name: "Vaporwave",
  maker: "you",
  blurb: "Chrome sunsets and grid horizons.",
  layout: "grid",          // reuse a built-in OS layout — see list below
  preview: { from: "#ff71ce", to: "#01cdfe", glyph: "≋" },
  tagline: "ａｅｓｔｈｅｔｉｃ",
};

const v = validateDeviceTheme(def);
if (!v.ok) throw new Error(v.errors.join("; "));
registerDeviceTheme(def);
```

## Layouts you can build on

Your theme picks a **layout** — the actual OS home structure. You don't
rebuild the layout; you re-skin it:

| layout     | used by            | structure                          |
|------------|--------------------|------------------------------------|
| `orbit`    | OrbitX Native      | apps orbit a live core             |
| `grid`     | iOS / Android      | icon grid + dock                   |
| `xmb`      | PS4                | cross-media bar                    |
| `blades`   | Xbox 360           | angled blade tabs                  |
| `channels` | Wii                | bubbly channel tiles               |
| `dual`     | Nintendo 3DS       | top showcase + touch grid          |
| `pixel`    | Game Boy           | monochrome pixel list              |
| `taskbar`  | Windows / Linux    | desktop + taskbar                  |
| `menubar`  | macOS              | menu bar + magnifying dock         |
| `terminal` | Retro CRT          | phosphor terminal list             |

Available as `SDK_LAYOUTS` in `@/themes/sdk`.

## CSS contract

Generate a starter file:

```ts
import { themeCssScaffold } from "@/themes/sdk";
const css = themeCssScaffold("vaporwave", "grid");
// save as web/src/themes/css/vaporwave.css, then add to css/index.css:
//   @import "./vaporwave.css";
```

Rules:

- **Scope everything** under `html[data-device-theme="vaporwave"]`.
  Unscoped rules are ignored by convention and will break other themes.
- **Only use `--dt-*` custom properties** for colors, fonts, radii.
  Never hard-code an app's brand color — accents are a separate,
  user-controlled axis (`--dt-accent`).
- The full token list lives in `css/base.css`. The ones you should almost
  always set: `--dt-bg`, `--dt-fg`, `--dt-accent`, `--dt-surface`,
  `--dt-line`, `--dt-font-display`, `--dt-font-body`, `--dt-radius`,
  `--dt-icon-radius`. (`SDK_REQUIRED_VARS` in the SDK.)
- OS home chrome uses `.osh-*` classes (`osh-stage`, `osh-icon-tile`,
  `osh-wallpaper`, `osh-dock-item`, …). Style those, not app internals.
- Keep animations under 300ms and honor `prefers-reduced-motion`
  (the scaffold includes the media query).
- Don't touch `body` layout (no fixed heights/overflows) — the theme
  must survive every route, mobile included.

## Also registrable

- `registerAccent({ id, name, value, onAccent })` — custom accent colors
  (the palette builder uses this).
- `registerBackground({ id, name, blurb, css, dark })` — static CSS
  wallpapers.

Both inject their CSS automatically — no `index.css` edit needed.

## Publishing

Ship a manifest so registries / friends can install your theme:

```ts
import { themeManifest } from "@/themes/sdk";
const manifest = themeManifest(def, "your-handle", "1.0.0");
// { sdk, theme, cssFile: "css/vaporwave.css", author, version }
```

A distributable theme = `manifest.json` + your CSS file. The host app
imports the CSS and calls `registerDeviceTheme(manifest.theme)`.

## Checklist before you share

- [ ] `validateDeviceTheme()` passes
- [ ] CSS scoped to your `data-device-theme` id, no leaks
- [ ] Looks right on mobile (360px) and desktop
- [ ] No hard-coded colors outside `--dt-*`
- [ ] `prefers-reduced-motion` respected
- [ ] Picker preview (`preview.from/to/glyph`) actually represents it
