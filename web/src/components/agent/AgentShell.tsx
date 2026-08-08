import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PlatformThemeButton } from "@/components/theme/PlatformThemeButton";
import { PlatformLinks } from "@/components/theme/PlatformDock";
import "./agent-shell.css";

export type AgentTabId = "setup" | "wallet" | "keys" | "connect" | "agent" | "queue";

export type ShellTab = { id: string; label: string; ico?: string };

const DEFAULT_TABS: ShellTab[] = [
  { id: "setup", label: "Home", ico: "⌂" },
  { id: "wallet", label: "Wallet", ico: "◎" },
  { id: "keys", label: "Keys", ico: "✦" },
  { id: "connect", label: "Connect", ico: "⬡" },
];

type Props = {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  statusLabel?: string;
  statusWarn?: boolean;
  showTabs?: boolean;
  onRefresh?: () => void;
  brandHref?: string;
  brandSub?: string;
  footerBrand?: string;
  footerNote?: string;
  mcpUrl?: string;
  tabs?: ShellTab[];
  /** Cross-link in the top bar (Agent ↔ X). */
  siblingHref?: string;
  siblingLabel?: string;
  siblingIcon?: string;
  topSubtitle?: string;
  children: ReactNode;
};

export function AgentShell({
  activeTab = "setup",
  onTabChange,
  statusLabel = "MCP ready",
  statusWarn = false,
  showTabs = true,
  onRefresh,
  brandHref = "/agent",
  brandSub = "Agent MCP",
  footerBrand = "OrbitX Agent MCP",
  footerNote = "Non-custodial — keys stay on your device until you copy them. You sign every tx in your wallet.",
  mcpUrl = "https://www.orbitx.world/api/mcp",
  tabs,
  siblingHref = "/x",
  siblingLabel = "X MCP",
  siblingIcon = "✕",
  topSubtitle = "Dashboard · Claude · ChatGPT · Grok",
  children,
}: Props) {
  const nav = (tabs?.length ? tabs : DEFAULT_TABS).map((t) => ({
    id: t.id,
    label: t.label,
    ico: t.ico || DEFAULT_TABS.find((x) => x.id === t.id)?.ico || "·",
  }));

  const railSibling =
    brandHref === "/x"
      ? { href: "/agent", label: "Agent" }
      : { href: "/x", label: "X MCP" };

  return (
    <div className={`ox-agent${showTabs ? " ox-agent--dash" : " ox-agent--simple"}`}>
      <div className="ox-agent__atmosphere" aria-hidden />

      {showTabs && onTabChange && (
        <aside className="ox-agent__rail" aria-label="Navigation">
          <Link to={brandHref} className="ox-agent__brand">
            <span className="ox-agent__brand-mark" aria-hidden>
              <img src="/orbitx-banner.jpg" alt="" />
            </span>
            <span className="ox-agent__brand-text">
              <span className="ox-agent__brand-title">
                Orbit<span>X</span>
              </span>
              <span className="ox-agent__brand-sub">{brandSub}</span>
            </span>
          </Link>

          <nav className="ox-agent__nav">
            {nav.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`ox-agent__nav-btn${activeTab === t.id ? " is-active" : ""}`}
                onClick={() => onTabChange(t.id)}
              >
                <span className="ox-agent__nav-ico" aria-hidden>
                  {t.ico}
                </span>
                <span className="ox-agent__nav-label">{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="ox-agent__rail-foot">
            <span className={`ox-agent__pill${statusWarn ? " is-warn" : " is-ok"}`}>
              <span className="ox-agent__pill-dot" />
              {statusLabel}
            </span>
            <div className="ox-agent__rail-links">
              <Link to={railSibling.href}>{railSibling.label}</Link>
              <Link to="/app">Hub</Link>
            </div>
          </div>
        </aside>
      )}

      <div className="ox-agent__stage">
        <header className="ox-agent__top">
          <div className="ox-agent__top-left">
            {!showTabs && (
              <Link to={brandHref} className="ox-agent__brand ox-agent__brand--compact">
                <span className="ox-agent__brand-title">
                  Orbit<span>X</span>
                </span>
                <span className="ox-agent__brand-sub">{brandSub}</span>
              </Link>
            )}
            {showTabs && (
              <div className="ox-agent__top-title">
                <h1>{nav.find((t) => t.id === activeTab)?.label || brandSub}</h1>
                <p>{topSubtitle}</p>
              </div>
            )}
          </div>
          <div className="ox-agent__top-actions">
            <PlatformLinks />
            <PlatformThemeButton compact />
            <span className={`ox-agent__pill ox-agent__pill--top${statusWarn ? " is-warn" : " is-ok"}`}>
              <span className="ox-agent__pill-dot" />
              {statusLabel}
            </span>
            {onRefresh && (
              <button type="button" className="ox-agent__icon-btn" onClick={onRefresh} aria-label="Refresh" title="Refresh">
                ↻
              </button>
            )}
            <Link to={siblingHref} className="ox-agent__icon-btn" aria-label={siblingLabel} title={siblingLabel}>
              {siblingIcon}
            </Link>
            <Link to="/app" className="ox-agent__btn ox-agent__btn--ghost ox-agent__hub-link">
              Hub
            </Link>
          </div>
        </header>

        <main className="ox-agent__main">{children}</main>

        <footer className="ox-agent__footer">
          <div className="ox-agent__footer-inner">
            <div className="ox-agent__footer-brand">{footerBrand}</div>
            <div className="ox-agent__footer-links">
              <Link to="/app">Hub</Link>
              <Link to="/agent">Agent</Link>
              <Link to="/x">X MCP</Link>
              <a href="/ORBITX_DEX">DEX</a>
              <Link to="/orbitxlaunch">Launch</Link>
              <Link to="/nft">NFT</Link>
              <a href={mcpUrl} target="_blank" rel="noopener noreferrer">
                MCP URL
              </a>
            </div>
            <p className="ox-agent__footer-note">{footerNote}</p>
          </div>
        </footer>
      </div>

      {showTabs && onTabChange && (
        <nav className="ox-agent__dock" aria-label="Sections">
          {nav.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ox-agent__dock-btn${activeTab === t.id ? " is-active" : ""}`}
              onClick={() => onTabChange(t.id)}
            >
              <span className="ox-agent__dock-ico" aria-hidden>
                {t.ico}
              </span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export function AgentLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="ox-agent__loading">
      <div className="ox-agent__spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
