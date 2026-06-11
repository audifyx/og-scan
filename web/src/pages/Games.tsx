/**
 * Games page — Browser-style wrapper for Degen Tower.
 * Matches the Phantom Trade tab setup exactly.
 */

import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  RefreshCw, ExternalLink, Lock,
  ArrowLeft, ArrowRight, Gamepad2,
} from "lucide-react";

const GAMES_URL = "https://degen-tower.vercel.app/";

const Games = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  const handleReload = () => {
    setLoading(true);
    setIframeError(false);
    if (iframeRef.current) iframeRef.current.src = GAMES_URL;
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen w-full bg-[#0a0a0f]">
        {/* Browser chrome */}
        <div className="shrink-0 bg-[#141420] border-b border-white/[0.06]">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-3 pt-2">
            <div className="flex items-center gap-2 bg-[#1c1c2e] rounded-t-lg px-4 py-2 border border-white/[0.08] border-b-0 max-w-[240px]">
              <Gamepad2 className="w-4 h-4 text-og-lime shrink-0" />
              <span className="text-[11px] text-white/70 font-medium truncate">
                Degen Tower
              </span>
            </div>
          </div>

          {/* Nav + address bar */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex items-center gap-0.5">
              <button className="p-1.5 rounded-md text-white/20 hover:text-white/40 hover:bg-white/[0.05] transition" disabled>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button className="p-1.5 rounded-md text-white/20 hover:text-white/40 hover:bg-white/[0.05] transition" disabled>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleReload} className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex-1 flex items-center gap-2 bg-[#0d0d18] rounded-lg px-3 py-1.5 border border-white/[0.06]">
              <Lock className="h-3 w-3 text-green-400/60 shrink-0" />
              <span className="text-[12px] text-white/50 font-mono truncate select-all">
                degen-tower.vercel.app
              </span>
            </div>

            <a
              href={GAMES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* iframe */}
        <div className="flex-1 relative bg-[#0d0d14]">
          {loading && (
            <div className="absolute top-0 left-0 right-0 h-[2px] z-10">
              <div className="h-full bg-og-lime rounded-full animate-pulse w-2/3" />
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={GAMES_URL}
            title="Degen Tower"
            className="w-full h-full border-0"
            allow="clipboard-write; clipboard-read; accelerometer; autoplay"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation allow-popups-to-escape-sandbox"
            style={{ colorScheme: "dark" }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setIframeError(true); }}
          />

          {iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d14] gap-6 px-6">
              <div className="w-16 h-16 rounded-2xl bg-og-lime/10 border border-og-lime/20 flex items-center justify-center">
                <Gamepad2 className="h-8 w-8 text-og-lime" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-black text-white mb-2">Open Degen Tower</h2>
                <p className="text-sm text-white/40 max-w-sm">
                  Tap below to play Degen Tower in a new window.
                </p>
              </div>
              <a
                href={GAMES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-og-lime text-black px-6 py-3 rounded-xl font-black text-sm hover:bg-og-lime/90 transition active:scale-[0.98]"
              >
                <ExternalLink className="h-4 w-4" />
                Play Degen Tower
              </a>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Games;
