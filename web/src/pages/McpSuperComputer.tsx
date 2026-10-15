import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Bot, ChevronRight, CircleDollarSign, Code2, Command, Cpu, KeyRound, MessageCircle, Radio, ShieldCheck, Sparkles, Store, WalletCards, X, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { isOwnerIdentity } from "@/lib/ownerDesk";
import { AgentDashboard } from "@/components/agent/agent-dashboard";
import { McpShop } from "@/components/agent/McpShop";
import { TradeDesk } from "@/components/agent/TradeDesk";
import { InAppWalletPanel } from "@/components/agent/InAppWalletPanel";
import XMcpPage from "@/pages/XMcpPage";
import {
  IosAppShell,
  IosNav,
  IosRailBrand,
  IosRailLink,
  IosTabBar,
  type IosTabItem,
} from "@/components/app-shell/IosAppShell";
import "./mcp-super-computer.css";

/* ── Clean tab structure: 6 tabs, no ghosts, no duplication ──
   home     → Overview: status of everything
   agent    → AI Agent: setup guide, MCP API keys, connect AI clients
   wallet   → In-app wallet: THE single wallet place (create/manage/export)
   trade    → Trade Desk: natural-language trade commands
   channels → Channels: X publishing, DMs, queues
   access   → Access: shop, credits, timed access
*/
type MainTab = "home" | "agent" | "wallet" | "trade" | "channels" | "access";
type AgentFocus = "setup" | "keys" | "connect";
type XFocus = "home" | "account" | "keys" | "connect";
type XHomeSub = "post" | "agent" | "queue" | "messages" | "matrix";

type MainTabItem = { id: MainTab; label: string; short: string; icon: React.ReactNode };

const mainTabs: MainTabItem[] = [
  { id: "home", label: "Overview", short: "Home", icon: <Command size={18} /> },
  { id: "agent", label: "AI Agent", short: "Agent", icon: <Bot size={18} /> },
  { id: "wallet", label: "Wallet", short: "Wallet", icon: <WalletCards size={18} /> },
  { id: "trade", label: "Trade", short: "Trade", icon: <Zap size={18} /> },
  { id: "channels", label: "Channels", short: "Channels", icon: <Radio size={18} /> },
  { id: "access", label: "Access", short: "Access", icon: <Store size={18} /> },
];

/* Backwards compat: old tab IDs redirect to new ones */
const TAB_ALIASES: Record<string, MainTab> = {
  workspace: "agent",
  inapp: "wallet",
  shop: "access",
  setup: "agent",
};

const agentTabs: Array<{ id: AgentFocus; label: string; icon: React.ReactNode }> = [
  { id: "setup", label: "Setup guide", icon: <Sparkles size={15} /> },
  { id: "keys", label: "MCP API keys", icon: <KeyRound size={15} /> },
  { id: "connect", label: "Connect AI", icon: <Code2 size={15} /> },
];

const xTabs: Array<{ id: XFocus; label: string; icon: React.ReactNode }> = [
  { id: "home", label: "Publish", icon: <MessageCircle size={15} /> },
  { id: "account", label: "X account", icon: <X size={15} /> },
  { id: "keys", label: "X API keys", icon: <KeyRound size={15} /> },
  { id: "connect", label: "Connect AI", icon: <Code2 size={15} /> },
];

function validMainTab(value: string | null): value is MainTab {
  if (!value) return false;
  if (mainTabs.some((item) => item.id === value)) return true;
  return value in TAB_ALIASES;
}

function resolveTab(value: string | null): MainTab {
  if (!value) return "home";
  if (mainTabs.some((item) => item.id === value)) return value as MainTab;
  return TAB_ALIASES[value] || "home";
}

function validAgentFocus(value: string | null): value is AgentFocus {
  return agentTabs.some((item) => item.id === value);
}

function validXFocus(value: string | null): value is XFocus {
  return xTabs.some((item) => item.id === value);
}

function StatusPill({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return <span className={`supercomputer-status ${ready ? "is-ready" : "is-pending"}`}><i />{children}</span>;
}

function MetricCard({ icon, label, value, detail, onClick }: { icon: React.ReactNode; label: string; value: string; detail: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`supercomputer-metric ${onClick ? "is-clickable" : ""}`} onClick={onClick}>
      <div className="supercomputer-metric__icon">{icon}</div>
      <div className="supercomputer-metric__copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      {onClick ? <ChevronRight className="supercomputer-metric__chevron" size={16} /> : null}
    </Tag>
  );
}

function SectionHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="supercomputer-section-head">
      <div><p className="supercomputer-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{detail}</p></div>
      {action}
    </div>
  );
}

function TabFooter({ eyebrow, title, detail, action, onAction }: { eyebrow: string; title: string; detail: string; action: string; onAction: () => void }) {
  return (
    <footer className="supercomputer-tab-footer">
      <div className="supercomputer-tab-footer__mark"><Zap size={16} /></div>
      <div className="supercomputer-tab-footer__copy"><span>{eyebrow}</span><strong>{title}</strong><p>{detail}</p></div>
      <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={onAction}>{action}<ChevronRight size={15} /></button>
    </footer>
  );
}

export default function McpSuperComputer() {
  const { user, profile } = useAuth();
  const { address: walletAddress, ready: walletReady, label: walletLabel } = useActiveTradingWallet();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get("tab");
  const queryFocus = searchParams.get("focus");
  const [tab, setTab] = useState<MainTab>(() => resolveTab(queryTab));
  const [agentFocus, setAgentFocus] = useState<AgentFocus>(validAgentFocus(queryFocus) ? queryFocus : "setup");
  const [xFocus, setXFocus] = useState<XFocus>(validXFocus(queryFocus) ? queryFocus : "home");
  const [xHomeSub] = useState<XHomeSub>("post");

  useEffect(() => {
    const resolved = resolveTab(queryTab);
    if (resolved !== tab) setTab(resolved);
    if (resolved === "agent" && validAgentFocus(queryFocus) && queryFocus !== agentFocus) setAgentFocus(queryFocus);
    if (resolved === "channels" && validXFocus(queryFocus) && queryFocus !== xFocus) setXFocus(queryFocus);
  }, [agentFocus, queryFocus, queryTab, tab, xFocus]);

  const go = (next: MainTab, focus?: string) => {
    setTab(next);
    if (next === "agent" && validAgentFocus(focus ?? null)) setAgentFocus(focus as AgentFocus);
    if (next === "channels" && validXFocus(focus ?? null)) setXFocus(focus as XFocus);
    const params = new URLSearchParams();
    if (next !== "home") params.set("tab", next);
    if (focus) params.set("focus", focus);
    setSearchParams(params, { replace: true });
  };

  const accountReady = Boolean(user);
  const owner = isOwnerIdentity({ email: user?.email, wallet: walletAddress });
  const activeTitle = mainTabs.find((item) => item.id === tab)?.label || "Overview";
  const bottomTabs: IosTabItem[] = mainTabs.map((item) => ({ id: item.id, label: item.short, ico: item.icon }));

  const rail = (
    <>
      <IosRailBrand href="/supercomputer" title="OrbitX" subtitle="Super Computer" />
      <div className="supercomputer-rail-label">Control plane</div>
      {mainTabs.map((item) => <IosRailLink key={item.id} label={item.label} ico={item.icon} active={tab === item.id} onClick={() => go(item.id)} />)}
      <div className="supercomputer-rail-spacer" />
      <StatusPill ready={walletReady}>{walletReady ? "Wallet live" : accountReady ? "Signed in" : "Sign in"}</StatusPill>
      <button type="button" className="supercomputer-rail-account" onClick={() => go("agent")}>
        <span>{user ? (user.email || "OrbitX account") : "Sign in"}</span>
        <small>{owner ? "Owner access" : walletLabel || (user ? "OrbitX account" : "Open /auth")}</small>
      </button>
    </>
  );

  return (
    <IosAppShell accent="teal" wide className="supercomputer-ios" stageClassName="supercomputer-stage">
      <div className="supercomputer-frame">
        <aside className="supercomputer-rail" aria-label="Super Computer navigation">{rail}</aside>
        <div className="supercomputer-main">
          <IosNav
            title={activeTitle}
            trail={<><StatusPill ready={walletReady}>{walletReady ? "Ready" : "Setup"}</StatusPill><button type="button" className="ios-nav__btn supercomputer-nav-action" onClick={() => go("agent")} aria-label="Open agent setup"><Code2 size={17} /></button></>}
          />
          <main className="supercomputer-body">
            <div className="supercomputer-mobile-brand"><div className="supercomputer-mobile-orb"><Cpu size={17} /></div><div><strong>OrbitX Super Computer</strong><span>One MCP · every capability</span></div><StatusPill ready={walletReady}>{walletReady ? "Live" : "Setup"}</StatusPill></div>
            <div className="supercomputer-system-strip" aria-label="Super Computer telemetry"><span><i /> SYS / ORBITX-01</span><span>MODE / NON-CUSTODIAL</span><span>LINK / UNIFIED MCP</span><span>RUNTIME / {walletReady ? "LIVE" : "STANDBY"}</span></div>

            {tab === "home" && (
              <>
                <section className="supercomputer-welcome">
                  <div className="supercomputer-welcome__copy">
                    <p className="supercomputer-eyebrow"><span className="supercomputer-live" /> ORBITX OPERATING LAYER</p>
                    <h1>One calm place for<br /><em>every action.</em></h1>
                    <p>Your AI agent, in-app wallet, channels, access, and trade commands — one control plane, no duplicate setups.</p>
                    <div className="supercomputer-welcome__actions">
                      <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={() => go(walletReady ? "trade" : "agent")}>{walletReady ? "Open Trade Desk" : "Set up AI agent"}<ChevronRight size={16} /></button>
                      <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={() => go("wallet")}>Open wallet</button>
                    </div>
                  </div>
                  <div className="supercomputer-orbit-card"><div className="supercomputer-orbit-card__ring supercomputer-orbit-card__ring--one" /><div className="supercomputer-orbit-card__ring supercomputer-orbit-card__ring--two" /><div className="supercomputer-orbit-card__core"><Cpu size={26} /><span>ORBITX</span></div><span className="supercomputer-orbit-card__label supercomputer-orbit-card__label--top">MCP ONLINE</span><span className="supercomputer-orbit-card__label supercomputer-orbit-card__label--right">TOOLS</span><span className="supercomputer-orbit-card__label supercomputer-orbit-card__label--bottom">SIGNED</span></div>
                </section>
                <section className="supercomputer-command-preview" onClick={() => go("trade")} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") go("trade"); }}>
                  <div className="supercomputer-command-preview__top"><span><Zap size={14} /> QUICK COMMAND</span><span>Open Trade Desk <ChevronRight size={14} /></span></div>
                  <div className="supercomputer-command-preview__line"><span className="supercomputer-command-preview__prompt">›</span><span>Buy $1 of $ORBITX with CA …</span><span className="supercomputer-command-preview__cursor" /></div>
                  <p>Exact contract address in. Prepared route out.</p>
                </section>
                <div className="supercomputer-metrics">
                  <MetricCard icon={<ShieldCheck size={18} />} label="Identity" value={user ? "Signed in" : "Guest mode"} detail={user?.email || "Sign in at /auth"} onClick={() => go("agent")} />
                  <MetricCard icon={<WalletCards size={18} />} label="In-app wallet" value={walletReady ? "Active" : "Not created"} detail={walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "One wallet for everything"} onClick={() => go("wallet")} />
                  <MetricCard icon={<Bot size={18} />} label="AI agent" value="MCP ready" detail="Setup, keys & AI connections" onClick={() => go("agent")} />
                  <MetricCard icon={<Radio size={18} />} label="Channels" value="X + Telegram" detail="Connect once, operate everywhere" onClick={() => go("channels")} />
                </div>
                <div className="supercomputer-home-grid">
                  <section className="supercomputer-card supercomputer-card--accent">
                    <SectionHeader eyebrow="THE CONTROL PLANE" title="Everything in its place." detail="Agent, wallet, trade, channels, and access — each lives in exactly one tab." />
                    <div className="supercomputer-capability-grid">
                      <span><Bot size={15} />AI agent</span>
                      <span><WalletCards size={15} />In-app wallet</span>
                      <span><Zap size={15} />Trade commands</span>
                      <span><MessageCircle size={15} />X + Telegram</span>
                      <span><Store size={15} />Access shop</span>
                      <span><Activity size={15} />MCP endpoint</span>
                    </div>
                    <button type="button" className="supercomputer-inline-link" onClick={() => go("agent")}>Set up the agent <ChevronRight size={15} /></button>
                  </section>
                  <section className="supercomputer-card">
                    <SectionHeader eyebrow="QUICK START" title="Your next best action" detail="Three steps, in order. No duplicates, no guessing." />
                    <div className="supercomputer-next-list">
                      <button type="button" onClick={() => go("wallet")}>
                        <span className="supercomputer-next-number">01</span>
                        <span><strong>{walletReady ? "Wallet active" : "Create in-app wallet"}</strong><small>{walletReady ? "Your desk wallet is ready to sign." : "One wallet for trading, agents, everything."}</small></span>
                        <ChevronRight size={16} />
                      </button>
                      <button type="button" onClick={() => go("agent", "keys")}>
                        <span className="supercomputer-next-number">02</span>
                        <span><strong>Create an MCP key</strong><small>One scoped key for Claude, ChatGPT, or Grok.</small></span>
                        <ChevronRight size={16} />
                      </button>
                      <button type="button" onClick={() => go("channels")}>
                        <span className="supercomputer-next-number">03</span>
                        <span><strong>Add a channel</strong><small>Bring X or Telegram into the control plane.</small></span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )}

            {tab === "agent" && (
              <section className="supercomputer-workspace">
                <SectionHeader
                  eyebrow="AI AGENT"
                  title="Connect your AI."
                  detail="Setup guide, MCP API keys, and AI client connections. Wallet lives in its own tab — no duplicates."
                  action={<StatusPill ready={accountReady}>{accountReady ? "Signed in" : "Sign in needed"}</StatusPill>}
                />
                <div className="supercomputer-segmented">
                  {agentTabs.map((item) => (
                    <button type="button" key={item.id} className={agentFocus === item.id ? "is-active" : ""} onClick={() => go("agent", item.id)}>
                      {item.icon}{item.label}
                    </button>
                  ))}
                </div>
                <div className="supercomputer-embedded">
                  <AgentDashboard
                    key={`agent-${agentFocus}`}
                    embedded
                    initialTab={agentFocus}
                    hideTabs={["wallet", "shop"]}
                    onWorkspaceChange={(next) => {
                      if (next === "setup" || next === "keys" || next === "connect") go("agent", next);
                    }}
                  />
                </div>
              </section>
            )}

            {tab === "wallet" && (
              <section className="supercomputer-workspace">
                <SectionHeader
                  eyebrow="IN-APP WALLET"
                  title="One wallet. Everything."
                  detail="The only wallet in OrbitX — trading, agents, channels all use this. Create it once, export the key whenever you want."
                  action={<StatusPill ready={walletReady}>{walletReady ? "Active" : "Not created"}</StatusPill>}
                />
                <InAppWalletPanel />
              </section>
            )}

            {tab === "trade" && (
              <section className="supercomputer-workspace supercomputer-workspace--trade">
                <SectionHeader
                  eyebrow="TRADE DESK"
                  title="Command the exact trade."
                  detail="Plain language, contract address, exact amount. Review the prepared route before signing."
                  action={<StatusPill ready={walletReady}>{walletReady ? "Wallet ready" : "Wallet needed"}</StatusPill>}
                />
                <TradeDesk walletAddress={walletAddress} onOpenWallet={() => go("wallet")} />
              </section>
            )}

            {tab === "channels" && (
              <section className="supercomputer-workspace">
                <SectionHeader
                  eyebrow="CHANNELS"
                  title="X, inside OrbitX."
                  detail="Publishing, DMs, queues, and X API keys — one channel workspace, not a separate product."
                  action={<StatusPill ready={xFocus !== "home"}>{xFocus === "home" ? "Choose a section" : "Channel workspace"}</StatusPill>}
                />
                <div className="supercomputer-segmented">
                  {xTabs.map((item) => (
                    <button type="button" key={item.id} className={xFocus === item.id ? "is-active" : ""} onClick={() => go("channels", item.id)}>
                      {item.icon}{item.label}
                    </button>
                  ))}
                </div>
                <div className="supercomputer-channel-notice">
                  <div className="supercomputer-channel-notice__icon"><Radio size={18} /></div>
                  <div><strong>X is a channel, not another MCP.</strong><p>Publishing, DMs, queues, agent training, and X keys all live here in the same control plane.</p></div>
                </div>
                <div className="supercomputer-embedded">
                  <XMcpPage key={`x-${xFocus}-${xHomeSub}`} embedded initialTab={xFocus} initialHomeSub={xHomeSub} />
                </div>
              </section>
            )}

            {tab === "access" && (
              <section className="supercomputer-workspace">
                <SectionHeader
                  eyebrow="ACCESS"
                  title="Unlock the operating layer."
                  detail="Timed access and credits, shared across every capability. One checkout, one control plane."
                  action={<StatusPill ready={false}>Non-custodial</StatusPill>}
                />
                <div className="supercomputer-shop-intro">
                  <div>
                    <CircleDollarSign size={20} />
                    <strong>Shared access across everything</strong>
                    <p>MCP is free until 7 Nov 2026 during testing. Burns extend seats after that, or top up credits with SOL. Desk trades sign in the background after /auth login.</p>
                  </div>
                  <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={() => go("wallet")}>Review wallet</button>
                </div>
                <div className="supercomputer-embedded">
                  <McpShop variant="both" walletAddress={walletAddress} />
                </div>
              </section>
            )}

            {tab === "home" && <TabFooter eyebrow="READY WHEN YOU ARE" title={walletReady ? "Run your first trade." : "Build your foundation."} detail={walletReady ? "Open the Trade Desk with an exact CA and amount." : "Create your in-app wallet first — one wallet for everything."} action={walletReady ? "Trade Desk" : "Create wallet"} onAction={() => go(walletReady ? "trade" : "wallet")} />}
            {tab === "agent" && <TabFooter eyebrow="AI SETUP" title="Three steps to an operator." detail="Setup guide, then an MCP key, then connect Claude, ChatGPT, or Grok." action="Get MCP key" onAction={() => go("agent", "keys")} />}
            {tab === "wallet" && <TabFooter eyebrow="ONE WALLET" title="No imports. No second wallets." detail="This desk wallet signs for trading, agents, and channels across your whole OrbitX account." action="Trade now" onAction={() => go("trade")} />}
            {tab === "trade" && <TabFooter eyebrow="EXECUTION STANDARD" title="Every command stays inspectable." detail="OrbitX signs with your in-app wallet in the background after login." action="Wallet" onAction={() => go("wallet")} />}
            {tab === "channels" && <TabFooter eyebrow="CHANNELS" title="One command, more reach." detail="Set up the agent and wallet first, then bring X into the control plane." action="Agent setup" onAction={() => go("agent")} />}
            {tab === "access" && <TabFooter eyebrow="ACCESS CONTROL" title="Keep access visible." detail="Review credits and timed access before purchasing." action="Review wallet" onAction={() => go("wallet")} />}
          </main>
          <IosTabBar tabs={bottomTabs} activeId={tab} onChange={(id) => go(id as MainTab)} className="supercomputer-tabbar" />
          <div className="ios-home-ind" aria-hidden />
        </div>
      </div>
    </IosAppShell>
  );
}
