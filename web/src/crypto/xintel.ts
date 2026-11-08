/**
 * X Intelligence (W2) — real X/Twitter data for a token, with honest
 * availability on every signal.
 *
 * SOURCE INVESTIGATION (2026-11-08, verified live against ORBITX
 * 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9):
 *
 *  (a) web/api/x-mcp.js — LIVE, but it is a *per-user* OAuth2 MCP: every X
 *      call uses the connected user's own access token from Supabase
 *      (lookupXUser, mentions, followers, user tweets). It has NO search
 *      tool and NO app-level bearer token, so it cannot serve anonymous
 *      scanner lookups. Not used here.
 *  (b) DexScreener — LIVE, keyless. GET /tokens/v1/solana/{mint} returns
 *      info.socials[] incl. { type: "twitter", url }. ORBITX returns
 *      https://x.com/orbitx_wrld. This is the primary linked-handle source.
 *  (c) GeckoTerminal — LIVE, keyless. GET /tokens/{mint}/info returns
 *      attributes.twitter_handle. ORBITX returns "orbitx_wrld" — agrees
 *      with DexScreener. Second source / cross-check. The plain token
 *      endpoint carries NO socials. Birdeye needs an API key (401 without
 *      one) and is not used.
 *  (d) No X connector / CLI exists on this machine (no twitter connector,
 *      no twurl). Nothing authenticated to reuse.
 *  (e) Public X pages are NOT a data source: x.com/{handle} returns a
 *      200 JS shell with no follower counts in the HTML, and
 *      x.com/search 307-redirects to login. api.x.com/2 without auth: 401.
 *
 *  Reachable signals (keyless, anonymous):
 *    - linked X handle: AVAILABLE (DexScreener + GeckoTerminal, cross-checked)
 *  Reachable only with an app-level X Bearer token (server proxy
 *  web/api/_xsocial.js, env TWITTER_BEARER_TOKEN):
 *    - profile enrichment: followers / following / tweet count / account
 *      age / verified / bio. Until the env var is set this is UNAVAILABLE
 *      with reason "no_bearer_token" — never a guessed number.
 *    - dev's past posts: the linked account's 10 most recent tweets
 *      (?include=timeline). Same bearer gate as the profile.
 *    - KOL tracking: the ONLY account any real source names is the
 *      token's own linked account, so the tracked set is that one
 *      account, enriched by the same bearer-backed profile call.
 *      Third-party KOLs endorsing the token cannot be named by any
 *      source in this stack — that stays unavailable (kolActivity).
 *  Shill-spike detection: the detector (detectShillSpike) exists and is
 *  tested, but it needs a real mention time series and none is
 *  fetchable. DexScreener /tokens/v1 DOES expose a time series — volume
 *  + txns in h1/h6/h24 buckets — but that measures TRADING activity,
 *  not X mentions, so feeding it into a "shill spike" would mislabel
 *  a volume spike as a shill spike. The signal is therefore honestly
 *  unavailable (reason "no_mention_time_series") until a bearer-backed
 *  X search source exists. Never synthesize spikes from nothing.
 *  No real source exists (do not fake):
 *    - recent mentions (no X search API access, no search tool in x-mcp)
 *    - KOL activity (no source names accounts)
 *    - sentiment (no fetched text to derive it from)
 *
 *  BATCHES 2-5 (2026-11-08, same rules — real data only):
 *  (f) Caller track records: the only endpoint that could name callers
 *      is X recent search (GET /2/tweets/search/recent), which needs a
 *      bearer token on a Basic+ tier — the free tier has no search at
 *      all (403) — and no search path exists in _xsocial.js or x-mcp.js.
 *      Even with search, "was right" needs the price at call time and
 *      no price-history source exists in this stack. So callerRecords
 *      is honestly unavailable (reason "no_caller_source"). The pure
 *      evaluator evaluateCallerAccuracy() is implemented and tested for
 *      the day both inputs exist. Never invent caller names, call
 *      times, or accuracy %.
 *  (g) X account audit: age + verified come from the SAME bearer-backed
 *      profile call as `profile` (same gate, same reason when it fails),
 *      via auditFromProfile(). Bot-follower % has NO reliable source:
 *      no keyless service and no bearer endpoint labels followers as
 *      bots, and estimating it from follower counts would be
 *      fabrication — it is always null with a note saying so.
 *  (h) Social velocity: mention growth hour-over-hour needs the same
 *      non-existent mention time series as the shill spike (reason
 *      "no_mention_source"). computeSocialVelocity() is implemented and
 *      tested for the day a series exists. Dev's OTHER socials are the
 *      one Batch-4 signal with a real keyless source: DexScreener
 *      info.socials[] (non-twitter) + info.websites[], and GeckoTerminal
 *      telegram_handle / discord_url / websites[]. Live ORBITX check
 *      2026-11-08: DexScreener lists t.me/orbitxwrld, GeckoTerminal
 *      lists @OrbitXupdates — the two sources DISAGREE on Telegram, so
 *      both handles are shown with a conflict note, never silently
 *      picked. Liveness is a live fetch per link (HTTP status only):
 *      200 means the page responded, NOT that the group exists or has
 *      members — member counts are never claimed ("fake members"
 *      stays unavailable: no source).
 *  (i) Community sentiment gauge: no Telegram/Discord text source
 *      exists (no API, no connector, no readable export), so vibe is
 *      never derived — reason "no_community_source". Member growth
 *      needs TWO real snapshots and none is stored anywhere; the pure
 *      computeMemberGrowth() is implemented and tested for the day two
 *      snapshots exist. Bot %: no source, always null.
 *  (j) Dev AMA tracker: the only verifiable records are the linked
 *      account's OWN recent posts (devPosts) — extractAmaMentions()
 *      scans them for AMA/Space mentions and reports each as a tweet
 *      that mentions one, never as proof an AMA happened. Doxxed/anon
 *      is only what the dev publicly shared themself; a profile name
 *      is a brand, not a person — identity stays "unverifiable".
 *      Promises kept/broken needs a promise AND its outcome both
 *      verifiable; ten recent tweets are not a promise ledger — always
 *      "unverifiable", never judged.
 *
 *  HARD RULE: every signal carries an availability state. Unavailable is
 *  rendered as "Unavailable" with a reason — NEVER as zero.
 */

export type XAvailability = "available" | "unavailable";

export interface XSignal<T> {
  status: XAvailability;
  /** Present only when status === "available". */
  value?: T;
  /** Where the value came from, e.g. "dexscreener", "geckoterminal", "x_api_v2". */
  source?: string;
  /** ISO timestamp of the fetch that produced this signal. */
  fetchedAt?: string;
  /** Machine-readable reason, present only when status === "unavailable". */
  reason?: string;
  /** Human-readable explanation of the reason. */
  detail?: string;
}

export interface XLinkedAccount {
  handle: string;
  url: string;
  /** Sources that reported this handle. */
  sources: string[];
  /** "agree" = 2+ sources agree; "single" = one source only; "conflict" = sources disagree. */
  agreement: "agree" | "single" | "conflict";
  note?: string;
}

export interface XProfile {
  handle: string;
  name?: string | null;
  description?: string | null;
  followers?: number | null;
  following?: number | null;
  tweetCount?: number | null;
  listed?: number | null;
  createdAt?: string | null;
  /** Whole days between createdAt and the fetch time. */
  accountAgeDays?: number | null;
  verified?: boolean;
  protected?: boolean;
  profileImageUrl?: string | null;
}

export interface XMentionSample {
  id: string;
  authorHandle?: string | null;
  text: string;
  createdAt?: string | null;
  likeCount?: number | null;
  repostCount?: number | null;
}

/** One post from the linked account's timeline (bearer-backed only). */
export interface XPost {
  id: string;
  text: string;
  createdAt?: string | null;
  likeCount?: number | null;
  repostCount?: number | null;
  replyCount?: number | null;
}

/**
 * One tracked X account. The only account any real source names is the
 * token's own linked account — tracked with its bearer-backed profile
 * metrics. No third-party KOL list is ever invented.
 */
export interface XKolAccount {
  handle: string;
  followers?: number | null;
  following?: number | null;
  tweetCount?: number | null;
  /** Whole days between the account's createdAt and the fetch time. */
  accountAgeDays?: number | null;
  verified?: boolean;
  note?: string;
}

/** Result of detectShillSpike over a real mention time series. */
export interface XShillSpike {
  spike: boolean;
  baselinePerHour: number;
  peakPerHour: number;
  spikeRatio: number;
  /** Hours spanned by the series that was analysed. */
  windowHours: number;
  /** ISO hour bucket of the peak, when a peak exists. */
  peakHour?: string | null;
}

/**
 * One caller's track record. Only ever built by evaluateCallerAccuracy()
 * from REAL calls (a mention + the price at call time + a later price).
 * No live source produces these inputs today — see the module header.
 */
export interface XCallerRecord {
  handle: string;
  callsTracked: number;
  correctCalls: number;
  /** % of tracked calls that were right, null when nothing was tracked. */
  accuracyPct: number | null;
}

/**
 * X account audit — authenticity facts from the bearer-backed profile.
 * Age and verified are real; bot-follower % is ALWAYS null: no reliable
 * source measures it, and it is never estimated from follower counts.
 */
export interface XAccountAudit {
  handle: string;
  createdAt?: string | null;
  accountAgeDays?: number | null;
  verified?: boolean;
  protected?: boolean;
  followers?: number | null;
  following?: number | null;
  tweetCount?: number | null;
  /** Bot-follower % — null: no reliable source measures it. */
  botFollowerPct: number | null;
  botFollowerNote: string;
}

/** Hour-over-hour mention growth, from a REAL mention time series. */
export interface XSocialVelocity {
  latestHour: string;
  previousHour: string;
  latestMentions: number;
  previousMentions: number;
  /** % growth latest vs previous hour; null when the previous hour had 0 mentions. */
  growthPct: number | null;
  windowHours: number;
}

/**
 * One non-X social/website link for the token, as listed by DexScreener
 * and/or GeckoTerminal. liveStatus comes from a live fetch of the URL:
 * "reachable" means the page responded (HTTP 2xx/3xx) — for Telegram
 * that does NOT prove the group exists or has members. "unchecked"
 * means no liveness fetch was attempted for this link.
 */
export interface XOtherSocialLink {
  kind: "telegram" | "discord" | "website" | "other";
  label: string;
  url: string;
  sources: string[];
  agreement: "agree" | "single";
  liveStatus: "reachable" | "dead" | "unknown" | "unchecked";
  httpStatus?: number | null;
  note?: string;
}

/**
 * Community sentiment gauge (Telegram/Discord). Every field is null /
 * unmeasured until a real source exists: vibe needs fetched readable
 * text, member growth needs two real snapshots, bot % has no source.
 */
export interface XCommunitySentiment {
  /** Community vibe — null: no fetched community text to derive it from. */
  vibe: "positive" | "neutral" | "negative" | null;
  postsAnalyzed: number;
  /** Member growth % between two real snapshots — null: no snapshots. */
  memberGrowthPct: number | null;
  /** Bot % — null: no source measures it. */
  botPct: number | null;
  note?: string;
}

/** One AMA/Space mention found in the linked account's own recent posts. */
export interface XAmaMention {
  tweetId: string;
  text: string;
  createdAt?: string | null;
}

/**
 * Dev AMA tracker. amaMentions are tweets that MENTION an AMA/Space —
 * not proof one happened. Identity and promises are only ever what is
 * verifiable from public records the dev shared themself; from a
 * profile + 10 recent tweets both are "unverifiable", never judged.
 */
export interface XDevAmaTracker {
  handle: string;
  amaMentions: XAmaMention[];
  identityStatus: "unverifiable" | "self_shared" | "anonymous";
  identityNote: string;
  promisesStatus: "unverifiable" | "kept" | "broken" | "mixed";
  promisesNote: string;
}

export interface XIntel {
  mint: string;
  symbol?: string | null;
  linkedAccount: XSignal<XLinkedAccount>;
  profile: XSignal<XProfile>;
  mentions: XSignal<{ count24h: number; sample: XMentionSample[] }>;
  kolActivity: XSignal<{ accounts: Array<{ handle: string; note?: string }> }>;
  /** Tracked accounts = the linked account only (bearer-backed profile). */
  kolTracking: XSignal<{ accounts: XKolAccount[] }>;
  /** The linked account's recent posts (bearer-backed timeline). */
  devPosts: XSignal<{ handle: string; posts: XPost[] }>;
  /** Mention-spike verdict — unavailable until a real mention series exists. */
  shillSpike: XSignal<XShillSpike>;
  sentiment: XSignal<{ label: "positive" | "neutral" | "negative"; postsAnalyzed: number }>;
  /** Caller track records — unavailable until an X search + price-history source exists. */
  callerRecords: XSignal<{ records: XCallerRecord[] }>;
  /** X account audit — age/verified from the bearer profile; bot % always null. */
  accountAudit: XSignal<XAccountAudit>;
  /** Mention growth hour-over-hour — unavailable until a real mention series exists. */
  socialVelocity: XSignal<XSocialVelocity>;
  /** The token's non-X socials/websites, as listed by DexScreener + GeckoTerminal. */
  devOtherSocials: XSignal<{ links: XOtherSocialLink[]; note?: string }>;
  /** Telegram/Discord community sentiment — unavailable until a real community text source exists. */
  communitySentiment: XSignal<XCommunitySentiment>;
  /** Dev AMA/Space tracker — from the linked account's own recent posts only. */
  devAmaTracker: XSignal<XDevAmaTracker>;
  fetchedAt: string;
}

/** Unavailable reasons (stable strings — the UI keys copy off these). */
export const X_UNAVAILABLE_REASONS = {
  invalidMint: "invalid_mint",
  noTwitterLink: "no_twitter_link",
  dexscreenerFailed: "dexscreener_failed",
  geckoterminalFailed: "geckoterminal_failed",
  allSourcesFailed: "all_sources_failed",
  noBearerToken: "no_bearer_token",
  proxyNotConfigured: "proxy_not_configured",
  proxyError: "proxy_error",
  bearerInvalid: "bearer_invalid",
  rateLimited: "rate_limited",
  accountNotFound: "account_not_found",
  noSearchSource: "no_search_source",
  noKolSource: "no_kol_source",
  noTextSource: "no_text_source",
  forbidden: "forbidden",
  /** No fetchable X-mention time series exists to run spike detection on. */
  noMentionTimeSeries: "no_mention_time_series",
  /** No source names the X accounts that called this token (needs X search). */
  noCallerSource: "no_caller_source",
  /** No fetchable X-mention time series exists to measure velocity on. */
  noMentionSource: "no_mention_source",
  /** No Telegram/Discord text or member source exists for community sentiment. */
  noCommunitySource: "no_community_source",
  /** Neither DexScreener nor GeckoTerminal lists a non-X social or website. */
  noOtherSocials: "no_other_socials",
} as const;

export const DEXSCREENER_SOURCE = "dexscreener";
export const GECKOTERMINAL_SOURCE = "geckoterminal";
export const X_API_SOURCE = "x_api_v2";

export function dexscreenerTokensUrl(mint: string): string {
  return `https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`;
}

export function geckoterminalInfoUrl(mint: string): string {
  return `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}/info`;
}

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function isValidMint(mint: string): boolean {
  return MINT_RE.test(String(mint || "").trim());
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asFiniteNumber(v: unknown): number | null {
  // null / undefined / "" are "no value", NOT zero — a zero count is a lie
  // when the real state is unknown.
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pull a handle out of an X/Twitter URL, a bare @handle, or a bare handle.
 * Returns null for anything that is not recognisably an X handle.
 */
export function extractTwitterHandle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;
  const m =
    s.match(/^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/@?([A-Za-z0-9_]{1,15})(?:[/?#].*)?$/i) ||
    s.match(/^@([A-Za-z0-9_]{1,15})$/) ||
    s.match(/^([A-Za-z0-9_]{1,15})$/);
  return m ? m[1] : null;
}

export function twitterProfileUrl(handle: string): string {
  return `https://x.com/${handle}`;
}

/**
 * DexScreener /tokens/v1 response (an array of pairs) →
 * the linked twitter { handle, url } from info.socials, or null.
 * Picks the first pair carrying a twitter social (deepest-liquidity first
 * is the caller's job; the API returns pairs ordered by relevance).
 */
export function normalizeDexScreenerSocials(
  raw: unknown,
): { handle: string; url: string } | null {
  const list = Array.isArray(raw) ? raw : (asRecord(raw)?.pairs as unknown);
  if (!Array.isArray(list)) return null;
  for (const pair of list) {
    const info = asRecord(asRecord(pair)?.info);
    const socials = info?.socials;
    if (!Array.isArray(socials)) continue;
    for (const s of socials) {
      const rec = asRecord(s);
      if (!rec) continue;
      if (String(rec.type || "").toLowerCase() !== "twitter") continue;
      const url = String(rec.url || "").trim();
      const handle = extractTwitterHandle(url);
      if (handle && url) return { handle, url };
    }
  }
  return null;
}

/**
 * GeckoTerminal /tokens/{mint}/info response →
 * the linked twitter { handle, url } from attributes.twitter_handle, or null.
 */
export function normalizeGeckoInfo(raw: unknown): { handle: string; url: string } | null {
  const attrs = asRecord(asRecord(asRecord(raw)?.data)?.attributes);
  if (!attrs) return null;
  const handle = extractTwitterHandle(attrs.twitter_handle);
  if (!handle) return null;
  return { handle, url: twitterProfileUrl(handle) };
}

/** Whole days between an X created_at and `nowMs` (defaults to now). */
export function accountAgeDays(createdAt: string | null | undefined, nowMs?: number): number | null {
  if (!createdAt) return null;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return null;
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const days = Math.floor((now - t) / 86_400_000);
  return days >= 0 ? days : null;
}

/**
 * Normalize one post from the _xsocial timeline payload (already
 * normalized server-side) or a raw X API v2 tweet object.
 * Returns null when the entry has no usable id/text. Counts stay null
 * when missing — never invented.
 */
export function normalizeXPost(raw: unknown): XPost | null {
  const t = asRecord(raw);
  if (!t || typeof t.id !== "string" || !t.id) return null;
  if (typeof t.text !== "string") return null;
  const metrics = asRecord(t.public_metrics) || {};
  const like = asFiniteNumber(metrics.like_count ?? t.likeCount);
  const repost = asFiniteNumber(metrics.retweet_count ?? t.repostCount);
  const reply = asFiniteNumber(metrics.reply_count ?? t.replyCount);
  return {
    id: t.id,
    text: t.text,
    createdAt: typeof t.created_at === "string" ? t.created_at : typeof t.createdAt === "string" ? t.createdAt : null,
    likeCount: like,
    repostCount: repost,
    replyCount: reply,
  };
}

/**
 * Normalize a timeline payload into an array of posts. Accepts the
 * _xsocial shape (a bare array) or a raw X API v2 shape ({ data: [...] }).
 * Returns null when there is no usable array; an empty array is a REAL
 * state (account with no recent tweets) and is returned as [].
 */
export function normalizeXTweets(raw: unknown): XPost[] | null {
  const list = Array.isArray(raw) ? raw : asRecord(raw)?.data;
  if (!Array.isArray(list)) return null;
  return list.map(normalizeXPost).filter((p): p is XPost => p !== null);
}

export interface ShillSpikeSample {
  /** Timestamp of one mention (ISO string or epoch ms). */
  t: string | number;
  /** Mentions in that sample (usually 1 per mention event). */
  mentions: number;
}

export interface DetectShillSpikeOptions {
  /** Peak/baseline ratio that counts as a spike. Default 5. */
  ratioThreshold?: number;
  /** Minimum mentions in the peak hour for a spike verdict. Default 10. */
  minPeakMentions?: number;
}

/**
 * Shill-spike detector over a REAL mention time series: bucket samples
 * into hours, take the baseline as the median hourly count excluding the
 * peak hour, and flag a spike when peak/baseline >= ratioThreshold with
 * at least minPeakMentions in the peak hour.
 *
 * Returns null when the series cannot support a verdict (fewer than 2
 * distinct hours, or zero mentions) — no verdict is ever guessed from
 * nothing. NOTE: this function has no live caller yet: no mention time
 * series is fetchable in this stack (see the module header), so the
 * shillSpike signal stays unavailable. It is tested and ready for the
 * day a bearer-backed X search source exists.
 */
export function detectShillSpike(
  samples: ShillSpikeSample[],
  opts: DetectShillSpikeOptions = {},
): XShillSpike | null {
  const ratioThreshold = opts.ratioThreshold ?? 5;
  const minPeakMentions = opts.minPeakMentions ?? 10;
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const buckets = new Map<string, number>();
  for (const s of samples) {
    const ms = typeof s.t === "number" ? s.t : Date.parse(s.t);
    const n = asFiniteNumber(s.mentions);
    if (!Number.isFinite(ms) || n === null || n < 0) continue;
    const hour = new Date(Math.floor(ms / 3_600_000) * 3_600_000).toISOString();
    buckets.set(hour, (buckets.get(hour) ?? 0) + n);
  }
  if (buckets.size < 2) return null;
  const counts = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const total = counts.reduce((sum, [, c]) => sum + c, 0);
  if (total === 0) return null;
  const [peakHour, peakPerHour] = counts.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  const rest = counts.filter(([h]) => h !== peakHour).map(([, c]) => c).sort((a, b) => a - b);
  const mid = Math.floor(rest.length / 2);
  const baselinePerHour =
    rest.length % 2 === 1 ? rest[mid] : (rest[mid - 1] + rest[mid]) / 2;
  const spikeRatio = peakPerHour / Math.max(baselinePerHour, 1);
  return {
    spike: spikeRatio >= ratioThreshold && peakPerHour >= minPeakMentions,
    baselinePerHour,
    peakPerHour,
    spikeRatio,
    windowHours: counts.length,
    peakHour,
  };
}

export interface CallerCall {
  /** X handle that called the token. */
  handle: string;
  /** ISO timestamp of the call (the mention that named the token). */
  calledAt: string;
  /** Token price (USD) at call time — from a real price history. */
  priceAtCallUsd: number;
  /** Token price (USD) at a fixed later checkpoint. */
  priceLaterUsd: number;
  /** Call direction; default "bullish". */
  direction?: "bullish" | "bearish";
}

/**
 * Caller track records from REAL calls: each call is a dated mention
 * plus the price at call time and at a later checkpoint. A bullish
 * call is right when the later price is higher, a bearish one when it
 * is lower. Invalid entries (bad handle, unparseable time, non-finite
 * prices, zero call price) are skipped, never counted.
 *
 * NOTE: no live caller feeds this today — X search (the only source
 * that could name callers) does not exist in this stack, and no
 * price-history source exists for priceAtCallUsd. The live signal
 * stays unavailable (no_caller_source); this is tested and ready for
 * the day both inputs exist.
 */
export function evaluateCallerAccuracy(calls: CallerCall[]): XCallerRecord[] {
  if (!Array.isArray(calls)) return [];
  const byHandle = new Map<string, { handle: string; tracked: number; correct: number }>();
  for (const c of calls) {
    const rec = asRecord(c as unknown);
    if (!rec) continue;
    const handle = typeof rec.handle === "string" ? rec.handle.trim() : "";
    if (!handle) continue;
    if (!Number.isFinite(Date.parse(String(rec.calledAt || "")))) continue;
    const at = asFiniteNumber(rec.priceAtCallUsd);
    const later = asFiniteNumber(rec.priceLaterUsd);
    if (at === null || later === null || at <= 0 || later < 0) continue;
    const direction = rec.direction === "bearish" ? "bearish" : "bullish";
    const right = direction === "bearish" ? later < at : later > at;
    const key = handle.toLowerCase();
    const entry = byHandle.get(key) ?? { handle, tracked: 0, correct: 0 };
    entry.tracked += 1;
    if (right) entry.correct += 1;
    byHandle.set(key, entry);
  }
  return [...byHandle.values()].map((e) => ({
    handle: e.handle,
    callsTracked: e.tracked,
    correctCalls: e.correct,
    accuracyPct: e.tracked > 0 ? Math.round((e.correct / e.tracked) * 1000) / 10 : null,
  }));
}

export const BOT_FOLLOWER_NOTE =
  "No reliable source measures bot followers: no keyless service and no X endpoint labels followers as bots. Never estimated from follower counts.";

/**
 * X account audit from a bearer-backed profile: account age and
 * verified state are real fields from the X API user object.
 * Bot-follower % is ALWAYS null (see BOT_FOLLOWER_NOTE).
 */
export function auditFromProfile(p: XProfile): XAccountAudit {
  return {
    handle: p.handle,
    createdAt: p.createdAt ?? null,
    accountAgeDays: p.accountAgeDays ?? null,
    verified: p.verified ?? false,
    protected: p.protected ?? false,
    followers: p.followers ?? null,
    following: p.following ?? null,
    tweetCount: p.tweetCount ?? null,
    botFollowerPct: null,
    botFollowerNote: BOT_FOLLOWER_NOTE,
  };
}

export interface HourlyMentionCount {
  /** ISO timestamp within the hour (any minute). */
  hour: string;
  mentions: number;
}

/**
 * Hour-over-hour mention growth from a REAL mention time series:
 * latest hour vs the previous hour. Returns null when the series
 * cannot support a verdict (fewer than 2 distinct hours). growthPct
 * is null when the previous hour had 0 mentions (no divisor to
 * grow from) — never Infinity. NOTE: no live caller yet — no mention
 * time series is fetchable in this stack, so the socialVelocity
 * signal stays unavailable (no_mention_source).
 */
export function computeSocialVelocity(counts: HourlyMentionCount[]): XSocialVelocity | null {
  if (!Array.isArray(counts) || counts.length === 0) return null;
  const buckets = new Map<string, number>();
  for (const c of counts) {
    const ms = Date.parse(String((c as { hour?: unknown }).hour || ""));
    const n = asFiniteNumber((c as { mentions?: unknown }).mentions);
    if (!Number.isFinite(ms) || n === null || n < 0) continue;
    const hour = new Date(Math.floor(ms / 3_600_000) * 3_600_000).toISOString();
    buckets.set(hour, (buckets.get(hour) ?? 0) + n);
  }
  const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (sorted.length < 2) return null;
  const [previousHour, previousMentions] = sorted[sorted.length - 2];
  const [latestHour, latestMentions] = sorted[sorted.length - 1];
  return {
    latestHour,
    previousHour,
    latestMentions,
    previousMentions,
    growthPct:
      previousMentions === 0
        ? null
        : Math.round(((latestMentions - previousMentions) / previousMentions) * 1000) / 10,
    windowHours: sorted.length,
  };
}

/**
 * Member growth % between TWO real snapshots (e.g. two Telegram member
 * counts fetched days apart). Returns null when either snapshot is
 * missing, or the earlier one is 0 (no divisor). No snapshots are
 * stored anywhere today, so the community signal stays unavailable;
 * this is tested and ready for the day two snapshots exist.
 */
export function computeMemberGrowth(prevCount: number | null | undefined, currCount: number | null | undefined): number | null {
  const prev = asFiniteNumber(prevCount);
  const curr = asFiniteNumber(currCount);
  if (prev === null || curr === null || prev <= 0 || curr < 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

/** One non-X social/website entry as listed by an upstream (pre-merge). */
export interface RawOtherSocial {
  kind: "telegram" | "discord" | "website" | "other";
  label: string;
  url: string;
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function urlHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * DexScreener /tokens/v1 payload → the token's NON-twitter socials and
 * websites (info.socials[] minus twitter, plus info.websites[]).
 * Returns null when the payload is unusable; [] when usable but nothing
 * non-X is listed. URLs that are not http(s) are skipped.
 */
export function normalizeDexScreenerOtherSocials(raw: unknown): RawOtherSocial[] | null {
  const list = Array.isArray(raw) ? raw : (asRecord(raw)?.pairs as unknown);
  if (!Array.isArray(list)) return null;
  const out: RawOtherSocial[] = [];
  for (const pair of list) {
    const info = asRecord(asRecord(pair)?.info);
    if (!info) continue;
    const socials = info.socials;
    if (Array.isArray(socials)) {
      for (const s of socials) {
        const rec = asRecord(s);
        if (!rec) continue;
        if (String(rec.type || "").toLowerCase() === "twitter") continue;
        const url = String(rec.url || "").trim();
        if (!isHttpUrl(url)) continue;
        const type = String(rec.type || "").toLowerCase();
        out.push({
          kind: type === "telegram" ? "telegram" : type === "discord" ? "discord" : "other",
          label: String(rec.label || rec.type || urlHostname(url)),
          url,
        });
      }
    }
    const websites = info.websites;
    if (Array.isArray(websites)) {
      for (const w of websites) {
        const rec = asRecord(w);
        const url = String((rec?.url ?? w) || "").trim();
        if (!isHttpUrl(url)) continue;
        out.push({
          kind: "website",
          label: (rec && typeof rec.label === "string" && rec.label) || urlHostname(url),
          url,
        });
      }
    }
  }
  return out;
}

/**
 * GeckoTerminal /tokens/{mint}/info payload → telegram_handle,
 * discord_url and websites[]. Returns null when the payload is
 * unusable; [] when usable but nothing non-X is listed.
 */
export function normalizeGeckoOtherSocials(raw: unknown): RawOtherSocial[] | null {
  const attrs = asRecord(asRecord(asRecord(raw)?.data)?.attributes);
  if (!attrs) return null;
  const out: RawOtherSocial[] = [];
  const tg = typeof attrs.telegram_handle === "string" ? attrs.telegram_handle.trim() : "";
  if (/^[A-Za-z0-9_]{5,32}$/.test(tg)) {
    out.push({ kind: "telegram", label: `@${tg}`, url: `https://t.me/${tg}` });
  }
  const discord = typeof attrs.discord_url === "string" ? attrs.discord_url.trim() : "";
  if (isHttpUrl(discord)) {
    out.push({ kind: "discord", label: "Discord", url: discord });
  }
  const websites = attrs.websites;
  if (Array.isArray(websites)) {
    for (const w of websites) {
      const url = String(w || "").trim();
      if (!isHttpUrl(url)) continue;
      out.push({ kind: "website", label: urlHostname(url), url });
    }
  }
  return out;
}

/**
 * Merge the DexScreener + GeckoTerminal non-X socials into one link
 * list. The same URL from both sources merges (agreement "agree",
 * both sources named). DIFFERENT URLs for the same kind (live case:
 * DexScreener t.me/orbitxwrld vs GeckoTerminal @OrbitXupdates) are
 * kept as separate links and flagged in `note` — never silently
 * picked. Returns { links, note? }.
 */
export function mergeOtherSocials(
  dex: RawOtherSocial[] | null,
  gecko: RawOtherSocial[] | null,
): { links: XOtherSocialLink[]; note?: string } {
  const byUrl = new Map<string, XOtherSocialLink>();
  const add = (entry: RawOtherSocial, source: string) => {
    const key = entry.url.toLowerCase().replace(/\/$/, "");
    const existing = byUrl.get(key);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      existing.agreement = "agree";
      return;
    }
    byUrl.set(key, {
      kind: entry.kind,
      label: entry.label,
      url: entry.url,
      sources: [source],
      agreement: "single",
      liveStatus: "unchecked",
      httpStatus: null,
    });
  };
  (dex ?? []).forEach((e) => add(e, DEXSCREENER_SOURCE));
  (gecko ?? []).forEach((e) => add(e, GECKOTERMINAL_SOURCE));
  const links = [...byUrl.values()];
  let note: string | undefined;
  for (const kind of ["telegram", "discord"] as const) {
    const kindLinks = links.filter((l) => l.kind === kind);
    if (kindLinks.length > 1) {
      const urls = kindLinks.map((l) => l.url).join(", ");
      note = `Sources disagree on the ${kind} handle: ${urls}. Both are shown; neither is verified as the official channel.`;
      break;
    }
  }
  return note ? { links, note } : { links };
}

/**
 * Classify a link-liveness HTTP status: 2xx/3xx = the page responded,
 * 404/410 = dead, anything else (or no status) = unknown. "Reachable"
 * means the page responded — for Telegram it does NOT prove the group
 * exists or has members.
 */
export function linkStatusFromHttp(status: number | null): "reachable" | "dead" | "unknown" {
  if (status === null) return "unknown";
  if (status >= 200 && status < 400) return "reachable";
  if (status === 404 || status === 410) return "dead";
  return "unknown";
}

/**
 * Best-effort liveness check for one social/website URL: a live fetch
 * of the URL, classified by linkStatusFromHttp(). Never throws — a
 * failed fetch is "unknown", never "dead" (a blocked fetch is not
 * proof the link is dead).
 */
export async function checkLinkLive(
  fetchFn: (input: string, init?: RequestInit) => Promise<Response>,
  url: string,
  timeoutMs = 5000,
): Promise<{ liveStatus: "reachable" | "dead" | "unknown"; httpStatus: number | null }> {
  try {
    const signal =
      typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
    const res = await fetchFn(url, { signal });
    return { liveStatus: linkStatusFromHttp(res.status), httpStatus: res.status };
  } catch {
    return { liveStatus: "unknown", httpStatus: null };
  }
}

const AMA_RE = /\b(ama|twitter space|x space|spaces)\b/i;

/**
 * Scan the linked account's own recent posts for AMA/Space mentions.
 * Each hit is a tweet that MENTIONS one — never proof an AMA happened.
 * "space" alone is deliberately NOT matched (too broad: "space in the
 * market" is not an AMA). Returns [] when no post mentions one.
 */
export function extractAmaMentions(posts: XPost[]): XAmaMention[] {
  if (!Array.isArray(posts)) return [];
  const out: XAmaMention[] = [];
  for (const p of posts) {
    if (!p || typeof p.text !== "string" || !p.id) continue;
    if (AMA_RE.test(p.text)) {
      out.push({ tweetId: p.id, text: p.text, createdAt: p.createdAt ?? null });
    }
  }
  return out;
}

/**
 * Normalize one X API v2 user object (users/by/username, user.fields=
 * created_at,public_metrics,verified,description,profile_image_url,protected)
 * into an XProfile. Returns null when the payload has no usable user.
 * Never invents a count: a missing metric stays null.
 */
export function normalizeXUser(raw: unknown, nowMs?: number): XProfile | null {
  const u = asRecord(raw);
  if (!u || typeof u.username !== "string" || !u.username) return null;
  const metrics = asRecord(u.public_metrics) || {};
  const createdAt = typeof u.created_at === "string" ? u.created_at : null;
  return {
    handle: u.username,
    name: typeof u.name === "string" ? u.name : null,
    description: typeof u.description === "string" ? u.description : null,
    followers: asFiniteNumber(metrics.followers_count),
    following: asFiniteNumber(metrics.following_count),
    tweetCount: asFiniteNumber(metrics.tweet_count),
    listed: asFiniteNumber(metrics.listed_count),
    createdAt,
    accountAgeDays: accountAgeDays(createdAt, nowMs),
    verified: u.verified === true,
    protected: u.protected === true,
    profileImageUrl: typeof u.profile_image_url === "string" ? u.profile_image_url : null,
  };
}

/** Merge the DexScreener + GeckoTerminal linked handles into one signal. */
export function mergeLinkedHandles(
  dex: { handle: string; url: string } | null,
  gecko: { handle: string; url: string } | null,
  fetchedAt: string,
): XSignal<XLinkedAccount> {
  if (dex && gecko) {
    if (dex.handle.toLowerCase() === gecko.handle.toLowerCase()) {
      return {
        status: "available",
        value: {
          handle: dex.handle,
          url: dex.url,
          sources: [DEXSCREENER_SOURCE, GECKOTERMINAL_SOURCE],
          agreement: "agree",
        },
        source: `${DEXSCREENER_SOURCE}+${GECKOTERMINAL_SOURCE}`,
        fetchedAt,
      };
    }
    // Sources disagree: report the DexScreener one (it comes from the
    // token's own listing) and say so — never silently pick one.
    return {
      status: "available",
      value: {
        handle: dex.handle,
        url: dex.url,
        sources: [DEXSCREENER_SOURCE, GECKOTERMINAL_SOURCE],
        agreement: "conflict",
        note: `Sources disagree: DexScreener lists @${dex.handle}, GeckoTerminal lists @${gecko.handle}. Showing the DexScreener link.`,
      },
      source: DEXSCREENER_SOURCE,
      fetchedAt,
    };
  }
  const one = dex || gecko;
  if (one) {
    return {
      status: "available",
      value: {
        handle: one.handle,
        url: one.url,
        sources: [dex ? DEXSCREENER_SOURCE : GECKOTERMINAL_SOURCE],
        agreement: "single",
      },
      source: dex ? DEXSCREENER_SOURCE : GECKOTERMINAL_SOURCE,
      fetchedAt,
    };
  }
  return {
    status: "unavailable",
    reason: X_UNAVAILABLE_REASONS.noTwitterLink,
    detail: "Neither DexScreener nor GeckoTerminal lists a linked X account for this token.",
    fetchedAt,
  };
}

/** An XIntel where every signal is unavailable — the honest empty state. */
export function unavailableIntel(mint: string, reason: string, detail: string): XIntel {
  const fetchedAt = new Date().toISOString();
  const un = <T,>(d: string): XSignal<T> => ({
    status: "unavailable",
    reason,
    detail: d,
    fetchedAt,
  });
  return {
    mint,
    linkedAccount: un("No X data could be fetched for this token."),
    profile: un("No linked X account to enrich."),
    mentions: un("No real X search source is available — mention counts are never estimated."),
    kolActivity: un("No source names KOL accounts for this token."),
    kolTracking: un("No linked X account to track."),
    devPosts: un("No linked X account whose posts could be fetched."),
    // Shill-spike unavailability is structural (no mention time series
    // exists at all), not caused by the upstream failure — it always
    // carries its own reason.
    shillSpike: {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.noMentionTimeSeries,
      detail: "No X-mention time series exists to detect spikes in.",
      fetchedAt,
    },
    sentiment: un("No post text was fetched, so no sentiment is derived."),
    // Caller records, social velocity and community sentiment are
    // structural (no source exists at all) — they always carry their
    // own reason, like shillSpike.
    callerRecords: {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.noCallerSource,
      detail: "No source names the X accounts that called this token — X search is not connected and no call-time price history exists.",
      fetchedAt,
    },
    accountAudit: un("No linked X account profile to audit."),
    socialVelocity: {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.noMentionSource,
      detail: "No X-mention time series exists to measure hour-over-hour growth on.",
      fetchedAt,
    },
    devOtherSocials: un("No non-X social or website could be listed for this token."),
    communitySentiment: {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.noCommunitySource,
      detail: "No Telegram/Discord text or member source exists, so no community vibe, growth or bot % is measured.",
      fetchedAt,
    },
    devAmaTracker: un("No linked X account whose posts could be checked for AMAs."),
    fetchedAt,
  };
}

export interface FetchXIntelOptions {
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetchFn?: typeof fetch;
  /**
   * Server proxy that enriches a handle via the X API
   * (web/api/_xsocial.js, wired through /api/web?path=xsocial).
   * Pass null to skip the proxy call entirely.
   */
  proxyUrl?: string | null;
  /** Per-request timeout in ms. Default 8000. */
  timeoutMs?: number;
  /** Override "now" (tests). */
  nowMs?: number;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function fetchJson(
  fetchFn: FetchFn,
  url: string,
  timeoutMs: number,
): Promise<unknown> {
  // AbortSignal.timeout is missing in some test runtimes (jsdom) — guard it.
  const signal =
    typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
  const res = await fetchFn(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as unknown;
}

/**
 * Fetch real X intel for a token mint.
 *
 *  1. Linked handle: DexScreener + GeckoTerminal (keyless, parallel).
 *  2. Profile enrichment + dev timeline: server proxy (X API v2,
 *     ?include=timeline) — only when a handle was found and a proxyUrl
 *     is configured. The proxy itself returns an honest unavailable
 *     state when no X Bearer token is configured.
 *  3. KOL tracking: derived from the profile — the linked account only.
 *  4. Shill spike: always unavailable — no mention time series exists.
 *  5. Mentions / KOL activity / sentiment: always unavailable — no real
 *     source exists in this stack, and they are never estimated.
 *  6. Caller records / social velocity / community sentiment: always
 *     unavailable — no X search, no mention series, no Telegram/Discord
 *     text source (see module header). Pure evaluators exist and are
 *     tested for the day those sources arrive.
 *  7. Account audit: derived from the profile (same bearer gate);
 *     bot-follower % is always null — no source measures it.
 *  8. Dev's other socials: DexScreener + GeckoTerminal listings
 *     (keyless), each link live-checked with a best-effort fetch.
 *  9. Dev AMA tracker: derived from devPosts — AMA/Space mentions in
 *     the linked account's own recent tweets; identity and promises
 *     stay "unverifiable" (see module header).
 *
 * Never throws for a bad mint or a failed upstream: it returns an
 * XIntel whose signals carry the reason instead.
 */
export async function fetchXIntel(mint: string, opts: FetchXIntelOptions = {}): Promise<XIntel> {
  const cleanMint = String(mint || "").trim();
  const fetchedAt = new Date(opts.nowMs ?? Date.now()).toISOString();
  const fetchFn = (opts.fetchFn || fetch) as FetchFn;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const proxyUrl = opts.proxyUrl === undefined ? "/api/web?path=xsocial" : opts.proxyUrl;

  if (!isValidMint(cleanMint)) {
    return unavailableIntel(
      cleanMint,
      X_UNAVAILABLE_REASONS.invalidMint,
      "Not a valid Solana mint address.",
    );
  }

  const [dexResult, geckoResult] = await Promise.allSettled([
    fetchJson(fetchFn, dexscreenerTokensUrl(cleanMint), timeoutMs),
    fetchJson(fetchFn, geckoterminalInfoUrl(cleanMint), timeoutMs),
  ]);

  const dex =
    dexResult.status === "fulfilled" ? normalizeDexScreenerSocials(dexResult.value) : null;
  const gecko =
    geckoResult.status === "fulfilled" ? normalizeGeckoInfo(geckoResult.value) : null;

  const linkedAccount = mergeLinkedHandles(dex, gecko, fetchedAt);

  // If both upstreams failed outright, say that instead of "no link".
  if (!dex && !gecko) {
    if (dexResult.status === "rejected" && geckoResult.status === "rejected") {
      linkedAccount.reason = X_UNAVAILABLE_REASONS.allSourcesFailed;
      linkedAccount.detail =
        "DexScreener and GeckoTerminal both failed to respond — the linked account could not be checked.";
    } else if (dexResult.status === "rejected") {
      linkedAccount.detail =
        "DexScreener failed to respond; GeckoTerminal lists no linked X account for this token.";
    } else if (geckoResult.status === "rejected") {
      linkedAccount.detail =
        "GeckoTerminal failed to respond; DexScreener lists no linked X account for this token.";
    }
  }

  const noSearch: XSignal<{ count24h: number; sample: XMentionSample[] }> = {
    status: "unavailable",
    reason: X_UNAVAILABLE_REASONS.noSearchSource,
    detail:
      "No X search API is connected: the X API needs a Bearer token, and public x.com search requires login. Mention counts are never estimated.",
    fetchedAt,
  };
  const noKol: XSignal<{ accounts: Array<{ handle: string; note?: string }> }> = {
    status: "unavailable",
    reason: X_UNAVAILABLE_REASONS.noKolSource,
    detail: "No source in this stack names KOL accounts for a token.",
    fetchedAt,
  };
  const noSentiment: XSignal<{ label: "positive" | "neutral" | "negative"; postsAnalyzed: number }> = {
    status: "unavailable",
    reason: X_UNAVAILABLE_REASONS.noTextSource,
    detail: "No post text was fetched, so no sentiment score is derived — never a synthetic score.",
    fetchedAt,
  };

  let profile: XSignal<XProfile>;
  // Raw proxy envelope, kept so devPosts can be read from the same call
  // (the proxy returns profile + timeline in one response).
  let proxyBody: Record<string, unknown> | null = null;
  const handle = linkedAccount.status === "available" ? linkedAccount.value?.handle : undefined;
  if (!handle) {
    profile = {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.noTwitterLink,
      detail: "No linked X account was found, so there is no profile to enrich.",
      fetchedAt,
    };
  } else if (!proxyUrl) {
    profile = {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.proxyNotConfigured,
      detail:
        "Profile enrichment needs the _xsocial server proxy (X API v2). It is not configured for this client.",
      fetchedAt,
    };
  } else {
    try {
      // AbortSignal.timeout is missing in some test runtimes (jsdom) — guard it.
      const signal =
        typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
      const res = await fetchFn(
        `${proxyUrl}${proxyUrl.includes("?") ? "&" : "?"}handle=${encodeURIComponent(handle)}&include=timeline`,
        { signal, headers: { Accept: "application/json" } },
      );
      if (res.status === 404) {
        profile = {
          status: "unavailable",
          reason: X_UNAVAILABLE_REASONS.proxyNotConfigured,
          detail:
            "The _xsocial proxy route is not wired up yet (/api/web?path=xsocial returned 404). Ask the coordinator to add it to web/api/web.js.",
          fetchedAt,
        };
      } else {
        const body = (await res.json()) as Record<string, unknown>;
        proxyBody = body;
        if (body && body.ok === true && body.status === "available" && body.profile) {
          const p = normalizeXUser(body.profile, opts.nowMs);
          profile = p
            ? { status: "available", value: p, source: X_API_SOURCE, fetchedAt }
            : {
                status: "unavailable",
                reason: X_UNAVAILABLE_REASONS.proxyError,
                detail: "The proxy returned a profile that could not be parsed.",
                fetchedAt,
              };
        } else {
          const reason =
            typeof body?.reason === "string" ? body.reason : X_UNAVAILABLE_REASONS.proxyError;
          profile = {
            status: "unavailable",
            reason,
            detail:
              typeof body?.detail === "string"
                ? body.detail
                : "The X profile proxy returned an unavailable state.",
            fetchedAt,
          };
        }
      }
    } catch {
      profile = {
        status: "unavailable",
        reason: X_UNAVAILABLE_REASONS.proxyError,
        detail: "The X profile proxy request failed (network error or timeout).",
        fetchedAt,
      };
    }
  }

  // KOL tracking: the tracked set is the linked account only — it is the
  // one account any real source names. Its metrics come from the profile
  // signal above, so tracking is available exactly when the profile is.
  // Third-party KOLs endorsing the token stay in kolActivity (unavailable).
  let kolTracking: XSignal<{ accounts: XKolAccount[] }>;
  if (profile.status === "available" && profile.value) {
    const p = profile.value;
    kolTracking = {
      status: "available",
      value: {
        accounts: [
          {
            handle: p.handle,
            followers: p.followers ?? null,
            following: p.following ?? null,
            tweetCount: p.tweetCount ?? null,
            accountAgeDays: p.accountAgeDays ?? null,
            verified: p.verified ?? false,
            note: "Token's own linked account — the only account a real source names for tracking. No third-party KOL list exists in this stack.",
          },
        ],
      },
      source: X_API_SOURCE,
      fetchedAt,
    };
  } else {
    kolTracking = {
      status: "unavailable",
      reason: profile.reason ?? X_UNAVAILABLE_REASONS.proxyError,
      detail:
        profile.reason === X_UNAVAILABLE_REASONS.noBearerToken
          ? "KOL tracking needs the X Bearer token: without it the linked account's follower count, age and verified state cannot be fetched, so nothing is tracked."
          : profile.detail ??
            "KOL tracking is unavailable because the linked account's profile could not be enriched.",
      fetchedAt,
    };
  }

  // Dev's past posts: the linked account's timeline, from the same proxy
  // call (body.timeline). Never scraped from HTML shells.
  let devPosts: XSignal<{ handle: string; posts: XPost[] }>;
  if (!handle) {
    devPosts = {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.noTwitterLink,
      detail: "No linked X account was found, so there are no posts to fetch.",
      fetchedAt,
    };
  } else if (!proxyUrl || (proxyBody === null && profile.reason === X_UNAVAILABLE_REASONS.proxyNotConfigured)) {
    devPosts = {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.proxyNotConfigured,
      detail:
        "Past posts need the _xsocial server proxy (X API v2) with ?include=timeline. It is not configured for this client.",
      fetchedAt,
    };
  } else if (proxyBody === null) {
    devPosts = {
      status: "unavailable",
      reason: X_UNAVAILABLE_REASONS.proxyError,
      detail: "The X proxy request failed, so the timeline could not be fetched.",
      fetchedAt,
    };
  } else {
    const tl = asRecord(proxyBody.timeline);
    if (tl && tl.status === "available") {
      const posts = normalizeXTweets(tl.posts);
      devPosts =
        posts !== null
          ? {
              status: "available",
              value: { handle, posts },
              source: X_API_SOURCE,
              fetchedAt,
            }
          : {
              status: "unavailable",
              reason: X_UNAVAILABLE_REASONS.proxyError,
              detail: "The proxy returned a timeline that could not be parsed.",
              fetchedAt,
            };
    } else if (tl && tl.status === "unavailable") {
      devPosts = {
        status: "unavailable",
        reason: typeof tl.reason === "string" ? tl.reason : X_UNAVAILABLE_REASONS.proxyError,
        detail:
          typeof tl.detail === "string"
            ? tl.detail
            : "The X timeline lookup returned an unavailable state.",
        fetchedAt,
      };
    } else {
      // Proxy predates the timeline field (or returned no timeline key).
      devPosts = {
        status: "unavailable",
        reason: X_UNAVAILABLE_REASONS.proxyError,
        detail: "The proxy response carried no timeline — it may be an older _xsocial build without ?include=timeline.",
        fetchedAt,
      };
    }
  }

  // Shill-spike detection: no fetchable X-mention time series exists in
  // this stack, so the detector has nothing to run on. The only time
  // series DexScreener exposes (h1/h6/h24 volume + txns) measures
  // trading activity, not X mentions — feeding it in would mislabel a
  // volume spike as a shill spike. detectShillSpike() is implemented and
  // tested for the day a real mention series arrives.
  const shillSpike: XSignal<XShillSpike> = {
    status: "unavailable",
    reason: X_UNAVAILABLE_REASONS.noMentionTimeSeries,
    detail:
      "No X-mention time series is fetchable: X search needs a Bearer token and public x.com search requires login. Spikes are never synthesized from trading volume or guessed counts.",
    fetchedAt,
  };

  // Best-effort symbol from the DexScreener payload (display only).
  let symbol: string | null = null;
  if (dexResult.status === "fulfilled" && Array.isArray(dexResult.value)) {
    const first = asRecord(dexResult.value[0]);
    const base = asRecord(first?.baseToken);
    if (typeof base?.symbol === "string") symbol = base.symbol;
  }

  // Caller track records: no X search exists in this stack to name
  // callers, and no price-history source exists for call-time prices.
  // evaluateCallerAccuracy() is implemented and tested for the day
  // both inputs exist — until then this is honestly unavailable.
  const callerRecords: XSignal<{ records: XCallerRecord[] }> = {
    status: "unavailable",
    reason: X_UNAVAILABLE_REASONS.noCallerSource,
    detail:
      "No source names the X accounts that called this token: X search needs a Bearer token on a Basic+ tier and is not connected, and no price-history source exists to score calls against. Caller names, call times and accuracy % are never invented.",
    fetchedAt,
  };

  // X account audit: age + verified from the bearer profile — available
  // exactly when the profile is. Bot-follower % is always null inside
  // the value (no reliable source measures it).
  let accountAudit: XSignal<XAccountAudit>;
  if (profile.status === "available" && profile.value) {
    accountAudit = {
      status: "available",
      value: auditFromProfile(profile.value),
      source: X_API_SOURCE,
      fetchedAt,
    };
  } else {
    accountAudit = {
      status: "unavailable",
      reason: profile.reason ?? X_UNAVAILABLE_REASONS.proxyError,
      detail:
        profile.reason === X_UNAVAILABLE_REASONS.noBearerToken
          ? "Account audit needs the X Bearer token: without it the linked account's age and verified state cannot be fetched."
          : profile.detail ?? "Account audit is unavailable because the linked account's profile could not be enriched.",
      fetchedAt,
    };
  }

  // Social velocity: same missing input as the shill spike — no
  // fetchable X-mention time series. computeSocialVelocity() is
  // implemented and tested for the day one exists.
  const socialVelocity: XSignal<XSocialVelocity> = {
    status: "unavailable",
    reason: X_UNAVAILABLE_REASONS.noMentionSource,
    detail:
      "No X-mention time series is fetchable: X search needs a Bearer token and public x.com search requires login. Hour-over-hour growth is never synthesized from trading volume or guessed counts.",
    fetchedAt,
  };

  // Dev's other socials: real keyless sources — DexScreener socials
  // (non-twitter) + websites, GeckoTerminal telegram/discord/websites.
  // Each link is live-checked with a best-effort fetch; a failed check
  // is "unknown", never "dead". A 200 means the page responded, not
  // that the group exists or has members — counts are never claimed.
  let devOtherSocials: XSignal<{ links: XOtherSocialLink[]; note?: string }>;
  const dexOther =
    dexResult.status === "fulfilled" ? normalizeDexScreenerOtherSocials(dexResult.value) : null;
  const geckoOther =
    geckoResult.status === "fulfilled" ? normalizeGeckoOtherSocials(geckoResult.value) : null;
  const merged = mergeOtherSocials(dexOther, geckoOther);
  if (merged.links.length === 0) {
    devOtherSocials = {
      status: "unavailable",
      reason:
        dexResult.status === "rejected" && geckoResult.status === "rejected"
          ? X_UNAVAILABLE_REASONS.allSourcesFailed
          : X_UNAVAILABLE_REASONS.noOtherSocials,
      detail:
        dexResult.status === "rejected" && geckoResult.status === "rejected"
          ? "DexScreener and GeckoTerminal both failed to respond — other socials could not be listed."
          : "Neither DexScreener nor GeckoTerminal lists a Telegram, Discord or website for this token.",
      fetchedAt,
    };
  } else {
    const linkTimeout = Math.min(timeoutMs, 5000);
    const checked = await Promise.all(
      merged.links.map(async (link) => {
        const live = await checkLinkLive(fetchFn as FetchFn, link.url, linkTimeout);
        return { ...link, liveStatus: live.liveStatus, httpStatus: live.httpStatus };
      }),
    );
    devOtherSocials = {
      status: "available",
      value: merged.note ? { links: checked, note: merged.note } : { links: checked },
      source: `${DEXSCREENER_SOURCE}+${GECKOTERMINAL_SOURCE}`,
      fetchedAt,
    };
  }

  // Community sentiment gauge (Telegram/Discord): no community text
  // source, no stored member snapshots, no bot-% source. All three
  // inputs are missing, so the gauge is honestly unavailable.
  // computeMemberGrowth() is implemented and tested for the day two
  // real member snapshots exist.
  const communitySentiment: XSignal<XCommunitySentiment> = {
    status: "unavailable",
    reason: X_UNAVAILABLE_REASONS.noCommunitySource,
    detail:
      "No Telegram/Discord text source exists to read the community vibe from, no member snapshots exist to measure growth, and no source measures bot %. Vibe, growth and bot % are never estimated.",
    fetchedAt,
  };

  // Dev AMA tracker: derived from devPosts — the linked account's own
  // recent tweets. Available exactly when the timeline is. Identity
  // and promises stay "unverifiable": a profile + 10 tweets cannot
  // establish who the dev is or whether past promises were kept.
  let devAmaTracker: XSignal<XDevAmaTracker>;
  if (devPosts.status === "available" && devPosts.value) {
    devAmaTracker = {
      status: "available",
      value: {
        handle: devPosts.value.handle,
        amaMentions: extractAmaMentions(devPosts.value.posts),
        identityStatus: "unverifiable",
        identityNote:
          "Identity is only ever what the dev publicly shared themself. A profile name is a brand, not a person — nothing in the profile or recent posts establishes who the dev is, so this stays unverifiable. Never doxxed from outside records.",
        promisesStatus: "unverifiable",
        promisesNote:
          "A promise counts as kept or broken only when both the promise and its outcome are verifiable. Ten recent tweets are not a promise ledger, so nothing is judged here.",
      },
      source: X_API_SOURCE,
      fetchedAt,
    };
  } else {
    devAmaTracker = {
      status: "unavailable",
      reason: devPosts.reason ?? X_UNAVAILABLE_REASONS.proxyError,
      detail:
        devPosts.detail ??
        "AMA tracking needs the linked account's recent posts, which could not be fetched.",
      fetchedAt,
    };
  }

  return { mint: cleanMint, symbol, linkedAccount, profile, mentions: noSearch, kolActivity: noKol, kolTracking, devPosts, shillSpike, sentiment: noSentiment, callerRecords, accountAudit, socialVelocity, devOtherSocials, communitySentiment, devAmaTracker, fetchedAt };
}
