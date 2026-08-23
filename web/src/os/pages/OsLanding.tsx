import { Link } from "react-router-dom";
import { OxButton } from "../components/primitives";
import { OS_APPS } from "../apps";
import { SmartHref } from "../SmartHref";

export function OsLandingPage() {
  return (
    <div>
      <section className="ox-hero">
        <div className="ox-kicker">OrbitX World · Gaming OS</div>
        <h1>
          Orbit<span>X</span>
        </h1>
        <p className="ox-lead">
          A futuristic Web3 operating system — trade, launch, socialize, and drop into a persistent 3D city from one neon command deck.
        </p>
        <div className="ox-cta-row">
          <Link to="/os/login">
            <OxButton type="button" variant="primary">
              Connect wallet
            </OxButton>
          </Link>
          <Link to="/os/dashboard">
            <OxButton type="button">Open launcher</OxButton>
          </Link>
          <Link to="/Orbitxcity">
            <OxButton type="button" variant="ghost">
              Enter OrbitX City
            </OxButton>
          </Link>
        </div>
        <div className="ox-stat-row" style={{ marginTop: "1.5rem" }}>
          <div className="ox-stat">
            <b>3</b>
            <small>Live cities</small>
          </div>
          <div className="ox-stat">
            <b>DEX</b>
            <small>Live terminal</small>
          </div>
          <div className="ox-stat">
            <b>Voice</b>
            <small>Spaces ready</small>
          </div>
          <div className="ox-stat">
            <b>AAA</b>
            <small>Game UI layer</small>
          </div>
        </div>
      </section>

      <section className="ox-section">
        <div className="ox-kicker">Surface map</div>
        <h2 className="ox-title" style={{ fontSize: "1.4rem" }}>
          Everything in one OS
        </h2>
        <div className="ox-grid-apps">
          {OS_APPS.filter((a) => ["city", "dex", "launchpad", "games", "social", "voice"].includes(a.id)).map((app) => (
            <SmartHref key={app.id} href={app.href} className="ox-app-tile" style={{ ["--tile" as string]: app.accent }}>
              <div className="ox-app-tile__icon">{app.name.slice(0, 1)}</div>
              <strong>{app.name}</strong>
              <span>{app.blurb}</span>
            </SmartHref>
          ))}
        </div>
      </section>
    </div>
  );
}
