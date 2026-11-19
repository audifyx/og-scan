import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// Lightweight A2HS button. Renders only when the browser fires
// beforeinstallprompt (Chrome/Edge/Android) and the app isn't already installed.
export default function InstallPWA() {
  const [deferred, setDeferred] = useState<any>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setDeferred(null); setHidden(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred || hidden) return null;
  const install = async () => {
    try { deferred.prompt(); await deferred.userChoice; } catch { /* noop */ }
    setDeferred(null);
  };
  return (
    <button onClick={install} title="Install OrbitX DEX" className="btn bg-white/5 border border-white/10 text-white hover:bg-white/10 inline-flex items-center gap-1.5 shrink-0">
      <Download className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Install</span>
    </button>
  );
}
