// og-scan-token — server-side OG Scan token scan that returns the SAME data
// and OG composite score the website computes (logic ported 1:1 from
// web/src/lib/og.ts), sourced from the same Jupiter v2 token API. Used by the
// Telegram super bot's /scan so users get site-identical results in chat.
//
// POST { query }  (mint address or ticker/name)
// -> { ok, token: {...}, score: {...}, flags: {...}, verdict }

const JUPITER_BASE = "https://lite-api.jup.ag";
const MIN_OGSCAN_LIQUIDITY_USD = 1_000;

// Canonical OG mints — short-circuit to a perfect score (mirrors og.ts).
const ALL_CANONICAL_MINTS = new Set<string>([
  "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", // FARTCOIN
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
  "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", // TRUMP
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Jt = any;

// ---- date / value helpers (ported) ----
const isoToMs = (raw?: string): number => {
  if (!raw) return Number.POSITIVE_INFINITY;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};
const tokenCreatedAtMs = (t: Jt): number => isoToMs(t.firstMintAt ?? t.onChainCreatedAt);
const tokenPoolCreatedAtMs = (t: Jt): number => {
  const dates = [t.firstPool?.createdAt, ...((t.allPools ?? []).map((p: Jt) => p.createdAt))]
    .map(isoToMs).filter((v: number) => Number.isFinite(v));
  return dates.length ? Math.min(...dates) : Number.POSITIVE_INFINITY;
};
const tokenAthMarketCapUsd = (t: Jt): number => {
  if (t.allTimeHighMarketCap != null && Number.isFinite(t.allTimeHighMarketCap) && t.allTimeHighMarketCap > 0) return t.allTimeHighMarketCap;
  return Math.max(t.mcap ?? 0, t.fdv ?? 0);
};
const tokenEffectiveLiquidityUsd = (t: Jt): number => t.effectiveLiquidityUsd ?? t.liquidity ?? 0;
const tokenReportedLiquidityUsd = (t: Jt): number => t.reportedLiquidity ?? t.liquidity ?? 0;

const isKnownCanonicalMint = (id?: string): boolean => Boolean(id && ALL_CANONICAL_MINTS.has(id));

function isPumpFunToken(t: Jt): boolean {
  if (t.pumpFun?.isPumpFun) return true;
  if (t.id && t.id.toLowerCase().endsWith("pump")) return true;
  if (t.pumpFun?.migrationAt) return false;
  return false;
}

// ---- risk flags (ported) ----
function hasPulledOrDeadLiquidity(t: Jt): boolean {
  const eff = tokenEffectiveLiquidityUsd(t);
  const rep = tokenReportedLiquidityUsd(t);
  const quote = t.quoteLiquidityUsd;
  if (t.lpPulled === true && eff < MIN_OGSCAN_LIQUIDITY_USD) return true;
  if (quote != null && quote < 500 && rep >= 10_000) return true;
  if (eff < MIN_OGSCAN_LIQUIDITY_USD && rep >= 50_000) return true;
  return false;
}
const hasMinimumOgScanLiquidity = (t: Jt): boolean =>
  tokenEffectiveLiquidityUsd(t) >= MIN_OGSCAN_LIQUIDITY_USD && !hasPulledOrDeadLiquidity(t);
const hasUnsafeTokenAuthority = (t: Jt): boolean =>
  t.audit?.mintAuthorityDisabled === false || t.audit?.freezeAuthorityDisabled === false;

// ---- scoring (ported 1:1) ----
function scoreAthMarketCap(athUsd: number): number {
  if (!Number.isFinite(athUsd) || athUsd <= 0) return 0;
  if (athUsd >= 1_000_000_000) return 100;
  if (athUsd >= 200_000_000) return 88;
  if (athUsd >= 50_000_000) return 72;
  if (athUsd >= 10_000_000) return 55;
  if (athUsd >= 1_000_000) return 35;
  if (athUsd >= 100_000) return 18;
  return 5;
}
function scoreAgeRelative(mintMs: number, oldestMs: number): number {
  if (!Number.isFinite(mintMs)) return 20;
  if (!Number.isFinite(oldestMs) || mintMs <= oldestMs) return 100;
  const delayDays = Math.max(0, (mintMs - oldestMs) / 86_400_000);
  if (delayDays <= 0.5) return 100;
  if (delayDays <= 1) return 92;
  if (delayDays <= 7) return 72;
  if (delayDays <= 30) return 50;
  if (delayDays <= 90) return 35;
  if (delayDays <= 180) return 28;
  if (delayDays <= 365) return 18;
  return 10;
}
function scoreHolderProfile(t: Jt): number {
  const count = t.holderCount ?? 0;
  const topPct = t.audit?.topHoldersPercentage ?? t.topHoldersPercent ?? null;
  let countScore = 0;
  if (count >= 100_000) countScore = 60;
  else if (count >= 50_000) countScore = 52;
  else if (count >= 10_000) countScore = 44;
  else if (count >= 5_000) countScore = 36;
  else if (count >= 1_000) countScore = 28;
  else if (count >= 500) countScore = 20;
  else if (count >= 100) countScore = 12;
  else if (count > 0) countScore = 5;
  let distScore = 20;
  if (topPct != null) {
    if (topPct <= 15) distScore = 40;
    else if (topPct <= 25) distScore = 32;
    else if (topPct <= 40) distScore = 22;
    else if (topPct <= 55) distScore = 12;
    else distScore = 4;
  }
  return Math.min(100, countScore + distScore);
}
function scoreDeployPattern(t: Jt): number {
  if (isKnownCanonicalMint(t.id)) return 100;
  if (t.pumpFun?.isPumpFun && !t.pumpFun.migrationAt) return 30;
  if (t.id?.toLowerCase().endsWith("pump") && !t.pumpFun?.migrationAt) return 35;
  let score = 50;
  if (t.isVerified) score += 20;
  if (t.audit?.mintAuthorityDisabled === true) score += 15;
  if (t.audit?.freezeAuthorityDisabled === true) score += 15;
  if (t.pumpFun?.migrationAt) score -= 10;
  return Math.min(100, score);
}
function computeOgCompositeScore(t: Jt, oldestMintMs: number) {
  if (isKnownCanonicalMint(t.id)) {
    return { total: 100, signals: { age: 100, athMcap: 100, holderProfile: 100, deployPattern: 100, poolAge: 100 },
      tripleSourceCreatedAt: t.firstMintAt ?? t.onChainCreatedAt, isPumpFunClone: false };
  }
  const mintMs = tokenCreatedAtMs(t);
  const poolMs = tokenPoolCreatedAtMs(t);
  const athUsd = tokenAthMarketCapUsd(t);
  const pumpClone = isPumpFunToken(t);
  const ageScore = scoreAgeRelative(mintMs, oldestMintMs);
  const athScore = scoreAthMarketCap(athUsd);
  const holderScore = scoreHolderProfile(t);
  const deployScore = scoreDeployPattern(t);
  let poolAgeScore = 20;
  if (Number.isFinite(poolMs)) {
    const d = Math.max(0, (Date.now() - poolMs) / 86_400_000);
    if (d >= 365) poolAgeScore = 100; else if (d >= 180) poolAgeScore = 85;
    else if (d >= 90) poolAgeScore = 68; else if (d >= 30) poolAgeScore = 50;
    else if (d >= 7) poolAgeScore = 35; else poolAgeScore = 18;
  }
  const raw = ageScore * 0.35 + athScore * 0.30 + holderScore * 0.20 + deployScore * 0.10 + poolAgeScore * 0.05;
  const clonePenalty = pumpClone && (Date.now() - mintMs) / 86_400_000 < 90 ? 25 : 0;
  return {
    total: Math.max(0, Math.min(100, Math.round(raw - clonePenalty))),
    signals: {
      age: Math.round(ageScore), athMcap: Math.round(athScore), holderProfile: Math.round(holderScore),
      deployPattern: Math.round(deployScore), poolAge: Math.round(poolAgeScore),
    },
    tripleSourceCreatedAt: t.firstMintAt ?? t.onChainCreatedAt, isPumpFunClone: pumpClone,
  };
}

function verdictFor(total: number, flags: { lpPulled: boolean; unsafeAuthority: boolean }): string {
  if (flags.lpPulled) return "RUG RISK — liquidity pulled/dead";
  if (flags.unsafeAuthority) return "CAUTION — mint/freeze authority still active";
  if (total >= 80) return "STRONG OG";
  if (total >= 60) return "LIKELY OG";
  if (total >= 40) return "MIXED — verify before aping";
  return "WEAK / LIKELY CLONE";
}

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function searchTokens(query: string): Promise<Jt[]> {
  const url = `${JUPITER_BASE}/tokens/v2/search?query=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`Jupiter ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function getSocials(mint: string): Promise<any> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const pairs = (j.pairs || []).slice().sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const p = pairs[0];
    if (!p) return null;
    let x: string | null = null, telegram: string | null = null;
    for (const sc of (p.info?.socials || [])) {
      if (sc.type === "twitter") x = sc.url;
      if (sc.type === "telegram") telegram = sc.url;
    }
    const website = p.info?.websites?.[0]?.url || null;
    const handle = x ? ((x.match(/(?:x|twitter)\.com\/([^/?#]+)/i) || [])[1] || null) : null;
    return {
      x, handle, telegram, website, dexId: p.dexId || null,
      image: p.info?.imageUrl || null,
      banner: p.info?.header || null,
      openGraph: p.info?.openGraph || null,
      priceChange: p.priceChange ? { m5: p.priceChange.m5 ?? null, h1: p.priceChange.h1 ?? null, h6: p.priceChange.h6 ?? null, h24: p.priceChange.h24 ?? null } : null,
    };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { query } = await req.json().catch(() => ({ query: "" }));
    const q = String(query || "").trim();
    if (!q) return json({ ok: false, error: "Provide a mint address or ticker." }, 400);

    const candidates = await searchTokens(q);
    if (!candidates.length) return json({ ok: false, error: `No token found for "${q}".` }, 404);

    // Pick the best candidate (mirrors rankCandidatesByOgScore for the common case):
    // exact mint match wins; otherwise score all and take the highest.
    const oldestMintMs = Math.min(...candidates.map(tokenCreatedAtMs).filter((v) => Number.isFinite(v)));
    let token: Jt;
    if (MINT_RE.test(q)) {
      token = candidates.find((c) => c.id === q) ?? candidates[0];
    } else {
      token = [...candidates].sort((a, b) => {
        const sa = computeOgCompositeScore(a, oldestMintMs).total;
        const sb = computeOgCompositeScore(b, oldestMintMs).total;
        if (sb !== sa) return sb - sa;
        return (b.liquidity ?? 0) - (a.liquidity ?? 0);
      })[0];
    }

    const score = computeOgCompositeScore(token, Number.isFinite(oldestMintMs) ? oldestMintMs : tokenCreatedAtMs(token));
    const flags = {
      lpPulled: hasPulledOrDeadLiquidity(token),
      unsafeAuthority: hasUnsafeTokenAuthority(token),
      minLiquidity: hasMinimumOgScanLiquidity(token),
      mintAuthorityDisabled: token.audit?.mintAuthorityDisabled ?? null,
      freezeAuthorityDisabled: token.audit?.freezeAuthorityDisabled ?? null,
      isVerified: !!token.isVerified,
      isPumpFun: !!(token.pumpFun?.isPumpFun || token.id?.toLowerCase().endsWith("pump")),
      migratedFromPumpFun: !!token.pumpFun?.migrationAt,
    };

    const soc = await getSocials(token.id);
    const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
    let mom = 50;
    const pc24 = Number(token.stats24h?.priceChange);
    if (isFinite(pc24)) mom += clamp(pc24 / 4, -25, 25);
    const bv = Number(token.stats24h?.buyVolume) || 0, sv = Number(token.stats24h?.sellVolume) || 0;
    const br = (bv + sv) > 0 ? bv / (bv + sv) : 0.5;
    mom += br > 0.55 ? 8 : br < 0.45 ? -8 : 0;
    const nb = Number(token.stats24h?.numNetBuyers); if (isFinite(nb)) mom += nb > 0 ? 8 : -8;
    const hc = Number(token.stats24h?.holderChange); if (isFinite(hc)) mom += clamp(hc, -10, 10);
    const liq = tokenEffectiveLiquidityUsd(token) || 0; const vol = bv + sv;
    if (liq > 0) mom += (vol / liq) > 2 ? 6 : (vol / liq) < 0.3 ? -6 : 0;
    const org = Number(token.organicScore); if (isFinite(org)) mom += org > 70 ? 6 : org < 30 ? -6 : 0;
    mom = Math.round(clamp(mom, 0, 100));
    const momLabel = mom >= 75 ? "\uD83D\uDD25 hot" : mom >= 55 ? "warming" : mom >= 40 ? "neutral" : mom >= 25 ? "cooling" : "cold";
    const out = {
      ok: true,
      query: q,
      token: {
        mint: token.id, name: token.name, symbol: token.symbol, icon: token.icon,
        image: token.icon || soc?.image || null,
        banner: soc?.banner || null,
        openGraph: soc?.openGraph || null,
        priceChange5m: token.stats5m?.priceChange ?? soc?.priceChange?.m5 ?? null,
        priceChange1h: token.stats1h?.priceChange ?? soc?.priceChange?.h1 ?? null,
        priceChange6h: soc?.priceChange?.h6 ?? null,
        holderChange1h: token.stats1h?.holderChange ?? null,
        holderChange24h: token.stats24h?.holderChange ?? null,
        netBuyers1h: token.stats1h?.numNetBuyers ?? null,
        netBuyers24h: token.stats24h?.numNetBuyers ?? null,
        organicBuyVol24h: token.stats24h?.buyOrganicVolume ?? null,
        totalSupply: token.totalSupply ?? token.supply ?? null,
        circSupply: token.circSupply ?? null,
        decimals: token.decimals ?? null,
        isVerifiedJup: !!token.isVerified,
        priceUsd: token.usdPrice ?? null, mcap: token.mcap ?? null, fdv: token.fdv ?? null,
        liquidity: tokenEffectiveLiquidityUsd(token) || null,
        holderCount: token.holderCount ?? null,
        topHoldersPct: token.audit?.topHoldersPercentage ?? token.topHoldersPercent ?? null,
        organicScore: token.organicScore ?? null, organicScoreLabel: token.organicScoreLabel ?? null,
        momentum: mom, momentumLabel: momLabel,
        athMcap: tokenAthMarketCapUsd(token) || null,
        priceChange24h: token.stats24h?.priceChange ?? null,
        buyVolume24h: token.stats24h?.buyVolume ?? null, sellVolume24h: token.stats24h?.sellVolume ?? null,
        numTraders24h: token.stats24h?.numTraders ?? null,
        createdAt: token.firstMintAt ?? token.onChainCreatedAt ?? token.pumpFun?.launchAt ?? token.migrationCreatedAt ?? null,
        ageDays: (() => { const ms = tokenCreatedAtMs(token); return Number.isFinite(ms) ? Math.max(0, Math.round((Date.now() - ms) / 86_400_000)) : null; })(),
        poolAgeDays: (() => { const ms = tokenPoolCreatedAtMs(token); return Number.isFinite(ms) ? Math.max(0, Math.round((Date.now() - ms) / 86_400_000)) : null; })(),
        numBuys24h: token.stats24h?.numBuys ?? null,
        numSells24h: token.stats24h?.numSells ?? null,
        txns24h: (token.stats24h?.numBuys != null || token.stats24h?.numSells != null) ? (token.stats24h?.numBuys ?? 0) + (token.stats24h?.numSells ?? 0) : null,
        pairAddress: token.pairAddress ?? token.firstPool?.id ?? null,
        pairDexId: token.pairDexId ?? null,
        dexUrl: token.dexUrl ?? `https://dexscreener.com/solana/${token.id}`,
        pumpFunUrl: `https://pump.fun/coin/${token.id}`,
        socials: soc,
      },
      score, flags,
      verdict: verdictFor(score.total, flags),
    };
    return json(out);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
