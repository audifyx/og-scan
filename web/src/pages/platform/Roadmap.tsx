import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, FileText, Sparkles } from "lucide-react";
import { PlatformDocLayout, PlatformDocCard } from "@/components/platform/PlatformDocLayout";
import { PLATFORM_ROADMAP, type RoadmapStatus } from "@/content/platformDocs";
import { PLATFORM_LINKS } from "@/lib/platformLinks";

const STATUS: Record<RoadmapStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  done: { label: "Shipped", cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", Icon: CheckCircle2 },
  progress: { label: "In progress", cls: "text-[#60A5FA] border-[#60A5FA]/30 bg-[#60A5FA]/10", Icon: Loader2 },
  planned: { label: "Planned", cls: "text-white/40 border-white/10 bg-white/[0.03]", Icon: Circle },
};

export default function PlatformRoadmap() {
  return (
    <PlatformDocLayout
      title="Roadmap"
      subtitle="Directional plan — we ship weekly. Follow t.me/OrbitXupdates for releases."
    >
      <div className="flex items-center gap-2 text-[13px] text-white/45 mb-6">
        <Sparkles className="h-4 w-4 text-[#D4AF37]" />
        Items may change. Not financial advice.
      </div>

      <div className="space-y-4">
        {PLATFORM_ROADMAP.map((ph) => (
          <PlatformDocCard key={ph.phase}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F0C75E]">
                {ph.phase}
              </span>
              <span className="font-semibold text-white">{ph.title}</span>
            </div>
            {ph.desc && <p className="text-[12px] text-white/45 mb-3">{ph.desc}</p>}
            <ul className="space-y-2.5">
              {ph.items.map((it, i) => {
                const st = STATUS[it.s];
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <st.Icon className={`h-4 w-4 mt-0.5 shrink-0 ${it.s === "done" ? "text-emerald-400" : it.s === "progress" ? "text-[#60A5FA]" : "text-white/30"}`} />
                    <span className="flex-1 text-[13.5px] text-white/80">{it.t}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${st.cls}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          </PlatformDocCard>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to={PLATFORM_LINKS.whitepaper} className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-[13px] font-semibold text-[#F0C75E] hover:bg-[#D4AF37]/20 transition-colors">
          <FileText className="h-3.5 w-3.5" /> Read whitepaper
        </Link>
        <a href="/ORBITX_DEX/status" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-[13px] text-white/60 hover:text-white transition-colors">
          System status
        </a>
      </div>
    </PlatformDocLayout>
  );
}
