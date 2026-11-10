import PremiumDocPage, { Reveal } from "@/components/platform/PremiumDocPage";
import { ContactBlock } from "@/components/ContactBlock";
import { ORBITX_RISK_DISCLAIMER, ORBITX_SITE_URL } from "@/lib/contact";
import { OGSCAN_TOKEN_MINT } from "@/lib/og";
import { Link } from "react-router-dom";

const About = () => (
  <PremiumDocPage
    eyebrow="Who runs OrbitX"
    title={<>About<br />OrbitX</>}
    subtitle={`OrbitX · orbitx.world · A Solana terminal built by audifyx — DEX, token scanner, launchpad, social, and city in one place. Free to scan, free to use.`}
    rotatingWords={["traders", "builders", "the community", "on-chain truth"]}
    marqueeItems={["Non-custodial", "Forever free to scan", "No financial advice", "Built by audifyx", "Los Angeles, CA"]}
  >
    <Reveal>
      <div className="premium-section">
        <div className="premium-section__num">01</div>
        <h2 className="premium-section__title">Who runs OrbitX</h2>
        <div className="premium-section__body">
          <p>
            OrbitX is built by <strong className="text-white">audifyx</strong>, based in Los Angeles, California.
            The platform is developed in public — the source code is open at{" "}
            <a href="https://github.com/audifyx/og-scan" target="_blank" rel="noreferrer" className="text-[#5aa2ff] hover:underline">
              github.com/audifyx/og-scan
            </a>
            .
          </p>
          <p>
            OrbitX is the home of the ORBITX token, the platform&apos;s official token on Solana. Contract address:{" "}
            <span className="break-all font-mono text-[13px] text-white/85">{OGSCAN_TOKEN_MINT}</span> — always verify
            the address before trading; trending lists and community posts are never an endorsement.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={60}>
      <div className="premium-section">
        <div className="premium-section__num">02</div>
        <h2 className="premium-section__title">What OrbitX is</h2>
        <div className="premium-section__body">
          <p>
            OrbitX is a Solana terminal: a DEX for trading, a token scanner with forensic OG scoring, a launchpad
            for new tokens, a social hub, and OrbitX City. One identity across every app — wallet, profile, and
            social graph follow you from the Terminal to the Launchpad to the OS.
          </p>
          <p>
            Scanning and using OrbitX is free, forever. OrbitX never charges users to scan tokens or use the
            platform.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={120}>
      <div className="premium-section">
        <div className="premium-section__num">03</div>
        <h2 className="premium-section__title">Non-custodial by design</h2>
        <div className="premium-section__body">
          <p>
            Your wallet keys are generated on your device and never sent to OrbitX servers. The in-app wallet is
            PIN-locked. OrbitX never holds your funds and never receives them — there is no deposit to OrbitX.
            Trades and swaps execute on-chain, and you approve what leaves your wallet.
          </p>
          <p>
            Trades and burns already work through the in-app wallet. Some custom transaction types are paused until
            their backend signing is live — paused rather than faked.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={180}>
      <div className="premium-section">
        <div className="premium-section__num">04</div>
        <h2 className="premium-section__title">Risk disclosure</h2>
        <div className="premium-section__body">
          <p>{ORBITX_RISK_DISCLAIMER}</p>
          <p>
            Crypto assets are volatile and high-risk — you can lose everything. Data on OrbitX is aggregated from
            public on-chain and third-party sources and may be delayed, incomplete, or inaccurate. Verify contract
            addresses, liquidity, and ownership yourself before interacting with any token.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={240}>
      <div className="premium-section">
        <div className="premium-section__num">05</div>
        <h2 className="premium-section__title">Contact</h2>
        <div className="premium-section__body">
          <ContactBlock />
          <p className="mt-4">
            <a href={ORBITX_SITE_URL} target="_blank" rel="noreferrer" className="text-[#5aa2ff] hover:underline">
              orbitx.world
            </a>
            {" · "}
            <Link to="/contact" className="text-[#5aa2ff] hover:underline">Contact page</Link>
            {" · "}
            <Link to="/terms" className="text-[#5aa2ff] hover:underline">Terms</Link>
            {" · "}
            <Link to="/privacy" className="text-[#5aa2ff] hover:underline">Privacy</Link>
          </p>
        </div>
      </div>
    </Reveal>
  </PremiumDocPage>
);

export default About;
