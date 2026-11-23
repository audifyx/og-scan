import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { isAgentHoldExempt, resolveAuthWallet } from "@/lib/agentTokenGate";
import { fetchXCreditsUsage, type XCreditsUsage } from "@/lib/xMcp";
import {
  bootstrapAgent,
  chatgptConnectUrl,
  claudeConnectUrl,
  grokConnectUrl,
  createAgentApiKey,
  linkAgentWallet,
  listAgentApiKeys,
  mcpOAuthCredentials,
  mintMcpChatAuth,
  revokeAgentApiKey,
  shortKey,
  type AgentBootstrap,
  type McpChatAuthMint,
} from "@/lib/orbitxMcp";
import { AgentShell, type AgentTabId } from "./AgentShell";
import { TelegramMcpCard } from "./TelegramMcpCard";
import { McpShop } from "./McpShop";

import { apiUrl } from "@/lib/apiBase";

/** Appended to a chat-auth paste message to boot the AI as a Trader Agent (MCP V3). */
const TRADER_KICKOFF_SUFFIX = `

TRADER AGENT MODE — you are now my OrbitX AI trader agent (one MCP: research, intelligence, launchpad, trading).
1. Read the intelligence resources first: orbitx://intelligence/playbook, orbitx://intelligence/data-sources, orbitx://intelligence/tool-map.
2. Run orbitx_trader_boot and confirm my account + wallet are connected.
3. Run orbitx_trader_brief, then orbitx_trader_scan — show me ranked candidates with scores and risk flags, flags first.
4. Trades: orbitx_trade_quote first, show me the exact quote, and never execute without my explicit "confirm" in this chat.
House rules: quote the traded mint only; the pump verifies the move, the dip is the research window; if data is unavailable, say so — never invent numbers.`;

function maskSecret(value: string, kind: "key" | "header" = "key") {
  if (!value) return "—";
  if (kind === "header" && value.startsWith("Bearer ")) {
    return `Bearer ${shortKey(value.slice(7))}`;
  }
  if (value.startsWith("oxo_") || value.startsWith("oxk_")) return shortKey(value);
  if (value.length <= 12) return "********";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function SecretRow({
  label,
  value,
  emptyLabel,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  emptyLabel?: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const has = Boolean(value);
  return (
    <div className="ox-agent__row">
      <div className="ox-agent__label">{label}</div>
      <div className="ox-agent__value">
        {!has
          ? emptyLabel || "Create an API key first"
          : visible
            ? value
            : maskSecret(value, label.toLowerCase().includes("header") ? "header" : "key")}
      </div>
      {has && (
        <div className="ox-agent__actions">
          <button type="button" className="ox-agent__btn ox-agent__btn--ghost" onClick={() => setVisible((v) => !v)}>
            {visible ? "Hide" : "View"}
          </button>
          <button type="button" className="ox-agent__btn" onClick={onCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  onCopy,
  copied,
  copyable = true,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="ox-agent__row">
      <div className="ox-agent__label">{label}</div>
      <div className="ox-agent__value">{value}</div>
      {copyable && onCopy ? (
        <div className="ox-agent__actions">
          <button type="button" className="ox-agent__btn" onClick={onCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <span />
      )}
    </div>
  );
}

const AGENT_TABS = new Set<AgentTabId>(["setup", "shop", "wallet", "keys", "connect", "agent", "tools"]);

const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

const MCP_CONFIG_JSON = JSON.stringify(
  { mcpServers: { orbitx: { url: "https://www.orbitx.world/api/mcp", transport: "http" } } },
  null,
  2
);

/** Recursive key finder — dossier/scan payloads nest price/mcap/holders several layers deep. */
function findKey(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return (obj as any)[key];
  for (const v of Object.values(obj)) {
    const hit = findKey(v, key);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Live MCP (v3) JSON-RPC call against the one OrbitX MCP endpoint. */
async function mcpRpc(method: string, params: Record<string, unknown> = {}): Promise<any> {
  const r = await fetch("https://www.orbitx.world/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  return j?.result;
}

function parseAgentTab(raw: string): AgentTabId {
  const t = String(raw || "").toLowerCase();
  if (t === "shop" || t === "credits" || t === "usage" || t === "access") return "shop";
  return AGENT_TABS.has(t as AgentTabId) ? (t as AgentTabId) : "setup";
}

export function AgentDashboard({ embedded = false, initialTab = "setup", onWorkspaceChange, hideTabs = [] }: { embedded?: boolean; initialTab?: AgentTabId; onWorkspaceChange?: (tab: AgentTabId) => void; hideTabs?: AgentTabId[] }) {
  const { user, profile } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<AgentTabId>(() => {
    const t = embedded ? initialTab : parseAgentTab(searchParams.get("tab") || "");
    return (hideTabs as string[]).includes(t) ? "setup" : t;
  });
  const [creditsUsage, setCreditsUsage] = useState<XCreditsUsage | null>(null);
  const [boot, setBoot] = useState<AgentBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("Claude / ChatGPT");
  const [creating, setCreating] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [oauthGuide, setOauthGuide] = useState<"chatgpt" | "grok" | null>(null);
  const [linking, setLinking] = useState(false);
  const [setupOpen, setSetupOpen] = useState<"claude" | "chatgpt" | "grok">("claude");
  const [chatAuth, setChatAuth] = useState<McpChatAuthMint | null>(null);
  const [mintingAuth, setMintingAuth] = useState(false);
  const [inAppWallet, setInAppWallet] = useState<string | null>(null);

  // MCP V3 live data — this dashboard reads the actual MCP (tools + prompts).
  const [liveTools, setLiveTools] = useState<any[] | null>(null);
  const [livePrompts, setLivePrompts] = useState<any[] | null>(null);
  const [toolQuery, setToolQuery] = useState("");
  const [scanState, setScanState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [scanResult, setScanResult] = useState<any>(null);
  const [liveResources, setLiveResources] = useState<any[] | null>(null);
  const [pulse, setPulse] = useState<any>(null);
  const [analyzeMint, setAnalyzeMint] = useState("");
  const [analyzeState, setAnalyzeState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);

  const loadPulse = useCallback(async () => {
    try {
      const res = await mcpRpc("tools/call", { name: "orbitx_token_dossier", arguments: { mint: ORBITX_MINT } });
      const text = res?.content?.[0]?.text;
      if (text) setPulse(JSON.parse(text));
    } catch {
      /* pulse degrades silently */
    }
  }, []);

  const runAnalyze = useCallback(async () => {
    const mint = analyzeMint.trim();
    if (!mint) return;
    setAnalyzeState("running");
    try {
      const res = await mcpRpc("tools/call", { name: "orbitx_ai_analyze", arguments: { mint } });
      const text = res?.content?.[0]?.text;
      setAnalyzeResult(text ? JSON.parse(text) : null);
      setAnalyzeState("done");
    } catch {
      setAnalyzeState("error");
    }
  }, [analyzeMint]);

  useEffect(() => {
    (async () => {
      try {
        const [tl, pl, rl] = await Promise.all([mcpRpc("tools/list"), mcpRpc("prompts/list"), mcpRpc("resources/list")]);
        if (Array.isArray(tl?.tools)) setLiveTools(tl.tools);
        if (Array.isArray(pl?.prompts)) setLivePrompts(pl.prompts);
        if (Array.isArray(rl?.resources)) setLiveResources(rl.resources);
      } catch {
        /* live panels degrade silently */
      }
    })();
    void loadPulse();
  }, [loadPulse]);

  const runLiveScan = useCallback(async () => {
    setScanState("running");
    try {
      const res = await mcpRpc("tools/call", { name: "orbitx_trader_scan", arguments: { limit: 3 } });
      const text = res?.content?.[0]?.text;
      setScanResult(text ? JSON.parse(text) : null);
      setScanState("done");
    } catch {
      setScanState("error");
    }
  }, []);

  // Fetch in-app wallet address (from /api/orbitx/desk-wallet)
  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const r = await fetch(apiUrl("/api/orbitx/desk-wallet"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const j = await r.json();
        if (j?.publicKey && typeof j.publicKey === "string" && j.publicKey.length > 20) {
          setInAppWallet(j.publicKey);
        }
      } catch {
        /* in-app wallet optional */
      }
    })();
  }, []);

  const walletAddress = useMemo(
    () =>
      resolveAuthWallet({
        connectedPk: publicKey?.toBase58() ?? null,
        email: user?.email,
        userMetadata: (user?.user_metadata as Record<string, unknown> | undefined) ?? null,
        profileWallet:
          inAppWallet ||
          (profile as { wallet_address?: string | null; sol_wallet?: string | null } | null)
            ?.wallet_address ||
          (profile as { sol_wallet?: string | null } | null)?.sol_wallet ||
          null,
      }),
    [publicKey, user?.email, user?.user_metadata, profile, inAppWallet],
  );

  const oauth = useMemo(() => mcpOAuthCredentials(), []);
  const exempt = isAgentHoldExempt({ wallet: walletAddress, email: user?.email });
  const linkedWallet = boot?.agent.walletAddress || walletAddress;
  const hasKey = Boolean(storedKey || (boot?.keys?.length ?? 0) > 0);
  const bearerHeader = storedKey ? `Bearer ${storedKey}` : "";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bootstrapAgent();
      setBoot(data);
      if (data.mintedKey?.key) {
        setStoredKey(data.mintedKey.key);
        setShowKeyPanel(true);
        try {
          localStorage.setItem("agent_api_key", data.mintedKey.key);
        } catch {
          /* ignore */
        }
      } else {
        try {
          const cached = localStorage.getItem("agent_api_key");
          if (cached?.startsWith("oxo_") || cached?.startsWith("oxk_")) {
            setStoredKey((prev) => prev || cached);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectTab = useCallback(
    (id: string) => {
      let next = parseAgentTab(id);
      if ((hideTabs as string[]).includes(next)) next = "setup";
      setTab(next);
      if (embedded) {
        onWorkspaceChange?.(next);
        return;
      }
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "setup") p.delete("tab");
          else p.set("tab", next);
          return p;
        },
        { replace: true },
      );
    },
    [embedded, onWorkspaceChange, setSearchParams],
  );

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    try {
      setCreditsUsage(await fetchXCreditsUsage(20, "30d"));
    } catch {
      /* credits table may not be migrated yet */
    }
  }, [user]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("agent_api_key");
      if (cached?.startsWith("oxo_") || cached?.startsWith("oxk_")) setStoredKey(cached);
    } catch {
      /* ignore */
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (embedded) {
      if (initialTab !== tab) setTab(initialTab);
      return;
    }
    const next = parseAgentTab(searchParams.get("tab") || "");
    if (next !== tab) setTab(next);
  }, [embedded, initialTab, searchParams, tab]);

  useEffect(() => {
    if (tab === "shop") void refreshCredits();
  }, [tab, refreshCredits]);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  const onMintChatAuth = async () => {
    setMintingAuth(true);
    setError(null);
    try {
      const minted = await mintMcpChatAuth(linkedWallet || undefined);
      setChatAuth(minted);
      setSetupOpen("grok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mint chat auth");
    } finally {
      setMintingAuth(false);
    }
  };

  const onCreateKey = async () => {
    setCreating(true);
    setError(null);
    try {
      const minted = await createAgentApiKey(keyName.trim() || "MCP Key");
      setStoredKey(minted.key);
      setShowKeyPanel(true);
      try {
        localStorage.setItem("agent_api_key", minted.key);
      } catch {
        /* ignore */
      }
      const keys = await listAgentApiKeys();
      setBoot((prev) => (prev ? { ...prev, keys: keys.keys, mintedKey: minted } : prev));
      selectTab("keys");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    try {
      await revokeAgentApiKey(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    }
  };

  const onLinkWallet = async () => {
    if (!walletAddress) {
      setError("No wallet found. Connect a Solana wallet (Phantom, Solflare) first, then link it here.");
      return;
    }
    setLinking(true);
    setError(null);
    try {
      await linkAgentWallet(walletAddress, boot?.agent.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to link wallet");
    } finally {
      setLinking(false);
    }
  };

  const burnActive = Boolean(boot?.mcpAccess?.active);
  const betaAccess =
    Boolean((profile as { mcp_beta_access?: boolean | null; badge?: string | null } | null)?.mcp_beta_access) ||
    String((profile as { badge?: string | null } | null)?.badge || "").toLowerCase() === "beta access";
  const statusLabel = betaAccess
    ? "Beta Access"
    : exempt
    ? "Owner exempt"
    : burnActive
      ? boot?.mcpAccess?.remainingLabel || "Free forever"
      : boot?.hold?.meetsRequirement
        ? "Hold verified"
        : hasKey
          ? "MCP ready"
          : "Setup needed";

  return (
    <AgentShell
      activeTab={tab}
      onTabChange={selectTab}
      tabs={hideTabs.length ? [
        { id: "setup", label: "Overview", ico: "⌂" },
        { id: "connect", label: "Connect AI", ico: "⬡" },
        { id: "agent", label: "Trader", ico: "◉" },
        { id: "tools", label: "Tools", ico: "☰" },
        { id: "keys", label: "API keys", ico: "✦" },
      ].filter((t) => !(hideTabs as string[]).includes(t.id)) : undefined}
      statusLabel={statusLabel}
      statusWarn={!hasKey || !linkedWallet}
      onRefresh={refresh}
      embedded={embedded}
      siblingHref="/supercomputer?tab=connect&section=x"
      siblingLabel="X channel"
      siblingIcon="𝕏"
    >
      {loading && <div className="ox-agent__hydrating" role="status">Syncing agent data in the background…</div>}
      {error && <div className="ox-agent__error" role="alert">{error}</div>}
      <div className={`ox-agent__hero${embedded ? " ox-agent__hero--embedded" : ""}`}>
        <h1 className="ox-agent__title">OrbitX</h1>
        <p className="ox-agent__lead">
          OrbitX MCP workspace — connect Claude, ChatGPT, or Grok for research, trade, launch, mint, and social actions.
          Non-custodial; you approve wallet actions yourself.
        </p>
        <div className="ox-agent__kpis">
          <button
            type="button"
            className={`ox-agent__kpi${linkedWallet ? " is-ok" : ""}`}
            onClick={() => selectTab("wallet")}
          >
            <span className="ox-agent__kpi-k">Wallet</span>
            <span className="ox-agent__kpi-v">{linkedWallet ? "Linked" : "Connect"}</span>
          </button>
          <button
            type="button"
            className={`ox-agent__kpi${betaAccess ? " is-ok" : ""}`}
            onClick={() => selectTab("setup")}
          >
            <span className="ox-agent__kpi-k">Access</span>
            <span className="ox-agent__kpi-v">{betaAccess ? "Beta Access" : "Locked"}</span>
          </button>
          <button
            type="button"
            className={`ox-agent__kpi${hasKey ? " is-ok" : ""}`}
            onClick={() => selectTab("keys")}
          >
            <span className="ox-agent__kpi-k">API key</span>
            <span className="ox-agent__kpi-v">{hasKey ? "Ready" : "Create"}</span>
          </button>
          <button
            type="button"
            className={`ox-agent__kpi${hasKey && linkedWallet ? " is-ok" : ""}`}
            onClick={() => selectTab("connect")}
          >
            <span className="ox-agent__kpi-k">AI</span>
            <span className="ox-agent__kpi-v">{hasKey && linkedWallet ? "Connect" : "Setup"}</span>
          </button>
          <button
            type="button"
            className={`ox-agent__kpi${burnActive ? " is-ok" : ""}`}
            onClick={() => selectTab("shop")}
          >
            <span className="ox-agent__kpi-k">Access</span>
            <span className="ox-agent__kpi-v">
              {burnActive ? boot?.mcpAccess?.remainingLabel || "Active" : "Hold or burn"}
            </span>
          </button>
        </div>
        <div className="ox-agent__steps">
          <span className={`ox-agent__chip${linkedWallet ? " is-ok" : ""}`}>
            {linkedWallet ? "Wallet linked" : "Wallet needed"}
          </span>
          <span className={`ox-agent__chip${hasKey ? " is-ok" : ""}`}>
            {hasKey ? "API key ready" : "Create API key"}
          </span>
          {exempt && <span className="ox-agent__chip is-accent">Exempt</span>}
          {burnActive && (
            <span className="ox-agent__chip is-ok">
              {boot?.mcpAccess?.remainingLabel || "Free forever"}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="ox-agent__alert">
          {error}
          {(error.includes("agents") || error.includes("schema") || error.includes("relation")) && (
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Apply sql/Aug_SQL/ in Supabase if agent tables are missing.
            </div>
          )}
        </div>
      )}

      {tab === "setup" && (
        <>
        <div className="ox-agent__hero">
          <div className="ox-agent__steps" style={{ marginTop: 0 }}>
            <span className="ox-agent__chip is-ok">● LIVE</span>
            <span className="ox-agent__chip is-ok">MCP v3.0 — one MCP for everything</span>
            <span className="ox-agent__chip is-ok">Free forever</span>
            <span className="ox-agent__chip">Claude · Grok · ChatGPT</span>
          </div>
          <h1 className="ox-agent__title" style={{ marginTop: 12 }}>OrbitX MCP</h1>
          <p className="ox-agent__lead">
            Research, the Intelligence Pack, your AI Trader Agent, the launchpad, and the desks —{" "}
            {liveTools ? `${liveTools.length} core tools` : "241 core tools"} in one connection,
            4,300+ through the universal dispatcher. No burns, no holds, no packages.
          </p>
          <div className="ox-agent__btn-row">
            <button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => selectTab("connect")}>
              Connect your AI
            </button>
            <button type="button" className="ox-agent__btn" onClick={() => selectTab("agent")}>
              Trader Agent
            </button>
            <button type="button" className="ox-agent__btn" onClick={() => selectTab("tools")}>
              Browse tools
            </button>
          </div>
          <div className="ox-agent__steps" style={{ marginTop: 14 }}>
            <span className="ox-agent__chip">{liveTools ? liveTools.length : 241} core tools</span>
            <span className="ox-agent__chip">
              {liveTools ? liveTools.filter((t: any) => String(t.name).startsWith("launchpad_")).length : 13} launchpad tools
            </span>
            <span className="ox-agent__chip">{livePrompts ? livePrompts.length : 5} intelligence prompts</span>
            <span className="ox-agent__chip">{liveResources ? liveResources.length : 11} live resources</span>
            <span className="ox-agent__chip">4,300+ via orbitx_exec</span>
          </div>
        </div>
        <div className="ox-agent__grid ox-agent__grid--2">
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">ORBITX — live pulse</h2>
              <span className="ox-agent__panel-hint">via orbitx_token_dossier</span>
            </div>
            <div className="ox-agent__panel-b">
              {pulse ? (
                <>
                  <div className="ox-agent__row">
                    <div className="ox-agent__label">Price</div>
                    <div className="ox-agent__value">${String(findKey(pulse, "priceUsd") ?? "—")}</div>
                  </div>
                  <div className="ox-agent__row">
                    <div className="ox-agent__label">Market cap</div>
                    <div className="ox-agent__value">
                      ${Math.round(Number(findKey(pulse, "marketCap") ?? findKey(pulse, "fdv") ?? 0)).toLocaleString()}
                    </div>
                  </div>
                  <div className="ox-agent__row">
                    <div className="ox-agent__label">Holders</div>
                    <div className="ox-agent__value">
                      {Number(findKey(pulse, "holderCount") ?? findKey(pulse, "holders") ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="ox-agent__row">
                    <div className="ox-agent__label">Liquidity</div>
                    <div className="ox-agent__value">
                      ${Math.round(Number(findKey(pulse, "liquidity") ?? 0)).toLocaleString()}
                    </div>
                  </div>
                </>
              ) : (
                <p className="ox-agent__note">Loading the live ORBITX dossier…</p>
              )}
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn" onClick={() => void loadPulse()}>
                  Refresh pulse
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => selectTab("agent")}>
                  Analyze any token →
                </button>
              </div>
            </div>
          </section>
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">One config, every client</h2>
              <span className="ox-agent__panel-hint">Claude · Grok · ChatGPT</span>
            </div>
            <div className="ox-agent__panel-b">
              <p className="ox-agent__note" style={{ marginTop: 0 }}>
                Paste this into your AI's MCP settings and you're in — no key needed to browse,
                chat auth links your account.
              </p>
              <pre className="ox-agent__code" style={{ whiteSpace: "pre-wrap" }}>{MCP_CONFIG_JSON}</pre>
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => copy("mcpConfig", MCP_CONFIG_JSON)}>
                  {copied === "mcpConfig" ? "Copied ✓" : "Copy config"}
                </button>
              </div>
            </div>
          </section>
        </div>
        <div className="ox-agent__grid ox-agent__grid--2">
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Quick start</h2>
              <span className="ox-agent__panel-hint">3 steps</span>
            </div>
            <div className="ox-agent__panel-b">
              <ol className="ox-agent__ol">
                <li>Link your Solana wallet</li>
                <li>Create an API key (shown once)</li>
                <li>Add OrbitX to Claude or ChatGPT and Authenticate</li>
              </ol>
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => selectTab("wallet")}>
                  {linkedWallet ? "Review wallet" : "Link wallet"}
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => selectTab("keys")}>
                  {hasKey ? "Manage keys" : "Create key"}
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => selectTab("connect")}>
                  Connect AI
                </button>
              </div>
            </div>
          </section>

          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">MCP endpoint</h2>
              <span className="ox-agent__panel-hint">use www</span>
            </div>
            <div className="ox-agent__panel-b">
              <FieldRow
                label="MCP URL"
                value={oauth.mcpUrl}
                copied={copied === "mcp"}
                onCopy={() => copy("mcp", oauth.mcpUrl)}
              />
              <p className="ox-agent__note">
                Must end in <code>/mcp</code>. Apex redirects break connectors — always use{" "}
                <strong>www.orbitx.world</strong>.
              </p>
              <div className="ox-agent__btn-row">
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--primary"
                  onClick={() => selectTab("connect")}
                >
                  Open connect
                </button>
              </div>
            </div>
          </section>
        </div>
        </>
      )}

      {tab === "shop" && (
        <McpShop
          variant="agent"
          walletAddress={linkedWallet}
          creditsUsage={creditsUsage}
          onAccessGranted={() => void refresh()}
          onCreditsPurchased={() => void refreshCredits()}
        />
      )}

      {tab === "wallet" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Wallet</h2>
            <span className="ox-agent__panel-hint">linked Solana identity</span>
          </div>
          <div className="ox-agent__panel-b">
            {linkedWallet ? (
              <>
                <div className="ox-agent__row">
                  <div className="ox-agent__label">Wallet</div>
                  <div className="ox-agent__value">{linkedWallet}</div>
                  <div className="ox-agent__actions">
                    <button
                      type="button"
                      className="ox-agent__btn"
                      onClick={() => copy("wallet", linkedWallet)}
                    >
                      {copied === "wallet" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                {boot?.agent?.id && (
                  <div className="ox-agent__row">
                    <div className="ox-agent__label">Agent ID</div>
                    <div className="ox-agent__value">{boot.agent.id}</div>
                    <span />
                  </div>
                )}
                {walletAddress && walletAddress !== boot?.agent.walletAddress && (
                  <div className="ox-agent__btn-row">
                    <button
                      type="button"
                      className="ox-agent__btn ox-agent__btn--primary"
                      disabled={linking}
                      onClick={onLinkWallet}
                    >
                      {linking ? "Linking…" : "Link connected wallet"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="ox-agent__note" style={{ marginTop: 0 }}>
                  No wallet linked yet. Connect to authorize MCP actions.
                </p>
                <div className="ox-agent__btn-row">
                  {pickable.slice(0, 4).map((w) => (
                    <button
                      key={w.name}
                      type="button"
                      className="ox-agent__btn ox-agent__btn--primary"
                      disabled={busy === w.name}
                      onClick={() =>
                        signInWith(w.name, { replaceEmailSession: true })
                          .then(() => refresh())
                          .catch((e) => setError(e.message))
                      }
                    >
                      {busy === w.name ? "Connecting…" : w.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {tab === "keys" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">API keys</h2>
            <span className="ox-agent__panel-hint">hidden until you view</span>
          </div>
          <div className="ox-agent__panel-b">
            {storedKey && (
              <>
                <SecretRow
                  label="Bearer token"
                  value={storedKey}
                  copied={copied === "key"}
                  onCopy={() => copy("key", storedKey)}
                />
                <SecretRow
                  label="Auth header"
                  value={bearerHeader}
                  copied={copied === "bearerHeader"}
                  onCopy={() => copy("bearerHeader", bearerHeader)}
                />
                {showKeyPanel && (
                  <p className="ox-agent__note">New key ready — view, copy, then paste into connector headers.</p>
                )}
              </>
            )}

            <div className="ox-agent__btn-row" style={{ marginTop: storedKey ? "1rem" : 0 }}>
              <input
                className="ox-agent__input ox-agent__grow"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Key label"
              />
              <button
                type="button"
                className="ox-agent__btn ox-agent__btn--primary"
                disabled={creating}
                onClick={onCreateKey}
              >
                {creating ? "Creating…" : "Create key"}
              </button>
            </div>

            {(boot?.keys || []).length === 0 ? (
              <p className="ox-agent__note">No active keys yet.</p>
            ) : (
              <div style={{ marginTop: "1rem" }}>
                {boot?.keys.map((k) => (
                  <div key={k.id} className="ox-agent__keyline">
                    <div>
                      <div className="ox-agent__value ox-agent__value--plain">{k.name}</div>
                      <div className="ox-agent__panel-hint" style={{ marginTop: 4 }}>
                        {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ox-agent__btn ox-agent__btn--danger"
                      onClick={() => onRevoke(k.id)}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "connect" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Connect AI</h2>
            <span className="ox-agent__panel-hint">Claude · ChatGPT · Grok</span>
          </div>
          <div className="ox-agent__panel-b">
            <div className="ox-agent__steps" style={{ marginTop: 0, marginBottom: 14 }}>
              <span className="ox-agent__chip is-ok">MCP v3.0 — one MCP for everything</span>
              <span className="ox-agent__chip is-ok">Free forever — no burn, no hold</span>
              <span className="ox-agent__chip">4,300+ tools</span>
              <span className="ox-agent__chip">Rich widgets in Claude · Grok · ChatGPT</span>
            </div>
            <p className="ox-agent__note" style={{ marginTop: 0 }}>
              New in v2: <code>orbitx_token_dossier</code> — the full token breakdown (scan,
              forensics, ATH, chart) in one call, rendered as a live widget in your AI client.
            </p>
            <div className="ox-agent__btn-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="ox-agent__btn ox-agent__btn--primary"
                onClick={async () => {
                  if (storedKey) await copy("key", storedKey);
                  setSetupOpen("claude");
                  window.open(claudeConnectUrl(oauth.mcpUrl), "_blank", "noopener,noreferrer");
                }}
              >
                Add to Claude
              </button>
              <button
                type="button"
                className="ox-agent__btn"
                onClick={async () => {
                  const pack = [
                    `MCP URL: ${oauth.mcpUrl}`,
                    `Authorization URL: ${oauth.authorizationUrl}`,
                    `Token URL: ${oauth.tokenUrl}`,
                    `Client ID: ${oauth.clientId}`,
                    "Client Secret: (leave blank)",
                    `Scope: ${oauth.scope}`,
                    storedKey ? `Bearer: ${storedKey}` : "Bearer: (create an api key first)",
                  ].join("\n");
                  await copy("chatgptPack", pack);
                  setOauthGuide("chatgpt");
                  setSetupOpen("chatgpt");
                  window.open(chatgptConnectUrl(), "_blank", "noopener,noreferrer");
                }}
              >
                Add to ChatGPT
              </button>
              <button
                type="button"
                className="ox-agent__btn"
                onClick={async () => {
                  await copy("grokMcp", oauth.mcpUrl);
                  setOauthGuide(null);
                  setSetupOpen("grok");
                  window.open(grokConnectUrl(), "_blank", "noopener,noreferrer");
                }}
              >
                Add to Grok
              </button>
            </div>

            <div
              className="ox-agent__note"
              style={{
                marginTop: "1rem",
                padding: "0.85rem 1rem",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>Chat auth (no website click)</strong>
              <p style={{ margin: "0 0 0.75rem", opacity: 0.85 }}>
                Link wallet once here, then generate a special message for Grok / Claude / ChatGPT. Paste it in chat —
                the AI activates your <code>authCode</code> and stays connected.
              </p>
              <div className="ox-agent__btn-row" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--primary"
                  disabled={mintingAuth || !linkedWallet}
                  onClick={onMintChatAuth}
                >
                  {mintingAuth ? "Minting…" : "Generate chat auth"}
                </button>
                {chatAuth?.messages && (
                  <>
                    <button
                      type="button"
                      className="ox-agent__btn"
                      onClick={() => copy("chatGrok", chatAuth.messages.grok)}
                    >
                      {copied === "chatGrok" ? "Copied" : "Copy for Grok"}
                    </button>
                    <button
                      type="button"
                      className="ox-agent__btn"
                      onClick={() => copy("chatClaude", chatAuth.messages.claude)}
                    >
                      {copied === "chatClaude" ? "Copied" : "Copy for Claude"}
                    </button>
                    <button
                      type="button"
                      className="ox-agent__btn"
                      onClick={() => copy("chatGpt", chatAuth.messages.chatgpt)}
                    >
                      {copied === "chatGpt" ? "Copied" : "Copy for ChatGPT"}
                    </button>
                  </>
                )}
              </div>
              {!linkedWallet && (
                <p className="ox-agent__note" style={{ marginBottom: 0 }}>
                  Link your Solana wallet on the Setup tab first.
                </p>
              )}
              {chatAuth?.authCode && (
                <p className="ox-agent__note" style={{ marginBottom: 0 }}>
                  authCode <code>{chatAuth.authCode}</code>
                  {chatAuth.expiresAt ? ` · linked until ${chatAuth.expiresAt.slice(0, 10)}` : ""}
                  {copied?.startsWith("chat") ? " · message copied — paste into that chat" : ""}
                </p>
              )}
            </div>

            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                border: "1px solid var(--border, #26262e)",
                borderRadius: 12,
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>
                AI Trader Agent — easy setup (new in v3)
              </strong>
              <ol className="ox-agent__ol" style={{ marginTop: 0 }}>
                <li>Add OrbitX to your AI with the buttons above — one MCP, everything included.</li>
                <li>Generate chat auth above, then copy the Trader kickoff for your client.</li>
                <li>
                  Paste it in the chat. Your AI boots as your trader agent: it loads the OrbitX
                  playbook, checks your wallet, briefs you, and scans for ranked plays. Try:{" "}
                  <em>"run my trader scan"</em>.
                </li>
              </ol>
              {chatAuth?.messages ? (
                <div className="ox-agent__btn-row" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="ox-agent__btn ox-agent__btn--primary"
                    onClick={() => copy("traderClaude", chatAuth.messages.claude + TRADER_KICKOFF_SUFFIX)}
                  >
                    {copied === "traderClaude" ? "Copied" : "Trader kickoff for Claude"}
                  </button>
                  <button
                    type="button"
                    className="ox-agent__btn"
                    onClick={() => copy("traderGrok", chatAuth.messages.grok + TRADER_KICKOFF_SUFFIX)}
                  >
                    {copied === "traderGrok" ? "Copied" : "Trader kickoff for Grok"}
                  </button>
                  <button
                    type="button"
                    className="ox-agent__btn"
                    onClick={() => copy("traderGpt", chatAuth.messages.chatgpt + TRADER_KICKOFF_SUFFIX)}
                  >
                    {copied === "traderGpt" ? "Copied" : "Trader kickoff for ChatGPT"}
                  </button>
                </div>
              ) : (
                <p className="ox-agent__note" style={{ marginBottom: 0 }}>
                  Link your wallet and tap <strong>Generate chat auth</strong> above — the Trader
                  kickoff buttons appear here.
                </p>
              )}
            </div>

            {copied === "key" && setupOpen === "claude" && (
              <p className="ox-agent__note">
                API key copied — in Claude use Authenticate, or paste <code>Authorization: Bearer …</code> in
                request headers.
              </p>
            )}
            {copied === "chatgptPack" && (
              <p className="ox-agent__note">
                MCP URL + OAuth fields{storedKey ? " + Bearer" : ""} copied — paste into ChatGPT connector.
              </p>
            )}
            {copied === "grokMcp" && setupOpen === "grok" && (
              <p className="ox-agent__note">MCP URL copied — paste that one field into Grok (no OAuth section).</p>
            )}

            <div className="ox-agent__subtabs" style={{ marginTop: "1.1rem" }}>
              {(
                [
                  ["claude", "Claude setup"],
                  ["chatgpt", "ChatGPT setup"],
                  ["grok", "Grok setup"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`ox-agent__subtab${setupOpen === id ? " is-on" : ""}`}
                  onClick={() => setSetupOpen(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {setupOpen === "claude" && (
              <ol className="ox-agent__ol">
                <li>
                  MCP URL must end in <code>/mcp</code> — use the field below
                </li>
                <li>
                  Client ID <code>orbitx-mcp</code>, secret blank
                </li>
                <li>
                  Best: Generate chat auth above → Copy for Claude → paste in chat (no site click)
                </li>
                <li>
                  Or Advanced → header <code>Authorization</code> = Bearer token from the Keys tab
                </li>
              </ol>
            )}
            {setupOpen === "chatgpt" && (
              <ol className="ox-agent__ol">
                <li>Enable Developer mode in ChatGPT settings</li>
                <li>Create a custom MCP connector with the MCP URL</li>
                <li>
                  OAuth: Client ID <code>orbitx-mcp</code>, secret blank, scope <code>orbitx</code>
                </li>
                <li>Best: Generate chat auth → Copy for ChatGPT → paste in a chat (stays linked)</li>
              </ol>
            )}
            {setupOpen === "grok" && (
              <ol className="ox-agent__ol">
                <li>
                  Open <code>grok.com/connectors</code> → New Connector → Custom
                </li>
                <li>Paste only the MCP URL below (one-time setup)</li>
                <li>
                  Generate chat auth above → <strong>Copy for Grok</strong> → paste that message in chat
                </li>
                <li>Grok calls <code>orbitx_auth_status</code> — stays linked; say <code>/</code> for the OrbitX menu</li>
              </ol>
            )}

            <p className="ox-agent__panel-hint" style={{ marginBottom: 8 }}>
              {setupOpen === "grok" ? "Grok field" : "Connector fields"}
            </p>
            <FieldRow
              label="MCP URL"
              value={oauth.mcpUrl}
              copied={copied === "mcp" || copied === "grokMcp"}
              onCopy={() => copy("mcp", oauth.mcpUrl)}
            />
            {setupOpen !== "grok" && (
              <>
                <FieldRow
                  label="Auth URL"
                  value={oauth.authorizationUrl}
                  copied={copied === "auth"}
                  onCopy={() => copy("auth", oauth.authorizationUrl)}
                />
                <FieldRow
                  label="Token URL"
                  value={oauth.tokenUrl}
                  copied={copied === "token"}
                  onCopy={() => copy("token", oauth.tokenUrl)}
                />
                <FieldRow
                  label="Client ID"
                  value={oauth.clientId}
                  copied={copied === "client"}
                  onCopy={() => copy("client", oauth.clientId)}
                />
                <FieldRow label="Client secret" value="(leave blank)" copyable={false} />
                <FieldRow
                  label="Scope"
                  value={oauth.scope}
                  copied={copied === "scope"}
                  onCopy={() => copy("scope", oauth.scope)}
                />
              </>
            )}

            {/* Telegram MCP paused — coming soon (owner, 2026-11-23). Card hidden, code kept. */}
          </div>
        </section>
      )}

      {oauthGuide === "chatgpt" && (
        <div className="ox-agent__modal" onClick={() => setOauthGuide(null)}>
          <div className="ox-agent__modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>ChatGPT OAuth</h2>
            <p className="ox-agent__note" style={{ marginTop: 0, marginBottom: "0.85rem" }}>
              Paste into ChatGPT — leave client secret empty.
            </p>
            {(
              [
                ["MCP URL", oauth.mcpUrl, "mcp"],
                ["Authorization URL", oauth.authorizationUrl, "auth"],
                ["Token URL", oauth.tokenUrl, "token"],
                ["Client ID", oauth.clientId, "client"],
                ["Scope", oauth.scope, "scope"],
              ] as const
            ).map(([label, value, id]) => (
              <FieldRow
                key={id}
                label={label}
                value={value}
                copied={copied === id}
                onCopy={() => copy(id, value)}
              />
            ))}
            <SecretRow
              label="Bearer token"
              value={storedKey || ""}
              emptyLabel="Create an API key first"
              copied={copied === "bearer"}
              onCopy={() => storedKey && copy("bearer", storedKey)}
            />
            <button
              type="button"
              className="ox-agent__btn ox-agent__btn--primary"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => setOauthGuide(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {tab === "agent" && (
        <div className="ox-agent__grid">
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Try the AI — analyze any token</h2>
              <span className="ox-agent__panel-hint">orbitx_ai_analyze, live</span>
            </div>
            <div className="ox-agent__panel-b">
              <p className="ox-agent__note" style={{ marginTop: 0 }}>
                The same scorer your AI runs — safety, concentration, momentum, hard risk flags.
                Paste a mint and see the verdict before you ever open your AI.
              </p>
              <input
                value={analyzeMint}
                onChange={(e) => setAnalyzeMint(e.target.value)}
                placeholder="Paste a Solana mint — try the ORBITX mint below"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border, #26262e)",
                  background: "transparent",
                  color: "inherit",
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => void runAnalyze()} disabled={analyzeState === "running" || !analyzeMint.trim()}>
                  {analyzeState === "running" ? "Analyzing…" : "Analyze token"}
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => setAnalyzeMint(ORBITX_MINT)}>
                  Use ORBITX mint
                </button>
              </div>
              {analyzeState === "done" && analyzeResult && (
                <div style={{ marginTop: 12 }}>
                  <div className="ox-agent__row">
                    <div className="ox-agent__label">Verdict</div>
                    <div className="ox-agent__value">
                      {analyzeResult.score ?? "—"} · {analyzeResult.verdict ?? "unscored"}
                    </div>
                  </div>
                  {analyzeResult.safety !== undefined && (
                    <div className="ox-agent__row">
                      <div className="ox-agent__label">Safety</div>
                      <div className="ox-agent__value">{analyzeResult.safety}</div>
                    </div>
                  )}
                  {(analyzeResult.riskFlags || analyzeResult.flags || []).map((f: any, i: number) => (
                    <div key={i} className="ox-agent__row">
                      <div className="ox-agent__label">⚠ Flag</div>
                      <div className="ox-agent__value" style={{ whiteSpace: "normal" }}>{String(f)}</div>
                    </div>
                  ))}
                  {(analyzeResult.reasons || []).slice(0, 4).map((r: any, i: number) => (
                    <div key={i} className="ox-agent__row">
                      <div className="ox-agent__label">Why</div>
                      <div className="ox-agent__value" style={{ whiteSpace: "normal" }}>{String(r)}</div>
                    </div>
                  ))}
                </div>
              )}
              {analyzeState === "error" && (
                <p className="ox-agent__note" style={{ marginTop: 12 }}>
                  That analyze didn't answer — check the mint and try again.
                </p>
              )}
            </div>
          </section>

          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">AI Trader Agent</h2>
              <span className="ox-agent__panel-hint">runs inside your Claude · Grok · ChatGPT</span>
            </div>
            <div className="ox-agent__panel-b">
              <p className="ox-agent__note" style={{ marginTop: 0 }}>
                The suite: <code>orbitx_trader_boot</code> checks your link,{" "}
                <code>orbitx_trader_brief</code> catches you up, <code>orbitx_trader_scan</code>{" "}
                ranks live candidates by the OrbitX score — flags first, hype never. Set it up once
                from the Connect tab (Generate chat auth → Trader kickoff), then just talk to your
                AI: <em>"run my trader scan"</em>.
              </p>
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => selectTab("connect")}>
                  Get the Trader kickoff
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => void runLiveScan()} disabled={scanState === "running"}>
                  {scanState === "running" ? "Scanning the market…" : "Run a live scan here"}
                </button>
              </div>
              {scanState === "done" && scanResult && (
                <div style={{ marginTop: 12 }}>
                  <p className="ox-agent__note" style={{ marginTop: 0 }}>
                    Source: {String(scanResult.source || "—")} · {scanResult.scanned ?? 0} tokens
                    analyzed · ranked by OrbitX score
                  </p>
                  {(scanResult.candidates || []).map((c: any) => (
                    <div key={c.mint} className="ox-agent__row">
                      <div className="ox-agent__label">
                        {c.score ?? "—"} · {c.verdict ?? "unscored"}
                      </div>
                      <div className="ox-agent__value">{c.mint}</div>
                      {!!(c.riskFlags || []).length && (
                        <div className="ox-agent__label">{c.riskFlags[0]}</div>
                      )}
                    </div>
                  ))}
                  {!(scanResult.candidates || []).length && (
                    <p className="ox-agent__note">No candidates right now — the feeds are quiet.</p>
                  )}
                </div>
              )}
              {scanState === "error" && (
                <p className="ox-agent__note" style={{ marginTop: 12 }}>
                  The scan didn't answer — give it a moment and try again.
                </p>
              )}
            </div>
          </section>

          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Intelligence Pack</h2>
              <span className="ox-agent__panel-hint">what your AI loads before it works</span>
            </div>
            <div className="ox-agent__panel-b">
              <div className="ox-agent__steps" style={{ marginTop: 0 }}>
                <span className="ox-agent__chip">Winners Playbook</span>
                <span className="ox-agent__chip">Data-source map</span>
                <span className="ox-agent__chip">Tool map</span>
                <span className="ox-agent__chip">orbitx_ai_analyze scoring</span>
              </div>
              {(livePrompts || []).map((p: any) => (
                <div key={p.name} className="ox-agent__row">
                  <div className="ox-agent__label">{p.title || p.name}</div>
                  <div className="ox-agent__value" style={{ whiteSpace: "normal" }}>
                    {p.description}
                  </div>
                </div>
              ))}
              {!livePrompts && (
                <p className="ox-agent__note">Loading the live prompt catalog…</p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "tools" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Tool catalog</h2>
            <span className="ox-agent__panel-hint">
              {liveTools ? `${liveTools.length} core · 4,300+ via orbitx_exec` : "loading…"}
            </span>
          </div>
          <div className="ox-agent__panel-b">
            <input
              value={toolQuery}
              onChange={(e) => setToolQuery(e.target.value)}
              placeholder="Search tools — try scan, launchpad, wallet, snipe…"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border, #26262e)",
                background: "transparent",
                color: "inherit",
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />
            <div style={{ maxHeight: 560, overflowY: "auto" }}>
              {(liveTools || [])
                .filter((t: any) => {
                  const q = toolQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    String(t.name).toLowerCase().includes(q) ||
                    String(t.title || "").toLowerCase().includes(q) ||
                    String(t.description || "").toLowerCase().includes(q)
                  );
                })
                .slice(0, 150)
                .map((t: any) => (
                  <div key={t.name} className="ox-agent__row">
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {t.title || t.name}{" "}
                        {t._meta && <span className="ox-agent__chip">Widget</span>}{" "}
                        {String(t.name).startsWith("launchpad_") && (
                          <span className="ox-agent__chip">Launchpad</span>
                        )}
                      </div>
                      <div className="ox-agent__label">
                        <code>{t.name}</code>
                      </div>
                      <div className="ox-agent__label" style={{ whiteSpace: "normal" }}>
                        {String(t.description || "").slice(0, 160)}
                      </div>
                    </div>
                  </div>
                ))}
              {!liveTools && (
                <p className="ox-agent__note">Loading the live catalog from the MCP…</p>
              )}
              {liveTools && toolQuery && !(liveTools || []).some((t: any) => String(t.name).toLowerCase().includes(toolQuery.trim().toLowerCase())) && (
                <p className="ox-agent__note">
                  Not in the core list? Your AI can still call it — 4,300+ tools route through{" "}
                  <code>orbitx_exec</code>.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </AgentShell>
  );
}
