/**
 * POST /api/ogdex/tg-scan — OG scanner for the Telegram Mini App (v1).
 *
 * Read-only scanner. No wallet, no trading, no payments, no links out.
 * Plugged into the ogdex.js connector (ROUTES map) — NOT a standalone
 * api/ file, per the 12-function cap in AGENTS.md.
 *
 * Request (JSON): { initData: "<raw Telegram.WebApp.initData>", mint: "<solana mint>" }
 * Response: { ok, mint, score, verdict, band, reasons[], price, liquidity,
 *   holders, honeypot, mintAuthority, freezeAuthority, lpLockedPct, lpBurned,
 *   devExited, topHolderPct, categories, unknowns, cached, scannedAt }
 * Every field the engine could not compute comes back as `null` (with the
 * reason in `reasons[]` / `unknowns`), never 0 or an invented value.
 *
 * How it works:
 * 1. initData is validated server-side on EVERY request (see
 *    validateInitData below): Ed25519 `signature` against Telegram's
 *    published production public key (Bot API 8.0+, no bot token needed),
 *    plus HMAC-SHA-256 against `hash` when TELEGRAM_BOT_TOKEN is set.
 *    `auth_date` must be fresh (≤24h) so stale data can't be replayed.
 *    A request that fails validation gets a plain 401. The parsed
 *    `initDataUnsafe` object is never trusted — the page sends raw initData.
 * 2. The mint must be a well-formed Solana address (same base58 rule as the
 *    web client's isValidMint): 32–44 chars, [1-9A-HJ-NP-Za-km-z].
 * 3. Data comes from the SAME routes the web scanner uses, invoked
 *    in-process (no HTTP round-trip, no duplicated fetching logic):
 *    ./_token.js (Jupiter-primary price/mcap/liquidity/volume/age + the
 *    intel safety probe) and ./_forensics.js (LP lock/burn incl. the
 *    pump.fun migration rule, holder concentration with pools excluded,
 *    dev position). The forensics first-buyer trace is skipped (?first=0) —
 *    the score doesn't use it.
 * 4. Scoring is the REAL engine: computeOgScore from
 *    web/shared/og-score.js — the same module the web scanner imports.
 *    The input is assembled exactly like the web client's useTokenIntel
 *    ogScore useMemo. Bundle / X / source-trace / clone checks are NOT run
 *    in v1 (see DELIBERATE OMISSIONS) — the engine treats them as
 *    unavailable (adjustment 0, listed in `unknowns`), exactly as the web
 *    client does before those scans land.
 * 5. Results are cached per mint for 90s (in-memory, warm-function only)
 *    and rate-limited per Telegram user id (15 scans / 60s).
 *
 * DELIBERATE OMISSIONS (v1):
 * - Bundle analysis, X intel, source-wallet trace, same-name clone check:
 *   not run. Each is a separate heavy scan (Helius holder tracing / X
 *   lookup / research route); the engine's own design treats unavailable as
 *   0 adjustment, so the core score (contract / liquidity / holders /
 *   deployer / trading / market) is the honest number. Add them later by
 *   passing adaptBundleAnalysis(bundle) / adaptXIntel(x) /
 *   adaptSourceTrace(bundle) / cloneVerdict(clones) results into the input.
 * - The token route's GeckoTerminal ATH work still runs (its handler has no
 *   fast path that keeps safety); a future `?sections=scan` could skip it.
 * - No persistence: cache + rate-limit buckets live in function memory and
 *   reset on cold start. Fine for a 90s cache on a free read-only scanner.
 *
 * LOCAL TESTING: there is no way to mint a real Telegram signature offline,
 * so a test bypass exists that is OFF by default and CANNOT turn on in
 * production: it requires TG_SCAN_TEST_MODE=1 AND TG_SCAN_TEST_SECRET set AND
 * VERCEL_ENV/NODE_ENV != "production", and the request must carry
 * test_secret=<TG_SCAN_TEST_SECRET> inside initData. Never set
 * TG_SCAN_TEST_SECRET in Vercel env vars.
 */
import { createHmac, createPublicKey, timingSafeEqual, verify as edVerify } from "node:crypto";
import { authorityVerdict, computeOgScore, honeypotChecks } from "../../../shared/og-score.js";
import tokenHandler from "./_token.js";
import forensicsHandler from "./_forensics.js";
import { poolKindFor } from "../_holders.js";
import { readBody } from "../_lib.js";

// @orbitxapirbot — the Mini App's bot. Pinned so initData issued for any
// other bot cannot be replayed here. Override with TG_MINIAPP_BOT_ID if the
// Mini App ever moves to a different bot.
const BOT_ID = String(process.env.TG_MINIAPP_BOT_ID || "9233176497").trim();
// Telegram's published Ed25519 public keys (core.telegram.org/bots/webapps,
// "Validating data for Third-Party Use"). Production first; the test-env key
// is accepted too so test-environment Mini Apps validate.
const TG_PUBLIC_KEYS_HEX = [
  "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d", // production
  "40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec", // test env
];
const MAX_AGE_S = 86_400; // initData is valid for 1 day (Telegram docs)
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CACHE_TTL_MS = 90_000;
const RATE_LIMIT = 15; // scans per user per window
const RATE_WINDOW_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 25_000; // per in-process route call

const cache = new Map(); // mint -> { at, payload }
const buckets = new Map(); // tg user id -> { count, reset }

function base64urlToBuf(s) {
  return Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function ed25519PublicKey(hex) {
  // Raw 32-byte Ed25519 key -> SPKI DER (prefix 302a300506032b6570032100).
  const raw = Buffer.from(hex, "hex");
  const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}
let _pubkeys = null;
function publicKeys() {
  if (!_pubkeys) _pubkeys = TG_PUBLIC_KEYS_HEX.map(ed25519PublicKey);
  return _pubkeys;
}

/**
 * Validate raw Telegram Mini App initData.
 * Returns { ok: true, userId, username } or { ok: false, error }.
 * Order: auth_date freshness -> Ed25519 signature (Bot API 8.0+) -> HMAC
 * hash (only when TELEGRAM_BOT_TOKEN is set) -> test bypass (local only).
 * A `signature` that is present but invalid is rejected outright — it never
 * falls through to HMAC, so a forged signature can't downgrade the check.
 */
function validateInitData(initData) {
  const raw = String(initData || "");
  if (!raw) return { ok: false, error: "missing" };
  let params;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return { ok: false, error: "malformed" };
  }
  const entries = [...params.entries()];
  const get = (k) => {
    const e = entries.find(([key]) => key === k);
    return e ? e[1] : null;
  };

  // Test bypass — local only, double-gated (see header comment). Requires
  // TG_SCAN_TEST_MODE=1 + TG_SCAN_TEST_SECRET set + non-production env, and
  // the request must carry the secret inside initData.
  const testMode =
    process.env.TG_SCAN_TEST_MODE === "1" &&
    !!process.env.TG_SCAN_TEST_SECRET &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.NODE_ENV !== "production";
  if (testMode && get("test_secret") === process.env.TG_SCAN_TEST_SECRET) {
    const authDate = Number(get("auth_date") || 0);
    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > MAX_AGE_S) {
      return { ok: false, error: "expired" };
    }
    let user = null;
    try { user = JSON.parse(get("user") || "null"); } catch { /* fall through */ }
    if (!user || !Number.isFinite(Number(user.id))) return { ok: false, error: "missing_user" };
    return { ok: true, userId: String(user.id), username: user.username || null, test: true };
  }

  // auth_date freshness — stale initData can't be replayed.
  const authDate = Number(get("auth_date") || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, error: "missing_auth_date" };
  const ageS = Date.now() / 1000 - authDate;
  if (ageS > MAX_AGE_S || ageS < -60) return { ok: false, error: "expired" };

  // Fields for the data-check-string: all received fields except `hash`
  // (HMAC) — and except `hash` AND `signature` (Ed25519) — sorted by key.
  const dcs = (exclude) =>
    entries
      .filter(([k]) => !exclude.includes(k))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

  // 1. Ed25519 signature (Bot API 8.0+): data-check-string is
  //    "<bot_id>:WebAppData\n" + sorted fields; signature is base64url.
  const signature = get("signature");
  if (signature) {
    const checkString = `${BOT_ID}:WebAppData\n${dcs(["hash", "signature"])}`;
    let sig;
    try {
      sig = base64urlToBuf(signature);
    } catch {
      return { ok: false, error: "bad_signature" };
    }
    if (sig.length !== 64) return { ok: false, error: "bad_signature" };
    let valid = false;
    for (const key of publicKeys()) {
      try {
        if (edVerify(null, Buffer.from(checkString, "utf8"), key, sig)) { valid = true; break; }
      } catch { /* try the next key */ }
    }
    if (!valid) return { ok: false, error: "bad_signature" };
  } else {
    // 2. No signature (older client): HMAC-SHA-256 against `hash`, only
    //    when the bot token is configured. Without a token there is nothing
    //    to check against, so unsigned data is rejected, not trusted.
    const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const hash = get("hash");
    if (!token || !hash) return { ok: false, error: "unverifiable" };
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    const digest = createHmac("sha256", secret).update(dcs(["hash"])).digest("hex");
    const a = Buffer.from(digest);
    const b = Buffer.from(String(hash).toLowerCase());
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "bad_hash" };
    }
  }

  let user = null;
  try { user = JSON.parse(get("user") || "null"); } catch { /* fall through */ }
  if (!user || !Number.isFinite(Number(user.id))) return { ok: false, error: "missing_user" };
  return { ok: true, userId: String(user.id), username: user.username || null };
}

function rateLimited(userId) {
  const now = Date.now();
  let b = buckets.get(userId);
  if (!b || now >= b.reset) {
    b = { count: 0, reset: now + RATE_WINDOW_MS };
    buckets.set(userId, b);
  }
  b.count++;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.reset) buckets.delete(k);
  }
  if (b.count > RATE_LIMIT) {
    return Math.ceil((b.reset - now) / 1000);
  }
  return 0;
}

const finiteNum = (v) => {
  // NB: Number(null) === 0 and Number("") === 0 — an unavailable signal must
  // stay null, never silently become 0 (a 0 would score points and hide the gap).
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Invoke an existing (req, res) route handler in-process and capture its JSON. */
function callRoute(handler, url) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (!done) { done = true; resolve(v); }
    };
    const timer = setTimeout(() => finish(null), UPSTREAM_TIMEOUT_MS);
    const headers = new Map();
    const res = {
      setHeader: (k, v) => headers.set(String(k).toLowerCase(), v),
      getHeader: (k) => headers.get(String(k).toLowerCase()),
      statusCode: 200,
      end: (payload) => {
        clearTimeout(timer);
        try { finish(JSON.parse(String(payload))); } catch { finish(null); }
      },
    };
    try {
      Promise.resolve(handler({ url, method: "GET", headers: {} }, res)).catch(() => {
        clearTimeout(timer);
        finish(null);
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/** Top non-pool holder share (0–100) from the intel holders sample. */
function topHolderPct(holders) {
  if (!Array.isArray(holders) || !holders.length) return null;
  let best = null;
  for (const h of holders) {
    const isPool = h.isPool === true || poolKindFor(h.poolProgram) === "liquidity pool";
    if (isPool) continue;
    const pct = finiteNum(h.pct);
    if (pct != null && (best == null || pct > best)) best = pct;
  }
  return best;
}

function authorityState(renounced) {
  const v = authorityVerdict(renounced);
  if (v.state === "pass") return "revoked";
  if (v.state === "fail") return "live";
  return null;
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Use POST with { initData, mint }." });
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    body = {};
  }
  if (!body || typeof body !== "object") body = {};
  const initData = typeof body.initData === "string" ? body.initData : "";
  const mint = String(body.mint || "").trim();

  // 1. Telegram identity — validated on every request, never trusted raw.
  const auth = validateInitData(initData);
  if (!auth.ok) {
    return sendJson(res, 401, {
      ok: false,
      error: "Open this scanner from Telegram and try again — your session could not be verified.",
    });
  }

  // 2. Mint shape — same base58 rule as the web client's isValidMint.
  if (!MINT_RE.test(mint)) {
    return sendJson(res, 400, {
      ok: false,
      error: "That doesn't look like a token address — paste a Solana token address (the long string of letters and numbers).",
    });
  }

  // 3. Per-user rate limit (keyed on the VALIDATED Telegram user id).
  const retryAfter = rateLimited(auth.userId);
  if (retryAfter > 0) {
    res.setHeader("Retry-After", String(retryAfter));
    return sendJson(res, 429, {
      ok: false,
      error: `Slow down — too many scans. Try again in ${retryAfter}s.`,
      retryAfter: retryAfter,
    });
  }

  // 4-6. Data + the real engine — see scanMint() below (shared with the
  // Telegram webhook route, which has no initData to validate).
  const payload = await scanMint(mint);
  return sendJson(res, 200, payload);
}

/**
 * Run a full scan for a mint: cache -> live data -> the real OG engine.
 * Shared by the Mini App endpoint (above, after initData auth) and the
 * Telegram webhook route (the update itself is the auth — it only arrives
 * via the registered webhook URL). Returns the response payload.
 */
export async function scanMint(mint) {
  // Cache (90s per mint) — survives rate limits and repeat scans.
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.payload, cached: true };
  }

  // 5. Data — the same routes the web scanner uses, invoked in-process.
  const [tokenOut, forensics] = await Promise.all([
    callRoute(tokenHandler, `/api/ogdex/token?mint=${encodeURIComponent(mint)}`),
    callRoute(forensicsHandler, `/api/ogdex/forensics?mint=${encodeURIComponent(mint)}&first=0`),
  ]);

  const token = tokenOut?.token ?? null;
  const safety = tokenOut?.safety ?? null;
  const flags = forensics?.safetyFlags ?? null;
  const concentration = forensics?.concentration ?? null;
  const dev = forensics?.dev ?? null;

  const price = finiteNum(token?.priceUsd);
  const liquidity = finiteNum(token?.liquidityUsd ?? token?.liquidity);
  const marketCap = finiteNum(token?.marketCap ?? token?.mcap);
  const volume24h = finiteNum(token?.volume24h ?? token?.volume);
  const totalHolders = finiteNum(concentration?.totalHolders ?? token?.holderCount);
  const top10Pct = finiteNum(concentration?.top10Pct);
  const lpLockedPct = finiteNum(flags?.lpLockedPct);
  const lpBurnedPct = finiteNum(flags?.lpBurnedPct);

  // 6. The REAL engine — same input assembly as the web client's
  //    useTokenIntel ogScore useMemo. Bundle / X / source-trace / clones are
  //    null in v1 (not run) — the engine scores them as unavailable, never
  //    as clean.
  const og = computeOgScore({
    mintRenounced: flags?.mintRenounced ?? null,
    freezeRenounced: flags?.freezeRenounced ?? null,
    lpLockedPct,
    rugged: flags?.rugged ?? null,
    liquidityUsd: liquidity,
    marketCapUsd: marketCap,
    volume24h,
    top10Pct,
    totalHolders,
    whaleCount: finiteNum(concentration?.whales),
    canBuy: safety?.canBuy ?? null,
    canSell: safety?.canSell ?? null,
    roundTripLossPct: finiteNum(safety?.roundTripLossPct),
    devSold: dev?.sold ?? null,
    devSerial: dev?.serial ?? null,
    creatorTokensCount: finiteNum(dev?.tokensCreated),
    ageDays: finiteNum(token?.ageDays),
    cloneCount: null,
    biggerClone: null,
    bundle: null,
    x: null,
    sourceTrace: null,
  });

  const checks = honeypotChecks(safety ?? null);
  const honeypot =
    safety == null ? null : safety.canSell === false ? true : safety.canSell === true ? false : null;

  const reasons = [
    ...og.categories.map((c) => `${c.label}: ${c.note} (${c.points}/${c.max})`),
    ...og.caps,
    ...checks
      .filter((c) => c.state === "fail" || c.state === "warn")
      .map((c) => `${c.label} — ${c.detail}`),
    ...(og.unknowns.length
      ? [`Not checked yet: ${og.unknowns.join(", ")} — treated as unknown, not as safe or risky.`]
      : []),
    ...(tokenOut == null && forensics == null
      ? ["Market and safety data were unavailable for this scan — the score below reflects only what could be observed."]
      : []),
  ];

  const payload = {
    ok: true,
    mint,
    score: og.score,
    verdict: og.label,
    band: og.band,
    reasons,
    price,
    liquidity,
    holders: totalHolders,
    honeypot,
    mintAuthority: authorityState(flags?.mintRenounced ?? null),
    freezeAuthority: authorityState(flags?.freezeRenounced ?? null),
    lpLockedPct,
    lpBurned: lpBurnedPct === 100 ? true : lpBurnedPct == null ? null : false,
    devExited: dev?.sold ?? null,
    topHolderPct: topHolderPct(tokenOut?.intel?.holders),
    categories: og.categories,
    unknowns: og.unknowns,
    cached: false,
    scannedAt: new Date().toISOString(),
  };

  cache.set(mint, { at: Date.now(), payload });
  if (cache.size > 500) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }

  return payload;
}
