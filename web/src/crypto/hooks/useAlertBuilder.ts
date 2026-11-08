/**
 * useAlertBuilder — custom scan alerts (Team E, second batch).
 *
 * Model: rules are built by the user in the scanner UI and stored in
 * localStorage, per device. NO new DB tables, NO new web/api file, NO
 * parallel backend.
 *
 * Evaluation — honest split (see ALERT_EVAL_GAP):
 * - `bundle-threshold` and `risk-score` CAN be evaluated locally, but only
 *   against a scan the user actually runs: Team B calls
 *   `checkRulesAgainstScan(rules, snapshot)` after a scan completes and
 *   the fired rules are recorded on the rule (lastTriggeredAt /
 *   triggerCount) and shown in the list. There is NO background polling —
 *   a rule can only fire while the user is scanning.
 * - `whale-buy`, `liquidity-migration`, `lp-drain`, `honeypot-flip`,
 *   `authority-change`, `dev-wallet-move` and `dev-sell-move` fire locally
 *   ONLY when the scan snapshot carries the evidence (whaleBuyUsd /
 *   lpMigrated / lpDropPct / honeypotFlipped / authorityChange /
 *   devWalletActivity — Team A data, batches 5–6). Without that evidence
 *   they do NOT fire and say so.
 * - `volume-spike`, `price-threshold`, `mcap-threshold` and
 *   `top10-holder-sell` (W4) fire locally from the same scan snapshot:
 *   DexScreener volume windows (volumeH1 vs the 24h average hourly rate),
 *   live price / market cap, and whale alerts + trade tape joined against
 *   the token's top-10 holders. No extra feed needed — but still only
 *   while the user is scanning; there is no background runner.
 * - `dev-launch` and `sniper-activity` CANNOT be evaluated from a single
 *   scan snapshot and cannot be evaluated by the existing ogdex alerts
 *   backend either (it accepts only price_above / price_below / pct_up /
 *   pct_down / wallet_trade — see FEED_ALERT_GAP in useScanSocial.ts).
 *   The closest reuse is a `wallet_trade` watch on the dev wallet, which
 *   fires on any dev trade — not on a launch. Those rules are still stored
 *   (so nothing the user builds is lost) and shown as "waiting on
 *   backend" with the exact gap documented.
 */
import { useCallback, useEffect, useState } from "react";

export type AlertTriggerType =
  | "dev-launch"
  | "bundle-threshold"
  | "whale-buy"
  | "risk-score"
  | "sniper-activity"
  | "liquidity-migration"
  | "dev-wallet-move"
  | "lp-drain"
  | "dev-sell-move"
  | "honeypot-flip"
  | "authority-change"
  | "volume-spike"
  | "price-threshold"
  | "mcap-threshold"
  | "top10-holder-sell";

export type AlertActionFilter = "buy" | "sell" | "transfer" | "any";

/** Severity tier shown on rules and firings — user-picked, never inferred
 *  from the data. Defaults per trigger live in ALERT_TRIGGER_META. */
export type AlertSeverity = "info" | "watch" | "urgent";

/** Comparison direction for price-threshold / mcap-threshold rules. */
export type AlertComparison = "above" | "below";

/** Honeypot-flip direction filter. */
export type HoneypotDirection = "to-honeypot" | "to-sellable" | "any";

export interface AlertRule {
  id: string;
  type: AlertTriggerType;
  /** Dev wallet (dev-launch) or source wallet (sniper-activity). */
  wallet: string | null;
  /**
   * Threshold meaning depends on type:
   * - bundle-threshold: bundled supply % (default 30)
   * - risk-score: risk score 0–100, higher = riskier (default 70)
   * - whale-buy: USD amount of a single buy (default 10_000)
   * - liquidity-migration: minimum LP moved in USD (optional, null = any amount)
   * - lp-drain: LP drop % vs previous observation (default 50)
   * - volume-spike: 1h volume as a multiple of the 24h average hourly volume (default 3)
   * - price-threshold: price in USD (comparison: above/below)
   * - mcap-threshold: market cap in USD (comparison: above/below)
   * - top10-holder-sell: minimum sell in USD by a top-10 holder (optional, null = any top-10 sell)
   * - dev-launch / sniper-activity / dev-wallet-move / dev-sell-move /
   *   honeypot-flip / authority-change: unused (null)
   */
  threshold: number | null;
  /** Action filter for dev-wallet-move / dev-sell-move. Null = any. */
  action: AlertActionFilter | null;
  /** Direction filter for honeypot-flip. Null = any direction. */
  direction: HoneypotDirection | null;
  /** Comparison for price-threshold / mcap-threshold. Null = above. */
  comparison: AlertComparison | null;
  /** Severity tier for this rule (and every firing of it). */
  severity: AlertSeverity;
  /**
   * Per-rule cooldown in minutes: after firing, the same rule does not
   * re-fire for the same mint until this elapses. Default 60.
   */
  cooldownMinutes: number;
  /** Optional mint scope. Null = any token. */
  mint: string | null;
  enabled: boolean;
  createdAt: number;
  lastTriggeredAt: number | null;
  triggerCount: number;
}

export interface AlertRuleInput {
  type: AlertTriggerType;
  wallet?: string | null;
  threshold?: number | null;
  action?: AlertActionFilter | null;
  direction?: HoneypotDirection | null;
  comparison?: AlertComparison | null;
  severity?: AlertSeverity | null;
  cooldownMinutes?: number | null;
  mint?: string | null;
}

/** Minimal scan data a rule can be evaluated against. Fields the scan
 *  doesn't know stay null — a rule that needs an unknown field does NOT
 *  fire and says so (never fires on missing data). */
export interface ScanSnapshotForEval {
  mint: string;
  bundledSupplyPct?: number | null;
  /** Composed risk 0–100, higher = riskier. */
  riskScore?: number | null;
  /** Largest single recent buy in USD, when the scan knows it. */
  whaleBuyUsd?: number | null;
  /** Dev/deployer wallet of the scanned token, when known. */
  devWallet?: string | null;
  /** LP migration evidence from this scan, when the scan knows it:
   *  true = LP moved pools, false = no migration seen, null = unknown. */
  lpMigrated?: boolean | null;
  /** USD value moved in the migration, when known. */
  lpMovedUsd?: number | null;
  /** Current LP in USD, when the scan knows it. 0 = fully drained. */
  lpUsd?: number | null;
  /** LP drop % vs the previous observation (Team A/B vault comparison),
   *  when known. Null = no previous observation / unknown. */
  lpDropPct?: number | null;
  /**
   * Latest observed move by a watched wallet (Team A devWalletWatch
   * data, batch 5). A scan snapshot carries at most the latest move.
   */
  devWalletActivity?: {
    wallet: string;
    action: "buy" | "sell" | "transfer";
    amountUsd?: number | null;
  } | null;
  /**
   * Honeypot status from this scan (Team A honeypotFlip data, batch 6).
   * honeypotFlipped is true only when this scan observed a flip vs the
   * previous scan; honeypotSellable is the current sellability.
   */
  honeypotFlipped?: boolean | null;
  honeypotSellable?: boolean | null;
  /**
   * Contract authority change observed by this scan (Team A
   * authorityChange data, batch 6). Null = no change observed.
   */
  authorityChange?: {
    kind: "mint-enabled" | "freeze-enabled" | "ownership" | "mint-disabled" | "freeze-disabled";
    detail?: string | null;
  } | null;
  /** Live price in USD (DexScreener top pair / token route). */
  priceUsd?: number | null;
  /** Market cap in USD, when the scan knows it. */
  mcapUsd?: number | null;
  /** DexScreener volume windows on the top pair, when the scan knows them. */
  volumeH1?: number | null;
  volumeH24?: number | null;
  /**
   * Largest sell in USD by a top-10 holder in this scan's whale alerts /
   * trade tape, when the scan knows it. Null = no top-10 sell observed
   * (or no tape/whale data to check against).
   */
  top10HolderSellUsd?: number | null;
  /** Wallet behind top10HolderSellUsd, when known. */
  top10HolderSellWallet?: string | null;
}

export const ALERT_RULES_KEY = "orbitx:scan-alert-rules";
const MAX_RULES = 50;

export const ALERT_TRIGGER_META: {
  type: AlertTriggerType;
  label: string;
  hint: string;
  needsWallet: boolean;
  needsThreshold: boolean;
  /** When true, an empty threshold is allowed (null = no minimum). */
  thresholdOptional?: boolean;
  thresholdLabel: string;
  defaultThreshold: number | null;
  needsAction?: boolean;
  /** Action options for this trigger (dev-wallet-move allows buy; dev-sell-move does not). */
  actionOptions?: AlertActionFilter[];
  needsDirection?: boolean;
  /** Above/below picker for price-threshold / mcap-threshold. */
  needsComparison?: boolean;
  /** Default severity when the user doesn't pick one. */
  defaultSeverity?: AlertSeverity;
  /** Default per-rule cooldown in minutes when the user doesn't set one. */
  defaultCooldownMinutes?: number;
}[] = [
  {
    type: "dev-launch",
    label: "Dev launches a new token",
    hint: "Ping me when a token from this dev launches.",
    needsWallet: true,
    needsThreshold: false,
    thresholdLabel: "",
    defaultThreshold: null,
  },
  {
    type: "bundle-threshold",
    label: "Bundle goes over %",
    hint: "Ping me when bundled supply crosses the threshold.",
    needsWallet: false,
    needsThreshold: true,
    thresholdLabel: "Bundle %",
    defaultThreshold: 30,
  },
  {
    type: "whale-buy",
    label: "Whale buy over $",
    hint: "Ping me when a single buy is bigger than this.",
    needsWallet: false,
    needsThreshold: true,
    thresholdLabel: "Buy size ($)",
    defaultThreshold: 10_000,
  },
  {
    type: "risk-score",
    label: "Risk score over",
    hint: "Ping me when a scanned token's risk score crosses this.",
    needsWallet: false,
    needsThreshold: true,
    thresholdLabel: "Risk score (0–100)",
    defaultThreshold: 70,
  },
  {
    type: "sniper-activity",
    label: "Sniper activity from wallet",
    hint: "Ping me when this source wallet snipes a new launch.",
    needsWallet: true,
    needsThreshold: false,
    thresholdLabel: "",
    defaultThreshold: null,
  },
  {
    type: "liquidity-migration",
    label: "LP migrates / moves pools",
    hint: "Ping me when this token's liquidity migrates to a new pool.",
    needsWallet: false,
    needsThreshold: true,
    thresholdOptional: true,
    thresholdLabel: "Minimum moved ($, optional)",
    defaultThreshold: null,
  },
  {
    type: "dev-wallet-move",
    label: "Dev wallet moves or sells",
    hint: "Ping me the second this dev wallet moves, sells, buys or transfers.",
    needsWallet: true,
    needsThreshold: false,
    thresholdLabel: "",
    defaultThreshold: null,
    needsAction: true,
    actionOptions: ["buy", "sell", "transfer", "any"],
  },
  {
    type: "lp-drain",
    label: "LP drain / removal",
    hint: "Ping me the second LP is removed or drops hard.",
    needsWallet: false,
    needsThreshold: true,
    thresholdLabel: "LP drop %",
    defaultThreshold: 50,
  },
  {
    type: "dev-sell-move",
    label: "Dev wallet sells / moves",
    hint: "Ping me the second a watched dev wallet sells, transfers, or moves anything.",
    needsWallet: true,
    needsThreshold: false,
    thresholdLabel: "",
    defaultThreshold: null,
    needsAction: true,
    actionOptions: ["sell", "transfer", "any"],
  },
  {
    type: "honeypot-flip",
    label: "Honeypot status flip",
    hint: "Ping me when a watched token flips sellable to honeypot (or back).",
    needsWallet: false,
    needsThreshold: false,
    thresholdLabel: "",
    defaultThreshold: null,
    needsDirection: true,
  },
  {
    type: "authority-change",
    label: "Contract authority change",
    hint: "Ping me when mint/freeze authority is re-enabled or ownership changes.",
    needsWallet: false,
    needsThreshold: false,
    thresholdLabel: "",
    defaultThreshold: null,
    defaultSeverity: "urgent",
    defaultCooldownMinutes: 60,
  },
  {
    type: "volume-spike",
    label: "Volume spike (1h vs 24h avg)",
    hint: "Ping me when 1h volume runs hot vs the 24h average hourly volume.",
    needsWallet: false,
    needsThreshold: true,
    thresholdLabel: "Spike multiple (×)",
    defaultThreshold: 3,
    defaultSeverity: "watch",
    defaultCooldownMinutes: 60,
  },
  {
    type: "price-threshold",
    label: "Price crosses $",
    hint: "Ping me when the live price crosses this level.",
    needsWallet: false,
    needsThreshold: true,
    thresholdLabel: "Price ($)",
    defaultThreshold: 0.01,
    needsComparison: true,
    defaultSeverity: "watch",
    defaultCooldownMinutes: 60,
  },
  {
    type: "mcap-threshold",
    label: "Market cap crosses $",
    hint: "Ping me when the market cap crosses this level.",
    needsWallet: false,
    needsThreshold: true,
    thresholdLabel: "Market cap ($)",
    defaultThreshold: 1_000_000,
    needsComparison: true,
    defaultSeverity: "watch",
    defaultCooldownMinutes: 60,
  },
  {
    type: "top10-holder-sell",
    label: "Top-10 holder sells",
    hint: "Ping me when a top-10 holder sells (whale alerts / trade tape).",
    needsWallet: false,
    needsThreshold: true,
    thresholdOptional: true,
    thresholdLabel: "Minimum sell ($, optional)",
    defaultThreshold: null,
    defaultSeverity: "urgent",
    defaultCooldownMinutes: 30,
  },
];

export const ALERT_EVAL_GAP = {
  backend: "/api/ogdex/alerts (web/api/ogdex/_routes/_alerts.js)",
  acceptedTypes: ["price_above", "price_below", "pct_up", "pct_down", "wallet_trade"] as const,
  locallyEvaluable: ["bundle-threshold", "risk-score", "volume-spike", "price-threshold", "mcap-threshold", "top10-holder-sell"] as const,
  /** Fire locally only when a scan carries the evidence (whaleBuyUsd / lpMigrated / lpDropPct / honeypotFlipped / authorityChange / devWalletActivity). */
  conditionallyEvaluable: ["whale-buy", "liquidity-migration", "lp-drain", "honeypot-flip", "authority-change", "dev-sell-move", "dev-wallet-move"] as const,
  /** Partial backend mapping: wallet_trade watches the wallet's trades. */
  partiallyMappable: ["dev-launch", "dev-wallet-move", "dev-sell-move", "price-threshold"] as const,
  needsBackend: ["dev-launch", "whale-buy", "sniper-activity", "liquidity-migration", "dev-wallet-move", "lp-drain", "dev-sell-move", "honeypot-flip", "authority-change", "volume-spike", "mcap-threshold", "top10-holder-sell"] as const,
  needed:
    "Live evaluation needs a server-side runner: a launch feed for dev-launch/sniper-activity (new token mints per dev/source wallet), a trade tape for whale-buy and dev-wallet-move/dev-sell-move (wallet_trade covers trades only — pure transfers are invisible to it), a pool/migration feed for liquidity-migration and lp-drain (LP address change / LP burn-move / LP-size polling), a honeypot checker for honeypot-flip (sellability re-test per token), and an authority watcher for authority-change (mint/freeze authority + owner polling), plus new alert types in _alerts.js (lp_drain, dev_sell, honeypot_flip, authority_change, migration). The backend today even rejects the `migration` type the Alerts UI offers. Until then those rules persist locally and are labelled 'waiting on backend' — they never pretend to fire.",
} as const;

function isAddr(v: string | null | undefined): boolean {
  return typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Fallback severity / cooldown for trigger types without an explicit
 *  default in ALERT_TRIGGER_META (the pre-W4 types). */
const DEFAULT_SEVERITY: Record<AlertTriggerType, AlertSeverity> = {
  "dev-launch": "info",
  "bundle-threshold": "watch",
  "whale-buy": "watch",
  "risk-score": "watch",
  "sniper-activity": "info",
  "liquidity-migration": "watch",
  "dev-wallet-move": "watch",
  "lp-drain": "urgent",
  "dev-sell-move": "urgent",
  "honeypot-flip": "urgent",
  "authority-change": "urgent",
  "volume-spike": "watch",
  "price-threshold": "watch",
  "mcap-threshold": "watch",
  "top10-holder-sell": "urgent",
};

const DEFAULT_COOLDOWN_MINUTES = 60;

function sanitizeRule(raw: unknown): AlertRule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AlertRule>;
  const types: AlertTriggerType[] = ["dev-launch", "bundle-threshold", "whale-buy", "risk-score", "sniper-activity", "liquidity-migration", "dev-wallet-move", "lp-drain", "dev-sell-move", "honeypot-flip", "authority-change", "volume-spike", "price-threshold", "mcap-threshold", "top10-holder-sell"];
  if (!types.includes(r.type as AlertTriggerType)) return null;
  if (typeof r.id !== "string" || !r.id) return null;
  if (typeof r.createdAt !== "number") return null;
  const actions: AlertActionFilter[] = ["buy", "sell", "transfer", "any"];
  const directions: HoneypotDirection[] = ["to-honeypot", "to-sellable", "any"];
  const severities: AlertSeverity[] = ["info", "watch", "urgent"];
  const comparisons: AlertComparison[] = ["above", "below"];
  const cooldown =
    typeof r.cooldownMinutes === "number" && Number.isFinite(r.cooldownMinutes)
      ? Math.min(10080, Math.max(0, Math.floor(r.cooldownMinutes)))
      : DEFAULT_COOLDOWN_MINUTES;
  return {
    id: r.id,
    type: r.type as AlertTriggerType,
    wallet: isAddr(r.wallet) ? (r.wallet as string) : null,
    threshold: typeof r.threshold === "number" && Number.isFinite(r.threshold) ? r.threshold : null,
    action: actions.includes(r.action as AlertActionFilter) ? (r.action as AlertActionFilter) : null,
    direction: directions.includes(r.direction as HoneypotDirection) ? (r.direction as HoneypotDirection) : null,
    comparison: comparisons.includes(r.comparison as AlertComparison) ? (r.comparison as AlertComparison) : null,
    severity: severities.includes(r.severity as AlertSeverity)
      ? (r.severity as AlertSeverity)
      : DEFAULT_SEVERITY[r.type as AlertTriggerType],
    cooldownMinutes: cooldown,
    mint: isAddr(r.mint) ? (r.mint as string) : null,
    enabled: r.enabled !== false,
    createdAt: r.createdAt,
    lastTriggeredAt: typeof r.lastTriggeredAt === "number" ? r.lastTriggeredAt : null,
    triggerCount: typeof r.triggerCount === "number" && r.triggerCount > 0 ? Math.floor(r.triggerCount) : 0,
  };
}

export function loadAlertRules(): AlertRule[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(ALERT_RULES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeRule)
      .filter((r): r is AlertRule => r !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_RULES);
  } catch {
    return [];
  }
}

function persist(rules: AlertRule[]): void {
  try {
    safeStorage()?.setItem(ALERT_RULES_KEY, JSON.stringify(rules.slice(0, MAX_RULES)));
  } catch {
    /* storage full/blocked — in-memory state still works for the session */
  }
}

export function createAlertRule(input: AlertRuleInput): AlertRule | null {
  const meta = ALERT_TRIGGER_META.find((m) => m.type === input.type);
  if (!meta) return null;
  if (meta.needsWallet && !isAddr(input.wallet)) return null;
  if (meta.needsThreshold) {
    const t = input.threshold ?? meta.defaultThreshold;
    if (t != null && (typeof t !== "number" || !Number.isFinite(t) || t <= 0)) return null;
    if (t == null && !meta.thresholdOptional) return null;
  }
  if (meta.needsAction && input.action && !["buy", "sell", "transfer", "any"].includes(input.action)) return null;
  if (input.type === "dev-sell-move" && input.action === "buy") return null;
  if (meta.needsDirection && input.direction && !["to-honeypot", "to-sellable", "any"].includes(input.direction)) return null;
  if (meta.needsComparison && input.comparison && !["above", "below"].includes(input.comparison)) return null;
  if (input.severity && !["info", "watch", "urgent"].includes(input.severity)) return null;
  if (input.cooldownMinutes != null && (typeof input.cooldownMinutes !== "number" || !Number.isFinite(input.cooldownMinutes) || input.cooldownMinutes < 0 || input.cooldownMinutes > 10080)) return null;
  // Per-token triggers need a mint scope.
  const mintRequired = ["liquidity-migration", "lp-drain", "honeypot-flip", "authority-change", "top10-holder-sell"];
  if (mintRequired.includes(input.type) && !isAddr(input.mint)) return null;
  const rule: AlertRule = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    wallet: isAddr(input.wallet) ? (input.wallet as string) : null,
    threshold: meta.needsThreshold ? (input.threshold ?? meta.defaultThreshold) : null,
    action: meta.needsAction ? (input.action ?? "any") : null,
    direction: meta.needsDirection ? (input.direction ?? "any") : null,
    comparison: meta.needsComparison ? (input.comparison ?? "above") : null,
    severity: input.severity ?? meta.defaultSeverity ?? DEFAULT_SEVERITY[input.type],
    cooldownMinutes:
      input.cooldownMinutes ?? meta.defaultCooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES,
    mint: isAddr(input.mint) ? (input.mint as string) : null,
    enabled: true,
    createdAt: Date.now(),
    lastTriggeredAt: null,
    triggerCount: 0,
  };
  persist([rule, ...loadAlertRules()]);
  return rule;
}

export function updateAlertRule(id: string, patch: Partial<Pick<AlertRule, "enabled" | "threshold" | "severity" | "cooldownMinutes">>): AlertRule[] {
  const next = loadAlertRules().map((r) => (r.id === id ? { ...r, ...patch } : r));
  persist(next);
  return next;
}

export function deleteAlertRule(id: string): AlertRule[] {
  const next = loadAlertRules().filter((r) => r.id !== id);
  persist(next);
  return next;
}

export function describeRule(rule: AlertRule): string {
  const meta = ALERT_TRIGGER_META.find((m) => m.type === rule.type);
  const short = (a: string | null) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");
  switch (rule.type) {
    case "dev-launch":
      return `Dev ${short(rule.wallet)} launches a new token`;
    case "bundle-threshold":
      return `Bundle over ${rule.threshold ?? 30}%${rule.mint ? ` on ${short(rule.mint)}` : " on any scanned token"}`;
    case "whale-buy":
      return `Whale buy over $${(rule.threshold ?? 10_000).toLocaleString()}${rule.mint ? ` on ${short(rule.mint)}` : ""}`;
    case "risk-score":
      return `Risk score over ${rule.threshold ?? 70}${rule.mint ? ` on ${short(rule.mint)}` : " on any scanned token"}`;
    case "sniper-activity":
      return `Sniper activity from ${short(rule.wallet)}`;
    case "liquidity-migration":
      return `LP migrates on ${short(rule.mint)}${rule.threshold != null ? ` (over $${rule.threshold.toLocaleString()} moved)` : ""}`;
    case "dev-wallet-move": {
      const act = rule.action && rule.action !== "any" ? rule.action : "moves";
      return `Dev ${short(rule.wallet)} ${act === "moves" ? "moves" : act + "s"}`;
    }
    case "lp-drain":
      return `LP drops ${rule.threshold ?? 50}%+ on ${short(rule.mint)}`;
    case "dev-sell-move": {
      const act = rule.action && rule.action !== "any" ? rule.action : "moves";
      return `Dev ${short(rule.wallet)} ${act === "moves" ? "sells / moves" : act + "s"}`;
    }
    case "honeypot-flip": {
      const dir =
        rule.direction === "to-honeypot"
          ? " flips to honeypot"
          : rule.direction === "to-sellable"
            ? " flips back to sellable"
            : " flips honeypot status";
      return `${short(rule.mint)}${dir}`;
    }
    case "authority-change":
      return `Authority change on ${short(rule.mint)}`;
    case "volume-spike": {
      const mult = rule.threshold ?? 3;
      return `Volume spike ${mult}× the 24h average hourly volume${rule.mint ? ` on ${short(rule.mint)}` : " on any scanned token"}`;
    }
    case "price-threshold": {
      const cmp = rule.comparison ?? "above";
      return `Price ${cmp === "above" ? "above" : "below"} $${rule.threshold ?? 0.01}${rule.mint ? ` on ${short(rule.mint)}` : " on any scanned token"}`;
    }
    case "mcap-threshold": {
      const cmp = rule.comparison ?? "above";
      return `Market cap ${cmp === "above" ? "above" : "below"} $${(rule.threshold ?? 1_000_000).toLocaleString()}${rule.mint ? ` on ${short(rule.mint)}` : " on any scanned token"}`;
    }
    case "top10-holder-sell":
      return `Top-10 holder sells${rule.threshold != null ? ` over $${rule.threshold.toLocaleString()}` : ""} on ${short(rule.mint)}`;
    default:
      return meta?.label ?? rule.type;
  }
}

/** How a rule relates to the existing ogdex alerts backend. */
export function alertRuleBackendSupport(rule: AlertRule): {
  supported: boolean;
  partial: boolean;
  backendType: string | null;
  reason: string;
} {
  if (rule.type === "dev-launch" && rule.wallet) {
    return {
      supported: false,
      partial: true,
      backendType: "wallet_trade",
      reason:
        "No launch feed exists. Closest reuse: a wallet_trade watch on the dev wallet fires on any dev trade — it does NOT fire on a launch. Stored locally, waiting on a launch-feed runner.",
    };
  }
  if (rule.type === "dev-wallet-move" && rule.wallet) {
    if (rule.action === "transfer") {
      return {
        supported: false,
        partial: false,
        backendType: null,
        reason:
          "Pure transfers are invisible to the alerts backend — wallet_trade fires on trades only. Needs a wallet-activity feed that watches transfers too. Stored locally, waiting on backend.",
      };
    }
    return {
      supported: false,
      partial: true,
      backendType: "wallet_trade",
      reason:
        "Closest reuse: a wallet_trade watch on the dev wallet fires on any dev trade (buy/sell/any) — but it cannot filter by action and cannot see transfers. Stored locally, waiting on a wallet-activity runner.",
    };
  }
  if (rule.type === "liquidity-migration") {
    return {
      supported: false,
      partial: false,
      backendType: null,
      reason:
        "The backend rejects the `migration` alert type the Alerts UI offers ('invalid type') and has no pool/migration feed. Locally it can only fire when a re-scan carries migration evidence. Needs a migration-detection runner + a `migration` alert type in _alerts.js.",
    };
  }
  if (rule.type === "lp-drain") {
    return {
      supported: false,
      partial: false,
      backendType: null,
      reason:
        "No LP alert type exists in the backend and nothing polls LP size. Locally it can only fire when a re-scan carries LP data (vault comparison). Needs an `lp_drain` alert type + an LP-size polling runner in _alerts.js.",
    };
  }
  if (rule.type === "dev-sell-move" && rule.wallet) {
    if (rule.action === "transfer") {
      return {
        supported: false,
        partial: false,
        backendType: null,
        reason:
          "Pure transfers are invisible to the alerts backend — wallet_trade fires on trades only. Needs a wallet-activity feed that watches transfers too. Stored locally, waiting on backend.",
      };
    }
    return {
      supported: false,
      partial: true,
      backendType: "wallet_trade",
      reason:
        "Closest reuse: a wallet_trade watch on the dev wallet fires on any dev trade (sell/any) — but it cannot filter by action and cannot see transfers. Stored locally, waiting on a wallet-activity runner.",
    };
  }
  if (rule.type === "honeypot-flip") {
    return {
      supported: false,
      partial: false,
      backendType: null,
      reason:
        "No honeypot alert type exists in the backend and nothing re-tests sellability. Locally it can only fire when a re-scan carries a flip (Team A honeypotFlip data). Needs a `honeypot_flip` alert type + a sellability re-test runner in _alerts.js.",
    };
  }
  if (rule.type === "authority-change") {
    return {
      supported: false,
      partial: false,
      backendType: null,
      reason:
        "No authority alert type exists in the backend and nothing polls mint/freeze authority. Locally it can only fire when a re-scan carries an authority change (Team A authorityChange data). Needs an `authority_change` alert type + an authority polling runner in _alerts.js.",
    };
  }
  if (rule.type === "volume-spike") {
    return {
      supported: false,
      partial: false,
      backendType: null,
      reason:
        "No volume alert type exists in the backend. Evaluated locally when you scan, from the DexScreener volume windows in the scan (1h vs the 24h average hourly rate). Live firing needs a volume runner.",
    };
  }
  if (rule.type === "price-threshold") {
    const cmp = rule.comparison ?? "above";
    return {
      supported: false,
      partial: true,
      backendType: cmp === "above" ? "price_above" : "price_below",
      reason:
        `Evaluated locally when you scan, from the live price in the scan. Closest backend reuse: a ${cmp === "above" ? "price_above" : "price_below"} alert on the Alerts page — same threshold, but it only fires while the backend watches it, not from scans.`,
    };
  }
  if (rule.type === "mcap-threshold") {
    return {
      supported: false,
      partial: false,
      backendType: null,
      reason:
        "No market-cap alert type exists in the backend (its price alerts are price-based, not mcap-based). Evaluated locally when you scan, from the live market cap in the scan. Live firing needs an `mcap` alert type + a price/mcap polling runner.",
    };
  }
  if (rule.type === "top10-holder-sell") {
    return {
      supported: false,
      partial: false,
      backendType: null,
      reason:
        "No top-holder alert type exists in the backend — wallet_trade watches one wallet's trades, not a token's top-10 holders. Evaluated locally when you scan, from whale alerts + trade tape joined against the token's top-10 holders. Live firing needs a holder-watch runner.",
    };
  }
  if (rule.type === "bundle-threshold" || rule.type === "risk-score") {
    return {
      supported: false,
      partial: false,
      backendType: null,
      reason:
        "Evaluated locally when you scan (see below). The backend has no bundle/risk alert type and no scan hook — live firing needs a backend runner.",
    };
  }
  return {
    supported: false,
    partial: false,
    backendType: null,
    reason:
      "Needs a live feed (trade tape / launch feed) plus a new backend alert type. Stored locally, waiting on backend — it will not pretend to fire.",
  };
}

/**
 * Evaluate one rule against a just-completed scan. Returns whether it
 * fired and why. Rules that need data the scan doesn't have never fire.
 * Disabled rules never fire. Mint-scoped rules only fire on their mint.
 */
export function evaluateRuleAgainstScan(
  rule: AlertRule,
  snap: ScanSnapshotForEval,
): { triggered: boolean; reason: string } {
  if (!rule.enabled) return { triggered: false, reason: "Rule is disabled." };
  if (rule.mint && rule.mint !== snap.mint) return { triggered: false, reason: "Scan is for a different token." };
  switch (rule.type) {
    case "bundle-threshold": {
      const pct = snap.bundledSupplyPct;
      const t = rule.threshold ?? 30;
      if (pct == null) return { triggered: false, reason: "Bundle % unknown for this scan." };
      return pct >= t
        ? { triggered: true, reason: `Bundled supply ${pct.toFixed(1)}% is over ${t}%.` }
        : { triggered: false, reason: `Bundled supply ${pct.toFixed(1)}% is under ${t}%.` };
    }
    case "risk-score": {
      const score = snap.riskScore;
      const t = rule.threshold ?? 70;
      if (score == null) return { triggered: false, reason: "Risk score unknown for this scan." };
      return score >= t
        ? { triggered: true, reason: `Risk score ${score} is over ${t}.` }
        : { triggered: false, reason: `Risk score ${score} is under ${t}.` };
    }
    case "whale-buy": {
      if (snap.whaleBuyUsd == null) {
        return { triggered: false, reason: "No whale-buy data in this scan — needs a live trade tape." };
      }
      const t = rule.threshold ?? 10_000;
      return snap.whaleBuyUsd >= t
        ? { triggered: true, reason: `Largest buy $${snap.whaleBuyUsd.toLocaleString()} is over $${t.toLocaleString()}.` }
        : { triggered: false, reason: `Largest buy $${snap.whaleBuyUsd.toLocaleString()} is under $${t.toLocaleString()}.` };
    }
    case "dev-launch":
      return { triggered: false, reason: "Dev launches need a launch feed — a single scan cannot detect them." };
    case "sniper-activity":
      return { triggered: false, reason: "Sniper activity needs a live launch/trade feed — a single scan cannot detect it." };
    case "liquidity-migration": {
      if (snap.lpMigrated == null) {
        return { triggered: false, reason: "No migration data in this scan — needs pool/migration evidence." };
      }
      if (!snap.lpMigrated) return { triggered: false, reason: "No LP migration in this scan." };
      const t = rule.threshold;
      if (t != null) {
        if (snap.lpMovedUsd == null) {
          return { triggered: false, reason: `LP migrated but the moved amount is unknown — can't confirm it is over $${t.toLocaleString()}.` };
        }
        return snap.lpMovedUsd >= t
          ? { triggered: true, reason: `LP migrated, $${snap.lpMovedUsd.toLocaleString()} moved — over $${t.toLocaleString()}.` }
          : { triggered: false, reason: `LP migrated but only $${snap.lpMovedUsd.toLocaleString()} moved — under $${t.toLocaleString()}.` };
      }
      return { triggered: true, reason: "LP migrated to a new pool." };
    }
    case "dev-wallet-move":
    case "dev-sell-move": {
      // Local eval consumes Team A devWalletWatch data carried on the snapshot.
      const act = snap.devWalletActivity;
      if (!act) {
        return { triggered: false, reason: "No dev wallet activity in this scan — needs a live wallet-activity feed." };
      }
      if (rule.wallet && act.wallet !== rule.wallet) {
        return { triggered: false, reason: "Activity was from a different wallet." };
      }
      if (rule.type === "dev-sell-move" && act.action === "buy") {
        return { triggered: false, reason: "Dev bought — this rule only watches sells / transfers / moves." };
      }
      const want = rule.action ?? "any";
      if (want !== "any" && act.action !== want) {
        return { triggered: false, reason: `Dev ${act.action}ed — this rule watches ${want}.` };
      }
      return {
        triggered: true,
        reason: `Dev wallet ${act.action}ed${act.amountUsd != null ? ` $${act.amountUsd.toLocaleString()}` : ""}.`,
      };
    }
    case "lp-drain": {
      if (snap.lpUsd != null && snap.lpUsd <= 0) {
        return { triggered: true, reason: "LP is fully drained (0 remaining)." };
      }
      const drop = snap.lpDropPct;
      const t = rule.threshold ?? 50;
      if (drop == null) {
        return { triggered: false, reason: "No LP data in this scan — needs LP size vs the previous observation." };
      }
      return drop >= t
        ? { triggered: true, reason: `LP dropped ${drop.toFixed(1)}% — over ${t}%.` }
        : { triggered: false, reason: `LP dropped ${drop.toFixed(1)}% — under ${t}%.` };
    }
    case "honeypot-flip": {
      if (snap.honeypotFlipped !== true) {
        return { triggered: false, reason: "No honeypot flip in this scan — needs sellability vs the previous scan." };
      }
      const dir = rule.direction ?? "any";
      const toHoneypot = snap.honeypotSellable === false;
      if (dir === "to-honeypot" && !toHoneypot) {
        return { triggered: false, reason: "Token flipped back to sellable — this rule watches flips to honeypot." };
      }
      if (dir === "to-sellable" && toHoneypot) {
        return { triggered: false, reason: "Token flipped to honeypot — this rule watches flips back to sellable." };
      }
      return {
        triggered: true,
        reason: toHoneypot ? "Token flipped from sellable to honeypot." : "Token flipped from honeypot back to sellable.",
      };
    }
    case "authority-change": {
      const change = snap.authorityChange;
      if (!change) {
        return { triggered: false, reason: "No authority change in this scan — needs authority vs the previous scan." };
      }
      const label =
        change.kind === "mint-enabled"
          ? "Mint authority re-enabled"
          : change.kind === "freeze-enabled"
            ? "Freeze authority re-enabled"
            : change.kind === "ownership"
              ? "Ownership changed"
              : change.kind === "mint-disabled"
                ? "Mint authority disabled"
                : "Freeze authority disabled";
      return { triggered: true, reason: `${label}${change.detail ? ` — ${change.detail}` : "."}` };
    }
    case "volume-spike": {
      const h1 = snap.volumeH1;
      const h24 = snap.volumeH24;
      if (h1 == null || h24 == null) {
        return { triggered: false, reason: "No volume windows in this scan — needs DexScreener 1h + 24h volume." };
      }
      if (h24 <= 0) {
        return { triggered: false, reason: "24h volume is 0 — no baseline to compare 1h volume against." };
      }
      const avgHourly = h24 / 24;
      const ratio = h1 / avgHourly;
      const t = rule.threshold ?? 3;
      return ratio >= t
        ? { triggered: true, reason: `1h volume $${h1.toLocaleString()} is ${ratio.toFixed(1)}× the 24h average hourly volume ($${avgHourly.toLocaleString()}) — over ${t}×.` }
        : { triggered: false, reason: `1h volume $${h1.toLocaleString()} is ${ratio.toFixed(1)}× the 24h average hourly volume — under ${t}×.` };
    }
    case "price-threshold": {
      const price = snap.priceUsd;
      const t = rule.threshold ?? 0.01;
      if (price == null) return { triggered: false, reason: "No live price in this scan." };
      const cmp = rule.comparison ?? "above";
      if (cmp === "above") {
        return price >= t
          ? { triggered: true, reason: `Price $${price} is above $${t}.` }
          : { triggered: false, reason: `Price $${price} is below $${t}.` };
      }
      return price <= t
        ? { triggered: true, reason: `Price $${price} is below $${t}.` }
        : { triggered: false, reason: `Price $${price} is above $${t}.` };
    }
    case "mcap-threshold": {
      const mcap = snap.mcapUsd;
      const t = rule.threshold ?? 1_000_000;
      if (mcap == null) return { triggered: false, reason: "No market cap in this scan." };
      const cmp = rule.comparison ?? "above";
      if (cmp === "above") {
        return mcap >= t
          ? { triggered: true, reason: `Market cap $${mcap.toLocaleString()} is above $${t.toLocaleString()}.` }
          : { triggered: false, reason: `Market cap $${mcap.toLocaleString()} is below $${t.toLocaleString()}.` };
      }
      return mcap <= t
        ? { triggered: true, reason: `Market cap $${mcap.toLocaleString()} is below $${t.toLocaleString()}.` }
        : { triggered: false, reason: `Market cap $${mcap.toLocaleString()} is above $${t.toLocaleString()}.` };
    }
    case "top10-holder-sell": {
      const sell = snap.top10HolderSellUsd;
      if (sell == null) {
        return { triggered: false, reason: "No top-10 holder sell in this scan — needs whale alerts / trade tape plus holder data." };
      }
      const t = rule.threshold;
      const who = snap.top10HolderSellWallet ? ` (${snap.top10HolderSellWallet.slice(0, 4)}…${snap.top10HolderSellWallet.slice(-4)})` : "";
      if (t != null && sell < t) {
        return { triggered: false, reason: `Largest top-10 holder sell $${sell.toLocaleString()}${who} is under $${t.toLocaleString()}.` };
      }
      return { triggered: true, reason: `Top-10 holder sold $${sell.toLocaleString()}${who}${t != null ? ` — over $${t.toLocaleString()}` : ""}.` };
    }
    default:
      return { triggered: false, reason: "Unknown trigger type." };
  }
}

/** One firing of a rule against a scan — what the scanner UI surfaces. */
export interface FiredAlert {
  rule: AlertRule;
  reason: string;
  severity: AlertSeverity;
  firedAt: number;
}

/** A rule that matched the scan evidence but was held back by its cooldown. */
export interface SuppressedAlert {
  rule: AlertRule;
  reason: string;
  /** ms until the rule may fire again for this mint. */
  cooldownRemainingMs: number;
}

/**
 * Pure helper: pull the trade evidence a snapshot needs out of the scan's
 * whale alerts + trade tape. whaleBuyUsd is the largest single buy in
 * either source; top10HolderSellUsd is the largest sell whose wallet is
 * one of the token's top-10 holders. No tape/whale data → nulls (the
 * rules that need them then honestly don't fire).
 */
export function summarizeTradeEvidence(input: {
  whaleAlerts?: Array<{ wallet: string; amountUsd: number; side: "buy" | "sell" }> | null;
  tradeTape?: Array<{ wallet: string; sizeUsd: number; side: "buy" | "sell" }> | null;
  top10Wallets?: string[] | null;
}): { whaleBuyUsd: number | null; top10HolderSellUsd: number | null; top10HolderSellWallet: string | null } {
  const buys: number[] = [];
  for (const w of input.whaleAlerts ?? []) {
    if (w.side === "buy" && Number.isFinite(w.amountUsd)) buys.push(w.amountUsd);
  }
  for (const t of input.tradeTape ?? []) {
    if (t.side === "buy" && Number.isFinite(t.sizeUsd)) buys.push(t.sizeUsd);
  }
  const top10 = new Set(input.top10Wallets ?? []);
  let topSell: { usd: number; wallet: string } | null = null;
  const considerSell = (wallet: string, usd: number) => {
    if (!top10.has(wallet) || !Number.isFinite(usd)) return;
    if (!topSell || usd > topSell.usd) topSell = { usd, wallet };
  };
  for (const w of input.whaleAlerts ?? []) {
    if (w.side === "sell") considerSell(w.wallet, w.amountUsd);
  }
  for (const t of input.tradeTape ?? []) {
    if (t.side === "sell") considerSell(t.wallet, t.sizeUsd);
  }
  return {
    whaleBuyUsd: buys.length ? Math.max(...buys) : null,
    top10HolderSellUsd: topSell ? topSell.usd : null,
    top10HolderSellWallet: topSell ? topSell.wallet : null,
  };
}

/**
 * Team B calls this after a scan completes. Fired rules get their
 * lastTriggeredAt / triggerCount bumped and persisted; the fired list is
 * returned so the scanner UI can surface it. Non-firing rules are
 * returned unchanged. Only locally-evaluable rules can fire here.
 *
 * Cooldown / dedup (W4): a rule that fired for this mint inside its
 * cooldown window does NOT re-fire — it lands in `suppressed` with the
 * remaining wait instead. A rule fires at most once per call, and the
 * fired list is deduped by rule id, so a re-scan with unchanged data
 * never double-reports the same firing.
 */
export function checkRulesAgainstScan(
  rules: AlertRule[],
  snap: ScanSnapshotForEval,
): { rules: AlertRule[]; fired: FiredAlert[]; suppressed: SuppressedAlert[] } {
  const now = Date.now();
  const fired: FiredAlert[] = [];
  const suppressed: SuppressedAlert[] = [];
  const seen = new Set<string>();
  const next = rules.map((rule) => {
    const res = evaluateRuleAgainstScan(rule, snap);
    if (!res.triggered) return rule;
    if (seen.has(rule.id)) return rule;
    seen.add(rule.id);
    const cooldownMs = (rule.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES) * 60_000;
    if (rule.lastTriggeredAt != null && cooldownMs > 0 && now - rule.lastTriggeredAt < cooldownMs) {
      suppressed.push({
        rule,
        reason: `Cooling down — fired ${Math.round((now - rule.lastTriggeredAt) / 60_000)} min ago, next fire in ${Math.max(1, Math.ceil((cooldownMs - (now - rule.lastTriggeredAt)) / 60_000))} min.`,
        cooldownRemainingMs: cooldownMs - (now - rule.lastTriggeredAt),
      });
      return rule;
    }
    const updated: AlertRule = { ...rule, lastTriggeredAt: now, triggerCount: rule.triggerCount + 1 };
    fired.push({ rule: updated, reason: res.reason, severity: updated.severity, firedAt: now });
    return updated;
  });
  if (fired.length > 0) persist(next);
  return { rules: next, fired, suppressed };
}

export interface UseAlertBuilder {
  rules: AlertRule[];
  addRule: (input: AlertRuleInput) => AlertRule | null;
  setEnabled: (id: string, enabled: boolean) => void;
  removeRule: (id: string) => void;
  /** Run all enabled rules against a just-completed scan; returns fired rules. */
  checkScan: (snap: ScanSnapshotForEval) => FiredAlert[];
}

export function useAlertBuilder(): UseAlertBuilder {
  const [rules, setRules] = useState<AlertRule[]>([]);

  useEffect(() => {
    setRules(loadAlertRules());
  }, []);

  const addRule = useCallback((input: AlertRuleInput) => {
    const rule = createAlertRule(input);
    if (rule) setRules(loadAlertRules());
    return rule;
  }, []);

  const setEnabled = useCallback((id: string, enabled: boolean) => {
    setRules(updateAlertRule(id, { enabled }));
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules(deleteAlertRule(id));
  }, []);

  const checkScan = useCallback((snap: ScanSnapshotForEval) => {
    const { rules: next, fired } = checkRulesAgainstScan(loadAlertRules(), snap);
    setRules(next);
    return fired;
  }, []);

  return { rules, addRule, setEnabled, removeRule, checkScan };
}
