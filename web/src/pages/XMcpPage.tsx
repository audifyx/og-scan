import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { xGetStoredUser, xStartLogin, type XUser } from "@/lib/xAuth";
import {
  approveXAgentQueueItem,
  bootstrapXMcp,
  cancelXAgentQueueItem,
  createXMcpApiKey,
  fetchXAgent,
  fetchXDmInbox,
  generateXAgentPost,
  listXAgentQueue,
  listXMcpApiKeys,
  revokeXMcpApiKey,
  sendXDm,
  shortXKey,
  trainXAgent,
  upsertXAgent,
  xChatgptConnectUrl,
  xClaudeConnectUrl,
  xMcpOAuthCredentials,
  type XAgentConfig,
  type XAgentKnowledge,
  type XAgentQueueItem,
  type XMcpBootstrap,
  type XNimModel,
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

  const [tab, setTab] = useState<AgentTabId>("wallet");
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
  const [xOauthConfig, setXOauthConfig] = useState<{
    configured?: boolean;
    hasClientId?: boolean;
    hasClientSecret?: boolean;
    clientId?: string | null;
    callbackUrl?: string;
    checklist?: string[];
  } | null>(null);
  const [xAgent, setXAgent] = useState<XAgentConfig | null>(null);
  const [knowledge, setKnowledge] = useState<XAgentKnowledge[]>([]);
  const [models, setModels] = useState<XNimModel[]>([]);
  const [queue, setQueue] = useState<XAgentQueueItem[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [trainTitle, setTrainTitle] = useState("Note");
  const [trainContent, setTrainContent] = useState("");
  const [genHint, setGenHint] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [dmUser, setDmUser] = useState("");
  const [dmText, setDmText] = useState("");
  const [dmBusy, setDmBusy] = useState(false);
  const [dmNote, setDmNote] = useState<string | null>(null);

  const oauth = useMemo(() => xMcpOAuthCredentials(), []);
  const xConnected = Boolean(boot?.x?.connected || xLocal?.username);
  const xHandle = boot?.x?.username || xLocal?.username || null;
  const hasKey = Boolean(storedKey || (boot?.keys?.length ?? 0) > 0);
  const bearerHeader = storedKey ? `Bearer ${storedKey}` : "";

  const refreshAgent = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchXAgent();
      setXAgent(data.agent);
      setKnowledge(data.knowledge || []);
      setModels(data.models || []);
      setTopicsText((data.agent.topics || []).join(", "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load X agent");
    }
  }, [user]);

  const refreshQueue = useCallback(async () => {
    if (!user) return;
    try {
      const data = await listXAgentQueue();
      setQueue(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    }
  }, [user]);

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
      await Promise.allSettled([refreshAgent(), refreshQueue()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load X MCP");
    } finally {
      setLoading(false);
    }
  }, [user, refreshAgent, refreshQueue]);

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

  useEffect(() => {
    fetch("/api/x/agent/oauth/config")
      .then((r) => r.json())
      .then((d) => setXOauthConfig(d))
      .catch(() => setXOauthConfig({ configured: false }));
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
      setTab("connect");
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

  const onSaveAgent = async () => {
    if (!xAgent) return;
    setAgentBusy(true);
    setError(null);
    try {
      const topics = topicsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 40);
      const { agent } = await upsertXAgent({
        name: xAgent.name,
        persona: xAgent.persona,
        voiceNotes: xAgent.voiceNotes,
        model: xAgent.model,
        mode: xAgent.mode,
        enabled: xAgent.enabled,
        topics,
        maxPostsPerDay: xAgent.maxPostsPerDay,
        postingWindows: xAgent.postingWindows,
        timezone: xAgent.timezone,
      });
      setXAgent(agent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save agent");
    } finally {
      setAgentBusy(false);
    }
  };

  const onTrain = async () => {
    const content = trainContent.trim();
    if (!content) return;
    setAgentBusy(true);
    setError(null);
    try {
      const res = await trainXAgent({ title: trainTitle.trim() || "Note", content });
      setXAgent(res.agent);
      setKnowledge(res.knowledgeList || []);
      setTrainContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to train");
    } finally {
      setAgentBusy(false);
    }
  };

  const onGenerate = async (postNow = false) => {
    setAgentBusy(true);
    setError(null);
    try {
      const res = await generateXAgentPost({ hint: genHint.trim() || undefined, postNow });
      if (res.error || res.message) {
        setError(res.message || res.error || "Generate failed");
      }
      await refreshQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setAgentBusy(false);
    }
  };

  const onApproveQueue = async (id: string) => {
    setAgentBusy(true);
    setError(null);
    try {
      await approveXAgentQueueItem(id);
      await refreshQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setAgentBusy(false);
    }
  };

  const onCancelQueue = async (id: string) => {
    setAgentBusy(true);
    setError(null);
    try {
      await cancelXAgentQueueItem(id);
      await refreshQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setAgentBusy(false);
    }
  };

  const onSendDm = async () => {
    const username = dmUser.replace(/^@/, "").trim();
    const text = dmText.trim();
    if (!username || !text) {
      setDmNote("Enter @username and message");
      return;
    }
    setDmBusy(true);
    setDmNote(null);
    setError(null);
    try {
      const res = await sendXDm({ username, text });
      if (!res.ok) {
        setDmNote(res.message || res.error || "DM failed — Reconnect X for dm.write");
      } else {
        setDmNote(res.dmEventId ? `Sent (${res.dmEventId})` : "Sent");
        setDmText("");
      }
    } catch (e) {
      setDmNote(e instanceof Error ? e.message : "DM failed");
    } finally {
      setDmBusy(false);
    }
  };

  const onLoadDmInbox = async () => {
    setDmBusy(true);
    setDmNote(null);
    try {
      const res = await fetchXDmInbox();
      if (!res.ok) {
        setDmNote(res.message || res.error || "Inbox unavailable — need dm.read + Reconnect X");
      } else {
        const n = res.events?.length ?? 0;
        setDmNote(n ? `${n} recent DM event(s) loaded — use MCP x_dm_inbox for full list` : "Inbox empty");
      }
    } catch (e) {
      setDmNote(e instanceof Error ? e.message : "Inbox failed");
    } finally {
      setDmBusy(false);
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
      footerNote="Connect X, train an agent, mint a key, then post via Claude/ChatGPT MCP or the Queue."
      mcpUrl="https://www.orbitx.world/api/x/mcp"
      tabs={[
        { id: "wallet", label: "X account" },
        { id: "agent", label: "Agent" },
        { id: "queue", label: "Queue" },
        { id: "connect", label: "Connect" },
      ]}
    >
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">OrbitX · X</h1>
        <p className="ox-agent__lead">
          X MCP agent — post, quote, reply, DM, and schedule NVIDIA-trained drafts from Claude or ChatGPT.
        </p>
        <div className="ox-agent__steps">
          <span className={`ox-agent__chip${xConnected ? " is-ok" : ""}`}>
            {xConnected ? `@${xHandle}` : "Connect X"}
          </span>
          <span className={`ox-agent__chip${xAgent?.enabled ? " is-ok" : ""}`}>
            {xAgent?.enabled ? `Agent ${xAgent.mode}` : "Train agent"}
          </span>
          <span className={`ox-agent__chip${hasKey ? " is-ok" : ""}`}>
            {hasKey ? "API key ready" : "Create API key"}
          </span>
        </div>
      </div>

      {error && <div className="ox-agent__alert">{error}</div>}

      {tab === "wallet" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">X account</h2>
            <span className="ox-agent__panel-hint">OAuth 2.0 PKCE</span>
          </div>
          <div className="ox-agent__panel-b">
            
                {!xConnected && xOauthConfig && (
                  <div className="ox-agent__alert" style={{ marginTop: 12, marginBottom: 12 }}>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>
                      {xOauthConfig.configured
                        ? "Vercel keys detected — match this Client ID in the X portal"
                        : "Missing TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET on Vercel (Production)"}
                    </div>
                    {xOauthConfig.clientId ? (
                      <div className="ox-agent__row" style={{ marginBottom: 8 }}>
                        <div className="ox-agent__label">Client ID</div>
                        <div className="ox-agent__value" style={{ wordBreak: "break-all" }}>
                          {xOauthConfig.clientId}
                        </div>
                        <div className="ox-agent__actions">
                          <button
                            type="button"
                            className="ox-agent__btn"
                            onClick={() => copy("clientId", xOauthConfig.clientId || "")}
                          >
                            {copied === "clientId" ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="ox-agent__row" style={{ marginBottom: 8 }}>
                      <div className="ox-agent__label">Callback</div>
                      <div className="ox-agent__value">
                        {xOauthConfig.callbackUrl || "https://www.orbitx.world/x-callback"}
                      </div>
                      <div className="ox-agent__actions">
                        <button
                          type="button"
                          className="ox-agent__btn"
                          onClick={() =>
                            copy(
                              "callback",
                              xOauthConfig.callbackUrl || "https://www.orbitx.world/x-callback",
                            )
                          }
                        >
                          {copied === "callback" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                    <ol className="ox-agent__ol" style={{ marginTop: 8 }}>
                      {(xOauthConfig.checklist || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                    <p className="ox-agent__note" style={{ marginBottom: 0 }}>
                      X error “weren't able to give access” almost always means callback / app type /
                      permissions don't match this Client ID. App must be <strong>Read and write</strong>,
                      type <strong>Web App</strong>.
                    </p>
                  </div>
                )}

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
                  If <code>x_post</code> fails but DMs work, Reconnect X so the token gets{" "}
                  <code>tweet.write</code> again (scope order fixed). Portal permissions must be{" "}
                  <strong>Read and write and Direct message</strong>.
                </p>
                <div className="ox-agent__btn-row">
                  <button
                    type="button"
                    className="ox-agent__btn ox-agent__btn--primary"
                    disabled={connectingX}
                    onClick={onConnectX}
                  >
                    {connectingX ? "Redirecting…" : "Reconnect X (fix posting)"}
                  </button>
                </div>

                <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.08)", margin: "1.25rem 0" }} />
                <h3 className="ox-agent__panel-title" style={{ fontSize: "1rem", marginBottom: 8 }}>
                  Send DM
                </h3>
                <p className="ox-agent__note" style={{ marginTop: 0 }}>
                  MCP tools: <code>x_dm</code> (send), <code>x_dm_inbox</code> (read). Needs dm.write / dm.read
                  after Reconnect.
                </p>
                <label className="ox-agent__label" htmlFor="x-dm-user">
                  To @username
                </label>
                <input
                  id="x-dm-user"
                  className="ox-agent__input"
                  style={{ width: "100%", marginBottom: 8 }}
                  value={dmUser}
                  onChange={(e) => setDmUser(e.target.value)}
                  placeholder="handle"
                />
                <label className="ox-agent__label" htmlFor="x-dm-text">
                  Message
                </label>
                <textarea
                  id="x-dm-text"
                  className="ox-agent__input"
                  rows={3}
                  style={{ width: "100%", marginBottom: 10, resize: "vertical" }}
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                  placeholder="DM text…"
                />
                <div className="ox-agent__btn-row">
                  <button
                    type="button"
                    className="ox-agent__btn ox-agent__btn--primary"
                    disabled={dmBusy}
                    onClick={onSendDm}
                  >
                    {dmBusy ? "Sending…" : "Send DM"}
                  </button>
                  <button type="button" className="ox-agent__btn" disabled={dmBusy} onClick={onLoadDmInbox}>
                    Check inbox
                  </button>
                </div>
                {dmNote && <p className="ox-agent__note">{dmNote}</p>}
              </>
            ) : (
              <>
                <p className="ox-agent__note" style={{ marginTop: 0 }}>
                  Connect X with tweet + DM scopes so Claude/ChatGPT can post and message through this MCP.
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

      {tab === "agent" && (
        <div className="ox-agent__grid ox-agent__grid--2">
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Agent</h2>
              <span className="ox-agent__panel-hint">NVIDIA NIM</span>
            </div>
            <div className="ox-agent__panel-b">
              {!xAgent ? (
                <p className="ox-agent__note">Loading agent…</p>
              ) : (
                <>
                  <label className="ox-agent__label" htmlFor="xa-name">
                    Name
                  </label>
                  <input
                    id="xa-name"
                    className="ox-agent__input"
                    style={{ width: "100%", marginBottom: 10 }}
                    value={xAgent.name}
                    onChange={(e) => setXAgent({ ...xAgent, name: e.target.value })}
                  />
                  <label className="ox-agent__label" htmlFor="xa-persona">
                    Persona
                  </label>
                  <textarea
                    id="xa-persona"
                    className="ox-agent__input"
                    rows={5}
                    style={{ width: "100%", marginBottom: 10, resize: "vertical" }}
                    value={xAgent.persona}
                    onChange={(e) => setXAgent({ ...xAgent, persona: e.target.value })}
                    placeholder="System voice / persona for generated posts"
                  />
                  <label className="ox-agent__label" htmlFor="xa-voice">
                    Voice notes
                  </label>
                  <textarea
                    id="xa-voice"
                    className="ox-agent__input"
                    rows={2}
                    style={{ width: "100%", marginBottom: 10, resize: "vertical" }}
                    value={xAgent.voiceNotes}
                    onChange={(e) => setXAgent({ ...xAgent, voiceNotes: e.target.value })}
                  />
                  <label className="ox-agent__label" htmlFor="xa-model">
                    Model
                  </label>
                  <select
                    id="xa-model"
                    className="ox-agent__input"
                    style={{ width: "100%", marginBottom: 10 }}
                    value={xAgent.model}
                    onChange={(e) => setXAgent({ ...xAgent, model: e.target.value })}
                  >
                    {(models.length ? models : [{ id: xAgent.model, label: xAgent.model }]).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <label className="ox-agent__label" htmlFor="xa-topics">
                    Topics (comma-separated)
                  </label>
                  <input
                    id="xa-topics"
                    className="ox-agent__input"
                    style={{ width: "100%", marginBottom: 10 }}
                    value={topicsText}
                    onChange={(e) => setTopicsText(e.target.value)}
                  />
                  <div className="ox-agent__btn-row" style={{ marginBottom: 10 }}>
                    <label className="ox-agent__note" style={{ margin: 0 }}>
                      Mode{" "}
                      <select
                        className="ox-agent__input"
                        value={xAgent.mode}
                        onChange={(e) =>
                          setXAgent({
                            ...xAgent,
                            mode: e.target.value === "auto" ? "auto" : "approve",
                          })
                        }
                      >
                        <option value="approve">Approve first</option>
                        <option value="auto">Auto post</option>
                      </select>
                    </label>
                    <label className="ox-agent__note" style={{ margin: 0 }}>
                      Max/day{" "}
                      <input
                        className="ox-agent__input"
                        type="number"
                        min={0}
                        max={48}
                        style={{ width: 72 }}
                        value={xAgent.maxPostsPerDay}
                        onChange={(e) =>
                          setXAgent({
                            ...xAgent,
                            maxPostsPerDay: Math.max(0, Math.min(48, Number(e.target.value) || 0)),
                          })
                        }
                      />
                    </label>
                    <label className="ox-agent__note" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={xAgent.enabled}
                        onChange={(e) => setXAgent({ ...xAgent, enabled: e.target.checked })}
                      />{" "}
                      Enabled (cron)
                    </label>
                  </div>
                  <p className="ox-agent__note">
                    <code>approve</code> drafts to Queue · <code>auto</code> generates and posts in windows
                    (cron every minute). Needs <code>NVIDIA_API_KEY</code> on Vercel.
                  </p>
                  <div className="ox-agent__btn-row">
                    <button
                      type="button"
                      className="ox-agent__btn ox-agent__btn--primary"
                      disabled={agentBusy}
                      onClick={onSaveAgent}
                    >
                      {agentBusy ? "Saving…" : "Save agent"}
                    </button>
                    <button type="button" className="ox-agent__btn" disabled={connectingX} onClick={onConnectX}>
                      Reconnect X for DMs
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Train & generate</h2>
              <span className="ox-agent__panel-hint">knowledge</span>
            </div>
            <div className="ox-agent__panel-b">
              <label className="ox-agent__label" htmlFor="xa-ktitle">
                Knowledge title
              </label>
              <input
                id="xa-ktitle"
                className="ox-agent__input"
                style={{ width: "100%", marginBottom: 8 }}
                value={trainTitle}
                onChange={(e) => setTrainTitle(e.target.value)}
              />
              <label className="ox-agent__label" htmlFor="xa-kbody">
                Content
              </label>
              <textarea
                id="xa-kbody"
                className="ox-agent__input"
                rows={4}
                style={{ width: "100%", marginBottom: 10, resize: "vertical" }}
                value={trainContent}
                onChange={(e) => setTrainContent(e.target.value)}
                placeholder="Facts, product points, voice examples…"
              />
              <div className="ox-agent__btn-row">
                <button
                  type="button"
                  className="ox-agent__btn"
                  disabled={agentBusy || !trainContent.trim()}
                  onClick={onTrain}
                >
                  Add knowledge
                </button>
              </div>
              {knowledge.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {knowledge.slice(0, 8).map((k) => (
                    <div key={k.id} className="ox-agent__keyline">
                      <div>
                        <div className="ox-agent__value ox-agent__value--plain">{k.title}</div>
                        <div className="ox-agent__panel-hint" style={{ marginTop: 4 }}>
                          {k.content.slice(0, 120)}
                          {k.content.length > 120 ? "…" : ""}
                        </div>
                      </div>
                      <span />
                    </div>
                  ))}
                </div>
              )}
              <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.08)", margin: "1rem 0" }} />
              <label className="ox-agent__label" htmlFor="xa-hint">
                Generate hint (optional)
              </label>
              <input
                id="xa-hint"
                className="ox-agent__input"
                style={{ width: "100%", marginBottom: 10 }}
                value={genHint}
                onChange={(e) => setGenHint(e.target.value)}
                placeholder="e.g. market open vibe"
              />
              <div className="ox-agent__btn-row">
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--primary"
                  disabled={agentBusy}
                  onClick={() => onGenerate(false)}
                >
                  {agentBusy ? "Working…" : "Generate now"}
                </button>
                <button
                  type="button"
                  className="ox-agent__btn"
                  disabled={agentBusy || !xConnected}
                  onClick={() => onGenerate(true)}
                >
                  Generate + post
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => setTab("queue")}>
                  Open queue
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "queue" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Queue</h2>
            <span className="ox-agent__panel-hint">drafts · scheduled</span>
          </div>
          <div className="ox-agent__panel-b">
            <div className="ox-agent__btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
              <button type="button" className="ox-agent__btn" disabled={agentBusy} onClick={() => refreshQueue()}>
                Refresh
              </button>
              <button type="button" className="ox-agent__btn" onClick={() => setTab("agent")}>
                Back to agent
              </button>
            </div>
            {queue.length === 0 ? (
              <p className="ox-agent__note">No queue items yet. Generate from Agent or schedule via MCP.</p>
            ) : (
              queue.map((item) => {
                const text = String(item.payload?.text || "");
                const canAct = ["pending", "scheduled", "approved"].includes(item.status);
                return (
                  <div key={item.id} className="ox-agent__keyline" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ox-agent__panel-hint">
                        {item.status} · {item.kind}
                        {item.scheduledFor ? ` · ${new Date(item.scheduledFor).toLocaleString()}` : ""}
                        {item.source ? ` · ${item.source}` : ""}
                      </div>
                      <div className="ox-agent__value ox-agent__value--plain" style={{ whiteSpace: "pre-wrap" }}>
                        {text || "(empty)"}
                      </div>
                      {item.postedTweetId && (
                        <a
                          className="ox-agent__note"
                          href={`https://x.com/i/web/status/${item.postedTweetId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Posted {item.postedTweetId}
                        </a>
                      )}
                      {item.error && <div className="ox-agent__alert" style={{ marginTop: 8 }}>{item.error}</div>}
                    </div>
                    <div className="ox-agent__actions" style={{ flexDirection: "column", gap: 6 }}>
                      {canAct && (
                        <button
                          type="button"
                          className="ox-agent__btn ox-agent__btn--primary"
                          disabled={agentBusy}
                          onClick={() => onApproveQueue(item.id)}
                        >
                          Post now
                        </button>
                      )}
                      {canAct && (
                        <button
                          type="button"
                          className="ox-agent__btn ox-agent__btn--danger"
                          disabled={agentBusy}
                          onClick={() => onCancelQueue(item.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {tab === "connect" && (
        <>
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
            {(boot?.keys || []).length > 0 && (
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
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Connect AI</h2>
            <span className="ox-agent__panel-hint">Claude · ChatGPT</span>
          </div>
          <div className="ox-agent__panel-b">
            {!xConnected && (
              <div className="ox-agent__alert" style={{ marginBottom: 12 }}>
                Connect X first — without it, posting tools will fail.
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
                  Advanced → header <code>Authorization</code> = Bearer token above
                </li>
                <li>
                  Tools: <code>x_dm</code>, <code>x_dm_inbox</code>, <code>x_post</code>, <code>x_quote</code>,{" "}
                  <code>x_reply</code>, <code>x_agent_run</code>, <code>x_agent_train</code>, …
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
            <p className="ox-agent__note">
              Env on Vercel (<code>rork-og-meme-coin-tracker</code>): <code>TWITTER_CLIENT_ID</code>,{" "}
              <code>TWITTER_CLIENT_SECRET</code>, <code>NVIDIA_API_KEY</code>, optional{" "}
              <code>NVIDIA_MODEL</code>, <code>CRON_SECRET</code>. Reconnect X after scope changes.
            </p>
          </div>
        </section>
        </>
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
