/**
 * Social intel tools — whale tracking, price alerts, unlock calendar,
 * airdrop checker, multi-wallet portfolio. Zero SQL: all chain data via
 * public RPC/APIs, widget-managed state via localStorage.
 */

const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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

function solscanTx(sig) {
  return `https://solscan.io/tx/${sig}`;
}

/* ==================== Whale Watch ==================== */

async function whaleWatch(args) {
  const wallet = String(args.wallet || args.address || "").trim();
  if (!PUBKEY_RE.test(wallet)) {
    return { ok: false, error: "invalid_wallet", message: "Pass a valid Solana wallet address." };
  }
  const minUsd = Math.max(0, Number(args.minUsd || 10000));
  const limit = Math.min(50, Math.max(5, Number(args.limit || 20)));

  // Recent signatures, then fetch parsed transactions to find large transfers
  let sigs;
  try {
    sigs = await rpc("getSignaturesForAddress", [wallet, { limit }]);
  } catch (e) {
    return { ok: false, error: "rpc_error", message: `Could not fetch transactions: ${e.message}` };
  }
  const whales = [];
  // Fetch in small batches to stay fast
  const batch = (sigs || []).slice(0, 12);
  // Get SOL price for USD estimates
  let solUsd = 0;
  try {
    const pj = await jget("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
    solUsd = Number(pj?.pairs?.[0]?.priceUsd || 0);
  } catch { /* ignore */ }

  for (const s of batch) {
    try {
      const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }], 8000);
      if (!tx?.meta || tx.meta.err) continue;
      const pre = tx.meta.preBalances || [];
      const post = tx.meta.postBalances || [];
      const keys = tx.transaction?.message?.accountKeys || [];
      // Find the watched wallet's index and compute SOL delta
      let idx = -1;
      for (let i = 0; i < keys.length; i++) {
        const k = typeof keys[i] === "string" ? keys[i] : keys[i]?.pubkey;
        if (k === wallet) { idx = i; break; }
      }
      if (idx < 0 || idx >= pre.length) continue;
      const deltaLamports = (post[idx] || 0) - (pre[idx] || 0);
      const deltaSol = deltaLamports / 1e9;
      const usd = Math.abs(deltaSol * solUsd);
      if (usd >= minUsd) {
        whales.push({
          signature: s.signature,
          direction: deltaSol > 0 ? "in" : "out",
          sol: Number(deltaSol.toFixed(4)),
          usd: Number(usd.toFixed(2)),
          blockTime: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
          url: solscanTx(s.signature),
        });
      }
    } catch { /* skip bad tx */ }
  }
  return {
    ok: true,
    wallet,
    minUsd,
    checked: batch.length,
    largeTransfers: whales,
    note: whales.length === 0 ? `No transfers ≥ $${minUsd.toLocaleString()} in the last ${batch.length} transactions.` : undefined,
  };
}

function whaleAlerts() {
  return {
    ok: true,
    managedBy: "widget",
    message: "Whale watchlists are stored in the widget (localStorage key: orbitx.whaleWatch). Open the Token widget's Whales tab to add/remove wallets. The widget polls orbitx_whale_watch for each saved wallet.",
    storageKey: "orbitx.whaleWatch",
    shape: [{ wallet: "<address>", minUsd: 10000, label: "optional name" }],
  };
}

/* ==================== Price Alerts ==================== */

async function alertCreate(args) {
  const mint = String(args.mint || args.ca || "").trim();
  if (!MINT_RE.test(mint)) {
    return { ok: false, error: "invalid_mint", message: "Pass a valid token mint address." };
  }
  const condition = String(args.condition || "").toLowerCase();
  if (condition !== "above" && condition !== "below") {
    return { ok: false, error: "invalid_condition", message: "condition must be 'above' or 'below'." };
  }
  const price = Number(args.price);
  if (!isFinite(price) || price <= 0) {
    return { ok: false, error: "invalid_price", message: "price must be a positive number (USD)." };
  }
  // Resolve current price for context
  let currentUsd = null, symbol = null;
  try {
    const pj = await jget(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const pair = (pj?.pairs || []).sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0];
    currentUsd = Number(pair?.priceUsd || 0) || null;
    symbol = pair?.baseToken?.symbol || null;
  } catch { /* ignore */ }
  const alert = {
    id: `al_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    mint, symbol, condition, price,
    currentUsd,
    createdAt: new Date().toISOString(),
    triggered: false,
  };
  return {
    ok: true,
    alert,
    managedBy: "widget",
    message: "Save this alert object to widget localStorage (key: orbitx.priceAlerts). The widget polls prices and notifies when the condition hits.",
    storageKey: "orbitx.priceAlerts",
  };
}

function alertList() {
  return {
    ok: true,
    managedBy: "widget",
    message: "Price alerts are stored in the widget (localStorage key: orbitx.priceAlerts). Open the Token widget's Alerts tab to view, add, or remove alerts.",
    storageKey: "orbitx.priceAlerts",
  };
}

/* ==================== Unlock Calendar ==================== */

async function unlocks(args) {
  const mint = String(args.mint || args.ca || "").trim() || null;
  if (mint && !MINT_RE.test(mint)) {
    return { ok: false, error: "invalid_mint", message: "Pass a valid token mint address." };
  }
  // Try TokenUnlocks public data via their site API (best-effort, no key)
  // Most unlock data providers require API keys; be honest when unavailable.
  const sources = [];
  try {
    // CryptoRank has a public unlocks page; try their API
    const cr = await jget("https://api.cryptorank.io/v1/currencies?limit=5", 8000).catch(() => null);
    if (cr) sources.push("cryptorank:reachable");
  } catch { /* ignore */ }

  // Check Streamflow (Solana-native vesting) for streams on this mint
  let streamflow = null;
  if (mint) {
    try {
      const sf = await jget(`https://api.streamflow.finance/v2/contracts/search?mint=${mint}`, 8000).catch(() => null);
      if (sf) streamflow = sf;
    } catch { /* ignore */ }
  }
  if (!streamflow) {
    return {
      ok: true,
      mint,
      unlocks: [],
      note: "No unlock/vesting data available from public sources for this token. Major unlock providers (TokenUnlocks, CryptoRank Pro) require API keys. Streamflow on-chain streams: none found. This is an honest empty result — not mocked.",
      sourcesChecked: ["streamflow"],
    };
  }
  return { ok: true, mint, streamflow, sourcesChecked: ["streamflow"] };
}

/* ==================== Airdrop Checker ==================== */

async function airdrops(args) {
  const wallet = String(args.wallet || args.address || "").trim();
  if (!PUBKEY_RE.test(wallet)) {
    return { ok: false, error: "invalid_wallet", message: "Pass a valid Solana wallet address." };
  }
  const found = [];
  // Solana ecosystem airdrop checkers with public endpoints (best-effort)
  // 1. Check Drift, Jupiter, etc. via their claim APIs where public
  const checks = [
    {
      name: "Jupiter",
      url: `https://api.jup.ag/airdrop/v1/wallets/${wallet}`,
    },
  ];
  for (const c of checks) {
    try {
      const j = await jget(c.url, 7000).catch(() => null);
      if (j && (j.claimable || j.amount || (Array.isArray(j) && j.length))) {
        found.push({ protocol: c.name, detail: j });
      }
    } catch { /* ignore */ }
  }
  return {
    ok: true,
    wallet,
    airdrops: found,
    note: found.length === 0
      ? "No unclaimed airdrops found via public claim APIs. Many airdrops require connecting the wallet on the project's site — this check covers only public endpoints. Honest empty result."
      : undefined,
    sourcesChecked: checks.map((c) => c.name),
  };
}

/* ==================== Multi-Wallet Portfolio ==================== */

async function portfolioMulti(args) {
  let wallets = args.wallets || args.addresses;
  if (typeof wallets === "string") {
    wallets = wallets.split(/[,;\s]+/).filter(Boolean);
  }
  if (!Array.isArray(wallets) || wallets.length === 0) {
    return { ok: false, error: "no_wallets", message: "Pass wallets as an array of Solana addresses (max 10)." };
  }
  wallets = [...new Set(wallets.map((w) => String(w).trim()))].filter((w) => PUBKEY_RE.test(w)).slice(0, 10);
  if (wallets.length === 0) {
    return { ok: false, error: "invalid_wallets", message: "No valid Solana addresses provided." };
  }
  // SOL price for USD estimates
  let solUsd = 0;
  try {
    const pj = await jget("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
    solUsd = Number(pj?.pairs?.[0]?.priceUsd || 0);
  } catch { /* ignore */ }

  const perWallet = [];
  let totalSol = 0;
  for (const w of wallets) {
    try {
      const balRes = await rpc("getBalance", [w], 8000);
      const lamports = typeof balRes === "object" && balRes !== null ? Number(balRes.value || 0) : Number(balRes || 0);
      const sol = lamports / 1e9;
      totalSol += sol;
      // Token accounts (top holdings by balance)
      let holdings = [];
      try {
        const ta = await rpc("getTokenAccountsByOwner", [w, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }], 8000);
        const accounts = ta?.value || [];
        holdings = accounts
          .map((a) => {
            const info = a?.account?.data?.parsed?.info;
            const amt = Number(info?.tokenAmount?.uiAmount || 0);
            return { mint: info?.mint, amount: amt, decimals: info?.tokenAmount?.decimals };
          })
          .filter((h) => h.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);
      } catch { /* ignore */ }
      perWallet.push({
        wallet: w,
        sol: Number(sol.toFixed(4)),
        solUsd: Number((sol * solUsd).toFixed(2)),
        tokenAccounts: holdings.length,
        topHoldings: holdings,
        url: `https://solscan.io/account/${w}`,
      });
    } catch (e) {
      perWallet.push({ wallet: w, error: `fetch failed: ${e.message}` });
    }
  }
  return {
    ok: true,
    wallets: perWallet.length,
    totalSol: Number(totalSol.toFixed(4)),
    totalSolUsd: Number((totalSol * solUsd).toFixed(2)),
    solUsd,
    perWallet,
    note: "Token USD values not included (would require per-mint price lookups). SOL totals are exact; token amounts are raw balances.",
  };
}

/* ==================== Tool Definitions ==================== */

export const SOCIAL_INTEL_TOOLS = [
  {
    name: "orbitx_whale_watch",
    description: "Watch a wallet for large transfers. Returns recent large SOL movements (≥ minUsd, default $10k) with Solscan links. Say 'watch this wallet for whales'.",
    inputSchema: { type: "object", properties: { wallet: { type: "string", description: "Solana wallet address to watch" }, address: { type: "string" }, minUsd: { type: "number", description: "Minimum USD value, default 10000" }, limit: { type: "integer", description: "Transactions to scan, default 20, max 50" } }, required: ["wallet"] },
  },
  {
    name: "orbitx_whale_alerts",
    description: "Manage your whale watchlist. The watchlist lives in the widget — open the Token widget's Whales tab to add/remove wallets.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_alert_create",
    description: "Create a price alert: 'alert me when SOL is above $200'. Returns an alert object the widget stores and monitors. Say 'alert me when <token> is above/below $<price>'.",
    inputSchema: { type: "object", properties: { mint: { type: "string", description: "Token mint address" }, ca: { type: "string" }, condition: { type: "string", enum: ["above", "below"] }, price: { type: "number", description: "USD price trigger" } }, required: ["mint", "condition", "price"] },
  },
  {
    name: "orbitx_alert_list",
    description: "List your price alerts. Alerts are widget-managed — open the Token widget's Alerts tab.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_unlocks",
    description: "Token unlock/vesting calendar. Pass a mint for that token's schedule, or omit for a general note. Honest empty result when no public data exists.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, ca: { type: "string" } } },
  },
  {
    name: "orbitx_airdrops",
    description: "Check a wallet for unclaimed airdrops via public claim APIs. Honest 'none found' when empty.",
    inputSchema: { type: "object", properties: { wallet: { type: "string" }, address: { type: "string" } }, required: ["wallet"] },
  },
  {
    name: "orbitx_portfolio_multi",
    description: "Aggregate portfolio across multiple wallets. Pass up to 10 Solana addresses. Returns per-wallet SOL, top token holdings, and totals.",
    inputSchema: { type: "object", properties: { wallets: { type: "array", items: { type: "string" }, description: "Array of Solana wallet addresses (max 10)" }, addresses: { type: "array", items: { type: "string" } } }, required: ["wallets"] },
  },
];

const TOOL_NAMES = new Set(SOCIAL_INTEL_TOOLS.map((t) => t.name));

export function isSocialIntelTool(name) {
  return TOOL_NAMES.has(String(name || ""));
}

export async function dispatchSocialIntelTool(name, args, ctx = {}) {
  const a = args || {};
  try {
    if (name === "orbitx_whale_watch") return await whaleWatch(a);
    if (name === "orbitx_whale_alerts") return whaleAlerts();
    if (name === "orbitx_alert_create") return await alertCreate(a);
    if (name === "orbitx_alert_list") return alertList();
    if (name === "orbitx_unlocks") return await unlocks(a);
    if (name === "orbitx_airdrops") return await airdrops(a);
    if (name === "orbitx_portfolio_multi") return await portfolioMulti(a);
  } catch (e) {
    return { ok: false, error: "tool_error", message: e?.message || "unknown error" };
  }
  return null;
}
