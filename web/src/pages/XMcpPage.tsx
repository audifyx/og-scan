import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { xGetStoredUser, xSetStoredUser, xStartLogin, type XUser } from "@/lib/xAuth";
import {
  approveXAgentQueueItem,
  bootstrapXMcp,
  cancelXAgentQueueItem,
  createXMcpApiKey,
  disconnectXAccount,
  fetchXAgent,
  fetchXDmInbox,
  generateXAgentPost,
  listXAgentQueue,
  listXMcpApiKeys,
  pollXAgentReplies,
  revokeXMcpApiKey,
  sendXDm,
  shortXKey,
  trainXAgent,
  upsertXAgent,
  xChatgptConnectUrl,
  xClaudeConnectUrl,
  xGrokConnectUrl,
  xMcpOAuthCredentials,
  type XAgentConfig,
  type XAgentKnowledge,
  type XAgentQueueItem,
  type XMcpBootstrap,
  type XNimModel,
} from "@/lib/xMcp";
import XMcpMatrix from "@/components/x/XMcpMatrix";
import "./x-hub.css";

type HubTab = "home" | "account" | "agent" | "queue" | "connect" | "messages" | "matrix";

const NAV: { id: HubTab; label: string; ico: string }[] = [
  { id: "home", label: "Home", ico: "⌂" },
  { id: "account", label: "Account", ico: "◎" },
  { id: "messages", label: "Messages", ico: "✉" },
  { id: "agent", label: "Agent", ico: "✦" },
  { id: "queue", label: "Queue", ico: "☰" },
  { id: "matrix", label: "Matrix", ico: "◈" },
  { id: "connect", label: "Connect", ico: "⬡" },
];

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
    <div className="xh__row">
      <div className="xh__row-label">{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div className="xh__row-value">
          {!has
            ? emptyLabel || "Create an API key first"
            : visible
              ? value
              : maskSecret(value, label.toLowerCase().includes("header") ? "header" : "key")}
        </div>
        {has && (
          <>
            <button type="button" className="xh__btn xh__btn--ghost" onClick={() => setVisible((v) => !v)}>
              {visible ? "Hide" : "View"}
            </button>
            <button type="button" className="xh__btn" onClick={onCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        )}
      </div>
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
    <div className="xh__row">
      <div className="xh__row-label">{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div className="xh__row-value">{value}</div>
        {copyable && onCopy ? (
          <button type="button" className="xh__btn" onClick={onCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function HubShell({
  tab,
  onTab,
  title,
  xHandle,
  xConnected,
  hasKey,
  agentOn,
  avatarUrl,
  onRefresh,
  onCompose,
  aside,
  children,
}: {
  tab: HubTab;
  onTab: (t: HubTab) => void;
  title: string;
  xHandle: string | null;
  xConnected: boolean;
  hasKey?: boolean;
  agentOn?: boolean;
  avatarUrl?: string | null;
  onRefresh?: () => void;
  onCompose?: () => void;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const initial = (xHandle || "X").slice(0, 1).toUpperCase();
  return (
    <div className="xh">
      <div className="xh__shell">
        <aside className="xh__left">
          <Link to="/x" className="xh__brand">
            <span className="xh__brand-mark">X</span>
            <span className="xh__brand-text">
              <span className="xh__brand-title">OrbitX</span>
              <span className="xh__brand-sub">X Hub</span>
            </span>
          </Link>
          <nav className="xh__nav" aria-label="X hub">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`xh__nav-btn${tab === n.id ? " is-active" : ""}`}
                onClick={() => onTab(n.id)}
              >
                <span className="xh__nav-ico" aria-hidden>
                  {n.ico}
                </span>
                <span className="xh__nav-label">{n.label}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="xh__compose" onClick={onCompose}>
            <span className="xh__compose-label">Post</span>
          </button>
          <div className="xh__left-foot">
            <div className="xh__avatar-row">
              <div className="xh__avatar">
                {avatarUrl ? <img src={avatarUrl} alt="" decoding="async" /> : initial}
              </div>
              <div className="xh__avatar-meta">
                <div className="xh__avatar-name">{xConnected ? `@${xHandle}` : "Not connected"}</div>
                <div className="xh__avatar-handle">{xConnected ? "X linked" : "Connect X"}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="xh__center">
          <header className="xh__top">
            <h1>{title}</h1>
            <div className="xh__top-actions">
              {onRefresh ? (
                <button type="button" className="xh__icon-btn" onClick={onRefresh} title="Refresh" aria-label="Refresh">
                  ↻
                </button>
              ) : null}
              <Link to="/agent" className="xh__icon-btn" title="Agent MCP" aria-label="Agent MCP">
                ◆
              </Link>
            </div>
          </header>
          <div className="xh__mobile-status" aria-label="Status">
            <span className={`xh__chip${xConnected ? " is-ok" : " is-warn"}`}>
              {xConnected ? `@${xHandle}` : "X off"}
            </span>
            <span className={`xh__chip${hasKey ? " is-ok" : ""}`}>{hasKey ? "Key" : "No key"}</span>
            <span className={`xh__chip${agentOn ? " is-ok" : ""}`}>{agentOn ? "Agent on" : "Agent off"}</span>
          </div>
          {children}
        </main>

        <aside className="xh__right">{aside}</aside>
      </div>
    </div>
  );
}

/** /x — X-inspired MCP hub */
export default function XMcpPage() {
  const { user, loading: authLoading } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const [tab, setTab] = useState<HubTab>("home");
  const [boot, setBoot] = useState<XMcpBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("Claude / ChatGPT X");
  const [creating, setCreating] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [oauthGuide, setOauthGuide] = useState<"chatgpt" | "grok" | null>(null);
  const [setupOpen, setSetupOpen] = useState<"claude" | "chatgpt" | "grok">("claude");
  const [xLocal, setXLocal] = useState<XUser | null>(() => xGetStoredUser());
  const [connectingX, setConnectingX] = useState(false);
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
  const avatarUrl = boot?.x?.avatar || xLocal?.profileImageUrl || null;

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
      // Don't block the shell on secondary loads
      void Promise.allSettled([refreshAgent(), refreshQueue()]);
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

  // Hard cap: never leave mobile users on the spinner forever
  useEffect(() => {
    if (!loading && !authLoading) return;
    const t = window.setTimeout(() => {
      setLoading(false);
      setError((prev) => prev || "Taking longer than usual — tap refresh or continue.");
    }, 14000);
    return () => window.clearTimeout(t);
  }, [loading, authLoading]);

  useEffect(() => {
    const onX = () => setXLocal(xGetStoredUser());
    window.addEventListener("x-auth-changed", onX);
    return () => window.removeEventListener("x-auth-changed", onX);
  }, []);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Copy failed — long-press to select instead");
    }
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
        autoReplyMentions: Boolean(xAgent.autoReplyMentions),
        autoReplyDms: Boolean(xAgent.autoReplyDms),
        autoReplyGroupDms: Boolean(xAgent.autoReplyGroupDms),
        maxRepliesPerDay: xAgent.maxRepliesPerDay ?? 30,
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
      if (!postNow) setTab("queue");
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
        setDmNote(n ? `${n} recent DM event(s)` : "Inbox empty");
      }
    } catch (e) {
      setDmNote(e instanceof Error ? e.message : "Inbox failed");
    } finally {
      setDmBusy(false);
    }
  };

  const title =
    tab === "home"
      ? "Home"
      : tab === "account"
        ? "Account"
        : tab === "messages"
          ? "Messages"
          : tab === "agent"
            ? "Agent"
            : tab === "queue"
              ? "Queue"
              : tab === "matrix"
                ? "Matrix"
                : "Connect";

  const aside = (
    <>
      <div className="xh__aside-card">
        <h2>Status</h2>
        <div className="xh__trend">
          <div className="xh__trend-k">X account</div>
          <div className="xh__trend-v">{xConnected ? `@${xHandle}` : "Not connected"}</div>
        </div>
        <div className="xh__trend">
          <div className="xh__trend-k">API key</div>
          <div className="xh__trend-v">{hasKey ? "Ready" : "Create one"}</div>
        </div>
        <div className="xh__trend">
          <div className="xh__trend-k">Agent</div>
          <div className="xh__trend-v">
            {xAgent?.enabled ? `${xAgent.mode} · on` : xAgent ? `${xAgent.mode} · off` : "—"}
          </div>
        </div>
        <div className="xh__trend">
          <div className="xh__trend-k">Queue</div>
          <div className="xh__trend-v">{queue.length} items</div>
        </div>
      </div>
      <div className="xh__aside-card">
        <h2>MCP</h2>
        <p className="xh__note" style={{ marginTop: 0 }}>
          Post, quote, reply, DM, and run your NVIDIA agent from Claude, ChatGPT, or Grok.
        </p>
        <div className="xh__btn-row">
          <button type="button" className="xh__btn xh__btn--primary" onClick={() => setTab("connect")}>
            Wire AI
          </button>
          <button type="button" className="xh__btn" onClick={() => copy("mcp", oauth.mcpUrl)}>
            {copied === "mcp" ? "Copied" : "Copy URL"}
          </button>
        </div>
      </div>
    </>
  );

  // Show the shell as soon as auth resolves; bootstrap may still finish in background
  if (authLoading && !user) {
    return (
      <div className="xh__loading">
        <div>
          <div className="xh__spinner" />
          <div>Opening X Hub…</div>
          <p>If this stalls, refresh the page.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <HubShell
        tab="home"
        onTab={() => undefined}
        title="OrbitX · X"
        xHandle={null}
        xConnected={false}
        hasKey={false}
        agentOn={false}
        onCompose={() => undefined}
        aside={
          <div className="xh__aside-card">
            <h2>Welcome</h2>
            <p className="xh__note" style={{ marginTop: 0 }}>
              Sign in with your wallet to connect X and MCP tools.
            </p>
          </div>
        }
      >
        <div className="xh__section-pad">
          <strong style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            OrbitX
          </strong>
          <p className="xh__note">Connect X. Train an agent. Post from Claude.</p>
          <div className="xh__btn-row">
            {pickable.slice(0, 4).map((w) => (
              <button
                key={w.name}
                type="button"
                className="xh__btn xh__btn--primary"
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
          <p className="xh__note">
            Or{" "}
            <Link to="/auth?next=/x" style={{ color: "var(--xh-accent)", fontWeight: 700 }}>
              sign in with email
            </Link>
            .
          </p>
          {error && <div className="xh__alert">{error}</div>}
        </div>
      </HubShell>
    );
  }

  return (
    <HubShell
      tab={tab}
      onTab={setTab}
      title={title}
      xHandle={xHandle}
      xConnected={xConnected}
      hasKey={hasKey}
      agentOn={Boolean(xAgent?.enabled)}
      avatarUrl={avatarUrl}
      onRefresh={refresh}
      onCompose={() => setTab("home")}
      aside={aside}
    >
      {loading && (
        <div className="xh__section-pad" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="xh__spinner" style={{ margin: 0 }} />
          <span className="xh__note" style={{ margin: 0 }}>
            Syncing account…
          </span>
        </div>
      )}
      {error && <div className="xh__alert">{error}</div>}

      {tab === "home" && (
        <>
          <div className="xh__composer">
            <div className="xh__avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : (xHandle || "X").slice(0, 1).toUpperCase()}</div>
            <div>
              <textarea
                value={genHint}
                onChange={(e) => setGenHint(e.target.value)}
                placeholder={xConnected ? "What's happening?" : "Connect X to start posting…"}
              />
              <div className="xh__composer-bar">
                <div className="xh__chip-row">
                  <span className={`xh__chip${xConnected ? " is-ok" : " is-warn"}`}>
                    {xConnected ? `@${xHandle}` : "Connect X"}
                  </span>
                  <span className={`xh__chip${hasKey ? " is-ok" : ""}`}>
                    {hasKey ? "Key ready" : "Need key"}
                  </span>
                  <span className={`xh__chip${xAgent?.enabled ? " is-ok" : ""}`}>
                    {xAgent?.enabled ? "Agent on" : "Agent off"}
                  </span>
                </div>
                <div className="xh__btn-row" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="xh__btn"
                    disabled={agentBusy || !xConnected}
                    onClick={() => onGenerate(false)}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    className="xh__btn xh__btn--primary"
                    disabled={agentBusy || !xConnected}
                    onClick={() => onGenerate(true)}
                  >
                    {agentBusy ? "…" : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="xh__feed">
            {!xConnected && (
              <div className="xh__card">
                <div className="xh__card-title">Connect your X account</div>
                <p className="xh__note">Link X so Claude can post, reply, quote, and DM as you.</p>
                <div className="xh__card-actions">
                  <button type="button" className="xh__btn xh__btn--primary" disabled={connectingX} onClick={onConnectX}>
                    {connectingX ? "Redirecting…" : "Connect X"}
                  </button>
                </div>
              </div>
            )}
            {!hasKey && (
              <div className="xh__card">
                <div className="xh__card-title">Create an MCP key</div>
                <p className="xh__note">Claude and ChatGPT use this bearer token to call X tools.</p>
                <div className="xh__card-actions">
                  <button type="button" className="xh__btn xh__btn--ox" onClick={() => setTab("connect")}>
                    Open Connect
                  </button>
                </div>
              </div>
            )}
            {queue.slice(0, 6).map((item) => {
              const text = String(item.payload?.text || "");
              return (
                <article key={item.id} className="xh__card">
                  <div className="xh__card-h">
                    <div className="xh__card-title">{item.kind}</div>
                    <div className="xh__card-meta">
                      {item.status}
                      {item.source ? ` · ${item.source}` : ""}
                    </div>
                  </div>
                  <div className="xh__card-body">{text || "(empty)"}</div>
                  {["pending", "scheduled", "approved"].includes(item.status) && (
                    <div className="xh__card-actions">
                      <button
                        type="button"
                        className="xh__btn xh__btn--primary"
                        disabled={agentBusy}
                        onClick={() => onApproveQueue(item.id)}
                      >
                        Post now
                      </button>
                      <button
                        type="button"
                        className="xh__btn xh__btn--danger"
                        disabled={agentBusy}
                        onClick={() => onCancelQueue(item.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
            {queue.length === 0 && xConnected && (
              <div className="xh__empty">
                <strong>Your queue is empty</strong>
                Draft with the composer or train the agent to auto-post.
              </div>
            )}
          </div>
        </>
      )}

      {tab === "account" && (
        <div className="xh__section-pad">
          {xConnected ? (
            <>
              <div className="xh__avatar-row" style={{ marginBottom: 16 }}>
                <div className="xh__avatar" style={{ width: 64, height: 64, fontSize: "1.4rem" }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : (xHandle || "X").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="xh__avatar-name" style={{ fontSize: "1.25rem" }}>
                    @{xHandle}
                  </div>
                  <div className="xh__avatar-handle">{boot?.x?.displayName || xLocal?.displayName || "X account"}</div>
                </div>
              </div>
              {boot?.x?.scopes != null && boot.x.hasTweetWrite === false && (
                <div className="xh__alert">
                  No write permission on this token (missing tweet.write). Revoke OrbitX at x.com/settings/connected_apps,
                  stay signed in here, then Reconnect once. Tokens now refresh automatically — you should not need to
                  re-auth every session.
                </div>
              )}
              {boot?.x?.hasTweetWrite === true && (
                <p className="xh__note">
                  Write OK: tweet.write{boot.x.hasDmWrite ? " + dm.write" : ""}. Refresh is automatic — reconnect only if
                  posting fails with 403.
                </p>
              )}
              {boot?.x?.scopes ? (
                <p className="xh__note" style={{ fontFamily: "var(--xh-mono)", fontSize: "0.75rem" }}>
                  Granted: {boot.x.scopes}
                </p>
              ) : null}
              <div className="xh__btn-row">
                <button type="button" className="xh__btn xh__btn--primary" disabled={connectingX} onClick={onConnectX}>
                  {connectingX ? "Redirecting…" : "Reconnect X"}
                </button>
                <button type="button" className="xh__btn" onClick={() => setTab("matrix")}>
                  Open Matrix
                </button>
                <button
                  type="button"
                  className="xh__btn xh__btn--danger"
                  disabled={connectingX}
                  onClick={async () => {
                    try {
                      await disconnectXAccount();
                      xSetStoredUser(null);
                      window.dispatchEvent(new CustomEvent("x-auth-changed"));
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Disconnect failed");
                    }
                  }}
                >
                  Clear token
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="xh__note" style={{ marginTop: 0 }}>
                Connect your X account so Claude or ChatGPT can post, reply, and DM through this MCP.
              </p>
              <div className="xh__btn-row">
                <button type="button" className="xh__btn xh__btn--primary" disabled={connectingX} onClick={onConnectX}>
                  {connectingX ? "Redirecting…" : "Connect X"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "messages" && (
        <div className="xh__section-pad">
          <div className="xh__field">
            <label htmlFor="xh-dm-user">To</label>
            <input
              id="xh-dm-user"
              className="xh__input"
              value={dmUser}
              onChange={(e) => setDmUser(e.target.value)}
              placeholder="@username"
            />
          </div>
          <div className="xh__field">
            <label htmlFor="xh-dm-text">Message</label>
            <textarea
              id="xh-dm-text"
              className="xh__textarea"
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
              placeholder="Write a DM…"
            />
          </div>
          <div className="xh__btn-row">
            <button type="button" className="xh__btn xh__btn--primary" disabled={dmBusy || !xConnected} onClick={onSendDm}>
              {dmBusy ? "Sending…" : "Send DM"}
            </button>
            <button type="button" className="xh__btn" disabled={dmBusy || !xConnected} onClick={onLoadDmInbox}>
              Check inbox
            </button>
          </div>
          {dmNote && <p className="xh__note">{dmNote}</p>}
          <p className="xh__note">MCP tools: x_dm · x_dm_inbox</p>
        </div>
      )}

      {tab === "agent" && (
        <>
          <div className="xh__section-pad">
            {!xAgent ? (
              <p className="xh__note">Loading agent…</p>
            ) : (
              <>
                <div className="xh__field">
                  <label htmlFor="xh-name">Name</label>
                  <input
                    id="xh-name"
                    className="xh__input"
                    value={xAgent.name}
                    onChange={(e) => setXAgent({ ...xAgent, name: e.target.value })}
                  />
                </div>
                <div className="xh__field">
                  <label htmlFor="xh-persona">Persona</label>
                  <textarea
                    id="xh-persona"
                    className="xh__textarea"
                    value={xAgent.persona}
                    onChange={(e) => setXAgent({ ...xAgent, persona: e.target.value })}
                    placeholder="Voice & rules for generated posts"
                  />
                </div>
                <div className="xh__field">
                  <label htmlFor="xh-voice">Voice notes</label>
                  <textarea
                    id="xh-voice"
                    className="xh__textarea"
                    style={{ minHeight: 72 }}
                    value={xAgent.voiceNotes}
                    onChange={(e) => setXAgent({ ...xAgent, voiceNotes: e.target.value })}
                  />
                </div>
                <div className="xh__field">
                  <label htmlFor="xh-model">Model</label>
                  <select
                    id="xh-model"
                    className="xh__select"
                    value={xAgent.model}
                    onChange={(e) => setXAgent({ ...xAgent, model: e.target.value })}
                  >
                    {(models.length ? models : [{ id: xAgent.model, label: xAgent.model }]).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="xh__field">
                  <label htmlFor="xh-topics">Topics</label>
                  <input
                    id="xh-topics"
                    className="xh__input"
                    value={topicsText}
                    onChange={(e) => setTopicsText(e.target.value)}
                    placeholder="crypto, product, markets"
                  />
                </div>
                <div className="xh__btn-row">
                  <label className="xh__check">
                    Mode{" "}
                    <select
                      className="xh__select"
                      style={{ width: "auto" }}
                      value={xAgent.mode}
                      onChange={(e) =>
                        setXAgent({ ...xAgent, mode: e.target.value === "auto" ? "auto" : "approve" })
                      }
                    >
                      <option value="approve">Approve first</option>
                      <option value="auto">Auto post</option>
                    </select>
                  </label>
                  <label className="xh__check">
                    Max/day{" "}
                    <input
                      className="xh__input"
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
                  <label className="xh__check">
                    <input
                      type="checkbox"
                      checked={xAgent.enabled}
                      onChange={(e) => setXAgent({ ...xAgent, enabled: e.target.checked })}
                    />{" "}
                    Enabled
                  </label>
                </div>
                <div className="xh__card-title" style={{ margin: "16px 0 8px" }}>
                  Auto-reply
                </div>
                <p style={{ marginBottom: 10, fontSize: 12, color: "var(--xh-muted)" }}>
                  Trained agent answers mentions, DMs, and group chats. Approve mode queues drafts; Auto
                  posts/sends. Needs X API access for mentions/DMs.
                </p>
                <div className="xh__btn-row">
                  <label className="xh__check">
                    <input
                      type="checkbox"
                      checked={Boolean(xAgent.autoReplyMentions)}
                      onChange={(e) => setXAgent({ ...xAgent, autoReplyMentions: e.target.checked })}
                    />{" "}
                    Mentions / replies
                  </label>
                  <label className="xh__check">
                    <input
                      type="checkbox"
                      checked={Boolean(xAgent.autoReplyDms)}
                      onChange={(e) => setXAgent({ ...xAgent, autoReplyDms: e.target.checked })}
                    />{" "}
                    1:1 DMs
                  </label>
                  <label className="xh__check">
                    <input
                      type="checkbox"
                      checked={Boolean(xAgent.autoReplyGroupDms)}
                      onChange={(e) => setXAgent({ ...xAgent, autoReplyGroupDms: e.target.checked })}
                    />{" "}
                    Group DMs
                  </label>
                  <label className="xh__check">
                    Max replies/day{" "}
                    <input
                      className="xh__input"
                      type="number"
                      min={0}
                      max={200}
                      style={{ width: 72 }}
                      value={xAgent.maxRepliesPerDay ?? 30}
                      onChange={(e) =>
                        setXAgent({
                          ...xAgent,
                          maxRepliesPerDay: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="xh__btn-row">
                  <button type="button" className="xh__btn xh__btn--primary" disabled={agentBusy} onClick={onSaveAgent}>
                    {agentBusy ? "Saving…" : "Save agent"}
                  </button>
                  <button
                    type="button"
                    className="xh__btn"
                    disabled={agentBusy}
                    onClick={async () => {
                      setAgentBusy(true);
                      setError(null);
                      try {
                        await pollXAgentReplies();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Poll failed");
                      } finally {
                        setAgentBusy(false);
                      }
                    }}
                  >
                    Poll replies now
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="xh__section-pad">
            <div className="xh__card-title" style={{ marginBottom: 12 }}>
              Train
            </div>
            <div className="xh__field">
              <label htmlFor="xh-ktitle">Title</label>
              <input
                id="xh-ktitle"
                className="xh__input"
                value={trainTitle}
                onChange={(e) => setTrainTitle(e.target.value)}
              />
            </div>
            <div className="xh__field">
              <label htmlFor="xh-kbody">Knowledge</label>
              <textarea
                id="xh-kbody"
                className="xh__textarea"
                value={trainContent}
                onChange={(e) => setTrainContent(e.target.value)}
                placeholder="Facts, product points, voice examples…"
              />
            </div>
            <div className="xh__btn-row">
              <button
                type="button"
                className="xh__btn"
                disabled={agentBusy || !trainContent.trim()}
                onClick={onTrain}
              >
                Add knowledge
              </button>
              <button type="button" className="xh__btn xh__btn--ox" disabled={agentBusy} onClick={() => onGenerate(false)}>
                Generate draft
              </button>
            </div>
            {knowledge.slice(0, 8).map((k) => (
              <div key={k.id} className="xh__row">
                <div>
                  <div className="xh__card-title">{k.title}</div>
                  <div className="xh__note">
                    {k.content.slice(0, 120)}
                    {k.content.length > 120 ? "…" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "queue" && (
        <div className="xh__feed">
          <div className="xh__section-pad" style={{ borderBottom: "1px solid var(--xh-line)" }}>
            <div className="xh__btn-row" style={{ marginTop: 0 }}>
              <button type="button" className="xh__btn" disabled={agentBusy} onClick={() => refreshQueue()}>
                Refresh
              </button>
              <button type="button" className="xh__btn" onClick={() => setTab("home")}>
                Composer
              </button>
            </div>
          </div>
          {queue.length === 0 ? (
            <div className="xh__empty">
              <strong>No drafts yet</strong>
              Generate from Home or Agent.
            </div>
          ) : (
            queue.map((item) => {
              const text = String(item.payload?.text || "");
              const canAct = ["pending", "scheduled", "approved"].includes(item.status);
              return (
                <article key={item.id} className="xh__card">
                  <div className="xh__card-h">
                    <div className="xh__card-title">{item.kind}</div>
                    <div className="xh__card-meta">
                      {item.status}
                      {item.scheduledFor ? ` · ${new Date(item.scheduledFor).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <div className="xh__card-body">{text || "(empty)"}</div>
                  {item.postedTweetId && (
                    <a
                      className="xh__note"
                      href={`https://x.com/i/web/status/${item.postedTweetId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View post →
                    </a>
                  )}
                  {item.error && <div className="xh__alert">{item.error}</div>}
                  {canAct && (
                    <div className="xh__card-actions">
                      <button
                        type="button"
                        className="xh__btn xh__btn--primary"
                        disabled={agentBusy}
                        onClick={() => onApproveQueue(item.id)}
                      >
                        Post now
                      </button>
                      <button
                        type="button"
                        className="xh__btn xh__btn--danger"
                        disabled={agentBusy}
                        onClick={() => onCancelQueue(item.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {tab === "matrix" && (
        <div className="xh__section-pad">
          <XMcpMatrix
            xConnected={xConnected}
            hasTweetWrite={boot?.x?.hasTweetWrite}
            hasDmWrite={boot?.x?.hasDmWrite}
            hasKey={hasKey}
          />
        </div>
      )}

      {tab === "connect" && (
        <>
          <div className="xh__section-pad">
            <div className="xh__card-title" style={{ marginBottom: 12 }}>
              API keys
            </div>
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
                {showKeyPanel && <p className="xh__note">New key ready — copy into connector headers.</p>}
              </>
            )}
            <div className="xh__btn-row">
              <input
                className="xh__input"
                style={{ flex: 1 }}
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Key label"
              />
              <button type="button" className="xh__btn xh__btn--primary" disabled={creating} onClick={onCreateKey}>
                {creating ? "Creating…" : "Create key"}
              </button>
            </div>
            {(boot?.keys || []).map((k) => (
              <div key={k.id} className="xh__row">
                <div>
                  <div className="xh__card-title">{k.name}</div>
                  <div className="xh__note">
                    {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <button type="button" className="xh__btn xh__btn--danger" onClick={() => onRevoke(k.id)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>

          <div className="xh__section-pad">
            <div className="xh__card-title" style={{ marginBottom: 12 }}>
              Connect AI
            </div>
            {!xConnected && (
              <div className="xh__alert">Connect X first — without it, posting tools will fail.</div>
            )}
            <div className="xh__btn-row">
              <button
                type="button"
                className="xh__btn xh__btn--primary"
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
                className="xh__btn"
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
                  window.open(xChatgptConnectUrl(), "_blank", "noopener,noreferrer");
                }}
              >
                Add to ChatGPT
              </button>
              <button
                type="button"
                className="xh__btn xh__btn--ox"
                onClick={async () => {
                  await copy("grokMcp", oauth.mcpUrl);
                  setOauthGuide(null);
                  setSetupOpen("grok");
                  window.open(xGrokConnectUrl(), "_blank", "noopener,noreferrer");
                }}
              >
                Add to Grok
              </button>
            </div>
            <div className="xh__chip-row" style={{ marginTop: 12 }}>
              {(
                [
                  ["claude", "Claude"],
                  ["chatgpt", "ChatGPT"],
                  ["grok", "Grok"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`xh__chip${setupOpen === id ? " is-ok" : ""}`}
                  onClick={() => setSetupOpen(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {setupOpen === "claude" && (
              <ol className="xh__note" style={{ paddingLeft: "1.2rem" }}>
                <li>MCP URL must end in /mcp</li>
                <li>Client ID orbitx-x-mcp, secret blank</li>
                <li>Authenticate → approve on /x/mcp-auth</li>
              </ol>
            )}
            {setupOpen === "chatgpt" && (
              <ol className="xh__note" style={{ paddingLeft: "1.2rem" }}>
                <li>Developer Mode on (Apps & Connectors → Advanced)</li>
                <li>Custom connector with MCP URL + OAuth fields</li>
                <li>Authenticate → approve on OrbitX /x</li>
              </ol>
            )}
            {setupOpen === "grok" && (
              <ol className="xh__note" style={{ paddingLeft: "1.2rem" }}>
                <li>
                  Open <code>grok.com/connectors</code> → New Connector → Custom
                </li>
                <li>Paste only the MCP URL below</li>
                <li>
                  In chat say: <em>authenticate my OrbitX account</em>
                </li>
                <li>Grok sends a link → open it → Authorize Grok → tell Grok you&apos;re done</li>
              </ol>
            )}
            {copied === "grokMcp" && setupOpen === "grok" && (
              <p className="xh__note">MCP URL copied — after connecting, ask Grok to authenticate for a link.</p>
            )}
            <p className="xh__note">
              {setupOpen === "grok"
                ? "Best path: ask Grok to authenticate — it calls x_auth_link and gives you a clickable OrbitX URL."
                : "Tools: search/fetch, x_post, x_dm, x_agent_run, … Claude/ChatGPT use OAuth fields; Grok uses MCP URL + chat auth link."}
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
        </>
      )}

      {oauthGuide === "chatgpt" && (
        <div className="xh__modal" onClick={() => setOauthGuide(null)}>
          <div className="xh__modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>ChatGPT · X MCP</h2>
            <p className="xh__note" style={{ marginTop: 0 }}>
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
              <FieldRow key={id} label={label} value={value} copied={copied === id} onCopy={() => copy(id, value)} />
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
              className="xh__btn xh__btn--primary"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => setOauthGuide(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </HubShell>
  );
}
