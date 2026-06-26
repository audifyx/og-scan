// OG DEX — Risk X-ray. Merges early-buyer forensics (snipers / same-block
// bundlers from the ogdex-xray edge fn) with holder + safety intel
// (ogdex-intel-v2) into a single green / yellow / red verdict.
import { callFn, send, cache, INTEL_FN } from "../_lib.js";

const num  = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const pct1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// ── LP / AMM address filter ────────────────────────────────────────────────
// These addresses should NEVER be counted as token holders — they are
// liquidity-pool vaults, burn addresses, or AMM program accounts.
// Filtering them out ensures concentration figures reflect real wallets only.
const LP_PROGRAMS = new Set([
  // Raydium AMM (various versions)
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM v4 program
  "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8", // Raydium CPMM vault authority
  "GpMZbSM2GgvTKHJirzeGfMFoaZ8UrmdX7K14ACLr3iyE", // Raydium CLMM vault authority
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM program
  // pump.fun
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  // pump.fun bonding curve program
  "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg", // pump.fun migration wallet
  "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",  // pump.fun LP burn / lock address
  "CebN5WGQ4jvEPvsVU4EoHEpgznyZtZbHRfTans2eHT6E", // pump.fun AMM pool authority
  // Orca / Whirlpool
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",  // Orca Whirlpool program
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", // Orca classic AMM
  "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1", // Orca vault authority
  // Meteora
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EkAW7vAR", // Meteora DLMM
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",  // Meteora LB
  "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K",  // Magic Eden v2
]);

/**
 * Returns true if this holder record represents an LP/AMM/pool account
 * rather than a real wallet. Checks both known program addresses and
 * API-supplied flags (Birdeye / Helius mark pool accounts with isPool).
 */
function isLpHolder(h) {
  if (!h || !h.owner) return false;
  if (LP_PROGRAMS.has(h.owner)) return true;
  // Birdeye, Helius, etc. sometimes include pool flags
  if (h.isPool === true || h.is_pool === true) return true;
  const t = (h.type || h.tag || h.label || "").toLowerCase();
  return /\b(pool|lp|amm|vault|raydium|meteora|orca|whirlpool|bonding.?curve)\b/.test(t);
}

export default async function handler(req, res) {
  const url  = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint))
    return send(res, 400, { ok: false, error: "valid mint required" });
  cache(res, 60, 300);

  try {
    const [xr, intel] = await Promise.all([
      callFn("ogdex-xray", { mint }).catch(() => null),
      callFn(INTEL_FN,    { mint }).catch(() => null),
    ]);

    const xray    = xr?.xray    || null;
    const safety  = intel?.safety  || {};
    const holders = intel?.holders || [];

    // ── Concentration — exclude LP/pool accounts ───────────────────
    // An LP vault is NOT a holder. Counting it inflates concentration
    // figures dramatically for tokens where the liquidity pool holds
    // the majority of supply (e.g. pump.fun tokens with 100% locked LP).
    const realHolders = holders.filter(h => !isLpHolder(h));
    const lpHolders   = holders.filter(h =>  isLpHolder(h));

    // LP supply % — shown separately in the UI so users understand
    // why the "real" holder concentration may be lower than on-chain raw data.
    const lpSupplyPct = pct1(lpHolders.reduce((s, h) => s + (h.pct || 0), 0)) || null;

    const top10Pct    = realHolders.length
      ? pct1(realHolders.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0))
      : null;
    const whales      = realHolders.filter(h => (h.pct || 0) >= 1).length;
    const totalHolders = safety.totalHolders ?? intel?.holderCount ?? null;

    // ── Dev ────────────────────────────────────────────────────────
    const dev    = safety.creator || null;
    let devPct   = null, devSold = null;
    if (dev && realHolders.length) {
      const h  = realHolders.find(x => x.owner === dev);
      devPct   = h ? (h.pct ?? null) : 0;
      devSold  = (devPct ?? 0) < 0.5;
    }
    const devSerial = (safety.creatorTokensCount ?? 0) >= 5;

    // ── Early-buyer forensics ──────────────────────────────────────
    const c               = xray?.counts          || {};
    const sniperPct       = num(c.sniperPct);
    const bundlePct       = num(c.bundlePct);
    const bundles         = xray?.bundles          || [];
    const earlyBuyers     = xray?.earlyBuyers      || [];
    const snipers         = xray?.snipers          || [];
    const insiderClusters = xray?.insiderClusters  || [];
    const insiderPct      = num(c.insiderPct);

    // ── Flags & scoring (0 = clean, higher = riskier) ──────────────
    const flags = [];
    let score   = 0;

    if (sniperPct != null && sniperPct >= 60) {
      flags.push({ level: "red",    text: `${sniperPct}% of early buyers sniped the launch` }); score += 3;
    } else if (sniperPct != null && sniperPct >= 30) {
      flags.push({ level: "yellow", text: `${sniperPct}% of early buyers sniped the launch` }); score += 1;
    }

    if (bundlePct != null && bundlePct >= 30) {
      flags.push({ level: "red",    text: `${bundlePct}% of early buyers came in same-block bundles` }); score += 3;
    } else if ((c.bundles ?? 0) > 0) {
      flags.push({ level: "yellow", text: `${c.bundles} same-block buy bundle${c.bundles === 1 ? "" : "s"} detected` }); score += 1;
    }

    if (insiderPct != null && insiderPct >= 40) {
      flags.push({ level: "red",    text: `${insiderPct}% of early buyers were funded by a shared wallet (insider cluster)` }); score += 3;
    } else if ((c.insiderClusters ?? 0) > 0) {
      flags.push({ level: "yellow", text: `${c.insiderClusters} insider cluster${c.insiderClusters === 1 ? "" : "s"} (early buyers sharing a funding wallet)` }); score += 1;
    }

    // Concentration flag — real wallets only (LP excluded)
    if (top10Pct != null && top10Pct >= 50) {
      flags.push({ level: "red",    text: `Top 10 wallets control ${pct1(top10Pct)}% of supply (LP excluded)` }); score += 3;
    } else if (top10Pct != null && top10Pct >= 30) {
      flags.push({ level: "yellow", text: `Top 10 wallets control ${pct1(top10Pct)}% of supply (LP excluded)` }); score += 1;
    }

    // LP info — report locked LP as a positive signal.
    // pump.fun graduation burns LP → always effectively 100% locked even if
    // rugcheck reports 0 (it doesn't always detect the burn).
    let effectiveLpPct = num(safety.lpLockedPct);
    if (!effectiveLpPct && safety.isPumpFun && !safety.rugged) effectiveLpPct = 100;
    if (lpSupplyPct != null && lpSupplyPct > 0) {
      if (effectiveLpPct != null && effectiveLpPct >= 90) {
        flags.push({ level: "green", text: `LP holds ${lpSupplyPct}% of supply — ${pct1(effectiveLpPct)}% locked/burned` });
      } else if (effectiveLpPct != null && effectiveLpPct > 0) {
        flags.push({ level: "yellow", text: `LP holds ${lpSupplyPct}% of supply — only ${pct1(effectiveLpPct)}% locked` }); score += 1;
      }
    }

    if (devPct != null && devPct >= 5) {
      flags.push({ level: "red",    text: `Dev still holds ${pct1(devPct)}% of supply` }); score += 2;
    } else if (devSold) {
      flags.push({ level: "yellow", text: "Dev wallet has exited its position" }); score += 1;
    }
    if (devSerial) {
      flags.push({ level: "yellow", text: `Dev has launched ${safety.creatorTokensCount}+ tokens` }); score += 1;
    }

    if (safety.mintAuthorityRenounced === false)  { flags.push({ level: "red",    text: "Mint authority NOT renounced (supply can be inflated)" }); score += 2; }
    if (safety.freezeAuthorityRenounced === false) { flags.push({ level: "red",    text: "Freeze authority NOT renounced (accounts can be frozen)"  }); score += 3; }
    if (safety.rugged === true)                    { flags.push({ level: "red",    text: "Flagged as rugged by Rugcheck" }); score += 5; }
    if (num(safety.riskScore) != null && num(safety.riskScore) >= 50) {
      flags.push({ level: "yellow", text: `Rugcheck risk score ${num(safety.riskScore)}` }); score += 1;
    }

    // Positive signals when nothing tripped
    if (!flags.some(f => f.level === "red") && safety.mintAuthorityRenounced && safety.freezeAuthorityRenounced) {
      flags.push({ level: "green", text: "Mint & freeze authorities renounced" });
    }

    // ── Verdict ────────────────────────────────────────────────────
    const reds = flags.filter(f => f.level === "red").length;
    let verdict, tone, summary;
    if      (reds >= 2 || score >= 6) { verdict = "High risk"; tone = "red"; }
    else if (reds === 1 || score >= 2) { verdict = "Caution";   tone = "yellow"; }
    else                               { verdict = "Looks clean"; tone = "green"; }
    summary = {
      red:    "Multiple serious risk signals. Trade only what you can lose, if at all.",
      yellow: "Some risk signals present. Do your own research and size positions carefully.",
      green:  "No major risk signals found on-chain. Always still verify yourself.",
    }[tone];

    return send(res, 200, {
      ok: true,
      mint,
      verdict, tone, score, summary,
      flags,
      snipers: {
        pct:     sniperPct,
        count:   c.snipers ?? null,
        wallets: snipers.slice(0, 20).map(s => ({
          wallet: s.wallet, solSpent: s.solSpent,
          secondsAfterLaunch: s.secondsAfterLaunch ?? null,
          txHash: s.txHash, bundled: !!s.bundled,
        })),
      },
      bundles: {
        pct:      bundlePct,
        count:    c.bundles ?? null,
        clusters: bundles.slice(0, 10).map(b => ({ slot: b.slot, size: b.size, wallets: b.wallets })),
      },
      insiders: {
        pct:      insiderPct,
        count:    c.insiderClusters ?? null,    // clusters, not wallets
        wallets:  c.insiders ?? null,           // keep raw wallet count too
        clusters: insiderClusters.slice(0, 10).map(cl => ({ funder: cl.funder, size: cl.size, wallets: cl.wallets })),
      },
      earlyBuyers: earlyBuyers.slice(0, 30),
      concentration: {
        top10Pct:     top10Pct,          // real wallets only — LP excluded
        lpSupplyPct:  lpSupplyPct,       // LP vault share — NOT a holder
        whales,
        totalHolders,
      },
      dev: dev ? {
        wallet:         dev,
        pct:            pct1(devPct),
        sold:           devSold,
        serial:         devSerial,
        tokensCreated:  safety.creatorTokensCount ?? null,
      } : null,
      safety: {
        mintRenounced:   safety.mintAuthorityRenounced   ?? null,
        freezeRenounced: safety.freezeAuthorityRenounced ?? null,
        lpLockedPct:     effectiveLpPct                  ?? null,   // pump.fun burn inferred; USD-weighted total
        lpTotalUSD:      safety.lpTotalUSD               ?? null,   // total LP liquidity in USD
        lpLockedUSD:     safety.lpLockedUSD              ?? null,   // locked LP USD
        lpMarkets:       safety.lpMarkets                ?? [],     // per-pool breakdown
        rugged:          safety.rugged                   ?? null,
        riskScore:       num(safety.riskScore),
        isPumpFun:       safety.isPumpFun                ?? null,
        launchpad:       safety.launchpad                ?? null,
        risks:           safety.risks                    ?? [],
      },
      traced: !!xray?.traced,
      note:   xray?.traced ? null : "Early-buyer trace unavailable for this token (non-pump.fun or history too large); verdict uses holder + safety data only.",
    });
  } catch (e) {
    return send(res, 200, { ok: false, mint, error: String(e?.message || e) });
  }
}
