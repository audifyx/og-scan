import PremiumDocPage, { Reveal } from "@/components/platform/PremiumDocPage";
import { PLATFORM_PRIVACY } from "@/content/platformDocs";

const Privacy = () => (
  <PremiumDocPage
    eyebrow="Your data, your rules"
    title={<>Privacy<br />Policy</>}
    subtitle={`OrbitX · ogscan.fun · Last updated ${new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}. How we collect, use, and protect your information across the OrbitX platform.`}
    rotatingWords={["transparency", "control", "security", "trust"]}
    marqueeItems={["No data selling", "Non-custodial", "Encrypted", "Your keys, your coins", "Opt-out anytime"]}
  >
    {PLATFORM_PRIVACY.map((s, i) => (
      <Reveal key={i} delay={Math.min(i * 60, 300)}>
        <div className="premium-section">
          <div className="premium-section__num">{String(i + 1).padStart(2, "0")}</div>
          <h2 className="premium-section__title">{s.title}</h2>
          <div className="premium-section__body"><p>{s.content}</p></div>
        </div>
      </Reveal>
    ))}
  </PremiumDocPage>
);

export default Privacy;
