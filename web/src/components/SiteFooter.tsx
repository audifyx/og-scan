import { AtSign, Coins, ExternalLink, Globe2, Newspaper } from "lucide-react";
import {
  OGSCAN_BRAND_IMAGE,
  OGSCAN_DEXSCREENER_URL,
  OGSCAN_SITE_URL,
  OGSCAN_TECH_POST_URL,
  OGSCAN_TOKEN_MINT,
  OGSCAN_X_URL,
  shortAddr,
} from "@/lib/og";

export const SiteFooter = () => {
  return (
    <footer className="relative border-t border-og-grid bg-[#010c17]">
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-lime/40 to-transparent" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[600px] -translate-x-1/2 rounded-full bg-og-lime/5 blur-[80px]" />
      <div className="relative mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="flex flex-col gap-5">
            <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="block w-full max-w-md overflow-hidden rounded-[1rem] border border-og-lime/40 bg-black shadow-og transition hover:border-og-lime hover:shadow-[0_0_40px_-12px_hsl(var(--og-lime))]">
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
              <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-og-lime bg-og-lime px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-ink shadow-[0_0_24px_-8px_hsl(var(--og-lime))] transition hover:bg-white hover:shadow-[0_0_36px_-8px_hsl(var(--og-lime))]">
                <AtSign className="h-3.5 w-3.5" /> X <ExternalLink className="h-3 w-3" />
              </a>
              <a href={OGSCAN_TECH_POST_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-og-gold/70 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-gold transition hover:bg-og-gold/10 hover:border-og-gold">
                <Newspaper className="h-3.5 w-3.5" /> Tech post
              </a>
              <span className="inline-flex items-center gap-2 rounded-full border border-og-cyan/60 bg-og-cyan/5 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-cyan">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-cyan opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-og-cyan" />
                </span>
                Token live
              </span>
              <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-og-grid px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/70 transition hover:border-og-lime/60 hover:text-og-lime">
                <Globe2 className="h-3.5 w-3.5" /> Website
              </a>
            </div>
            <div className="border-l-2 border-og-lime/70 bg-og-lime/5 px-4 py-3 text-left font-mono text-[10px] uppercase leading-relaxed tracking-[0.24em] text-og-lime lg:max-w-sm lg:text-right">
              We detect trends before they exist · scanning the chain for OG signals
            </div>
            <div className="block max-w-sm border border-og-grid bg-black/30 px-4 py-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-muted-foreground lg:text-right">
              Official CA: {shortAddr(OGSCAN_TOKEN_MINT, 6)} · copy the full address from the Our Coin tab before trading.
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground lg:text-right">
              <a href="https://jup.ag" target="_blank" rel="noreferrer" className="hover:text-og-lime">Jupiter</a>
              <a href={OGSCAN_DEXSCREENER_URL} target="_blank" rel="noreferrer" className="hover:text-og-lime">DexScreener</a>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center gap-2 border-t border-og-grid pt-5">
          <div className="inline-flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.5em] text-muted-foreground">
            <span className="h-px w-8 bg-og-grid" />
            © {new Date().getFullYear()} · ogscan.fun · Built on Solana
            <span className="h-px w-8 bg-og-grid" />
          </div>
          <div className="font-mono text-[8px] uppercase tracking-[0.35em] text-muted-foreground/50">
            Solana memecoin intelligence · forensic tools live
          </div>
        </div>
      </div>
    </footer>
  );
};
