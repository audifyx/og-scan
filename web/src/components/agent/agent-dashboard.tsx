import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { isAgentHoldExempt, resolveAuthWallet } from "@/lib/agentTokenGate";
import {
  bootstrapAgent,
  chatgptConnectUrl,
  claudeConnectUrl,
  createAgentApiKey,
  linkAgentWallet,
  listAgentApiKeys,
  mcpOAuthCredentials,
  revokeAgentApiKey,
  shortKey,
  type AgentBootstrap,
} from "@/lib/orbitxMcp";
import "./agent-terminal.css";

function maskSecret(value: string, kind: "key" | "header" = "key") {
  if (!value) return "—";
  if (kind === "header" && value.startsWith("Bearer ")) {
    return `Bearer ${shortKey(value.slice(7))}`;
  }
  if (value.startsWith("oxo_") || value.startsWith("oxk_")) return shortKey(value);
  if (value.length <= 12) return "********";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function SecretBlock({
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
    <div className="ox-term__row">
      <div className="ox-term__label">{label}</div>
      <div className="ox-term__value">
        {!has
          ? emptyLabel || "create an api key first"
          : visible
            ? value
            : maskSecret(value, label.toLowerCase().includes("header") ? "header" : "key")}
      </div>
      {has && (
        <div className="ox-term__actions">
          <button type="button" className="ox-term__btn ox-term__btn--ghost" onClick={() => setVisible((v) => !v)}>
            {visible ? "hide" : "view"}
          </button>
          <button type="button" className="ox-term__btn ox-term__btn--ghost" onClick={onCopy}>
            {copied ? "copied" : "copy"}
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
    <div className="ox-term__row">
      <div className="ox-term__label">{label}</div>
      <div className="ox-term__value">{value}</div>
      {copyable && onCopy && (
        <div className="ox-term__actions">
          <button type="button" className="ox-term__btn ox-term__btn--ghost" onClick={onCopy}>
            {copied ? "copied" : "copy"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AgentDashboard() {
  const { user, profile } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const [boot, setBoot] = useState<AgentBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("Claude / ChatGPT");
  const [creating, setCreating] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [chatgptGuide, setChatgptGuide] = useState(false);
  const [linking, setLinking] = useState(false);
  const [setupOpen, setSetupOpen] = useState<"claude" | "chatgpt" | null>("claude");

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

  const steps = [
    { ok: Boolean(linkedWallet), label: "01 wallet" },
    { ok: hasKey, label: "02 api key" },
    { ok: hasKey && Boolean(linkedWallet), label: "03 connect" },
  ];

  if (loading) {
    return (
      <div className="ox-term__loading">
        <span>booting agent session</span>
        <span className="ox-term__cursor" />
      </div>
    );
  }

  return (
    <div className="ox-term">
      <div className="ox-term__inner">
        <div className="ox-term__bar">
          <div className="ox-term__dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="ox-term__bar-title">orbitx://agent/mcp — tty</div>
          <button type="button" className="ox-term__btn ox-term__btn--ghost" onClick={refresh}>
            refresh
          </button>
        </div>

        <h1 className="ox-term__brand">
          OrbitX Agent
          <span className="ox-term__cursor" aria-hidden />
        </h1>
        <p className="ox-term__sub">
          Terminal control for MCP — wire Claude or ChatGPT to trade, launch, mint, and social.
          Non-custodial. You sign in Phantom.
        </p>

        <div className="ox-term__steps">
          {steps.map((s) => (
            <div key={s.label} className={`ox-term__step${s.ok ? " is-ok" : ""}`}>
              {s.ok ? "[x]" : "[ ]"} {s.label}
            </div>
          ))}
          {exempt && <span className="ox-term__badge">exempt</span>}
          {!exempt && boot?.hold?.meetsRequirement && (
            <span className="ox-term__badge">
              hold ok
              {boot.hold.holdingUsd != null ? ` $${Number(boot.hold.holdingUsd).toFixed(0)}` : ""}
            </span>
          )}
        </div>

        {error && (
          <div className="ox-term__err">
            ERR {error}
            {(error.includes("agents") || error.includes("schema") || error.includes("relation")) && (
              <div style={{ marginTop: 6, opacity: 0.7 }}>
                apply sql/Aug_SQL/ in supabase if tables missing
              </div>
            )}
          </div>
        )}

        {/* identity */}
        <section className="ox-term__section">
          <div className="ox-term__section-h">
            <div className="ox-term__prompt">identity</div>
            <div className="ox-term__hint">linked solana wallet</div>
          </div>
          <div className="ox-term__body">
            {linkedWallet ? (
              <>
                <div className="ox-term__row">
                  <div className="ox-term__label">wallet</div>
                  <div className="ox-term__value">{linkedWallet}</div>
                  <div className="ox-term__actions">
                    <button
                      type="button"
                      className="ox-term__btn ox-term__btn--ghost"
                      onClick={() => copy("wallet", linkedWallet)}
                    >
                      {copied === "wallet" ? "copied" : "copy"}
                    </button>
                  </div>
                </div>
                {boot?.agent?.id && (
                  <div className="ox-term__row">
                    <div className="ox-term__label">agent id</div>
                    <div className="ox-term__value">{boot.agent.id}</div>
                  </div>
                )}
                {walletAddress && walletAddress !== boot?.agent.walletAddress && (
                  <button
                    type="button"
                    className="ox-term__btn ox-term__btn--fill"
                    disabled={linking}
                    onClick={onLinkWallet}
                  >
                    {linking ? "linking…" : "link connected wallet"}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="ox-term__sub" style={{ marginBottom: 12 }}>
                  no wallet linked — connect to authorize mcp actions
                </p>
                <div className="ox-term__flex">
                  {pickable.slice(0, 4).map((w) => (
                    <button
                      key={w.name}
                      type="button"
                      className="ox-term__btn"
                      disabled={busy === w.name}
                      onClick={() =>
                        signInWith(w.name, { replaceEmailSession: true })
                          .then(() => refresh())
                          .catch((e) => setError(e.message))
                      }
                    >
                      {busy === w.name ? "connecting…" : w.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* keys */}
        <section className="ox-term__section">
          <div className="ox-term__section-h">
            <div className="ox-term__prompt">api_key</div>
            <div className="ox-term__hint">hidden · view to reveal</div>
          </div>
          <div className="ox-term__body">
            {storedKey && (
              <>
                <SecretBlock
                  label="bearer token"
                  value={storedKey}
                  copied={copied === "key"}
                  onCopy={() => copy("key", storedKey)}
                />
                <SecretBlock
                  label="authorization header"
                  value={bearerHeader}
                  copied={copied === "bearerHeader"}
                  onCopy={() => copy("bearerHeader", bearerHeader)}
                />
                {showKeyPanel && (
                  <p className="ox-term__sub">new key ready — view → copy → paste into connector headers</p>
                )}
              </>
            )}

            <div className="ox-term__flex" style={{ marginBottom: 12 }}>
              <input
                className="ox-term__input ox-term__grow"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="key label"
              />
              <button
                type="button"
                className="ox-term__btn ox-term__btn--fill"
                disabled={creating}
                onClick={onCreateKey}
              >
                {creating ? "creating…" : "create key"}
              </button>
            </div>

            {(boot?.keys || []).length === 0 ? (
              <p className="ox-term__sub">no active keys</p>
            ) : (
              boot?.keys.map((k) => (
                <div key={k.id} className="ox-term__keyline">
                  <div>
                    <div className="ox-term__value">{k.name}</div>
                    <div className="ox-term__hint" style={{ marginTop: 4 }}>
                      {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ox-term__btn ox-term__btn--danger"
                    onClick={() => onRevoke(k.id)}
                  >
                    revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* connect */}
        <section className="ox-term__section">
          <div className="ox-term__section-h">
            <div className="ox-term__prompt">connect</div>
            <div className="ox-term__hint">claude · chatgpt</div>
          </div>
          <div className="ox-term__body">
            <div className="ox-term__flex" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className="ox-term__btn ox-term__btn--fill"
                onClick={() => window.open(claudeConnectUrl(oauth.mcpUrl), "_blank", "noopener,noreferrer")}
              >
                add to claude
              </button>
              <button
                type="button"
                className="ox-term__btn"
                onClick={() => {
                  setChatgptGuide(true);
                  window.open(chatgptConnectUrl(), "_blank", "noopener,noreferrer");
                }}
              >
                add to chatgpt
              </button>
            </div>

            <div className="ox-term__tabs">
              {(
                [
                  ["claude", "claude setup"],
                  ["chatgpt", "chatgpt setup"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`ox-term__tab${setupOpen === id ? " is-on" : ""}`}
                  onClick={() => setSetupOpen(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {setupOpen === "claude" && (
              <ol className="ox-term__ol">
                <li>
                  MCP URL must end in <code>/mcp</code> — use the field below
                </li>
                <li>
                  Client ID <code>orbitx-mcp</code>, secret blank
                </li>
                <li>
                  Advanced → header <code>Authorization</code> = Bearer token (view + copy above)
                </li>
              </ol>
            )}
            {setupOpen === "chatgpt" && (
              <ol className="ox-term__ol">
                <li>Enable Developer mode in ChatGPT settings</li>
                <li>Create custom MCP connector with MCP URL</li>
                <li>
                  OAuth: Client ID <code>orbitx-mcp</code>, secret blank, scope <code>orbitx</code>
                </li>
                <li>Authenticate → approve on OrbitX</li>
              </ol>
            )}

            <div className="ox-term__hint" style={{ marginBottom: 8 }}>
              connector fields
            </div>
            <FieldRow label="mcp url" value={oauth.mcpUrl} copied={copied === "mcp"} onCopy={() => copy("mcp", oauth.mcpUrl)} />
            <FieldRow
              label="auth url"
              value={oauth.authorizationUrl}
              copied={copied === "auth"}
              onCopy={() => copy("auth", oauth.authorizationUrl)}
            />
            <FieldRow
              label="token url"
              value={oauth.tokenUrl}
              copied={copied === "token"}
              onCopy={() => copy("token", oauth.tokenUrl)}
            />
            <FieldRow
              label="client id"
              value={oauth.clientId}
              copied={copied === "client"}
              onCopy={() => copy("client", oauth.clientId)}
            />
            <FieldRow label="client secret" value="(leave blank)" copyable={false} />
            <FieldRow
              label="scope"
              value={oauth.scope}
              copied={copied === "scope"}
              onCopy={() => copy("scope", oauth.scope)}
            />
          </div>
        </section>

        <p className="ox-term__footer">keys stay local until you copy · orbitx never holds wallet keys</p>
      </div>

      {chatgptGuide && (
        <div className="ox-term__modal" onClick={() => setChatgptGuide(false)}>
          <div className="ox-term__modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ox-term__prompt" style={{ marginBottom: 8 }}>
              chatgpt oauth
            </div>
            <p className="ox-term__sub">paste into chatgpt · client secret stays empty</p>
            {(
              [
                ["mcp url", oauth.mcpUrl, "mcp"],
                ["authorization url", oauth.authorizationUrl, "auth"],
                ["token url", oauth.tokenUrl, "token"],
                ["client id", oauth.clientId, "client"],
                ["scope", oauth.scope, "scope"],
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
            <SecretBlock
              label="bearer token"
              value={storedKey || ""}
              emptyLabel="create an api key first"
              copied={copied === "bearer"}
              onCopy={() => storedKey && copy("bearer", storedKey)}
            />
            <button
              type="button"
              className="ox-term__btn ox-term__btn--fill"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => setChatgptGuide(false)}
            >
              done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
