/**
 * Lightweight Add-to-Home-Screen control for OrbitX City menus.
 * Shows when Chrome/Edge/Android fires beforeinstallprompt.
 */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallCityPWA({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) {
      setHidden(true);
      return;
    }

    const ua = navigator.userAgent || "";
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(ua);
    if (isIos && isSafari) setIosHint(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setIosHint(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  if (deferred) {
    return (
      <button
        type="button"
        className={`oxc-btn primary compact ${className}`.trim()}
        onClick={async () => {
          cityAudio.play("confirm");
          try {
            await deferred.prompt();
            await deferred.userChoice;
          } catch {
            /* ignore */
          }
          setDeferred(null);
        }}
      >
        <Download className="h-3.5 w-3.5" /> Install app
      </button>
    );
  }

  if (iosHint) {
    return (
      <p className={`oxc-pwa-ios-hint ${className}`.trim()}>
        Install: Share → <b>Add to Home Screen</b>
      </p>
    );
  }

  return null;
}
