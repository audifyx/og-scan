import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fmtUsd, short } from "../lib/api";
import { Zap, Star, ChevronRight } from "lucide-react";
import TokenLogo from "./TokenLogo";

interface Boost {
  id: string; mint: string; symbol?: string; name?: string; icon?: string;
  chain?: string; tier?: string; status?: string; expires_at?: string;
}
interface Listing {
  id: string; contract_address: string; chain: string; project_name?: string;
  symbol?: string; logo_url?: string; banner_url?: string; description?: string;
  links?: Record<string, string>; metadata?: any; featured?: boolean;
}


function FeaturedCard({ f, onClick }: { f: Listing; onClick: () => void }) {
  const [bannerErr, setBannerErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const banner = f.banner_url && !bannerErr ? f.banner_url : null;
  const logo = f.logo_url && !logoErr ? f.logo_url : null;
  const initials = (f.symbol || f.project_name || "?").slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      style={{ scrollSnapAlign: "start" }}
      className="group relative w-52 h-28 shrink-0 rounded-xl overflow-hidden border border-line hover:border-yellow-500/40 transition-all hover:scale-[1.02]"
    >
      {/* Background layer */}
      {banner ? (
        <img src={banner} loading="lazy" referrerPolicy="no-referrer" onError={() => setBannerErr(true)}
          className="absolute inset-0 w-full h-full object-cover" />
      ) : logo ? (
        // No banner: use the token logo as a blurred, scaled cover so the card shows the coin art
        <img src={logo} loading="lazy" referrerPolicy="no-referrer" onError={() => setLogoErr(true)}
          aria-hidden className="absolute inset-0 w-full h-full object-cover scale-150 blur-xl opacity-60" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent2/25 via-panel2 to-accent/15" />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%)" }} />

      {/* Token logo circle */}
      <div className="absolute top-2.5 left-2.5 z-10">
        {logo
          ? <img src={logo} loading="lazy" referrerPolicy="no-referrer" onError={() => setLogoErr(true)}
              className="w-9 h-9 rounded-full border-2 border-white/30 object-cover shadow-lg bg-panel2" />
          : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent2/40 to-accent/30 border-2 border-white/20 grid place-items-center text-xs font-bold text-white shadow-lg">
              {initials}
            </div>}
      </div>

      {/* Featured star badge */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <span className="pill bg-yellow-500/25 text-yellow-400 text-[9px] font-bold backdrop-blur-sm">★</span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
        <div className="font-bold text-white text-sm truncate leading-tight">{f.symbol || f.project_name}</div>
        <div className="text-[10px] text-white/60 truncate leading-tight">{f.project_name || short(f.contract_address)}</div>
      </div>
    </button>
  );
}

export default function FeaturedBanner() {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [featured, setFeatured] = useState<Listing[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    fetch("/api/ogdex/boosts").then((r) => r.json()).then((d) => setBoosts(d.boosts || [])).catch(() => {});
    fetch("/api/ogdex/listings?featured=1").then((r) => r.json()).then((d) => setFeatured(d.rows || [])).catch(() => {});
  }, []);

  // Auto-scroll boost reel
  useEffect(() => {
    if (!boosts.length) return;
    const id = setInterval(() => setActiveIdx((p) => (p + 1 >= boosts.length ? 0 : p + 1)), 2200);
    return () => clearInterval(id);
  }, [boosts.length]);

  useEffect(() => {
    const el = railRef.current;
    if (!el || !boosts.length) return;
    const chip = el.children[activeIdx] as HTMLElement | undefined;
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIdx, boosts.length]);

  const hasBoosts = boosts.length > 0;
  const hasFeatured = featured.length > 0;
  if (!hasBoosts && !hasFeatured) return null;

  // Show up to 8 featured tokens as a compact horizontal strip.
  const slots = featured.slice(0, 8);

  const handleToken = (f: Listing) => {
    if (f.chain === "solana") nav(`/token/${f.contract_address}`);
    else window.open(f.links?.website || `https://dexscreener.com/search?q=${f.contract_address}`, "_blank");
  };

  return (
    <div className="mb-5 space-y-3">
      {/* ── Boost Reel ─────────────────────────────────────────────── */}
      {hasBoosts && (
        <div className="card border border-accent/20 overflow-hidden">
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-accent tracking-wide uppercase">Boosted Tokens</span>
            <Link to="/store" className="ml-auto text-[10px] text-muted hover:text-white transition-colors flex items-center gap-0.5">
              Boost yours <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div
            ref={railRef}
            className="flex gap-2 px-3 pb-3 overflow-x-auto"
            style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
          >
            {boosts.map((b, i) => (
              <button
                key={b.id}
                onClick={() => (!b.chain || b.chain === "solana") ? nav(`/token/${b.mint}`) : undefined}
                style={{ scrollSnapAlign: "center" }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-all cursor-pointer
                  ${i === activeIdx
                    ? "border-accent/60 bg-accent/10 scale-[1.03] shadow-[0_0_12px_rgba(var(--accent-rgb),0.2)]"
                    : "border-line bg-panel2/60 hover:border-accent/30"}`}
              >
                <TokenLogo src={b.icon} sym={b.symbol} size={22} />
                <span className="text-xs font-bold text-white">{b.symbol || short(b.mint)}</span>
                <span className="text-[9px] text-accent font-semibold uppercase tracking-wide">
                  {b.tier === "24h" ? "24h" : "6h"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Featured Daily — square grid ───────────────────────────── */}
      {hasFeatured && (
        <div className="card border border-yellow-500/15 overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-xs font-semibold text-yellow-400 tracking-wide uppercase">Featured Daily</span>
            <Link to="/store" className="ml-auto text-[10px] text-muted hover:text-white transition-colors flex items-center gap-0.5">
              Get featured <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Compact horizontal strip — consistent card size, no giant squares */}
          <div className="flex gap-2 px-3 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {slots.map((f) => (
              <FeaturedCard key={f.id} f={f} onClick={() => handleToken(f)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
