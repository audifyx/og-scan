/**
 * SocialPanels — Team E social layer for the OG Scanner v2.
 *
 * Imported by Team B's TokenScanner page:
 *   import { ScanCard, CommunityNotes, SignalVoting, ScanFeedAlerts, SocialPanels }
 *     from "../components/SocialPanels";
 *
 * Every component renders from props only (ScanCard) or from localStorage
 * via useScanSocial (notes / votes). Nothing here invents social proof:
 * notes and votes start empty, tallies are labelled "on this device".
 *
 * Design (standing user rule): black/blue/white/gold only, high contrast
 * (white text on black panels, black text on gold buttons), custom inline
 * SVG icons — no emoji anywhere.
 */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ALERT_EVAL_GAP,
  ALERT_TRIGGER_META,
  alertRuleBackendSupport,
  describeRule,
  useAlertBuilder,
  type AlertComparison,
  type AlertRuleInput,
  type AlertSeverity,
  type AlertTriggerType,
  type FiredAlert,
} from "../hooks/useAlertBuilder";
import {
  FEED_ALERT_GAP,
  buildScanFeedPost,
  relativeTime,
  scanAlertDeepLink,
  scanShareText,
  scanSignalAlertSupport,
  scanUrl,
  useScanSocial,
  type ScanSignal,
  type SignalVote,
} from "../hooks/useScanSocial";

/* ── theme ─────────────────────────────────────────────────────────────── */

const GOLD = "#e8b84a";
const BLUE = "#6ea8ff";
const GREEN = "#3dd68c";
const RED = "#ff5c5c";
const PANEL: CSSProperties = {
  background: "#000000",
  border: "1px solid rgba(232, 184, 74, 0.28)",
  borderRadius: "12px",
  padding: "1rem",
  color: "#ffffff",
};
const H3: CSSProperties = { color: GOLD, fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" };
const MUTED: CSSProperties = { color: "#b8b8b8", fontSize: "0.85rem" };
const GOLD_BTN: CSSProperties = {
  background: GOLD,
  color: "#000000",
  border: "none",
  borderRadius: 999,
  padding: "0.45rem 0.9rem",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
};
const GHOST_BTN: CSSProperties = {
  ...GOLD_BTN,
  background: "transparent",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.4)",
};

/* ── tiny inline SVG icons (no emoji, no icon font) ────────────────────── */

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICON_LINK = "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71";
const ICON_LINK2 = "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71";
const ICON_SHARE = "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13";
const ICON_COPY = "M9 9h13v13H9z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1";
const ICON_CHECK = "M20 6L9 17l-5-5";
const ICON_BELL = "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0";
const ICON_WARN = "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01";
const ICON_UP = "M23 6l-9.5 9.5-5-5L1 18";
const ICON_DOWN = "M23 18l-9.5-9.5-5 5L1 6";
const ICON_EYE = "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z";
const ICON_EYE_CIRCLE = "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0";

/* ── ScanCard ──────────────────────────────────────────────────────────── */

export type ScanVerdictState = "pass" | "warn" | "fail" | "unknown";

export interface ScanCardProps {
  mint: string;
  name?: string | null;
  symbol?: string | null;
  /** OG score 0–100, higher = safer. Null = unknown. */
  ogScore?: number | null;
  ogBand?: string | null;
  /** Composed risk 0–100, higher = riskier. Null = unknown. */
  riskScore?: number | null;
  riskLabel?: string | null;
  bundledSupplyPct?: number | null;
  bundleRisk?: "low" | "moderate" | "high" | null;
  /** Top-line verdict, e.g. "High bundle risk — 34.2% bundled". */
  verdict: string;
  verdictState?: ScanVerdictState;
  scannedAt?: number | null;
}

const VERDICT_COLOR: Record<ScanVerdictState, string> = {
  pass: GREEN,
  warn: GOLD,
  fail: RED,
  unknown: "#b8b8b8",
};

/**
 * Shareable scan card. Renders from props only — no fetching, no storage.
 * Copy button copies the scanner link (`/intel/scan/:mint`); Share uses
 * the native share sheet where available and falls back to copy.
 */
export function ScanCard(props: ScanCardProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const url = scanUrl(props.mint);
  const title = props.symbol ? `$${props.symbol}` : props.name || "Token scan";
  const state = props.verdictState ?? "unknown";
  const bundleLabel =
    props.bundledSupplyPct != null
      ? `${props.bundledSupplyPct.toFixed(1)}% bundled`
      : props.bundleRisk
        ? `Bundle risk: ${props.bundleRisk}`
        : "Bundle: unknown";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    const text = scanShareText(props.symbol, props.ogScore);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `OrbitX scan: ${title}`, text, url });
        setShared(true);
        window.setTimeout(() => setShared(false), 2000);
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await copyLink();
  }

  return (
    <div style={PANEL} data-testid="scan-card">
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.15rem", fontWeight: 800 }}>{title}</span>
        {props.name && props.symbol && (
          <span style={MUTED}>{props.name}</span>
        )}
        <span style={{ marginLeft: "auto", ...MUTED, fontFamily: "monospace", fontSize: "0.75rem" }}>
          {props.mint.slice(0, 4)}…{props.mint.slice(-4)}
        </span>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
        <div>
          <div style={{ ...MUTED, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>OG score</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ffffff" }}>
            {props.ogScore == null ? "—" : `${props.ogScore}/100`}
          </div>
          <div style={{ ...MUTED }}>{props.ogBand ?? (props.ogScore == null ? "Unknown" : "")}</div>
        </div>
        <div>
          <div style={{ ...MUTED, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Risk</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ffffff" }}>
            {props.riskScore == null ? "—" : `${props.riskScore}/100`}
          </div>
          <div style={{ ...MUTED }}>{props.riskLabel ?? (props.riskScore == null ? "Unknown" : "")}</div>
        </div>
        <div>
          <div style={{ ...MUTED, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Bundle</div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", marginTop: "0.35rem" }}>{bundleLabel}</div>
        </div>
      </div>

      <p style={{
        margin: "0.75rem 0 0",
        color: VERDICT_COLOR[state],
        border: `1px solid ${VERDICT_COLOR[state]}`,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.2rem 0.65rem",
        fontSize: "0.8rem",
        fontWeight: 700,
      }}>
        <Icon d={state === "fail" || state === "warn" ? ICON_WARN : ICON_CHECK} size={13} />
        {props.verdict}
      </p>

      {props.scannedAt ? (
        <p style={{ ...MUTED, margin: "0.5rem 0 0" }}>Scanned {relativeTime(props.scannedAt)}</p>
      ) : null}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.9rem", flexWrap: "wrap" }}>
        <button type="button" onClick={() => void copyLink()} style={GOLD_BTN}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <Icon d={ICON_COPY} size={13} /> {copied ? "Link copied" : "Copy scan link"}
          </span>
        </button>
        <button type="button" onClick={() => void share()} style={GHOST_BTN}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <Icon d={ICON_SHARE} size={13} /> {shared ? "Shared" : "Share"}
          </span>
        </button>
        <a href={url} style={{ ...GHOST_BTN, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <Icon d={ICON_LINK} size={13} /> Open scan
        </a>
      </div>
    </div>
  );
}

/* ── CommunityNotes ────────────────────────────────────────────────────── */

export interface CommunityNotesProps {
  mint: string;
}

/**
 * Per-token community notes, localStorage-first (no backend, no seeding).
 * Newest first, relative timestamps. Empty state: "No notes yet — be the
 * first". Authors may attach an optional handle; it is unverified text.
 */
export function CommunityNotes({ mint }: CommunityNotesProps) {
  const { notes, addNoteText, removeNote, maxNoteChars } = useScanSocial(mint);
  const [draft, setDraft] = useState("");
  const [handle, setHandle] = useState("");

  function submit() {
    if (!draft.trim()) return;
    addNoteText(draft, handle || null);
    setDraft("");
  }

  return (
    <div style={PANEL} data-testid="community-notes">
      <h3 style={H3}>Community notes</h3>
      <p style={{ ...MUTED, margin: "0 0 0.75rem" }}>
        Notes on this token, stored on this device only. Handles are unverified.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@handle (optional)"
          aria-label="Your handle (optional)"
          style={{
            background: "#111111", color: "#ffffff", border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 8, padding: "0.5rem 0.65rem", fontSize: "0.85rem", width: 140,
          }}
        />
        <span style={{ ...MUTED, alignSelf: "center" }}>{maxNoteChars - draft.length} chars left</span>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, maxNoteChars))}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Add a note about this token…"
          aria-label="Add a note"
          style={{
            flex: 1, background: "#111111", color: "#ffffff", border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 8, padding: "0.5rem 0.65rem", fontSize: "0.85rem",
          }}
        />
        <button type="button" onClick={submit} disabled={!draft.trim()} style={{ ...GOLD_BTN, opacity: draft.trim() ? 1 : 0.5 }}>
          Post
        </button>
      </div>

      {notes.length === 0 ? (
        <p style={{ ...MUTED, margin: "0.9rem 0 0" }}>No notes yet — be the first.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: "0.9rem 0 0", padding: 0, display: "grid", gap: "0.6rem" }}>
          {notes.map((n) => (
            <li key={n.id} style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.6rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.85rem" }}>
                  {n.handle ? `@${n.handle}` : "Anonymous"}
                </span>
                <span style={MUTED}>{relativeTime(n.createdAt)}</span>
                <button
                  type="button"
                  onClick={() => removeNote(n.id)}
                  aria-label="Delete note"
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "#b8b8b8", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Delete
                </button>
              </div>
              <p style={{ margin: "0.25rem 0 0", color: "#ffffff", fontSize: "0.9rem", overflowWrap: "anywhere" }}>{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── SignalVoting ──────────────────────────────────────────────────────── */

export interface SignalVotingProps {
  mint: string;
}

const VOTE_META: { key: SignalVote; label: string; icon: string; color: string }[] = [
  { key: "bullish", label: "Bullish", icon: ICON_UP, color: GREEN },
  { key: "bearish", label: "Bearish", icon: ICON_DOWN, color: RED },
  { key: "rug-watch", label: "Rug watch", icon: ICON_EYE, color: GOLD },
];

/**
 * Per-token signal voting. One vote per device (localStorage); tapping the
 * same option again removes the vote. Tallies are explicitly labelled
 * "votes on this device" — they are NOT global counts.
 */
export function SignalVoting({ mint }: SignalVotingProps) {
  const { tally, vote } = useScanSocial(mint);

  return (
    <div style={PANEL} data-testid="signal-voting">
      <h3 style={H3}>Community signal</h3>
      <p style={{ ...MUTED, margin: "0 0 0.75rem" }}>
        Votes on this device only — not synced, not a global count.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {VOTE_META.map((v) => {
          const count = v.key === "rug-watch" ? tally.rugWatch : tally[v.key];
          const active = tally.myVote === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => vote(v.key)}
              aria-pressed={active}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                background: active ? v.color : "transparent",
                color: active ? "#000000" : "#ffffff",
                border: `1px solid ${v.color}`,
                borderRadius: 999, padding: "0.45rem 0.9rem",
                fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
              }}
            >
              <Icon d={v.icon} size={13} /> {v.label} · {count}
            </button>
          );
        })}
      </div>
      <p style={{ ...MUTED, margin: "0.75rem 0 0" }}>
        {tally.total === 0
          ? "No votes on this device yet."
          : tally.myVote
            ? `Your vote: ${VOTE_META.find((v) => v.key === tally.myVote)?.label}. Tap it again to remove.`
            : "Tap an option to vote (one vote per device)."}
      </p>
    </div>
  );
}

/* ── ScanFeedAlerts ────────────────────────────────────────────────────── */

export interface ScanFeedAlertsProps {
  mint: string;
  symbol?: string | null;
  ogScore?: number | null;
  /** Dev wallet address, when known — enables a wallet_trade watch. */
  devWallet?: string | null;
  signals: ScanSignal[];
  /**
   * Rules that fired locally when this scan completed (W4 live firing).
   * Firing is local-only: the rules were evaluated in the browser against
   * this scan — nothing here is delivered by the backend.
   */
  firedAlerts?: FiredAlert[];
}

/**
 * Feed-alert wiring for scan signals — reuse, don't rebuild.
 *
 * What this does: for each signal, shows whether the EXISTING ogdex alerts
 * backend accepts it and deep-links into the /ORBITX_DEX/alerts command
 * center prefilled with the closest supported alert (wallet_trade on the
 * dev wallet for dev-sell; price alerts for the mint otherwise).
 *
 * What it does NOT do: create same-dev / bundle / whale / migration
 * alerts — the backend rejects those types ("invalid type"). That gap is
 * documented in FEED_ALERT_GAP (useScanSocial.ts) and surfaced inline
 * below, instead of a parallel client-side alert system.
 *
 * The social feed post format an agent-side job could publish is defined
 * by buildScanFeedPost(); the browser never posts it (agent-key only).
 */
export function ScanFeedAlerts({ mint, symbol, ogScore, devWallet, signals, firedAlerts = [] }: ScanFeedAlertsProps) {
  const [showFormat, setShowFormat] = useState(false);
  const feedPost = signals.length > 0 ? buildScanFeedPost({ mint, symbol, ogScore, signals }) : null;

  return (
    <div style={PANEL} data-testid="scan-feed-alerts">
      <h3 style={H3}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <Icon d={ICON_BELL} size={16} /> Scan alerts
        </span>
      </h3>
      {firedAlerts.length > 0 && (
        <div style={{ marginBottom: "0.9rem", border: `1px solid ${GOLD}`, borderRadius: 8, padding: "0.6rem 0.75rem" }} data-testid="fired-alerts">
          <p style={{ color: GOLD, fontWeight: 700, margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
            Fired by this scan ({firedAlerts.length}) — local only
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
            {firedAlerts.map((f) => (
              <li key={f.rule.id} style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.9rem" }}>{describeRule(f.rule)}</span>
                  <span style={{
                    color: f.severity === "urgent" ? RED : f.severity === "watch" ? GOLD : BLUE,
                    border: `1px solid ${f.severity === "urgent" ? RED : f.severity === "watch" ? GOLD : BLUE}`,
                    borderRadius: 999, padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700,
                  }}>
                    {f.severity}
                  </span>
                  <span style={{ ...MUTED, fontSize: "0.75rem" }}>{relativeTime(f.firedAt)}</span>
                </div>
                <p style={{ ...MUTED, margin: "0.25rem 0 0" }}>{f.reason}</p>
              </li>
            ))}
          </ul>
          <p style={{ ...MUTED, margin: "0.6rem 0 0", fontSize: "0.75rem" }}>
            These fired in your browser when this scan completed. They are not
            sent anywhere and the backend does not deliver them — it rejects
            whale / dev-sell / migration types and has no runner for the rest.
            Re-scan to check again; each rule waits out its cooldown before
            it can fire again.
          </p>
        </div>
      )}
      <p style={{ ...MUTED, margin: "0 0 0.75rem" }}>
        Scan signals wired into the existing Alerts command center — no parallel system.
      </p>
      {signals.length === 0 ? (
        <p style={{ ...MUTED, margin: 0 }}>No scan signals flagged for this token right now.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
          {signals.map((s, i) => {
            const support = scanSignalAlertSupport(s);
            const link = support.supported && devWallet
              ? scanAlertDeepLink(mint, { devWallet })
              : scanAlertDeepLink(mint, { type: "price_above" });
            return (
              <li key={`${s.kind}-${i}`} style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.6rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.9rem" }}>{s.label}</span>
                  <span style={{
                    color: support.supported ? GREEN : GOLD,
                    border: `1px solid ${support.supported ? GREEN : GOLD}`,
                    borderRadius: 999, padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700,
                  }}>
                    {support.supported ? "Alert available" : "Not supported yet"}
                  </span>
                </div>
                {s.detail && <p style={{ ...MUTED, margin: "0.25rem 0" }}>{s.detail}</p>}
                <p style={{ ...MUTED, margin: "0.25rem 0 0.5rem", fontSize: "0.8rem" }}>{support.reason}</p>
                <a
                  href={link}
                  style={{ ...GHOST_BTN, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem" }}
                >
                  <Icon d={ICON_BELL} size={12} />
                  {support.supported ? "Watch dev wallet in Alerts" : "Open Alerts (prefilled)"}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <div style={{ marginTop: "0.9rem", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.75rem" }}>
        <button type="button" onClick={() => setShowFormat((v) => !v)} style={GHOST_BTN}>
          {showFormat ? "Hide feed-post format" : "Show feed-post format"}
        </button>
        {showFormat && feedPost && (
          <pre style={{
            margin: "0.6rem 0 0", padding: "0.6rem", background: "#111111", color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8,
            fontSize: "0.8rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
          }}>
            {feedPost.content}
          </pre>
        )}
        <p style={{ ...MUTED, margin: "0.6rem 0 0", fontSize: "0.75rem" }}>
          Feed posting needs an agent key ({FEED_ALERT_GAP.feedPosting}). Missing backend
          types: {FEED_ALERT_GAP.missingTypes.join(", ")} — see useScanSocial.ts FEED_ALERT_GAP.
        </p>
      </div>
    </div>
  );
}

/* ── Combined panel (what Team B drops into TokenScanner) ─────────────── */

export interface SocialPanelsProps {
  mint: string;
  scanCard: Omit<ScanCardProps, "mint">;
  devWallet?: string | null;
  signals?: ScanSignal[];
}

/**
 * All four Team E pieces in one drop-in section for the scanner page.
 * Team B can also import the pieces individually.
 */
export function SocialPanels({ mint, scanCard, devWallet, signals = [] }: SocialPanelsProps) {
  return (
    <div style={{ display: "grid", gap: "1rem" }} data-testid="social-panels">
      <ScanCard mint={mint} {...scanCard} />
      <div className="oxc-grid oxc-grid-2" style={{ gap: "1rem" }}>
        <CommunityNotes mint={mint} />
        <SignalVoting mint={mint} />
      </div>
      <ScanFeedAlerts
        mint={mint}
        symbol={scanCard.symbol}
        ogScore={scanCard.ogScore}
        devWallet={devWallet}
        signals={signals}
      />
    </div>
  );
}

export type { ScanSignal, SignalVote } from "../hooks/useScanSocial";
export { FEED_ALERT_GAP } from "../hooks/useScanSocial";
export default SocialPanels;

export function SocialPanelNote({ children }: { children: ReactNode }) {
  return <p style={MUTED}>{children}</p>;
}

/* ── AlertBuilder (second batch) ───────────────────────────────────────── */

export interface AlertBuilderProps {
  /**
   * Prefill for new rules. `mint` scopes bundle/risk/whale rules to the
   * token currently on screen; `devWallet` prefills dev-launch rules.
   * Both optional — rules can be global.
   */
  mint?: string | null;
  devWallet?: string | null;
}

const INPUT_STYLE: CSSProperties = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 8,
  padding: "0.5rem 0.65rem",
  fontSize: "0.85rem",
  width: "100%",
  boxSizing: "border-box",
};

/**
 * Custom alert builder. The user picks a trigger (dev-launch /
 * bundle-threshold / whale-buy / risk-score / sniper-activity /
 * liquidity-migration / dev-wallet-move / volume-spike / price-threshold /
 * mcap-threshold / top10-holder-sell), sets the wallet / threshold /
 * mint scope / action filter / severity / cooldown, and manages the rule
 * list (enable/disable + delete). Rules persist in localStorage per device.
 *
 * Evaluation honesty: bundle-threshold and risk-score rules are evaluated
 * locally when Team B calls `checkScan(snapshot)` after a scan (see
 * useAlertBuilder); whale-buy and liquidity-migration fire locally only
 * when the scan carries the evidence. dev-launch / sniper-activity /
 * dev-wallet-move cannot be evaluated from a scan and have no backend
 * runner yet — they are stored and shown as "waiting on backend", never
 * faked as live. The ogdex Alerts page is linked for the closest
 * supported watch (wallet_trade).
 */
export function AlertBuilder({ mint, devWallet }: AlertBuilderProps) {
  const { rules, addRule, setEnabled, removeRule } = useAlertBuilder();
  const [type, setType] = useState<AlertTriggerType>("bundle-threshold");
  const [wallet, setWallet] = useState("");
  const [threshold, setThreshold] = useState("");
  const [action, setAction] = useState<"buy" | "sell" | "transfer" | "any">("any");
  const [direction, setDirection] = useState<"to-honeypot" | "to-sellable" | "any">("any");
  const [comparison, setComparison] = useState<AlertComparison>("above");
  const [severity, setSeverity] = useState<AlertSeverity>("watch");
  const [cooldown, setCooldown] = useState("");
  const [scopeMint, setScopeMint] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const meta = ALERT_TRIGGER_META.find((m) => m.type === type) ?? ALERT_TRIGGER_META[1];
  const effectiveWallet = wallet.trim() || (type === "dev-launch" ? (devWallet ?? "") : "");
  const effectiveMint = scopeMint.trim() || mint || "";

  function submit() {
    setError("");
    setOk("");
    const input: AlertRuleInput = {
      type,
      wallet: meta.needsWallet ? effectiveWallet || null : null,
      threshold: meta.needsThreshold
        ? threshold.trim() !== ""
          ? Number(threshold)
          : meta.defaultThreshold
        : null,
      action: meta.needsAction ? action : null,
      direction: meta.needsDirection ? direction : null,
      comparison: meta.needsComparison ? comparison : null,
      severity,
      cooldownMinutes: cooldown.trim() !== "" ? Number(cooldown) : null,
      mint: effectiveMint || null,
    };
    const rule = addRule(input);
    if (!rule) {
      const mintRequired = ["liquidity-migration", "lp-drain", "honeypot-flip", "authority-change", "top10-holder-sell"];
      setError(
        mintRequired.includes(type)
          ? "Enter the token mint to watch for this trigger."
          : meta.needsWallet
            ? "Enter a valid wallet address for this trigger."
            : "Enter a valid number for the threshold.",
      );
      return;
    }
    setOk("Alert rule saved on this device.");
    setWallet("");
    setThreshold("");
    setCooldown("");
    setScopeMint("");
    window.setTimeout(() => setOk(""), 3000);
  }

  return (
    <div style={PANEL} data-testid="alert-builder">
      <h3 style={H3}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <Icon d={ICON_BELL} size={16} /> Custom alerts
        </span>
      </h3>
      <p style={{ ...MUTED, margin: "0 0 0.75rem" }}>
        Build your own alerts. Rules live on this device only. Bundle, risk,
        volume-spike, price / market-cap, top-10-holder-sell, LP, honeypot
        and authority rules are checked when you scan (they fire only when
        the scan carries the evidence, and each rule waits out its cooldown
        before it can fire again); dev-launch and sniper rules wait on a
        backend feed — they never pretend to fire.
      </p>

      <div style={{ display: "grid", gap: "0.5rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Trigger</span>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as AlertTriggerType); setError(""); }}
            aria-label="Alert trigger"
            style={INPUT_STYLE}
          >
            {ALERT_TRIGGER_META.map((m) => (
              <option key={m.type} value={m.type} style={{ background: "#111111", color: "#ffffff" }}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p style={{ ...MUTED, margin: 0 }}>{meta.hint}</p>

        {meta.needsWallet && (
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {type === "dev-launch" ? "Dev wallet" : "Source wallet"}
            </span>
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder={devWallet ?? "Wallet address…"}
              aria-label="Wallet address"
              spellCheck={false}
              style={INPUT_STYLE}
            />
          </label>
        )}

        {meta.needsThreshold && (
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {meta.thresholdLabel}
              {meta.defaultThreshold != null ? ` (default ${meta.defaultThreshold})` : ""}
            </span>
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={String(meta.defaultThreshold ?? "")}
              aria-label={meta.thresholdLabel}
              inputMode="decimal"
              style={INPUT_STYLE}
            />
          </label>
        )}

        {meta.needsComparison && (
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Direction</span>
            <select
              value={comparison}
              onChange={(e) => setComparison(e.target.value as AlertComparison)}
              aria-label="Comparison direction"
              style={INPUT_STYLE}
            >
              <option value="above" style={{ background: "#111111", color: "#ffffff" }}>Above (crosses up through it)</option>
              <option value="below" style={{ background: "#111111", color: "#ffffff" }}>Below (crosses down through it)</option>
            </select>
          </label>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Severity</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
              aria-label="Severity"
              style={INPUT_STYLE}
            >
              <option value="info" style={{ background: "#111111", color: "#ffffff" }}>Info</option>
              <option value="watch" style={{ background: "#111111", color: "#ffffff" }}>Watch</option>
              <option value="urgent" style={{ background: "#111111", color: "#ffffff" }}>Urgent</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Cooldown (min){meta.defaultCooldownMinutes != null ? ` — default ${meta.defaultCooldownMinutes}` : ""}
            </span>
            <input
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={String(meta.defaultCooldownMinutes ?? 60)}
              aria-label="Cooldown in minutes"
              inputMode="numeric"
              style={INPUT_STYLE}
            />
          </label>
        </div>

        {meta.needsAction && (
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Action filter</span>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as "buy" | "sell" | "transfer" | "any")}
              aria-label="Action filter"
              style={INPUT_STYLE}
            >
              {(meta.actionOptions ?? ["buy", "sell", "transfer", "any"]).map((a) => (
                <option key={a} value={a} style={{ background: "#111111", color: "#ffffff" }}>
                  {a === "any"
                    ? type === "dev-sell-move"
                      ? "Any move (sell / transfer)"
                      : "Any move (buy / sell / transfer)"
                    : `${a[0].toUpperCase()}${a.slice(1)} only`}
                </option>
              ))}
            </select>
          </label>
        )}

        {meta.needsDirection && (
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Direction</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "to-honeypot" | "to-sellable" | "any")}
              aria-label="Flip direction"
              style={INPUT_STYLE}
            >
              <option value="any" style={{ background: "#111111", color: "#ffffff" }}>Either direction</option>
              <option value="to-honeypot" style={{ background: "#111111", color: "#ffffff" }}>Sellable → honeypot only</option>
              <option value="to-sellable" style={{ background: "#111111", color: "#ffffff" }}>Honeypot → sellable only</option>
            </select>
          </label>
        )}

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Token mint {["liquidity-migration", "lp-drain", "honeypot-flip", "authority-change", "top10-holder-sell"].includes(type) ? "(required)" : "(optional — blank = any token)"}
          </span>
          <input
            value={scopeMint}
            onChange={(e) => setScopeMint(e.target.value)}
            placeholder={mint ?? "Mint address…"}
            aria-label="Token mint (optional)"
            spellCheck={false}
            style={INPUT_STYLE}
          />
        </label>

        <div>
          <button type="button" onClick={submit} style={GOLD_BTN}>Create alert</button>
        </div>
        {error && <p style={{ color: RED, margin: 0, fontSize: "0.85rem" }}>{error}</p>}
        {ok && <p style={{ color: GREEN, margin: 0, fontSize: "0.85rem" }}>{ok}</p>}
      </div>

      <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.75rem" }}>
        <h4 style={{ color: "#ffffff", margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
          Your alert rules ({rules.length})
        </h4>
        {rules.length === 0 ? (
          <p style={{ ...MUTED, margin: 0 }}>No custom alerts yet — build one above.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
            {rules.map((rule) => {
              const support = alertRuleBackendSupport(rule);
              return (
                <li key={rule.id} style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.6rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.9rem" }}>{describeRule(rule)}</span>
                    <span style={{
                      color: support.partial ? GOLD : support.supported ? GREEN : GOLD,
                      border: `1px solid ${support.partial ? GOLD : support.supported ? GREEN : GOLD}`,
                      borderRadius: 999, padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700,
                    }}>
                      {support.partial ? "Partial backend" : support.supported ? "Live" : "Waiting on backend"}
                    </span>
                  </div>
                  <p style={{ ...MUTED, margin: "0.25rem 0", fontSize: "0.8rem" }}>{support.reason}</p>
                  <p style={{ ...MUTED, margin: "0.25rem 0", fontSize: "0.8rem" }}>
                    Created {relativeTime(rule.createdAt)}
                    {rule.triggerCount > 0
                      ? ` · fired ${rule.triggerCount}×${rule.lastTriggeredAt ? ` · last ${relativeTime(rule.lastTriggeredAt)}` : ""}`
                      : " · never fired"}
                    {" · "}{rule.enabled ? "enabled" : "disabled"}
                    {` · ${rule.severity} · cooldown ${rule.cooldownMinutes} min`}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                    <button
                      type="button"
                      onClick={() => setEnabled(rule.id, !rule.enabled)}
                      aria-pressed={rule.enabled}
                      style={rule.enabled ? GHOST_BTN : GOLD_BTN}
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </button>
                    {support.partial && rule.wallet && (
                      <a
                        href={scanAlertDeepLink(mint ?? "", { devWallet: rule.wallet })}
                        style={{ ...GHOST_BTN, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                      >
                        Watch wallet in Alerts
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      aria-label={`Delete alert: ${describeRule(rule)}`}
                      style={{ ...GHOST_BTN, color: RED, borderColor: "rgba(255,92,92,0.5)" }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p style={{ ...MUTED, margin: "0.75rem 0 0", fontSize: "0.75rem" }}>
          Evaluation gap: {ALERT_EVAL_GAP.needed}
        </p>
      </div>
    </div>
  );
}
