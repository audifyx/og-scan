/**
 * Autonomous AI Agents — sniper, analyst, guardian, research, alpha finder.
 * Zero SQL: server provides data + control plane; the widget is the runtime
 * (polling loops, localStorage state, trade execution via app tools).
 *
 * Each agent tool supports action=start|stop|status (control plane, returns
 * widget instructions) plus a data action (scan|brief|check) that does real
 * server-side work and returns structured results.
 */
import { needAuth, tokenInfo, solUsd } from "./_mcp-app-wallet.js";

const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_MINT = "So11111111111111111111111111111111111111112";

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "") ||
    "https://api.mainnet-beta.solana.com"
  );
}

async function rpc(method, params, timeoutMs = 12_000) {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error(j.error.message || "rpc_error");
  return j.result;
}

async function jget(url, timeoutMs = 10_000) {
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "OrbitX-MCP/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/* ==================== Shared: token safety (simplified, no SQL) ==================== */

async function safetyQuick(mint) {
  // Returns { score (0-100), flags[], liquidity, holders, devPct }
  const out = { score: 50, flags: [], liquidity: 0, holders: 0, devPct: null, mcap: 0, ageMin: null };
  try {
    const info = await tokenInfo(mint);
    out.liquidity = info.liquidity || 0;
    out.mcap = info.mcap || 0;
    // Liquidity scoring
    if (out.liquidity >= 50000) out.score += 20;
    else if (out.liquidity >= 10000) out.score += 10;
    else { out.score -= 15; out.flags.push("low_liquidity"); }
    if (out.mcap > 0 && out.mcap < 50000) { out.score -= 5; out.flags.push("microcap"); }
  } catch { out.flags.push("no_dex_data"); out.score -= 10; }
  // Holder concentration via RPC
  try {
    const largest = await rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }], 10_000);
    const accounts = largest?.value || [];
    out.holders = accounts.length;
    if (accounts.length > 0) {
      const top1 = num(accounts[0]?.amount, 0);
      const supplyRes = await rpc("getTokenSupply", [mint, { commitment: "confirmed" }], 10_000).catch(() => null);
      const supply = num(supplyRes?.value?.amount, 0);
      if (supply > 0) {
        out.devPct = (top1 / supply) * 100;
        if (out.devPct > 30) { out.score -= 25; out.flags.push("dev_holds_" + out.devPct.toFixed(1) + "%"); }
        else if (out.devPct > 10) { out.score -= 10; out.flags.push("dev_holds_" + out.devPct.toFixed(1) + "%"); }
        else out.score += 10;
      }
    }
    if (accounts.length < 20) { out.score -= 10; out.flags.push("few_holders"); }
  } catch { out.flags.push("holder_check_failed"); }
  out.score = Math.max(0, Math.min(100, Math.round(out.score)));
  return out;
}

/* ==================== 1. Sniper Agent ==================== */

const DEFAULT_SNIPE_FILTERS = {
  minLiquidityUsd: 10000,
  maxDevPct: 10,
  minScore: 60,
  maxAgeMin: 120,
};

async function snipeScan(args) {
  const filters = { ...DEFAULT_SNIPE_FILTERS, ...(args.filters || {}) };
  const maxBuySol = Math.min(10, Math.max(0.01, num(args.maxBuySol || 0.5, 0.5)));
  // New pairs from DexScreener token profiles (new tokens)
  let pairs = [];
  try {
    const profiles = await jget("https://api.dexscreener.com/token-profiles/latest/v1", 12_000).catch(() => []);
    const solNew = (Array.isArray(profiles) ? profiles : []).filter((p) => String(p.chainId || "").toLowerCase() === "solana").slice(0, 15);
    for (const p of solNew) {
      const mint = p.tokenAddress;
      if (!mint || !PUBKEY_RE.test(mint)) continue;
      pairs.push({ mint, symbol: p.symbol || "?", name: p.name || "", url: p.url || "" });
    }
  } catch (e) {
    return { ok: false, error: "scan_failed", message: `Launch scan failed: ${e.message}` };
  }
  const results = [];
  for (const p of pairs.slice(0, 10)) {
    try {
      const info = await tokenInfo(p.mint);
      const safety = await safetyQuick(p.mint);
      const ageMin = null; // DexScreener profiles don't give age reliably
      const pass =
        safety.liquidity >= filters.minLiquidityUsd &&
        safety.score >= filters.minScore &&
        (safety.devPct == null || safety.devPct <= filters.maxDevPct);
      const reasons = [];
      if (safety.liquidity < filters.minLiquidityUsd) reasons.push(`liquidity $${Math.round(safety.liquidity)} < $${filters.minLiquidityUsd}`);
      if (safety.score < filters.minScore) reasons.push(`safety ${safety.score} < ${filters.minScore}`);
      if (safety.devPct != null && safety.devPct > filters.maxDevPct) reasons.push(`dev ${safety.devPct.toFixed(1)}% > ${filters.maxDevPct}%`);
      if (safety.flags.length) reasons.push(...safety.flags);
      results.push({
        mint: p.mint,
        symbol: info.symbol || p.symbol,
        name: info.name || p.name,
        priceUsd: info.priceUsd,
        mcap: info.mcap,
        liquidity: safety.liquidity,
        safetyScore: safety.score,
        devPct: safety.devPct != null ? Number(safety.devPct.toFixed(1)) : null,
        pass,
        reasons: pass ? ["all filters passed"] : reasons,
        maxBuySol: pass ? maxBuySol : 0,
        url: info.url || p.url,
      });
    } catch { /* skip */ }
  }
  const passed = results.filter((r) => r.pass);
  return {
    ok: true,
    agent: "snipe",
    scanned: results.length,
    passed: passed.length,
    maxBuySol,
    filters,
    launches: results,
    note: passed.length
      ? `${passed.length} launch(es) passed filters. The widget auto-buys while running; in chat, call orbitx_app_buy for a manual snipe.`
      : "No launches passed filters this scan. The agent keeps watching.",
  };
}

function snipeControl(action, args) {
  const a = String(action || "status").toLowerCase();
  if (a === "start") {
    const maxBuySol = Math.min(10, Math.max(0.01, num(args.maxBuySol || 0.5, 0.5)));
    const filters = { ...DEFAULT_SNIPE_FILTERS, ...(args.filters || {}) };
    return {
      ok: true,
      agent: "snipe",
      action: "start",
      config: { maxBuySol, filters, pollMs: 15000 },
      message: `Sniper agent armed: max ${maxBuySol} SOL/buy, min liquidity $${filters.minLiquidityUsd}, max dev ${filters.maxDevPct}%, min score ${filters.minScore}. Open the Trade widget's 🎯 Sniper tab — it runs the scan loop while open (every 15s). Runs while widget is open.`,
      widgetAction: { tab: "sniper", startAgent: { maxBuySol, filters } },
    };
  }
  if (a === "stop") {
    return { ok: true, agent: "snipe", action: "stop", message: "Sniper agent stop signal sent. Stop it in the Trade widget's 🎯 Sniper tab.", widgetAction: { tab: "sniper", stopAgent: true } };
  }
  return {
    ok: true, agent: "snipe", action: "status",
    message: "Sniper agent state lives in the Trade widget (localStorage) — open the 🎯 Sniper tab for live status, positions, and PnL. Use action=scan for a one-shot server scan.",
  };
}

/* ==================== 2. Market Analyst Agent ==================== */

async function analystBrief(args) {
  const minConviction = String(args.minConviction || "medium").toLowerCase();
  const convictionRank = { low: 0, medium: 1, high: 2 }[minConviction] ?? 1;
  // Trending tokens
  let trending = [];
  try {
    const j = await jget("https://api.dexscreener.com/latest/dex/search?q=SOLANA", 12_000).catch(() => ({}));
    const pairs = (j.pairs || []).filter((p) => String(p.chainId || "").toLowerCase() === "solana").slice(0, 12);
    for (const p of pairs) {
      const chg5m = num(p.priceChange?.m5, 0);
      const chg1h = num(p.priceChange?.h1, 0);
      const chg24h = num(p.priceChange?.h24, 0);
      const vol24h = num(p.volume?.h24, 0);
      const liq = num(p.liquidity?.usd, 0);
      // Conviction scoring
      let conviction = "low", score = 0;
      const reasons = [];
      if (chg1h > 20 && vol24h > 100000) { score += 3; reasons.push(`+${chg1h.toFixed(0)}% 1h on $${Math.round(vol24h / 1000)}k volume`); }
      if (chg24h > 50 && liq > 50000) { score += 2; reasons.push(`+${chg24h.toFixed(0)}% 24h, $${Math.round(liq / 1000)}k liquidity`); }
      if (chg5m > 10) { score += 2; reasons.push(`+${chg5m.toFixed(0)}% in 5m (momentum)`); }
      if (chg24h < -30) { score += 1; reasons.push(`${chg24h.toFixed(0)}% 24h — possible bounce or avoid`); }
      if (vol24h < 20000) { score -= 2; reasons.push("thin volume — high risk"); }
      if (score >= 5) conviction = "high";
      else if (score >= 3) conviction = "medium";
      if ({ low: 0, medium: 1, high: 2 }[conviction] >= convictionRank && reasons.length) {
        trending.push({
          mint: p.baseToken?.address || "",
          symbol: p.baseToken?.symbol || "?",
          priceUsd: num(p.priceUsd, 0),
          chg5m: Number(chg5m.toFixed(1)),
          chg1h: Number(chg1h.toFixed(1)),
          chg24h: Number(chg24h.toFixed(1)),
          vol24h: Math.round(vol24h),
          liquidity: Math.round(liq),
          conviction,
          reasons,
          url: p.url || "",
        });
      }
    }
  } catch (e) {
    return { ok: false, error: "brief_failed", message: `Analyst brief failed: ${e.message}` };
  }
  trending.sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.conviction] - { high: 3, medium: 2, low: 1 }[a.conviction]));
  return {
    ok: true,
    agent: "analyst",
    minConviction,
    calls: trending.slice(0, 8),
    generatedAt: new Date().toISOString(),
    note: "Conviction based on momentum + volume + liquidity. Not financial advice — verify with orbitx_agent_research before sizing in.",
  };
}

function analystControl(action, args) {
  const a = String(action || "status").toLowerCase();
  if (a === "start") {
    return {
      ok: true, agent: "analyst", action: "start",
      config: { minConviction: args.minConviction || "medium", pollMs: 60000 },
      message: "Analyst agent armed. Open the Token widget's 📊 Analyst tab — it scans every 60s while open and logs calls with track record. Runs while widget is open.",
      widgetAction: { tab: "analyst", startAgent: { minConviction: args.minConviction || "medium" } },
    };
  }
  if (a === "stop") {
    return { ok: true, agent: "analyst", action: "stop", message: "Analyst stop signal sent.", widgetAction: { tab: "analyst", stopAgent: true } };
  }
  return { ok: true, agent: "analyst", action: "status", message: "Analyst state lives in the Token widget (localStorage). Use action=brief for a one-shot server brief." };
}

/* ==================== 3. Portfolio Guardian Agent ==================== */

async function guardianCheck(auth, args) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const rules = Array.isArray(args.rules) ? args.rules : [];
  if (!rules.length) {
    return { ok: false, error: "no_rules", message: "Pass rules: [{mint, takeProfitPct, stopLossPct}]. Example: [{mint: '<ca>', takeProfitPct: 100, stopLossPct: 20}]." };
  }
  // Need current prices + entry prices. Entry prices aren't tracked server-side (no SQL),
  // so we report current state and let the widget (which knows entry) decide.
  const evaluations = [];
  for (const r of rules.slice(0, 20)) {
    const mint = String(r.mint || r.ca || "").trim();
    if (!PUBKEY_RE.test(mint)) { evaluations.push({ mint, error: "invalid_mint" }); continue; }
    try {
      const info = await tokenInfo(mint);
      evaluations.push({
        mint,
        symbol: info.symbol,
        priceUsd: info.priceUsd,
        takeProfitPct: num(r.takeProfitPct, 100),
        stopLossPct: num(r.stopLossPct, 20),
        note: "Entry price tracked in widget. Guardian tab computes TP/SL vs your entry and auto-sells while open.",
      });
    } catch { evaluations.push({ mint, error: "price_unavailable" }); }
  }
  return { ok: true, agent: "guardian", evaluations, note: "Full TP/SL automation runs in the Wallet widget's 🛡️ Guardian tab (it knows your entry prices)." };
}

function guardianControl(action, args) {
  const a = String(action || "status").toLowerCase();
  const rules = Array.isArray(args.rules) ? args.rules : [];
  if (a === "start") {
    return {
      ok: true, agent: "guardian", action: "start",
      config: { rules, pollMs: 30000 },
      message: `Guardian armed with ${rules.length} rule(s). Open the Wallet widget's 🛡️ Guardian tab — it watches prices every 30s and auto-sells on TP/SL while open. Runs while widget is open.`,
      widgetAction: { tab: "guardian", startAgent: { rules } },
    };
  }
  if (a === "stop") {
    return { ok: true, agent: "guardian", action: "stop", message: "Guardian stop signal sent.", widgetAction: { tab: "guardian", stopAgent: true } };
  }
  return { ok: true, agent: "guardian", action: "status", message: "Guardian state lives in the Wallet widget (localStorage). Use action=check with rules for a one-shot server evaluation." };
}

/* ==================== 4. Research Agent (full server-side deep dive) ==================== */

async function researchDeep(mint, depth) {
  const m = String(mint || "").trim();
  if (!PUBKEY_RE.test(m)) return { ok: false, error: "invalid_mint", message: "Pass a valid Solana token mint address." };
  const full = String(depth || "full").toLowerCase() !== "quick";
  const report = {
    mint: m, symbol: "?", name: "", priceUsd: 0, mcap: 0, liquidity: 0,
    safety: null, holders: null, whaleActivity: [], priceAction: null,
    verdict: "WAIT", confidence: 50, reasons: [],
  };
  // 1. DexScreener core
  try {
    const info = await tokenInfo(m);
    report.symbol = info.symbol; report.name = info.name;
    report.priceUsd = info.priceUsd; report.mcap = info.mcap; report.liquidity = info.liquidity;
    report.url = info.url;
    // Price action
    try {
      const j = await jget(`https://api.dexscreener.com/latest/dex/tokens/${m}`, 10_000);
      const p = (j.pairs || []).find((x) => String(x.chainId || "").toLowerCase() === "solana") || (j.pairs || [])[0] || {};
      report.priceAction = {
        chg5m: num(p.priceChange?.m5, 0), chg1h: num(p.priceChange?.h1, 0),
        chg6h: num(p.priceChange?.h6, 0), chg24h: num(p.priceChange?.h24, 0),
        vol24h: num(p.volume?.h24, 0), txns24h: p.txns?.h24 || null,
      };
    } catch { /* ignore */ }
  } catch { report.reasons.push("No DexScreener data — unverified token"); }
  // 2. Safety
  report.safety = await safetyQuick(m);
  // 3. Whale activity (recent large transfers)
  if (full) {
    try {
      const sigs = await rpc("getSignaturesForAddress", [m, { limit: 15 }], 10_000).catch(() => []);
      let solPrice = 0;
      try { solPrice = await solUsd(); } catch { /* ignore */ }
      for (const s of (sigs || []).slice(0, 6)) {
        try {
          const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }], 7000);
          if (!tx?.meta || tx.meta.err) continue;
          // Token balance changes for large holders
          const pre = tx.meta.preTokenBalances || [];
          const post = tx.meta.postTokenBalances || [];
          for (const pb of post) {
            if (pb.mint !== m) continue;
            const before = pre.find((x) => x.accountIndex === pb.accountIndex);
            const delta = num(pb.uiTokenAmount?.uiAmount, 0) - num(before?.uiTokenAmount?.uiAmount, 0);
            const usd = Math.abs(delta) * report.priceUsd;
            if (usd >= 5000 && delta !== 0) {
              report.whaleActivity.push({
                direction: delta > 0 ? "buy" : "sell",
                usd: Math.round(usd),
                time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
                url: `https://solscan.io/tx/${s.signature}`,
              });
            }
          }
          if (report.whaleActivity.length >= 5) break;
        } catch { /* skip */ }
      }
    } catch { /* ignore */ }
  }
  // 4. Verdict
  const s = report.safety.score;
  const pa = report.priceAction || {};
  let score = 50;
  const reasons = [];
  if (s >= 70) { score += 20; reasons.push(`Safety ${s}/100 — clean`); }
  else if (s >= 50) { score += 5; reasons.push(`Safety ${s}/100 — acceptable`); }
  else { score -= 20; reasons.push(`Safety ${s}/100 — risky (${report.safety.flags.slice(0, 3).join(", ")})`); }
  if (report.liquidity >= 100000) { score += 10; reasons.push(`$${Math.round(report.liquidity / 1000)}k liquidity — tradeable size`); }
  else if (report.liquidity < 10000) { score -= 15; reasons.push("Thin liquidity — slippage risk"); }
  const buys = report.whaleActivity.filter((w) => w.direction === "buy").length;
  const sells = report.whaleActivity.filter((w) => w.direction === "sell").length;
  if (buys > sells && buys > 0) { score += 10; reasons.push(`${buys} whale buy(s) vs ${sells} sell(s) recently`); }
  else if (sells > buys && sells > 0) { score -= 10; reasons.push(`${sells} whale sell(s) — distribution?`); }
  if ((pa.chg1h || 0) > 30) { score -= 5; reasons.push("Already +30% 1h — chasing risk"); }
  if ((pa.chg24h || 0) < -40) { score -= 5; reasons.push("Down 40%+ 24h — falling knife?"); }
  score = Math.max(5, Math.min(95, Math.round(score)));
  report.confidence = score;
  report.verdict = score >= 70 ? "BUY" : score >= 45 ? "WAIT" : "AVOID";
  report.reasons = reasons;
  report.generatedAt = new Date().toISOString();
  report.depth = full ? "full" : "quick";
  return { ok: true, agent: "research", report, note: "Not financial advice. Verify independently before trading." };
}

/* ==================== 5. Alpha Finder Agent ==================== */

async function alphaScan(args) {
  const minTrades = Math.max(3, Math.min(50, parseInt(args.minTrades || "5", 10) || 5));
  const timeframe = String(args.timeframe || "7d").toLowerCase();
  // Strategy: trending tokens → recent buyers → rank wallets by activity + profitability proxy
  let trending = [];
  try {
    const j = await jget("https://api.dexscreener.com/latest/dex/search?q=SOLANA", 12_000).catch(() => ({}));
    trending = (j.pairs || [])
      .filter((p) => String(p.chainId || "").toLowerCase() === "solana" && num(p.volume?.h24, 0) > 50000)
      .slice(0, 8);
  } catch (e) {
    return { ok: false, error: "scan_failed", message: `Alpha scan failed: ${e.message}` };
  }
  const walletStats = new Map(); // wallet -> {buys, volume, tokens:Set}
  for (const p of trending) {
    const mint = p.baseToken?.address;
    if (!mint || !PUBKEY_RE.test(mint)) continue;
    try {
      const sigs = await rpc("getSignaturesForAddress", [mint, { limit: 12 }], 9000).catch(() => []);
      const priceUsd = num(p.priceUsd, 0);
      for (const s of (sigs || []).slice(0, 8)) {
        try {
          const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }], 6000);
          if (!tx?.meta || tx.meta.err) continue;
          const pre = tx.meta.preTokenBalances || [];
          const post = tx.meta.postTokenBalances || [];
          for (const pb of post) {
            if (pb.mint !== mint) continue;
            const before = pre.find((x) => x.accountIndex === pb.accountIndex);
            const delta = num(pb.uiTokenAmount?.uiAmount, 0) - num(before?.uiTokenAmount?.uiAmount, 0);
            if (delta <= 0) continue; // only buys
            const usd = delta * priceUsd;
            if (usd < 500) continue;
            const owner = pb.owner;
            if (!owner || !PUBKEY_RE.test(owner)) continue;
            const st = walletStats.get(owner) || { buys: 0, volumeUsd: 0, tokens: new Set() };
            st.buys += 1;
            st.volumeUsd += usd;
            st.tokens.add(p.baseToken?.symbol || "?");
            walletStats.set(owner, st);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip token */ }
  }
  const ranked = [...walletStats.entries()]
    .map(([wallet, st]) => ({
      wallet,
      buys: st.buys,
      volumeUsd: Math.round(st.volumeUsd),
      tokens: [...st.tokens],
      // Hot streak score: buys * log(volume), diversity bonus
      hotScore: Math.round(st.buys * Math.log10(st.volumeUsd + 10) * (1 + st.tokens.size * 0.2) * 10) / 10,
    }))
    .filter((w) => w.buys >= minTrades)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 10)
    .map((w) => ({ ...w, url: `https://solscan.io/account/${w.wallet}` }));
  return {
    ok: true,
    agent: "alpha",
    timeframe,
    minTrades,
    scannedTokens: trending.length,
    wallets: ranked,
    generatedAt: new Date().toISOString(),
    note: ranked.length
      ? "Ranked by hot-streak score (buy frequency × volume × token diversity). Follow via orbitx_app_copy_follow or the Trade widget's ⚡ Alpha tab."
      : "No wallets met the threshold this scan — try a lower minTrades.",
  };
}

/* ==================== Tool definitions ==================== */

const authCodeProp = { type: "string", description: "Auth code (optional, improves limits)" };

export const AGENT_TOOLS = [
  {
    name: "orbitx_agent_snipe",
    description: "Sniper Agent: watches new launches and auto-buys ones passing safety filters. action=start|stop|status arms the widget agent; action=scan runs a one-shot server scan of new launches. Say 'start the sniper' or 'scan new launches'.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["start", "stop", "status", "scan"], description: "Default: status" },
        maxBuySol: { type: "number", description: "Max SOL per snipe buy (default 0.5, max 10)" },
        filters: { type: "object", description: "{minLiquidityUsd, maxDevPct, minScore, maxAgeMin}", additionalProperties: true },
        authCode: authCodeProp,
      },
    },
  },
  {
    name: "orbitx_agent_analyst",
    description: "Market Analyst Agent: 24/7 market watcher. action=brief returns high-conviction calls right now (momentum + volume + liquidity scored). action=start arms the widget agent. Say 'analyst brief' or 'what's the market saying'.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["start", "stop", "status", "brief"], description: "Default: brief" },
        minConviction: { type: "string", enum: ["low", "medium", "high"], description: "Minimum conviction filter" },
        authCode: authCodeProp,
      },
    },
  },
  {
    name: "orbitx_agent_guardian",
    description: "Portfolio Guardian Agent: auto take-profit and stop-loss. action=start with rules=[{mint, takeProfitPct, stopLossPct}] arms it; the widget executes while open. action=check evaluates rules against live prices. Say 'guard my portfolio'.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["start", "stop", "status", "check"], description: "Default: status" },
        rules: { type: "array", items: { type: "object", additionalProperties: true }, description: "[{mint, takeProfitPct, stopLossPct}]" },
        authCode: authCodeProp,
      },
    },
  },
  {
    name: "orbitx_agent_research",
    description: "Research Agent: full deep-dive on any token — safety audit, holder analysis, whale activity, price action, verdict (BUY/WAIT/AVOID with confidence %). Say 'research <mint>' or 'deep dive on BONK'.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address" },
        ca: { type: "string", description: "Alias for mint" },
        depth: { type: "string", enum: ["quick", "full"], description: "Default: full" },
        authCode: authCodeProp,
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_agent_alpha",
    description: "Alpha Finder Agent: finds the hottest copy-trade wallets RIGHT NOW by scanning recent buyers of trending tokens, ranked by hot-streak score. Say 'find alpha wallets'.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["scan"], description: "Default: scan" },
        minTrades: { type: "integer", description: "Min buys to qualify (default 5)" },
        timeframe: { type: "string", enum: ["24h", "7d", "30d"], description: "Analysis window label (default 7d)" },
        authCode: authCodeProp,
      },
    },
  },
];

const TOOL_NAMES = new Set(AGENT_TOOLS.map((t) => t.name));

export function isAgentTool(name) {
  return TOOL_NAMES.has(String(name || ""));
}

export async function dispatchAgentTool(name, args, ctx = {}) {
  const a = args || {};
  const { auth } = ctx;
  try {
    if (name === "orbitx_agent_snipe") {
      const action = String(a.action || "status").toLowerCase();
      if (action === "scan") return await snipeScan(a);
      return snipeControl(action, a);
    }
    if (name === "orbitx_agent_analyst") {
      const action = String(a.action || "brief").toLowerCase();
      if (action === "brief") return await analystBrief(a);
      return analystControl(action, a);
    }
    if (name === "orbitx_agent_guardian") {
      const action = String(a.action || "status").toLowerCase();
      if (action === "check") return await guardianCheck(auth, a);
      return guardianControl(action, a);
    }
    if (name === "orbitx_agent_research") {
      const mint = String(a.mint || a.ca || "").trim();
      return await researchDeep(mint, a.depth);
    }
    if (name === "orbitx_agent_alpha") {
      return await alphaScan(a);
    }
  } catch (e) {
    return { ok: false, error: "tool_error", message: e?.message || "unknown error" };
  }
  return null;
}
