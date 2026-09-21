/**
 * In-app MCP wallet — user owns the key, MCP can buy/sell without a popup.
 * Secret lives encrypted in agent_delegated_wallets. Export anytime.
 */
import {
  activeDelegatedWallet,
  createAppWallet,
  exportDelegatedSecret,
  enforceDelegatedCaps,
  jupiterSwapDelegated,
  recordDelegatedTrade,
  revokeDelegatedWallet,
  SOL_MINT,
} from "./_delegated-wallet.js";

const DASH = "https://www.orbitx.world/supercomputer?tab=inapp";

function needAuth(auth) {
  const userId = auth?.userId || null;
  if (!userId) {
    return {
      ok: false,
      error: "auth_required",
      message: "Link OrbitX auth first, then create an in-app wallet.",
      dashboard: DASH,
      authHint: "Call orbitx_auth_status with your dashboard authCode.",
    };
  }
  return { userId };
}

async function balance(pubkey) {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
  const out = { pubkey, sol: 0, usd: 0 };
  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [pubkey] }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    out.sol = Number(j?.result?.value || 0) / 1e9;
  } catch {}
  try {
    const pr = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + SOL_MINT, { signal: AbortSignal.timeout(6000) });
    const pj = await pr.json();
    const px = Number(pj?.pairs?.[0]?.priceUsd || 0);
    if (px) out.usd = out.sol * px;
  } catch {}
  return out;
}

export async function appWalletStatus(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await activeDelegatedWallet(gate.userId);
  if (!row) {
    return {
      ok: true,
      exists: false,
      dashboard: DASH,
      message: "No in-app wallet yet. Say create in-app wallet or open the Super Computer In-app tab.",
    };
  }
  const chain = await balance(row.public_key);
  return {
    ok: true,
    exists: true,
    publicKey: row.public_key,
    perTradeCapUsd: Number(row.per_trade_cap_usd),
    lifetimeCapUsd: Number(row.lifetime_cap_usd),
    expiresAt: row.expires_at,
    chain,
    dashboard: DASH,
    exportHint: "Call orbitx_app_wallet_export when you want the private key. You own it.",
  };
}

export async function appWalletCreate(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const existing = await activeDelegatedWallet(gate.userId);
  if (existing) {
    const chain = await balance(existing.public_key);
    return { ok: true, exists: true, publicKey: existing.public_key, chain, message: "Already have an in-app wallet." };
  }
  const created = await createAppWallet(gate.userId, auth?.agentId || null);
  return {
    ok: true,
    created: true,
    publicKey: created.publicKey,
    dashboard: DASH,
    fund: "Send SOL to this address. Then say buy $1 of <mint>.",
    exportHint: "Export the private key anytime with orbitx_app_wallet_export.",
  };
}

export async function appWalletExport(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await activeDelegatedWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create an in-app wallet first." };
  const secret = await exportDelegatedSecret(row);
  return {
    ok: true,
    publicKey: row.public_key,
    secretKeyBase58: secret,
    warning: "This is the private key. Anyone with it can empty the wallet. Store offline. OrbitX will not show it again unless you export.",
  };
}

export async function appWalletRevoke(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  await revokeDelegatedWallet(gate.userId);
  return { ok: true, revoked: true, message: "In-app wallet revoked on OrbitX. The on-chain key still exists if you exported it." };
}

async function solUsd() {
  try {
    const pr = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + SOL_MINT, { signal: AbortSignal.timeout(6000) });
    const pj = await pr.json();
    return Number(pj?.pairs?.[0]?.priceUsd || 110);
  } catch {
    return 110;
  }
}

export async function appWalletBuy(auth, { mint, usd = 1, amountSol } = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await activeDelegatedWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", dashboard: DASH, message: "Create an in-app wallet first." };
  const ca = String(mint || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) return { ok: false, error: "bad_mint", message: "Pass the token mint / CA." };
  const px = await solUsd();
  const sol = amountSol != null ? Number(amountSol) : Number(usd) / px;
  const lamports = Math.floor(sol * 1e9);
  if (lamports < 1_000_000) return { ok: false, error: "size", message: "Size too small." };
  const usdEst = sol * px;
  await enforceDelegatedCaps(row, usdEst);
  const live = await jupiterSwapDelegated(row, { inputMint: SOL_MINT, outputMint: ca, amount: lamports });
  try {
    await recordDelegatedTrade(row, gate.userId, {
      side: "buy",
      mint: ca,
      amount_usd: usdEst,
      signature: live.signature,
      status: "filled",
    });
  } catch {}
  return { ok: true, side: "buy", mint: ca, usd: usdEst, signature: live.signature, tx: `https://solscan.io/tx/${live.signature}`, wallet: live.owner };
}

export async function appWalletSell(auth, { mint, fraction = 1 } = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await activeDelegatedWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", dashboard: DASH };
  const ca = String(mint || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) return { ok: false, error: "bad_mint" };
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [row.public_key, { mint: ca }, { encoding: "jsonParsed" }],
    }),
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  const accs = j?.result?.value || [];
  const raw = accs.reduce((s, a) => s + Number(a?.account?.data?.parsed?.info?.tokenAmount?.amount || 0), 0);
  const amt = Math.floor(raw * Math.min(1, Math.max(0.01, Number(fraction) || 1)));
  if (amt <= 0) return { ok: false, error: "no_balance", message: "No tokens to sell in the in-app wallet." };
  const live = await jupiterSwapDelegated(row, { inputMint: ca, outputMint: SOL_MINT, amount: amt });
  try {
    await recordDelegatedTrade(row, gate.userId, {
      side: "sell",
      mint: ca,
      amount_usd: 0,
      signature: live.signature,
      status: "filled",
    });
  } catch {}
  return { ok: true, side: "sell", mint: ca, signature: live.signature, tx: `https://solscan.io/tx/${live.signature}`, wallet: live.owner };
}

export async function dispatchAppWalletTool(name, args, auth) {
  if (name === "orbitx_app_wallet") return appWalletStatus(auth);
  if (name === "orbitx_app_wallet_create") return appWalletCreate(auth);
  if (name === "orbitx_app_wallet_export") return appWalletExport(auth);
  if (name === "orbitx_app_wallet_revoke") return appWalletRevoke(auth);
  if (name === "orbitx_app_buy") return appWalletBuy(auth, args || {});
  if (name === "orbitx_app_sell") return appWalletSell(auth, args || {});
  return null;
}

export function isAppWalletTool(name) {
  return String(name || "").startsWith("orbitx_app_");
}

export const APP_WALLET_CORE_TOOLS = [
  {
    name: "orbitx_app_wallet",
    description: "Show the user's OrbitX in-app wallet (pubkey, SOL, caps). MCP can trade from this wallet with no popup.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "orbitx_app_wallet_create",
    description: "Create an in-app Solana wallet the user owns. Exportable private key. Used for Grok buy/sell with no wallet popup.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "orbitx_app_wallet_export",
    description: "Reveal the in-app wallet private key (base58) so the user can export it. Only call when they ask to export.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "orbitx_app_wallet_revoke",
    description: "Revoke OrbitX access to the in-app wallet. Does not burn the on-chain key if they exported it.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "orbitx_app_buy",
    description: "Buy a Solana token with the in-app wallet. No popup. Pass mint/CA and usd (default $1).",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint / CA" },
        usd: { type: "number", description: "USD size, default 1" },
        amountSol: { type: "number" },
        authCode: { type: "string" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_app_sell",
    description: "Sell a token from the in-app wallet. No popup. fraction=1 sells the whole bag.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        fraction: { type: "number", description: "0-1, default 1" },
        authCode: { type: "string" },
      },
      required: ["mint"],
    },
  },
];
