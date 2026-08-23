import { Link } from "react-router-dom";
import { OS_APPS } from "../apps";
import { SmartHref } from "../SmartHref";
import { OxButton, OxPanel, OxTabs } from "../components/primitives";
import { MiniHud, PlayerProfileCard } from "../components/gaming";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function OsDashboardPage() {
  const { profile } = useAuth();
  const [cat, setCat] = useState("all");
  const apps = useMemo(
    () => (cat === "all" ? OS_APPS : OS_APPS.filter((a) => a.category === cat)),
    [cat],
  );

  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <MiniHud />
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "end" }}>
        <div>
          <div className="ox-kicker">App launcher</div>
          <h1 className="ox-title" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
            Command deck
          </h1>
          <p className="ox-lead">Launch trading, social, games, and OrbitX City from one metallic neon shell.</p>
        </div>
        <Link to="/Orbitxcity">
          <OxButton type="button" variant="primary">
            Drop into City
          </OxButton>
        </Link>
      </div>

      <PlayerProfileCard name={profile?.username || "Traveler"} />

      <OxTabs
        value={cat}
        onChange={setCat}
        tabs={[
          { id: "all", label: "All" },
          { id: "world", label: "World" },
          { id: "trade", label: "Trade" },
          { id: "play", label: "Play" },
          { id: "social", label: "Social" },
          { id: "profile", label: "Profile" },
        ]}
      />

      <div className="ox-grid-apps">
        {apps.map((app) => (
          <SmartHref key={app.id} href={app.href} className="ox-app-tile" style={{ ["--tile" as string]: app.accent }}>
            <div className="ox-app-tile__icon">{app.name.slice(0, 1)}</div>
            <strong>{app.name}</strong>
            <span>{app.blurb}</span>
          </SmartHref>
        ))}
      </div>

      <OxPanel>
        <div className="ox-kicker">System</div>
        <p className="ox-lead" style={{ marginBottom: "0.75rem" }}>
          Existing product routes stay authoritative — this OS layer is the premium frontend shell and navigation fabric.
        </p>
        <div className="ox-cta-row">
          <Link to="/app">
            <OxButton type="button" variant="ghost" size="sm">
              Classic Hub
            </OxButton>
          </Link>
          <Link to="/os/settings">
            <OxButton type="button" size="sm">
              Settings
            </OxButton>
          </Link>
        </div>
      </OxPanel>
    </div>
  );
}
