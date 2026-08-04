import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { xGetStoredUser, xStartLogin, type XUser } from "@/lib/xAuth";
import {
  bootstrapXMcp,
  createXMcpApiKey,
  listXMcpApiKeys,
  revokeXMcpApiKey,
  shortXKey,
  xChatgptConnectUrl,
  xClaudeConnectUrl,
  xMcpOAuthCredentials,
  type XMcpBootstrap,
} from "@/lib/xMcp";
import { AgentLoading, AgentShell, type AgentTabId } from "@/components/agent/AgentShell";

function maskSecret(value: string, kind: "key" | "header" = "key") {
  if (!value) return "—";
  if (kind === "header" && value.startsWith("Bearer ")) {
    return `Bearer ${shortXKey(value.slice(7))}`;
  }
  if (value.startsWith("oxo_") || value.startsWith("oxk_") || value.startsWith("oxx_")) {
    return shortXKey(value);
  }
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

/** /x — X MCP hub: connect X + Claude/ChatGPT for posting via MCP tools. */
export default function XMcpPage() {
  const { user, loading: authLoading } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const [tab, setTab] = useState<AgentTabId>("setup");
  const [boot, setBoot] = useState<XMcpBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("Claude / ChatGPT X");
  const [creating, setCreating] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [chatgptGuide, setChatgptGuide] = useState(false);
  const [setupOpen, setSetupOpen] = useState<"claude" | "chatgpt">("claude");
  const [xLocal, setXLocal] = useState<XUser | null>(() => xGetStoredUser());
  const [connectingX, setConnectingX] = useState(false);

  const oauth = useMemo(() => xMcpOAuthCredentials(), []);
  const xConnected = Boolean(boot?.x?.connected || xLocal?.username);
  const xHandle = boot?.x?.username || xLocal?.username || null;
  const hasKey = Boolean(storedKey || (boot?.keys?.length ?? 0) > 0);
  const bearerHeader = storedKey ? `Bearer ${storedKey}` : "";

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await bootstrapXMcp();
      setBoot(data);
      if (data.mintedKey?.key) {
        setStoredKey(data.mintedKey.key);
        setShowKeyPanel(true);
        try {
          localStorage.setItem("x_mcp_api_key", data.mintedKey.key);
        } catch {
          /* ignore */
        }
      } else {
        try {
          const cached = localStorage.getItem("x_mcp_api_key");
          if (cached?.startsWith("oxx_") || cached?.startsWith("oxo_") || cached?.startsWith("oxk_")) {
            setStoredKey((prev) => prev || cached);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load X MCP");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("x_mcp_api_key");
      if (cached?.startsWith("oxx_") || cached?.startsWith("oxo_") || cached?.startsWith("oxk_")) {
        setStoredKey(cached);
      }
    } catch {
      /* ignore */
    }
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onX = () => setXLocal(xGetStoredUser());
    window.addEventListener("x-auth-changed", onX);
    return () => window.removeEventListener("x-auth-changed", onX);
  }, []);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  const onConnectX = async () => {
    setConnectingX(true);
    setError(null);
    try {
      await xStartLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start X login");
      setConnectingX(false);
    }
  };

  const onCreateKey = async () => {
    setCreating(true);
    setError(null);
    try {
      const minted = await createXMcpApiKey(keyName.trim() || "X MCP Key");
      setStoredKey(minted.key);
      setShowKeyPanel(true);
      try {
        localStorage.setItem("x_mcp_api_key", minted.key);
      } catch {
        /* ignore */
      }
      const keys = await listXMcpApiKeys();
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
      await revokeXMcpApiKey(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    }
  };

  if (authLoading || (user && loading)) {
    return <AgentLoading label="Loading X MCP…" />;
  }

  if (!user) {
    return (
      <AgentShell
          showTabs={false}
          statusLabel="Sign in required"
          statusWarn
          brandHref="/x"
          brandSub="X MCP"
          footerBrand="OrbitX X MCP"
          mcpUrl="https://www.orbitx.world/api/x/mcp"
        >
        <div className="ox-agent__hero">
          <h1 className="ox-agent__title">OrbitX · X</h1>
          <p className="ox-agent__lead">
            Connect your X account and wire Claude or ChatGPT to post via MCP tools.
          </p>
        </div>
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Sign in</h2>
            <span className="ox-agent__panel-hint">wallet session</span>
          </div>
          <div className="ox-agent__panel-b">
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
            {error && <div className="ox-agent__alert" style={{ marginTop: 12 }}>{error}</div>}
          </div>
        </section>
      </AgentShell>
    );
  }

  const statusLabel = xConnected
    ? hasKey
      ? "X MCP ready"
      : "Create API key"
    : "Connect X";

  return (
    <AgentShell
      activeTab={tab}
      onTabChange={setTab}
      statusLabel={statusLabel}
      statusWarn={!xConnected || !hasKey}
      onRefresh={refresh}
      brandHref="/x"
      brandSub="X MCP"
      footerBrand="OrbitX X MCP"
      footerNote="Connect X, mint a key, then add this MCP to Claude or ChatGPT to post tweets."
      mcpUrl="https://www.orbitx.world/api/x/mcp"
      tabs={[
        { id: "setup", label: "Setup" },
        { id: "wallet", label: "X account" },
        { id: "keys", label: "API Keys" },
        { id: "connect", label: "Connect" },
      ]}
    >
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">OrbitX · X</h1>
        <p className="ox-agent__lead">
          Post on X from Claude or ChatGPT through a dedicated MCP connector — separate from Agent MCP.
        </p>
        <div className="ox-agent__steps">
          <span className={`ox-agent__chip${xConnected ? " is-ok" : ""}`}>
            {xConnected ? `@${xHandle}` : "Connect X"}
          </span>
          <span className={`ox-agent__chip${hasKey ? " is-ok" : ""}`}>
            {hasKey ? "API key ready" : "Create API key"}
          </span>
          <span className={`ox-agent__chip${xConnected && hasKey ? " is-ok" : ""}`}>
            {xConnected && hasKey ? "Ready for AI" : "Connect AI next"}
          </span>
        </div>
      </div>

      {error && <div className="ox-agent__alert">{error}</div>}

      {tab === "setup" && (
        <div className="ox-agent__grid ox-agent__grid--2">
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Quick start</h2>
              <span className="ox-agent__panel-hint">3 steps</span>
            </div>
            <div className="ox-agent__panel-b">
              <ol className="ox-agent__ol">
                <li>Connect your X account (tweet.write)</li>
                <li>Create an API key (shown once)</li>
                <li>Add OrbitX X to Claude or ChatGPT and Authenticate</li>
              </ol>
              <div className="ox-agent__btn-row">
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--primary"
                  disabled={connectingX}
                  onClick={() => (xConnected ? setTab("wallet") : onConnectX())}
                >
                  {connectingX ? "Redirecting…" : xConnected ? "Review X" : "Connect X"}
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => setTab("keys")}>
                  {hasKey ? "Manage keys" : "Create key"}
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => setTab("connect")}>
                  Connect AI
                </button>
              </div>
              <p className="ox-agent__note">
                Agent trading MCP stays on <Link to="/agent">/agent</Link>. This page is X posting only.
              </p>
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
                Must end in <code>/mcp</code>. Tools: <code>x_post</code>, <code>x_connection_status</code>,{" "}
                <code>x_help</code>.
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
            <h2 className="ox-agent__panel-title">X account</h2>
            <span className="ox-agent__panel-hint">OAuth 2.0 PKCE</span>
          </div>
          <div className="ox-agent__panel-b">
            {xConnected ? (
              <>
                <div className="ox-agent__row">
                  <div className="ox-agent__label">Handle</div>
                  <div className="ox-agent__value">@{xHandle}</div>
                  <div className="ox-agent__actions">
                    <button
                      type="button"
                      className="ox-agent__btn"
                      onClick={() => xHandle && copy("handle", `@${xHandle}`)}
                    >
                      {copied === "handle" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                {(boot?.x?.displayName || xLocal?.displayName) && (
                  <div className="ox-agent__row">
                    <div className="ox-agent__label">Name</div>
                    <div className="ox-agent__value">{boot?.x?.displayName || xLocal?.displayName}</div>
                    <span />
                  </div>
                )}
                <p className="ox-agent__note">
                  MCP <code>x_post</code> tweets as this account. Reconnect if tokens expire.
                </p>
                <div className="ox-agent__btn-row">
                  <button
                    type="button"
                    className="ox-agent__btn"
                    disabled={connectingX}
                    onClick={onConnectX}
                  >
                    {connectingX ? "Redirecting…" : "Reconnect X"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="ox-agent__note" style={{ marginTop: 0 }}>
                  Connect X with tweet.write so Claude/ChatGPT can post through this MCP.
                </p>
                <div className="ox-agent__btn-row">
                  <button
                    type="button"
                    className="ox-agent__btn ox-agent__btn--primary"
                    disabled={connectingX}
                    onClick={onConnectX}
                  >
                    {connectingX ? "Redirecting…" : "Connect X"}
                  </button>
                </div>
                <p className="ox-agent__note">
                  In Vercel set <code>TWITTER_CLIENT_ID</code> + <code>TWITTER_CLIENT_SECRET</code> (Production), redeploy.
                  In the X developer portal → User authentication: OAuth 2.0 on, App type Web App, permissions Read and
                  write, callback exactly <code>https://www.orbitx.world/x-callback</code>.
                </p>
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
            <span className="ox-agent__panel-hint">Claude · ChatGPT</span>
          </div>
          <div className="ox-agent__panel-b">
            {!xConnected && (
              <div className="ox-agent__alert" style={{ marginBottom: 12 }}>
                Connect X first — without it, <code>x_post</code> will fail.
              </div>
            )}
            <div className="ox-agent__btn-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="ox-agent__btn ox-agent__btn--primary"
                onClick={async () => {
                  if (storedKey) await copy("key", storedKey);
                  setSetupOpen("claude");
                  window.open(xClaudeConnectUrl(oauth.mcpUrl), "_blank", "noopener,noreferrer");
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
                  setChatgptGuide(true);
                  setSetupOpen("chatgpt");
                  window.open(xChatgptConnectUrl(), "_blank", "noopener,noreferrer");
                }}
              >
                Add to ChatGPT
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

            <div className="ox-agent__subtabs" style={{ marginTop: "1.1rem" }}>
              {(
                [
                  ["claude", "Claude setup"],
                  ["chatgpt", "ChatGPT setup"],
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

            {setupOpen === "claude" ? (
              <ol className="ox-agent__ol">
                <li>
                  MCP URL must end in <code>/mcp</code> — use the field below
                </li>
                <li>
                  Client ID <code>orbitx-x-mcp</code>, secret blank
                </li>
                <li>
                  Advanced → header <code>Authorization</code> = Bearer token from the Keys tab
                </li>
                <li>
                  Ask Claude to call <code>x_post</code> with your tweet text
                </li>
              </ol>
            ) : (
              <ol className="ox-agent__ol">
                <li>Enable Developer mode in ChatGPT settings</li>
                <li>Create a custom MCP connector with the X MCP URL</li>
                <li>
                  OAuth: Client ID <code>orbitx-x-mcp</code>, secret blank, scope <code>x-post</code>
                </li>
                <li>Authenticate → approve on OrbitX /x</li>
              </ol>
            )}

            <p className="ox-agent__panel-hint" style={{ marginBottom: 8 }}>
              Connector fields
            </p>
            <FieldRow label="MCP URL" value={oauth.mcpUrl} copied={copied === "mcp"} onCopy={() => copy("mcp", oauth.mcpUrl)} />
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
          </div>
        </section>
      )}

      {chatgptGuide && (
        <div className="ox-agent__modal" onClick={() => setChatgptGuide(false)}>
          <div className="ox-agent__modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>ChatGPT OAuth · X</h2>
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
              onClick={() => setChatgptGuide(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </AgentShell>
  );
}
