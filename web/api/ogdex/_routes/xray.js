// OG DEX — Risk X-ray. Merges early-buyer forensics (snipers / same-block
// bundlers from the ogdex-xray edge fn) with holder + safety intel
// (ogdex-intel-v2) into a single green / yellow / red verdict.
import { callFn, send, cache, INTEL_FN } from "../_lib.js";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const pct1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return send(res, 400, { ok: false, error: "valid mint required" });
  cache(res, 60, 300);

  try {
    const [xr, intel] = await Promise.all([
      callFn("ogdex-xray", { mint }).catch(() => null),
      callFn(INTEL_FN, { mint }).catch(() => null),
    ]);

    const xray = xr?.xray || null;
    const safety = intel?.safety || {};
    const holders = intel?.holders || [];

    // ── Concentration ──────────────────────────────────────────────
    const top10Pct = holders.length ? holders.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0) : null;
    const whales = holders.filter((h) => (h.pct || 0) >= 1).length;
    const totalHolders = safety.totalHolders ?? intel?.holderCount ?? null;

    // ── Dev ────────────────────────────────────────────────────────
    const dev = safety.creator || null;
    let devPct = null, devSold = null;
    if (dev && holders.length) {
      const h = holders.find((x) => x.owner === dev);
      devPct = h ? (h.pct ?? null) : 0;
      devSold = (devPct ?? 0) < 0.5;
    }
    const devSerial = (safety.creatorTokensCount ?? 0) >= 5;

    // ── Early-buyer forensics ──────────────────────────────────────
    const c = xray?.counts || {};
    const sniperPct = num(c.sniperPct);
    const bundlePct = num(c.bundlePct);
    const bundles = xray?.bundles || [];
    const earlyBuyers = xray?.earlyBuyers || [];
    const snipers = xray?.snipers || [];
    const insiderClusters = xray?.insiderClusters || [];
    const insiderPct = num(c.insiderPct);

    // ── Flags & scoring (0 = clean, higher = riskier) ──────────────
    const flags = [];
    let score = 0;

    if (sniperPct != null && sniperPct >= 60) { flags.push({ level: "red", text: `${sniperPct}% of early buyers sniped the launch` }); score += 3; }
    else if (sniperPct != null && sniperPct >= 30) { flags.push({ level: "yellow", text: `${sniperPct}% of early buyers sniped the launch` }); score += 1; }

    if (bundlePct != null && bundlePct >= 30) { flags.push({ level: "red", text: `${bundlePct}% of early buyers came in same-block bundles` }); score += 3; }
    else if ((c.bundles ?? 0) > 0) { flags.push({ level: "yellow", text: `${c.bundles} same-block buy bundle${c.bundles === 1 ? "" : "s"} detected` }); score += 1; }

    if (insiderPct != null && insiderPct >= 40) { flags.push({ level: "red", text: `${insiderPct}% of early buyers were funded by a shared wallet (insider cluster)` }); score += 3; }
    else if ((c.insiderClusters ?? 0) > 0) { flags.push({ level: "yellow", text: `${c.insiderClusters} insider cluster${c.insiderClusters === 1 ? "" : "s"} (early buyers sharing a funding wallet)` }); score += 1; }

    if (top10Pct != null && top10Pct >= 50) { flags.push({ level: "red", text: `Top 10 holders control ${pct1(top10Pct)}% of supply` }); score += 3; }
    else if (top10Pct != null && top10Pct >= 30) { flags.push({ level: "yellow", text: `Top 10 holders control ${pct1(top10Pct)}% of supply` }); score += 1; }

    if (devPct != null && devPct >= 5) { flags.push({ level: "red", text: `Dev still holds ${pct1(devPct)}% of supply` }); score += 2; }
    else if (devSold) { flags.push({ level: "yellow", text: "Dev wallet has exited its position" }); score += 1; }
    if (devSerial) { flags.push({ level: "yellow", text: `Dev has launched ${safety.creatorTokensCount}+ tokens` }); score += 1; }

    if (safety.mintAuthorityRenounced === false) { flags.push({ level: "red", text: "Mint authority NOT renounced (supply can be inflated)" }); score += 2; }
    if (safety.freezeAuthorityRenounced === false) { flags.push({ level: "red", text: "Freeze authority NOT renounced (accounts can be frozen)" }); score += 3; }
    if (safety.rugged === true) { flags.push({ level: "red", text: "Flagged as rugged by Rugcheck" }); score += 5; }
    if (num(safety.riskScore) != null && num(safety.riskScore) >= 50) { flags.push({ level: "yellow", text: `Rugcheck risk score ${num(safety.riskScore)}` }); score += 1; }

    // Positive signals when nothing tripped
    if (!flags.some((f) => f.level === "red") && safety.mintAuthorityRenounced && safety.freezeAuthorityRenounced) {
      flags.push({ level: "green", text: "Mint & freeze authorities renounced" });
    }

    // ── Verdict ────────────────────────────────────────────────────
    const reds = flags.filter((f) => f.level === "red").length;
    let verdict, tone, summary;
    if (reds >= 2 || score >= 6) { verdict = "High risk"; tone = "red"; }
    else if (reds === 1 || score >= 2) { verdict = "Caution"; tone = "yellow"; }
    else { verdict = "Looks clean"; tone = "green"; }
    summary = {
      red: "Multiple serious risk signals. Trade only what you can lose, if at all.",
      yellow: "Some risk signals present. Do your own research and size positions carefully.",
      green: "No major risk signals found on-chain. Always still verify yourself.",
    }[tone];

    return send(res, 200, {
      ok: true,
      mint,
      verdict, tone, score, summary,
      flags,
      snipers: {
        pct: sniperPct,
        count: c.snipers ?? null,
        wallets: snipers.slice(0, 20).map((s) => ({ wallet: s.wallet, solSpent: s.solSpent, secondsAfterLaunch: s.secondsAfterLaunch ?? null, txHash: s.txHash, bundled: !!s.bundled })),
      },
      bundles: {
        pct: bundlePct,
        count: c.bundles ?? null,
        clusters: bundles.slice(0, 10).map((b) => ({ slot: b.slot, size: b.size, wallets: b.wallets })),
      },
      insiders: {
        pct: insiderPct,
        count: c.insiders ?? null,
        clusters: insiderClusters.slice(0, 10).map((cl) => ({ funder: cl.funder, size: cl.size, wallets: cl.wallets })),
      },
      earlyBuyers: earlyBuyers.slice(0, 30),
      concentration: { top10Pct: pct1(top10Pct), whales, totalHolders },
      dev: dev ? { wallet: dev, pct: pct1(devPct), sold: devSold, serial: devSerial, tokensCreated: safety.creatorTokensCount ?? null } : null,
      safety: {
        mintRenounced: safety.mintAuthorityRenounced ?? null,
        freezeRenounced: safety.freezeAuthorityRenounced ?? null,
        lpLockedPct: safety.lpLockedPct ?? null,
        rugged: safety.rugged ?? null,
        riskScore: num(safety.riskScore),
      },
      traced: !!xray?.traced,
      note: xray?.traced ? null : "Early-buyer trace unavailable for this token (non-pump.fun or history too large); verdict uses holder + safety data only.",
    });
  } catch (e) {
    return send(res, 200, { ok: false, mint, error: String(e?.message || e) });
  }
}
