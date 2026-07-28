import { ShieldAlert } from "lucide-react";
import { PlatformDocLayout, PlatformDocCard } from "@/components/platform/PlatformDocLayout";
import { PLATFORM_TERMS } from "@/content/platformDocs";

const Terms = () => (
  <PlatformDocLayout title="Terms of Service" subtitle={`Last updated ${new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}`}>
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-5 flex gap-3 mb-6">
      <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
      <p className="text-[13px] leading-relaxed text-white/80">
        <strong className="text-white">Not financial advice.</strong> OrbitX is informational and non-custodial.
        Crypto is extremely volatile — you can lose everything. Always DYOR.
      </p>
    </div>
    {PLATFORM_TERMS.map((s, i) => (
      <PlatformDocCard key={i} title={s.title}>
        <p>{s.content}</p>
      </PlatformDocCard>
    ))}
  </PlatformDocLayout>
);

export default Terms;
