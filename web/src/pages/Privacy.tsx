import { PlatformDocLayout, PlatformDocCard } from "@/components/platform/PlatformDocLayout";
import { PLATFORM_PRIVACY } from "@/content/platformDocs";

const Privacy = () => (
  <PlatformDocLayout
    title="Privacy Policy"
    subtitle={`OrbitX · ogscan.fun · Last updated ${new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}`}
  >
    {PLATFORM_PRIVACY.map((s, i) => (
      <PlatformDocCard key={i} title={s.title}>
        <p>{s.content}</p>
      </PlatformDocCard>
    ))}
  </PlatformDocLayout>
);

export default Privacy;
