import PremiumDocPage, { Reveal } from "@/components/platform/PremiumDocPage";
import { ContactBlock } from "@/components/ContactBlock";
import { Link } from "react-router-dom";

const Contact = () => (
  <PremiumDocPage
    eyebrow="Talk to a human"
    title={<>Contact<br />OrbitX</>}
    subtitle="OrbitX · orbitx.world · Questions, feedback, or a problem with the platform — here is every way to reach the team behind OrbitX."
    rotatingWords={["answers", "feedback", "support", "the community"]}
    marqueeItems={["Email us", "DM on X", "Telegram community", "No phone support", "Los Angeles, CA"]}
  >
    <Reveal>
      <div className="premium-section">
        <div className="premium-section__num">01</div>
        <h2 className="premium-section__title">Reach OrbitX</h2>
        <div className="premium-section__body">
          <ContactBlock />
        </div>
      </div>
    </Reveal>

    <Reveal delay={60}>
      <div className="premium-section">
        <div className="premium-section__num">02</div>
        <h2 className="premium-section__title">What to use for what</h2>
        <div className="premium-section__body">
          <p>
            <strong className="text-white">Email</strong> is best for account issues, privacy questions, and anything
            that needs a written record. <strong className="text-white">X</strong> is best for a fast public reply.
            The <strong className="text-white">Telegram community</strong> is where traders talk — it is a community
            chat, not a trading hotline.
          </p>
          <p>
            Never share your private keys or seed phrase with anyone — including anyone claiming to be OrbitX support.
            OrbitX will never ask for them.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={120}>
      <div className="premium-section">
        <div className="premium-section__num">03</div>
        <h2 className="premium-section__title">More about OrbitX</h2>
        <div className="premium-section__body">
          <p>
            <Link to="/about" className="text-[#5aa2ff] hover:underline">About OrbitX</Link>
            {" — who runs the platform and how it works. "}
            <Link to="/terms" className="text-[#5aa2ff] hover:underline">Terms of Service</Link>
            {" · "}
            <Link to="/privacy" className="text-[#5aa2ff] hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </Reveal>
  </PremiumDocPage>
);

export default Contact;
