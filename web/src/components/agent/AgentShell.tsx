import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./agent-shell.css";

export type AgentTabId = "setup" | "wallet" | "keys" | "connect" | "agent" | "queue";

const DEFAULT_TABS: { id: AgentTabId; label: string; ico: string }[] = [
  { id: "setup", label: "Home", ico: "⌂" },
  { id: "wallet", label: "Wallet", ico: "◎" },
  { id: "keys", label: "Keys", ico: "✦" },
  { id: "connect", label: "Connect", ico: "⬡" },
];

type Props = {
  activeTab?: AgentTabId;
  onTabChange?: (tab: AgentTabId) => void;
  statusLabel?: string;
  statusWarn?: boolean;
  showTabs?: boolean;
  onRefresh?: () => void;
  brandHref?: string;
  brandSub?: string;
  footerBrand?: string;
  footerNote?: string;
  mcpUrl?: string;
  tabs?: { id: AgentTabId; label: string; ico?: string }[];
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
  children,
}: Props) {
  const nav = (tabs?.length
    ? tabs.map((t) => ({
        id: t.id,
        label: t.label,
        ico: t.ico || DEFAULT_TABS.find((x) => x.id === t.id)?.ico || "·",
      }))
    : DEFAULT_TABS) as { id: AgentTabId; label: string; ico: string }[];

  return (
    <div className={`ox-agent${showTabs ? " ox-agent--dash" : " ox-agent--simple"}`}>
      <div className="ox-agent__atmosphere" aria-hidden />

      {showTabs && onTabChange && (
        <aside className="ox-agent__rail" aria-label="Agent navigation">
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
              <Link to="/x">X MCP</Link>
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
                <h1>{nav.find((t) => t.id === activeTab)?.label || "Agent"}</h1>
                <p>Dashboard · Claude · ChatGPT · Grok</p>
              </div>
            )}
          </div>
          <div className="ox-agent__top-actions">
            <span className={`ox-agent__pill ox-agent__pill--top${statusWarn ? " is-warn" : " is-ok"}`}>
              <span className="ox-agent__pill-dot" />
              {statusLabel}
            </span>
            {onRefresh && (
              <button type="button" className="ox-agent__icon-btn" onClick={onRefresh} aria-label="Refresh" title="Refresh">
                ↻
              </button>
            )}
            <Link to="/x" className="ox-agent__icon-btn" aria-label="X MCP" title="X MCP">
              ✕
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
              <Link to="/agent">Agent</Link>
              <Link to="/x">X MCP</Link>
              <a href={mcpUrl} target="_blank" rel="noopener noreferrer">
                MCP URL
              </a>
              <Link to="/Orbitxcity">City</Link>
              <Link to="/auth">Account</Link>
            </div>
            <p className="ox-agent__footer-note">{footerNote}</p>
          </div>
        </footer>
      </div>

      {showTabs && onTabChange && (
        <nav className="ox-agent__dock" aria-label="Agent sections">
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
