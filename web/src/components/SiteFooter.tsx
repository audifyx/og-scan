import { AtSign, ExternalLink, Globe2, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { OGSCAN_BRAND_IMAGE, OGSCAN_SITE_URL, OGSCAN_TECH_POST_URL, OGSCAN_X_URL } from "@/lib/og";

type NavItem = { id: string; label: string };

type Props = {
  navItems: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
};

export const SiteFooter = ({ navItems, activeId, onNavigate }: Props) => {
  return (
    <footer className="relative border-t border-og-grid bg-og-ink">
      <div className="absolute inset-0 grid-bg opacity-35" />
      <div className="relative mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr_0.8fr] lg:items-start">
          <div className="flex flex-col gap-5">
            <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="block w-full max-w-sm overflow-hidden border border-og-lime/40 bg-og-ink shadow-og transition hover:border-og-lime">
              <img src={OGSCAN_BRAND_IMAGE} alt="OG Scan official banner" className="aspect-[16/9] w-full object-cover" />
            </a>
            <div>
              <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="font-display text-4xl font-bold text-og-gold text-glow-gold hover:text-og-lime">ogscan.fun</a>
              <div className="mt-2 max-w-md text-xs uppercase leading-relaxed tracking-widest text-muted-foreground">
                Official OG Scan links. Built for Solana traders who want origin data before narrative noise.
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.32em] text-og-cyan">Feature Map</div>
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "border px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition",
                    activeId === item.id
                      ? "border-og-lime bg-og-lime text-og-ink"
                      : "border-og-grid bg-og-ink/70 text-foreground/65 hover:border-og-lime hover:text-og-lime",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-lime bg-og-lime px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-ink transition hover:bg-og-lime/90">
                <AtSign className="h-3.5 w-3.5" /> X <ExternalLink className="h-3 w-3" />
              </a>
              <a href={OGSCAN_TECH_POST_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-gold/70 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-og-gold transition hover:bg-og-gold hover:text-og-ink">
                <Newspaper className="h-3.5 w-3.5" /> Tech post
              </a>
              <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-og-grid px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime">
                <Globe2 className="h-3.5 w-3.5" /> Website
              </a>
            </div>
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
