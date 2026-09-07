/**
 * Desk verdict + cluster language for orbitx_full_report.
 * Never say "0% bundled" unless pct is 0 AND traced=true.
 * Never output CLEAN when traced=false.
 */

export const TRACE_INCOMPLETE = "NO CLUSTER DETECTED — TRACE INCOMPLETE";
export const DISCLAIMER = "Desk research only. Not financial advice.";
export const VERDICTS = ["CLEAN", "WATCH", "CAUTION", "HIGH RISK", "AVOID", "INSUFFICIENT DATA"];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function clusterReport({ pct, count, clusters, wallets, traced, kind } = {}) {
  const label = String(kind || "cluster");
  const n = num(pct);
  const list = Array.isArray(clusters) ? clusters : Array.isArray(wallets) ? wallets : [];
  const c = count == null || count === "" ? (list.length ? list.length : null) : num(count);
  const empty =
    (c == null || c === 0) &&
    list.length === 0 &&
    (n == null || n === 0);

  if (!traced && empty) {
    return {
      pct: null,
      count: null,
      clusters: [],
      traced: false,
      display: TRACE_INCOMPLETE,
      note: TRACE_INCOMPLETE,
    };
  }

  if (traced && empty && n === 0) {
    return {
      pct: 0,
      count: c ?? 0,
      clusters: [],
      traced: true,
      display: `0% ${label}`,
      note: null,
    };
  }

  return {
    pct: n,
    count: c,
    clusters: list,
    traced: !!traced,
    display: n != null ? `${n}% ${label}` : "UNKNOWN",
    note: traced ? null : "PARTIAL",
  };
}

export function formatBundleLine(cluster) {
  if (!cluster) return "UNKNOWN";
  if (cluster.note === TRACE_INCOMPLETE || cluster.display === TRACE_INCOMPLETE) {
    return TRACE_INCOMPLETE;
  }
  if (cluster.traced === true && cluster.pct === 0) return cluster.display || "0% bundled";
  if (cluster.pct == null) return "UNKNOWN";
  return cluster.display;
}

/** Never claim 0% bundled unless the cluster was traced. */
export function bundledZeroAllowed(cluster) {
  return Boolean(cluster && cluster.traced === true && cluster.pct === 0);
}

export function classifyWalletExit({ remaining, soldSol, boughtSol, realizedUsd, sells } = {}) {
  const rem = num(remaining) || 0;
  const sold = (num(soldSol) || 0) > 0 || (num(sells) || 0) > 0;
  const bought = (num(boughtSol) || 0) > 0;
  const pnl = num(realizedUsd);
  if (rem > 1e-9) {
    if (sold) return "PARTIAL EXIT";
    return "STILL HOLDING";
  }
  if (sold || bought) {
    if (pnl == null) return "EXITED";
    if (pnl > 0) return "EXITED PROFIT";
    if (pnl < 0) return "EXITED LOSS";
    return "EXITED";
  }
  return "STILL HOLDING";
}

function confidenceOf({ tokenOk, traced, safetyOk, walletPartial, gaps }) {
  const g = Array.isArray(gaps) ? gaps.length : 0;
  if (!tokenOk) return "low";
  if (traced && safetyOk && g <= 2 && !walletPartial) return "high";
  if (tokenOk && g <= 6) return "medium";
  return "low";
}

/**
 * Desk verdict rules (spec):
 * AVOID = cannot sell / mint open + silent dev + high bundle + unlocked LP
 * HIGH RISK = bundle/insider >20% OR dev dumped thin liq OR top10 ex-LP >50%
 * CAUTION = sellable + authorities off, but new / unlocked LP / exited dev / incomplete trace
 * WATCH = cleaner, still early
 * CLEAN = traced 0% bundle + authorities off + LP locked + dev known and not dumped
 * Never CLEAN if traced=false
 */
export function computeVerdict(ctx = {}) {
  const tokenOk = Boolean(ctx.tokenOk);
  if (!tokenOk) {
    return {
      verdict: "INSUFFICIENT DATA",
      confidence: "low",
      reasons: ["Token snapshot missing or failed."],
    };
  }

  const traced = ctx.traced === true;
  const canSell = ctx.canSell;
  const canBuy = ctx.canBuy;
  const mintOpen = ctx.mintOpen === true;
  const freezeOpen = ctx.freezeOpen === true;
  const authoritiesOff = ctx.authoritiesOff === true && !mintOpen && !freezeOpen;
  const silentDev = ctx.silentDev === true;
  const lpUnlocked = ctx.lpUnlocked === true;
  const lpLocked = ctx.lpLocked === true;
  const bundlePct = num(ctx.bundlePct);
  const insiderPct = num(ctx.insiderPct);
  const top10ExLp = num(ctx.top10ExLp);
  const ageHours = num(ctx.ageHours);
  const devKnown = ctx.devKnown === true;
  const devDumped = ctx.devDumped === true;
  const thinLiq = ctx.thinLiq === true;
  const highBundle = traced && ((bundlePct != null && bundlePct > 20) || (insiderPct != null && insiderPct > 20));
  const bundleZero = traced && bundlePct === 0;
  const reasons = [];

  if (canSell === false) {
    reasons.push("No sell route (cannot sell).");
    if (mintOpen) reasons.push("Mint authority still open.");
    if (silentDev) reasons.push("Dev is silent / unknown.");
    if (highBundle) reasons.push("High bundle or insider share.");
    if (lpUnlocked) reasons.push("LP unlocked.");
    return {
      verdict: "AVOID",
      confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps }),
      reasons,
    };
  }

  if (mintOpen && silentDev && highBundle && lpUnlocked) {
    reasons.push("Mint open, silent dev, high bundle/insider, unlocked LP.");
    return {
      verdict: "AVOID",
      confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps }),
      reasons,
    };
  }

  if (highBundle) {
    reasons.push(
      `Bundle/insider share ${[bundlePct, insiderPct].filter((n) => n != null).map((n) => `${n}%`).join(" / ")} > 20%.`,
    );
    return {
      verdict: "HIGH RISK",
      confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps }),
      reasons,
    };
  }
  if (devDumped && thinLiq) {
    reasons.push("Dev dumped into thin liquidity.");
    return {
      verdict: "HIGH RISK",
      confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps }),
      reasons,
    };
  }
  if (top10ExLp != null && top10ExLp > 50) {
    reasons.push(`Top 10 wallets (ex-LP) hold ${top10ExLp}% of supply.`);
    return {
      verdict: "HIGH RISK",
      confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps }),
      reasons,
    };
  }

  if (traced && bundleZero && authoritiesOff && lpLocked && devKnown && !devDumped) {
    reasons.push("Traced 0% bundle, authorities off, LP locked, known dev still in.");
    return {
      verdict: "CLEAN",
      confidence: "high",
      reasons,
    };
  }

  const early = ageHours != null && ageHours < 72;
  const incomplete = !traced;
  const cautionBits = [];
  if (early) cautionBits.push("new");
  if (lpUnlocked) cautionBits.push("unlocked LP");
  if (devDumped) cautionBits.push("exited dev");
  if (incomplete) cautionBits.push("incomplete trace");
  if (canBuy === false) cautionBits.push("no buy route");
  if (mintOpen || freezeOpen) cautionBits.push("authority still active");

  const sellable = canSell !== false;
  const cleaner =
    sellable &&
    authoritiesOff &&
    (!highBundle) &&
    (bundlePct == null || bundlePct <= 5 || !traced) &&
    !devDumped;

  if (sellable && authoritiesOff && cautionBits.length && !(cleaner && early && traced && bundlePct != null && bundlePct <= 5 && !lpUnlocked)) {
    reasons.push(`Sellable, authorities off, but ${cautionBits.join(" / ")}.`);
    return {
      verdict: "CAUTION",
      confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps, walletPartial: ctx.walletPartial }),
      reasons,
    };
  }

  if (cleaner && early) {
    reasons.push("Cleaner tape, still early.");
    return {
      verdict: "WATCH",
      confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps }),
      reasons,
    };
  }

  if (cleaner) {
    reasons.push("Sellable and authorities off; not all CLEAN criteria met.");
    return {
      verdict: "WATCH",
      confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps }),
      reasons,
    };
  }

  reasons.push(incomplete ? "Trace incomplete." : "Residual risk signals.");
  return {
    verdict: "CAUTION",
    confidence: confidenceOf({ tokenOk, traced, safetyOk: ctx.safetyOk, gaps: ctx.gaps, walletPartial: ctx.walletPartial }),
    reasons,
  };
}

export function assertNeverCleanIfUntraced(verdict, traced) {
  if (verdict === "CLEAN" && traced !== true) return "CAUTION";
  return verdict;
}
