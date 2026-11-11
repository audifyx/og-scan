/**
 * POST /api/ogdex/tg-scan — OG scanner for the Telegram Mini App.
 *
 * Read-only scanner. No wallet, no trading, no payments, no links out.
 * Plugged into the ogdex.js connector (ROUTES map) — NOT a standalone
 * api/ file, per the 12-function cap in AGENTS.md.
 *
 * Request (JSON): { initData: "<raw Telegram.WebApp.initData>", mint: "<solana mint>" }
 * Response: { ok, mint, score, verdict, band, reasons[], price, liquidity,
 *   holders, honeypot, mintAuthority, freezeAuthority, lpLockedPct, lpBurned,
 *   devExited, topHolderPct, categories, unknowns, bundle, x, clones,
 *   sourceTrace, cached, scannedAt }
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
 *    intel safety probe), ./_forensics.js (LP lock/burn incl. the
 *    pump.fun migration rule, holder concentration with pools excluded,
 *    dev position), ../_bundle.js (bundle analysis: clusters, bundled
 *    supply, dev-linked funding source) and ./_research.js (same-name
 *    clones + the linked X account). The forensics first-buyer trace is
 *    skipped (?first=0) — the source trace comes from the bundle scan
 *    instead, exactly like the web client derives it.
 * 4. Scoring is the REAL engine: computeOgScore from
 *    web/shared/og-score.js — the same module the web scanner imports —
 *    with the input assembled EXACTLY like the web client's useTokenIntel
 *    ogScore useMemo: cloneCount/biggerClone from the research clones,
 *    bundle from adaptBundleAnalysis(bundle), x from adaptXIntel (linked
 *    handle; followers/sentiment null, same as the web client when no
 *    profile enrichment is available), sourceTrace from
 *    adaptSourceTrace(bundle). The adapters below are server ports of the
 *    client's (useTokenIntel.ts) — same shapes, same nulls, same notes.
 *    A check that fails or times out comes back as unavailable (adjustment
 *    0, listed in `unknowns`), never as clean.
 * 5. Results are cached per mint for 90s (in-memory, warm-function only)
 *    and rate-limited per Telegram user id (15 scans / 60s).
 *
 * LOCAL TESTING: there is no way to mint a real Telegram signature offline,
 * so a test bypass exists that is OFF by default and CANNOT turn on in
 * production: it requires TG_SCAN_TEST_MODE=1 AND TG_SCAN_TEST_SECRET set AND
 * VERCEL_ENV/NODE_ENV != "production", and the request must carry
 * test_secret=<TG_SCAN_TEST_SECRET> inside initData. Never set
 * TG_SCAN_TEST_SECRET in Vercel env vars.
 */
import { createHmac, createPublicKey, timingSafeEqual, verify as edVerify } from "node:crypto";
import {
  authorityVerdict,
  bundleRiskVerdict,
  computeOgScore,
  honeypotChecks,
} from "../../../shared/og-score.js";
import tokenHandler from "./_token.js";
import forensicsHandler from "./_forensics.js";
import bundleHandler from "../../_bundle.js";
import researchHandler from "./_research.js";
import safetyHandler from "./_safety.js";
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

/** DexScreener pairs for a mint — which coins the token is paired to
 * (SOL/USDC/…) and on which DEX, with liquidity. Public API, no auth;
 * degrades to null on any failure. */
async function fetchDexPairs(mint) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10_000);
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`, {
      headers: { Accept: "application/json" },
      signal: ctl.signal,
    }).catch(() => null);
    clearTimeout(timer);
    if (!r || !r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!Array.isArray(d)) return null;
    const seen = new Set();
    const out = [];
    for (const p of d) {
      if (!p || p.baseToken?.address !== mint) continue;
      const dex = String(p.dexId || "").toLowerCase() || "unknown";
      const quote = p.quoteToken?.symbol || null;
      const key = dex + "|" + (quote || "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        dex,
        quote,
        liquidity: finiteNum(p.liquidity?.usd),
        volume24h: finiteNum(p.volume?.h24),
        buys24h: finiteNum(p.txns?.h24?.buys),
        sells24h: finiteNum(p.txns?.h24?.sells),
        pairAddress: p.pairAddress || null,
      });
    }
    out.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
    return out.slice(0, 6);
  } catch {
    return null;
  }
}

/** Same-name clones, direct from DexScreener search (same logic as the
 * research route's findClones, but without the slow X/Reddit searches
 * that make the research route time out inside scanMint). Used for the
 * vamp-or-OG verdict and the clone list. */
async function fetchClonesDirect(mint, symbol) {
  try {
    const q = encodeURIComponent(symbol || "");
    if (!q) return null;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10_000);
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${q}`, {
      headers: { Accept: "application/json" },
      signal: ctl.signal,
    }).catch(() => null);
    clearTimeout(timer);
    if (!r || !r.ok) return null;
    const d = await r.json().catch(() => null);
    const pairs = d?.pairs || [];
    return pairs
      .filter((p) => p.chainId === "solana" && p.baseToken?.address !== mint)
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, 20)
      .map((p) => ({
        mint: p.baseToken.address,
        name: p.baseToken.name,
        symbol: p.baseToken.symbol,
        mcap: p.marketCap || 0,
        volume24h: p.volume?.h24 || 0,
        liquidity: p.liquidity?.usd || 0,
        launchTime: p.pairCreatedAt || 0,
        dexUrl: p.url || `https://dexscreener.com/solana/${p.baseToken.address}`,
        price: Number(p.priceUsd || 0),
      }));
  } catch {
    return null;
  }
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

/** SPL token program id -> human label. Jupiter reports this on every token. */
function tokenProgramLabel(programId) {
  if (!programId) return null;
  if (programId === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") return "Token-2022";
  if (programId === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") return "SPL Token";
  return "Token program";
}

/** Top real holders for the "Top holders" list — same pool-exclusion the
 * forensics concentration uses (token-account cross-check + the >=30%
 * leaked-vault guard), so the list can never show a pool vault as a holder. */
function topHoldersList(intelHolders, poolTokenAccounts) {
  if (!Array.isArray(intelHolders) || !intelHolders.length) return null;
  const pools = poolTokenAccounts instanceof Set ? poolTokenAccounts : new Set();
  const real = intelHolders
    .filter((h) => h && h.isPool !== true && !pools.has(h.tokenAccount))
    .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0));
  if (!real.length) return null;
  if ((Number(real[0].pct) || 0) >= 30) return null; // leaked vault — show nothing, not a wrong list
  return real.slice(0, 5).map((h) => ({
    owner: h.owner || null,
    label: h.label || null,
    pct: finiteNum(h.pct),
    usdValue: finiteNum(h.usdValue),
  }));
}

function authorityState(renounced) {
  const v = authorityVerdict(renounced);
  if (v.state === "pass") return "revoked";
  if (v.state === "fail") return "live";
  return null;
}

// ── Adapters: server ports of the web client's useTokenIntel.ts helpers ──────
// Same shapes, same nulls, same notes. An unavailable scan maps to "no
// information", never to a clean bill of health.

/** W1 bundle scan → scoring input. Unknown/partial maps to available:false when the scan never completed; partial keeps its numbers with a note. */
function adaptBundleAnalysis(raw) {
  if (!raw) return null;
  if (raw.state === "unknown") {
    return {
      available: false,
      bundledSupplyPct: null,
      clusterCount: null,
      largestClusterPct: null,
      bundleRisk: null,
      note: raw.reason ?? "Bundle scan unavailable.",
    };
  }
  const clusters = Array.isArray(raw.clusters) ? raw.clusters : [];
  const largest = clusters.reduce(
    (m, c) => Math.max(m, Number.isFinite(c.supplyPct) ? c.supplyPct : 0),
    0,
  );
  const risk =
    raw.risk === "high"
      ? "high"
      : raw.risk === "medium"
        ? "moderate"
        : raw.risk === "low" || raw.risk === "none"
          ? "low"
          : null;
  return {
    available: true,
    bundledSupplyPct: raw.bundledSupplyPct ?? null,
    clusterCount: raw.clusterCount ?? null,
    largestClusterPct: clusters.length > 0 ? largest : null,
    bundleRisk: risk,
    note:
      raw.state === "partial"
        ? `Partial scan — ${raw.holdersTraced} of ${raw.holdersAnalyzed} holders traced.${raw.reason ? ` ${raw.reason}` : ""}`
        : null,
  };
}

/** Dev-source trace derived from W1's bundle scan: a dev-linked cluster's funding source is the source behind the dev wallet. No dev-linked cluster → unavailable, never invented. */
function adaptSourceTrace(raw) {
  if (!raw || raw.state === "unknown") return null;
  const clusters = Array.isArray(raw.clusters) ? raw.clusters : [];
  const devCluster = clusters.find((c) => c.devLinked);
  const devWallet = raw.creator ?? null;
  if (!devWallet && !devCluster) return null;
  const fundedBy = devCluster?.fundingSource ?? null;
  const otherLaunches = devCluster?.sourceOtherLaunches ?? null;
  return {
    available: true,
    devWallet,
    fundedBy,
    fundingHops: fundedBy ? 1 : null,
    sourceWallet: fundedBy,
    sourceTokensCreated: otherLaunches,
    sourceOtherLaunches: null,
    note: devCluster
      ? `Dev-linked cluster funded by ${fundedBy ? fundedBy.slice(0, 8) : "an untraced source"}${otherLaunches != null ? ` — that source is behind ${otherLaunches} other launch${otherLaunches === 1 ? "" : "es"}` : ""}.`
      : "No dev-linked funding cluster detected.",
  };
}

/** Linked X account → scoring input. The handle comes from the same sources
 * the web client merges (DexScreener socials on the token route, Jupiter /
 * pump metadata on the research route). Followers / sentiment are null —
 * the web client returns the same when no profile enrichment is available,
 * so the X adjustment stays 0 in both places. */
function adaptXIntel(twitterUrls) {
  let handle = null;
  let source = null;
  for (const [url, src] of twitterUrls) {
    if (typeof url !== "string" || !url) continue;
    const m = url.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})/i);
    if (m) {
      handle = m[1];
      source = src;
      break;
    }
  }
  return {
    availability: handle ? "available" : "unavailable",
    handle,
    followers: null,
    mentions24h: null,
    kolMentions: null,
    sentiment: null,
    accountAgeDays: null,
    note: handle
      ? `Linked X account @${handle} confirmed via ${source}.`
      : "No linked X account found.",
  };
}

/** Same-name clones → verdict. A bigger same-name clone is the dangerous case (the scanned one is likely the copy). */
function cloneVerdict(clones, ownMcap) {
  if (!clones) return { state: "unknown", label: "Unknown — clone check unavailable", count: 0, biggerClone: false };
  const count = clones.length;
  if (count === 0) return { state: "pass", label: "No same-name clones found", count: 0, biggerClone: false };
  const biggerClone =
    ownMcap != null && clones.some((c) => c.mcap != null && Number(c.mcap) > ownMcap);
  if (biggerClone) {
    return { state: "fail", label: `${count} same-name token(s) — a bigger one exists`, count, biggerClone: true };
  }
  return { state: "warn", label: `${count} same-name token(s) found`, count, biggerClone: false };
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
  // Token + forensics + bundle + research + DexScreener pairs run in
  // parallel; each is capped by UPSTREAM_TIMEOUT_MS (pairs 10s) and a
  // slow/failed one degrades to unavailable (the engine never treats it
  // as clean).
  const [tokenOut, forensics, bundleOut, researchOut, dexPairs, safetyOut] = await Promise.all([
    callRoute(tokenHandler, `/api/ogdex/token?mint=${encodeURIComponent(mint)}`),
    callRoute(forensicsHandler, `/api/ogdex/forensics?mint=${encodeURIComponent(mint)}&first=0`),
    callRoute(bundleHandler, `/api/ogdex/bundle?mint=${encodeURIComponent(mint)}`),
    callRoute(researchHandler, `/api/ogdex/research?mint=${encodeURIComponent(mint)}`),
    fetchDexPairs(mint),
    // Real tradeability: Jupiter round-trip quotes (buy 0.1 SOL, sell it
    // back) — the intel safety probe returns nothing for most tokens, so
    // without this honeypot + tradeability stay "unknown" forever.
    callRoute(safetyHandler, `/api/ogdex/safety?mint=${encodeURIComponent(mint)}`),
  ]);

  const token = tokenOut?.token ?? null;
  const safety = tokenOut?.safety ?? null;
  const flags = forensics?.safetyFlags ?? null;
  const concentration = forensics?.concentration ?? null;
  const dev = forensics?.dev ?? null;
  // The safety route is authoritative for tradeability; the intel probe is
  // the fallback when the route fails or times out.
  const safetyCheck = safetyOut?.ok
    ? {
        canBuy: safetyOut.canBuy ?? null,
        canSell: safetyOut.canSell ?? null,
        roundTripLossPct: finiteNum(safetyOut.roundTripLossPct),
        verdict: safetyOut.verdict ?? null,
        note: safetyOut.note ?? null,
      }
    : safety != null
      ? {
          canBuy: safety.canBuy ?? null,
          canSell: safety.canSell ?? null,
          roundTripLossPct: finiteNum(safety.roundTripLossPct),
          verdict: null,
          note: null,
        }
      : null;

  const price = finiteNum(token?.priceUsd);
  const liquidity = finiteNum(token?.liquidityUsd ?? token?.liquidity);
  const marketCap = finiteNum(token?.marketCap ?? token?.mcap);
  const volume24h = finiteNum(token?.volume24h ?? token?.volume);
  const totalHolders = finiteNum(concentration?.totalHolders ?? token?.holderCount);
  const top10Pct = finiteNum(concentration?.top10Pct);
  const lpLockedPct = finiteNum(flags?.lpLockedPct);
  const lpBurnedPct = finiteNum(flags?.lpBurnedPct);

  // The full engine — input assembled exactly like the web client's
  // useTokenIntel ogScore useMemo.
  const rawBundle = bundleOut?.ok ? bundleOut.analysis ?? null : null;
  const bundle = adaptBundleAnalysis(rawBundle);
  const sourceTrace = adaptSourceTrace(rawBundle);
  let clones = Array.isArray(researchOut?.clones) ? researchOut.clones : null;
  // The research route is slow (X/Reddit searches) and times out inside
  // scanMint — fall back to a direct DexScreener search so the vamp/OG
  // verdict and the clone list are actually populated.
  if (!clones) {
    clones = await fetchClonesDirect(mint, token?.symbol).catch(() => null);
  }
  const cv = cloneVerdict(clones, marketCap);
  const x = adaptXIntel([
    [tokenOut?.meta?.socials?.twitter ?? null, "DexScreener"],
    [researchOut?.meta?.links?.twitter ?? null, "token metadata"],
  ]);

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
    canBuy: safetyCheck?.canBuy ?? null,
    canSell: safetyCheck?.canSell ?? null,
    roundTripLossPct: safetyCheck?.roundTripLossPct ?? null,
    tokenProgram: token?.tokenProgram ?? null,
    devSold: dev?.sold ?? null,
    devSerial: dev?.serial ?? null,
    creatorTokensCount: finiteNum(dev?.tokensCreated),
    ageDays: finiteNum(token?.ageDays),
    cloneCount: clones ? clones.length : null,
    biggerClone: clones ? cv.biggerClone : null,
    bundle,
    x,
    sourceTrace,
  });

  const checks = honeypotChecks(safetyCheck ?? null);
  const honeypot =
    safetyCheck == null
      ? null
      : safetyCheck.canSell === false
        ? true
        : safetyCheck.canSell === true
          ? false
          : null;
  const bundleVerdict = bundleRiskVerdict(bundle);

  // Pool vault token accounts (forensics concentration) — the top-holders
  // list below excludes exactly these, so a vault never shows as a holder.
  const poolAccts = new Set(
    (Array.isArray(concentration?.pools) ? concentration.pools : [])
      .map((p) => p?.tokenAccount)
      .filter(Boolean),
  );
  // ATH + drawdown (token route, GeckoTerminal candles).
  const athPrice = finiteNum(tokenOut?.athPrice ?? tokenOut?.meta?.athPrice);
  const downFromAthPct =
    athPrice != null && price != null && athPrice > 0
      ? Number((((athPrice - price) / athPrice) * 100).toFixed(1))
      : null;
  // Social links — token route socials + research links, research wins.
  const metaSocials = tokenOut?.meta?.socials ?? {};
  const researchLinks = researchOut?.meta?.links ?? {};
  const socials = {
    telegram: researchLinks.telegram || metaSocials.telegram || null,
    discord: metaSocials.discord || null,
    website: researchLinks.website || metaSocials.website || null,
  };
  // Top traders by PnL (research route; null when it timed out).
  const topTradersRaw = Array.isArray(researchOut?.onchain?.topTraders)
    ? researchOut.onchain.topTraders
    : null;
  const topTraders = topTradersRaw
    ? [...topTradersRaw]
        .sort((a, b) => (Number(b.pnl) || 0) - (Number(a.pnl) || 0))
        .slice(0, 3)
        .map((t) => ({
          wallet: t.wallet || t.address || null,
          pnl: finiteNum(t.pnl),
          winRate: finiteNum(t.winRate),
          trades: finiteNum(t.trades),
        }))
    : null;

  const reasons = [
    ...og.categories.map((c) => `${c.label}: ${c.note} (${c.points}/${c.max})`),
    ...og.caps,
    ...checks
      .filter((c) => c.state === "fail" || c.state === "warn")
      .map((c) => `${c.label} — ${c.detail}`),
    `Bundle — ${bundleVerdict.label}${bundle?.bundledSupplyPct != null ? ` (${bundle.bundledSupplyPct.toFixed(1)}% bundled)` : ""}${bundle?.note ? ` — ${bundle.note}` : ""}`,
    `X — ${x.note}`,
    `Clones — ${cv.label}`,
    ...(sourceTrace?.note ? [`Source trace — ${sourceTrace.note}`] : []),
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
    marketCap,
    volume24h,
    change24h: finiteNum(token?.change24h),
    change5m: finiteNum(token?.change5m),
    change1h: finiteNum(token?.change1h),
    change6h: finiteNum(token?.change6h),
    pairs: dexPairs,
    name: token?.name ?? null,
    symbol: token?.symbol ?? null,
    top10Pct,
    ageDays: finiteNum(token?.ageDays),
    whaleCount: finiteNum(concentration?.whales),
    devWallet: dev?.wallet ?? null,
    devTokensCreated: finiteNum(dev?.tokensCreated),
    devSerial: dev?.serial ?? null,
    honeypotChecks: checks,
    tradeability: safetyCheck,
    // — Token — (Jupiter + forensics, already fetched)
    decimals: finiteNum(token?.decimals),
    totalSupply: finiteNum(token?.totalSupply),
    fdv: finiteNum(token?.fdv),
    tokenProgram: tokenProgramLabel(token?.tokenProgram ?? null),
    isVerified: token?.isVerified ?? null,
    createdAt: token?.createdAt ?? tokenOut?.meta?.createdAt ?? null,
    launchpad: forensics?.launchpad ?? null,
    bondingComplete: forensics?.bondingComplete ?? null,
    // — History — ATH + drawdown.
    athPrice,
    athMcap: finiteNum(tokenOut?.athMcap ?? tokenOut?.meta?.athMcap),
    downFromAthPct,
    // — Activity — Jupiter 24h stats.
    numBuys24h: finiteNum(token?.numBuys ?? tokenOut?.meta?.numBuys24h),
    numSells24h: finiteNum(token?.numSells ?? tokenOut?.meta?.numSells24h),
    numTraders24h: finiteNum(token?.numTraders ?? tokenOut?.meta?.numTraders24h),
    netBuyers24h: finiteNum(token?.netBuyers ?? tokenOut?.meta?.netBuyers24h),
    buyVolume24h: finiteNum(token?.buyVolume ?? tokenOut?.meta?.buyVolume24h),
    sellVolume24h: finiteNum(token?.sellVolume ?? tokenOut?.meta?.sellVolume24h),
    organicScore: finiteNum(token?.organicScore),
    organicScoreLabel: token?.organicScoreLabel ?? null,
    momentum: finiteNum(tokenOut?.momentum),
    momentumLabel: tokenOut?.momentumLabel ?? null,
    holderChange24h: finiteNum(token?.holderChange24h),
    // — Holders — top-5 list, pool-filtered + leaked-vault guard.
    topHolders: topHoldersList(tokenOut?.intel?.holders, poolAccts),
    kolHolderCount: finiteNum(tokenOut?.intel?.kolHolderCount),
    // — Social — links + mention counts (research route; null if it timed out).
    socials,
    xMentions: finiteNum(researchOut?.social?.twitter?.total),
    redditMentions: finiteNum(researchOut?.social?.reddit?.total),
    topTraders,
    description:
      (typeof researchOut?.meta?.description === "string" && researchOut.meta.description.trim()) ||
      (typeof researchOut?.launch?.description === "string" && researchOut.launch.description.trim()) ||
      null,
    caps: og.caps,
    holders: totalHolders,
    honeypot,
    mintAuthority: authorityState(flags?.mintRenounced ?? null),
    freezeAuthority: authorityState(flags?.freezeRenounced ?? null),
    lpLockedPct,
    lpBurned: lpBurnedPct === 100 ? true : lpBurnedPct == null ? null : false,
    devExited: dev?.sold ?? null,
    // Top holder from the forensics concentration (local Helius holders,
    // pools excluded) — the token-route intel sample mis-attributes
    // multi-pool vaults. Fall back to the intel sample only when the
    // concentration has no value.
    topHolderPct:
      finiteNum(concentration?.topHolderPct) ?? topHolderPct(tokenOut?.intel?.holders),
    categories: og.categories,
    unknowns: og.unknowns,
    bundle: {
      available: bundle?.available ?? false,
      bundledSupplyPct: bundle?.bundledSupplyPct ?? null,
      clusterCount: bundle?.clusterCount ?? null,
      bundleRisk: bundle?.bundleRisk ?? null,
      verdict: bundleVerdict.label,
      note: bundle?.note ?? null,
    },
    x: {
      availability: x.availability,
      handle: x.handle,
      note: x.note,
    },
    clones: {
      count: clones ? cv.count : null,
      biggerClone: clones ? cv.biggerClone : null,
      state: clones ? cv.state : "unknown",
      label: cv.label,
      // Top same-name clones by mcap (for the "show the clones" list).
      list: clones
        ? [...clones]
            .sort((a, b) => (Number(b.mcap) || 0) - (Number(a.mcap) || 0))
            .slice(0, 5)
            .map((c) => ({
              mint: c.mint || null,
              name: c.name || null,
              symbol: c.symbol || null,
              mcap: finiteNum(c.mcap),
              liquidity: finiteNum(c.liquidity),
              volume24h: finiteNum(c.volume24h),
            }))
        : null,
    },
    sourceTrace: sourceTrace
      ? {
          available: true,
          sourceWallet: sourceTrace.sourceWallet,
          sourceTokensCreated: sourceTrace.sourceTokensCreated,
          note: sourceTrace.note,
        }
      : null,
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
