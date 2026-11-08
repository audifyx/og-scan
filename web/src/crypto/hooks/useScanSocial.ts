/**
 * useScanSocial — local-first social state for the OG Scanner v2 (Team E).
 *
 * Storage model (deliberate, per brief):
 * - Community notes + signal votes live in localStorage, per device, per
 *   mint. NO new DB tables, NO migration, NO new web/api file (Vercel Hobby
 *   12-function cap). Tallies are therefore labelled "on this device" in the
 *   UI and must never be presented as global counts.
 * - Nothing is seeded: no fake notes, no fake votes, no invented counts.
 *
 * Feed alerts (see `scanFeedAlertInfo` / `ScanFeedAlerts` in SocialPanels):
 * - The existing alerts backend is ogdex `_alerts.js` (`/api/ogdex/alerts`,
 *   surfaced on the /ORBITX_DEX/alerts command center). It accepts ONLY
 *   `price_above | price_below | pct_up | pct_down | wallet_trade` and
 *   rejects anything else with `invalid type`. Scan-signal types
 *   (same-dev flag, high bundle %, whale buy/sell, dev-sell, migration)
 *   CANNOT be created there today — see FEED_ALERT_GAP below. This module
 *   reuses that infra via deep links into the Alerts page (prefilled mint /
 *   wallet_trade for a dev wallet) instead of building a parallel system.
 * - The social feed (`web/api/_social.js`) has no user-posting endpoint for
 *   scan alerts: `POST /api/social/agent/post` is agent-key only
 *   (X-Agent-Key header, `agent_accounts` table). A browser client has no
 *   key to send, so scan alerts cannot be posted to the OrbitX feed from
 *   the scanner UI. `buildScanFeedPost` formats the payload an agent-side
 *   job could post later; it is not called from the browser.
 */
import { useCallback, useEffect, useState } from "react";

export type SignalVote = "bullish" | "bearish" | "rug-watch";

export interface ScanNote {
  id: string;
  text: string;
  /** Optional author handle, as typed by the author (no verification). */
  handle: string | null;
  createdAt: number;
}

export interface ScanVoteTally {
  bullish: number;
  bearish: number;
  rugWatch: number;
  total: number;
  /** This device's own vote, if any. One vote per device. */
  myVote: SignalVote | null;
}

/** Scan-signal kinds the scanner can raise. `supportedByAlertsBackend`
 *  is false for every kind except `dev-sell` (mappable to `wallet_trade`
 *  on the dev wallet) — the ogdex alerts backend rejects the rest. */
export type ScanSignalKind = "same-dev" | "high-bundle" | "whale" | "dev-sell" | "migration";

export interface ScanSignal {
  kind: ScanSignalKind;
  label: string;
  detail?: string;
}

const NOTES_PREFIX = "orbitx:scan-notes:";
const VOTE_PREFIX = "orbitx:scan-vote:";
const MAX_NOTE_CHARS = 280;
const MAX_NOTES_PER_TOKEN = 100;

function isMint(v: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function scanNotesKey(mint: string): string {
  return `${NOTES_PREFIX}${mint}`;
}

export function scanVoteKey(mint: string): string {
  return `${VOTE_PREFIX}${mint}`;
}

/** Absolute scanner URL for a mint (share target). Relative path is the
 *  canonical scanner route — Team B's page lives at /intel/scan/:mint. */
export function scanUrl(mint: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/intel/scan/${mint}`;
  }
  return `/intel/scan/${mint}`;
}

export function scanShareText(symbol?: string | null, ogScore?: number | null): string {
  const who = symbol ? `$${symbol}` : "this token";
  const score = ogScore == null ? "OG score unknown" : `OG score ${ogScore}/100`;
  return `Scanner check on ${who} — ${score} on OrbitX.`;
}

/** Parse stored notes defensively; corrupt/foreign data yields []. */
export function loadNotes(mint: string): ScanNote[] {
  const store = safeStorage();
  if (!store || !isMint(mint)) return [];
  try {
    const raw = store.getItem(scanNotesKey(mint));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (n): n is ScanNote =>
          !!n && typeof n === "object" &&
          typeof (n as ScanNote).id === "string" &&
          typeof (n as ScanNote).text === "string" &&
          typeof (n as ScanNote).createdAt === "number",
      )
      .map((n) => ({ ...n, handle: typeof n.handle === "string" ? n.handle : null }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_NOTES_PER_TOKEN);
  } catch {
    return [];
  }
}

export function addNote(mint: string, text: string, handle?: string | null): ScanNote | null {
  const clean = text.trim().slice(0, MAX_NOTE_CHARS);
  if (!clean || !isMint(mint)) return null;
  const store = safeStorage();
  const note: ScanNote = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    text: clean,
    handle: handle?.trim() ? handle.trim().replace(/^@/, "").slice(0, 32) : null,
    createdAt: Date.now(),
  };
  const next = [note, ...loadNotes(mint)].slice(0, MAX_NOTES_PER_TOKEN);
  try {
    store?.setItem(scanNotesKey(mint), JSON.stringify(next));
  } catch {
    /* storage full/blocked — note still returned for this session */
  }
  return note;
}

export function deleteNote(mint: string, id: string): ScanNote[] {
  const next = loadNotes(mint).filter((n) => n.id !== id);
  try {
    safeStorage()?.setItem(scanNotesKey(mint), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Load this device's vote tally. With local-only storage the tally can
 *  only ever count this device (0 or 1 vote) — callers must label it so. */
export function loadTally(mint: string): ScanVoteTally {
  const empty: ScanVoteTally = { bullish: 0, bearish: 0, rugWatch: 0, total: 0, myVote: null };
  const store = safeStorage();
  if (!store || !isMint(mint)) return empty;
  try {
    const raw = store.getItem(scanVoteKey(mint));
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;
    const vote = (parsed as { vote?: unknown }).vote;
    if (vote !== "bullish" && vote !== "bearish" && vote !== "rug-watch") return empty;
    return { ...empty, [vote === "rug-watch" ? "rugWatch" : vote]: 1, total: 1, myVote: vote };
  } catch {
    return empty;
  }
}

/**
 * Cast (or change) this device's one vote. Voting the same option again
 * removes the vote (toggle off). Returns the new tally.
 */
export function castVote(mint: string, vote: SignalVote): ScanVoteTally {
  if (!isMint(mint)) return { bullish: 0, bearish: 0, rugWatch: 0, total: 0, myVote: null };
  const current = loadTally(mint);
  const next: SignalVote | null = current.myVote === vote ? null : vote;
  try {
    const store = safeStorage();
    if (next) store?.setItem(scanVoteKey(mint), JSON.stringify({ vote: next, at: Date.now() }));
    else store?.removeItem(scanVoteKey(mint));
  } catch {
    /* ignore */
  }
  if (!next) return { bullish: 0, bearish: 0, rugWatch: 0, total: 0, myVote: null };
  return {
    bullish: next === "bullish" ? 1 : 0,
    bearish: next === "bearish" ? 1 : 0,
    rugWatch: next === "rug-watch" ? 1 : 0,
    total: 1,
    myVote: next,
  };
}

export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Feed-alert gap — what the existing infra is missing (documented, not hacked).
 * The ogdex alerts backend (`web/api/ogdex/_routes/_alerts.js`, TYPES) accepts
 * only price_above / price_below / pct_up / pct_down / wallet_trade. To make
 * scan alerts real, the backend needs new alert types (`same_dev`,
 * `bundle_spike`, `whale_trade`, `dev_sell`, `migration`) plus a runner that
 * evaluates them against bundle/dev scans — a backend change owned by the
 * alerts team, not a parallel client-side system. Until then the scanner can
 * only deep-link into the Alerts page with what the backend accepts.
 */
export const FEED_ALERT_GAP = {
  backend: "/api/ogdex/alerts (web/api/ogdex/_routes/_alerts.js)",
  acceptedTypes: ["price_above", "price_below", "pct_up", "pct_down", "wallet_trade"] as const,
  missingTypes: [
    "same_dev",
    "bundle_spike",
    "whale_trade",
    "dev_sell",
    "migration",
    // Batch 6 (custom alert builder): no backend type exists for any of these.
    "lp_drain",
    "dev_wallet_move",
    "honeypot_flip",
    "authority_change",
  ] as const,
  feedPosting: "POST /api/social/agent/post is agent-key only (X-Agent-Key header); no user-posting endpoint exists for scan alerts.",
  needed:
    "Add the missing alert types + a scan-signal runner to _alerts.js (or its _routes), and a user-facing scan-alert post route in _social.js — no new standalone web/api file (12-function cap). Batch 6 specifically needs: `lp_drain` + an LP-size polling runner (LP removed / drops hard), `dev_sell`/`dev_wallet_move` + a wallet-activity runner (wallet_trade covers trades only — pure transfers are invisible to it), `honeypot_flip` + a sellability re-test runner, and `authority_change` + a mint/freeze-authority polling runner. The backend today even rejects the `migration` type the Alerts UI offers.",
} as const;

/** Whether a scan signal maps to an alerts-backend type today. */
export function scanSignalAlertSupport(signal: ScanSignal): {
  supported: boolean;
  backendType: string | null;
  reason: string;
} {
  if (signal.kind === "dev-sell") {
    return {
      supported: true,
      backendType: "wallet_trade",
      reason: "Mappable to a wallet_trade watch on the dev wallet — the backend fires on any trade by that wallet.",
    };
  }
  return {
    supported: false,
    backendType: null,
    reason: `The alerts backend rejects this type ("invalid type"). Needs a new "${signal.kind}" alert type + runner — see FEED_ALERT_GAP.`,
  };
}

/**
 * Deep link into the existing ogdex Alerts command center, prefilled with
 * what the backend accepts. `type` defaults to a price alert on the mint;
 * pass `devWallet` + kind "dev-sell" for a wallet_trade watch.
 * The Alerts page reads ?mint / ?type / ?value from the query string.
 */
export function scanAlertDeepLink(
  mint: string,
  opts?: { type?: string; value?: string; devWallet?: string },
): string {
  const params = new URLSearchParams();
  if (opts?.devWallet && isMint(opts.devWallet)) {
    params.set("type", "wallet_trade");
  } else {
    params.set("mint", mint);
    params.set("type", opts?.type ?? "price_above");
    if (opts?.value) params.set("value", opts.value);
  }
  return `/ORBITX_DEX/alerts?${params.toString()}`;
}

/**
 * Format a scan-signal post for the OrbitX social feed. NOT sent from the
 * browser — `POST /api/social/agent/post` requires an agent API key the
 * client never holds. An agent-side job (e.g. a scanner watchdog with an
 * agent key) can post this body verbatim. Kept here so the format is
 * defined once, next to the signals that produce it.
 */
export function buildScanFeedPost(input: {
  mint: string;
  symbol?: string | null;
  ogScore?: number | null;
  signals: ScanSignal[];
}): { content: string } {
  const url = scanUrl(input.mint);
  const score = input.ogScore == null ? "OG score unknown" : `OG score ${input.ogScore}/100`;
  const lines = input.signals.map((s) => `- ${s.label}${s.detail ? `: ${s.detail}` : ""}`);
  return {
    content: [
      `Scanner flag on ${input.symbol ? `$${input.symbol}` : input.mint.slice(0, 8)} — ${score}.`,
      ...lines,
      `Full scan: ${url}`,
    ].join("\n"),
  };
}

export interface UseScanSocial {
  mint: string | null;
  notes: ScanNote[];
  addNoteText: (text: string, handle?: string | null) => ScanNote | null;
  removeNote: (id: string) => void;
  tally: ScanVoteTally;
  vote: (v: SignalVote) => void;
  shareUrl: string | null;
  maxNoteChars: number;
}

/** React hook binding the local-first social state for one scanned mint. */
export function useScanSocial(mint: string | null): UseScanSocial {
  const [notes, setNotes] = useState<ScanNote[]>([]);
  const [tally, setTally] = useState<ScanVoteTally>({
    bullish: 0, bearish: 0, rugWatch: 0, total: 0, myVote: null,
  });

  useEffect(() => {
    if (!mint) {
      setNotes([]);
      setTally({ bullish: 0, bearish: 0, rugWatch: 0, total: 0, myVote: null });
      return;
    }
    setNotes(loadNotes(mint));
    setTally(loadTally(mint));
  }, [mint]);

  const addNoteText = useCallback(
    (text: string, handle?: string | null) => {
      if (!mint) return null;
      const note = addNote(mint, text, handle);
      if (note) setNotes((prev) => [note, ...prev].slice(0, MAX_NOTES_PER_TOKEN));
      return note;
    },
    [mint],
  );

  const removeNote = useCallback(
    (id: string) => {
      if (!mint) return;
      setNotes(deleteNote(mint, id));
    },
    [mint],
  );

  const vote = useCallback(
    (v: SignalVote) => {
      if (!mint) return;
      setTally(castVote(mint, v));
    },
    [mint],
  );

  return {
    mint,
    notes,
    addNoteText,
    removeNote,
    tally,
    vote,
    shareUrl: mint ? scanUrl(mint) : null,
    maxNoteChars: MAX_NOTE_CHARS,
  };
}
