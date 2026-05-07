import { AtSign, ExternalLink, Globe2, LineChart, Newspaper } from "lucide-react";
import {
  OFFICIAL_OGSCAN_DEXSCREENER_URL,
  OFFICIAL_OGSCAN_MINT,
  OGSCAN_BRAND_IMAGE,
  OGSCAN_SITE_URL,
  OGSCAN_TECH_POST_URL,
  OGSCAN_X_URL,
  shortAddr,
} from "@/lib/og";

export const SiteFooter = () => {
  return (
    <footer className="relative border-t border-og-grid bg-og-ink">
      <div className="absolute inset-0 grid-bg opacity-35" />
      <div className="relative mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="flex flex-col gap-5">
            <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="block w-full max-w-md overflow-hidden border border-og-lime/40 bg-black shadow-og transition hover:border-og-lime">
              <div className="relative aspect-[16/9]">
                <div className="absolute inset-0 grid-bg opacity-40" />
                <img src={OGSCAN_BRAND_IMAGE} alt="OG Scan official banner" className="relative h-full w-full object-contain p-4" />
              </div>
            </a>
            <div>
              <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="font-display text-4xl font-bold text-og-gold text-glow-gold hover:text-og-lime">ogscan.fun</a>
              <div className="mt-2 max-w-xl text-xs uppercase leading-relaxed tracking-widest text-muted-foreground">
                Official OG Scan links. Built for Solana traders who want origin data before narrative noise.
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-lime bg-og-lime px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-ink transition hover:bg-og-lime/90">
                <AtSign className="h-3.5 w-3.5" /> X <ExternalLink className="h-3 w-3" />
              </a>
              <a href={OGSCAN_TECH_POST_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-gold/70 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-gold transition hover:bg-og-gold hover:text-og-ink">
                <Newspaper className="h-3.5 w-3.5" /> Tech post
              </a>
              <a href={OFFICIAL_OGSCAN_DEXSCREENER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-cyan/70 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-cyan transition hover:bg-og-cyan hover:text-og-ink">
                <LineChart className="h-3.5 w-3.5" /> Chart
              </a>
              <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-grid px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime">
                <Globe2 className="h-3.5 w-3.5" /> Website
              </a>
            </div>
            <div className="border-l-2 border-og-lime/70 bg-og-lime/5 px-4 py-3 text-left font-mono text-[10px] uppercase leading-relaxed tracking-[0.24em] text-og-lime lg:max-w-sm lg:text-right">
              We detect trends before they exist · scanning the chain for OG signals
            </div>
            <a
              href={`https://solscan.io/token/${OFFICIAL_OGSCAN_MINT}`}
              target="_blank"
              rel="noreferrer"
              className="block max-w-sm break-all border border-og-grid bg-black/30 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:border-og-lime hover:text-og-lime lg:text-right"
            >
              CA {shortAddr(OFFICIAL_OGSCAN_MINT, 6)} <ExternalLink className="ml-1 inline h-3 w-3" />
            </a>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground lg:text-right">
              <a href="https://jup.ag" target="_blank" rel="noreferrer" className="hover:text-og-lime">Jupiter</a>
              <a href="https://birdeye.so" target="_blank" rel="noreferrer" className="hover:text-og-lime">Birdeye</a>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-og-grid pt-4 text-center text-[9px] uppercase tracking-[0.5em] text-muted-foreground">
          © {new Date().getFullYear()} · ogscan.fun · BUILT ON SOLANA
        </div>
      </div>
    </footer>
  );
};
