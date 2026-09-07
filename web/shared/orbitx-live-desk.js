/**
 * OrbitX live agent desk — real SOL, real Jupiter fills.
 * Deposit address is public. The signing secret lives only in
 * LIVE_AGENT_WALLET_SECRET on Vercel. Never commit a key.
 *
 * Not financial advice. Caps: $1.50 per buy, 1 open book, scale 41% / keep 59%, then flatten.
 */
import { layoutLiveCity } from "./orbitx-live-city.js";
export const LIVE_WALLET_PUBKEY = "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj";
export const LIVE_TRADE_USD = 1.5;
export const LIVE_FEE_RESERVE_SOL = 0.004;
export const LIVE_MAX_OPEN = 1;
export const LIVE_STOP_PCT = -0.12;
export const LIVE_TP_USD = 0.3;
export const LIVE_TP_MAX_USD = 1;
export const LIVE_SCRAPE_USD = 0.08;
export const LIVE_SCALP_MS = 12 * 60_000;
export const LIVE_MAX_HOLD_MS = 22 * 60_000;
export const LIVE_TICK_MINUTES = 5;
export const LIVE_MIN_LIQ_USD = 22_000;
export const LIVE_MIN_VOL_USD = 25_000;
export const LIVE_MIN_MCAP_USD = 30_000;
export const LIVE_MAX_MCAP_USD = 4_000_000;
export const LIVE_EARLY_MAX_MCAP_USD = 2_500_000;
export const LIVE_EARLY_MAX_AGE_MIN = 18 * 60;
export const LIVE_MAJOR_MCAP_USD = 80_000_000;
export const LIVE_MAJOR_LIQ_USD = 250_000;
export const LIVE_MAX_ROUND_TRIP_PCT = 8;
export const LIVE_MAX_BUY_IMPACT_PCT = 3.5;
export const LIVE_MIN_AGE_MIN = 18;
export const LIVE_MAX_1H_PUMP_PCT = 38;
export const LIVE_MAX_24H_PUMP_PCT = 140;
export const LIVE_MAX_5M_DUMP_PCT = -6;
export const LIVE_MAX_15M_DUMP_PCT = -10;
export const LIVE_MIN_MOVE_1H_PCT = 3;
export const LIVE_MIN_TXNS_1H = 30;
export const LIVE_SCALE_KEEP_PCT = 0.59;
export const LIVE_SCALE_SELL_PCT = 0.41;
export const LIVE_RUNNER_HOLD_MS = 8 * 60_000;
export const LIVE_MAX_PROBES = 5;
export const SOL_MINT = "So11111111111111111111111111111111111111112";
/** Liquid majors the desk is allowed to buy — high MC is a feature, not a skip. */
export const LIVE_ALLOW_SYMBOLS = new Set([
  "JUP",
  "JLP",
  "USELESS",
  "WIF",
  "BONK",
  "RAY",
  "JTO",
  "PYTH",
  "ORCA",
  "RENDER",
  "W",
  "MEW",
  "POPCAT",
  "PNUT",
  "GOAT",
  "FARTCOIN",
  "TRUMP",
  "PENGU",
  "HYPE",
  "ZEC",
  "STONK",
  "ANTFUN",
]);
export const LIVE_ALLOW_MINTS = new Set([
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
  "Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk", // USELESS
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", // JTO
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", // ORCA
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", // RENDER
  "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ", // W
  "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", // MEW
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
  "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", // PNUT
  "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", // FARTCOIN
  "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", // TRUMP
  "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", // PENGU
]);
export const LIVE_SKIP_SYMBOLS = new Set(["USDC", "USDT", "USD1", "PYUSD", "USDS", "DAI", "FDUSD", "USDH", "CASH", "USDG", "EURC"]);
export const LIVE_SKIP_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
]);

export const LIVE_AGENTS = [
  {
    id: "neon-live",
    name: "NEON LIVE",
    style: "momentum",
    tpPct: 0.2,
    color: "#34d399",
    blurb: "Finds early low-cap runners, buys the dip, sells 41% into strength, keeps 59% on a short leash.",
  },
  {
    id: "warden-live",
    name: "WARDEN LIVE",
    style: "mean_reversion",
    tpPct: 0.18,
    color: "#fb7185",
    blurb: "Buys pullbacks on young books. Skips dumps and already-ran tops. Scales 41/59 then flattens.",
  },
  {
    id: "raid-live",
    name: "RAID LIVE",
    style: "fresh",
    tpPct: 0.22,
    color: "#fbbf24",
    blurb: "Catches just-listed graduates early — after a dip, not a 1000% day. Scale out, then take the clip.",
  },
];

export const LIVE_DISCLAIMER =
  "Not financial advice. These books spend real SOL from a hot wallet. Max $1.50 per buy, one open book, research every 5 minutes. NEON, WARDEN, and RAID rotate. They hunt early low-cap runners (CatGPT/Nasduck-shaped before they go vertical), buy dips, skip dumps and tops, and never buy what Jupiter cannot sell. First take: sell 41% into strength, keep 59% for a short hold, then flatten the rest. You can lose the whole bank.";

export function liveAgentById(id) {
  const needle = String(id || "").trim().toLowerCase();
  return LIVE_AGENTS.find((a) => a.id === needle || a.name.toLowerCase() === needle) || null;
}

export function nextLiveAgent(lastId) {
  if (!LIVE_AGENTS.length) return null;
  const i = LIVE_AGENTS.findIndex((a) => a.id === lastId);
  return LIVE_AGENTS[(i + 1) % LIVE_AGENTS.length];
}

export function liveAgentOrder(lastId) {
  const start = nextLiveAgent(lastId);
  if (!start) return [];
  const out = [start];
  let cur = start;
  for (let i = 1; i < LIVE_AGENTS.length; i += 1) {
    cur = nextLiveAgent(cur.id);
    if (cur) out.push(cur);
  }
  return out;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function hasCommunity(coin = {}) {
  const socials = Array.isArray(coin.socials) ? coin.socials : [];
  const types = socials.map((s) => String(s?.type || s || "").toLowerCase());
  return Boolean(
    coin.twitter ||
      coin.telegram ||
      coin.website ||
      types.includes("twitter") ||
      types.includes("telegram") ||
      types.includes("discord"),
  );
}

export function hasOrganicFlow(coin = {}) {
  return (
    num(coin.buys_1h) >= LIVE_MIN_TXNS_1H ||
    num(coin.txns_1h) >= 55 ||
    num(coin.volume_1h) >= 15_000 ||
    num(coin.volume_24h) >= LIVE_MIN_VOL_USD
  );
}

export function isDumping(coin = {}) {
  const m5 = coin.change_5m == null || coin.change_5m === "" ? null : num(coin.change_5m);
  const m15 = coin.change_15m == null || coin.change_15m === "" ? null : num(coin.change_15m);
  const h1 = num(coin.change_1h);
  if (m5 != null && m5 <= LIVE_MAX_5M_DUMP_PCT) return true;
  if (m15 != null && m15 <= LIVE_MAX_15M_DUMP_PCT) return true;
  if (h1 <= -15 && (m5 == null || m5 <= 0)) return true;
  return false;
}

export function looksTopped(coin = {}) {
  const h1 = num(coin.change_1h);
  const m5 = coin.change_5m == null || coin.change_5m === "" ? null : num(coin.change_5m);
  const m15 = coin.change_15m == null || coin.change_15m === "" ? null : num(coin.change_15m);
  if (h1 >= LIVE_MAX_1H_PUMP_PCT) return true;
  if (num(coin.change_24h) >= LIVE_MAX_24H_PUMP_PCT) return true;
  if (h1 >= 28 && m5 != null && m5 <= -4) return true;
  if (h1 >= 22 && m15 != null && m15 <= -8) return true;
  if (h1 >= 25 && m5 == null) return true;
  const buys = num(coin.buys_1h);
  const sells = num(coin.sells_1h);
  if (sells > 0 && buys > 0 && sells > buys * 1.35 && (m5 == null || m5 <= 0)) return true;
  return false;
}

export function looksDead(coin = {}) {
  const h1 = Math.abs(num(coin.change_1h));
  const m5 = coin.change_5m == null || coin.change_5m === "" ? 0 : Math.abs(num(coin.change_5m));
  return h1 < LIVE_MIN_MOVE_1H_PCT && m5 < 1.5 && num(coin.volume_1h) < 12_000 && num(coin.txns_1h) < 40;
}

export function isHealthyDip(coin = {}) {
  if (isDumping(coin) || looksTopped(coin) || looksDead(coin)) return false;
  const h1 = num(coin.change_1h);
  const m5 = coin.change_5m == null || coin.change_5m === "" ? null : num(coin.change_5m);
  if (h1 < LIVE_MIN_MOVE_1H_PCT || h1 >= LIVE_MAX_1H_PUMP_PCT) return false;
  if (m5 == null) return h1 >= LIVE_MIN_MOVE_1H_PCT && h1 <= 22;
  return m5 <= 2 && m5 > LIVE_MAX_5M_DUMP_PCT;
}

export function isLiveMover(coin = {}) {
  return isHealthyDip(coin);
}

export function isEarlyRunner(coin = {}) {
  if (isDumping(coin) || looksTopped(coin) || looksDead(coin)) return false;
  const age = coin.pair_age_min == null ? null : num(coin.pair_age_min);
  const mcap = num(coin.market_cap ?? coin.marketCap);
  const liq = num(coin.liquidity_usd ?? coin.liquidity);
  if (age != null && (age < LIVE_MIN_AGE_MIN || age > LIVE_EARLY_MAX_AGE_MIN)) return false;
  if (mcap > 0 && (mcap < LIVE_MIN_MCAP_USD || mcap > LIVE_EARLY_MAX_MCAP_USD)) return false;
  if (liq < LIVE_MIN_LIQ_USD) return false;
  if (num(coin.change_24h) >= LIVE_MAX_24H_PUMP_PCT) return false;
  return hasCommunity(coin) || hasOrganicFlow(coin);
}

export function solForTradeUsd(usd, solUsd) {
  const price = num(solUsd);
  if (price <= 0) return 0;
  return num(usd) / price;
}

export function sizeLiveBuy({ solBalance, solUsd, openCount, tradeUsd = LIVE_TRADE_USD } = {}) {
  const open = num(openCount);
  if (open >= LIVE_MAX_OPEN) return { ok: false, skip: "max_open", openCount: open };
  const sol = solForTradeUsd(tradeUsd, solUsd);
  if (!(sol > 0)) return { ok: false, skip: "no_sol_price", sol: 0, usd: tradeUsd };
  const bal = num(solBalance);
  if (bal - sol < LIVE_FEE_RESERVE_SOL) {
    return { ok: false, skip: "fee_reserve", sol, usd: tradeUsd, balance: bal };
  }
  return { ok: true, sol, usd: tradeUsd, lamports: Math.floor(sol * 1e9) };
}

export function liveIsMajor(coin = {}, safety = {}) {
  if (safety.canSell === false) return false;
  const mint = String(coin.mint || "");
  const sym = String(coin.symbol || "").replace(/^\$/, "").toUpperCase();
  if (LIVE_SKIP_MINTS.has(mint) || LIVE_SKIP_SYMBOLS.has(sym) || mint === SOL_MINT) return false;
  const mcap = num(coin.market_cap ?? coin.marketCap);
  const liq = num(coin.liquidity_usd ?? coin.liquidity);
  const vol = num(coin.volume_24h ?? coin.volume);
  if (LIVE_ALLOW_MINTS.has(mint)) return true;
  if (LIVE_ALLOW_SYMBOLS.has(sym) && (mcap >= 20_000_000 || liq >= LIVE_MAJOR_LIQ_USD || vol >= 400_000)) return true;
  if (mcap >= LIVE_MAJOR_MCAP_USD && (liq >= LIVE_MAJOR_LIQ_USD || vol >= 400_000)) return true;
  return false;
}

export function screenLiveCandidate(coin = {}, safety = {}) {
  const reasons = [];
  const liq = num(coin.liquidity_usd ?? coin.liquidity);
  const vol = num(coin.volume_24h ?? coin.volume);
  const mcap = num(coin.market_cap ?? coin.marketCap);
  const ageMin = coin.pair_age_min == null ? null : num(coin.pair_age_min);
  const mint = String(coin.mint || "");
  const symbol = String(coin.symbol || mint.slice(0, 4)).replace(/^\$/, "").toUpperCase();
  const major = liveIsMajor(coin, safety);

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) reasons.push("bad mint");
  if (mint === SOL_MINT) reasons.push("sol mint");
  if (LIVE_SKIP_MINTS.has(mint) || LIVE_SKIP_SYMBOLS.has(symbol)) reasons.push("stable / skip");
  if (liq < LIVE_MIN_LIQ_USD) reasons.push(`liq $${Math.round(liq)} < $${LIVE_MIN_LIQ_USD}`);
  if (vol < LIVE_MIN_VOL_USD) reasons.push(`vol $${Math.round(vol)} < $${LIVE_MIN_VOL_USD}`);
  if (mcap > 0 && mcap < LIVE_MIN_MCAP_USD) reasons.push("mcap too small");
  if (mcap > LIVE_MAX_MCAP_USD) reasons.push("mcap too large");
  if (ageMin != null && ageMin < LIVE_MIN_AGE_MIN) reasons.push(`pair only ${Math.round(ageMin)}m old`);
  if (isDumping(coin)) reasons.push("dumping — skip");
  if (looksTopped(coin)) reasons.push("topped — don't chase");
  if (looksDead(coin)) reasons.push("no follow-through — wait");
  if (num(coin.change_1h) >= LIVE_MAX_1H_PUMP_PCT) reasons.push("already pumped");
  if (num(coin.change_24h) >= LIVE_MAX_24H_PUMP_PCT) reasons.push("already ran");
  if (coin.boosted && !hasCommunity(coin)) reasons.push("boosted, no community");
  if (!hasCommunity(coin) && !hasOrganicFlow(coin)) reasons.push("no social / no tape");
  if (safety.canBuy === false) reasons.push("no buy route");
  if (safety.canSell === false) reasons.push("cannot sell — skip as rug/honeypot");
  if (safety.roundTripLossPct != null && num(safety.roundTripLossPct) >= LIVE_MAX_ROUND_TRIP_PCT) {
    reasons.push(`round-trip ${num(safety.roundTripLossPct).toFixed(0)}%`);
  }
  if (safety.buyImpactPct != null && num(safety.buyImpactPct) >= LIVE_MAX_BUY_IMPACT_PCT) {
    reasons.push(`buy impact ${num(safety.buyImpactPct).toFixed(1)}%`);
  }
  if (safety.mintAuthorityActive === true) reasons.push("mint authority live");
  if (safety.freezeAuthorityActive === true) reasons.push("freeze authority live");
  if (coin.honeypot === true || safety.honeypot === true) reasons.push("honeypot flag");
  if (safety.bondingOnly === true) reasons.push("bonding-curve only — wait for a DEX sell route");

  return {
    ok: reasons.length === 0,
    reasons,
    score: scoreLiveCandidate(coin, safety),
    mint,
    symbol,
    major,
  };
}

export function scoreLiveCandidate(coin = {}, safety = {}) {
  let s = 0;
  const liq = num(coin.liquidity_usd);
  const vol = num(coin.volume_24h);
  const ch1 = num(coin.change_1h);
  const ch24 = num(coin.change_24h);
  const m5 = coin.change_5m == null || coin.change_5m === "" ? null : num(coin.change_5m);
  const mcap = num(coin.market_cap ?? coin.marketCap);
  if (liq >= 80_000) s += 10;
  if (liq >= 250_000) s += 6;
  if (vol >= 100_000) s += 10;
  if (num(coin.volume_1h) >= 25_000) s += 8;
  if (num(coin.buys_1h) >= LIVE_MIN_TXNS_1H) s += 8;
  if (safety.canSell) s += 20;
  if (safety.roundTripLossPct != null && num(safety.roundTripLossPct) < 6) s += 8;
  if (isHealthyDip(coin)) s += 18;
  if (isEarlyRunner(coin)) s += 16;
  if (ch1 >= LIVE_MIN_MOVE_1H_PCT && ch1 <= 22) s += 8;
  if (m5 != null && m5 <= 1 && m5 > LIVE_MAX_5M_DUMP_PCT && ch1 >= 6) s += 10;
  if (ch24 <= -40) s -= 12;
  if (isDumping(coin)) s -= 30;
  if (looksTopped(coin)) s -= 24;
  if (looksDead(coin)) s -= 16;
  if (ch1 >= 36) s -= 14;
  if (mcap >= 40_000 && mcap <= LIVE_EARLY_MAX_MCAP_USD) s += 10;
  if (mcap > LIVE_MAX_MCAP_USD) s -= 20;
  if (hasCommunity(coin)) s += 12;
  if (coin.boosted && !hasCommunity(coin)) s -= 22;
  else if (coin.boosted) s -= 4;
  if (liveIsMajor(coin, safety)) s -= 8;
  return s;
}

export function rankForLiveStyle(style, coins) {
  const list = (coins || []).filter((c) => c?.mint && c.mint !== SOL_MINT);
  const copy = list.slice();
  if (style === "momentum") copy.sort((a, b) => num(b.change_1h) - num(a.change_1h) || num(b.volume_24h) - num(a.volume_24h));
  else if (style === "mean_reversion") copy.sort((a, b) => num(a.change_24h) - num(b.change_24h) || num(b.liquidity_usd) - num(a.liquidity_usd));
  else if (style === "fresh") {
    copy.sort(
      (a, b) =>
        (num(a.pair_age_min, 9e9) - num(b.pair_age_min, 9e9)) ||
        num(b.volume_24h) - num(a.volume_24h),
    );
  }   else copy.sort((a, b) => num(b.volume_24h) - num(a.volume_24h));
  return liftLiveScalps(copy);
}

export function liftLiveMajors(ranked) {
  return liftLiveScalps(ranked);
}

export function liftLiveScalps(ranked) {
  const list = ranked || [];
  const early = [];
  const dips = [];
  const community = [];
  const rest = [];
  for (const c of list) {
    if (liveIsMajor(c) || num(c.market_cap ?? c.marketCap) > LIVE_MAX_MCAP_USD) {
      rest.push(c);
      continue;
    }
    if (isDumping(c) || looksTopped(c) || looksDead(c)) {
      rest.push(c);
      continue;
    }
    if (isEarlyRunner(c) && isHealthyDip(c)) early.push(c);
    else if (isHealthyDip(c)) dips.push(c);
    else if (hasCommunity(c) && !c.boosted) community.push(c);
    else rest.push(c);
  }
  const byScore = (a, b) => scoreLiveCandidate(b, { canBuy: true, canSell: true }) - scoreLiveCandidate(a, { canBuy: true, canSell: true });
  early.sort(byScore);
  dips.sort(byScore);
  return early.concat(dips).concat(community).concat(rest);
}

export function pickLiveToken(agent, ranked) {
  const list = ranked || [];
  if (!list.length) return null;
  const safe = list.filter((t) => !isDumping(t) && !looksTopped(t) && !looksDead(t));
  if (agent?.style === "momentum") {
    return safe.find((t) => isHealthyDip(t) || (num(t.change_1h) >= LIVE_MIN_MOVE_1H_PCT && num(t.change_1h) < 28)) || null;
  }
  if (agent?.style === "mean_reversion") {
    return (
      safe.find((t) => num(t.change_24h) <= -4 && num(t.change_24h) >= -35 && !isDumping(t)) ||
      safe.find((t) => isHealthyDip(t)) ||
      null
    );
  }
  if (agent?.style === "fresh") {
    return (
      safe.find((t) => {
        const age = num(t.pair_age_min, 999);
        return age >= LIVE_MIN_AGE_MIN && age <= 12 * 60 && isHealthyDip(t);
      }) ||
      safe.find((t) => isHealthyDip(t)) ||
      null
    );
  }
  return safe[0] || null;
}

export function decideLiveExit(position = {}, markUsd, now = Date.now(), opts = {}) {
  const entry = num(position.entry_price_usd);
  const mark = num(markUsd);
  const tp = num(position.tp_pct, 0.2);
  if (!(entry > 0) || !(mark > 0)) return { action: "hold", pnlPct: 0, reason: "no_mark" };
  const pnlPct = (mark - entry) / entry;
  const usdIn = num(position.usd_in, LIVE_TRADE_USD);
  const pnlUsd = Math.round(usdIn * pnlPct * 100) / 100;
  const opened = Date.parse(position.opened_at || position.created_at || "") || 0;
  const heldMs = opened > 0 ? Math.max(0, now - opened) : 0;
  const scaled = opts.scaled === true || Boolean(position.scaled_at);
  const scaledAt = Date.parse(opts.scaledAt || position.scaled_at || "") || 0;
  const sinceScale = scaledAt > 0 ? Math.max(0, now - scaledAt) : heldMs;

  if (pnlPct <= LIVE_STOP_PCT) {
    return { action: "stop", pnlPct, pnlUsd, reason: `${(pnlPct * 100).toFixed(1)}% — cut it, could be a rug/dump` };
  }
  if (pnlUsd >= LIVE_TP_MAX_USD) {
    return { action: "take_profit", pnlPct, pnlUsd, reason: `+${pnlUsd.toFixed(2)} hit $1 cap — sell the rest of the clip` };
  }
  if (scaled) {
    if (sinceScale >= LIVE_RUNNER_HOLD_MS) {
      return { action: "take_profit", pnlPct, pnlUsd, reason: `held the 59% remainder ${Math.round(sinceScale / 60000)}m — flatten the clip` };
    }
    if (pnlUsd >= LIVE_TP_USD) {
      return { action: "take_profit", pnlPct, pnlUsd, reason: `remainder popped +${pnlUsd.toFixed(2)} — sell the rest` };
    }
    if (heldMs >= LIVE_MAX_HOLD_MS) {
      return { action: "time_stop", pnlPct, pnlUsd, reason: `held ${Math.round(heldMs / 60000)}m — flatten remainder` };
    }
    return { action: "hold", pnlPct, pnlUsd, reason: "hold_remainder" };
  }
  if (pnlUsd >= LIVE_TP_USD || pnlPct >= tp) {
    return {
      action: "scale_out",
      pnlPct,
      pnlUsd,
      sellPct: LIVE_SCALE_SELL_PCT,
      keepPct: LIVE_SCALE_KEEP_PCT,
      reason: `+${pnlUsd.toFixed(2)} — sell ${(LIVE_SCALE_SELL_PCT * 100).toFixed(0)}%, keep ${(LIVE_SCALE_KEEP_PCT * 100).toFixed(0)}% for a short hold`,
    };
  }
  if (heldMs >= LIVE_SCALP_MS && pnlUsd >= LIVE_SCRAPE_USD) {
    return {
      action: "scale_out",
      pnlPct,
      pnlUsd,
      sellPct: LIVE_SCALE_SELL_PCT,
      keepPct: LIVE_SCALE_KEEP_PCT,
      reason: `held ${Math.round(heldMs / 60000)}m, booked +${pnlUsd.toFixed(2)} — scale 41%, keep 59%`,
    };
  }
  if (heldMs >= LIVE_MAX_HOLD_MS) {
    return { action: "time_stop", pnlPct, pnlUsd, reason: `held ${Math.round(heldMs / 60000)}m — rotate, don't baghold` };
  }
  return { action: "hold", pnlPct, pnlUsd, reason: "hold" };
}

export function summarizeLiveLedger({
  fills = [],
  open = [],
  agents = LIVE_AGENTS,
  startingUsd = null,
  startingSol = null,
  solBalance = null,
  usdBalance = null,
  equityUsd = null,
  realizedPnlUsd = 0,
} = {}) {
  const sells = fills.filter((f) => String(f.side || "") === "sell");
  const buys = fills.filter((f) => String(f.side || "") === "buy");
  const winRows = sells.filter((f) => num(f.pnl_usd) > 0);
  const lossRows = sells.filter((f) => num(f.pnl_usd) <= 0);
  const realized = sells.reduce((s, f) => s + num(f.pnl_usd), 0) || num(realizedPnlUsd);
  const holding = open[0] || null;
  const unrealized = open.reduce((s, p) => {
    if (p.pnl_pct == null) return s;
    return s + (num(p.usd_in) * num(p.pnl_pct)) / 100;
  }, 0);
  const startUsd = startingUsd != null ? num(startingUsd) : null;
  const nowUsd = equityUsd != null ? num(equityUsd) : usdBalance != null ? num(usdBalance) + unrealized : null;
  const madeUsd = startUsd != null && nowUsd != null ? nowUsd - startUsd : realized + unrealized;
  const books = (agents || LIVE_AGENTS).map((a) => {
    const mine = fills.filter((f) => f.agent_id === a.id);
    const mySells = mine.filter((f) => String(f.side || "") === "sell");
    const wins = mySells.filter((f) => num(f.pnl_usd) > 0).length;
    const losses = mySells.filter((f) => num(f.pnl_usd) <= 0).length;
    const hold = open.find((p) => p.agent_id === a.id) || null;
    const realizedA = mySells.reduce((s, f) => s + num(f.pnl_usd), 0);
    const unrealizedA = hold?.pnl_pct != null ? (num(hold.usd_in) * num(hold.pnl_pct)) / 100 : 0;
    const deployed = mine.filter((f) => String(f.side || "") === "buy").reduce((s, f) => s + num(f.usd_amount ?? f.usd_in), 0);
    return {
      ...a,
      open: hold,
      holding: hold,
      currently_hold: hold ? `$${String(hold.symbol || "").replace(/^\$/, "")}` : "cash",
      wins,
      losses,
      trades: mySells.length,
      win_pct: mySells.length ? (wins / mySells.length) * 100 : 0,
      realized_pnl_usd: realizedA,
      unrealized_pnl_usd: unrealizedA,
      made_usd: realizedA + unrealizedA,
      deployed_usd: deployed,
      buys: mine.filter((f) => String(f.side || "") === "buy").length,
      last: mine[0] || null,
    };
  });
  return {
    started_usd: startUsd,
    started_sol: startingSol != null ? num(startingSol) : null,
    currently_usd: nowUsd,
    currently_sol: solBalance != null ? num(solBalance) : null,
    cash_usd: usdBalance != null ? num(usdBalance) : null,
    made_usd: madeUsd,
    made_pct: startUsd > 0 && madeUsd != null ? (madeUsd / startUsd) * 100 : null,
    wins: winRows.length,
    losses: lossRows.length,
    trades: sells.length,
    buys: buys.length,
    win_pct: sells.length ? (winRows.length / sells.length) * 100 : 0,
    realized_pnl_usd: realized,
    unrealized_pnl_usd: unrealized,
    holding,
    trade_usd: LIVE_TRADE_USD,
    max_open: LIVE_MAX_OPEN,
    books,
  };
}

export function liveAgentVoice(agent) {
  const a = agent && typeof agent === "object" && agent.id ? agent : liveAgentById(agent) || {};
  const handle = String(a.id || "desk").replace(/-live$/, "");
  const first = String(a.name || "The desk").replace(/\s+LIVE$/i, "");
  return {
    id: a.id || null,
    name: a.name || "LIVE",
    first,
    handle: `@${handle}`,
    color: a.color || "#a3e635",
    style: a.style || "momentum",
    tpPct: a.tpPct ?? 0.1,
  };
}

function moneyTalk(n, sign = false) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  const v = Number(n);
  const abs = Math.abs(v);
  const body = abs >= 10 ? `$${abs.toFixed(0)}` : `$${abs.toFixed(2)}`;
  if (!sign) return v < 0 ? `-${body}` : body;
  return `${v >= 0 ? "+" : "-"}${body}`;
}

function tickSym(sym) {
  const t = String(sym || "").replace(/^\$/, "").toUpperCase();
  return t ? `$${t}` : null;
}

export function writeLiveThesis(agent, coin = {}, safety = {}, size = {}) {
  const voice = liveAgentVoice(agent);
  const t = tickSym(coin.symbol) || "this coin";
  const usd = moneyTalk(size.usd ?? LIVE_TRADE_USD) || `$${LIVE_TRADE_USD.toFixed(2)}`;
  const tpCash = `$${LIVE_TP_USD.toFixed(2)}`;
  const ch1 = coin.change_1h != null ? `${num(coin.change_1h) >= 0 ? "+" : ""}${num(coin.change_1h).toFixed(1)}% this hour` : null;
  const ch24 = coin.change_24h != null ? `${num(coin.change_24h) >= 0 ? "+" : ""}${num(coin.change_24h).toFixed(1)}% on the day` : null;
  let why;
  if (agent?.style === "mean_reversion") {
    why = ch24
      ? `${t} pulled back after ${ch24}. I'm buying the dip on a real book, not the dump.`
      : `${t} pulled back. Tight take, no hero trade.`;
  } else if (agent?.style === "fresh") {
    why = `Young listed pair, depth is real, and it dipped instead of ripping vertical. In after the pullback.`;
  } else {
    why = ch1
      ? `${t} looks like an early runner (${ch1}) and I'm in on the dip, not the high. I'll sell 41% into strength and keep 59% on a short leash.`
      : `I'm clipping ${t} early on a pullback. Sell 41% at +$0.30, keep 59% briefly, then flatten.`;
  }
  const social = hasCommunity(coin) ? " Community's actually posting, not just a paid boost." : "";
  const pump = coin.pump_complete === false ? " Still on the launch tape, but Jupiter will sell it." : "";
  return `${voice.first} just put ${usd} into ${t}. ${why}${social}${pump} I'll sell the whole clip around ${tpCash} — every ${tpCash} adds up.`;
}

export function humanSkipReason(reason) {
  const r = String(reason || "").toLowerCase();
  if (r.includes("cannot sell") || r.includes("honeypot")) return "Jupiter wouldn't give a sell route, so it stays on the sidelines.";
  if (r.includes("dumping")) return "It's dumping. We don't catch falling knives.";
  if (r.includes("topped") || r.includes("don't chase")) return "Looks topped. Waiting for a dip, not the high.";
  if (r.includes("no follow-through")) return "No follow-through. Staying in cash until it actually looks like it will move.";
  if (r.includes("mcap too large")) return "Cap's already huge. We're hunting low-cap tapes we can actually scalp.";
  if (r.includes("mcap too small")) return "Too small. Not worth the heat.";
  if (r.includes("already pumped") || r.includes("already ran")) return "That's a top, not an entry. We wait for a dip.";
  if (r.includes("boosted")) return "That's paid heat, not a real room. Passing.";
  if (r.includes("no social")) return "No community tape. We don't ape boosted ghosts.";
  if (r.includes("thin") || r.includes("liq $")) return "The pool's too thin even for a $1.50 clip.";
  if (r.includes("too new") || (r.includes("only") && r.includes("old"))) return "It's still wet paint.";
  if (r.includes("bonding")) return "Still on the curve. Waiting for a real DEX book.";
  if (r.includes("mint authority")) return "Mint authority is still live. Hard pass.";
  if (r.includes("freeze")) return "Freeze authority is live. Not touching it.";
  if (r.includes("max_open")) return "Already in a trade. One book at a time.";
  if (r.includes("fee_reserve")) return "Keeping SOL back for fees.";
  if (r.includes("stable")) return "That's a stable. We don't clip those.";
  if (r.includes("no_clean")) return "Looked at the tape and stayed in cash.";
  if (r.includes("no_buy_quote")) return "Couldn't get a buy quote. Left it.";
  if (r.includes("rpc_balance") || r.includes("rpc")) return "RPC went dark mid-tick. I'll retry next pass.";
  if (r === "scan" || r.includes("scan")) return "Scanning the 5-minute tape.";
  if (reason) return `Passed — ${String(reason).replace(/_/g, " ")}.`;
  return "Didn't like the book.";
}

export function humanLivePost(row = {}, ctx = {}) {
  const voice = liveAgentVoice(row.agent_id || ctx.agent);
  const who = voice.first || "The desk";
  const t = tickSym(row.symbol);
  const usd = moneyTalk(row.usd);
  const pnl = moneyTalk(row.pnl_usd, true);
  const kind = String(row.kind || row.reason || "").toLowerCase();
  if (kind === "buy") {
    if (row.thesis && /just put/.test(row.thesis)) return row.thesis;
    return `${who} just put ${usd || `$${LIVE_TRADE_USD.toFixed(2)}`} into ${t || "a live book"}. I'll sell 41% around $${LIVE_TP_USD.toFixed(2)} and keep 59% for a short hold.`;
  }
  if (kind === "scale_out" || kind.includes("scale")) {
    return `${who} sold 41% of ${t || "the bag"} into strength. Keeping 59% in for a short hold, then the rest of the clip.`;
  }
  if (kind === "sell" || kind === "take_profit") {
    const won = num(row.pnl_usd) > 0;
    return won
      ? `${who} sold ${t || "the bag"} and booked ${pnl}. Small win, stack it — flattened the whole clip.`
      : `${who} got out of ${t || "the bag"}${pnl ? ` (${pnl})` : ""}. Cut it, don't marry it.`;
  }
  if (kind === "time_stop") {
    return `${who} rotated out of ${t || "the bag"}${pnl ? ` (${pnl})` : ""}. Time's up — next tape.`;
  }
  if (kind === "stop") {
    return `${who} stopped out of ${t || "the bag"}${pnl ? `. ${pnl}` : ""}. The book went against us, so we're cash.`;
  }
  if (kind === "skip") {
    return `${who} passed on ${t || "that name"}. ${humanSkipReason(row.reason)}`;
  }
  if (kind === "swap") {
    return `On-chain swap just landed${t ? ` around ${t}` : ""}. Proof is on Solscan.`;
  }
  if (kind === "fail") {
    return `A swap failed on-chain${t ? ` for ${t}` : ""}. Check the Solscan tx if you want the raw error.`;
  }
  if (kind === "tick") {
    const why = String(row.reason || "").toLowerCase();
    if (why === "scan") return `${who} is scanning the 5-minute tape.`;
    return `${who} looked at the tape and stayed in cash. ${humanSkipReason(row.reason)}`;
  }
  if (row.thesis) return row.thesis;
  return `${who} is on the desk.`;
}

export function enrichLiveFeedRow(row = {}, ctx = {}) {
  const wallet = ctx.wallet || LIVE_WALLET_PUBKEY;
  const voice = liveAgentVoice(row.agent_id);
  const kind = String(row.kind || "tick");
  const text = row.text || humanLivePost(row, ctx);
  return {
    ...row,
    kind,
    text,
    agent_name: voice.name,
    agent_handle: voice.handle,
    agent_color: voice.color,
    solscan_tx: row.signature ? `https://solscan.io/tx/${row.signature}` : null,
    solscan_token: row.mint ? `https://solscan.io/token/${row.mint}` : null,
    solscan_account: `https://solscan.io/account/${wallet}`,
    worldUrl: "https://www.orbitx.world/on-chain",
  };
}

export function buildLiveWorld(opts = {}) {
  return layoutLiveCity({
    wallet: opts.wallet || LIVE_WALLET_PUBKEY,
    agents: opts.agents?.length ? opts.agents : LIVE_AGENTS,
    open: opts.open,
    feed: opts.feed,
    fills: opts.fills,
    ledger: opts.ledger,
    now: opts.now,
  });
}

export function emptyLiveDesk(extra = {}) {
  return {
    ok: true,
    live: true,
    mock: false,
    disclaimer: LIVE_DISCLAIMER,
    wallet: extra.wallet || LIVE_WALLET_PUBKEY,
    enabled: Boolean(extra.enabled),
    armed: Boolean(extra.armed),
    paused: Boolean(extra.paused),
    configured: Boolean(extra.configured),
    trade_usd: LIVE_TRADE_USD,
    max_open: LIVE_MAX_OPEN,
    fee_reserve_sol: LIVE_FEE_RESERVE_SOL,
    sol_usd: extra.sol_usd ?? null,
    sol_balance: extra.sol_balance ?? null,
    usd_balance: extra.usd_balance ?? null,
    equity_usd: extra.equity_usd ?? null,
    realized_pnl_usd: extra.realized_pnl_usd ?? 0,
    starting_usd: extra.starting_usd ?? null,
    starting_sol: extra.starting_sol ?? null,
    ledger: extra.ledger || null,
    open: extra.open || [],
    fills: extra.fills || [],
    agents: extra.agents || LIVE_AGENTS.map((a) => ({ ...a, open: null, last: null, wins: 0, losses: 0 })),
    last_tick_at: extra.last_tick_at || extra.last_activity_at || null,
    last_activity_at: extra.last_activity_at || extra.last_tick_at || null,
    last_error: extra.last_error || null,
    skipped: extra.skipped || null,
    events: extra.events || [],
    chain: extra.chain || [],
    feed: extra.feed || [],
    world:
      extra.world ||
      buildLiveWorld({
        wallet: extra.wallet || LIVE_WALLET_PUBKEY,
        agents: extra.agents,
        open: extra.open,
        feed: extra.feed,
        fills: extra.fills,
        ledger: extra.ledger,
      }),
    worldUrl: "https://www.orbitx.world/on-chain",
    fundUrl: `https://solscan.io/account/${extra.wallet || LIVE_WALLET_PUBKEY}`,
  };
}

export function mergeLiveFeed({ fills = [], events = [], chain = [], wallet = LIVE_WALLET_PUBKEY } = {}) {
  const rows = [];
  for (const f of fills) {
    const side = String(f.side || "buy");
    rows.push({
      id: f.id || `fill-${f.signature || f.created_at}`,
      at: f.created_at,
      kind: side === "sell" ? "sell" : "buy",
      agent_id: f.agent_id || null,
      mint: f.mint || null,
      symbol: f.symbol || null,
      usd: f.usd_amount != null ? num(f.usd_amount) : null,
      pnl_usd: f.pnl_usd != null ? num(f.pnl_usd) : null,
      thesis: f.thesis || null,
      reason: f.reason || side,
      signature: f.signature || null,
      source: "fill",
    });
  }
  for (const e of events) {
    rows.push({
      id: e.id || `evt-${e.created_at}-${e.kind}`,
      at: e.created_at || e.at,
      kind: e.kind || "tick",
      agent_id: e.agent_id || null,
      mint: e.mint || null,
      symbol: e.symbol || null,
      usd: e.usd_amount != null ? num(e.usd_amount) : e.usd != null ? num(e.usd) : null,
      pnl_usd: e.pnl_usd != null ? num(e.pnl_usd) : null,
      thesis: e.thesis || null,
      reason: e.reason || null,
      signature: e.signature || null,
      source: "desk",
    });
  }
  for (const c of chain) {
    rows.push({
      id: c.signature || `chain-${c.slot}`,
      at: c.blockTime ? new Date(num(c.blockTime) * 1000).toISOString() : c.at || null,
      kind: c.err ? "fail" : "swap",
      agent_id: null,
      mint: null,
      symbol: null,
      usd: null,
      pnl_usd: null,
      thesis: null,
      reason: c.err ? "tx_err" : "on-chain swap",
      signature: c.signature || null,
      source: "chain",
    });
  }
  const seen = new Set();
  const out = [];
  for (const row of rows.sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0))) {
    const key = `${row.source}:${row.kind}:${row.signature || row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(enrichLiveFeedRow(row, { wallet }));
  }
  return out.slice(0, 80);
}
