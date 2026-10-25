import type { PlatformApp } from "../lib/orbitxPlatforms";

/**
 * Shared app icon tile for the OS desktop. Gradient + glyph is always the
 * bottom layer; when the app has a real icon image (app.iconSrc) it overlays
 * the whole tile (CSS sizes it via .oxos-*__mark img rules, tiles clip with
 * overflow:hidden). If the image fails to load it hides itself, revealing the
 * unchanged gradient+glyph fallback underneath. Folder minis stay glyph-only
 * and do not use this component.
 */
export function AppMark({ app, className }: { app: PlatformApp; className: string }) {
  return (
    <span className={className} style={{ background: app.iconBg }}>
      {app.glyph}
      {app.iconSrc ? (
        <img
          src={app.iconSrc}
          alt=""
          aria-hidden
          draggable={false}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}
