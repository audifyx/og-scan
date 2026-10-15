import PremiumDocPage, { Reveal } from "@/components/platform/PremiumDocPage";
import { PLATFORM_TERMS } from "@/content/platformDocs";

const Terms = () => (
  <PremiumDocPage
    eyebrow="The fine print"
    title={<>Terms of<br />Service</>}
    subtitle={`OrbitX · ogscan.fun · Last updated ${new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}. The rules of the road for using OrbitX — trading, social, launchpad, and everything in between.`}
    rotatingWords={["fairness", "clarity", "accountability", "the community"]}
    marqueeItems={["Non-custodial", "No financial advice", "Use at your own risk", "18+ only", "Be excellent"]}
  >
    {PLATFORM_TERMS.map((s, i) => (
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

export default Terms;
