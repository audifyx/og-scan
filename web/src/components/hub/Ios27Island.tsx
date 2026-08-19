import type { PlatformApp } from "@/lib/orbitxPlatforms";

export function Ios27Island({
  now,
  apps,
  open,
  onToggle,
  onClose,
  onLaunch,
}: {
  now: Date;
  apps: PlatformApp[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLaunch: (app: PlatformApp) => void;
}) {
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <>
      {open && <button type="button" className="ios27-island-dim" aria-label="Close quick access" onClick={onClose} />}
      <div className={`ios27-island${open ? " is-open" : ""}`}>
        <button
          type="button"
          className="ios27-island__pill"
          aria-expanded={open}
          aria-label={open ? "Close quick access" : "Open quick access"}
          onClick={onToggle}
        >
          <span className="ios27-island__live" aria-hidden />
          <span className="ios27-island__label">OrbitX</span>
          <span className="ios27-island__time">{time}</span>
        </button>
        {open && (
          <div className="ios27-island__sheet" role="menu" aria-label="Quick access">
            <div className="ios27-island__head">
              <span>Quick Access</span>
              <span>{apps.length} apps</span>
            </div>
            <div className="ios27-island__grid">
              {apps.map((app) => (
                <button
                  key={app.key}
                  type="button"
                  className="ios27-island__app"
                  role="menuitem"
                  onClick={() => onLaunch(app)}
                >
                  <span className="ios27-island__ico" style={{ background: app.iconBg }}>
                    {app.glyph}
                  </span>
                  <span className="ios27-island__name">{app.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
