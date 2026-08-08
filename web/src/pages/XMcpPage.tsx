import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { PLATFORM_WALLET } from "@/lib/platformFee";
import { xGetStoredUser, xSetStoredUser, xStartLogin, type XUser } from "@/lib/xAuth";
import {
  approveXAgentQueueItem,
  bootstrapXMcp,
  cancelXAgentQueueItem,
  confirmXCreditsPurchase,
  createXMcpApiKey,
  disconnectXAccount,
  fetchXAgent,
  fetchXCreditsUsage,
  fetchXDmInbox,
  generateXAgentPost,
  listXAgentQueue,
  listXMcpApiKeys,
  pollXAgentReplies,
  quoteXCreditsBuy,
  revokeXMcpApiKey,
  sendXDm,
  shortXKey,
  trainXAgent,
  upsertXAgent,
  mintXMcpChatAuth,
  xChatgptConnectUrl,
  xClaudeConnectUrl,
  xGrokConnectUrl,
  xMcpOAuthCredentials,
  type XAgentConfig,
  type XAgentKnowledge,
  type XAgentQueueItem,
  type XCreditsUsage,
  type XMcpBootstrap,
  type XMcpChatAuthMint,
  type XNimModel,
} from "@/lib/xMcp";
import { AgentLoading, AgentShell, type ShellTab } from "@/components/agent/AgentShell";
import XMcpMatrix from "@/components/x/XMcpMatrix";
import "./x-hub.css";

/** Bottom tabs — Usage is the shop + advanced credits ledger. */
type XTab = "home" | "usage" | "account" | "keys" | "connect";
type HomeSub = "post" | "agent" | "queue" | "messages" | "matrix";

const X_TABS: ShellTab[] = [
  { id: "home", label: "Home", ico: "⌂" },
  { id: "usage", label: "Usage", ico: "◈" },
  { id: "account", label: "Account", ico: "◎" },
  { id: "keys", label: "Keys", ico: "✦" },
  { id: "connect", label: "Connect", ico: "⬡" },
];

const VALID_TABS = new Set<XTab>(["home", "usage", "account", "keys", "connect"]);

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
      ) : null}
    </div>
  );
}

/** /x — same AgentShell UI as /agent, X MCP content */
export default function XMcpPage() {
  const { user, loading: authLoading } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [searchParams, setSearchParams] = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected: walletConnected } = useWallet();

  const initialTab = (() => {
    const t = String(searchParams.get("tab") || "").toLowerCase();
    if (t === "shop" || t === "credits") return "usage" as XTab;
    return VALID_TABS.has(t as XTab) ? (t as XTab) : "home";
  })();

  const [tab, setTab] = useState<XTab>(initialTab);
  const [homeSub, setHomeSub] = useState<HomeSub>("post");
  const [boot, setBoot] = useState<XMcpBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditsUsage, setCreditsUsage] = useState<XCreditsUsage | null>(null);
  const [usagePeriod, setUsagePeriod] = useState<"24h" | "7d" | "30d" | "all">("30d");
  const [buySol, setBuySol] = useState("0.1");
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyNote, setBuyNote] = useState<string | null>(null);
  const [manualSig, setManualSig] = useState("");
  const [keyName, setKeyName] = useState("Claude / ChatGPT X");
  const [creating, setCreating] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [oauthGuide, setOauthGuide] = useState<"chatgpt" | "grok" | null>(null);
  const [setupOpen, setSetupOpen] = useState<"claude" | "chatgpt" | "grok">("claude");
  const [chatAuth, setChatAuth] = useState<XMcpChatAuthMint | null>(null);
  const [mintingAuth, setMintingAuth] = useState(false);
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

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchXCreditsUsage(50, usagePeriod);
      setCreditsUsage(data);
    } catch {
      /* table may not be migrated yet — Usage tab still explains MCP buy */
    }
  }, [user, usagePeriod]);

  useEffect(() => {
    if (tab === "usage" && user) void refreshCredits();
  }, [tab, user, usagePeriod, refreshCredits]);

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
      void Promise.allSettled([refreshAgent(), refreshQueue(), refreshCredits()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load X MCP");
    } finally {
      setLoading(false);
    }
  }, [user, refreshAgent, refreshQueue, refreshCredits]);

  const selectTab = useCallback(
    (id: string) => {
      const next = VALID_TABS.has(id as XTab) ? (id as XTab) : "home";
      setTab(next);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "home") p.delete("tab");
          else p.set("tab", next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const t = String(searchParams.get("tab") || "").toLowerCase();
    if (t === "shop" || t === "credits") {
      if (tab !== "usage") setTab("usage");
      return;
    }
    if (VALID_TABS.has(t as XTab) && t !== tab) setTab(t as XTab);
  }, [searchParams, tab]);

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

  const quotedCredits = useMemo(() => {
    const sol = Number(buySol);
    const rate = creditsUsage?.creditsPerSol || 10_000;
    if (!Number.isFinite(sol) || sol <= 0) return 0;
    return Math.floor(sol * rate);
  }, [buySol, creditsUsage?.creditsPerSol]);

  const onBuyCredits = async () => {
    setBuyBusy(true);
    setBuyNote(null);
    setError(null);
    try {
      const sol = Number(buySol);
      if (!Number.isFinite(sol) || sol < 0.001) {
        throw new Error("Enter at least 0.001 SOL");
      }
      if (!publicKey || !walletConnected || !sendTransaction) {
        throw new Error("Connect a Solana wallet first (same wallet you sign in with)");
      }
      const quote = await quoteXCreditsBuy(sol, publicKey.toBase58());
      if (!quote.ok || !quote.lamports || !quote.payTo) {
        throw new Error(quote.message || quote.error || "Could not quote purchase");
      }
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(quote.payTo || PLATFORM_WALLET),
          lamports: quote.lamports,
        }),
      );
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      const credited = await confirmXCreditsPurchase(signature);
      setBuyNote(credited.message || `+${credited.creditsAdded ?? quote.credits} credits`);
      await refreshCredits();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuyBusy(false);
    }
  };

  const onConfirmManualSig = async () => {
    setBuyBusy(true);
    setBuyNote(null);
    setError(null);
    try {
      const sig = manualSig.trim();
      if (!sig) throw new Error("Paste a transaction signature");
      const credited = await confirmXCreditsPurchase(sig);
      setBuyNote(credited.message || "Credits applied");
      setManualSig("");
      await refreshCredits();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setBuyBusy(false);
    }
  };

  const onMintChatAuth = async () => {
    setMintingAuth(true);
    setError(null);
    try {
      const minted = await mintXMcpChatAuth();
      setChatAuth(minted);
      setSetupOpen("grok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mint chat auth");
    } finally {
      setMintingAuth(false);
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

  const postCredits = useMemo(() => {
    const max = Math.max(0, Number(xAgent?.maxPostsPerDay ?? 5) || 0);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const used = queue.filter((q) => {
      const st = String(q.status || "").toLowerCase();
      if (st !== "posted" && st !== "done" && st !== "published") return false;
      const ts = q.updatedAt || q.createdAt;
      if (!ts) return false;
      return new Date(ts).getTime() >= start.getTime();
    }).length;
    const remaining = Math.max(0, max - used);
    return { max, used, remaining, pct: max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0 };
  }, [queue, xAgent?.maxPostsPerDay]);

  const replyCredits = useMemo(() => {
    const max = Math.max(0, Number(xAgent?.maxRepliesPerDay ?? 30) || 0);
    return { max, used: 0, remaining: max };
  }, [xAgent?.maxRepliesPerDay]);

  const onGenerate = async (postNow = false) => {
    if (postNow && postCredits.remaining <= 0) {
      setError("No post credits left today — raise Max posts/day in Agent settings, or wait until tomorrow.");
      setHomeSub("agent");
      return;
    }
    setAgentBusy(true);
    setError(null);
    try {
      const res = await generateXAgentPost({ hint: genHint.trim() || undefined, postNow });
      if (res.error || res.message) {
        setError(res.message || res.error || "Generate failed");
      }
      await refreshQueue();
      if (!postNow) {
        setTab("home");
        setHomeSub("queue");
      }
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

  const statusLabel = xConnected
    ? hasKey
      ? xAgent?.enabled
        ? "Agent on"
        : "X ready"
      : "Need API key"
    : "Connect X";

  const goHomeSub = (sub: HomeSub) => {
    setTab("home");
    setHomeSub(sub);
  };

  if (authLoading && !user) {
    return <AgentLoading label="Opening X MCP…" />;
  }

  if (!user) {
    return (
      <AgentShell
        showTabs={false}
        brandHref="/x"
        brandSub="X MCP"
        footerBrand="OrbitX X MCP"
        footerNote="Connect X. Train an agent. Post from Claude, ChatGPT, or Grok."
        mcpUrl={oauth.mcpUrl}
        siblingHref="/agent"
        siblingLabel="Agent MCP"
        siblingIcon="◆"
        statusLabel="Sign in"
        statusWarn
      >
        <div className="ox-agent__hero">
          <h1 className="ox-agent__title">OrbitX</h1>
          <p className="ox-agent__lead">X MCP — connect X, train an agent, post from chat AI.</p>
        </div>
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Sign in</h2>
            <span className="ox-agent__panel-hint">wallet or email</span>
          </div>
          <div className="ox-agent__panel-b">
            <p className="ox-agent__note" style={{ marginTop: 0 }}>
              Sign in to connect X and mint MCP keys for Claude / ChatGPT / Grok.
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
            <p className="ox-agent__note">
              Or <Link to="/auth?next=/x">sign in with email</Link>.
            </p>
            {error && <div className="ox-agent__alert">{error}</div>}
          </div>
        </section>
      </AgentShell>
    );
  }

  return (
    <AgentShell
      activeTab={tab}
      onTabChange={selectTab}
      tabs={X_TABS}
      brandHref="/x"
      brandSub="X MCP"
      footerBrand="OrbitX X MCP"
      footerNote="Post, DM, buy credits, and run your NVIDIA agent from Claude, ChatGPT, or Grok. Non-custodial X OAuth — you authorize scopes on X."
      mcpUrl={oauth.mcpUrl}
      siblingHref="/agent"
      siblingLabel="Agent MCP"
      siblingIcon="◆"
      topSubtitle="X MCP · Claude · ChatGPT · Grok"
      statusLabel={statusLabel}
      statusWarn={!xConnected || !hasKey}
      onRefresh={refresh}
    >
      {loading && (
        <p className="ox-agent__note" style={{ marginTop: 0 }}>
          Syncing account…
        </p>
      )}
      {error && <div className="ox-agent__alert">{error}</div>}

      {tab === "home" && (
        <>
          <div className="ox-agent__hero">
            <h1 className="ox-agent__title">OrbitX</h1>
            <p className="ox-agent__lead">
              X MCP dashboard — post, DM, and run your NVIDIA agent from Claude, ChatGPT, or Grok.
            </p>
            <div className="ox-agent__kpis">
              <button
                type="button"
                className={`ox-agent__kpi${xConnected ? " is-ok" : ""}`}
                onClick={() => setTab("account")}
              >
                <span className="ox-agent__kpi-k">X</span>
                <span className="ox-agent__kpi-v">{xConnected ? `@${xHandle}` : "Connect"}</span>
              </button>
              <button
                type="button"
                className={`ox-agent__kpi${hasKey ? " is-ok" : ""}`}
                onClick={() => setTab("keys")}
              >
                <span className="ox-agent__kpi-k">API key</span>
                <span className="ox-agent__kpi-v">{hasKey ? "Ready" : "Create"}</span>
              </button>
              <button
                type="button"
                className={`ox-agent__kpi${(creditsUsage?.balance ?? 0) > 0 || postCredits.remaining > 0 ? " is-ok" : ""}`}
                onClick={() => selectTab("usage")}
                title="Purchased + daily post credits"
              >
                <span className="ox-agent__kpi-k">Credits</span>
                <span className="ox-agent__kpi-v">
                  {creditsUsage?.balance != null ? creditsUsage.balance.toLocaleString() : "—"}
                </span>
              </button>
              <button
                type="button"
                className={`ox-agent__kpi${xAgent?.enabled ? " is-ok" : ""}`}
                onClick={() => goHomeSub("agent")}
              >
                <span className="ox-agent__kpi-k">Agent</span>
                <span className="ox-agent__kpi-v">{xAgent?.enabled ? "On" : "Setup"}</span>
              </button>
            </div>

            <section className="ox-agent__panel ox-x-credits">
              <div className="ox-agent__panel-h">
                <h2 className="ox-agent__panel-title">Credits</h2>
                <button type="button" className="ox-agent__panel-hint ox-agent__linkish" onClick={() => selectTab("usage")}>
                  Usage / shop →
                </button>
              </div>
              <div className="ox-agent__panel-b">
                <div className="ox-x-credits__row">
                  <div>
                    <div className="ox-agent__label">Purchased balance</div>
                    <div className="ox-agent__value" style={{ fontSize: "1.35rem", fontWeight: 750 }}>
                      {(creditsUsage?.balance ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="ox-agent__label">Daily posts left</div>
                    <div className="ox-agent__value">
                      {postCredits.remaining}/{postCredits.max}
                    </div>
                  </div>
                  <div className="ox-x-credits__bar" aria-hidden>
                    <span style={{ width: `${postCredits.pct}%` }} />
                  </div>
                </div>
                <p className="ox-agent__note" style={{ marginTop: "0.65rem", marginBottom: 0 }}>
                  Buy any amount of SOL via Claude/Grok (`x_credits_buy`) or the Usage tab. Advanced ledger is on Usage.
                </p>
              </div>
            </section>
            <div className="ox-agent__steps">
              <span className={`ox-agent__chip${xConnected ? " is-ok" : ""}`}>
                {xConnected ? `@${xHandle}` : "X needed"}
              </span>
              <span className={`ox-agent__chip${hasKey ? " is-ok" : ""}`}>
                {hasKey ? "API key ready" : "Create API key"}
              </span>
              <span className={`ox-agent__chip${xAgent?.enabled ? " is-ok" : ""}`}>
                {xAgent?.enabled ? "Agent on" : "Agent off"}
              </span>
            </div>
          </div>

          <div className="ox-agent__subtabs">
            {(
              [
                ["post", "Post"],
                ["agent", "Agent"],
                ["queue", "Queue"],
                ["messages", "Messages"],
                ["matrix", "Matrix"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`ox-agent__subtab${homeSub === id ? " is-on" : ""}`}
                onClick={() => setHomeSub(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "home" && homeSub === "post" && (
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Composer</h2>
              <span className="ox-agent__panel-hint">draft or post</span>
            </div>
            <div className="ox-agent__panel-b">
          <div className="xh__composer" style={{ border: 0, padding: 0, display: "block" }}>
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
                    className="xh__btn xh__btn--ox"
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
                  <button type="button" className="xh__btn xh__btn--ox" onClick={() => setTab("keys")}>
                    Open Keys
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
            </div>
          </section>
      )}

      {tab === "usage" && (
        <>
          <section className="ox-agent__panel ox-x-credits">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Advanced usage</h2>
              <span className="ox-agent__panel-hint">analytics · shop</span>
            </div>
            <div className="ox-agent__panel-b">
              <div className="ox-x-period" role="tablist" aria-label="Usage period">
                {(["24h", "7d", "30d", "all"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={usagePeriod === p}
                    className={`ox-x-period__btn${usagePeriod === p ? " is-on" : ""}`}
                    onClick={() => setUsagePeriod(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="ox-x-usage__stats">
                <div>
                  <div className="ox-agent__label">Balance</div>
                  <div className="ox-agent__value" style={{ fontSize: "1.6rem", fontWeight: 750 }}>
                    {(creditsUsage?.balance ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="ox-agent__label">Period bought</div>
                  <div className="ox-agent__value">
                    {(creditsUsage?.advanced?.summary?.periodPurchased ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="ox-agent__label">Period SOL in</div>
                  <div className="ox-agent__value">
                    {Number(creditsUsage?.advanced?.summary?.periodSolIn ?? 0).toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="ox-agent__label">Runway</div>
                  <div className="ox-agent__value">
                    {creditsUsage?.advanced?.summary?.runwayDays != null
                      ? `~${creditsUsage.advanced.summary.runwayDays}d`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="ox-agent__label">Lifetime bought</div>
                  <div className="ox-agent__value">
                    {(creditsUsage?.lifetimePurchased ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="ox-agent__label">Lifetime SOL</div>
                  <div className="ox-agent__value">
                    {Number(creditsUsage?.lifetimeSolIn ?? creditsUsage?.advanced?.summary?.lifetimeSolIn ?? 0).toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="ox-agent__label">Daily posts</div>
                  <div className="ox-agent__value">
                    {creditsUsage?.advanced?.agentPosts
                      ? `${creditsUsage.advanced.agentPosts.remaining}/${creditsUsage.advanced.agentPosts.max}`
                      : `${postCredits.remaining}/${postCredits.max}`}
                  </div>
                </div>
                <div>
                  <div className="ox-agent__label">Burn / day</div>
                  <div className="ox-agent__value">
                    {(creditsUsage?.advanced?.summary?.burnPerDay ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>
              {(creditsUsage?.advanced?.daily?.length ?? 0) > 0 ? (
                <div className="ox-x-bars" aria-label="Daily credits activity">
                  {creditsUsage!.advanced!.daily!.slice(-14).map((d) => {
                    const max = Math.max(
                      1,
                      ...creditsUsage!.advanced!.daily!.map((x) => x.purchased + x.spent),
                    );
                    const h = Math.max(4, Math.round(((d.purchased + d.spent) / max) * 48));
                    return (
                      <div key={d.day} className="ox-x-bars__col" title={`${d.day}: +${d.purchased} / −${d.spent}`}>
                        <span className="ox-x-bars__bar" style={{ height: h }} />
                        <span className="ox-x-bars__lbl">{d.day.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <p className="ox-agent__note" style={{ marginTop: "0.75rem" }}>
                Rate: {(creditsUsage?.creditsPerSol || 10_000).toLocaleString()} credits / 1 SOL · desk{" "}
                <button
                  type="button"
                  className="ox-agent__linkish"
                  onClick={() => void copy("payTo", creditsUsage?.payTo || PLATFORM_WALLET)}
                >
                  {shortXKey(creditsUsage?.payTo || PLATFORM_WALLET)}
                </button>
                {copied === "payTo" ? " · copied" : ""}
                {" · "}Ask Grok for <strong>advanced usage</strong>
              </p>
            </div>
          </section>

          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Buy credits</h2>
              <span className="ox-agent__panel-hint">packs · any amount</span>
            </div>
            <div className="ox-agent__panel-b">
              <p className="ox-agent__note" style={{ marginTop: 0 }}>
                In Grok/Claude say <strong>buy credits</strong> — or pick a pack / custom SOL here. Phantom sends SOL
                to the OrbitX desk wallet; credits apply after confirm.
              </p>
              <div className="ox-x-packs">
                {(creditsUsage?.advanced?.suggestedPacks || [
                  { sol: 0.1, credits: 1000, label: "Starter" },
                  { sol: 0.5, credits: 5000, label: "Standard" },
                  { sol: 1, credits: 10000, label: "Pro" },
                  { sol: 5, credits: 50000, label: "Whale" },
                ]).map((p) => (
                  <button
                    key={p.sol}
                    type="button"
                    className={`ox-x-packs__btn${Number(buySol) === p.sol ? " is-on" : ""}`}
                    onClick={() => setBuySol(String(p.sol))}
                  >
                    <span className="ox-x-packs__lbl">{p.label}</span>
                    <span className="ox-x-packs__sol">{p.sol} SOL</span>
                    <span className="ox-x-packs__cr">{p.credits.toLocaleString()} cr</span>
                  </button>
                ))}
              </div>
              <label className="ox-agent__label" htmlFor="ox-buy-sol">
                Custom SOL
              </label>
              <div className="ox-x-buy__row">
                <input
                  id="ox-buy-sol"
                  className="ox-agent__input"
                  type="number"
                  min={0.001}
                  step={0.001}
                  value={buySol}
                  onChange={(e) => setBuySol(e.target.value)}
                  placeholder="0.1"
                />
                <span className="ox-x-buy__quote">→ {quotedCredits.toLocaleString()} credits</span>
              </div>
              <div className="ox-agent__actions" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="ox-agent__btn"
                  disabled={buyBusy}
                  onClick={() => void onBuyCredits()}
                >
                  {buyBusy ? "Processing…" : walletConnected ? "Pay with wallet" : "Connect wallet to pay"}
                </button>
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--ghost"
                  onClick={() => void refreshCredits()}
                >
                  Refresh
                </button>
              </div>
              {buyNote && <p className="ox-agent__note ox-x-buy__ok">{buyNote}</p>}
              <div className="ox-x-buy__manual">
                <label className="ox-agent__label" htmlFor="ox-buy-sig">
                  Already paid? Paste signature
                </label>
                <input
                  id="ox-buy-sig"
                  className="ox-agent__input"
                  value={manualSig}
                  onChange={(e) => setManualSig(e.target.value)}
                  placeholder="Solana tx signature"
                />
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--ghost"
                  disabled={buyBusy || !manualSig.trim()}
                  onClick={() => void onConfirmManualSig()}
                >
                  Confirm payment
                </button>
              </div>
            </div>
          </section>

          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Ledger</h2>
              <span className="ox-agent__panel-hint">{usagePeriod}</span>
            </div>
            <div className="ox-agent__panel-b">
              {(creditsUsage?.ledger?.length ?? 0) === 0 ? (
                <p className="ox-agent__note" style={{ marginTop: 0 }}>
                  No activity in this period — buy above or tell Grok “advanced usage”.
                </p>
              ) : (
                <ul className="ox-x-usage__ledger">
                  {creditsUsage!.ledger.map((e) => (
                    <li key={e.id}>
                      <div>
                        <strong>
                          {e.amount > 0 ? "+" : ""}
                          {e.amount.toLocaleString()}
                        </strong>{" "}
                        <span className="ox-agent__muted">{e.kind}</span>
                      </div>
                      <div className="ox-agent__note" style={{ margin: 0 }}>
                        {e.description || "—"}
                        {e.sol != null ? ` · ${e.sol} SOL` : ""}
                        {e.createdAt ? ` · ${new Date(e.createdAt).toLocaleString()}` : ""}
                      </div>
                      {e.explorer ? (
                        <a href={e.explorer} target="_blank" rel="noopener noreferrer" className="ox-agent__linkish">
                          View tx
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "account" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">X account</h2>
            <span className="ox-agent__panel-hint">OAuth scopes</span>
          </div>
          <div className="ox-agent__panel-b">
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
                <div className="ox-agent__alert">
                  No write permission on this token (missing tweet.write). Revoke OrbitX at x.com/settings/connected_apps,
                  stay signed in here, then Reconnect once. Tokens now refresh automatically — you should not need to
                  re-auth every session.
                </div>
              )}
              {boot?.x?.hasTweetWrite === true && (
                <p className="ox-agent__note">
                  Write OK: tweet.write{boot.x.hasDmWrite ? " + dm.write" : ""}. Refresh is automatic — reconnect only if
                  posting fails with 403.
                </p>
              )}
              {boot?.x?.scopes ? (
                <p className="ox-agent__note" style={{ fontFamily: "var(--oa-mono)", fontSize: "0.75rem" }}>
                  Granted: {boot.x.scopes}
                </p>
              ) : null}
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={connectingX} onClick={onConnectX}>
                  {connectingX ? "Redirecting…" : "Reconnect X"}
                </button>
                <button type="button" className="ox-agent__btn" onClick={() => goHomeSub("matrix")}>
                  Open Matrix
                </button>
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--danger"
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
              <p className="ox-agent__note" style={{ marginTop: 0 }}>
                Connect your X account so Claude or ChatGPT can post, reply, and DM through this MCP.
              </p>
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={connectingX} onClick={onConnectX}>
                  {connectingX ? "Redirecting…" : "Connect X"}
                </button>
              </div>
            </>
          )}
          </div>
        </section>
      )}

      {tab === "home" && homeSub === "messages" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Messages</h2>
            <span className="ox-agent__panel-hint">x_dm</span>
          </div>
          <div className="ox-agent__panel-b">
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
          <div className="ox-agent__btn-row">
            <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={dmBusy || !xConnected} onClick={onSendDm}>
              {dmBusy ? "Sending…" : "Send DM"}
            </button>
            <button type="button" className="ox-agent__btn" disabled={dmBusy || !xConnected} onClick={onLoadDmInbox}>
              Check inbox
            </button>
          </div>
          {dmNote && <p className="ox-agent__note">{dmNote}</p>}
          <p className="ox-agent__note">MCP tools: x_dm · x_dm_inbox</p>
          </div>
        </section>
      )}

      {tab === "home" && homeSub === "agent" && (
        <>
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">NVIDIA agent</h2>
              <span className="ox-agent__panel-hint">persona · auto-reply</span>
            </div>
            <div className="ox-agent__panel-b">
            {!xAgent ? (
              <p className="ox-agent__note">Loading agent…</p>
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
                <div className="ox-agent__btn-row">
                  <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={agentBusy} onClick={onSaveAgent}>
                    {agentBusy ? "Saving…" : "Save agent"}
                  </button>
                  <button
                    type="button"
                    className="ox-agent__btn"
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
          </section>
          <section className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">Train</h2>
              <span className="ox-agent__panel-hint">knowledge</span>
            </div>
            <div className="ox-agent__panel-b">
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
            <div className="ox-agent__btn-row">
              <button
                type="button"
                className="ox-agent__btn"
                disabled={agentBusy || !trainContent.trim()}
                onClick={onTrain}
              >
                Add knowledge
              </button>
              <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={agentBusy} onClick={() => onGenerate(false)}>
                Generate draft
              </button>
            </div>
            {knowledge.slice(0, 8).map((k) => (
              <div key={k.id} className="ox-agent__row">
                <div className="ox-agent__value ox-agent__value--plain">
                  <strong>{k.title}</strong>
                  <div className="ox-agent__note" style={{ marginTop: 4 }}>
                    {k.content.slice(0, 120)}
                    {k.content.length > 120 ? "…" : ""}
                  </div>
                </div>
              </div>
            ))}
            </div>
          </section>
        </>
      )}

      {tab === "home" && homeSub === "queue" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Queue</h2>
            <span className="ox-agent__panel-hint">{queue.length} items</span>
          </div>
          <div className="ox-agent__panel-b">
            <div className="ox-agent__btn-row" style={{ marginTop: 0 }}>
              <button type="button" className="ox-agent__btn" disabled={agentBusy} onClick={() => refreshQueue()}>
                Refresh
              </button>
              <button type="button" className="ox-agent__btn" onClick={() => goHomeSub("post")}>
                Composer
              </button>
            </div>
        <div className="xh__feed" style={{ border: 0 }}>
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
          </div>
        </section>
      )}

      {tab === "home" && homeSub === "matrix" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Matrix</h2>
            <span className="ox-agent__panel-hint">capabilities</span>
          </div>
          <div className="ox-agent__panel-b">
          <XMcpMatrix
            xConnected={xConnected}
            hasTweetWrite={boot?.x?.hasTweetWrite}
            hasDmWrite={boot?.x?.hasDmWrite}
            hasKey={hasKey}
          />
          </div>
        </section>
      )}

      {tab === "keys" && (
        <section className="ox-agent__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">API keys</h2>
            <span className="ox-agent__panel-hint">oxx_ bearer</span>
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
                {showKeyPanel && <p className="ox-agent__note">New key ready — copy into connector headers.</p>}
              </>
            )}
            <div className="ox-agent__btn-row">
              <input
                className="ox-agent__input ox-agent__grow"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Key label"
              />
              <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={creating} onClick={onCreateKey}>
                {creating ? "Creating…" : "Create key"}
              </button>
            </div>
            {(boot?.keys || []).map((k) => (
              <div key={k.id} className="ox-agent__keyline">
                <div>
                  <div className="ox-agent__value ox-agent__value--plain">{k.name}</div>
                  <div className="ox-agent__note" style={{ marginTop: 4 }}>
                    {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <button type="button" className="ox-agent__btn ox-agent__btn--danger" onClick={() => onRevoke(k.id)}>
                  Revoke
                </button>
              </div>
            ))}
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
            {!xConnected && (
              <div className="ox-agent__alert">Connect X first — without it, posting tools will fail.</div>
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
                  setOauthGuide("chatgpt");
                  setSetupOpen("chatgpt");
                  window.open(xChatgptConnectUrl(), "_blank", "noopener,noreferrer");
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
                  window.open(xGrokConnectUrl(), "_blank", "noopener,noreferrer");
                }}
              >
                Add to Grok
              </button>
            </div>

            <div className="ox-agent__note" style={{ marginTop: "1rem", padding: "0.85rem 1rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
              <strong style={{ display: "block", marginBottom: 6 }}>Chat auth (no website click)</strong>
              Generate a special message, paste it into Grok / Claude / ChatGPT. The AI activates your authCode and stays linked.
              <div className="ox-agent__btn-row">
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--primary"
                  disabled={mintingAuth}
                  onClick={onMintChatAuth}
                >
                  {mintingAuth ? "Minting…" : "Generate chat auth"}
                </button>
                {chatAuth?.messages && (
                  <>
                    <button type="button" className="ox-agent__btn" onClick={() => copy("chatGrok", chatAuth.messages.grok)}>
                      {copied === "chatGrok" ? "Copied" : "Copy for Grok"}
                    </button>
                    <button type="button" className="ox-agent__btn" onClick={() => copy("chatClaude", chatAuth.messages.claude)}>
                      {copied === "chatClaude" ? "Copied" : "Copy for Claude"}
                    </button>
                    <button type="button" className="ox-agent__btn" onClick={() => copy("chatGpt", chatAuth.messages.chatgpt)}>
                      {copied === "chatGpt" ? "Copied" : "Copy for ChatGPT"}
                    </button>
                  </>
                )}
              </div>
              {chatAuth?.authCode && (
                <p className="ox-agent__note" style={{ marginBottom: 0 }}>
                  authCode <code>{chatAuth.authCode}</code>
                  {chatAuth.xUsername ? ` · @${chatAuth.xUsername}` : ""}
                  {chatAuth.expiresAt ? ` · until ${chatAuth.expiresAt.slice(0, 10)}` : ""}
                </p>
              )}
            </div>

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
                <li>MCP URL must end in /mcp</li>
                <li>Client ID orbitx-x-mcp, secret blank</li>
                <li>Best: Generate chat auth → Copy for Claude → paste in chat</li>
              </ol>
            )}
            {setupOpen === "chatgpt" && (
              <ol className="ox-agent__ol">
                <li>Developer Mode on (Apps & Connectors → Advanced)</li>
                <li>Custom connector with MCP URL + OAuth fields</li>
                <li>Best: Generate chat auth → Copy for ChatGPT → paste in a chat</li>
              </ol>
            )}
            {setupOpen === "grok" && (
              <ol className="ox-agent__ol">
                <li>
                  Open <code>grok.com/connectors</code> → New Connector → Custom
                </li>
                <li>Paste only the MCP URL below (one-time)</li>
                <li>
                  Generate chat auth → <strong>Copy for Grok</strong> → paste in chat
                </li>
                <li>
                  Grok calls <code>x_auth_status</code> — stays linked; say <code>/</code> for the menu
                </li>
              </ol>
            )}
            <FieldRow
              label="MCP URL"
              value={oauth.mcpUrl}
              copied={copied === "mcp" || copied === "grokMcp"}
              onCopy={() => copy("mcp", oauth.mcpUrl)}
            />
            {setupOpen !== "grok" && (
              <>
                <FieldRow label="Auth URL" value={oauth.authorizationUrl} copied={copied === "auth"} onCopy={() => copy("auth", oauth.authorizationUrl)} />
                <FieldRow label="Token URL" value={oauth.tokenUrl} copied={copied === "token"} onCopy={() => copy("token", oauth.tokenUrl)} />
                <FieldRow label="Client ID" value={oauth.clientId} copied={copied === "client"} onCopy={() => copy("client", oauth.clientId)} />
                <FieldRow label="Client secret" value="(leave blank)" copyable={false} />
                <FieldRow label="Scope" value={oauth.scope} copied={copied === "scope"} onCopy={() => copy("scope", oauth.scope)} />
              </>
            )}
          </div>
        </section>
      )}

      {oauthGuide === "chatgpt" && (
        <div className="ox-agent__modal" onClick={() => setOauthGuide(null)}>
          <div className="ox-agent__modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>ChatGPT · X MCP</h2>
            <p className="ox-agent__note" style={{ marginTop: 0 }}>
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
