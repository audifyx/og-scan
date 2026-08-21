/**
 * OrbitX Token Intelligence Score — single authoritative engine.
 *
 * Safety is evidence-based and contextual. Maturity is independent.
 * Missing data reduces confidence; it does not invent risk.
 *
 * Keep this file free of Node/Deno-only APIs so it can run in Vite, Vercel,
 * Vitest, and Supabase Edge (copy under supabase/functions/_shared).
 */

export const SCORING_CONFIG = {
  categoryMax: {
    contract: 25,
    liquidity: 20,
    holders: 15,
    developer: 15,
    trading: 10,
    maturity: 5,
  },
  qualityWeights: {
    safety: 0.45,
    market: 0.2,
    holders: 0.15,
    developer: 0.1,
    organic: 0.1,
  },
  bands: [
    { min: 90, label: "Excellent", risk: "low" },
    { min: 80, label: "Strong", risk: "low" },
    { min: 70, label: "Good", risk: "moderate" },
    { min: 60, label: "Fair", risk: "moderate" },
    { min: 40, label: "Risky", risk: "elevated" },
    { min: 20, label: "High Risk", risk: "high" },
    { min: 0, label: "Critical", risk: "critical" },
  ],
  criticalCaps: {
    honeypot: 20,
    rugged: 15,
    malicious_hook: 20,
    malicious_deployer: 25,
    lp_rug_setup: 30,
    coordinated_dump: 25,
    unsellable: 20,
  },
  /** Contextual ratios — never used as "below $X = scam". */
  ratios: {
    liqMcapHealthy: 0.12,
    liqMcapOk: 0.05,
    liqMcapThin: 0.02,
    volLiqOrganicLow: 0.15,
    volLiqWashHigh: 8,
    youngHours: 24,
    earlyDays: 7,
  },
  knownWallets: {
    "1nc1nerator11111111111111111111111111111111": "burn",
    "11111111111111111111111111111111": "burn",
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j": "lp",
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin": "lp",
    Gq7AGMfQYg8YfPwLQVbNzWoBSWmJ4YMmYUMfkpfmXyVL: "lp",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "protocol",
    "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg": "lp",
    "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": "exchange",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "exchange",
    H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS: "exchange",
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": "exchange",
    AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2: "exchange",
    GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE: "exchange",
    ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ: "exchange",
    "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD": "exchange",
    u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w: "exchange",
  },
  infraRoles: ["lp", "burn", "treasury", "exchange", "protocol", "bridge", "amm", "launchpad"],
};

const INFRA = new Set(SCORING_CONFIG.infraRoles);
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, lo = 0, hi = 100) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function nowMs(input) {
  return num(input?.nowMs) || Date.now();
}

function classifyWallet(address, role) {
  if (role && INFRA.has(String(role).toLowerCase())) return String(role).toLowerCase();
  if (!address) return "unknown";
  const known = SCORING_CONFIG.knownWallets[address];
  if (known) return known;
  const label = String(role || "").toLowerCase();
  if (label.includes("burn")) return "burn";
  if (label.includes("liquid") || label === "amm" || label.includes("pool")) return "lp";
  if (label.includes("treasury")) return "treasury";
  if (label.includes("exchange") || label.includes("cex")) return "exchange";
  if (label.includes("deploy") || label.includes("creator") || label.includes("dev")) return "deployer";
  return "unknown";
}

function isInfraRole(role) {
  return INFRA.has(role);
}

function bandFor(score) {
  const n = num(score);
  if (n == null) return { min: 0, label: "Unknown", risk: "unknown" };
  return SCORING_CONFIG.bands.find((b) => n >= b.min) || SCORING_CONFIG.bands[SCORING_CONFIG.bands.length - 1];
}

function signal({
  name,
  category,
  status,
  severity = "info",
  points = 0,
  explanation,
  evidence = {},
  confidence = "HIGH_CONFIDENCE",
  group = null,
  timestamp = null,
}) {
  return {
    name,
    category,
    status,
    severity,
    points,
    explanation,
    evidence,
    confidence,
    group,
    timestamp: timestamp || new Date().toISOString(),
  };
}

function mergeConfidence(values) {
  const rank = { VERIFIED: 5, HIGH_CONFIDENCE: 4, PARTIAL: 3, STALE: 2, UNKNOWN: 1 };
  let worst = "VERIFIED";
  let seen = false;
  for (const c of values) {
    if (!c) continue;
    seen = true;
    if ((rank[c] || 0) < (rank[worst] || 0)) worst = c;
  }
  return seen ? worst : "UNKNOWN";
}

function applyGrouped(items) {
  const byGroup = new Map();
  const out = [];
  for (const item of items) {
    if (!item.group) {
      out.push(item);
      continue;
    }
    const cur = byGroup.get(item.group);
    if (!cur || Math.abs(item.points) > Math.abs(cur.points)) byGroup.set(item.group, item);
  }
  return [...out, ...byGroup.values()];
}

function falsePositiveGuard(ctx) {
  return {
    isInfra: isInfraRole(ctx.role),
    isLp: ctx.role === "lp",
    isBurn: ctx.role === "burn",
    isTreasury: ctx.role === "treasury",
    isExchange: ctx.role === "exchange",
    isMultisig: ctx.authorityKind === "multisig" || ctx.authorityKind === "program",
    expectedForAge: ctx.ageHours != null && ctx.ageHours < SCORING_CONFIG.ratios.youngHours,
    verified: ctx.confidence === "VERIFIED" || ctx.confidence === "HIGH_CONFIDENCE",
    unknown: !ctx.confidence || ctx.confidence === "UNKNOWN" || ctx.confidence === "PARTIAL",
  };
}

function categoryResult(id, max, signals, opts = {}) {
  const usable = signals.filter((s) => s.status !== "unavailable");
  if (!usable.length && !opts.force) {
    return {
      id,
      available: false,
      points: null,
      max,
      normalized: null,
      confidence: "UNKNOWN",
      signals: signals,
    };
  }
  const grouped = applyGrouped(usable);
  const start = opts.neutral != null ? opts.neutral : max * 0.64;
  const delta = grouped.reduce((s, x) => s + (Number(x.points) || 0), 0);
  const points = clamp(start + delta, 0, max);
  return {
    id,
    available: true,
    points: round1(points),
    max,
    normalized: Math.round((points / max) * 100),
    confidence: mergeConfidence(grouped.map((s) => s.confidence)),
    signals: grouped,
  };
}

function maturityBand(ageMs) {
  if (!Number.isFinite(ageMs) || ageMs < 0) return null;
  const hours = ageMs / MS_HOUR;
  const days = ageMs / MS_DAY;
  if (hours < 1) return { label: "Very New", score: 8, hours, days };
  if (hours < 6) return { label: "Very New", score: 14, hours, days };
  if (hours < 24) return { label: "Early", score: 22, hours, days };
  if (days < 3) return { label: "Early", score: 32, hours, days };
  if (days < 7) return { label: "Early", score: 42, hours, days };
  if (days < 30) return { label: "Developing", score: 55, hours, days };
  if (days < 90) return { label: "Developing", score: 68, hours, days };
  if (days < 180) return { label: "Established", score: 80, hours, days };
  if (days < 365) return { label: "Established", score: 88, hours, days };
  return { label: "Established", score: 96, hours, days };
}

function economicHolders(input) {
  const rows = Array.isArray(input.holders) ? input.holders : [];
  const mapped = rows
    .map((h) => {
      const pct = num(h.pct ?? h.percentage ?? h.uiAmount);
      const address = h.address || h.owner || h.wallet || null;
      const role = classifyWallet(address, h.role || h.label || h.kind);
      return { address, pct, role };
    })
    .filter((h) => h.pct != null && h.pct > 0);
  const infra = mapped.filter((h) => isInfraRole(h.role));
  const economic = mapped.filter((h) => !isInfraRole(h.role));
  const top = (n) => economic.slice(0, n).reduce((s, h) => s + h.pct, 0);
  return {
    mapped,
    infra,
    economic,
    top1: economic[0] || null,
    top1Pct: economic[0]?.pct ?? null,
    top5Pct: economic.length ? top(5) : null,
    top10Pct: economic.length ? top(10) : null,
    top20Pct: economic.length ? top(20) : null,
  };
}

function scoreContract(input) {
  const max = SCORING_CONFIG.categoryMax.contract;
  const signals = [];
  const mintActive = input.mintAuthorityActive;
  const freezeActive = input.freezeAuthorityActive;
  const hasAuth =
    mintActive != null ||
    freezeActive != null ||
    input.updateAuthorityActive != null ||
    input.metadataMutable != null ||
    input.tokenProgram != null ||
    input.extensions;

  if (!hasAuth) {
    signals.push(
      signal({
        name: "authorities_unknown",
        category: "contract",
        status: "unavailable",
        explanation: "Mint/freeze/extension data unavailable.",
        confidence: "UNKNOWN",
      }),
    );
    return categoryResult("contract", max, signals);
  }

  if (mintActive === false) {
    signals.push(
      signal({
        name: "mint_revoked",
        category: "contract",
        status: "positive",
        severity: "info",
        points: 4.2,
        explanation: "Mint authority revoked — supply cannot be inflated.",
        evidence: { mintAuthority: input.mintAuthorityAddress || null },
        confidence: "VERIFIED",
      }),
    );
  } else if (mintActive === true) {
    const kind = input.mintAuthorityKind || "unknown";
    const guard = falsePositiveGuard({ authorityKind: kind, confidence: "HIGH_CONFIDENCE" });
    const malicious = input.maliciousMinting === true;
    let pts = -3.5;
    let severity = "medium";
    let explanation = `Mint authority is active (${kind}). This is a capability, not proof of abuse.`;
    if (malicious) {
      pts = -12;
      severity = "critical";
      explanation = "Mint authority is active and malicious minting has been observed.";
    } else if (guard.isMultisig) {
      pts = -1.5;
      severity = "low";
      explanation = "Mint authority is held by a program/multisig. Dilution is possible but not a confirmed exploit.";
    }
    signals.push(
      signal({
        name: malicious ? "mint_malicious" : "mint_active",
        category: "contract",
        status: malicious ? "critical" : "concern",
        severity,
        points: pts,
        explanation,
        evidence: { mintAuthority: input.mintAuthorityAddress || null, kind },
        confidence: malicious ? "VERIFIED" : "HIGH_CONFIDENCE",
        group: "mint_authority",
      }),
    );
  }

  if (freezeActive === false) {
    signals.push(
      signal({
        name: "freeze_revoked",
        category: "contract",
        status: "positive",
        severity: "info",
        points: 3.4,
        explanation: "Freeze authority revoked — wallets cannot be frozen.",
        confidence: "VERIFIED",
      }),
    );
  } else if (freezeActive === true) {
    const used = input.freezeUsed === true;
    signals.push(
      signal({
        name: used ? "freeze_used" : "freeze_active",
        category: "contract",
        status: used ? "risk" : "concern",
        severity: used ? "high" : "medium",
        points: used ? -8 : -4.5,
        explanation: used
          ? "Freeze authority is active and has been used. Wallets can be locked."
          : "Freeze authority is active. This is a real capability risk, but there is no verified freeze event.",
        evidence: { freezeAuthority: input.freezeAuthorityAddress || null },
        confidence: "VERIFIED",
        group: "freeze_authority",
      }),
    );
  }

  if (input.metadataMutable === false) {
    signals.push(
      signal({
        name: "metadata_immutable",
        category: "contract",
        status: "positive",
        points: 1.4,
        explanation: "Metadata is immutable.",
        confidence: "HIGH_CONFIDENCE",
      }),
    );
  } else if (input.metadataMutable === true) {
    signals.push(
      signal({
        name: "metadata_mutable",
        category: "contract",
        status: "info",
        severity: "low",
        points: -0.6,
        explanation: "Metadata is mutable. Common for meme coins; not treated as malice.",
        confidence: "HIGH_CONFIDENCE",
        group: "metadata",
      }),
    );
  }

  const ext = input.extensions || {};
  const is2022 = String(input.tokenProgram || "").toLowerCase().includes("2022");
  if (is2022 && !ext.transferHook && !ext.permanentDelegate && !ext.nonTransferable && !ext.defaultAccountState) {
    signals.push(
      signal({
        name: "token2022_benign",
        category: "contract",
        status: "positive",
        points: 0.8,
        explanation: "Token-2022 with no dangerous extensions detected.",
        confidence: "HIGH_CONFIDENCE",
      }),
    );
  }
  if (ext.transferHook) {
    const malicious = ext.transferHookMalicious === true;
    signals.push(
      signal({
        name: malicious ? "malicious_transfer_hook" : "transfer_hook",
        category: "contract",
        status: malicious ? "critical" : "concern",
        severity: malicious ? "critical" : "high",
        points: malicious ? -14 : -6,
        explanation: malicious
          ? "Malicious transfer hook can block sells or steal funds."
          : "Transfer hook present. Inspect the program — not automatically malicious.",
        evidence: { program: ext.transferHookProgram || null },
        confidence: malicious ? "VERIFIED" : "PARTIAL",
        group: "transfer_restriction",
      }),
    );
  }
  if (ext.permanentDelegate) {
    signals.push(
      signal({
        name: "permanent_delegate",
        category: "contract",
        status: "risk",
        severity: "high",
        points: -8,
        explanation: "Permanent delegate can move tokens without owner approval.",
        confidence: "VERIFIED",
        group: "transfer_restriction",
      }),
    );
  }
  if (ext.nonTransferable) {
    signals.push(
      signal({
        name: "non_transferable",
        category: "contract",
        status: "critical",
        severity: "critical",
        points: -16,
        explanation: "Token is configured as non-transferable.",
        confidence: "VERIFIED",
        group: "transfer_restriction",
      }),
    );
  }
  const feeBps = num(ext.transferFeeBps);
  if (feeBps != null && feeBps > 0) {
    const severe = feeBps >= 1000;
    signals.push(
      signal({
        name: "transfer_fee",
        category: "contract",
        status: severe ? "risk" : "info",
        severity: severe ? "high" : "low",
        points: severe ? -7 : feeBps >= 300 ? -3 : -1,
        explanation: `Transfer fee ${(feeBps / 100).toFixed(2)}%.`,
        evidence: { transferFeeBps: feeBps },
        confidence: "VERIFIED",
        group: "transfer_restriction",
      }),
    );
  }
  if (ext.defaultAccountState === "frozen") {
    signals.push(
      signal({
        name: "default_frozen",
        category: "contract",
        status: "risk",
        severity: "high",
        points: -8,
        explanation: "Default account state is frozen.",
        confidence: "VERIFIED",
        group: "freeze_authority",
      }),
    );
  }

  return categoryResult("contract", max, signals);
}

function scoreLiquidity(input) {
  const max = SCORING_CONFIG.categoryMax.liquidity;
  const signals = [];
  const liq = num(input.liquidityUsd);
  const mcap = num(input.marketCapUsd);
  const vol = num(input.volume24h);
  const ageMs = num(input.ageMs);
  const ageHours = ageMs != null ? ageMs / MS_HOUR : null;

  if (liq == null && input.canSell == null && input.lpBurned == null && input.lpLocked == null) {
    signals.push(
      signal({
        name: "liquidity_unknown",
        category: "liquidity",
        status: "unavailable",
        explanation: "Liquidity data unavailable.",
        confidence: "UNKNOWN",
      }),
    );
    return categoryResult("liquidity", max, signals);
  }

  if (liq != null && mcap != null && mcap > 0) {
    const ratio = liq / mcap;
    const young = ageHours != null && ageHours < SCORING_CONFIG.ratios.youngHours;
    if (ratio >= SCORING_CONFIG.ratios.liqMcapHealthy) {
      signals.push(
        signal({
          name: "healthy_liq_mcap",
          category: "liquidity",
          status: "positive",
          points: 5.5,
          explanation: `Liquidity is ${(ratio * 100).toFixed(1)}% of market cap — healthy for this size.`,
          evidence: { liquidityUsd: liq, marketCapUsd: mcap, ratio },
          confidence: "HIGH_CONFIDENCE",
          group: "liq_mcap",
        }),
      );
    } else if (ratio >= SCORING_CONFIG.ratios.liqMcapOk) {
      signals.push(
        signal({
          name: "ok_liq_mcap",
          category: "liquidity",
          status: "positive",
          points: 2.2,
          explanation: `Liquidity is ${(ratio * 100).toFixed(1)}% of market cap — acceptable, especially for a meme coin.`,
          evidence: { liquidityUsd: liq, marketCapUsd: mcap, ratio },
          confidence: "HIGH_CONFIDENCE",
          group: "liq_mcap",
        }),
      );
    } else if (ratio >= SCORING_CONFIG.ratios.liqMcapThin) {
      signals.push(
        signal({
          name: "thin_liq_mcap",
          category: "liquidity",
          status: young ? "info" : "concern",
          severity: young ? "info" : "low",
          points: young ? -0.4 : -2.2,
          explanation: young
            ? `Liquidity/mcap is ${(ratio * 100).toFixed(1)}% — expected for a very new pool.`
            : `Liquidity is only ${(ratio * 100).toFixed(1)}% of market cap.`,
          evidence: { liquidityUsd: liq, marketCapUsd: mcap, ratio },
          confidence: "HIGH_CONFIDENCE",
          group: "liq_mcap",
        }),
      );
    } else {
      signals.push(
        signal({
          name: "exit_liq_thin",
          category: "liquidity",
          status: "risk",
          severity: "high",
          points: -6.5,
          explanation: `$${Math.round(liq).toLocaleString()} liquidity vs $${Math.round(mcap).toLocaleString()} mcap (${(ratio * 100).toFixed(2)}%) is a real exit-risk mismatch.`,
          evidence: { liquidityUsd: liq, marketCapUsd: mcap, ratio },
          confidence: "HIGH_CONFIDENCE",
          group: "liq_mcap",
        }),
      );
    }
  } else if (liq != null) {
    signals.push(
      signal({
        name: "liquidity_observed",
        category: "liquidity",
        status: "info",
        points: 1.2,
        explanation: `Liquidity observed at $${Math.round(liq).toLocaleString()}. Market cap missing, so no size-relative penalty is applied.`,
        evidence: { liquidityUsd: liq },
        confidence: "PARTIAL",
      }),
    );
  }

  if (liq != null && vol != null && liq > 0) {
    const vl = vol / liq;
    if (vl >= 0.4 && vl <= 3.5) {
      signals.push(
        signal({
          name: "healthy_vol_liq",
          category: "liquidity",
          status: "positive",
          points: 1.6,
          explanation: `24h volume is ${vl.toFixed(2)}× liquidity — consistent with real trading.`,
          evidence: { volume24h: vol, liquidityUsd: liq, ratio: vl },
          confidence: "HIGH_CONFIDENCE",
          group: "vol_liq",
        }),
      );
    } else if (vl > SCORING_CONFIG.ratios.volLiqWashHigh) {
      signals.push(
        signal({
          name: "vol_liq_spike",
          category: "liquidity",
          status: "concern",
          severity: "medium",
          points: -2,
          explanation: `Volume/liquidity ${vl.toFixed(1)}× is unusually high and needs organic-trader confirmation.`,
          evidence: { volume24h: vol, liquidityUsd: liq, ratio: vl },
          confidence: "PARTIAL",
          group: "vol_liq",
        }),
      );
    }
  }

  if (input.lpBurned === true || (num(input.lpLockedPct) != null && input.lpLockedPct >= 95)) {
    signals.push(
      signal({
        name: "lp_burned_or_locked",
        category: "liquidity",
        status: "positive",
        points: 4.5,
        explanation: input.lpBurned ? "LP is burned." : `~${Math.round(input.lpLockedPct)}% of LP appears locked.`,
        confidence: "VERIFIED",
        group: "lp_exit",
      }),
    );
  } else if (input.lpLocked === true && num(input.lpLockedPct) != null && input.lpLockedPct >= 50) {
    signals.push(
      signal({
        name: "lp_partial_lock",
        category: "liquidity",
        status: "positive",
        points: 2,
        explanation: `~${Math.round(input.lpLockedPct)}% of LP is locked.`,
        confidence: "HIGH_CONFIDENCE",
        group: "lp_exit",
      }),
    );
  } else if (input.lpOwnerIsDeployer === true && input.lpBurned !== true && input.lpLocked !== true) {
    signals.push(
      signal({
        name: "lp_deployer_unlocked",
        category: "liquidity",
        status: "risk",
        severity: "high",
        points: -7,
        explanation: "Deployer still controls unlocked LP and can remove liquidity immediately.",
        confidence: "HIGH_CONFIDENCE",
        group: "lp_exit",
      }),
    );
  } else if (input.lpLocked === false && input.lpBurned === false) {
    signals.push(
      signal({
        name: "lp_unlocked",
        category: "liquidity",
        status: "concern",
        severity: "medium",
        points: -2.4,
        explanation: "LP is not burned or locked. This is a capability risk, not a confirmed rug.",
        confidence: "HIGH_CONFIDENCE",
        group: "lp_exit",
      }),
    );
  }

  if (input.canSell === true || input.sellSuccessObserved === true) {
    signals.push(
      signal({
        name: "sell_route_ok",
        category: "liquidity",
        status: "positive",
        points: 2.8,
        explanation: "Sell route is available / successful sells observed.",
        confidence: "VERIFIED",
        group: "trade_route",
      }),
    );
  } else if (input.canSell === false) {
    signals.push(
      signal({
        name: "cannot_sell",
        category: "liquidity",
        status: "critical",
        severity: "critical",
        points: -16,
        explanation: "No sell route — confirmed honeypot / unsellable.",
        confidence: "VERIFIED",
        group: "trade_route",
      }),
    );
  }

  const rt = num(input.roundTripLossPct);
  if (rt != null && rt >= 35) {
    signals.push(
      signal({
        name: "extreme_round_trip",
        category: "liquidity",
        status: "critical",
        severity: "critical",
        points: -12,
        explanation: `Round trip loses ~${rt.toFixed(0)}% (tax / impact) — economically unsellable.`,
        evidence: { roundTripLossPct: rt },
        confidence: "HIGH_CONFIDENCE",
        group: "trade_route",
      }),
    );
  } else if (rt != null && rt >= 15) {
    signals.push(
      signal({
        name: "elevated_round_trip",
        category: "liquidity",
        status: "concern",
        severity: "medium",
        points: -2.5,
        explanation: `Round trip costs ~${rt.toFixed(0)}%.`,
        evidence: { roundTripLossPct: rt },
        confidence: "HIGH_CONFIDENCE",
        group: "trade_route",
      }),
    );
  }

  if (input.canBuy === true) {
    signals.push(
      signal({
        name: "buy_route_ok",
        category: "liquidity",
        status: "positive",
        points: 0.8,
        explanation: "Buy route is available.",
        confidence: "HIGH_CONFIDENCE",
        group: "buy_route",
      }),
    );
  } else if (input.canBuy === false) {
    signals.push(
      signal({
        name: "no_buy_route",
        category: "liquidity",
        status: "concern",
        severity: "medium",
        points: -3,
        explanation: "No buy route found.",
        confidence: "HIGH_CONFIDENCE",
        group: "buy_route",
      }),
    );
  }

  const pools = num(input.poolCount);
  if (pools != null && pools >= 2) {
    signals.push(
      signal({
        name: "multiple_pools",
        category: "liquidity",
        status: "positive",
        points: 0.6,
        explanation: `${pools} active pools.`,
        confidence: "HIGH_CONFIDENCE",
      }),
    );
  }

  return categoryResult("liquidity", max, signals);
}

function scoreHolders(input) {
  const max = SCORING_CONFIG.categoryMax.holders;
  const signals = [];
  const dist = economicHolders(input);
  const rawTop = dist.mapped[0] || null;
  const top10 = num(input.top10PctEconomic) ?? dist.top10Pct ?? num(input.top10Pct);
  const top1 = num(input.top1PctEconomic) ?? dist.top1Pct ?? num(input.top1Pct);
  const deployerPct = num(input.deployerPct);
  const growth = num(input.holderGrowthPct);
  const hasDist = top10 != null || top1 != null || deployerPct != null || dist.mapped.length > 0;

  if (!hasDist && input.holderCount == null) {
    signals.push(
      signal({
        name: "holders_unknown",
        category: "holders",
        status: "unavailable",
        explanation: "Holder distribution unavailable.",
        confidence: "UNKNOWN",
      }),
    );
    return categoryResult("holders", max, signals);
  }

  if (input.holderCount != null) {
    signals.push(
      signal({
        name: "holder_count_context",
        category: "holders",
        status: "info",
        points: 0,
        explanation: `${Math.round(input.holderCount).toLocaleString()} holders observed. Count is context, not a risk grade.`,
        evidence: { holderCount: input.holderCount },
        confidence: "HIGH_CONFIDENCE",
      }),
    );
  }

  const top1Role = rawTop?.role || dist.top1?.role || classifyWallet(rawTop?.address || dist.top1?.address, null);
  if (rawTop && isInfraRole(rawTop.role || top1Role)) {
    signals.push(
      signal({
        name: "top_holder_infrastructure",
        category: "holders",
        status: "positive",
        points: 1.2,
        explanation: `Largest wallet is ${rawTop.role || top1Role} infrastructure, not an insider whale.`,
        evidence: { pct: rawTop.pct, role: rawTop.role || top1Role, address: rawTop.address || null },
        confidence: "HIGH_CONFIDENCE",
        group: "concentration",
      }),
    );
  } else if (top1 != null && isInfraRole(top1Role)) {
    signals.push(
      signal({
        name: "top_holder_infrastructure",
        category: "holders",
        status: "info",
        points: 1.2,
        explanation: `Largest wallet is ${top1Role} infrastructure, not an insider whale.`,
        evidence: { pct: top1, role: top1Role, address: dist.top1?.address || null },
        confidence: "HIGH_CONFIDENCE",
        group: "concentration",
      }),
    );
  } else if (deployerPct != null && deployerPct >= 15) {
    const severe = deployerPct >= 40;
    signals.push(
      signal({
        name: "deployer_concentration",
        category: "holders",
        status: severe ? "risk" : "concern",
        severity: severe ? "high" : "medium",
        points: severe ? -6.5 : -3.2,
        explanation: `Deployer still holds ${deployerPct.toFixed(1)}% of supply (economic wallets only).`,
        evidence: { deployerPct },
        confidence: "HIGH_CONFIDENCE",
        group: "concentration",
      }),
    );
  } else if (top10 != null) {
    if (top10 <= 35) {
      signals.push(
        signal({
          name: "diverse_holders",
          category: "holders",
          status: "positive",
          points: 3.8,
          explanation: `Top 10 economic holders control ~${top10.toFixed(0)}%.`,
          evidence: { top10Pct: top10 },
          confidence: "HIGH_CONFIDENCE",
          group: "concentration",
        }),
      );
    } else if (top10 <= 55) {
      signals.push(
        signal({
          name: "moderate_concentration",
          category: "holders",
          status: "info",
          points: 0.6,
          explanation: `Top 10 economic holders control ~${top10.toFixed(0)}% — typical for early meme coins.`,
          evidence: { top10Pct: top10 },
          confidence: "HIGH_CONFIDENCE",
          group: "concentration",
        }),
      );
    } else if (top10 <= 75) {
      signals.push(
        signal({
          name: "elevated_concentration",
          category: "holders",
          status: "concern",
          severity: "medium",
          points: -2.8,
          explanation: `Top 10 economic holders control ~${top10.toFixed(0)}%.`,
          evidence: { top10Pct: top10 },
          confidence: "HIGH_CONFIDENCE",
          group: "concentration",
        }),
      );
    } else {
      signals.push(
        signal({
          name: "extreme_insider_concentration",
          category: "holders",
          status: input.deployerDumping ? "critical" : "risk",
          severity: input.deployerDumping ? "critical" : "high",
          points: input.deployerDumping ? -8 : -5.5,
          explanation: `Top 10 economic holders control ~${top10.toFixed(0)}%${input.deployerDumping ? " and dumping is observed." : "."}`,
          evidence: { top10Pct: top10 },
          confidence: "HIGH_CONFIDENCE",
          group: "concentration",
        }),
      );
    }
  }

  if (growth != null && growth > 5) {
    signals.push(
      signal({
        name: "holder_growth",
        category: "holders",
        status: "positive",
        points: 1.8,
        explanation: `Holder count increased ${growth.toFixed(1)}%.`,
        evidence: { holderGrowthPct: growth },
        confidence: "HIGH_CONFIDENCE",
      }),
    );
  }

  return categoryResult("holders", max, signals);
}

function scoreDeveloper(input) {
  const max = SCORING_CONFIG.categoryMax.developer;
  const d = input.deployer || {};
  const signals = [];
  const hasAny =
    d.walletAgeMs != null ||
    d.tokensDeployed != null ||
    d.priorRugs != null ||
    d.priorSuccessful != null ||
    d.knownMalicious != null ||
    d.dumped != null ||
    d.accumulating != null ||
    d.transferredToMany != null;

  if (!hasAny) {
    signals.push(
      signal({
        name: "deployer_unknown",
        category: "developer",
        status: "unavailable",
        explanation: "Deployer history unavailable — not treated as a risk finding.",
        confidence: "UNKNOWN",
      }),
    );
    return categoryResult("developer", max, signals);
  }

  if (d.knownMalicious === true || (num(d.priorRugs) || 0) >= 1) {
    signals.push(
      signal({
        name: d.knownMalicious ? "known_malicious_deployer" : "prior_rugs",
        category: "developer",
        status: "critical",
        severity: "critical",
        points: -12,
        explanation: d.knownMalicious
          ? "Deployer is a known malicious wallet."
          : `Deployer has ${d.priorRugs} prior rug(s).`,
        evidence: { priorRugs: d.priorRugs || null },
        confidence: "VERIFIED",
        group: "deployer_reputation",
      }),
    );
  } else if ((num(d.priorSuccessful) || 0) >= 1) {
    signals.push(
      signal({
        name: "successful_deployer",
        category: "developer",
        status: "positive",
        points: 3.5,
        explanation: `Deployer has ${d.priorSuccessful} prior successful launch(es).`,
        confidence: "HIGH_CONFIDENCE",
        group: "deployer_reputation",
      }),
    );
  } else {
    signals.push(
      signal({
        name: "no_rug_history",
        category: "developer",
        status: "positive",
        points: 1.8,
        explanation: "No verified rug history on this deployer.",
        confidence: d.tokensDeployed != null ? "HIGH_CONFIDENCE" : "PARTIAL",
        group: "deployer_reputation",
      }),
    );
  }

  const ageMs = num(d.walletAgeMs);
  if (ageMs != null && ageMs < 2 * MS_DAY) {
    signals.push(
      signal({
        name: "new_deployer_wallet",
        category: "developer",
        status: "info",
        points: 0,
        explanation: "Deployer wallet is new. This lowers historical confidence, not safety.",
        evidence: { walletAgeHours: ageMs / MS_HOUR },
        confidence: "PARTIAL",
      }),
    );
  }

  if (d.dumped === true) {
    signals.push(
      signal({
        name: "deployer_dumped",
        category: "developer",
        status: "risk",
        severity: "high",
        points: -5,
        explanation: "Deployer has dumped a large share of this token.",
        confidence: "HIGH_CONFIDENCE",
        group: "deployer_flow",
      }),
    );
  } else if (d.accumulating === true) {
    signals.push(
      signal({
        name: "deployer_accumulating",
        category: "developer",
        status: "positive",
        points: 1.6,
        explanation: "Deployer appears to still be accumulating rather than exiting.",
        confidence: "PARTIAL",
        group: "deployer_flow",
      }),
    );
  }

  if (d.transferredToMany === true && d.dumped !== true) {
    signals.push(
      signal({
        name: "deployer_split",
        category: "developer",
        status: "concern",
        severity: "medium",
        points: -2.2,
        explanation: "Deployer split tokens across multiple wallets. Could be team ops or stealth distribution.",
        confidence: "PARTIAL",
        group: "deployer_flow",
      }),
    );
  }

  const launched = num(d.tokensDeployed);
  if (launched != null && launched >= 8 && !(num(d.priorSuccessful) > 0) && !(num(d.priorRugs) > 0)) {
    signals.push(
      signal({
        name: "serial_deployer",
        category: "developer",
        status: "info",
        severity: "low",
        points: -0.8,
        explanation: `${launched} prior launches with no verified outcome. Serial is not automatically malicious.`,
        evidence: { tokensDeployed: launched },
        confidence: "PARTIAL",
      }),
    );
  }

  return categoryResult("developer", max, signals);
}

function scoreTrading(input) {
  const max = SCORING_CONFIG.categoryMax.trading;
  const signals = [];
  const vol24 = num(input.volume24h);
  const unique = num(input.uniqueTraders);
  const buys = num(input.buyVolume);
  const sells = num(input.sellVolume);
  const hasAny =
    vol24 != null ||
    unique != null ||
    input.washTradingSuspected != null ||
    input.sellSuccessObserved != null ||
    input.cloneHardMatch != null ||
    buys != null;

  if (!hasAny) {
    signals.push(
      signal({
        name: "trading_unknown",
        category: "trading",
        status: "unavailable",
        explanation: "Trading quality data unavailable.",
        confidence: "UNKNOWN",
      }),
    );
    return categoryResult("trading", max, signals);
  }

  if (vol24 != null && vol24 <= 0) {
    signals.push(
      signal({
        name: "no_volume",
        category: "trading",
        status: "info",
        points: 0,
        explanation: "No 24h volume. Insufficient activity — not a scam signal by itself.",
        confidence: "HIGH_CONFIDENCE",
      }),
    );
  }

  if (unique != null && unique >= 25 && vol24 != null && vol24 > 0) {
    signals.push(
      signal({
        name: "organic_traders",
        category: "trading",
        status: "positive",
        points: 2.4,
        explanation: `${Math.round(unique)} unique traders with observable volume.`,
        evidence: { uniqueTraders: unique, volume24h: vol24 },
        confidence: "HIGH_CONFIDENCE",
        group: "organic",
      }),
    );
  } else if (unique != null && unique <= 3 && vol24 != null && vol24 > 5000) {
    signals.push(
      signal({
        name: "few_traders_high_volume",
        category: "trading",
        status: "concern",
        severity: "medium",
        points: -2.6,
        explanation: "High volume from very few wallets — possible wash or bot flow.",
        evidence: { uniqueTraders: unique, volume24h: vol24 },
        confidence: "PARTIAL",
        group: "organic",
      }),
    );
  }

  if (buys != null && sells != null && buys + sells > 0) {
    const buyPct = buys / (buys + sells);
    if (buyPct >= 0.35 && buyPct <= 0.72) {
      signals.push(
        signal({
          name: "balanced_flow",
          category: "trading",
          status: "positive",
          points: 1.5,
          explanation: `Buy share ${(buyPct * 100).toFixed(0)}% — two-sided flow.`,
          evidence: { buyVolume: buys, sellVolume: sells },
          confidence: "HIGH_CONFIDENCE",
          group: "flow",
        }),
      );
    }
  }

  if (input.sellSuccessObserved === true) {
    signals.push(
      signal({
        name: "sells_observed",
        category: "trading",
        status: "positive",
        points: 1.8,
        explanation: "Successful sell transactions observed.",
        confidence: "VERIFIED",
      }),
    );
  }

  if (input.washTradingSuspected === true || input.circularTransfers === true) {
    signals.push(
      signal({
        name: "wash_or_circular",
        category: "trading",
        status: "risk",
        severity: "high",
        points: -5,
        explanation: input.circularTransfers ? "Circular transfers detected." : "Wash-trading pattern suspected.",
        confidence: "PARTIAL",
        group: "manipulation",
      }),
    );
  } else if (input.botActivitySuspected === true) {
    signals.push(
      signal({
        name: "bot_activity",
        category: "trading",
        status: "concern",
        severity: "low",
        points: -1.2,
        explanation: "Bot-like activity suspected. Not proof of a rug.",
        confidence: "PARTIAL",
        group: "manipulation",
      }),
    );
  } else if (vol24 != null && vol24 > 0 && unique != null && unique >= 8) {
    signals.push(
      signal({
        name: "no_wash_detected",
        category: "trading",
        status: "positive",
        points: 0.8,
        explanation: "No wash-trading pattern verified from available data.",
        confidence: "PARTIAL",
        group: "manipulation",
      }),
    );
  }

  if (input.cloneHardMatch === true) {
    signals.push(
      signal({
        name: "clone_hard",
        category: "trading",
        status: "risk",
        severity: "high",
        points: -4.5,
        explanation: "Near-exact ticker/name collision with an existing token.",
        confidence: "HIGH_CONFIDENCE",
      }),
    );
  }

  return categoryResult("trading", max, signals);
}

function scoreMaturity(input) {
  const max = SCORING_CONFIG.categoryMax.maturity;
  const band = maturityBand(num(input.ageMs));
  if (!band) {
    return categoryResult("maturity", max, [
      signal({
        name: "age_unknown",
        category: "maturity",
        status: "unavailable",
        explanation: "Token age unavailable.",
        confidence: "UNKNOWN",
      }),
    ]);
  }
  const points = (band.score / 100) * max;
  return {
    id: "maturity",
    available: true,
    points: round1(points),
    max,
    normalized: band.score,
    confidence: "HIGH_CONFIDENCE",
    band: band.label,
    signals: [
      signal({
        name: "maturity_band",
        category: "maturity",
        status: "info",
        points: 0,
        explanation: `Maturity: ${band.label} (${band.days < 2 ? `${band.hours.toFixed(1)}h` : `${band.days.toFixed(1)}d`}). Age is context, not a safety penalty.`,
        evidence: { ageMs: input.ageMs, band: band.label, maturityScore: band.score },
        confidence: "HIGH_CONFIDENCE",
      }),
    ],
  };
}

function collectCritical(categories, input) {
  const caps = [];
  const risks = [];
  const all = Object.values(categories).flatMap((c) => c.signals || []);
  for (const s of all) {
    if (s.status === "critical" || s.severity === "critical") {
      risks.push(s);
      if (s.name === "cannot_sell" || s.name === "non_transferable" || s.name === "extreme_round_trip") caps.push({ reason: s.name, cap: SCORING_CONFIG.criticalCaps.honeypot });
      if (s.name === "malicious_transfer_hook") caps.push({ reason: s.name, cap: SCORING_CONFIG.criticalCaps.malicious_hook });
      if (s.name === "known_malicious_deployer" || s.name === "prior_rugs") {
        caps.push({ reason: s.name, cap: SCORING_CONFIG.criticalCaps.malicious_deployer });
      }
      if (s.name === "extreme_insider_concentration" && input.deployerDumping) {
        caps.push({ reason: s.name, cap: SCORING_CONFIG.criticalCaps.coordinated_dump });
      }
    }
  }
  if (input.rugged === true) {
    const s = signal({
      name: "rugged",
      category: "liquidity",
      status: "critical",
      severity: "critical",
      points: 0,
      explanation: "External feed flagged this mint as rugged.",
      confidence: "HIGH_CONFIDENCE",
    });
    risks.push(s);
    caps.push({ reason: "rugged", cap: SCORING_CONFIG.criticalCaps.rugged });
  }
  if (input.lpOwnerIsDeployer === true && input.lpBurned !== true && input.lpLocked !== true && input.deployerDumping === true) {
    caps.push({ reason: "lp_rug_setup", cap: SCORING_CONFIG.criticalCaps.lp_rug_setup });
  }
  const cap = caps.length ? Math.min(...caps.map((c) => c.cap)) : null;
  return { risks, cap, capReasons: caps };
}

function renormalize(cats) {
  const available = cats.filter((c) => c.available && c.points != null);
  if (!available.length) return { score: null, confidence: "UNKNOWN" };
  const pts = available.reduce((s, c) => s + c.points, 0);
  const max = available.reduce((s, c) => s + c.max, 0) || 1;
  return {
    score: Math.round((pts / max) * 100),
    confidence: mergeConfidence(available.map((c) => c.confidence)),
  };
}

function splitSignals(categories) {
  const all = Object.values(categories).flatMap((c) => c.signals || []);
  const positive = all.filter((s) => s.status === "positive");
  const risk = all.filter((s) => s.status === "risk" || s.status === "concern" || s.status === "critical");
  return { all, positive, risk };
}

function explain(result) {
  const pos = result.positive_signals.slice(0, 8).map((s) => s.explanation);
  const con = [
    ...result.critical_risks.map((s) => s.explanation),
    ...result.risk_signals.filter((s) => s.status !== "critical").map((s) => s.explanation),
  ].slice(0, 8);
  return { positive: pos, concerns: con };
}

export function diffIntelScores(previous, next) {
  if (!previous || previous.overall_score == null || next.overall_score == null) {
    return { score_change: null, score_change_reasons: [], events: [] };
  }
  const delta = next.overall_score - previous.overall_score;
  const events = [];
  const prevNames = new Set((previous.positive_signals || []).map((s) => s.name));
  const nextPos = new Set((next.positive_signals || []).map((s) => s.name));
  for (const s of next.positive_signals || []) {
    if (!prevNames.has(s.name)) events.push({ tone: "positive", text: s.explanation, name: s.name });
  }
  for (const s of next.risk_signals || []) {
    const had = (previous.risk_signals || []).some((p) => p.name === s.name);
    if (!had) events.push({ tone: "negative", text: s.explanation, name: s.name });
  }
  for (const s of previous.positive_signals || []) {
    if (!nextPos.has(s.name) && s.name === "mint_revoked") {
      events.push({ tone: "negative", text: "Mint authority is no longer revoked.", name: "mint_unrevoked" });
    }
  }
  return {
    score_change: delta,
    score_change_reasons: events.map((e) => e.text),
    events,
  };
}

export function computeOrbitXTokenIntel(raw = {}, previous = null) {
  const input = { ...raw };
  const ts = new Date(nowMs(input)).toISOString();
  if (input.ageMs == null) {
    const created = num(input.createdAtMs);
    if (created != null) input.ageMs = Math.max(0, nowMs(input) - created);
  }

  const contract = scoreContract(input);
  const liquidity = scoreLiquidity(input);
  const holders = scoreHolders(input);
  const developer = scoreDeveloper(input);
  const trading = scoreTrading(input);
  const maturity = scoreMaturity(input);

  const categories = { contract, liquidity, holders, developer, trading, maturity };
  const safetyParts = [contract, liquidity, holders, developer, trading];
  const safety = renormalize(safetyParts);
  const market = liquidity.available ? liquidity.normalized : null;
  const holderN = holders.available ? holders.normalized : null;
  const devN = developer.available ? developer.normalized : null;
  const orgN = trading.available ? trading.normalized : null;

  const qw = SCORING_CONFIG.qualityWeights;
  const qualityParts = [
    { w: qw.safety, v: safety.score },
    { w: qw.market, v: market },
    { w: qw.holders, v: holderN },
    { w: qw.developer, v: devN },
    { w: qw.organic, v: orgN },
  ].filter((p) => p.v != null);
  const qSum = qualityParts.reduce((s, p) => s + p.w, 0);
  const quality = qSum ? Math.round(qualityParts.reduce((s, p) => s + p.v * p.w, 0) / qSum) : null;

  const { all, positive, risk } = splitSignals(categories);
  const crit = collectCritical(categories, input);
  let overall = quality;
  if (overall != null && crit.cap != null) overall = Math.min(overall, crit.cap);
  let safetyScore = safety.score;
  if (safetyScore != null && crit.cap != null) safetyScore = Math.min(safetyScore, crit.cap);

  const availableCats = safetyParts.filter((c) => c.available).length;
  const confidence =
    availableCats === 0
      ? "UNKNOWN"
      : mergeConfidence([
          safety.confidence,
          ...safetyParts.filter((c) => c.available).map((c) => c.confidence),
        ]);

  const band = bandFor(overall);
  const maturityScore = maturity.available ? maturity.normalized : null;
  const diff = diffIntelScores(previous, {
    overall_score: overall,
    positive_signals: positive,
    risk_signals: risk,
  });

  const sources = Array.isArray(input.dataSources) ? input.dataSources : [];
  const result = {
    overall_score: overall,
    safety_score: safetyScore,
    maturity_score: maturityScore,
    quality_score: quality != null && crit.cap != null ? Math.min(quality, crit.cap) : quality,
    risk_level: overall == null ? "unknown" : band.risk,
    label: overall == null ? "Unknown" : band.label,
    confidence,
    positive_signals: positive,
    risk_signals: risk.filter((s) => s.status !== "critical"),
    critical_risks: crit.risks,
    category_scores: {
      contract: { points: contract.points, max: contract.max, available: contract.available, confidence: contract.confidence },
      liquidity: { points: liquidity.points, max: liquidity.max, available: liquidity.available, confidence: liquidity.confidence },
      holders: { points: holders.points, max: holders.max, available: holders.available, confidence: holders.confidence },
      developer: { points: developer.points, max: developer.max, available: developer.available, confidence: developer.confidence },
      trading: { points: trading.points, max: trading.max, available: trading.available, confidence: trading.confidence },
      maturity: {
        points: maturity.points,
        max: maturity.max,
        available: maturity.available,
        confidence: maturity.confidence,
        band: maturity.band || null,
      },
    },
    score_change: diff.score_change,
    score_change_reasons: diff.score_change_reasons,
    events: diff.events,
    data_sources: sources,
    last_updated: ts,
    calculation_timestamp: ts,
    mint: input.mint || null,
    signals: all,
    critical_cap: crit.cap,
    critical_cap_reasons: crit.capReasons,
  };
  result.explanation = explain(result);
  return result;
}

function boolish(v) {
  if (v === true || v === false) return v;
  return null;
}

export function snapshotFromJupToken(token = {}, extra = {}) {
  const created =
    num(Date.parse(token.firstMintAt)) ||
    num(Date.parse(token.onChainCreatedAt)) ||
    num(Date.parse(token.createdAt)) ||
    num(token.createdAtMs) ||
    extra.createdAtMs ||
    null;
  const stats = token.stats24h || token.stats?.["24h"] || {};
  const audit = token.audit || {};
  return {
    mint: token.id || token.mint || extra.mint || null,
    createdAtMs: created,
    liquidityUsd: num(token.liquidity ?? token.liquidityUsd),
    marketCapUsd: num(token.mcap ?? token.fdv ?? token.marketCapUsd),
    volume24h: num(token.volume ?? stats.buyVolume) != null
      ? (num(stats.buyVolume) || 0) + (num(stats.sellVolume) || 0) || num(token.volume)
      : num(token.volume),
    volume1h: num(token.stats1h?.buyVolume) != null
      ? (num(token.stats1h.buyVolume) || 0) + (num(token.stats1h.sellVolume) || 0)
      : null,
    holderCount: num(token.holderCount),
    top10Pct: num(audit.topHoldersPercentage ?? token.topHoldersPercent),
    mintAuthorityActive: audit.mintAuthorityDisabled == null ? null : !audit.mintAuthorityDisabled,
    freezeAuthorityActive: audit.freezeAuthorityDisabled == null ? null : !audit.freezeAuthorityDisabled,
    buyVolume: num(stats.buyVolume),
    sellVolume: num(stats.sellVolume),
    uniqueTraders: num(stats.numTraders),
    holderGrowthPct: num(stats.holderChange),
    canBuy: extra.canBuy ?? null,
    canSell: extra.canSell ?? null,
    dataSources: ["jupiter", ...(extra.dataSources || [])],
    nowMs: extra.nowMs,
    ...extra,
  };
}

export function snapshotFromDexSources({
  mint,
  token = {},
  meta = {},
  safety = {},
  intel = {},
  flags = {},
  pairs = [],
  now = Date.now(),
} = {}) {
  const created =
    num(Date.parse(meta.createdAt)) ||
    num(Date.parse(token.createdAt)) ||
    (num(meta.ageDays) != null ? now - meta.ageDays * MS_DAY : null);
  const holders = (intel.holders || []).map((h) => ({
    address: h.owner || h.address || h.wallet,
    pct: num(h.pct ?? h.percentage),
    role: h.role || h.label || h.kind,
  }));
  const buys = num(token.buyVolume ?? meta.buyVolume24h ?? token.stats?.["24h"]?.buyVolume);
  const sells = num(token.sellVolume ?? meta.sellVolume24h ?? token.stats?.["24h"]?.sellVolume);
  const vol =
    num(token.volume) ??
    (buys != null || sells != null ? (buys || 0) + (sells || 0) : null) ??
    num(pairs[0]?.volume24h);
  const mintRenounced = boolish(
    safety.mintAuthorityRenounced ?? flags.mintAuthorityDisabled ?? token.audit?.mintAuthorityDisabled,
  );
  const freezeRenounced = boolish(
    safety.freezeAuthorityRenounced ?? flags.freezeAuthorityDisabled ?? token.audit?.freezeAuthorityDisabled,
  );
  const trades = intel.trades || [];
  const sellObserved = trades.some((t) => String(t.side || t.kind) === "sell");
  const unique = new Set(trades.map((t) => t.wallet || t.owner).filter(Boolean)).size || num(token.numTraders);

  return {
    mint: mint || token.mint || null,
    createdAtMs: created,
    liquidityUsd: num(token.liquidity ?? meta.liquidity ?? pairs[0]?.liquidity),
    marketCapUsd: num(token.mcap ?? meta.mcap ?? token.fdv),
    volume24h: vol,
    volume1h: num(token.stats?.["1h"]?.volume),
    volume5m: num(token.stats?.["5m"]?.volume),
    volume6h: num(token.stats?.["6h"]?.volume),
    holderCount: num(token.holderCount ?? meta.holderCount ?? safety.totalHolders),
    top10Pct: num(meta.topHoldersPct ?? token.audit?.topHoldersPercentage ?? safety.topHoldersPct),
    holders,
    mintAuthorityActive: mintRenounced == null ? null : !mintRenounced,
    freezeAuthorityActive: freezeRenounced == null ? null : !freezeRenounced,
    lpLockedPct: num(safety.lpLockedPct),
    lpLocked: num(safety.lpLockedPct) != null ? safety.lpLockedPct >= 50 : null,
    lpBurned: boolish(safety.lpBurned ?? flags.lpBurned),
    lpOwnerIsDeployer: boolish(safety.lpOwnerIsDeployer),
    canBuy: boolish(safety.canBuy),
    canSell: boolish(safety.canSell),
    sellSuccessObserved: sellObserved || boolish(safety.canSell) === true,
    buyVolume: buys,
    sellVolume: sells,
    uniqueTraders: unique || null,
    uniqueBuyers: num(token.stats?.["24h"]?.numBuys),
    uniqueSellers: num(token.stats?.["24h"]?.numSells),
    holderGrowthPct: num(token.stats?.["24h"]?.holderChange ?? meta.holderChange24h),
    rugged: boolish(safety.rugged ?? flags.lpPulled),
    poolCount: Array.isArray(pairs) ? pairs.length : null,
    dex: pairs[0]?.dex || meta.pairDexId || null,
    deployer: {
      tokensDeployed: num(intel.dev?.tokensCreated ?? intel.forensics?.dev?.tokensCreated),
      priorRugs: num(intel.dev?.rugs),
      dumped: boolish(intel.dev?.sold),
      serial: boolish(intel.dev?.serial),
      knownMalicious: boolish(intel.dev?.malicious),
    },
    cloneHardMatch: boolish(flags.isPumpFunClone) === true && boolish(flags.isVerified) !== true ? null : boolish(safety.cloneHardMatch),
    dataSources: ["jupiter", "dexscreener", "og-scan", "intel"].filter(Boolean),
    nowMs: now,
  };
}

export function snapshotFromComposeRiskInput(input = {}) {
  return {
    canBuy: input.canBuy,
    canSell: input.canSell,
    marketCapUsd: num(input.marketCapUsd),
    roundTripLossPct: num(input.roundTripLossPct),
    mintAuthorityActive: input.mintRenounced == null ? null : !input.mintRenounced,
    freezeAuthorityActive: input.freezeRenounced == null ? null : !input.freezeRenounced,
    lpLockedPct: input.lpLockedPct,
    lpLocked: input.lpLockedPct != null ? input.lpLockedPct >= 50 : null,
    rugged: input.rugged,
    top10Pct: input.top10Pct,
    holderCount: input.totalHolders,
    liquidityUsd: input.liquidityUsd,
    deployer: {
      dumped: input.devSold,
      tokensDeployed: input.creatorTokensCount,
      serial: input.devSerial,
    },
    cloneHardMatch: input.cloneHardMatch,
    dataSources: ["compose-risk"],
  };
}

export function toOgCompositeScore(intel, extras = {}) {
  const cat = intel.category_scores || {};
  const n = (c) => (c?.available ? Math.round(((c.points || 0) / (c.max || 1)) * 100) : 50);
  return {
    total: intel.overall_score,
    signals: {
      age: intel.maturity_score,
      athMcap: n(cat.liquidity),
      holderProfile: n(cat.holders),
      deployPattern: n(cat.developer),
      poolAge: n(cat.maturity),
      contract: n(cat.contract),
      liquidity: n(cat.liquidity),
      holders: n(cat.holders),
      developer: n(cat.developer),
      trading: n(cat.trading),
      maturity: intel.maturity_score,
    },
    intel,
    isPumpFunClone: extras.isPumpFunClone ?? false,
    tripleSourceCreatedAt: extras.tripleSourceCreatedAt,
  };
}

export function verdictFromIntel(intel, flags = {}) {
  if (flags.lpPulled) return "RUG RISK — liquidity pulled/dead";
  if (intel.critical_risks?.length) return intel.critical_risks[0].explanation;
  if (intel.overall_score == null) return "INSUFFICIENT DATA";
  return intel.label;
}
