import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Bot, ChevronRight, CircleDollarSign, Code2, Command, Cpu, KeyRound, Layers3, MessageCircle, Radio, Settings2, ShieldCheck, Sparkles, Store, WalletCards, X, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { resolveAuthWallet } from "@/lib/agentTokenGate";
import { isOwnerIdentity } from "@/lib/ownerDesk";
import { AgentDashboard } from "@/components/agent/agent-dashboard";
import { McpShop } from "@/components/agent/McpShop";
import { TradeDesk } from "@/components/agent/TradeDesk";
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

type MainTab = "home" | "setup" | "workspace" | "trade" | "channels" | "shop";
type AgentFocus = "setup" | "shop" | "wallet" | "keys" | "connect";
type XFocus = "home" | "account" | "keys" | "connect";
type XHomeSub = "post" | "agent" | "queue" | "messages" | "matrix";

type MainTabItem = { id: MainTab; label: string; short: string; icon: React.ReactNode };

const mainTabs: MainTabItem[] = [
  { id: "home", label: "Overview", short: "Home", icon: <Command size={18} /> },
  { id: "workspace", label: "Agent", short: "Agent", icon: <Bot size={18} /> },
  { id: "trade", label: "Trade", short: "Trade", icon: <Zap size={18} /> },
  { id: "channels", label: "Channels", short: "Channels", icon: <Radio size={18} /> },
  { id: "shop", label: "Access", short: "Access", icon: <Store size={18} /> },
];

const agentTabs: Array<{ id: AgentFocus; label: string; icon: React.ReactNode }> = [
  { id: "setup", label: "MCP setup", icon: <Sparkles size={15} /> },
  { id: "wallet", label: "Wallet", icon: <WalletCards size={15} /> },
  { id: "keys", label: "API keys", icon: <KeyRound size={15} /> },
  { id: "connect", label: "Connect AI", icon: <Code2 size={15} /> },
];

const xTabs: Array<{ id: XFocus; label: string; icon: React.ReactNode }> = [
  { id: "home", label: "Publish", icon: <MessageCircle size={15} /> },
  { id: "account", label: "X account", icon: <X size={15} /> },
  { id: "keys", label: "X keys", icon: <KeyRound size={15} /> },
  { id: "connect", label: "Connect AI", icon: <Code2 size={15} /> },
];

function validMainTab(value: string | null): value is MainTab {
  return mainTabs.some((item) => item.id === value) || value === "setup";
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
  const { publicKey } = useWallet();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get("tab");
  const queryFocus = searchParams.get("focus");
  const [tab, setTab] = useState<MainTab>(validMainTab(queryTab) ? queryTab as MainTab : "home");
  const [agentFocus, setAgentFocus] = useState<AgentFocus>(validAgentFocus(queryFocus) ? queryFocus : "setup");
  const [xFocus, setXFocus] = useState<XFocus>(validXFocus(queryFocus) ? queryFocus : "home");
  const [xHomeSub] = useState<XHomeSub>("post");

  useEffect(() => {
    if (validMainTab(queryTab) && queryTab !== tab) setTab(queryTab as MainTab);
    if (queryTab === "workspace" && validAgentFocus(queryFocus) && queryFocus !== agentFocus) setAgentFocus(queryFocus);
    if (queryTab === "channels" && validXFocus(queryFocus) && queryFocus !== xFocus) setXFocus(queryFocus);
  }, [agentFocus, queryFocus, queryTab, tab, xFocus]);

  const go = (next: MainTab, focus?: string) => {
    setTab(next);
    if (next === "workspace" && validAgentFocus(focus ?? null)) setAgentFocus(focus as AgentFocus);
    if (next === "channels" && validXFocus(focus ?? null)) setXFocus(focus as XFocus);
    const params = new URLSearchParams();
    if (next !== "home") params.set("tab", next);
    if (focus) params.set("focus", focus);
    setSearchParams(params, { replace: true });
  };

  const walletAddress = useMemo(() => resolveAuthWallet({
    connectedPk: publicKey?.toBase58() ?? null,
    email: user?.email,
    userMetadata: (user?.user_metadata as Record<string, unknown> | undefined) ?? null,
    profileWallet: (profile as { wallet_address?: string | null; sol_wallet?: string | null } | null)?.wallet_address ||
      (profile as { sol_wallet?: string | null } | null)?.sol_wallet || null,
  }), [profile, publicKey, user]);
  const walletReady = Boolean(walletAddress);
  const owner = isOwnerIdentity({ email: user?.email, wallet: walletAddress });
  const activeTitle = mainTabs.find((item) => item.id === tab)?.label || (tab === "setup" ? "Setup" : "Overview");
  const bottomTabs: IosTabItem[] = mainTabs.map((item) => ({ id: item.id, label: item.short, ico: item.icon }));

  const rail = (
    <>
      <IosRailBrand href="/supercomputer" title="OrbitX" subtitle="Super Computer" />
      <div className="supercomputer-rail-label">Workspace</div>
      {mainTabs.map((item) => <IosRailLink key={item.id} label={item.label} ico={item.icon} active={tab === item.id} onClick={() => go(item.id)} />)}
      <div className="supercomputer-rail-divider" />
      <div className="supercomputer-rail-label">System</div>
      <IosRailLink label="MCP status" ico={<Activity size={16} />} active={tab === "home"} onClick={() => go("home")} />
      <IosRailLink label="Safety & signing" ico={<ShieldCheck size={16} />} active={tab === "setup"} onClick={() => go("setup")} />
      <div className="supercomputer-rail-spacer" />
      <StatusPill ready={walletReady}>{walletReady ? "Wallet ready" : "Setup required"}</StatusPill>
      <button type="button" className="supercomputer-rail-account" onClick={() => go("setup")}><span>{user ? "Signed in" : "Guest mode"}</span><small>{owner ? "Owner access" : walletReady ? "Identity connected" : "Start setup"}</small></button>
    </>
  );

  return (
    <IosAppShell accent="teal" wide className="supercomputer-ios" stageClassName="supercomputer-stage">
      <div className="supercomputer-frame">
        <aside className="supercomputer-rail" aria-label="Super Computer navigation">{rail}</aside>
        <div className="supercomputer-main">
          <IosNav
            title={activeTitle}
            trail={<><StatusPill ready={walletReady}>{walletReady ? "Ready" : "Guest"}</StatusPill><button type="button" className="ios-nav__btn supercomputer-nav-action" onClick={() => go("setup")} aria-label="Open setup"><Settings2 size={17} /></button></>}
          />
          <main className="supercomputer-body">
            <div className="supercomputer-mobile-brand"><div className="supercomputer-mobile-orb"><Cpu size={17} /></div><div><strong>OrbitX Super Computer</strong><span>One MCP · every capability</span></div><StatusPill ready={walletReady}>{walletReady ? "Live" : "Setup"}</StatusPill></div>

            {tab === "home" && (
              <>
                <section className="supercomputer-welcome">
                  <div className="supercomputer-welcome__copy">
                    <p className="supercomputer-eyebrow"><span className="supercomputer-live" /> ORBITX OPERATING LAYER</p>
                    <h1>One calm place for<br /><em>every action.</em></h1>
                    <p>Your agents, wallet, channels, access, and trade commands in one focused mobile workspace.</p>
                    <div className="supercomputer-welcome__actions"><button type="button" className="supercomputer-button supercomputer-button--primary" onClick={() => go(walletReady ? "trade" : "setup")}>{walletReady ? "Open Trade Desk" : "Start setup"}<ChevronRight size={16} /></button><button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={() => go("workspace")}>Open agent</button></div>
                  </div>
                  <div className="supercomputer-orbit-card"><div className="supercomputer-orbit-card__ring supercomputer-orbit-card__ring--one" /><div className="supercomputer-orbit-card__ring supercomputer-orbit-card__ring--two" /><div className="supercomputer-orbit-card__core"><Cpu size={26} /><span>ORBITX</span></div><span className="supercomputer-orbit-card__label supercomputer-orbit-card__label--top">MCP ONLINE</span><span className="supercomputer-orbit-card__label supercomputer-orbit-card__label--right">TOOLS</span><span className="supercomputer-orbit-card__label supercomputer-orbit-card__label--bottom">SIGNED</span></div>
                </section>
                <section className="supercomputer-command-preview" onClick={() => go("trade")} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") go("trade"); }}>
                  <div className="supercomputer-command-preview__top"><span><Zap size={14} /> QUICK COMMAND</span><span>Open Trade Desk <ChevronRight size={14} /></span></div>
                  <div className="supercomputer-command-preview__line"><span className="supercomputer-command-preview__prompt">›</span><span>Buy $1 of $ORBITX with CA …</span><span className="supercomputer-command-preview__cursor" /></div>
                  <p>Exact contract address in. Prepared route out.</p>
                </section>
                <div className="supercomputer-metrics"><MetricCard icon={<ShieldCheck size={18} />} label="Identity" value={user ? "Authenticated" : "Guest mode"} detail={user?.email || "Connect when you are ready"} onClick={() => go("setup")} /><MetricCard icon={<WalletCards size={18} />} label="Wallet" value={walletReady ? "Connected" : "Not connected"} detail={walletReady ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Required for signing"} onClick={() => go("workspace", "wallet")} /><MetricCard icon={<Radio size={18} />} label="Channels" value="X + Telegram" detail="Connect once, operate everywhere" onClick={() => go("channels")} /><MetricCard icon={<Activity size={18} />} label="MCP endpoint" value="Online" detail="www.orbitx.world/api/mcp" /></div>
                <div className="supercomputer-home-grid"><section className="supercomputer-card supercomputer-card--accent"><SectionHeader eyebrow="THE CONTROL PLANE" title="Everything in its place." detail="Switch between the agent, Trade Desk, channels, and access without leaving the app." /><div className="supercomputer-capability-grid"><span><Layers3 size={15} />Research</span><span><Bot size={15} />Agents</span><span><Zap size={15} />Trade commands</span><span><MessageCircle size={15} />X + Telegram</span><span><WalletCards size={15} />Wallet actions</span><span><Store size={15} />Access shop</span></div><button type="button" className="supercomputer-inline-link" onClick={() => go("workspace")}>Explore the workspace <ChevronRight size={15} /></button></section><section className="supercomputer-card"><SectionHeader eyebrow="QUICK START" title="Your next best action" detail="A clear path whether you are new or already connected." /><div className="supercomputer-next-list"><button type="button" onClick={() => go(walletReady ? "trade" : "setup", walletReady ? undefined : undefined)}><span className="supercomputer-next-number">01</span><span><strong>{walletReady ? "Run a trade command" : "Connect identity"}</strong><small>{walletReady ? "Prepare an exact-amount buy with a contract address." : "Start with a free signed message."}</small></span><ChevronRight size={16} /></button><button type="button" onClick={() => go("workspace", "keys")}><span className="supercomputer-next-number">02</span><span><strong>Create an MCP key</strong><small>One scoped key for Claude, ChatGPT, or Grok.</small></span><ChevronRight size={16} /></button><button type="button" onClick={() => go("channels", "home")}><span className="supercomputer-next-number">03</span><span><strong>Add a channel</strong><small>Bring X or Telegram into the same control plane.</small></span><ChevronRight size={16} /></button></div></section></div>
              </>
            )}

            {tab === "setup" && <section className="supercomputer-workspace"><SectionHeader eyebrow="FIRST LAUNCH" title="Get the Super Computer online." detail="One shared foundation for identity, wallet signing, API keys, and connected channels." /><div className="supercomputer-setup-banner"><div className="supercomputer-setup-banner__icon"><Sparkles size={20} /></div><div><strong>Setup once. Operate everywhere.</strong><p>Nothing is custodial. Your wallet approves transactions, your keys stay scoped, and access works across the unified MCP.</p></div><StatusPill ready={walletReady}>{walletReady ? "Foundation ready" : "Foundation pending"}</StatusPill></div><div className="supercomputer-embedded"><AgentDashboard embedded initialTab="setup" onWorkspaceChange={(next) => go("workspace", next)} /></div></section>}

            {tab === "workspace" && <section className="supercomputer-workspace"><SectionHeader eyebrow="MCP WORKSPACE" title="Your AI operating desk." detail="Manage identity, wallet signing, keys, and AI client connections from one place." action={<StatusPill ready={walletReady}>{walletReady ? "Workspace ready" : "Setup needed"}</StatusPill>} /><div className="supercomputer-segmented">{agentTabs.map((item) => <button type="button" key={item.id} className={agentFocus === item.id ? "is-active" : ""} onClick={() => go("workspace", item.id)}>{item.icon}{item.label}</button>)}</div><div className="supercomputer-embedded"><AgentDashboard key={`agent-${agentFocus}`} embedded initialTab={agentFocus} onWorkspaceChange={(next) => go("workspace", next)} /></div></section>}

            {tab === "trade" && <section className="supercomputer-workspace supercomputer-workspace--trade"><SectionHeader eyebrow="TRADE DESK" title="Command the exact trade." detail="Use plain language, include the token contract address, and review the prepared route before signing." action={<StatusPill ready={walletReady}>{walletReady ? "Wallet ready" : "Wallet needed"}</StatusPill>} /><TradeDesk walletAddress={walletAddress} onOpenWallet={() => go("workspace", "wallet")} /></section>}

            {tab === "channels" && <section className="supercomputer-workspace"><SectionHeader eyebrow="CONNECTED CHANNELS" title="One MCP. Every conversation surface." detail="X and Telegram are channels inside OrbitX now—not separate products." action={<StatusPill ready={xFocus !== "home"}>{xFocus === "home" ? "Choose a channel" : "Channel workspace"}</StatusPill>} /><div className="supercomputer-segmented">{xTabs.map((item) => <button type="button" key={item.id} className={xFocus === item.id ? "is-active" : ""} onClick={() => go("channels", item.id)}>{item.icon}{item.label}</button>)}</div><div className="supercomputer-channel-notice"><div className="supercomputer-channel-notice__icon"><Radio size={18} /></div><div><strong>X is a channel, not another MCP.</strong><p>Publishing, DMs, queues, agent training, X keys, and connector setup all live below in the same Super Computer workspace.</p></div></div><div className="supercomputer-embedded"><XMcpPage key={`x-${xFocus}-${xHomeSub}`} embedded initialTab={xFocus} initialHomeSub={xHomeSub} /></div></section>}

            {tab === "shop" && <section className="supercomputer-workspace"><SectionHeader eyebrow="ACCESS + SHOP" title="Unlock the operating layer." detail="Timed access and credits are shared across every OrbitX capability and connected channel. One checkout, one control plane." action={<StatusPill ready={false}>Non-custodial</StatusPill>} /><div className="supercomputer-shop-intro"><div><CircleDollarSign size={20} /><strong>Shared access across every channel</strong><p>Burn $ORBITX for timed access or top up credits with SOL. Wallet approval is required for every transaction.</p></div><button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={() => go("workspace", "wallet")}>Review wallet</button></div><div className="supercomputer-embedded"><McpShop variant="both" walletAddress={walletAddress} /></div></section>}

            {tab === "home" && <TabFooter eyebrow="READY WHEN YOU ARE" title={walletReady ? "Run your first exact trade." : "Build your foundation."} detail={walletReady ? "Open the Trade Desk to prepare a command with the exact CA and amount." : "Connect a wallet and AI client before you start operating."} action={walletReady ? "Trade Desk" : "Start setup"} onAction={() => go(walletReady ? "trade" : "setup")} />}
            {tab === "setup" && <TabFooter eyebrow="FOUNDATION" title="The safer path starts here." detail="Link the wallet, create your scoped key, and connect the AI client you trust." action="Open agent" onAction={() => go("workspace")} />}
            {tab === "workspace" && <TabFooter eyebrow="NEXT ACTION" title="Turn the desk into an operator." detail="When your foundation is ready, move to Trade Desk for exact command execution." action="Open trade" onAction={() => go("trade")} />}
            {tab === "trade" && <TabFooter eyebrow="EXECUTION STANDARD" title="Every command stays inspectable." detail="OrbitX prepares the transaction; the connected wallet remains the final signing authority." action="Wallet settings" onAction={() => go("workspace", "wallet")} />}
            {tab === "channels" && <TabFooter eyebrow="CONNECTED SURFACES" title="One command, more reach." detail="Connect X or Telegram after the core agent and wallet foundation are ready." action="Agent setup" onAction={() => go("workspace", "connect")} />}
            {tab === "shop" && <TabFooter eyebrow="ACCESS CONTROL" title="Keep access visible." detail="Review credits, timed access, and signing requirements before purchasing." action="Review wallet" onAction={() => go("workspace", "wallet")} />}
          </main>
          <IosTabBar tabs={bottomTabs} activeId={tab === "setup" ? "home" : tab} onChange={(id) => go(id as MainTab)} className="supercomputer-tabbar" />
          <div className="ios-home-ind" aria-hidden />
        </div>
      </div>
    </IosAppShell>
  );
}
