import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./agent-shell.css";

export type AgentTabId = "setup" | "wallet" | "keys" | "connect";

const TABS: { id: AgentTabId; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "wallet", label: "Wallet" },
  { id: "keys", label: "API Keys" },
  { id: "connect", label: "Connect" },
];

type Props = {
  activeTab?: AgentTabId;
  onTabChange?: (tab: AgentTabId) => void;
  statusLabel?: string;
  statusWarn?: boolean;
  showTabs?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
};

export function AgentShell({
  activeTab = "setup",
  onTabChange,
  statusLabel = "MCP ready",
  statusWarn = false,
  showTabs = true,
  onRefresh,
  children,
}: Props) {
  return (
    <div className="ox-agent">
      <header className="ox-agent__header">
        <div className="ox-agent__header-inner">
          <div className="ox-agent__header-row">
            <Link to="/agent" className="ox-agent__brand">
              <div className="ox-agent__brand-mark">
                Orbit<span>X</span>
              </div>
              <div className="ox-agent__brand-sub">Agent</div>
            </Link>

            <div className="ox-agent__header-actions">
              <span className="ox-agent__status">
                <span className={`ox-agent__status-dot${statusWarn ? " is-warn" : ""}`} />
                {statusLabel}
              </span>
              {onRefresh && (
                <button type="button" className="ox-agent__btn ox-agent__btn--ghost" onClick={onRefresh}>
                  Refresh
                </button>
              )}
              <Link to="/app" className="ox-agent__btn">
                Hub
              </Link>
            </div>
          </div>

          {showTabs && onTabChange && (
            <nav className="ox-agent__tabs" aria-label="Agent sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ox-agent__tab${activeTab === t.id ? " is-active" : ""}`}
                  onClick={() => onTabChange(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="ox-agent__main">{children}</main>

      <footer className="ox-agent__footer">
        <div className="ox-agent__footer-inner">
          <div className="ox-agent__footer-brand">OrbitX Agent MCP</div>
          <div className="ox-agent__footer-links">
            <Link to="/agent">Agent</Link>
            <a href="https://www.orbitx.world/api/mcp" target="_blank" rel="noopener noreferrer">
              MCP URL
            </a>
            <Link to="/Orbitxcity">City</Link>
            <Link to="/auth">Account</Link>
          </div>
          <p className="ox-agent__footer-note">
            Non-custodial — keys stay on your device until you copy them. You sign every tx in your wallet.
          </p>
        </div>
      </footer>
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
