/**
 * Wallets page — Embedded Phantom swap terminal for OGS token.
 */

import { useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { OGSCAN_TOKEN_MINT } from "@/lib/og";

const Wallets = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Phantom Trade terminal
  const phantomSwapUrl = `https://trade.phantom.com/`;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen w-full bg-[#0a0a0f]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0d0d14]/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-white tracking-tight">Trade OGS</h1>
            <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
              Powered by Phantom
            </span>
          </div>
          <a
            href={phantomSwapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#ab9ff2] hover:text-[#c4bbff] transition-colors font-semibold"
          >
            Open in Phantom ↗
          </a>
        </div>

        {/* Embedded Phantom swap */}
        <div className="flex-1 w-full relative">
          <iframe
            ref={iframeRef}
            src={phantomSwapUrl}
            title="Phantom Swap — OGS Token"
            className="w-full h-full border-0"
            allow="clipboard-write; clipboard-read; wallet-standard"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation allow-popups-to-escape-sandbox"
            style={{ colorScheme: "dark" }}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Wallets;
