import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bot, ChevronRight, Command, Cpu, KeyRound, Settings2,
  ShoppingBag, WalletCards, X, Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { isOwnerIdentity } from "@/lib/ownerDesk";
import { AgentDashboard } from "@/components/agent/agent-dashboard";
import { McpShop } from "@/components/agent/McpShop";
import { TradeDesk } from "@/components/agent/TradeDesk";
import { InAppWalletPanel } from "@/components/agent/InAppWalletPanel";
import XMcpPage from "@/pages/XMcpPage";
import {
  IosAppShell, IosNav, IosRailBrand, IosRailLink, IosTabBar,
  type IosTabItem,
} from "@/components/app-shell/IosAppShell";
import "./mcp-super-computer.css";

/* ── 5 tabs. One place per thing. ──
   home    → Overview dashboard
   connect → ALL auth: account, MCP keys, X account, AI connections
   wallet  → In-app wallet (the ONLY wallet place)
   trade   → Trade desk (the ONLY trading place)
   shop    → Shop (the ONLY purchase place)
*/
type MainTab = "home" | "connect" | "wallet" | "trade" | "shop";

const mainTabs: { id: MainTab; label: string; short: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Home", short: "Home", icon: <Command size={18} /> },
  { id: "connect", label: "Connect", short: "Connect", icon: <KeyRound size={18} /> },
  { id: "wallet", label: "Wallet", short: "Wallet", icon: <WalletCards size={18} /> },
  { id: "trade", label: "Trade", short: "Trade", icon: <Zap size={18} /> },
  { id: "shop", label: "Shop", short: "Shop", icon: <ShoppingBag size={18} /> },
];

const TAB_ALIASES: Record<string, MainTab> = {
  workspace: "connect", agent: "connect", setup: "connect",
  inapp: "wallet", channels: "connect", access: "shop", shop: "shop",
};

function resolveTab(v: string | null): MainTab {
  if (!v) return "home";
  if (mainTabs.some((t) => t.id === v)) return v as MainTab;
  return TAB_ALIASES[v] || "home";
}

function StatusPill({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return <span className={`supercomputer-status ${ready ? "is-ready" : "is-pending"}`}><i />{children}</span>;
}

export default function McpSuperComputer() {
  const { user } = useAuth();
  const { address: walletAddress, ready: walletReady, label: walletLabel } = useActiveTradingWallet();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<MainTab>(() => resolveTab(searchParams.get("tab")));
  const [connectSection, setConnectSection] = useState<"account" | "mcp" | "x" | "ai">("account");

  useEffect(() => {
    const r = resolveTab(searchParams.get("tab"));
    if (r !== tab) setTab(r);
  }, [searchParams, tab]);

  const go = (next: MainTab) => {
    setTab(next);
    const p = new URLSearchParams();
    if (next !== "home") p.set("tab", next);
    setSearchParams(p, { replace: true });
  };

  const accountReady = Boolean(user);
  const owner = isOwnerIdentity({ email: user?.email, wallet: walletAddress });
  const activeTitle = mainTabs.find((t) => t.id === tab)?.label || "Home";
  const bottomTabs: IosTabItem[] = mainTabs.map((t) => ({ id: t.id, label: t.short, ico: t.icon }));

  return (
    <IosAppShell accent="gold" wide className="supercomputer-ios sc-gold" stageClassName="supercomputer-stage">
      <div className="supercomputer-frame">
        <aside className="supercomputer-rail" aria-label="Supercomputer navigation">
          <IosRailBrand href="/supercomputer" title="OrbitX" subtitle="Supercomputer" />
          <div className="supercomputer-rail-label">Control Plane</div>
          {mainTabs.map((t) => (
            <IosRailLink key={t.id} label={t.label} ico={t.icon} active={tab === t.id} onClick={() => go(t.id)} />
          ))}
          <div className="supercomputer-rail-spacer" />
          <StatusPill ready={walletReady}>{walletReady ? "Wallet live" : accountReady ? "Signed in" : "Sign in"}</StatusPill>
          <button type="button" className="supercomputer-rail-account" onClick={() => go("connect")}>
            <span>{user ? (user.email || "OrbitX account") : "Sign in"}</span>
            <small>{owner ? "Owner access" : walletLabel || (user ? "OrbitX account" : "Open /auth")}</small>
          </button>
        </aside>

        <div className="supercomputer-main">
          <IosNav
            title={activeTitle}
            trail={<>
              <StatusPill ready={walletReady}>{walletReady ? "Ready" : "Setup"}</StatusPill>
              <button type="button" className="ios-nav__btn supercomputer-nav-action" onClick={() => go("connect")} aria-label="Open connect">
                <Settings2 size={17} />
              </button>
            </>}
          />
          <main className="supercomputer-body">
            {/* ── HOME ── */}
            {tab === "home" && (
              <div className="sc-home">
                <div className="sc-hero">
                  <div>
                    <p className="sc-eyebrow"><span className="sc-live-dot" /> ORBITX SUPERCOMPUTER</p>
                    <h1>Everything in <em>one place.</em></h1>
                    <p className="sc-sub">Connect your account, manage your wallet, trade, and shop — no tab-hopping.</p>
                  </div>
                  <div className="sc-hero-orb"><Cpu size={28} /><span>ORBITX</span></div>
                </div>
                <div className="sc-grid">
                  {[
                    { id: "connect" as MainTab, icon: <KeyRound size={20} />, title: "Connect", desc: "Account, API keys, X, AI — all auth in one place", cta: accountReady ? "Manage connections" : "Connect account" },
                    { id: "wallet" as MainTab, icon: <WalletCards size={20} />, title: "Wallet", desc: "Your in-app wallet. Create, view, export.", cta: walletReady ? "Open wallet" : "Set up wallet" },
                    { id: "trade" as MainTab, icon: <Zap size={20} />, title: "Trade", desc: "Natural-language trade commands with exact amounts.", cta: "Open trade desk" },
                    { id: "shop" as MainTab, icon: <ShoppingBag size={20} />, title: "Shop", desc: "Access passes, credits, and upgrades.", cta: "Browse shop" },
                  ].map((c) => (
                    <button key={c.id} type="button" className="sc-card" onClick={() => go(c.id)}>
                      <div className="sc-card-icon">{c.icon}</div>
                      <strong>{c.title}</strong>
                      <p>{c.desc}</p>
                      <span className="sc-card-cta">{c.cta} <ChevronRight size={14} /></span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── CONNECT: all auth in one place ── */}
            {tab === "connect" && (
              <div className="sc-connect">
                <div className="sc-section-head">
                  <p className="sc-eyebrow">AUTHORIZATION</p>
                  <h2>Connect everything once.</h2>
                  <p>Account, API keys, X, and AI clients — all in one place. No hunting through tabs.</p>
                </div>
                <div className="sc-pills">
                  {[
                    { id: "account" as const, label: "Account", icon: <Bot size={15} /> },
                    { id: "mcp" as const, label: "MCP API Keys", icon: <KeyRound size={15} /> },
                    { id: "x" as const, label: "X Account", icon: <X size={15} /> },
                    { id: "ai" as const, label: "AI Clients", icon: <Cpu size={15} /> },
                  ].map((s) => (
                    <button key={s.id} type="button" className={connectSection === s.id ? "is-active" : ""} onClick={() => setConnectSection(s.id)}>
                      {s.icon}{s.label}
                    </button>
                  ))}
                </div>
                <div className="sc-embedded">
                  {connectSection === "account" && <AgentDashboard embedded initialTab="setup" />}
                  {connectSection === "mcp" && <AgentDashboard embedded initialTab="keys" />}
                  {connectSection === "x" && <XMcpPage embedded initialTab="account" />}
                  {connectSection === "ai" && <AgentDashboard embedded initialTab="connect" />}
                </div>
              </div>
            )}

            {/* ── WALLET: the only wallet place ── */}
            {tab === "wallet" && (
              <div className="sc-wallet">
                <div className="sc-section-head">
                  <p className="sc-eyebrow">IN-APP WALLET</p>
                  <h2>Your wallet.</h2>
                  <p>The only wallet in OrbitX. Create it, view balances, export the key.</p>
                </div>
                <InAppWalletPanel />
              </div>
            )}

            {/* ── TRADE: the only trading place ── */}
            {tab === "trade" && (
              <div className="sc-trade">
                <div className="sc-section-head">
                  <p className="sc-eyebrow">TRADE DESK</p>
                  <h2>Command the trade.</h2>
                  <p>Plain language, exact contract address, review before signing.</p>
                  <StatusPill ready={walletReady}>{walletReady ? "Wallet ready" : "Wallet needed"}</StatusPill>
                </div>
                <TradeDesk walletAddress={walletAddress} onOpenWallet={() => go("wallet")} />
              </div>
            )}

            {/* ── SHOP: real shop UI ── */}
            {tab === "shop" && (
              <div className="sc-shop">
                <div className="sc-section-head">
                  <p className="sc-eyebrow">ORBITX SHOP</p>
                  <h2>Get access.</h2>
                  <p>Passes, credits, and upgrades. One checkout, works everywhere.</p>
                </div>
                <div className="sc-shop-grid">
                  <McpShop variant="both" walletAddress={walletAddress} />
                </div>
              </div>
            )}
          </main>
          <IosTabBar tabs={bottomTabs} activeId={tab} onChange={(id) => go(id as MainTab)} className="supercomputer-tabbar" />
          <div className="ios-home-ind" aria-hidden />
        </div>
      </div>
    </IosAppShell>
  );
}
