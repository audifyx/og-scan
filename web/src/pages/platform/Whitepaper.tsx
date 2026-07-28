import { Link } from "react-router-dom";
import { FileText, Map, ShieldAlert } from "lucide-react";
import { PlatformDocLayout, PlatformDocCard } from "@/components/platform/PlatformDocLayout";
import { PLATFORM_WHITEPAPER } from "@/content/platformDocs";
import { PLATFORM_LINKS } from "@/lib/platformLinks";

export default function PlatformWhitepaper() {
  const { tldr, lede, sections } = PLATFORM_WHITEPAPER;
  const updated = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <PlatformDocLayout
      title="Whitepaper"
      subtitle={`Version 5.0 · ${updated} · ~8 min read`}
    >
      <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] p-5 mb-6">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#F0C75E] mb-2">
          <FileText className="h-3.5 w-3.5" /> TL;DR
        </div>
        <p className="text-[15px] leading-relaxed text-white/85">{tldr}</p>
      </div>

      <p className="text-[16px] leading-relaxed text-white/80 font-medium mb-8">{lede}</p>

      {sections.map((sec) => (
        <PlatformDocCard key={sec.id} title={sec.title}>
          {sec.paragraphs.map((p, i) => (
            <p key={i} className={i > 0 ? "mt-3" : ""}>{p}</p>
          ))}
          {sec.bullets && (
            <ul className="mt-3 list-disc pl-5 space-y-1.5">
              {sec.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </PlatformDocCard>
      ))}

      <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-5 flex gap-3">
        <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
        <p className="text-[13px] leading-relaxed text-white/75">
          OrbitX is a data and analytics platform. Nothing here is financial, investment, legal, or tax advice.
          Crypto is high risk — do your own research.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to={PLATFORM_LINKS.roadmap} className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-[13px] font-semibold text-[#F0C75E] hover:bg-[#D4AF37]/20 transition-colors">
          <Map className="h-3.5 w-3.5" /> View roadmap
        </Link>
        <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-[13px] text-white/60 hover:text-white transition-colors">
          Updates channel
        </a>
      </div>
    </PlatformDocLayout>
  );
}
