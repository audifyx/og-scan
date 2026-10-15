import PremiumDocPage, { Reveal } from "@/components/platform/PremiumDocPage";
import { PLATFORM_WHITEPAPER } from "@/content/platformDocs";

export default function PlatformWhitepaper() {
  const { tldr, lede, sections } = PLATFORM_WHITEPAPER;
  const updated = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <PremiumDocPage
      eyebrow="OrbitX Protocol"
      title={<>The OrbitX<br />Whitepaper</>}
      subtitle={`Version 5.0 · ${updated} · ~8 min read. The full vision: a unified crypto command center for discovery, trading, social, and intelligence — on Solana and beyond.`}
      rotatingWords={["traders", "builders", "degens", "analysts", "the on-chain future"]}
      marqueeItems={["Non-custodial", "Real-time intel", "Social trading", "Launchpad", "NFT marketplace", "AI-powered"]}
    >
      <Reveal>
        <div className="premium-section">
          <div className="premium-section__num">TL;DR</div>
          <div className="premium-section__body"><p style={{ fontSize: 17, color: "rgba(255,255,255,0.88)" }}>{tldr}</p></div>
        </div>
      </Reveal>

      <Reveal>
        <div className="premium-section">
          <div className="premium-section__body"><p style={{ fontSize: 17 }}>{lede}</p></div>
        </div>
      </Reveal>

      {sections.map((sec, idx) => (
        <Reveal key={sec.id} delay={Math.min(idx * 60, 300)}>
          <div className="premium-section">
            <div className="premium-section__num">{String(idx + 1).padStart(2, "0")}</div>
            <h2 className="premium-section__title">{sec.title}</h2>
            <div className="premium-section__body">
              {sec.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              {sec.bullets && (
                <ul>{sec.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
              )}
            </div>
          </div>
        </Reveal>
      ))}
    </PremiumDocPage>
  );
}
