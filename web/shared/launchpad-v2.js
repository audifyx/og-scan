/** Launchpad V2 — allocation, bagworking, and fee-job rules (no I/O). */

export const FEE_THRESHOLD_USD = 25;
export const DEFAULT_SHORT_USD = 1.5;
export const DEFAULT_LONG_USD = 3;
export const DEFAULT_SHORT_MIN_CHARS = 20;
export const DEFAULT_LONG_MIN_CHARS = 200;
export const DEFAULT_MAX_POSTS_PER_DAY = 10;
export const LAUNCH_KINDS = ["standard", "flywheel", "bagworking"];

export const BAGWORKING_DEFAULTS = {
  short_reward_usd: DEFAULT_SHORT_USD,
  long_reward_usd: DEFAULT_LONG_USD,
  min_short_chars: DEFAULT_SHORT_MIN_CHARS,
  long_min_chars: DEFAULT_LONG_MIN_CHARS,
  max_posts_per_day: DEFAULT_MAX_POSTS_PER_DAY,
  require_ticker: true,
  require_ca: false,
  require_hashtag: false,
  require_url: false,
  replies_count: false,
  quotes_count: false,
  reposts_count: false,
  fee_threshold_usd: FEE_THRESHOLD_USD,
};

export function normalizeBps(parts) {
  const community = Math.round(Number(parts.community) || 0);
  const buyBurn = Math.round(Number(parts.buyBurn) || 0);
  const creator = Math.round(Number(parts.creator) || 0);
  const rewards = Math.round(Number(parts.rewards) || 0);
  return { community, buyBurn, creator, rewards, total: community + buyBurn + creator + rewards };
}

/** Accept either 0–100 percents or 0–10000 bps. */
export function flywheelFromPercents(input) {
  const raw = {
    community: Number(input.community) || 0,
    buyBurn: Number(input.buyBurn ?? input.buy_burn) || 0,
    creator: Number(input.creator) || 0,
    rewards: Number(input.rewards) || 0,
  };
  const looksPercent = raw.community + raw.buyBurn + raw.creator + raw.rewards <= 100.0001;
  const bps = looksPercent
    ? normalizeBps({
        community: raw.community * 100,
        buyBurn: raw.buyBurn * 100,
        creator: raw.creator * 100,
        rewards: raw.rewards * 100,
      })
    : normalizeBps(raw);
  return bps;
}

export function validateFlywheel(input) {
  const bps = flywheelFromPercents(input || {});
  if (bps.total !== 10000) {
    return { ok: false, error: `Flywheel allocations must total 100% (got ${(bps.total / 100).toFixed(2)}%)`, bps };
  }
  return { ok: true, bps };
}

export function defaultFlywheel() {
  return { community: 40, buyBurn: 30, creator: 20, rewards: 10 };
}

export function extractTweetId(raw) {
  const t = String(raw || "").trim();
  const m = t.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
  if (m) return m[1];
  if (/^\d{5,20}$/.test(t)) return t;
  return "";
}

export function utcDay(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10);
}

export function classifyPost(text, rules = {}) {
  const body = String(text || "").trim();
  const minShort = Number(rules.min_short_chars || DEFAULT_SHORT_MIN_CHARS);
  const minLong = Number(rules.long_min_chars || DEFAULT_LONG_MIN_CHARS);
  if (body.length < minShort) return "too_short";
  return body.length >= minLong ? "long" : "short";
}

export function rewardForKind(kind, rules = {}) {
  return kind === "long"
    ? Number(rules.long_reward_usd ?? DEFAULT_LONG_USD)
    : Number(rules.short_reward_usd ?? DEFAULT_SHORT_USD);
}

export function campaignRemaining(campaign) {
  const budget = Number(campaign?.budget_usd || 0);
  const spent = Number(campaign?.spent_usd || 0);
  return Math.max(0, Math.round((budget - spent) * 100) / 100);
}

export function validateQualifyingText(text, campaign, rules = {}) {
  const body = String(text || "");
  const lower = body.toLowerCase();
  if (!body.trim()) return { ok: false, error: "Empty post" };
  const ticker = String(campaign?.required_ticker || "").replace(/^\$/, "").trim();
  if ((rules.require_ticker !== false) && ticker) {
    const re = new RegExp(`\\$${ticker}\\b|\\b${ticker}\\b`, "i");
    if (!re.test(body)) return { ok: false, error: `Post must mention $${ticker.toUpperCase()}` };
  }
  const ca = String(campaign?.mint || "").trim();
  if (rules.require_ca && ca && !body.includes(ca)) {
    return { ok: false, error: "Post must include the contract address" };
  }
  const needUrl = String(campaign?.required_url || rules.required_url || "").trim();
  if ((rules.require_url || needUrl) && needUrl && !body.includes(needUrl)) {
    return { ok: false, error: "Post must include the required campaign URL" };
  }
  const tag = String(campaign?.required_hashtag || rules.required_hashtag || "").replace(/^#/, "");
  if ((rules.require_hashtag || campaign?.required_hashtag) && tag && !lower.includes(`#${tag.toLowerCase()}`)) {
    return { ok: false, error: `Post must include #${tag}` };
  }
  const keys = Array.isArray(campaign?.required_keywords) ? campaign.required_keywords : [];
  for (const k of keys) {
    if (k && !lower.includes(String(k).toLowerCase())) {
      return { ok: false, error: `Post must include “${k}”` };
    }
  }
  return { ok: true };
}

export function referencedTweetDisallowed(tweet, rules = {}) {
  const refs = Array.isArray(tweet?.referenced_tweets) ? tweet.referenced_tweets : [];
  for (const r of refs) {
    const type = String(r?.type || "");
    if (type === "replied_to" && !rules.replies_count) return "Replies do not qualify";
    if (type === "quoted" && !rules.quotes_count) return "Quote posts do not qualify";
    if (type === "retweeted" && !rules.reposts_count) return "Reposts do not qualify";
  }
  return null;
}

export function dailyLimitReached(used, rules = {}) {
  const cap = Number(rules.max_posts_per_day || DEFAULT_MAX_POSTS_PER_DAY);
  return Number(used || 0) >= cap;
}

export function feeReady(claimableUsd, threshold = FEE_THRESHOLD_USD) {
  return Number(claimableUsd || 0) + 1e-9 >= Number(threshold);
}

export function progressToThreshold(claimableUsd, threshold = FEE_THRESHOLD_USD) {
  const c = Math.max(0, Number(claimableUsd) || 0);
  const t = Number(threshold) || FEE_THRESHOLD_USD;
  return { current: c, threshold: t, ratio: Math.min(1, c / t), ready: feeReady(c, t) };
}
