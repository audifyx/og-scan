/**
 * tokenomics/burnFlow — THE canonical buy-and-burn API for ORBITXCITY.
 *
 * Every in-game purchase path (upgrades, real estate, vehicles, vendors,
 * auctions, battle pass, billboards, bribes, entry fees, casino, sponsors…)
 * calls `burnPurchase()`. It validates, normalizes the ledger reason into the
 * canonical `city:<module>:<action>[:<itemId>]` namespace, writes the shared
 * burn ledger, and calls the real backend-signed ORBITX burn
 * (`useOrbitxBilling().spend()` → orbitx_app_burn → createBurnInstruction →
 * signAndSendUserTx). Never throws — callers branch on `result.ok`.
 *
 * The game NEVER custodies keys or funds. No per-transaction signing popups.
 *
 * Dry-run (TEST HOOK ONLY — never on a production path): `setBurnDryRun(true)`
 * or open any city URL with `?burnDryRun=1`. burnPurchase() then reaches the
 * burn invocation point with exact params, records the would-be call in the
 * dry-run ledger, and STOPS — billing.spend() is never called, so no
 * on-chain transaction executes. The user test-fires small real amounts
 * himself with the hook off.
 */

/** Minimal structural shape burnPurchase needs. Every module's billing
 * provider satisfies this (ready + spend); modules never import the hook. */
export interface BurnBillingLike {
  ready: boolean;
  spend: (opts: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }>;
}

/**
 * Canonical ORBITX reason namespace: `city:<module>:<action>[:<itemId>]`.
 * The ledger and the backend index burns by this reason, so keep it
 * stable per purchase path.
 */
export function burnReason(module: string, action: string, itemId?: string): string {
  const base = `city:${module}:${action}`;
  return itemId ? `${base}:${itemId}` : base;
}

/* Legacy dash-form reason prefixes produced before the canonical namespace
 * landed (e.g. `city-bank:deed`, `city-heists:casino-entry`, `city-sports:…`,
 * `city-social:…`, `city-realestate:…`, `city:police-bribe`). */
const DASH_TO_MODULE: Record<string, string> = {
  bank: "bank",
  heists: "heists",
  social: "social",
  sports: "sports",
  realestate: "realestate",
  character: "character",
  gadget: "gadget",
  media: "media",
  police: "police",
  bounty: "bounty",
  seasons: "seasons",
  events: "events",
  vehicles: "vehicles",
  racing: "racing",
  districts: "districts",
  "season-pass": "seasons",
};

/**
 * Normalize any legacy reason into the canonical `city:<module>:…` form.
 * Already-canonical reasons pass through untouched. Never throws.
 */
export function normalizeBurnReason(reason: unknown, module?: string): string {
  const raw = typeof reason === "string" ? reason.trim() : "";
  if (raw.startsWith("city:")) {
    // Special case: `city:police-bribe` → `city:police:bribe`.
    const tail = raw.slice("city:".length);
    const dashIdx = tail.indexOf("-");
    if (dashIdx > 0 && !tail.includes(":")) {
      const mod = tail.slice(0, dashIdx);
      const rest = tail.slice(dashIdx + 1);
      return `city:${DASH_TO_MODULE[mod] ?? mod}:${rest}`;
    }
    return raw;
  }
  const dash = raw.match(/^city-([a-z-]+):(.*)$/);
  if (dash) {
    const mod = DASH_TO_MODULE[dash[1]] ?? dash[1].replace(/-/g, "_");
    return `city:${mod}:${dash[2]}`;
  }
  const fallbackMod = (module || "misc").replace(/[^a-z0-9_]/gi, "_") || "misc";
  const slug = raw
    ? raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "purchase"
    : "purchase";
  return `city:${fallbackMod}:purchase:${slug}`;
}

/** Args for a single buy-and-burn purchase. */
export interface BurnPurchaseArgs {
  /** Whole ORBITX tokens to burn. */
  amount: number;
  /** SKU / item identifier, e.g. "casino-entry", "deed:penthouse-3". */
  itemId: string;
  /** Human label for the local burn ledger, e.g. "Casino entry fee". */
  label?: string;
  /** Namespaced reason — build with burnReason(), or pass a legacy form and
   * it is normalized automatically. */
  reason: string;
  /** Idempotency / ledger ref. Auto-generated when omitted. */
  ref?: string;
  /** Module tag for the ledger, e.g. "heists". */
  module?: string;
}

export type BurnPurchaseResult =
  | { ok: true; signature: string; ref: string; dryRun: boolean }
  | { ok: false; code: "not-authed" | "invalid-amount" | "failed"; message: string };

/** Local burn ledger, shared with the economy bank + real-estate burn history. */
const BURN_LOG_KEY = "orbitxcity:burn-log:v1";
const BURN_LOG_MAX = 100;
/** Dry-run verification log — entries here NEVER touched the chain. */
const DRYRUN_LOG_KEY = "orbitxcity:burn-dryrun-log:v1";

export interface BurnLogRecord {
  at: number;
  itemId: string;
  itemLabel: string;
  amount: number;
  signature: string;
  ref: string;
  reason: string;
  module?: string;
  dryRun: boolean;
}

function loadLog(key: string): BurnLogRecord[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, BURN_LOG_MAX) : [];
  } catch {
    return [];
  }
}

function pushLog(key: string, rec: BurnLogRecord): void {
  try {
    localStorage.setItem(key, JSON.stringify([rec, ...loadLog(key)].slice(0, BURN_LOG_MAX)));
  } catch {
    /* ignore */
  }
}

/** The real burn history (shared with the bank UI). */
export function getBurnLedger(): BurnLogRecord[] {
  return loadLog(BURN_LOG_KEY);
}

/** Dry-run verification history — proof each path reached the burn call. */
export function getBurnDryRunLog(): BurnLogRecord[] {
  return loadLog(DRYRUN_LOG_KEY);
}

export function clearBurnDryRunLog(): void {
  try {
    localStorage.removeItem(DRYRUN_LOG_KEY);
  } catch {
    /* ignore */
  }
}

/* ---- dry-run test hook ------------------------------------------------
 * HARD RULE: dry-run is a TEST HOOK ONLY. It is never enabled in the
 * production purchase flow — it exists so purchase paths can be verified
 * end-to-end (reaching the real burn invocation with correct params)
 * without executing an on-chain transaction.
 *
 * Enable: `setBurnDryRun(true)` in the console, or open any city URL
 * with `?burnDryRun=1`. The user test-fires small real amounts himself
 * with the hook off.
 * --------------------------------------------------------------------- */

let burnDryRunFlag = false;

/** Enable/disable dry-run mode (test hook only). */
export function setBurnDryRun(on: boolean): void {
  burnDryRunFlag = on;
  try {
    if (on) localStorage.setItem("orbitxcity:burn-dryrun", "1");
    else localStorage.removeItem("orbitxcity:burn-dryrun");
  } catch {
    /* ignore */
  }
}

/** True when dry-run verification mode is active. */
export function isBurnDryRun(): boolean {
  if (burnDryRunFlag) return true;
  try {
    if (localStorage.getItem("orbitxcity:burn-dryrun") === "1") return true;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("burnDryRun") === "1") {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function newRef(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `ref-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}

/**
 * THE canonical burn API. Every in-game purchase path calls this:
 * upgrades, real estate, vehicles, vendors, auctions, battle pass,
 * billboards, bribes, entry fees, casino, sponsors…
 *
 * Flow: validate → normalize reason → idempotency ref → (dry-run: log +
 * return WITHOUT calling spend) → real path: billing.spend() which is the
 * backend-signed ORBITX burn (orbitx_app_burn → createBurnInstruction →
 * signAndSendUserTx). Never throws — callers branch on `result.ok`.
 */
export async function burnPurchase(
  billing: BurnBillingLike | null | undefined,
  args: BurnPurchaseArgs,
): Promise<BurnPurchaseResult> {
  if (!billing || !billing.ready) {
    return {
      ok: false,
      code: "not-authed",
      message: "ORBITX billing isn't authed yet — run the one-time dashboard link first.",
    };
  }
  const amount = Math.floor(Number(args.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      code: "invalid-amount",
      message: "Burn amount must be a positive whole number of ORBITX.",
    };
  }
  const reason = normalizeBurnReason(args.reason, args.module);
  const ref = args.ref || newRef();
  const dryRun = isBurnDryRun();

  if (dryRun) {
    // Verification mode: reach the burn invocation with exact params,
    // record the would-be call, and STOP — no on-chain transaction.
    const rec: BurnLogRecord = {
      at: Date.now(),
      itemId: args.itemId,
      itemLabel: args.label ?? args.itemId,
      amount,
      signature: `dryrun:${ref}`,
      ref,
      reason,
      module: args.module,
      dryRun: true,
    };
    pushLog(DRYRUN_LOG_KEY, rec);
    return { ok: true, signature: rec.signature, ref, dryRun: true };
  }

  try {
    const { signature } = await billing.spend({ amount, reason, ref });
    const rec: BurnLogRecord = {
      at: Date.now(),
      itemId: args.itemId,
      itemLabel: args.label ?? args.itemId,
      amount,
      signature,
      ref,
      reason,
      module: args.module,
      dryRun: false,
    };
    pushLog(BURN_LOG_KEY, rec);
    return { ok: true, signature, ref, dryRun: false };
  } catch (err) {
    return {
      ok: false,
      code: "failed",
      message: err instanceof Error ? err.message : "Burn failed.",
    };
  }
}
