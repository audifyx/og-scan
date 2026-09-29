/**
 * Theme SDK (idea 40) — validate + scaffold third-party device themes.
 *
 * A device theme ships as:
 *   1. A DeviceThemeDef registered via registerDeviceTheme() (themes.ts)
 *   2. A CSS file scoped to html[data-device-theme="<id>"] using --dt-* vars
 *
 * This module validates defs, generates a starter CSS scaffold, and
 * exposes the full authoring contract. Human docs: THEME_SDK.md.
 */

import type { DeviceThemeDef, OsLayoutKind } from "./themes";

export const SDK_VERSION = "1.0.0";

export interface SdkValidation {
  ok: boolean;
  errors: string[];
}

/** Layouts a third-party theme may build on (must exist in layouts.tsx). */
export const SDK_LAYOUTS: OsLayoutKind[] = [
  "orbit",
  "grid",
  "xmb",
  "blades",
  "channels",
  "dual",
  "pixel",
  "taskbar",
  "menubar",
  "terminal",
];

/** Required CSS custom properties a theme should define (or inherit). */
export const SDK_REQUIRED_VARS = [
  "--dt-bg",
  "--dt-fg",
  "--dt-accent",
  "--dt-surface",
  "--dt-line",
  "--dt-font-display",
  "--dt-font-body",
  "--dt-radius",
  "--dt-icon-radius",
] as const;

export function validateDeviceTheme(def: Partial<DeviceThemeDef>): SdkValidation {
  const errors: string[] = [];
  if (!def.id || !/^[a-z0-9][a-z0-9-_]{1,31}$/.test(def.id))
    errors.push('id must match /^[a-z0-9][a-z0-9-_]{1,31}$/ (e.g. "my-theme")');
  if (!def.name || def.name.length > 40) errors.push("name is required (max 40 chars)");
  if (!def.layout || !SDK_LAYOUTS.includes(def.layout))
    errors.push(`layout must be one of: ${SDK_LAYOUTS.join(", ")}`);
  if (!def.preview?.from || !def.preview?.to)
    errors.push("preview.from / preview.to are required (picker swatch colors)");
  if (!def.preview?.glyph) errors.push("preview.glyph is required (picker glyph)");
  if (!def.blurb) errors.push("blurb is required (shown under the picker)");
  if (!def.tagline) errors.push("tagline is required (short picker subtitle)");
  return { ok: errors.length === 0, errors };
}

/**
 * Generate a starter CSS scaffold for a theme id + layout.
 * Save as web/src/themes/css/<id>.css, import it in css/index.css,
 * then register the def with registerDeviceTheme().
 */
export function themeCssScaffold(id: string, layout: OsLayoutKind): string {
  return `/* ============================================================================
   ${id} — third-party device theme (Theme SDK v${SDK_VERSION})
   Scope EVERYTHING under html[data-device-theme="${id}"].
   Available layouts: ${SDK_LAYOUTS.join(", ")} — this theme uses "${layout}".
   Only use --dt-* custom properties; never hard-code app colors.
   ========================================================================== */

/* 1. Core tokens — override what makes this theme unique. Inherit the rest. */
html[data-device-theme="${id}"] {
  --dt-bg: #05080c;
  --dt-bg-2: #0a1018;
  --dt-surface: rgba(12, 18, 28, 0.86);
  --dt-surface-2: rgba(20, 28, 42, 0.92);
  --dt-line: rgba(255, 255, 255, 0.09);
  --dt-fg: #e8f0f8;
  --dt-muted: #8b98ab;
  --dt-accent: #17ff4d;
  --dt-on-accent: #04140a;
  --dt-accent-soft: rgba(23, 255, 77, 0.13);
  --dt-font-display: "Orbitron", "Segoe UI", system-ui, sans-serif;
  --dt-font-body: "Segoe UI", system-ui, -apple-system, sans-serif;
  --dt-radius: 14px;
  --dt-icon-radius: 24%;
}

/* 2. OS home chrome — re-skin the launcher shell (prefix .osh-* classes). */
html[data-device-theme="${id}"] .osh-stage {
  /* your shell styling here */
}

/* 3. App tiles — icon look for this theme. */
html[data-device-theme="${id}"] .osh-icon-tile {
  /* your tile styling here */
}

/* 4. Wallpaper accent (optional) — pair with a background theme or your own. */
html[data-device-theme="${id}"] .osh-wallpaper {
  /* your wallpaper layer tweaks here */
}

/* 5. Motion — keep it under 300ms, respect prefers-reduced-motion. */
@media (prefers-reduced-motion: reduce) {
  html[data-device-theme="${id}"] .osh-stage * { animation: none !important; }
}
`;
}

/** JSON manifest shape for publishing a theme (e.g. to a theme registry). */
export interface ThemeManifest {
  sdk: string;
  theme: DeviceThemeDef;
  cssFile: string;
  author: string;
  version: string;
}

export function themeManifest(
  theme: DeviceThemeDef,
  author: string,
  version = "1.0.0"
): ThemeManifest {
  return {
    sdk: SDK_VERSION,
    theme,
    cssFile: `css/${theme.id}.css`,
    author,
    version,
  };
}
