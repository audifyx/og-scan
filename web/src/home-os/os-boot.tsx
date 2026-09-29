import { useEffect, useRef, useState } from "react";
import { useTheme } from "./os-theme-provider";
import type { DeviceThemeId } from "./theme-registry";

const BOOT_MS = 1500;

/** Per-theme boot cinematics. Shown on app start and every device-theme switch. */
export function OsBoot() {
  const { theme, bootKey } = useTheme();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [key, setKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Event-driven: bootKey bumps on every device-theme switch (and mount).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    setLeaving(false);
    setKey((k) => k + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(true), BOOT_MS - 320);
    const hide = setTimeout(() => setVisible(false), BOOT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      clearTimeout(hide);
    };
  }, [bootKey]);

  if (!visible) return null;

  return (
    <div
      key={key}
      className={`os-boot os-boot-${theme.device}`}
      data-os-device={theme.device}
      data-leaving={leaving}
      aria-hidden
    >
      <BootCinematic device={theme.device} />
    </div>
  );
}

function BootCinematic({ device }: { device: DeviceThemeId }) {
  switch (device) {
    case "xbox360":
      return (
        <>
          <div className="os-boot-ring" />
          <p className="os-boot-word">ORBITX</p>
        </>
      );
    case "ps4":
      return (
        <>
          <p className="os-boot-word">ORBITX</p>
          <div className="os-boot-ps4bar" />
        </>
      );
    case "wii":
      return (
        <>
          <div className="os-boot-wii-dots"><span /><span /><span /></div>
          <p className="os-boot-press">PRESS START</p>
        </>
      );
    case "tds":
      return (
        <>
          <div className="os-boot-tds"><i /><i /></div>
          <p className="os-boot-word">ORBITX</p>
        </>
      );
    case "gameboy":
      return <p className="os-boot-gb-word">ORBITX</p>;
    case "winpc":
      return (
        <>
          <p className="os-boot-word">OrbitX</p>
          <div className="os-boot-winbar"><i /></div>
        </>
      );
    case "ios":
      return (
        <div className="os-boot-ios-grid">
          {Array.from({ length: 8 }).map((_, i) => <span key={i} />)}
        </div>
      );
    case "macos":
      return (
        <>
          <div className="os-boot-mac-glow" />
          <p className="os-boot-word">OrbitX</p>
        </>
      );
    case "linux":
      return (
        <div className="os-boot-linux-lines">
          <p>$ orbitx --boot</p>
          <p>$ loading modules… ok</p>
          <p>$ welcome, trader_</p>
        </div>
      );
    case "cyberpunk":
      return <p className="os-boot-glitch">ORBITX</p>;
    case "midnight":
      return (
        <>
          <div className="os-boot-line" />
          <p className="os-boot-word">ORBITX</p>
        </>
      );
    case "arcade":
      return <p className="os-boot-coin">INSERT COIN</p>;
    default:
      return (
        <>
          <div className="os-boot-ring" />
          <p className="os-boot-word">ORBITX</p>
        </>
      );
  }
}

/** Themed wipe shown briefly when launching an app from the home grid. */
export function OsWipe({ device }: { device: DeviceThemeId }) {
  return <div className="os-wipe" data-os-device={device} aria-hidden />;
}
