/**
 * MCP trading wallet — backend signs. No Phantom popup. No sign link.
 * Key is AES-GCM encrypted in agent_delegated_wallets. User can export anytime.
 */
import {
  getUserWallet,
  createUserWallet,
  exportUserWalletSecret,
  revokeUserWallet,
  signUserSwap,
  getDeskSolLamports,
  getDeskFunds,
  SOL_MINT,
} from "./_user-trading-wallet.js";
import { appLaunch, appClaimFees, appBurn, APP_DESK_OPS_TOOLS } from "./_mcp-app-desk-ops.js";
// NOTE: strategy feature modules (_mcp-copy, _mcp-trailing, _mcp-sniper,
// _mcp-alerts, _mcp-pnl) import helpers from THIS file. This file must NOT
// statically import them back (ESM cycle → TDZ crash when a feature module
// is the import-graph entry). Their TOOLS arrays are registered in
// orbitx-hub.js CORE_TOOLS; dispatch below reaches them via dynamic import
// (module-cache hit in production).

const DASH = "https://www.orbitx.world/supercomputer?tab=inapp";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC = USDC_MINT;

export function needAuth(auth) {
  if (auth?.userId) return { userId: auth.userId };
  return { ok: false, error: "auth_required", dashboard: DASH, message: "Link OrbitX auth first." };
}

export async function sb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function tokenInfo(mint) {
  const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + mint, { signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  const p = (j.pairs || []).find((x) => String(x.chainId || "").toLowerCase() === "solana") || (j.pairs || [])[0] || {};
  return {
    mint,
    symbol: p.baseToken?.symbol || "?",
    name: p.baseToken?.name || "",
    priceUsd: Number(p.priceUsd || 0),
    mcap: Number(p.marketCap || p.fdv || 0),
    liquidity: Number(p.liquidity?.usd || 0),
    url: p.url || "",
  };
}

export async function solUsd() {
  const t = await tokenInfo(SOL_MINT);
  return t.priceUsd || 110;
}

export async function walletRow(userId) {
  return getUserWallet(userId);
}

async function ensureWallet(userId, agentId) {
  const existing = await walletRow(userId);
  if (existing) return existing;
  await createUserWallet(userId);
  return walletRow(userId);
}

function receipt({ side, info, usd, signature, owner, payWith }) {
  return {
    ok: true,
    signedOn: "backend",
    clickToSign: false,
    side,
    payWith: payWith || "SOL",
    symbol: info.symbol,
    mint: info.mint,
    entryUsd: info.priceUsd,
    entryMcap: info.mcap,
    usd,
    signature,
    wallet: owner,
    tx: signature ? `https://solscan.io/tx/${signature}` : null,
    chart: info.url,
    headline: `${side.toUpperCase()} ${info.symbol} @ $${info.priceUsd} · MC $${Math.round(info.mcap).toLocaleString()}`,
    imagePrompt: `Dark neon crypto trade receipt card, OrbitX, ${side.toUpperCase()} ${info.symbol}, entry $${info.priceUsd}, market cap $${Math.round(info.mcap).toLocaleString()}, tx success, no logos of other brands.`,
  };
}

export async function tokenBalance(owner, mint) {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [owner, { mint }, { encoding: "jsonParsed" }],
    }),
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  return (j?.result?.value || []).reduce((s, a) => s + Number(a?.account?.data?.parsed?.info?.tokenAmount?.amount || 0), 0);
}

async function solLamports(owner) {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [owner] }),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json();
  return Number(j?.result?.value || 0);
}

export async function appWalletStatus(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) {
    return { ok: true, exists: false, signedOn: "backend", dashboard: DASH, message: "No wallet yet. Say create a wallet." };
  }
  const funds = await getDeskFunds(row.public_key);
  const px = await solUsd();
  const solUsdVal = funds.sol * px;
  const totalUsd = solUsdVal + funds.usdc;
  return {
    ok: true,
    exists: true,
    signedOn: "backend",
    clickToSign: false,
    publicKey: row.public_key,
    sol: funds.sol,
    solUsd: solUsdVal,
    usdc: funds.usdc,
    wsol: funds.wsol,
    totalUsd,
    rpc: funds.rpc,
    rpcError: funds.error,
    perTradeCapUsd: Number(row.per_trade_cap_usd) || 250,
    dashboard: DASH,
    message: `Desk ${row.public_key} · ${funds.sol.toFixed(4)} SOL ($${solUsdVal.toFixed(2)}) + ${funds.usdc.toFixed(2)} USDC = $${totalUsd.toFixed(2)} spendable.`,
  };
}

export async function appWalletCreate(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await ensureWallet(gate.userId, auth?.agentId);
  return {
    ok: true,
    created: true,
    publicKey: row.public_key,
    signedOn: "backend",
    clickToSign: false,
    owner: "user",
    notOrbitXTreasury: true,
    fund: "This pubkey is YOURS. Fund YOUR SOL or USDC. Not the OrbitX owner wallet.",
    exportHint: "Say export wallet for YOUR private key.",
  };
}

export async function appWalletExport(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const secret = await exportUserWalletSecret(row);
  return {
    ok: true,
    publicKey: row.public_key,
    secretKeyBase58: secret,
    warning: "Private key. Anyone with it can empty the wallet.",
  };
}

export async function appWalletRevoke(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  await revokeUserWallet(gate.userId);
  return { ok: true, revoked: true };
}

export async function appWalletBuy(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first." };
  const mint = String(args.mint || args.ca || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: "bad_mint" };
  const funds = await getDeskFunds(row.public_key);
  const pay = String(args.payWith || args.currency || args.with || "").toLowerCase();
  let useUsdc = pay.includes("usdc");
  if (!pay) useUsdc = funds.usdc >= 1 && funds.sol * 110 < 1;
  const px = await solUsd();
  let usd = Number(args.usd || args.amountUsd || 0);
  if (!usd && args.amountSol) usd = Number(args.amountSol) * px;
  if (!usd && args.amountUsdc) usd = Number(args.amountUsdc);
  if (!usd) usd = Number(args.amount) || 1;
  const info = await tokenInfo(mint);
  let inputMint = SOL_MINT;
  let amount = Math.floor((usd / px) * 1e9);
  if (useUsdc) {
    inputMint = USDC;
    amount = Math.floor(usd * 1e6);
  }
  if (amount <= 0) return { ok: false, error: "size" };
  const live = await signUserSwap(row, { inputMint, outputMint: mint, amount });
  const rec = receipt({ side: "buy", info, usd, signature: live.signature, owner: live.owner, payWith: useUsdc ? "USDC" : "SOL" });
  rec.imageHint = "Call orbitx_generate_image with imagePrompt to show the fill card.";
  return rec;
}

export async function appWalletSell(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const mint = String(args.mint || args.ca || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: "bad_mint" };
  const raw = await tokenBalance(row.public_key, mint);
  let amt = raw;
  if (args.percent != null || args.fraction != null) {
    const f = args.fraction != null ? Number(args.fraction) : Number(args.percent) / 100;
    amt = Math.floor(raw * Math.min(1, Math.max(0.01, f)));
  } else if (args.amount) {
    amt = Math.floor(Number(args.amount));
  }
  if (amt <= 0) return { ok: false, error: "no_balance" };
  const info = await tokenInfo(mint);
  const live = await signUserSwap(row, { inputMint: mint, outputMint: SOL_MINT, amount: amt });
  return receipt({ side: "sell", info, usd: 0, signature: live.signature, owner: live.owner, payWith: "SOL" });
}

export async function appWalletLimit(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const mint = String(args.mint || args.ca || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: "bad_mint" };
  const info = await tokenInfo(mint);
  const pct = Number(String(args.trigger || args.percent || args.up || "15").replace(/[^\d.\-]/g, "")) || 15;
  const side = String(args.side || "sell").toLowerCase() === "buy" ? "buy" : "sell";
  const target = info.priceUsd * (side === "sell" ? 1 + pct / 100 : 1 - Math.abs(pct) / 100);
  // Persist the fill size so the tick fills exactly what was armed (not a hardcoded default).
  const size = {};
  if (side === "sell") {
    // NOTE: `percent` is the trigger here (legacy); sell size uses `fraction` (0-1) or `amount` (raw tokens).
    if (args.fraction != null && args.fraction !== "") size.fraction = Math.min(1, Math.max(0.01, Number(args.fraction)));
    else if (args.amount != null && args.amount !== "") size.amount = String(args.amount);
    else size.fraction = 1;
  } else {
    if (args.usd != null && args.usd !== "") size.usd = Number(args.usd);
    else if (args.amountUsd != null && args.amountUsd !== "") size.usd = Number(args.amountUsd);
    else if (args.amountSol != null && args.amountSol !== "") size.amountSol = Number(args.amountSol);
    else if (args.amountUsdc != null && args.amountUsdc !== "") size.amountUsdc = Number(args.amountUsdc);
    else size.usd = 1;
    if (args.payWith) size.payWith = String(args.payWith);
  }
  const client = await sb();
  const order = {
    userId: gate.userId,
    wallet: row.public_key,
    mint,
    symbol: info.symbol,
    side,
    size,
    triggerPct: pct,
    entryUsd: info.priceUsd,
    targetUsd: target,
    entryMcap: info.mcap,
    status: "open",
    attempts: 0,
    at: new Date().toISOString(),
  };
  if (!client) {
    return { ok: false, error: "db_unavailable", message: "Limit could not be armed — order store unreachable. Retry in a minute." };
  }
  await client.from("ox_live_events").insert({
    kind: "app_limit",
    agent_id: gate.userId,
    mint,
    symbol: info.symbol,
    side,
    thesis: `${side} ${info.symbol} at ${pct}%`,
    meta: order,
  });
  const sizeTxt = side === "sell"
    ? (size.fraction != null ? `${Math.round(size.fraction * 100)}%` : `${size.amount} tokens`)
    : (size.usd != null ? `$${size.usd}` : size.amountSol != null ? `${size.amountSol} SOL` : `${size.amountUsdc} USDC`);
  return { ok: true, signedOn: "backend", order, message: `Limit armed. ${side.toUpperCase()} ${sizeTxt} ${info.symbol} when price hits $${target.toFixed(8)} (${pct}%). Backend auto-fills. No click.` };
}

export async function appWalletOrders(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: true, orders: [] };
  const { data } = await client.from("ox_live_events").select("id,meta,created_at,mint,symbol,side").eq("kind", "app_limit").eq("agent_id", gate.userId).order("created_at", { ascending: false }).limit(40);
  return { ok: true, orders: (data || []).map((r) => ({ orderId: r.id, ...(r.meta || {}), at: r.created_at })) };
}

function fillArgsFor(order) {
  const s = order.size || {};
  if (order.side === "sell") {
    if (s.fraction != null) return { mint: order.mint, fraction: Number(s.fraction) };
    if (s.amount != null) return { mint: order.mint, amount: s.amount };
    return { mint: order.mint, fraction: 1 };
  }
  const a = { mint: order.mint };
  if (s.usd != null) a.usd = Number(s.usd);
  else if (s.amountSol != null) a.amountSol = Number(s.amountSol);
  else if (s.amountUsdc != null) a.amountUsdc = Number(s.amountUsdc);
  else a.usd = 1;
  if (s.payWith) a.payWith = s.payWith;
  return a;
}

// Errors that will never succeed on retry — fail the order immediately.
const LIMIT_FATAL = new Set(["no_balance", "no_wallet", "bad_mint", "size", "need_size"]);
const LIMIT_MAX_ATTEMPTS = 10;

export async function tickUserLimits(userId) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const { data } = await client.from("ox_live_events").select("id,meta").eq("kind", "app_limit").eq("agent_id", userId).order("created_at", { ascending: false }).limit(100);
  const fills = [];
  let checked = 0;
  for (const r of data || []) {
    const o = r.meta || {};
    if ((o.status || "open") !== "open") continue;
    if (!o.mint || !o.targetUsd) continue;
    checked += 1;
    let info;
    try {
      info = await tokenInfo(o.mint);
    } catch {
      continue; // price feed hiccup — retry next tick, don't burn an attempt
    }
    if (!info.priceUsd) continue;
    const hit = o.side === "sell" ? info.priceUsd >= Number(o.targetUsd) : info.priceUsd <= Number(o.targetUsd);
    if (!hit) continue;
    const auth = { userId };
    let fill;
    try {
      fill = o.side === "sell" ? await appWalletSell(auth, fillArgsFor(o)) : await appWalletBuy(auth, fillArgsFor(o));
    } catch (e) {
      fill = { ok: false, error: "fill_threw", message: e?.message || String(e) };
    }
    const attempts = Number(o.attempts || 0) + 1;
    const fatal = fill && !fill.ok && LIMIT_FATAL.has(String(fill.error || ""));
    const status = fill && fill.ok ? "filled" : fatal || attempts >= LIMIT_MAX_ATTEMPTS ? "failed" : "open";
    const patch = {
      ...o,
      status,
      attempts,
      lastCheckAt: new Date().toISOString(),
      ...(status !== "open"
        ? { filledAt: new Date().toISOString(), lastFill: { ok: !!fill?.ok, error: fill?.error || null, message: fill?.message || null, signature: fill?.signature || null, priceUsd: info?.priceUsd ?? null, size: o.size || null } }
        : { lastError: fill?.error || fill?.message || null }),
    };
    try {
      await client.from("ox_live_events").update({ meta: patch }).eq("id", r.id);
    } catch {
      /* status write is best-effort; the fill itself already happened or failed */
    }
    fills.push({ orderId: r.id, mint: o.mint, side: o.side, status, attempts, fill: { ok: !!fill?.ok, error: fill?.error || null, signature: fill?.signature || null } });
  }
  return { ok: true, checked, fills };
}

export async function appWalletTickLimits(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  return tickUserLimits(gate.userId);
}

/** Cron sweep: tick every user that has limit rows. Per-user failures never stop the sweep. */
export async function tickAllLimits({ maxUsers = 200 } = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const { data } = await client.from("ox_live_events").select("agent_id").eq("kind", "app_limit").limit(2000);
  const users = [...new Set((data || []).map((r) => r.agent_id).filter(Boolean))].slice(0, maxUsers);
  const results = [];
  for (const userId of users) {
    try {
      const r = await tickUserLimits(userId);
      if ((r.fills || []).length || !r.ok) results.push({ userId, ...r });
    } catch (e) {
      results.push({ userId, ok: false, error: e?.message || String(e) });
    }
  }
  return { ok: true, users: users.length, active: results.length, results };
}

export async function appWalletCancelOrder(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const idArg = String(args.orderId || args.id || "").trim();
  const mintArg = String(args.mint || args.ca || "").trim();
  if (!idArg && !mintArg) return { ok: false, error: "need_order", message: "Pass orderId (from orbitx_app_orders) or mint." };
  const { data } = await client.from("ox_live_events").select("id,meta").eq("kind", "app_limit").eq("agent_id", gate.userId).limit(100);
  const targets = (data || []).filter((r) => {
    if ((r.meta?.status || "open") !== "open") return false;
    if (idArg) return String(r.id) === idArg;
    return String(r.meta?.mint || "") === mintArg;
  });
  if (!targets.length) return { ok: false, error: "order_not_found", message: "No open order matches." };
  const now = new Date().toISOString();
  for (const t of targets) {
    await client.from("ox_live_events").update({ meta: { ...(t.meta || {}), status: "cancelled", cancelledAt: now } }).eq("id", t.id);
  }
  return { ok: true, cancelled: targets.map((t) => ({ orderId: t.id, mint: t.meta?.mint, side: t.meta?.side, symbol: t.meta?.symbol })) };
}

export async function dispatchAppWalletTool(name, args, auth) {
  if (name === "orbitx_app_wallet") return appWalletStatus(auth);
  if (name === "orbitx_app_wallet_create") return appWalletCreate(auth);
  if (name === "orbitx_app_wallet_export") return appWalletExport(auth);
  if (name === "orbitx_app_wallet_revoke") return appWalletRevoke(auth);
  if (name === "orbitx_app_buy") return appWalletBuy(auth, args || {});
  if (name === "orbitx_app_sell") return appWalletSell(auth, args || {});
  if (name === "orbitx_app_limit") return appWalletLimit(auth, args || {});
  if (name === "orbitx_app_orders") return appWalletOrders(auth);
  if (name === "orbitx_app_cancel_order") return appWalletCancelOrder(auth, args || {});
  if (name === "orbitx_app_limits_tick") return appWalletTickLimits(auth);
  if (name === "orbitx_app_launch") return appLaunch(auth, args || {});
  if (name === "orbitx_app_claim" || name === "orbitx_app_claim_fees") return appClaimFees(auth, args || {});
  if (name === "orbitx_app_burn") return appBurn(auth, args || {});
  // Strategy families: copy-trading, trailing stops + ladders, sniper,
  // alerts, PnL. Dynamic import so a broken strategy module can never
  // take down the core trading dispatcher.
  const strategyDispatchers = [
    ["./_mcp-copy.js", "dispatchCopyTools"],
    ["./_mcp-trailing.js", "dispatchTrailingTools"],
    ["./_mcp-sniper.js", "dispatchSniperTools"],
    ["./_mcp-alerts.js", "dispatchAlertTools"],
    ["./_mcp-pnl.js", "dispatchPnlTools"],
  ];
  for (const [modPath, fnName] of strategyDispatchers) {
    try {
      const mod = await import(modPath);
      const fn = mod[fnName];
      if (typeof fn === "function") {
        const out = await fn(name, args, auth);
        if (out) return out;
      }
    } catch {
      /* strategy module failure is isolated; core tools keep working */
    }
  }
  return null;
}

export function isAppWalletTool(name) {
  return String(name || "").startsWith("orbitx_app_");
}

const authCode = { type: "string" };

export const APP_WALLET_CORE_TOOLS = [
  { name: "orbitx_app_wallet", description: "In-app trading wallet. Backend signs. No popup.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_wallet_create", description: "Create trading wallet. Backend keeps encrypted key and signs in background.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_wallet_export", description: "Export private key to the user. Only when they ask.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_wallet_revoke", description: "Revoke backend signing for this wallet.", inputSchema: { type: "object", properties: { authCode } } },
  {
    name: "orbitx_app_buy",
    description: "Buy a token now. Backend signs. payWith: sol | usdc. usd or amountSol or amountUsdc.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, usd: { type: "number" }, amountSol: { type: "number" }, amountUsdc: { type: "number" }, payWith: { type: "string" }, authCode }, required: ["mint"] },
  },
  {
    name: "orbitx_app_sell",
    description: "Sell now. Backend signs. percent 1-100 or fraction 0-1.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, percent: { type: "number" }, fraction: { type: "number" }, authCode }, required: ["mint"] },
  },
  {
    name: "orbitx_app_limit",
    description: "Arm a backend limit order. trigger/percent = trigger move % (e.g. 15 = sell when up 15%). Sell size: fraction 0-1 or amount (raw tokens), default 100%. Buy size: usd/amountSol/amountUsdc, default $1. Backend checks every few minutes and signs the fill when hit. No click.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, trigger: { type: "string" }, percent: { type: "number" }, fraction: { type: "number" }, amount: { type: ["number", "string"] }, usd: { type: "number" }, amountSol: { type: "number" }, amountUsdc: { type: "number" }, payWith: { type: "string" }, side: { type: "string" }, authCode }, required: ["mint"] },
  },
  {
    name: "orbitx_app_cancel_order",
    description: "Cancel an open backend limit order. Pass orderId (from orbitx_app_orders) or mint to cancel all open orders for that mint.",
    inputSchema: { type: "object", properties: { orderId: { type: "string" }, mint: { type: "string" }, authCode }, },
  },
  { name: "orbitx_app_orders", description: "List limit orders (open, filled, failed, cancelled) with orderId.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_limits_tick", description: "Check open limits and fill any that hit. Backend signs.", inputSchema: { type: "object", properties: { authCode } } },
  ...APP_DESK_OPS_TOOLS,
];
