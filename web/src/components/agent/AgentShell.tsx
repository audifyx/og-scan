import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { PlatformThemeButton } from "@/components/theme/PlatformThemeButton";
import { PlatformLinks } from "@/components/theme/PlatformDock";
import {
  IosAppShell,
  IosNav,
  IosTabBar,
  IosRailBrand,
  IosRailLink,
  type IosTabItem,
} from "@/components/app-shell/IosAppShell";
import "./agent-shell.css";

export type AgentTabId = "setup" | "shop" | "wallet" | "keys" | "connect" | "agent" | "queue";

export type ShellTab = { id: string; label: string; ico?: string };

const DEFAULT_TABS: ShellTab[] = [
  { id: "setup", label: "Home", ico: "⌂" },
  { id: "shop", label: "Shop", ico: "◈" },
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
  const loc = useLocation();
  const navigate = useNavigate();
  const { isOwnerIdentity } = useAdmin();
  const nav = (tabs?.length ? tabs : DEFAULT_TABS).map((t) => ({
    id: t.id,
    label: t.label,
    ico: t.ico || DEFAULT_TABS.find((x) => x.id === t.id)?.ico || "·",
  }));

  const railSibling =
    brandHref === "/x"
      ? { href: "/agent", label: "Agent" }
      : isOwnerIdentity
        ? { href: "/x", label: "X MCP" }
        : null;

  const title = showTabs
    ? nav.find((t) => t.id === activeTab)?.label || brandSub
    : brandSub;

  const detailPaths = ["/agent/", "/x/"];
  const isDetail =
    detailPaths.some((p) => loc.pathname.startsWith(p) && loc.pathname !== brandHref && loc.pathname !== `${brandHref}/`) &&
    !showTabs;

  const mobileTabs: IosTabItem[] = nav.map((t) => ({
    id: t.id,
    label: t.label,
    ico: t.ico,
  }));

  const accent = brandHref === "/x" ? "teal" : "teal";

  const rail =
    showTabs && onTabChange ? (
      <>
        <IosRailBrand href={brandHref} title="OrbitX" subtitle={brandSub} />
        {nav.map((t) => (
          <IosRailLink
            key={t.id}
            label={t.label}
            ico={t.ico}
            active={activeTab === t.id}
            onClick={() => onTabChange(t.id)}
          />
        ))}
        <div className="mt-auto pt-4 space-y-2">
          <span className={`ox-agent__pill${statusWarn ? " is-warn" : " is-ok"}`}>
            <span className="ox-agent__pill-dot" />
            {statusLabel}
          </span>
          <div className="flex flex-col gap-1 px-1 text-[12px]">
            {railSibling ? (
              <Link to={railSibling.href} className="text-white/70 hover:text-white">
                {railSibling.label}
              </Link>
            ) : null}
            <Link to="/app" className="text-white/70 hover:text-white">
              Hub
            </Link>
          </div>
          <PlatformLinks className="ox-platform-links--compact flex-col !items-stretch" />
        </div>
      </>
    ) : null;

  return (
    <IosAppShell accent={accent} wide className={`ox-agent ox-agent-ios${showTabs ? " ox-agent--dash" : " ox-agent--simple"}`}>
      <div className="ox-agent-ios-frame">
        {rail ? (
          <aside className="ox-agent-ios-rail" aria-label="Navigation">
            {rail}
          </aside>
        ) : null}

        <div className="ox-agent-ios-main">
          <IosNav
            title={title}
            canBack={isDetail || (!showTabs && loc.pathname !== brandHref)}
            onBack={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate(brandHref);
            }}
            trail={
              <>
                <PlatformLinks className="hidden xl:flex" />
                <PlatformThemeButton compact />
                <span className={`ox-agent__pill ox-agent__pill--top${statusWarn ? " is-warn" : " is-ok"}`}>
                  <span className="ox-agent__pill-dot" />
                  {statusLabel}
                </span>
                {onRefresh && (
                  <button type="button" className="ios-nav__btn" onClick={onRefresh} aria-label="Refresh" title="Refresh">
                    ↻
                  </button>
                )}
                {isOwnerIdentity ? (
                  <Link to={siblingHref} className="ios-nav__btn" aria-label={siblingLabel} title={siblingLabel}>
                    {siblingIcon}
                  </Link>
                ) : null}
                <Link to="/app" className="ios-nav__btn hidden sm:inline-flex">
                  Hub
                </Link>
              </>
            }
          />

          {showTabs ? (
            <p className="ios-subhead px-4 pt-1 md:hidden">{topSubtitle}</p>
          ) : null}

          <main className="ox-agent__main ox-agent-ios-body">
            {showTabs ? <h2 className="ios-large-title md:hidden">{title}</h2> : null}
            {children}
          </main>

          <footer className="ox-agent__footer hidden md:block">
            <div className="ox-agent__footer-inner">
              <div className="ox-agent__footer-brand">{footerBrand}</div>
              <div className="ox-agent__footer-links">
                <Link to="/app">Hub</Link>
                <Link to="/agent">Agent</Link>
                {isOwnerIdentity ? <Link to="/x">X MCP</Link> : null}
                <Link to="/shop">Shop</Link>
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

          {showTabs && onTabChange ? (
            <IosTabBar
              tabs={mobileTabs}
              activeId={activeTab}
              onChange={onTabChange}
              className="ox-agent-ios-tabbar"
            />
          ) : null}
          <div className="ios-home-ind" aria-hidden />
        </div>
      </div>
    </IosAppShell>
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
