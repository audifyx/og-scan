import { Link } from "react-router-dom";
import { OxButton, OxPanel } from "../components/primitives";
import type { CSSProperties, ReactNode } from "react";

function isExternalAppHref(href: string): boolean {
  return href.startsWith("/ORBITX_DEX") || href.startsWith("http");
}

function AppHref({ href, children, style }: { href: string; children: ReactNode; style?: CSSProperties }) {
  if (isExternalAppHref(href)) {
    return <a href={href} style={style}>{children}</a>;
  }
  return <Link to={href} style={style}>{children}</Link>;
}

function FeatureShell({
  kicker,
  title,
  lead,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ox-section" style={{ marginTop: 0 }}>
      <div className="ox-kicker">{kicker}</div>
      <h1 className="ox-title" style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>
        {title}
      </h1>
      <p className="ox-lead">{lead}</p>
      <div className="ox-cta-row">
        <AppHref href={primaryHref}>
          <OxButton type="button" variant="primary">
            {primaryLabel}
          </OxButton>
        </AppHref>
        {secondaryHref && secondaryLabel && (
          <AppHref href={secondaryHref}>
            <OxButton type="button" variant="ghost">
              {secondaryLabel}
            </OxButton>
          </AppHref>
        )}
      </div>
      {children}
    </div>
  );
}

function PreviewFrame({ label, href }: { label: string; href: string }) {
  return (
    <OxPanel>
      <div className="ox-kicker">Live surface</div>
      <div
        style={{
          marginTop: "0.75rem",
          borderRadius: 12,
          border: "1px solid var(--ox-line)",
          minHeight: 180,
          background:
            "linear-gradient(135deg, rgba(23,255,77,0.08), rgba(61,231,255,0.05)), repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(23,255,77,0.05) 12px)",
          display: "grid",
          placeItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="ox-scanline" />
        <div style={{ textAlign: "center", zIndex: 1 }}>
          <div style={{ fontFamily: "var(--ox-font-display)", letterSpacing: "0.08em" }}>{label}</div>
          <AppHref href={href} style={{ color: "var(--ox-lime)", fontSize: "0.85rem" }}>
            Open full module →
          </AppHref>
        </div>
      </div>
    </OxPanel>
  );
}

export function OsTradingPage() {
  return (
    <FeatureShell
      kicker="Trading terminal"
      title="Execution deck"
      lead="Jump into OrbitX DEX for live screener, swaps, and portfolio — wrapped in the OS chrome."
      primaryHref="/ORBITX_DEX"
      primaryLabel="Open OrbitX DEX"
      secondaryHref="/trade"
      secondaryLabel="Open Trade"
    >
      <div className="ox-stat-row">
        <div className="ox-stat">
          <b>Jup</b>
          <small>Routing</small>
        </div>
        <div className="ox-stat">
          <b>Live</b>
          <small>Screener</small>
        </div>
        <div className="ox-stat">
          <b>Wallet</b>
          <small>Portfolio</small>
        </div>
        <div className="ox-stat">
          <b>Tape</b>
          <small>Feeds</small>
        </div>
      </div>
      <PreviewFrame label="Trading Terminal Preview" href="/ORBITX_DEX" />
    </FeatureShell>
  );
}

export function OsScannerPage() {
  return (
    <FeatureShell
      kicker="Token scanner"
      title="Forensic radar"
      lead="OG score, holder quality, migration watches, and risk — open the command tools."
      primaryHref="/command"
      primaryLabel="Open scanner suite"
      secondaryHref="/ORBITX_DEX"
      secondaryLabel="DEX research"
    >
      <PreviewFrame label="Scanner HUD" href="/command" />
    </FeatureShell>
  );
}

export function OsLaunchpadPage() {
  return (
    <FeatureShell
      kicker="Launchpad"
      title="Fair launch console"
      lead="Create, monitor, and graduate tokens with OrbitX anti-vamp protections."
      primaryHref="/orbitxlaunch"
      primaryLabel="Open launchpad"
      secondaryHref="/orbitxlaunch/create"
      secondaryLabel="Create token"
    >
      <PreviewFrame label="Launchpad Console" href="/orbitxlaunch" />
    </FeatureShell>
  );
}

export function OsGamesPage() {
  return (
    <FeatureShell
      kicker="Games hub"
      title="Play layer"
      lead="Degen Tower, prediction games, and OrbitX City multiplayer lobbies."
      primaryHref="/play"
      primaryLabel="Open games"
      secondaryHref="/Orbitxcity"
      secondaryLabel="Enter City"
    >
      <div className="ox-grid-apps">
        <Link to="/play" className="ox-app-tile" style={{ ["--tile" as string]: "#17ff4d" }}>
          <div className="ox-app-tile__icon">D</div>
          <strong>Degen Tower</strong>
          <span>Tap-to-earn arcade</span>
        </Link>
        <Link to="/os/predictions" className="ox-app-tile" style={{ ["--tile" as string]: "#f5c542" }}>
          <div className="ox-app-tile__icon">P</div>
          <strong>Predictions</strong>
          <span>Markets & 1v1</span>
        </Link>
        <Link to="/os/lobbies" className="ox-app-tile" style={{ ["--tile" as string]: "#3de7ff" }}>
          <div className="ox-app-tile__icon">L</div>
          <strong>Lobbies</strong>
          <span>Matchmaking rooms</span>
        </Link>
      </div>
    </FeatureShell>
  );
}

export function OsPredictionsPage() {
  return (
    <FeatureShell
      kicker="Prediction markets"
      title="Odds arena"
      lead="OrbitX Predictions — on-chain markets linked to DEX intel. Launching soon."
      primaryHref="/predictions"
      primaryLabel="Coming soon page"
      secondaryHref="/play"
      secondaryLabel="Play Studio"
    >
      <PreviewFrame label="Prediction Board" href="/predictions" />
    </FeatureShell>
  );
}

export function OsSocialPage() {
  return (
    <FeatureShell
      kicker="Social feed"
      title="Signal stream"
      lead="Posts, follows, and community energy — jump into the social hub."
      primaryHref="/social"
      primaryLabel="Open social"
      secondaryHref="/social-hub"
      secondaryLabel="Social hub"
    >
      <PreviewFrame label="Social Feed" href="/social" />
    </FeatureShell>
  );
}

export function OsCommunitiesPage() {
  return (
    <FeatureShell
      kicker="Communities"
      title="Guild grid"
      lead="Coin communities, classic rooms, and creator hubs."
      primaryHref="/communities"
      primaryLabel="Open communities"
      secondaryHref="/coin-communities"
      secondaryLabel="Coin communities"
    >
      <PreviewFrame label="Communities" href="/communities" />
    </FeatureShell>
  );
}

export function OsVoicePage() {
  return (
    <FeatureShell
      kicker="Voice spaces"
      title="Live plazas"
      lead="Spaces, voice lobbies, and City voice plaza entry points."
      primaryHref="/spaces"
      primaryLabel="Open Spaces"
      secondaryHref="/voice-rooms"
      secondaryLabel="Voice rooms"
    >
      <PreviewFrame label="Voice Matrix" href="/spaces" />
    </FeatureShell>
  );
}

export function OsLeaderboardsPage() {
  return (
    <FeatureShell
      kicker="Leaderboards"
      title="Hall of signal"
      lead="Ranked traders, callers, and City pioneers."
      primaryHref="/ORBITX_DEX/leaderboard"
      primaryLabel="DEX leaderboard"
      secondaryHref="/orbitxlaunch/leaderboard"
      secondaryLabel="Launchpad ranks"
    >
      <OxPanel>
        <div className="ox-list">
          {["NeonWolf", "ShardQueen", "JupPilot", "PlazaKid", "LimeFox"].map((n, i) => (
            <div key={n} className="ox-list-item">
              <span>
                #{i + 1} {n}
              </span>
              <span className="ox-badge">{(12000 - i * 930).toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      </OxPanel>
    </FeatureShell>
  );
}
