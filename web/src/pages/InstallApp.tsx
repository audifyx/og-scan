/* ══════════════════════════════════════════════════════════════
   OG Scan · Install App Page (/install)
   PWA install + APK sideload instructions
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Download, Smartphone, Chrome, Apple, Globe, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";

// Detect platform
function usePlatform() {
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop" | "unknown">("unknown");
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/windows|macintosh|linux/.test(ua)) setPlatform("desktop");

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === "accepted";
  };

  return { platform, isInstallable, triggerInstall };
}

const Step = ({ n, text }: { n: number; text: string }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-og-cyan/20 border border-og-cyan/30 text-og-cyan text-[11px] font-black">
      {n}
    </div>
    <p className="text-[13px] text-white/70 leading-relaxed pt-0.5">{text}</p>
  </div>
);

export default function InstallApp() {
  const { platform, isInstallable, triggerInstall } = usePlatform();
  const [installed, setInstalled] = useState(false);
  const [tab, setTab] = useState<"android" | "ios" | "desktop">("android");

  // Set default tab based on detected platform
  useEffect(() => {
    if (platform === "ios") setTab("ios");
    else if (platform === "desktop") setTab("desktop");
    else setTab("android");
  }, [platform]);

  const handleInstall = async () => {
    const ok = await triggerInstall();
    if (ok) setInstalled(true);
  };

  return (
    <AppLayout>
      <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-og-lime/40 bg-og-lime/10">
            <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover rounded-2xl" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Install OG Scan</h1>
          <p className="text-sm text-white/40 mt-1">Get the app on any device — no app store required</p>
        </div>

        {/* One-tap install banner (Android Chrome / Edge) */}
        {isInstallable && !installed && (
          <div className="mb-6 rounded-xl border border-og-lime/30 bg-og-lime/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-bold text-og-lime">Install Available!</p>
                <p className="text-[12px] text-white/50 mt-0.5">Your browser supports one-tap install</p>
              </div>
              <button
                onClick={handleInstall}
                className="flex items-center gap-2 rounded-xl bg-og-lime px-4 py-2 text-[13px] font-black text-background transition hover:bg-white shadow-[0_0_20px_-6px_#bef264]"
              >
                <Download className="h-4 w-4" /> Install Now
              </button>
            </div>
          </div>
        )}

        {installed && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/5 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            <p className="text-[13px] text-green-400 font-semibold">App installed successfully! Check your home screen.</p>
          </div>
        )}

        {/* Platform tabs */}
        <div className="flex gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 mb-6">
          {(["android", "ios", "desktop"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition ${
                tab === t
                  ? "bg-white/[0.09] text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t === "android" && <Smartphone className="h-3.5 w-3.5" />}
              {t === "ios" && <Apple className="h-3.5 w-3.5" />}
              {t === "desktop" && <Globe className="h-3.5 w-3.5" />}
              {t === "android" ? "Android" : t === "ios" ? "iPhone / iPad" : "Desktop"}
            </button>
          ))}
        </div>

        {/* Android */}
        {tab === "android" && (
          <div className="space-y-4">
            {/* Option 1: Browser install */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-og-cyan/30 bg-og-cyan/10">
                  <Chrome className="h-4 w-4 text-og-cyan" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">Option 1 — Chrome / Edge (Recommended)</p>
                  <p className="text-[11px] text-white/40">Installs as a native-feeling app in seconds</p>
                </div>
              </div>
              <div className="space-y-3">
                <Step n={1} text='Open ogscan.fun in Chrome or Edge on your Android device' />
                <Step n={2} text='Tap the three-dot menu (⋮) in the top-right corner' />
                <Step n={3} text='Tap "Add to Home screen" or "Install app"' />
                <Step n={4} text='Tap "Install" on the confirmation dialog' />
                <Step n={5} text='OG Scan icon will appear on your home screen — open it for a full-screen app experience' />
              </div>
            </div>

            {/* Option 2: APK Sideload */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10">
                  <Download className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">Option 2 — APK Sideload</p>
                  <p className="text-[11px] text-white/40">Download and install the APK directly</p>
                </div>
              </div>

              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 mb-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-yellow-400/80">
                    You'll need to enable "Install unknown apps" in Android settings for your browser. This is safe — OG Scan is your own app.
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <Step n={1} text='On your Android device, go to Settings → Apps → Special app access → Install unknown apps' />
                <Step n={2} text='Enable "Allow from this source" for your browser (Chrome, Files, etc.)' />
                <Step n={3} text='Download the APK file below' />
                <Step n={4} text='Open the downloaded file and tap "Install"' />
                <Step n={5} text='OG Scan will appear in your app drawer' />
              </div>

              <a
                href="https://ogscan.fun/og-scan.apk"
                download="og-scan.apk"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500/20 border border-orange-500/30 py-3 text-[13px] font-bold text-orange-400 transition hover:bg-orange-500/30"
              >
                <Download className="h-4 w-4" /> Download APK (og-scan.apk)
              </a>
              <p className="text-[11px] text-white/30 text-center mt-2">PWA-to-APK via Trusted Web Activity · Chrome required</p>
            </div>
          </div>
        )}

        {/* iOS */}
        {tab === "ios" && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/5">
                <Apple className="h-4 w-4 text-white/60" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-white">Safari → Add to Home Screen</p>
                <p className="text-[11px] text-white/40">iOS doesn't support APK — use PWA install instead</p>
              </div>
            </div>
            <div className="space-y-3">
              <Step n={1} text="Open ogscan.fun in Safari (must be Safari — Chrome on iOS won't show the option)" />
              <Step n={2} text='Tap the Share button (□↑) at the bottom of the screen' />
              <Step n={3} text='Scroll down and tap "Add to Home Screen"' />
              <Step n={4} text='Give it a name (default: "OG Scan") and tap "Add"' />
              <Step n={5} text="The app icon will appear on your home screen — it opens full-screen without Safari chrome" />
            </div>
          </div>
        )}

        {/* Desktop */}
        {tab === "desktop" && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-og-cyan/30 bg-og-cyan/10">
                <Globe className="h-4 w-4 text-og-cyan" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-white">Chrome / Edge Desktop</p>
                <p className="text-[11px] text-white/40">Install as a desktop app on Windows, Mac or Linux</p>
              </div>
            </div>
            <div className="space-y-3">
              <Step n={1} text="Open ogscan.fun in Chrome or Edge" />
              <Step n={2} text='Look for the install icon (⊕) in the address bar on the right side' />
              <Step n={3} text='Click it and select "Install"' />
              <Step n={4} text="OG Scan opens as a standalone desktop window — no browser chrome, works offline" />
            </div>
            <div className="mt-4 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-[12px] text-white/40">
                <span className="text-white/70 font-semibold">Edge users:</span> Menu → Apps → Install this site as an app
              </p>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-6 text-center">
          <p className="text-[12px] text-white/30">
            OG Scan is a Progressive Web App — fast, offline-capable, and always up-to-date automatically.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
