import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import { PLATFORM_FOOTER_LEGAL, PLATFORM_LINKS } from "@/lib/platformLinks";

const NAV = [
  { href: PLATFORM_LINKS.whitepaper, label: "Whitepaper" },
  { href: PLATFORM_LINKS.roadmap, label: "Roadmap" },
  { href: PLATFORM_LINKS.terms, label: "Terms" },
  { href: PLATFORM_LINKS.privacy, label: "Privacy" },
];

export function PlatformDocLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const loc = useLocation();

  return (
    <div className="platform-doc min-h-screen bg-[#050505] text-[#f4f5f7]">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover" width={32} height={32} />
            <span className="font-display text-lg font-black tracking-tight">
              Orbit<span className="text-[#D4AF37]">X</span>
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  loc.pathname === href
                    ? "bg-[#D4AF37]/15 text-[#F0C75E]"
                    : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <nav className="flex sm:hidden gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                loc.pathname === href ? "bg-[#D4AF37]/15 text-[#F0C75E]" : "text-white/45"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]/80 mb-2">OrbitX Platform</p>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-[14px] text-white/45">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </main>

      <footer className="border-t border-white/[0.08] bg-[#030303]">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center sm:justify-start">
            {PLATFORM_FOOTER_LEGAL.map(({ label, href }) => (
              <Link key={href} to={href} className="text-[13px] text-white/45 hover:text-[#F0C75E] transition-colors">
                {label}
              </Link>
            ))}
            <a href="/ORBITX_DEX" className="text-[13px] text-white/45 hover:text-[#F0C75E] transition-colors">DEX</a>
            <a href="/orbitxlaunch" className="text-[13px] text-white/45 hover:text-[#F0C75E] transition-colors">Launchpad</a>
          </div>
          <p className="mt-4 text-center sm:text-left text-[11px] text-white/30">
            © {new Date().getFullYear()} OrbitX · ogscan.fun · Not financial advice
          </p>
        </div>
      </footer>
    </div>
  );
}

export function PlatformDocCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6 mb-4">
      {title && <h2 className="text-[17px] font-bold text-white mb-2">{title}</h2>}
      <div className="text-[14px] leading-relaxed text-white/65">{children}</div>
    </section>
  );
}
