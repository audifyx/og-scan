import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { AgentShell } from "@/components/agent/AgentShell";
import { McpShop } from "@/components/agent/McpShop";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { resolveAuthWallet } from "@/lib/agentTokenGate";
import { isOwnerIdentity } from "@/lib/ownerDesk";
import "./mcp-super-computer.css";

type Tab = "overview" | "setup" | "channels" | "shop" | "tools";

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "overview", label: "Command center", icon: "⌁" },
  { id: "setup", label: "First launch", icon: "↗" },
  { id: "channels", label: "Channels", icon: "◌" },
  { id: "shop", label: "Access & shop", icon: "◈" },
  { id: "tools", label: "Tool deck", icon: "✦" },
];

function StatusTile({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "ready" | "warn" }) {
  return (
    <div className={`super-status super-status--${tone}`}>
      <div className="super-status__top"><span>{label}</span><i aria-hidden /></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function McpSuperComputer() {
  const { user, profile } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabs.some((item) => item.id === requestedTab) ? requestedTab! : "overview");
  const [setupError, setSetupError] = useState<string | null>(null);
  const setActiveTab = (next: string) => {
    const value = tabs.some((item) => item.id === next) ? (next as Tab) : "overview";
    setTab(value);
    setSearchParams(value === "overview" ? {} : { tab: value }, { replace: true });
  };
  useEffect(() => {
    if (requestedTab && tabs.some((item) => item.id === requestedTab) && requestedTab !== tab) setTab(requestedTab);
  }, [requestedTab, tab]);
  const signIn = async () => {
    const wallet = pickable[0];
    if (!wallet) {
      setSetupError("No compatible wallet detected. Install Phantom, Backpack, Solflare, or another Solana wallet first.");
      return;
    }
    setSetupError(null);
    try {
      await signInWith(wallet.name);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Wallet sign-in failed");
    }
  };

  const walletAddress = useMemo(() => resolveAuthWallet({
    connectedPk: publicKey?.toBase58() ?? null,
    email: user?.email,
    userMetadata: (user?.user_metadata as Record<string, unknown> | undefined) ?? null,
    profileWallet: (profile as { wallet_address?: string | null; sol_wallet?: string | null } | null)?.wallet_address ||
      (profile as { sol_wallet?: string | null } | null)?.sol_wallet || null,
  }), [publicKey, user?.email, user?.user_metadata, profile]);

  const owner = isOwnerIdentity({ email: user?.email, wallet: walletAddress });
  const walletReady = Boolean(walletAddress);

  return (
    <AgentShell
      brandHref="/supercomputer"
      brandSub="OrbitX Super Computer"
      footerBrand="OrbitX Super Computer"
      footerNote="One MCP command center for tools, agents, X, Telegram, wallet actions, access, and automation."
      topSubtitle="One MCP · every channel · every capability"
      statusLabel={walletReady ? "System ready" : "Setup required"}
      statusWarn={!walletReady}
      activeTab={tab}
      onTabChange={setActiveTab}
      tabs={tabs}
      siblingHref="/mcp"
      siblingLabel="Super Computer"
      siblingIcon="⌁"
    >
      <section className="super-hero">
        <div className="super-hero__eyebrow"><span className="super-live-dot" /> ORBITX MCP / UNIFIED CONTROL PLANE</div>
        <h1>One command center.<br /><em>Every OrbitX capability.</em></h1>
        <p>Connect your wallet, launch agents, wire in X and Telegram, manage access, and control the full OrbitX tool deck from one place.</p>
        <div className="super-hero__actions">
          <button className="super-button super-button--primary" type="button" onClick={() => setActiveTab(walletReady ? "tools" : "setup")}>
            {walletReady ? "Open tool deck" : "Start setup"}<span>→</span>
          </button>
          <button className="super-button super-button--ghost" type="button" onClick={() => setActiveTab("channels")}>Connect a channel</button>
        </div>
        <div className="super-hero__meta"><span>Non-custodial by design</span><span>Wallet signs every transaction</span><span>Shared access across MCP + X</span></div>
      </section>

      <div className="super-grid super-grid--status">
        <StatusTile label="Identity" value={user ? "Authenticated" : "Guest"} detail={user?.email || "Sign in to unlock your workspace"} tone={user ? "ready" : "warn"} />
        <StatusTile label="Wallet" value={walletReady ? "Connected" : "Not connected"} detail={walletReady ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Required for signing and access"} tone={walletReady ? "ready" : "warn"} />
        <StatusTile label="Channels" value="2 surfaces" detail="X + Telegram ready to connect" tone="neutral" />
        <StatusTile label="MCP endpoint" value="Online" detail="orbitx.world/api/mcp" tone="ready" />
      </div>

      {setupError && <div className="super-inline-error" role="alert">{setupError}</div>}

      {tab === "overview" && (
        <div className="super-section-grid">
          <section className="super-panel super-panel--feature"><div className="super-panel__kicker">SYSTEM OVERVIEW</div><h2>The OrbitX operating layer.</h2><p>Stop thinking in separate apps. The Super Computer is the control layer behind your wallet, intelligence, agents, channels, and execution surfaces.</p><div className="super-capabilities"><span>Wallet intelligence</span><span>Token research</span><span>Agent automation</span><span>X publishing</span><span>Telegram control</span><span>Signed execution</span></div>        <button className="super-link" type="button" onClick={() => setActiveTab("setup")}>Run first-launch setup <span>→</span></button>
</section>
          <section className="super-panel"><div className="super-panel__kicker">QUICK START</div><div className="super-step"><b>01</b><span><strong>Connect identity</strong><small>Sign in and connect the wallet that will approve actions.</small></span></div><div className="super-step"><b>02</b><span><strong>Choose your channels</strong><small>Enable X or Telegram when you are ready to automate.</small></span></div><div className="super-step"><b>03</b><span><strong>Copy your MCP key</strong><small>Use the shared endpoint from Claude, ChatGPT, Grok, or your own client.</small></span></div><button className="super-link" type="button" onClick={() => setActiveTab("setup")}>Open setup checklist <span>→</span></button>
</section>
        </div>
      )}

      {tab === "setup" && (
        <section className="super-panel super-panel--wide"><div className="super-panel__kicker">FIRST LAUNCH</div><h2>Get the Super Computer online.</h2><p className="super-muted">A single setup flow replaces the old split between Agent MCP and X MCP. Complete the shared foundation first, then add the channels you need.</p><div className="super-setup-grid"><div className={`super-setup-card ${user ? "is-ready" : ""}`}><span>01</span><h3>{user ? "Identity connected" : "Sign in"}</h3><p>{user ? "Your account is ready for MCP configuration." : "Sign in before creating keys or saving channel settings."}</p>{!user && <button className="super-button super-button--small" type="button" onClick={() => void signIn()}>{busy ? "Connecting…" : "Sign in"}</button>}</div><div className={`super-setup-card ${walletReady ? "is-ready" : ""}`}><span>02</span><h3>{walletReady ? "Wallet connected" : "Connect wallet"}</h3><p>{walletReady ? "Your wallet can approve non-custodial actions." : "Connect the wallet used for signing, access, and execution."}</p>{!walletReady && <Link className="super-button super-button--small" to="/auth-wallet">Connect wallet</Link>}</div><div className="super-setup-card"><span>03</span><h3>Create your key</h3><p>Generate one scoped MCP key for the clients and channels you choose.</p><Link className="super-button super-button--small" to="/agent?tab=keys">Open key desk</Link></div></div></section>
      )}

      {tab === "channels" && (
        <div className="super-section-grid"><section className="super-panel super-channel-card"><div className="super-channel-mark super-channel-mark--x">𝕏</div><div className="super-panel__kicker">CHANNEL / X</div><h2>Publish and respond.</h2><p>Connect X, train your agent, manage the queue, send DMs, and expose the X tools through the same Super Computer access layer.</p><Link className="super-button super-button--primary" to="/x">Open X workspace <span>→</span></Link></section><section className="super-panel super-channel-card"><div className="super-channel-mark super-channel-mark--tg">↯</div><div className="super-panel__kicker">CHANNEL / TELEGRAM</div><h2>Operate from chat.</h2><p>Bring the same intelligence and tool access into Telegram for command-driven workflows and notifications.</p><Link className="super-button super-button--ghost" to="/telegram">Open Telegram <span>→</span></Link></section></div>
      )}

      {tab === "shop" && <McpShop variant="both" walletAddress={walletAddress} />}

      {tab === "tools" && (
        <section className="super-panel super-panel--wide"><div className="super-panel__kicker">TOOL DECK</div><h2>Choose the capability, not the app.</h2><p className="super-muted">The full MCP surface stays behind one endpoint. These entry points keep the most useful workflows visible and understandable.</p><div className="super-tool-grid">{[{ title: "Research", detail: "Token overview, safety, forensics, charts", href: "/intel" }, { title: "Wallet intelligence", detail: "Balances, swaps, holdings, history", href: "/wallets" }, { title: "Launchpad", detail: "Create and manage token launches", href: "/orbitxlaunch" }, { title: "Agent desk", detail: "Configure and train autonomous agents", href: "/agent" }, { title: "X channel", detail: "Posts, DMs, queue, and X MCP", href: "/x" }, { title: "Signing desk", detail: "Approve prepared non-custodial actions", href: "/agent/sign" }].map((tool) => <Link className="super-tool" to={tool.href} key={tool.title}><span className="super-tool__arrow">↗</span><strong>{tool.title}</strong><small>{tool.detail}</small></Link>)}</div></section>
      )}

      {owner && <div className="super-owner-note">Owner preview enabled · all Super Computer surfaces are visible.</div>}
    </AgentShell>
  );
}
