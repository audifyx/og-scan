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
import { AgentLoading, AgentShell, type AgentTabId } from "./AgentShell";
import { TelegramMcpCard } from "./TelegramMcpCard";
import { McpShop } from "./McpShop";

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

const AGENT_TABS = new Set<AgentTabId>(["setup", "shop", "wallet", "keys", "connect"]);

function parseAgentTab(raw: string): AgentTabId {
  const t = String(raw || "").toLowerCase();
  if (t === "shop" || t === "credits" || t === "usage" || t === "access") return "shop";
  return AGENT_TABS.has(t as AgentTabId) ? (t as AgentTabId) : "setup";
}

export function AgentDashboard({ embedded = false, initialTab = "setup", onWorkspaceChange }: { embedded?: boolean; initialTab?: AgentTabId; onWorkspaceChange?: (tab: AgentTabId) => void }) {
  const { user, profile } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<AgentTabId>(() => embedded ? initialTab : parseAgentTab(searchParams.get("tab") || ""));
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

  const walletAddress = useMemo(
    () =>
      resolveAuthWallet({
        connectedPk: publicKey?.toBase58() ?? null,
        email: user?.email,
        userMetadata: (user?.user_metadata as Record<string, unknown> | undefined) ?? null,
        profileWallet:
          (profile as { wallet_address?: string | null; sol_wallet?: string | null } | null)
            ?.wallet_address ||
          (profile as { sol_wallet?: string | null } | null)?.sol_wallet ||
          null,
      }),
    [publicKey, user?.email, user?.user_metadata, profile],
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
      const next = parseAgentTab(id);
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
    if (!walletAddress) return;
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

  if (loading) {
    return <AgentLoading label="Booting agent session…" />;
  }

  const burnActive = Boolean(boot?.mcpAccess?.active);
  const betaAccess =
    Boolean((profile as { mcp_beta_access?: boolean | null; badge?: string | null } | null)?.mcp_beta_access) ||
    String((profile as { badge?: string | null } | null)?.badge || "").toLowerCase() === "beta access";
  const statusLabel = betaAccess
    ? "Beta Access"
    : exempt
    ? "Owner exempt"
    : burnActive
      ? boot?.mcpAccess?.remainingLabel || "Burn access"
      : boot?.hold?.meetsRequirement
        ? "Hold verified"
        : hasKey
          ? "MCP ready"
          : "Setup needed";

  return (
    <AgentShell
      activeTab={tab}
      onTabChange={selectTab}
      statusLabel={statusLabel}
      statusWarn={!hasKey || !linkedWallet}
      onRefresh={refresh}
      embedded={embedded}
      siblingHref="/supercomputer?tab=x"
      siblingLabel="X channel"
      siblingIcon="𝕏"
    >
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
              {boot?.mcpAccess?.remainingLabel || "Burn access"}
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

            <TelegramMcpCard kind="agent" />
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
    </AgentShell>
  );
}
