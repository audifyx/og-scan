import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { isAgentHoldExempt, resolveAuthWallet } from "@/lib/agentTokenGate";
import {
  bootstrapAgent,
  chatgptConnectUrl,
  claudeConnectUrl,
  grokConnectUrl,
  createAgentApiKey,
  linkAgentWallet,
  listAgentApiKeys,
  mcpOAuthCredentials,
  revokeAgentApiKey,
  shortKey,
  type AgentBootstrap,
} from "@/lib/orbitxMcp";
import { AgentLoading, AgentShell, type AgentTabId } from "./AgentShell";

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

export function AgentDashboard() {
  const { user, profile } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const [tab, setTab] = useState<AgentTabId>("setup");
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

  useEffect(() => {
    try {
      const cached = localStorage.getItem("agent_api_key");
      if (cached?.startsWith("oxo_") || cached?.startsWith("oxk_")) setStoredKey(cached);
    } catch {
      /* ignore */
    }
    refresh();
  }, [refresh]);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
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
      setTab("keys");
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

  const statusLabel = exempt
    ? "Owner exempt"
    : boot?.hold?.meetsRequirement
      ? "Hold verified"
      : hasKey
        ? "MCP ready"
        : "Setup needed";

  return (
    <AgentShell
      activeTab={tab}
      onTabChange={setTab}
      statusLabel={statusLabel}
      statusWarn={!hasKey || !linkedWallet}
      onRefresh={refresh}
    >
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">OrbitX Agent</h1>
        <p className="ox-agent__lead">
          Connect Claude or ChatGPT to OrbitX MCP — trade, launch, mint, and social. Non-custodial;
          you sign in your wallet.
        </p>
        <div className="ox-agent__steps">
          <span className={`ox-agent__chip${linkedWallet ? " is-ok" : ""}`}>
            {linkedWallet ? "Wallet linked" : "Wallet needed"}
          </span>
          <span className={`ox-agent__chip${hasKey ? " is-ok" : ""}`}>
            {hasKey ? "API key ready" : "Create API key"}
          </span>
          <span className={`ox-agent__chip${hasKey && linkedWallet ? " is-ok" : ""}`}>
            {hasKey && linkedWallet ? "Ready to connect" : "Connect AI next"}
          </span>
          {exempt && <span className="ox-agent__chip is-accent">Exempt</span>}
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
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => setTab("wallet")}>
                  {linkedWallet ? "Review wallet" : "Link wallet"}
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => setTab("keys")}>
                  {hasKey ? "Manage keys" : "Create key"}
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => setTab("connect")}>
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
                  onClick={() => setTab("connect")}
                >
                  Open connect
                </button>
              </div>
            </div>
          </section>
        </div>
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
                  Advanced → header <code>Authorization</code> = Bearer token from the Keys tab
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
                <li>Authenticate → approve on OrbitX</li>
              </ol>
            )}
            {setupOpen === "grok" && (
              <ol className="ox-agent__ol">
                <li>
                  Open <code>grok.com/connectors</code> → New Connector → Custom
                </li>
                <li>Paste only the MCP URL (Grok has no OAuth section)</li>
                <li>Save / enable — Grok discovers OAuth from that URL</li>
                <li>
                  When Grok opens Authenticate, approve on OrbitX <code>/agent/mcp-auth</code>
                </li>
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
