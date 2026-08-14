import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Command,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Film,
  GalleryHorizontalEnd,
  History,
  Image as ImageIcon,
  Loader2,
  Menu,
  MessageCircle,
  PanelLeftClose,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  Wallet,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { TokenGatingVerifier } from "@/components/agent/token-gating-verifier";
import { AGENT_HOLD_MIN_USD, AGENT_HOLD_MINT } from "@/lib/agentTokenGate";
import { OGSCAN_TOKEN_SYMBOL } from "@/lib/og";
import {
  bootstrapOrbitXAi,
  cancelAiTool,
  createAiConversation,
  deleteAiConversation,
  executeAiTool,
  fetchAiGate,
  fetchAiMessages,
  generateAiMedia,
  pollAiMedia,
  renameAiConversation,
  streamAiMessage,
  type AiBootstrap,
  type AiConversation,
  type AiGate,
  type AiGeneration,
  type AiMessage,
  type AiToolDefinition,
  type AiToolEvent,
} from "@/lib/orbitxAi";
import {
  approveXAgentQueueItem,
  bootstrapXMcp,
  enqueueXAgentItem,
  generateXAgentPost,
  listXAgentQueue,
  type XMcpBootstrap,
  type XAgentQueueItem,
} from "@/lib/xMcp";
import { xStartLogin } from "@/lib/xAuth";
import "./orbitx-ai.css";

type AiTab = "chat" | "tools" | "create" | "x";
type MediaKind = "image" | "video";
type SendAsset = "SOL" | "ORBITX" | "CUSTOM";
const SOL_DECIMALS = String(LAMPORTS_PER_SOL).length - 1;

const STARTER_PROMPTS = [
  {
    icon: BarChart3,
    title: "Live token chart",
    prompt: "Show me the live chart and key levels for the ORBITX token.",
    tone: "cyan",
  },
  {
    icon: ShieldCheck,
    title: "Deep safety scan",
    prompt: "Help me run a full safety and forensics scan on a token contract.",
    tone: "violet",
  },
  {
    icon: Rocket,
    title: "Find momentum",
    prompt: "Screen Solana for the strongest trending tokens in the last hour.",
    tone: "lime",
  },
  {
    icon: Wallet,
    title: "Wallet intelligence",
    prompt: "Analyze my connected wallet, holdings, recent swaps, and risk exposure.",
    tone: "gold",
  },
] as const;

const X_IDEA_PROMPTS = [
  "A sharp market observation about today's Solana momentum",
  "A useful educational post about avoiding token scams",
  "A bold but credible OrbitX product update",
  "A high-conviction community question that starts a conversation",
];

const TAB_ITEMS: Array<{
  id: AiTab;
  label: string;
  icon: typeof MessageCircle;
}> = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "tools", label: "Tools", icon: Command },
  { id: "create", label: "Create", icon: WandSparkles },
  { id: "x", label: "X Studio", icon: X },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordString(value: unknown, key: string): string {
  const candidate = asRecord(value)[key];
  return typeof candidate === "string" ? candidate : "";
}

function recordNumber(value: unknown, key: string): number | null {
  const candidate = asRecord(value)[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(3)}`;
}

function shortAddress(value?: string | null): string {
  if (!value) return "No wallet";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(delta) || delta < 0) return "now";
  if (delta < 60_000) return "now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  return `${Math.floor(delta / 86_400_000)}d`;
}

function amountToBaseUnits(input: string, decimals: number): bigint {
  const clean = input.trim();
  if (!/^\d+(?:\.\d+)?$/.test(clean)) throw new Error("Enter a valid positive amount");
  const [whole, fraction = ""] = clean.split(".");
  if (fraction.length > decimals) {
    throw new Error(`This token supports up to ${decimals} decimal places`);
  }
  const padded = fraction.padEnd(decimals, "0");
  const value = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
  if (value <= 0n) throw new Error("Amount must be greater than zero");
  return value;
}

function AiMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`oai-mark${compact ? " is-compact" : ""}`} aria-hidden>
      <span className="oai-mark__halo" />
      <span className="oai-mark__core">
        <Sparkles />
      </span>
    </div>
  );
}

function LoadingScreen({ label = "Waking OrbitX AI" }: { label?: string }) {
  return (
    <div className="oai-root oai-root--center">
      <div className="oai-boot">
        <AiMark />
        <div className="oai-boot__loader">
          <span />
          <span />
          <span />
        </div>
        <p>{label}</p>
      </div>
    </div>
  );
}

function LockedScreen({
  gate,
  error,
  onRetry,
}: {
  gate: AiGate | null;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="oai-root oai-gate">
      <div className="oai-gate__glow oai-gate__glow--one" />
      <div className="oai-gate__glow oai-gate__glow--two" />
      <header className="oai-gate__header">
        <div className="oai-brand">
          <AiMark compact />
          <div>
            <strong>OrbitX AI</strong>
            <span>Private intelligence layer</span>
          </div>
        </div>
        <WalletConnectButton />
      </header>
      <main className="oai-gate__main">
        <section className="oai-gate__copy">
          <span className="oai-eyebrow">
            <ShieldCheck size={13} /> Wallet-gated super app
          </span>
          <h1>
            One agent.
            <br />
            <em>Every OrbitX tool.</em>
          </h1>
          <p>
            Chat with NVIDIA intelligence, inspect live markets, sign non-custodial
            transactions, create Grok media, and run your X agent from one mobile-first
            command center.
          </p>
          <div className="oai-gate__features">
            <span>
              <Bot /> MCP-native agent
            </span>
            <span>
              <GalleryHorizontalEnd /> Image + video
            </span>
            <span>
              <Wallet /> Secure wallet actions
            </span>
          </div>
        </section>
        <section className="oai-gate__card">
          <div className="oai-gate__card-top">
            <div className="oai-gate__token">
              <span>OX</span>
            </div>
            <div>
              <span className="oai-kicker">Access requirement</span>
              <strong>Hold ${AGENT_HOLD_MIN_USD} in {OGSCAN_TOKEN_SYMBOL}</strong>
            </div>
            <span className="oai-live-pill">
              <i /> Mainnet
            </span>
          </div>
          <div className="oai-gate__meter">
            <div>
              <span>Your verified holding</span>
              <strong>{formatUsd(gate?.holdingUsd)}</strong>
            </div>
            <div className="oai-gate__track">
              <span
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(4, ((gate?.holdingUsd || 0) / AGENT_HOLD_MIN_USD) * 100),
                  )}%`,
                }}
              />
            </div>
          </div>
          {(gate?.message || error) && (
            <div className="oai-gate__notice">{error || gate?.message}</div>
          )}
          <div className="oai-gate__verify">
            <TokenGatingVerifier onUnlocked={onRetry} />
          </div>
          <div className="oai-gate__actions">
            <a
              href={`https://jup.ag/swap/SOL-${AGENT_HOLD_MINT}`}
              target="_blank"
              rel="noreferrer"
              className="oai-primary-btn"
            >
              Buy {OGSCAN_TOKEN_SYMBOL} <ExternalLink size={15} />
            </a>
            <button type="button" className="oai-secondary-btn" onClick={onRetry}>
              <RefreshCw size={14} /> Recheck
            </button>
          </div>
          <p className="oai-gate__foot">
            Owner wallets are recognized automatically. OrbitX never asks for private
            keys or seed phrases.
          </p>
        </section>
      </main>
    </div>
  );
}

const RESULT_METRICS = [
  { keys: ["priceUsd", "price_usd", "price"], label: "Price", kind: "usd" },
  { keys: ["marketCapUsd", "market_cap_usd", "marketCap"], label: "Market cap", kind: "usd" },
  { keys: ["liquidityUsd", "liquidity_usd", "liquidity"], label: "Liquidity", kind: "usd" },
  { keys: ["volume24h", "volume24hUsd", "volume_24h"], label: "24h volume", kind: "usd" },
  { keys: ["balanceUsd", "totalUsd", "portfolioUsd"], label: "Portfolio", kind: "usd" },
  { keys: ["solBalance", "balanceSol"], label: "SOL", kind: "number" },
  { keys: ["score", "safetyScore", "riskScore"], label: "Score", kind: "number" },
] as const;

const RESULT_LIST_KEYS = [
  "tokens",
  "holdings",
  "items",
  "results",
  "launches",
  "listings",
  "sales",
  "offers",
  "members",
  "communities",
  "feed",
] as const;

function firstRecordValue(
  sources: Array<Record<string, unknown>>,
  keys: readonly string[],
): unknown {
  for (const source of sources) {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null) return source[key];
    }
  }
  return null;
}

function metricText(value: unknown, kind: "usd" | "number"): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return String(value || "—");
  if (kind === "usd") return formatUsd(number);
  return number.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function resultList(result: Record<string, unknown>): Array<Record<string, unknown>> {
  for (const key of RESULT_LIST_KEYS) {
    const candidate = result[key];
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      );
    }
  }
  if (Array.isArray(result.data)) {
    return result.data.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  }
  return [];
}

function StructuredToolResult({ event }: { event: AiToolEvent }) {
  const result = asRecord(event.result);
  const sources = [
    result,
    asRecord(result.data),
    asRecord(result.token),
    asRecord(result.wallet),
    asRecord(result.summary),
  ];
  const summary =
    recordString(result, "message") ||
    recordString(result, "summary") ||
    recordString(result, "description") ||
    recordString(result, "error");
  const metrics = RESULT_METRICS.map((metric) => ({
    ...metric,
    value: firstRecordValue(sources, metric.keys),
  })).filter((metric) => metric.value !== null);
  const rows = resultList(result).slice(0, 6);
  const serialized = JSON.stringify(event.result, null, 2);

  return (
    <div className="oai-result">
      {summary && <p className="oai-result__summary">{summary.slice(0, 700)}</p>}
      {metrics.length > 0 && (
        <div className="oai-result__metrics">
          {metrics.slice(0, 4).map((metric) => (
            <span key={metric.label}>
              <small>{metric.label}</small>
              <strong>{metricText(metric.value, metric.kind)}</strong>
            </span>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div className="oai-result__rows">
          {rows.map((row, index) => {
            const title = firstRecordValue(
              [row],
              ["name", "symbol", "title", "username", "mint", "address", "id"],
            );
            const subtitle = firstRecordValue(
              [row],
              ["status", "description", "message", "chain", "type"],
            );
            const value = firstRecordValue(
              [row],
              ["priceUsd", "balanceUsd", "amount", "score", "floorPrice", "members"],
            );
            return (
              <div key={`${String(title || "result")}-${index}`}>
                <span>
                  <strong>{String(title || `Result ${index + 1}`).slice(0, 70)}</strong>
                  {subtitle != null && <small>{String(subtitle).slice(0, 100)}</small>}
                </span>
                {value != null && <b>{String(value).slice(0, 30)}</b>}
              </div>
            );
          })}
        </div>
      )}
      {!summary && metrics.length === 0 && rows.length === 0 && (
        <p className="oai-result__summary">
          {event.status === "completed" ? "OrbitX completed this tool run." : "No result summary available."}
        </p>
      )}
      <details className="oai-result__details">
        <summary>Technical details</summary>
        <pre>{serialized.slice(0, 12_000)}</pre>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(serialized);
            toast.success("Tool result copied");
          }}
        >
          <Copy size={12} /> Copy JSON
        </button>
      </details>
    </div>
  );
}

function ToolResultCard({
  event,
  busy,
  onConfirm,
  onCancel,
}: {
  event: AiToolEvent;
  busy: boolean;
  onConfirm: (event: AiToolEvent) => void;
  onCancel: (event: AiToolEvent) => void;
}) {
  const result = asRecord(event.result);
  const embedUrl = recordString(result, "embedUrl");
  const imageUrls = Array.isArray(result.imageUrls)
    ? result.imageUrls.filter((url): url is string => typeof url === "string")
    : Array.isArray(result.resultUrls)
      ? result.resultUrls.filter((url): url is string => typeof url === "string")
      : [];
  const signUrl =
    recordString(result, "signUrl") ||
    recordString(result, "openUrl") ||
    recordString(result, "autoSignUrl");
  const isChart = Boolean(embedUrl) || /chart/i.test(event.tool);
  const isPending = event.status === "confirmation_required";
  const isExecuting = event.status === "executing";
  const isCancelled = event.status === "cancelled";
  const isStaleExecuting =
    isExecuting &&
    Boolean(event.expiresAt) &&
    new Date(event.expiresAt || "").getTime() <= Date.now();
  const failed = event.status === "failed" || isCancelled;

  if (isChart && embedUrl) {
    return (
      <div className="oai-tool oai-tool--chart">
        <div className="oai-tool__head">
          <span>
            <BarChart3 size={15} /> Live DexScreener
          </span>
          <a href={recordString(result, "pageUrl") || embedUrl} target="_blank" rel="noreferrer">
            Open <ExternalLink size={12} />
          </a>
        </div>
        <div className="oai-chart-frame">
          <iframe src={embedUrl} title="Live token chart" loading="lazy" allowFullScreen />
        </div>
        <div className="oai-chart-stats">
          <span>
            Price <strong>{formatUsd(recordNumber(result, "priceUsd"))}</strong>
          </span>
          <span>
            Liquidity <strong>{formatUsd(recordNumber(result, "liquidityUsd"))}</strong>
          </span>
          <span>
            24h vol <strong>{formatUsd(recordNumber(result, "volume24h"))}</strong>
          </span>
        </div>
      </div>
    );
  }

  if (imageUrls.length > 0) {
    return (
      <div className="oai-tool oai-tool--media">
        <div className="oai-tool__head">
          <span>
            <WandSparkles size={15} /> {event.tool.replaceAll("_", " ")}
          </span>
          <span className="oai-tool__status is-ok">
            <Check size={11} /> Ready
          </span>
        </div>
        <div className="oai-tool__images">
          {imageUrls.slice(0, 4).map((url) => (
            <a href={url} target="_blank" rel="noreferrer" key={url}>
              <img src={url} alt="Generated OrbitX media" loading="lazy" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`oai-tool${failed ? " is-failed" : ""}${isPending ? " is-pending" : ""}`}>
      <div className="oai-tool__head">
        <span>
          {isPending ? (
            <ShieldCheck size={15} />
          ) : isExecuting ? (
            <Loader2 className="oai-spin" size={15} />
          ) : failed ? (
            <X size={15} />
          ) : (
            <Zap size={15} />
          )}
          {event.tool.replace(/^orbitx_/, "").replaceAll("_", " ")}
        </span>
        <span className={`oai-tool__status${failed ? " is-bad" : isPending ? " is-warn" : " is-ok"}`}>
          {isCancelled
            ? "Cancelled"
            : failed
              ? "Failed"
              : isPending
                ? "Confirm"
                : isExecuting
                  ? "Running"
                  : "Complete"}
        </span>
      </div>
      {isPending ? (
        <>
          <p>This action can change data or prepare a transaction. Review it before running.</p>
          <pre>{JSON.stringify(event.args, null, 2)}</pre>
          <div className="oai-tool__decision">
            <button
              type="button"
              className="oai-tool__cancel"
              disabled={busy}
              onClick={() => onCancel(event)}
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              className="oai-tool__confirm"
              disabled={busy}
              onClick={() => onConfirm(event)}
            >
              {busy ? <Loader2 className="oai-spin" size={14} /> : <ShieldCheck size={14} />}
              Confirm action
            </button>
          </div>
        </>
      ) : (
        <>
          <StructuredToolResult event={event} />
          {isStaleExecuting && (
            <button
              type="button"
              className="oai-tool__cancel"
              disabled={busy}
              onClick={() => onCancel(event)}
            >
              Close timed-out action
            </button>
          )}
          {signUrl && (
            <a className="oai-tool__confirm" href={signUrl} target="_blank" rel="noreferrer">
              Open secure signer <ExternalLink size={13} />
            </a>
          )}
        </>
      )}
    </div>
  );
}

function ChatMessage({
  message,
  confirming,
  onConfirm,
  onCancel,
}: {
  message: AiMessage;
  confirming: string | null;
  onConfirm: (messageId: string, event: AiToolEvent) => void;
  onCancel: (messageId: string, event: AiToolEvent) => void;
}) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const isStreaming = message.metadata.streaming === true;
  return (
    <article className={`oai-message oai-message--${message.role}`}>
      {!isUser && (
        <div className="oai-message__avatar">
          {isTool ? <Zap size={14} /> : <AiMark compact />}
        </div>
      )}
      <div className="oai-message__body">
        <div className="oai-message__meta">
          <strong>{isUser ? "You" : isTool ? "OrbitX action" : "OrbitX AI"}</strong>
          <span>{relativeTime(message.createdAt)}</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(message.content);
              toast.success("Message copied");
            }}
            aria-label="Copy message"
          >
            <Copy size={11} />
          </button>
        </div>
        <div className="oai-message__content">
          {isUser || isTool ? (
            <p>{message.content}</p>
          ) : (
            <>
              <ReactMarkdown
                components={{
                  a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && <span className="oai-live-cursor" aria-label="OrbitX AI is typing" />}
            </>
          )}
        </div>
        {message.toolEvents.map((event) => (
          <ToolResultCard
            key={event.id}
            event={event}
            busy={confirming === event.id}
            onConfirm={(pendingEvent) => onConfirm(message.id, pendingEvent)}
            onCancel={(pendingEvent) => onCancel(message.id, pendingEvent)}
          />
        ))}
      </div>
      {isUser && (
        <div className="oai-message__avatar oai-message__avatar--user">
          <ArrowUp size={14} />
        </div>
      )}
    </article>
  );
}

function Composer({
  value,
  busy,
  onChange,
  onSubmit,
  onStop,
  onSendAsset,
  onChart,
  onTools,
  onCreate,
  onXStudio,
  toolCount,
}: {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onSendAsset: () => void;
  onChart: () => void;
  onTools: () => void;
  onCreate: () => void;
  onXStudio: () => void;
  toolCount: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.min(148, Math.max(26, ref.current.scrollHeight))}px`;
  }, [value]);

  return (
    <div className="oai-composer-wrap">
      <div className="oai-quick-row">
        <button type="button" onClick={onSendAsset}>
          <Send size={13} /> Send tokens
        </button>
        <button type="button" onClick={onChart}>
          <BarChart3 size={13} /> Live chart
        </button>
        <button type="button" onClick={() => onChange("Run a deep safety scan on ")}>
          <ShieldCheck size={13} /> Safety scan
        </button>
      </div>
      <div className="oai-composer">
        {actionsOpen && (
          <div className="oai-composer-actions">
            {[
              { label: "Send tokens", detail: "Non-custodial", icon: Send, action: onSendAsset },
              { label: "Live chart", detail: "DexScreener", icon: BarChart3, action: onChart },
              {
                label: "MCP tools",
                detail: `${toolCount.toLocaleString()} capabilities`,
                icon: Command,
                action: onTools,
              },
              { label: "Create media", detail: "Grok Imagine", icon: WandSparkles, action: onCreate },
              { label: "X Studio", detail: "Draft & publish", icon: X, action: onXStudio },
            ].map(({ label, detail, icon: Icon, action }) => (
              <button
                type="button"
                onClick={() => {
                  setActionsOpen(false);
                  action();
                }}
                key={label}
              >
                <span><Icon size={15} /></span>
                <div><strong>{label}</strong><small>{detail}</small></div>
                <ArrowUp size={12} />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={`oai-composer__plus${actionsOpen ? " is-open" : ""}`}
          aria-label="More actions"
          aria-expanded={actionsOpen}
          onClick={() => setActionsOpen((current) => !current)}
        >
          <Plus size={19} />
        </button>
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Message OrbitX AI…"
          aria-label="Message OrbitX AI"
          rows={1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setActionsOpen(false);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <button
          type="button"
          className="oai-composer__send"
          aria-label={busy ? "Stop response" : "Send message"}
          disabled={!busy && !value.trim()}
          onClick={busy ? onStop : onSubmit}
        >
          {busy ? <X size={17} /> : <ArrowUp size={18} />}
        </button>
      </div>
      <p className="oai-composer-note">
        OrbitX can make mistakes. Verify financial data and approve every transaction in your wallet.
      </p>
    </div>
  );
}

function ConversationRail({
  open,
  conversations,
  activeId,
  onClose,
  onNew,
  onSelect,
  onDelete,
  onRename,
  onExport,
}: {
  open: boolean;
  conversations: AiConversation[];
  activeId: string | null;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onExport: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(normalized)
    );
  }, [conversations, query]);

  const finishRename = async (id: string) => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) return;
    try {
      await onRename(id, nextTitle);
      setEditingId(null);
      setTitleDraft("");
    } catch {
      // The parent surfaces the API error; keep the input open for correction.
    }
  };

  return (
    <>
      {open && <button type="button" className="oai-rail-scrim" onClick={onClose} aria-label="Close history" />}
      <aside className={`oai-rail${open ? " is-open" : ""}`}>
        <div className="oai-rail__brand">
          <div className="oai-brand">
            <AiMark compact />
            <div>
              <strong>OrbitX AI</strong>
              <span>Command everything</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close history">
            <PanelLeftClose size={18} />
          </button>
        </div>
        <button type="button" className="oai-new-chat" onClick={onNew}>
          <Plus size={16} /> New conversation
          <span>+</span>
        </button>
        <label className="oai-rail-search">
          <Search size={13} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </label>
        <div className="oai-rail__section">
          <span>{query ? "Matches" : "Recent"}</span>
          <small>{filteredConversations.length}</small>
        </div>
        <div className="oai-conversation-list">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`oai-conversation${activeId === conversation.id ? " is-active" : ""}`}
            >
              {editingId === conversation.id ? (
                <form
                  className="oai-conversation__edit"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void finishRename(conversation.id);
                  }}
                >
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setEditingId(null);
                        setTitleDraft("");
                      }
                    }}
                    maxLength={120}
                    autoFocus
                  />
                  <button type="submit" aria-label="Save conversation title">
                    <Check size={13} />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="oai-conversation__select"
                  onClick={() => onSelect(conversation.id)}
                >
                  <MessageCircle size={14} />
                  <span>
                    <strong>{conversation.title}</strong>
                    <small>{relativeTime(conversation.updatedAt)}</small>
                  </span>
                </button>
              )}
              {editingId !== conversation.id && (
                <div className="oai-conversation__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(conversation.id);
                      setTitleDraft(conversation.title);
                    }}
                    aria-label={`Rename ${conversation.title}`}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(conversation.id)}
                    aria-label={`Delete ${conversation.title}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredConversations.length === 0 && (
            <div className="oai-rail__empty">
              <MessageCircle size={22} />
              {query ? "No conversations match your search." : "Your conversations will appear here."}
            </div>
          )}
        </div>
        <button type="button" className="oai-rail__foot" onClick={onExport} disabled={!activeId}>
          <FileDown size={14} />
          <span>
            <strong>Export conversation</strong>
            Private Markdown backup
          </span>
        </button>
      </aside>
    </>
  );
}

const TOOL_CATEGORY_ORDER = [
  "All",
  "Markets",
  "Trade",
  "Wallet",
  "Launch",
  "NFT",
  "Social",
  "Media",
  "Platform",
] as const;

function toolDisplayName(name: string): string {
  return name
    .replace(/^orbitx_/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function CommandCenter({
  tools,
  onLaunch,
}: {
  tools: AiToolDefinition[];
  onLaunch: (tool: AiToolDefinition) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof TOOL_CATEGORY_ORDER)[number]>("All");
  const [showAll, setShowAll] = useState(false);
  const categoryCounts = useMemo(
    () =>
      tools.reduce<Record<string, number>>((counts, tool) => {
        counts[tool.category] = (counts[tool.category] || 0) + 1;
        return counts;
      }, {}),
    [tools],
  );
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (category !== "All" && tool.category !== category) return false;
      if (!normalized) return true;
      return (
        tool.name.toLowerCase().includes(normalized) ||
        tool.description.toLowerCase().includes(normalized) ||
        tool.category.toLowerCase().includes(normalized) ||
        tool.parameters.some((parameter) =>
          parameter.name.toLowerCase().includes(normalized)
        )
      );
    });
  }, [category, query, tools]);
  const visibleTools = showAll ? filteredTools : filteredTools.slice(0, 24);
  const instantCount = tools.filter((tool) => !tool.requiresConfirmation).length;

  return (
    <section className="oai-tab-page oai-tools-page">
      <div className="oai-tab-page__hero">
        <span className="oai-eyebrow">
          <Command size={13} /> Live MCP command center
        </span>
        <h1>One interface. <em>{tools.length} superpowers.</em></h1>
        <p>
          Discover every core OrbitX capability, then launch it through the guarded AI
          workflow with live data and explicit confirmation for write actions.
        </p>
      </div>

      <div className="oai-tool-stats">
        <div><strong>{tools.length}</strong><span>Live tools</span></div>
        <div><strong>{instantCount}</strong><span>Instant reads</span></div>
        <div><strong>{tools.length - instantCount}</strong><span>Guarded actions</span></div>
        <div><strong>{Object.keys(categoryCounts).length}</strong><span>Capability lanes</span></div>
      </div>

      <div className="oai-tool-browser">
        <label className="oai-tool-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowAll(false);
            }}
            placeholder="Search charts, wallets, launches, NFTs, social…"
          />
          <kbd>⌘ K</kbd>
        </label>
        <div className="oai-tool-categories" role="tablist" aria-label="Tool categories">
          {TOOL_CATEGORY_ORDER.filter(
            (item) => item === "All" || Boolean(categoryCounts[item]),
          ).map((item) => (
            <button
              type="button"
              className={category === item ? "is-active" : ""}
              onClick={() => {
                setCategory(item);
                setShowAll(false);
              }}
              key={item}
            >
              {item}
              <span>{item === "All" ? tools.length : categoryCounts[item] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="oai-tool-grid">
        {visibleTools.map((tool) => {
          const required = tool.parameters.filter((parameter) => parameter.required);
          return (
            <article className={`oai-tool-card is-${tool.category.toLowerCase()}`} key={tool.name}>
              <div className="oai-tool-card__head">
                <span className="oai-tool-card__icon"><Command size={16} /></span>
                <div>
                  <small>{tool.category}</small>
                  <h2>{toolDisplayName(tool.name)}</h2>
                </div>
                <span className={tool.requiresConfirmation ? "is-guarded" : "is-live"}>
                  {tool.requiresConfirmation ? <ShieldCheck size={10} /> : <Zap size={10} />}
                  {tool.requiresConfirmation ? "Guarded" : "Instant"}
                </span>
              </div>
              <p>{tool.description}</p>
              <div className="oai-tool-card__params">
                {required.slice(0, 4).map((parameter) => (
                  <span key={parameter.name}>{parameter.name}</span>
                ))}
                {required.length === 0 && <span>No required inputs</span>}
                {required.length > 4 && <span>+{required.length - 4}</span>}
              </div>
              <div className="oai-tool-card__foot">
                <code>{tool.name}</code>
                <button type="button" onClick={() => onLaunch(tool)}>
                  Open in chat <ArrowUp size={12} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="oai-tool-empty">
          <Search size={25} />
          <strong>No tool matched that search</strong>
          <span>Try a task like chart, wallet, NFT, launch, or social.</span>
        </div>
      )}
      {!showAll && filteredTools.length > visibleTools.length && (
        <button type="button" className="oai-tool-show-all" onClick={() => setShowAll(true)}>
          Show all {filteredTools.length} tools
        </button>
      )}
    </section>
  );
}

function CreateCenter({
  generations,
  busy,
  onGenerate,
}: {
  generations: AiGeneration[];
  busy: boolean;
  onGenerate: (
    kind: MediaKind,
    prompt: string,
    settings: Record<string, unknown>,
  ) => void;
}) {
  const [kind, setKind] = useState<MediaKind>("image");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [quality, setQuality] = useState(true);
  const [videoMode, setVideoMode] = useState("normal");
  const [duration, setDuration] = useState(10);

  const submit = () => {
    if (!prompt.trim()) {
      toast.error("Describe what you want to create");
      return;
    }
    onGenerate(
      kind,
      prompt,
      kind === "image"
        ? { aspect_ratio: aspect, enable_pro: quality, nsfw_checker: true }
        : {
            aspect_ratio: aspect,
            mode: videoMode,
            duration,
            resolution: "720p",
            nsfw_checker: true,
          },
    );
  };

  return (
    <section className="oai-tab-page oai-create-page">
      <div className="oai-tab-page__hero">
        <span className="oai-eyebrow">
          <Sparkles size={13} /> Grok Imagine studio
        </span>
        <h1>Turn ideas into <em>visual worlds.</em></h1>
        <p>Generate production-ready images and cinematic video without leaving OrbitX.</p>
      </div>
      <div className="oai-create-card">
        <div className="oai-mode-switch">
          <button
            type="button"
            className={kind === "image" ? "is-active" : ""}
            onClick={() => {
              setKind("image");
              if (aspect === "16:9") setAspect("1:1");
            }}
          >
            <ImageIcon size={15} /> Image
          </button>
          <button
            type="button"
            className={kind === "video" ? "is-active" : ""}
            onClick={() => {
              setKind("video");
              setAspect("16:9");
            }}
          >
            <Film size={15} /> Video
          </button>
        </div>
        <label className="oai-create-prompt">
          <span>Creative direction</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={
              kind === "image"
                ? "A futuristic Solana city floating above a neon ocean, editorial lighting…"
                : "Camera flies through a glowing crypto command center as live charts rise from the floor…"
            }
            rows={5}
          />
          <small>{prompt.length}/5000</small>
        </label>
        <div className="oai-create-settings">
          <div>
            <span>Aspect ratio</span>
            <div className="oai-chip-row">
              {["1:1", "3:2", "2:3", "16:9", "9:16"].map((option) => (
                <button
                  type="button"
                  className={aspect === option ? "is-active" : ""}
                  onClick={() => setAspect(option)}
                  key={option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          {kind === "image" ? (
            <div>
              <span>Render mode</span>
              <div className="oai-chip-row">
                <button type="button" className={!quality ? "is-active" : ""} onClick={() => setQuality(false)}>
                  Fast
                </button>
                <button type="button" className={quality ? "is-active" : ""} onClick={() => setQuality(true)}>
                  <Sparkles size={12} /> Pro
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <span>Motion</span>
                <div className="oai-chip-row">
                  {["normal", "fun", "spicy"].map((option) => (
                    <button
                      type="button"
                      className={videoMode === option ? "is-active" : ""}
                      onClick={() => setVideoMode(option)}
                      key={option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span>Duration</span>
                <div className="oai-chip-row">
                  {[6, 10, 15, 30].map((seconds) => (
                    <button
                      type="button"
                      className={duration === seconds ? "is-active" : ""}
                      onClick={() => setDuration(seconds)}
                      key={seconds}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <button type="button" className="oai-generate-btn" onClick={submit} disabled={busy || !prompt.trim()}>
          {busy ? <Loader2 className="oai-spin" size={18} /> : <WandSparkles size={18} />}
          {busy ? "Starting generation…" : `Generate ${kind}`}
          <span>Grok Imagine</span>
        </button>
      </div>

      <div className="oai-gallery-head">
        <div>
          <span className="oai-kicker">Your generations</span>
          <h2>Creation history</h2>
        </div>
        <span>{generations.length} projects</span>
      </div>
      <div className="oai-gallery">
        {generations.map((generation) => (
          <article className="oai-generation" key={generation.id}>
            <div className="oai-generation__visual">
              {generation.status === "success" && generation.resultUrls[0] ? (
                generation.kind === "video" ? (
                  <video src={generation.resultUrls[0]} controls playsInline preload="metadata" />
                ) : (
                  <img src={generation.resultUrls[0]} alt={generation.prompt} loading="lazy" />
                )
              ) : (
                <div className={`oai-generation__pending is-${generation.status}`}>
                  {generation.status === "failed" ? (
                    <X size={24} />
                  ) : generation.kind === "video" ? (
                    <Video size={24} />
                  ) : (
                    <ImageIcon size={24} />
                  )}
                  <strong>
                    {generation.status === "failed" ? "Generation failed" : "Creating your vision"}
                  </strong>
                  <span>{generation.error || "Grok Imagine is rendering…"}</span>
                </div>
              )}
              <span className="oai-generation__kind">
                {generation.kind === "video" ? <Video size={11} /> : <ImageIcon size={11} />}
                {generation.kind}
              </span>
              {generation.resultUrls[0] && (
                <a
                  href={generation.resultUrls[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="oai-generation__download"
                  aria-label="Open generated media"
                >
                  <Download size={14} />
                </a>
              )}
            </div>
            <div className="oai-generation__body">
              <p>{generation.prompt}</p>
              <span>
                {generation.model.replace("grok-imagine/", "")} · {relativeTime(generation.createdAt)}
              </span>
            </div>
          </article>
        ))}
        {generations.length === 0 && (
          <div className="oai-gallery-empty">
            <WandSparkles size={28} />
            <strong>Your canvas is ready</strong>
            <span>Describe an image or video above to begin.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function XStudio() {
  const [boot, setBoot] = useState<XMcpBootstrap | null>(null);
  const [queue, setQueue] = useState<XAgentQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"connect" | "generate" | "post" | null>(null);
  const [hint, setHint] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBoot, nextQueue] = await Promise.all([
        bootstrapXMcp(),
        listXAgentQueue(),
      ]);
      setBoot(nextBoot);
      setQueue(nextQueue.items || []);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not load X Studio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    setBusy("connect");
    try {
      await xStartLogin();
    } catch (connectError) {
      setBusy(null);
      toast.error(connectError instanceof Error ? connectError.message : "Could not connect X");
    }
  };

  const generate = async (idea?: string) => {
    setBusy("generate");
    setError(null);
    try {
      const result = await generateXAgentPost({
        hint: idea || hint || "Create a timely, useful OrbitX post idea.",
        postNow: false,
      });
      const text = result.draft?.text || String(result.item?.payload?.text || "");
      if (!text) throw new Error(result.message || result.error || "No draft returned");
      setDraft(text);
      if (result.item) setQueue((current) => [result.item!, ...current.filter((item) => item.id !== result.item?.id)]);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Could not generate an idea");
    } finally {
      setBusy(null);
    }
  };

  const postNow = async () => {
    if (!draft.trim()) return;
    if (!boot?.x.connected) {
      toast.error("Connect your X account before posting");
      return;
    }
    setBusy("post");
    setError(null);
    try {
      const { item } = await enqueueXAgentItem({
        text: draft.trim(),
        kind: "post",
        status: "pending",
      });
      await approveXAgentQueueItem(item.id);
      toast.success("Posted to X");
      setDraft("");
      await refresh();
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Could not post to X");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <section className="oai-tab-page oai-x-page oai-tab-loading">
        <Loader2 className="oai-spin" />
        Loading your X agent…
      </section>
    );
  }

  const connected = Boolean(boot?.x.connected);
  return (
    <section className="oai-tab-page oai-x-page">
      <div className="oai-tab-page__hero oai-x-hero">
        <span className="oai-eyebrow">
          <X size={13} /> NVIDIA-powered social studio
        </span>
        <h1>Own your voice. <em>Multiply your signal.</em></h1>
        <p>Train ideas, refine posts, and publish through your securely connected X account.</p>
      </div>
      <div className={`oai-x-account${connected ? " is-connected" : ""}`}>
        <div className="oai-x-account__avatar">
          {boot?.x.avatar ? <img src={boot.x.avatar} alt="" /> : <X size={23} />}
          {connected && <span><Check size={10} /></span>}
        </div>
        <div>
          <span className="oai-kicker">{connected ? "Connected account" : "Account required"}</span>
          <strong>{connected ? `@${boot?.x.username}` : "Connect your X account"}</strong>
          <p>
            {connected
              ? "OAuth is active. OrbitX can draft and publish with your approval."
              : "Authorize tweet.write so your agent can publish ideas you approve."}
          </p>
        </div>
        <button type="button" onClick={connect} disabled={busy === "connect"}>
          {busy === "connect" ? <Loader2 className="oai-spin" size={14} /> : connected ? <RefreshCw size={14} /> : <X size={14} />}
          {connected ? "Reconnect" : "Connect X"}
        </button>
      </div>

      {error && <div className="oai-inline-error">{error}</div>}

      <div className="oai-x-grid">
        <div className="oai-x-composer">
          <div className="oai-x-composer__head">
            <div>
              <span className="oai-kicker">AI post lab</span>
              <h2>Make something worth reading</h2>
            </div>
            <span className="oai-live-pill">
              <i /> NVIDIA NIM
            </span>
          </div>
          <label>
            <span>What should the post be about?</span>
            <input
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              placeholder="A specific angle, announcement, or market insight…"
            />
          </label>
          <div className="oai-x-ideas">
            {X_IDEA_PROMPTS.map((idea) => (
              <button type="button" onClick={() => void generate(idea)} key={idea}>
                <Sparkles size={12} /> {idea}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="oai-x-generate"
            disabled={busy === "generate"}
            onClick={() => void generate()}
          >
            {busy === "generate" ? <Loader2 className="oai-spin" size={16} /> : <WandSparkles size={16} />}
            Generate post idea
          </button>
          <label className="oai-x-draft">
            <span>Draft</span>
            <textarea
              rows={7}
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 280))}
              placeholder="Your AI-generated draft will appear here. You stay in control."
            />
            <small className={draft.length > 260 ? "is-warn" : ""}>{draft.length}/280</small>
          </label>
          <div className="oai-x-composer__actions">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(draft);
                toast.success("Draft copied");
              }}
              disabled={!draft}
            >
              <Copy size={14} /> Copy
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => void postNow()}
              disabled={!draft.trim() || busy === "post"}
            >
              {busy === "post" ? <Loader2 className="oai-spin" size={14} /> : <Send size={14} />}
              Post to X
            </button>
          </div>
        </div>

        <aside className="oai-x-queue">
          <div className="oai-x-queue__head">
            <div>
              <span className="oai-kicker">Agent activity</span>
              <h2>Recent queue</h2>
            </div>
            <button type="button" onClick={() => void refresh()} aria-label="Refresh queue">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="oai-x-queue__list">
            {queue.slice(0, 8).map((item) => (
              <article key={item.id}>
                <p>{String(item.payload?.text || "Queued X action")}</p>
                <div>
                  <span className={`is-${item.status}`}>{item.status}</span>
                  <time>{item.createdAt ? relativeTime(item.createdAt) : "now"}</time>
                </div>
              </article>
            ))}
            {queue.length === 0 && (
              <div className="oai-x-queue__empty">
                <Clock3 size={22} />
                <strong>No posts yet</strong>
                Generate your first idea to start the queue.
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function SendAssetModal({
  open,
  onClose,
  gatedWalletAddress,
}: {
  open: boolean;
  onClose: () => void;
  gatedWalletAddress: string | null;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [asset, setAsset] = useState<SendAsset>("SOL");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [mint, setMint] = useState("");
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSignature(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;
  const connectedWalletAddress = publicKey?.toBase58() || null;
  const walletMatchesGate =
    Boolean(gatedWalletAddress) && connectedWalletAddress === gatedWalletAddress;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!gatedWalletAddress) {
      toast.error("Sign in with a wallet before sending tokens");
      return;
    }
    if (!walletMatchesGate) {
      toast.error("Reconnect the wallet that passed the OrbitX access check");
      return;
    }
    setBusy(true);
    try {
      const destination = new PublicKey(recipient.trim());
      const transaction = new Transaction();
      if (asset === "SOL") {
        const lamports = amountToBaseUnits(amount, SOL_DECIMALS);
        if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("SOL amount is too large");
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: destination,
            lamports: Number(lamports),
          }),
        );
      } else {
        const mintAddress = asset === "ORBITX" ? AGENT_HOLD_MINT : mint.trim();
        const mintKey = new PublicKey(mintAddress);
        const mintInfo = await getMint(connection, mintKey, "confirmed");
        const units = amountToBaseUnits(amount, mintInfo.decimals);
        const sourceAta = getAssociatedTokenAddressSync(mintKey, publicKey);
        const destinationAta = getAssociatedTokenAddressSync(mintKey, destination);
        if (!(await connection.getAccountInfo(sourceAta, "confirmed"))) {
          throw new Error("Your wallet does not have a token account for this mint");
        }
        if (!(await connection.getAccountInfo(destinationAta, "confirmed"))) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              destinationAta,
              destination,
              mintKey,
            ),
          );
        }
        transaction.add(
          createTransferCheckedInstruction(
            sourceAta,
            mintKey,
            destinationAta,
            publicKey,
            units,
            mintInfo.decimals,
          ),
        );
      }

      const latest = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = latest.blockhash;
      transaction.feePayer = publicKey;
      const nextSignature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(
        { signature: nextSignature, ...latest },
        "confirmed",
      );
      setSignature(nextSignature);
      toast.success("Transfer confirmed");
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="oai-modal" role="dialog" aria-modal="true" aria-label="Send tokens">
      <button type="button" className="oai-modal__scrim" onClick={onClose} aria-label="Close" />
      <form className="oai-sheet" onSubmit={submit}>
        <div className="oai-sheet__handle" />
        <div className="oai-sheet__head">
          <div>
            <span className="oai-kicker">Non-custodial transfer</span>
            <h2>Send tokens</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close send tokens">
            <X size={18} />
          </button>
        </div>
        {signature ? (
          <div className="oai-send-success">
            <span><Check size={24} /></span>
            <h3>Transfer confirmed</h3>
            <p>Your wallet signed and the Solana network confirmed the transaction.</p>
            <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer">
              View on Solscan <ExternalLink size={13} />
            </a>
            <button type="button" className="oai-primary-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            {!walletMatchesGate && (
              <div className="oai-wallet-mismatch" role="alert">
                <ShieldCheck size={17} />
                <div>
                  <strong>Reconnect your verified wallet</strong>
                  <span>
                    Transfers are restricted to {shortAddress(gatedWalletAddress)}, the wallet
                    that passed this session&apos;s access check.
                  </span>
                </div>
                <WalletConnectButton />
              </div>
            )}
            <div className="oai-asset-switch">
              {(["SOL", "ORBITX", "CUSTOM"] as SendAsset[]).map((option) => (
                <button
                  type="button"
                  className={asset === option ? "is-active" : ""}
                  onClick={() => setAsset(option)}
                  key={option}
                >
                  {option === "CUSTOM" ? "SPL token" : option}
                </button>
              ))}
            </div>
            <label className="oai-field">
              <span>Recipient wallet</span>
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="Solana address"
                autoComplete="off"
                required
              />
            </label>
            {asset === "CUSTOM" && (
              <label className="oai-field">
                <span>Token mint</span>
                <input
                  value={mint}
                  onChange={(event) => setMint(event.target.value)}
                  placeholder="SPL token mint address"
                  autoComplete="off"
                  required
                />
              </label>
            )}
            <label className="oai-field">
              <span>Amount</span>
              <div className="oai-amount-field">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
                <strong>{asset === "CUSTOM" ? "TOKEN" : asset}</strong>
              </div>
            </label>
            <div className="oai-security-note">
              <ShieldCheck size={16} />
              <span>
                OrbitX builds the transfer locally. Your wallet shows the final details and
                must approve before anything moves.
              </span>
            </div>
            <button
              type="submit"
              className="oai-primary-btn oai-sheet__submit"
              disabled={busy || !walletMatchesGate}
            >
              {busy ? <Loader2 className="oai-spin" size={16} /> : <Wallet size={16} />}
              {busy ? "Waiting for confirmation…" : "Review in wallet"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function ChartModal({
  open,
  onClose,
  onRun,
}: {
  open: boolean;
  onClose: () => void;
  onRun: (mint: string, interval: string) => void;
}) {
  const [mint, setMint] = useState("");
  const [interval, setInterval] = useState("15m");
  if (!open) return null;
  return (
    <div className="oai-modal" role="dialog" aria-modal="true" aria-label="Open live chart">
      <button type="button" className="oai-modal__scrim" onClick={onClose} aria-label="Close" />
      <form
        className="oai-sheet oai-sheet--small"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mint.trim()) return;
          onRun(mint.trim(), interval);
          setMint("");
        }}
      >
        <div className="oai-sheet__handle" />
        <div className="oai-sheet__head">
          <div>
            <span className="oai-kicker">MCP live tool</span>
            <h2>Open token chart</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close chart">
            <X size={18} />
          </button>
        </div>
        <label className="oai-field">
          <span>Contract address</span>
          <input
            value={mint}
            onChange={(event) => setMint(event.target.value)}
            placeholder="Solana mint or EVM address"
            required
          />
        </label>
        <div className="oai-create-settings">
          <div>
            <span>Interval</span>
            <div className="oai-chip-row">
              {["5m", "15m", "1h", "4h", "24h"].map((option) => (
                <button
                  type="button"
                  className={interval === option ? "is-active" : ""}
                  onClick={() => setInterval(option)}
                  key={option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button type="submit" className="oai-primary-btn oai-sheet__submit">
          <BarChart3 size={16} /> Load live chart
        </button>
      </form>
    </div>
  );
}

export default function OrbitXAI() {
  const { user, loading: authLoading } = useAuth();
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [gate, setGate] = useState<AiGate | null>(null);
  const [bootstrap, setBootstrap] = useState<AiBootstrap | null>(null);
  const [tab, setTab] = useState<AiTab>("chat");
  const [railOpen, setRailOpen] = useState(false);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [generations, setGenerations] = useState<AiGeneration[]>([]);
  const [generating, setGenerating] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [chartModal, setChartModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => streamAbortRef.current?.abort();
  }, []);

  const refreshAccess = useCallback(async () => {
    if (!user) {
      setAccessLoading(false);
      setGate(null);
      setBootstrap(null);
      return;
    }
    setAccessLoading(true);
    setAccessError(null);
    try {
      const gateResponse = await fetchAiGate();
      setGate(gateResponse.gate);
      if (!gateResponse.gate.hasAccess) {
        setBootstrap(null);
        return;
      }
      const data = await bootstrapOrbitXAi();
      setBootstrap(data);
      setGate(data.gate);
      setConversations(data.conversations);
      setGenerations(data.generations);
      setSelectedModel((current) => current || data.defaultModel);
      setActiveId((current) =>
        current && data.conversations.some((conversation) => conversation.id === current)
          ? current
          : data.conversations[0]?.id || null,
      );
    } catch (refreshError) {
      setAccessError(
        refreshError instanceof Error ? refreshError.message : "Could not open OrbitX AI",
      );
    } finally {
      setAccessLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshAccess();
  }, [authLoading, refreshAccess]);

  useEffect(() => {
    const openCommandCenter = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setTab("tools");
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>(".oai-tool-search input")?.focus();
      });
    };
    window.addEventListener("keydown", openCommandCenter);
    return () => window.removeEventListener("keydown", openCommandCenter);
  }, []);

  useEffect(() => {
    if (!activeId || !bootstrap) {
      setMessages([]);
      return;
    }
    let alive = true;
    setMessagesLoading(true);
    void fetchAiMessages(activeId)
      .then((result) => {
        if (alive) setMessages(result.messages);
      })
      .catch((messageError) => {
        if (alive) toast.error(messageError instanceof Error ? messageError.message : "Could not load conversation");
      })
      .finally(() => {
        if (alive) setMessagesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeId, bootstrap]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: messages.length > 2 ? "smooth" : "auto" });
  }, [messages, sending]);

  const pendingGenerationIds = useMemo(
    () =>
      generations
        .filter((generation) => ["queued", "waiting", "processing"].includes(generation.status))
        .map((generation) => generation.id),
    [generations],
  );

  useEffect(() => {
    if (!pendingGenerationIds.length) return;
    const poll = async () => {
      const updates = await Promise.allSettled(
        pendingGenerationIds.map((id) => pollAiMedia(id)),
      );
      setGenerations((current) =>
        current.map((generation) => {
          const index = pendingGenerationIds.indexOf(generation.id);
          if (index < 0) return generation;
          const update = updates[index];
          return update?.status === "fulfilled" ? update.value.generation : generation;
        }),
      );
    };
    const timer = window.setInterval(() => void poll(), 7_000);
    return () => window.clearInterval(timer);
  }, [pendingGenerationIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const newConversation = async () => {
    setActiveId(null);
    setMessages([]);
    setComposer("");
    setRailOpen(false);
    if (!selectedModel) return;
    try {
      const result = await createAiConversation(selectedModel);
      setConversations((current) => [result.conversation, ...current]);
      setActiveId(result.conversation.id);
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : "Could not create chat");
    }
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
    setRailOpen(false);
    setTab("chat");
  };

  const removeConversation = async (id: string) => {
    try {
      await deleteAiConversation(id);
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not delete chat");
    }
  };

  const renameConversation = async (id: string, title: string) => {
    try {
      const result = await renameAiConversation(id, title);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id ? result.conversation : conversation
        )
      );
      toast.success("Conversation renamed");
    } catch (renameError) {
      toast.error(renameError instanceof Error ? renameError.message : "Could not rename chat");
      throw renameError;
    }
  };

  const exportConversation = () => {
    const conversation = conversations.find((item) => item.id === activeId);
    if (!conversation || messages.length === 0) {
      toast.error("There is no conversation to export yet");
      return;
    }
    const sections = messages.map((message) => {
      const role =
        message.role === "user"
          ? "You"
          : message.role === "tool"
            ? "OrbitX Action"
            : "OrbitX AI";
      const events = message.toolEvents.length
        ? `\n\n${message.toolEvents
            .map((event) => `- \`${event.tool}\` — ${event.status}`)
            .join("\n")}`
        : "";
      return `## ${role}\n\n${message.content}${events}`;
    });
    const markdown = [
      `# ${conversation.title}`,
      "",
      `Exported from OrbitX AI on ${new Date().toISOString()}`,
      "",
      ...sections,
      "",
    ].join("\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${conversation.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "orbitx-chat"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation exported");
  };

  const sendMessage = async (override?: string) => {
    const prompt = (override ?? composer).trim();
    if (!prompt || sending) return;
    setTab("chat");
    setComposer("");
    setSending(true);
    setStreamStatus("Connecting to OrbitX AI…");
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const streamId = `stream-${Date.now()}`;
    const temporary: AiMessage = {
      id: `local-${Date.now()}`,
      conversationId: activeId || "new",
      role: "user",
      content: prompt,
      model: selectedModel,
      toolEvents: [],
      metadata: {},
      createdAt: new Date().toISOString(),
    };
    let streamedContent = "";
    let streamedEvents: AiToolEvent[] = [];
    let streamConversationId = activeId || "new";
    let savedUserMessage: AiMessage | null = null;

    const renderStream = () => {
      const streamingMessage: AiMessage = {
        id: streamId,
        conversationId: streamConversationId,
        role: "assistant",
        content: streamedContent,
        model: selectedModel,
        toolEvents: streamedEvents,
        metadata: { streaming: true },
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => {
        const exists = current.some((message) => message.id === streamId);
        return exists
          ? current.map((message) => (message.id === streamId ? streamingMessage : message))
          : [...current, streamingMessage];
      });
    };

    setMessages((current) => [...current, temporary]);
    try {
      const result = await streamAiMessage(
        {
          conversationId: activeId,
          message: prompt,
          model: selectedModel,
        },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === "status") {
              setStreamStatus(event.message);
            } else if (event.type === "conversation") {
              streamConversationId = event.conversation.id;
              setConversations((current) => [
                event.conversation,
                ...current.filter(
                  (conversation) => conversation.id !== event.conversation.id,
                ),
              ]);
            } else if (event.type === "user_message") {
              savedUserMessage = event.message;
            } else if (event.type === "delta") {
              streamedContent += event.delta;
              setStreamStatus("Responding live…");
              renderStream();
            } else if (event.type === "reset") {
              streamedContent = "";
              renderStream();
            } else if (event.type === "tool") {
              streamedEvents = [
                ...streamedEvents.filter((item) => item.id !== event.event.id),
                event.event,
              ];
              renderStream();
            }
          },
        },
      );
      setActiveId(result.conversation.id);
      setConversations((current) => [
        result.conversation,
        ...current.filter((conversation) => conversation.id !== result.conversation.id),
      ]);
      setMessages((current) => [
        ...current.filter(
          (message) => message.id !== temporary.id && message.id !== streamId,
        ),
        result.userMessage,
        result.assistantMessage,
      ]);
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "OrbitX AI could not respond";
      setMessages((current) =>
        current.map((item) => {
          if (item.id === temporary.id && savedUserMessage) return savedUserMessage;
          if (item.id !== streamId) return item;
          return {
            ...item,
            content:
              item.content ||
              (message.includes("stopped")
                ? "Response stopped."
                : "I couldn't finish that response. Please retry."),
            metadata: { ...item.metadata, streaming: false, incomplete: true },
          };
        }),
      );
      if (!message.includes("stopped")) setComposer(prompt);
      toast.error(message);
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      setStreamStatus("");
      setSending(false);
    }
  };

  const stopResponse = () => {
    setStreamStatus("Stopping response…");
    streamAbortRef.current?.abort();
  };

  const launchTool = (tool: AiToolDefinition) => {
    const requiredInputs = tool.parameters
      .filter((parameter) => parameter.required)
      .map((parameter) => parameter.name);
    const inputInstruction = requiredInputs.length
      ? `Ask me only for any missing required inputs (${requiredInputs.join(", ")}) before running it.`
      : "Run it now using my authenticated OrbitX session.";
    void sendMessage(
      `Use the exact OrbitX MCP tool \`${tool.name}\` for this task. ${inputInstruction} ` +
      "Show the live result clearly and explain any risk or confirmation step.",
    );
  };

  const confirmTool = async (messageId: string, event: AiToolEvent) => {
    if (!activeId) {
      toast.error("Open the conversation before confirming this action");
      return;
    }
    setConfirming(event.id);
    try {
      const result = await executeAiTool({
        conversationId: activeId,
        messageId,
        eventId: event.id,
      });
      setMessages((current) => {
        const updated = current.map((message) => ({
          ...message,
          toolEvents: message.toolEvents.map((item) =>
            item.id === event.id ? result.event : item,
          ),
        }));
        return result.message ? [...updated, result.message] : updated;
      });
      if (result.ok && result.event.status === "completed") {
        toast.success("OrbitX action completed");
      } else {
        toast.error("OrbitX action failed. Review the result card for details.");
      }
    } catch (toolError) {
      toast.error(toolError instanceof Error ? toolError.message : "Action failed");
    } finally {
      setConfirming(null);
    }
  };

  const cancelTool = async (messageId: string, event: AiToolEvent) => {
    if (!activeId) return;
    setConfirming(event.id);
    try {
      const result = await cancelAiTool({
        conversationId: activeId,
        messageId,
        eventId: event.id,
      });
      setMessages((current) =>
        current.map((message) => ({
          ...message,
          toolEvents: message.toolEvents.map((item) =>
            item.id === event.id ? result.event : item,
          ),
        }))
      );
      toast.success(event.status === "executing" ? "Timed-out action closed" : "Action cancelled");
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : "Could not cancel action");
    } finally {
      setConfirming(null);
    }
  };

  const generateMedia = async (
    kind: MediaKind,
    prompt: string,
    settings: Record<string, unknown>,
  ) => {
    setGenerating(true);
    try {
      const result = await generateAiMedia({
        kind,
        prompt,
        conversationId: activeId,
        settings,
      });
      setGenerations((current) => [
        result.generation,
        ...current.filter((generation) => generation.id !== result.generation.id),
      ]);
      toast.success(`${kind === "video" ? "Video" : "Image"} generation started`);
    } catch (generateError) {
      toast.error(generateError instanceof Error ? generateError.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (authLoading || accessLoading) return <LoadingScreen />;
  if (!bootstrap || !gate?.hasAccess) {
    return (
      <LockedScreen gate={gate} error={accessError} onRetry={() => void refreshAccess()} />
    );
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);
  const modelLabel =
    bootstrap.models.find((model) => model.id === selectedModel)?.label || "NVIDIA NIM";
  const liveTyping = messages.some(
    (message) => message.role === "assistant" && message.metadata.streaming === true,
  );

  return (
    <div className="oai-root oai-app">
      <ConversationRail
        open={railOpen}
        conversations={conversations}
        activeId={activeId}
        onClose={() => setRailOpen(false)}
        onNew={() => void newConversation()}
        onSelect={selectConversation}
        onDelete={(id) => void removeConversation(id)}
        onRename={renameConversation}
        onExport={exportConversation}
      />
      <div className="oai-app__shell">
        <header className="oai-topbar">
          <div className="oai-topbar__left">
            <button
              type="button"
              className="oai-icon-btn"
              onClick={() => setRailOpen(true)}
              aria-label="Open conversation history"
            >
              <Menu size={18} />
            </button>
            <div className="oai-brand oai-brand--mobile">
              <AiMark compact />
              <div>
                <strong>OrbitX AI</strong>
                <span>{activeConversation?.title || "New conversation"}</span>
              </div>
            </div>
          </div>
          <div className="oai-model-wrap">
            <button
              type="button"
              className="oai-model-btn"
              onClick={() => setModelOpen((current) => !current)}
            >
              <span><i /> {modelLabel}</span>
              <ChevronDown size={13} />
            </button>
            {modelOpen && (
              <div className="oai-model-menu">
                <span>Choose intelligence</span>
                {bootstrap.models.map((model) => (
                  <button
                    type="button"
                    className={model.id === selectedModel ? "is-active" : ""}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setModelOpen(false);
                    }}
                    key={model.id}
                  >
                    <div>
                      <strong>{model.label}</strong>
                      <small>{model.id}</small>
                    </div>
                    {model.id === selectedModel && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="oai-topbar__right">
            <span className="oai-wallet-pill">
              <i />
              {shortAddress(bootstrap.walletAddress)}
            </span>
            <button
              type="button"
              className="oai-icon-btn"
              onClick={() => setRailOpen(true)}
              aria-label="Conversation history"
            >
              <History size={17} />
            </button>
            <WalletConnectButton />
          </div>
        </header>

        <main className="oai-main">
          {tab === "chat" && (
            <section className="oai-chat">
              <div className="oai-chat__scroll" ref={scrollRef}>
                {messagesLoading ? (
                  <div className="oai-chat-loading">
                    <Loader2 className="oai-spin" size={20} /> Loading conversation…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="oai-welcome">
                    <AiMark />
                    <span className="oai-eyebrow">
                      <i /> MCP tools online
                    </span>
                    <h1>What will we <em>build today?</em></h1>
                    <p>
                      Markets, wallets, charts, launches, media, X, and every OrbitX
                      intelligence tool — in one conversation.
                    </p>
                    <div className="oai-starters">
                      {STARTER_PROMPTS.map(({ icon: Icon, title, prompt, tone }) => (
                        <button
                          type="button"
                          className={`is-${tone}`}
                          onClick={() => void sendMessage(prompt)}
                          key={title}
                        >
                          <span><Icon size={17} /></span>
                          <strong>{title}</strong>
                          <small>{prompt}</small>
                        </button>
                      ))}
                    </div>
                    <div className="oai-capabilities">
                      <span><BarChart3 /> Live charts</span>
                      <span><CircleDollarSign /> Token actions</span>
                      <span><ImageIcon /> Grok media</span>
                      <span><X /> X agent</span>
                    </div>
                  </div>
                ) : (
                  <div className="oai-message-list">
                    {messages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        confirming={confirming}
                        onConfirm={(messageId, event) => void confirmTool(messageId, event)}
                        onCancel={(messageId, event) => void cancelTool(messageId, event)}
                      />
                    ))}
                    {sending && !liveTyping && (
                      <div className="oai-thinking">
                        <div className="oai-message__avatar"><AiMark compact /></div>
                        <div>
                          <span />
                          <span />
                          <span />
                          <small>{streamStatus || "OrbitX is preparing a live response…"}</small>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Composer
                value={composer}
                busy={sending}
                onChange={setComposer}
                onSubmit={() => void sendMessage()}
                onStop={stopResponse}
                onSendAsset={() => setSendModal(true)}
                onChart={() => setChartModal(true)}
                onTools={() => setTab("tools")}
                onCreate={() => setTab("create")}
                onXStudio={() => setTab("x")}
                toolCount={bootstrap.tools.length}
              />
            </section>
          )}
          {tab === "tools" && (
            <CommandCenter tools={bootstrap.tools || []} onLaunch={launchTool} />
          )}
          {tab === "create" && (
            <CreateCenter
              generations={generations}
              busy={generating}
              onGenerate={(kind, prompt, settings) => void generateMedia(kind, prompt, settings)}
            />
          )}
          {tab === "x" && <XStudio />}
        </main>

        <nav className="oai-tabbar" aria-label="OrbitX AI sections">
          {TAB_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              className={tab === id ? "is-active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              <span><Icon size={18} /></span>
              <small>{label}</small>
            </button>
          ))}
          <span
            className="oai-tabbar__indicator"
            style={{ transform: `translateX(${TAB_ITEMS.findIndex((item) => item.id === tab) * 100}%)` }}
          />
        </nav>
      </div>

      <SendAssetModal
        open={sendModal}
        onClose={() => setSendModal(false)}
        gatedWalletAddress={bootstrap.walletAddress}
      />
      <ChartModal
        open={chartModal}
        onClose={() => setChartModal(false)}
        onRun={(mint, interval) => {
          setChartModal(false);
          void sendMessage(`Show me the live ${interval} chart for ${mint}. Include price, liquidity, volume, market cap, and risk context.`);
        }}
      />
    </div>
  );
}
