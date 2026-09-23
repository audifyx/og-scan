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
  SOL_MINT,
} from "./_user-trading-wallet.js";

const DASH = "https://www.orbitx.world/supercomputer?tab=inapp";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function needAuth(auth) {
  if (auth?.userId) return { userId: auth.userId };
  return { ok: false, error: "auth_required", dashboard: DASH, message: "Link OrbitX auth first." };
}

async function sb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function tokenInfo(mint) {
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

async function solUsd() {
  const t = await tokenInfo(SOL_MINT);
  return t.priceUsd || 110;
}

async function walletRow(userId) {
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

async function tokenBalance(owner, mint) {
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
  const lamports = await solLamports(row.public_key);
  const usdcRaw = await tokenBalance(row.public_key, USDC);
  const px = await solUsd();
  return {
    ok: true,
    exists: true,
    signedOn: "backend",
    clickToSign: false,
    publicKey: row.public_key,
    sol: lamports / 1e9,
    solUsd: (lamports / 1e9) * px,
    usdc: usdcRaw / 1e6,
    perTradeCapUsd: Number(row.per_trade_cap_usd),
    dashboard: DASH,
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
  const pay = String(args.payWith || args.currency || args.with || "sol").toLowerCase();
  const useUsdc = pay.includes("usdc");
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
  const client = await sb();
  const order = {
    userId: gate.userId,
    wallet: row.public_key,
    mint,
    symbol: info.symbol,
    side,
    triggerPct: pct,
    entryUsd: info.priceUsd,
    targetUsd: target,
    entryMcap: info.mcap,
    status: "open",
    at: new Date().toISOString(),
  };
  if (client) {
    await client.from("ox_live_events").insert({
      kind: "app_limit",
      agent_id: gate.userId,
      mint,
      symbol: info.symbol,
      side,
      thesis: `${side} ${info.symbol} at ${pct}%`,
      meta: order,
    });
  }
  return { ok: true, signedOn: "backend", order, message: `Limit armed. ${side} ${info.symbol} when price hits $${target.toFixed(8)} (${pct}%). Backend will sign. No click.` };
}

export async function appWalletOrders(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: true, orders: [] };
  const { data } = await client.from("ox_live_events").select("meta,created_at,mint,symbol,side").eq("kind", "app_limit").eq("agent_id", gate.userId).order("created_at", { ascending: false }).limit(40);
  return { ok: true, orders: (data || []).map((r) => ({ ...(r.meta || {}), at: r.created_at })) };
}

export async function appWalletTickLimits(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const listed = await appWalletOrders(auth);
  const fills = [];
  for (const o of listed.orders || []) {
    if (o.status && o.status !== "open") continue;
    if (!o.mint || !o.targetUsd) continue;
    const info = await tokenInfo(o.mint);
    const hit = o.side === "sell" ? info.priceUsd >= Number(o.targetUsd) : info.priceUsd <= Number(o.targetUsd);
    if (!hit) continue;
    const fill = o.side === "sell"
      ? await appWalletSell(auth, { mint: o.mint, fraction: 1 })
      : await appWalletBuy(auth, { mint: o.mint, usd: 1 });
    fills.push({ order: o, fill });
  }
  return { ok: true, checked: (listed.orders || []).length, fills };
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
  if (name === "orbitx_app_limits_tick") return appWalletTickLimits(auth);
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
    description: "Arm a backend limit. Example: sell when up 15%. No click. Backend signs when hit.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, trigger: { type: "string" }, percent: { type: "number" }, side: { type: "string" }, authCode }, required: ["mint"] },
  },
  { name: "orbitx_app_orders", description: "Open MCP limit orders.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_limits_tick", description: "Check open limits and fill any that hit. Backend signs.", inputSchema: { type: "object", properties: { authCode } } },
];
