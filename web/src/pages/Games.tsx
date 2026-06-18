/**
 * Partnerships page — Browser-style wrapper for partner sites.
 * Matches the Phantom Trade tab setup exactly.
 * Supports swipping/switching between Degen Tower and solno.fun
 */

import { useState, useRef } from "react";
import { RefreshCw, ExternalLink, Lock, ArrowLeft, ArrowRight, Gamepad2, Zap } from "lucide-react";

const PARTNERSHIPS = [
  { id: "degen-tower", name: "Degen Tower", url: "https://degen-tower.vercel.app/", icon: Gamepad2, color: "text-og-lime" },
  { id: "solno", name: "Solno", url: "http://solno.fun/", icon: Zap, color: "text-og-gold" },
];

const Partnerships = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [activePartnership, setActivePartnership] = useState(0);

  const currentPartnership = PARTNERSHIPS[activePartnership];
  const CurrentIcon = currentPartnership.icon;

  const handleReload = () => {
    setLoading(true);
    setIframeError(false);
    if (iframeRef.current) iframeRef.current.src = currentPartnership.url;
  };

  const switchPartnership = (id: string) => {
    const index = PARTNERSHIPS.findIndex(p => p.id === id);
    if (index !== -1) {
      setActivePartnership(index);
      setLoading(true);
      setIframeError(false);
    }
  };

  return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full bg-[#0a0a0f]">
        {/* Browser chrome */}
        <div className="shrink-0 bg-[#141420] border-b border-white/[0.06]">
          {/* Partnership tab switcher */}
          <div className="flex items-center gap-1 px-3 pt-2 overflow-x-auto">
            {PARTNERSHIPS.map((partner, idx) => {
              const Icon = partner.icon;
              return (
                <button
                  key={partner.id}
                  onClick={() => switchPartnership(partner.id)}
                  className={`flex items-center gap-2 rounded-t-lg px-4 py-2 border border-white/[0.08] border-b-0 transition shrink-0 ${
                    idx === activePartnership 
                      ? "bg-[#1c1c2e] border-white/[0.12]" 
                      : "bg-[#0d0d18] border-white/[0.04] hover:bg-[#12121f]"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${partner.color}`} />
                  <span className="text-[11px] text-white/70 font-medium whitespace-nowrap">
                    {partner.name}
                  </span>
                </button>
              );
            })}
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
                {currentPartnership.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </span>
            </div>

            <a
              href={currentPartnership.url}
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
        <div className="flex-1 relative bg-[#0d0d14] overflow-hidden">
          {loading && (
            <div className="absolute top-0 left-0 right-0 h-[2px] z-10">
              <div className="h-full bg-og-lime rounded-full animate-pulse w-2/3" />
            </div>
          )}

          <iframe
            key={currentPartnership.id}
            ref={iframeRef}
            src={currentPartnership.url}
            title={currentPartnership.name}
            className="w-full h-full border-0"
            allow="clipboard-write; clipboard-read; accelerometer; autoplay"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation allow-popups-to-escape-sandbox"
            style={{ colorScheme: "dark" }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setIframeError(true); }}
          />

          {iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d14] gap-6 px-6">
              <div className={`w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center`}>
                <CurrentIcon className={`h-8 w-8 ${currentPartnership.color}`} />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-black text-white mb-2">Open {currentPartnership.name}</h2>
                <p className="text-sm text-white/40 max-w-sm">
                  Tap below to visit {currentPartnership.name} in a new window.
                </p>
              </div>
              <a
                href={currentPartnership.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-og-lime text-black px-6 py-3 rounded-xl font-black text-sm hover:bg-og-lime/90 transition active:scale-[0.98]"
              >
                <ExternalLink className="h-4 w-4" />
                Visit {currentPartnership.name}
              </a>
            </div>
          )}
        </div>
      </div>
  );
};

export default Partnerships;
