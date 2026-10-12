/**
 * DeFi Plus tools — staking dashboard, tax report, trailing stops,
 * NFT floor alerts, copy-trading leaderboard. Zero SQL: all chain data
 * via public RPC/APIs, widget-managed state via localStorage.
 */

const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "") ||
    "https://api.mainnet-beta.solana.com"
  );
}

async function rpc(method, params, timeoutMs = 15_000) {
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

const STAKE_PROGRAM = "Stake11111111111111111111111111111111111111";
const MSOL_MINT = "mSoLzYCxHdYgdzU16g5Qny1gp2U6rntU5pRz1jEG6g2";
const JITOSOL_MINT = "J1toso1uCk3RLmjorhT8F6S5Mnhvmc4b9aYV5u1j3";

/* ==================== Staking Positions ==================== */

async function stakingPositions(args) {
  const wallet = String(args.wallet || args.address || "").trim();
  if (!PUBKEY_RE.test(wallet)) {
    return { ok: false, error: "invalid_wallet", message: "Pass a valid Solana wallet address." };
  }
  const positions = [];

  // 1. Native stake accounts (delegated to validators)
  try {
    const accs = await rpc("getProgramAccounts", [
      STAKE_PROGRAM,
      {
        encoding: "jsonParsed",
        filters: [
          { dataSize: 200 },
          { memcmp: { offset: 12, bytes: wallet } }, // authorized staker offset
        ],
      },
    ], 20_000);
    for (const a of accs || []) {
      const info = a?.account?.data?.parsed?.info;
      if (!info) continue;
      const stake = info.stake;
      if (!stake?.delegation) continue;
      const lamports = Number(stake.delegation.stake || 0);
      if (lamports <= 0) continue;
      positions.push({
        protocol: "Native",
        type: "delegated",
        stakeAccount: a.pubkey,
        validator: stake.delegation.voter || null,
        amountSol: Number((lamports / 1e9).toFixed(4)),
        state: stake.delegation.activationEpoch ? "active" : "activating",
        apyPct: null, // validator APY varies; widget shows "varies"
      });
    }
  } catch (e) {
    // non-fatal; continue with LST checks
  }

  // 2. Liquid staking tokens (mSOL, jitoSOL) via token accounts
  try {
    const tas = await rpc("getTokenAccountsByOwner", [
      wallet,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]);
    const want = { [MSOL_MINT]: "Marinade", [JITOSOL_MINT]: "Jito" };
    for (const ta of tas?.value || []) {
      const ti = ta?.account?.data?.parsed?.info;
      const mint = ti?.mint;
      if (!want[mint]) continue;
      const amt = Number(ti?.tokenAmount?.uiAmount || 0);
      if (amt <= 0) continue;
      // Convert LST to SOL value via price ratio
      let solValue = amt;
      try {
        const pj = await jget(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        const priceUsd = Number(pj?.pairs?.[0]?.priceUsd || 0);
        const solPj = await jget("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
        const solUsd = Number(solPj?.pairs?.[0]?.priceUsd || 1);
        if (priceUsd > 0 && solUsd > 0) solValue = Number(((amt * priceUsd) / solUsd).toFixed(4));
      } catch { /* keep 1:1 fallback */ }
      positions.push({
        protocol: want[mint],
        type: "liquid",
        mint,
        amountLst: amt,
        amountSol: solValue,
        apyPct: want[mint] === "Marinade" ? 7.2 : 7.8, // approx; widget labels as estimate
        apyEstimated: true,
      });
    }
  } catch { /* ignore */ }

  const totalStakedSol = Number(positions.reduce((s, p) => s + (p.amountSol || 0), 0).toFixed(4));
  return {
    ok: true,
    wallet,
    positions,
    totalStakedSol,
    count: positions.length,
    note: positions.length === 0 ? "No native stake accounts, mSOL, or jitoSOL found for this wallet." : undefined,
  };
}

/* ==================== Tax Report (FIFO) ==================== */

async function taxReport(args) {
  const wallet = String(args.wallet || args.address || "").trim();
  if (!PUBKEY_RE.test(wallet)) {
    return { ok: false, error: "invalid_wallet", message: "Pass a valid Solana wallet address." };
  }
  const year = Math.max(2020, Math.min(2030, parseInt(args.year || new Date().getUTCFullYear(), 10) || new Date().getUTCFullYear()));
  const startTs = Date.UTC(year, 0, 1) / 1000;
  const endTs = Date.UTC(year + 1, 0, 1) / 1000;

  // Paginate signatures within the year (cap at 300 txs for sanity)
  const sigs = [];
  let before;
  try {
    while (sigs.length < 300) {
      const page = await rpc("getSignaturesForAddress", [wallet, { limit: 100, ...(before ? { before } : {}) }], 15_000);
      if (!page || page.length === 0) break;
      let stop = false;
      for (const s of page) {
        if (!s.blockTime) continue;
        if (s.blockTime < startTs) { stop = true; break; }
        if (s.blockTime < endTs) sigs.push(s);
      }
      before = page[page.length - 1].signature;
      if (stop || page.length < 100) break;
    }
  } catch (e) {
    return { ok: false, error: "rpc_error", message: `Could not fetch history: ${e.message}` };
  }

  // SOL price helper (coarse: use one price per month via dexscreener history is overkill;
  // use current SOL price as estimate and label clearly)
  let solUsd = 0;
  try {
    const pj = await jget("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
    solUsd = Number(pj?.pairs?.[0]?.priceUsd || 0);
  } catch { /* ignore */ }

  // FIFO lots per token mint: [{qty, costUsd}]
  const lots = {}; // mint -> array of {qty, unitCostUsd}
  const rows = [];
  let buys = 0, sells = 0, realizedPnl = 0;

  const batch = sigs.slice(0, 120); // parse at most 120 for speed
  for (const s of batch) {
    let tx;
    try {
      tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }], 8_000);
    } catch { continue; }
    if (!tx?.meta || tx.meta.err) continue;
    const date = new Date(s.blockTime * 1000).toISOString().slice(0, 10);

    // Token balance changes for the wallet
    const pre = tx.meta.preTokenBalances || [];
    const post = tx.meta.postTokenBalances || [];
    const byKey = {};
    for (const b of pre) byKey[`${b.accountIndex}:${b.mint}`] = b;
    for (const b of post) {
      const k = `${b.accountIndex}:${b.mint}`;
      const p = byKey[k];
      const preAmt = Number(p?.uiTokenAmount?.uiAmount || 0);
      const postAmt = Number(b.uiTokenAmount?.uiAmount || 0);
      const delta = postAmt - preAmt;
      if (Math.abs(delta) < 1e-9) continue;
      const mint = b.mint;
      // Estimate USD: use SOL price for wSOL, else mark unknown
      const isSol = mint === "So11111111111111111111111111111111111111112";
      const unitUsd = isSol ? solUsd : 0;
      if (delta > 0) {
        // BUY: add lot
        if (!lots[mint]) lots[mint] = [];
        lots[mint].push({ qty: delta, unitCostUsd: unitUsd });
        buys++;
        rows.push({ date, type: "buy", token: mint.slice(0, 8), amount: Number(delta.toFixed(6)), priceUsd: unitUsd || null, signature: s.signature });
      } else {
        // SELL: FIFO consume
        const qty = Math.abs(delta);
        let remaining = qty;
        let costUsd = 0;
        const q = lots[mint] || [];
        while (remaining > 1e-9 && q.length) {
          const lot = q[0];
          const take = Math.min(lot.qty, remaining);
          costUsd += take * lot.unitCostUsd;
          lot.qty -= take;
          remaining -= take;
          if (lot.qty <= 1e-9) q.shift();
        }
        const proceedsUsd = isSol && solUsd ? qty * solUsd : 0;
        const pnl = proceedsUsd - costUsd;
        if (isSol && solUsd) { realizedPnl += pnl; }
        sells++;
        rows.push({
          date, type: "sell", token: mint.slice(0, 8),
          amount: Number(qty.toFixed(6)),
          proceedsUsd: proceedsUsd ? Number(proceedsUsd.toFixed(2)) : null,
          costBasisUsd: costUsd ? Number(costUsd.toFixed(2)) : null,
          pnlUsd: (isSol && solUsd) ? Number(pnl.toFixed(2)) : null,
          signature: s.signature,
        });
      }
    }
  }

  return {
    ok: true,
    wallet,
    year,
    summary: {
      transactionsScanned: batch.length,
      buys,
      sells,
      realizedPnlUsd: Number(realizedPnl.toFixed(2)),
      priceNote: "USD values use current SOL price as estimate (historical pricing unavailable without API key). Token (non-SOL) USD values not estimated.",
    },
    rows: rows.slice(0, 200),
    csvReady: true,
    truncated: sigs.length >= 300 || batch.length < sigs.length,
  };
}

/* ==================== Trailing Stop (widget-managed) ==================== */

function trailingStop(args) {
  const mint = String(args.mint || args.ca || "").trim();
  if (!PUBKEY_RE.test(mint)) {
    return { ok: false, error: "bad_mint", message: "mint must be a valid Solana token address." };
  }
  const trailPercent = Number(args.trailPercent || args.trailPct || 10);
  if (!Number.isFinite(trailPercent) || trailPercent <= 0 || trailPercent > 90) {
    return { ok: false, error: "bad_trail", message: "trailPercent must be between 0 and 90." };
  }
  const amount = args.amount !== undefined ? String(args.amount) : "100%";
  const configId = `ts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const config = {
    configId,
    mint,
    trailPercent,
    amount,
    status: "armed",
    peakUsd: null, // widget fills on first poll
    createdAt: new Date().toISOString(),
  };
  return {
    ok: true,
    config,
    message: `Trailing stop armed: sells ${amount} of ${mint.slice(0, 8)}… if price drops ${trailPercent}% below peak. Managed in the Trade widget (runs while open).`,
    widgetAction: { tab: "trailing", importConfig: config },
  };
}

/* ==================== NFT Floor ==================== */

async function nftFloor(args) {
  const collection = String(args.collection || args.slug || "").trim();
  if (!collection) {
    return { ok: false, error: "collection_required", message: "Pass a Magic Eden collection slug (e.g. degods) or collection address." };
  }
  // Magic Eden stats endpoint works with slug
  try {
    const st = await jget(`https://api-mainnet.magiceden.dev/v2/collections/${encodeURIComponent(collection)}/stats`);
    const floorLamports = Number(st?.floorPrice || 0);
    const floorSol = floorLamports / 1e9;
    let solUsd = 0;
    try {
      const pj = await jget("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
      solUsd = Number(pj?.pairs?.[0]?.priceUsd || 0);
    } catch { /* ignore */ }
    return {
      ok: true,
      collection,
      name: st?.symbol || collection,
      floorSol: Number(floorSol.toFixed(4)),
      floorUsd: solUsd ? Number((floorSol * solUsd).toFixed(2)) : null,
      listedCount: Number(st?.listedCount || 0),
      totalSupply: Number(st?.supply || 0),
      lastUpdated: new Date().toISOString(),
      source: "Magic Eden",
    };
  } catch (e) {
    return {
      ok: false,
      error: "not_found",
      message: `Could not fetch floor for "${collection}". Use a Magic Eden collection slug (e.g. degods, okay_bears).`,
    };
  }
}

/* ==================== Copy Leaderboard ==================== */

async function copyLeaderboard(args, ctx = {}) {
  // We need the user's followed wallets. Try the copy handler's list via ctx,
  // else return widget-managed instructions.
  const listFn = ctx.appCopyList;
  let follows = [];
  if (typeof listFn === "function") {
    try {
      const r = await listFn(ctx.auth || {});
      follows = r?.follows || r?.wallets || [];
    } catch { /* fall through */ }
  }
  if (!follows.length) {
    return {
      ok: true,
      entries: [],
      message: "No followed wallets found (or not signed in). Follow wallets with orbitx_app_copy_follow, then check back.",
      managedBy: "widget",
    };
  }
  // For each followed wallet, get recent PnL via wallet tools if available
  const pnlFn = ctx.walletPnl;
  const entries = [];
  for (const f of follows.slice(0, 10)) {
    const wallet = f.wallet || f.address || f;
    let pnlUsd = null, winRate = null;
    if (typeof pnlFn === "function" && PUBKEY_RE.test(String(wallet))) {
      try {
        const p = await pnlFn({ wallet: String(wallet) });
        pnlUsd = Number(p?.totalPnlUsd ?? p?.pnlUsd ?? NaN);
        if (!Number.isFinite(pnlUsd)) pnlUsd = null;
        winRate = Number(p?.winRate ?? NaN);
        if (!Number.isFinite(winRate)) winRate = null;
      } catch { /* leave null */ }
    }
    entries.push({
      wallet: String(wallet),
      label: f.label || f.name || `${String(wallet).slice(0, 4)}…${String(wallet).slice(-4)}`,
      pnlUsd,
      winRate,
      followed: true,
    });
  }
  entries.sort((a, b) => (b.pnlUsd ?? -Infinity) - (a.pnlUsd ?? -Infinity));
  return { ok: true, entries, count: entries.length };
}

/* ==================== Tool registry ==================== */

export const DEFI_PLUS_TOOLS = [
  {
    name: "orbitx_staking_positions",
    description: "Staking dashboard data: native SOL stake accounts, Marinade mSOL and Jito jitoSOL positions for any wallet. Returns per-protocol amounts, APY estimates, and total staked.",
    inputSchema: { type: "object", properties: { wallet: { type: "string" }, address: { type: "string" } }, required: ["wallet"] },
  },
  {
    name: "orbitx_tax_report",
    description: "Tax report: scans a wallet's transaction history for a year, calculates realized PnL with FIFO cost basis, returns CSV-ready rows. USD values estimated from current SOL price (labeled).",
    inputSchema: { type: "object", properties: { wallet: { type: "string" }, address: { type: "string" }, year: { type: "number" } }, required: ["wallet"] },
  },
  {
    name: "orbitx_trailing_stop",
    description: "Arm a widget-managed trailing stop: sells when price drops X% below the peak seen since arming. Returns a config for the Trade widget (runs while widget is open, polls price, auto-sells via orbitx_app_sell).",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, ca: { type: "string" }, trailPercent: { type: "number" }, trailPct: { type: "number" }, amount: { type: ["string", "number"] } }, required: ["mint"] },
  },
  {
    name: "orbitx_nft_floor",
    description: "NFT floor price for a collection. Pass a Magic Eden slug (e.g. degods). Returns floor in SOL and USD, listed count, supply.",
    inputSchema: { type: "object", properties: { collection: { type: "string" }, slug: { type: "string" } }, required: ["collection"] },
  },
  {
    name: "orbitx_copy_leaderboard",
    description: "Copy-trading leaderboard: your followed wallets ranked by recent PnL. Follow more with orbitx_app_copy_follow.",
    inputSchema: { type: "object", properties: {} },
  },
];

const TOOL_NAMES = new Set(DEFI_PLUS_TOOLS.map((t) => t.name));

export function isDefiPlusTool(name) {
  return TOOL_NAMES.has(String(name || ""));
}

export async function dispatchDefiPlusTool(name, args, ctx = {}) {
  const a = args || {};
  try {
    if (name === "orbitx_staking_positions") return await stakingPositions(a);
    if (name === "orbitx_tax_report") return await taxReport(a);
    if (name === "orbitx_trailing_stop") return trailingStop(a);
    if (name === "orbitx_nft_floor") return await nftFloor(a);
    if (name === "orbitx_copy_leaderboard") return await copyLeaderboard(a, ctx);
  } catch (e) {
    return { ok: false, error: "tool_error", message: e?.message || "unknown error" };
  }
  return null;
}
