/**
 * Temporary Agent / Telegram bot access by burning $ORBITX.
 * 1 hour = 100 · 1 day = 1,000 · 1 week = 10,000 · 1 month = 1,000,000 (1000k)
 *
 * Do NOT top-level import @solana/web3.js — same cold-start rule as x-credits / mcp-ops.
 */

export const ORBITX_BURN_MINT =
  process.env.AGENT_GATE_MINT || "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ORBITX_DECIMALS = 6;

export const MCP_ACCESS_PACKAGES = Object.freeze({
  hour: Object.freeze({
    id: "hour",
    label: "1 Hour Access",
    tokens: 100,
    durationMs: HOUR_MS,
    durationSeconds: 60 * 60,
    durationLabel: "1 hour",
  }),
  day: Object.freeze({
    id: "day",
    label: "1 Day Access",
    tokens: 1000,
    durationMs: DAY_MS,
    durationSeconds: 24 * 60 * 60,
    durationLabel: "24 hours",
  }),
  week: Object.freeze({
    id: "week",
    label: "1 Week Access",
    tokens: 10_000,
    durationMs: 7 * DAY_MS,
    durationSeconds: 7 * 24 * 60 * 60,
    durationLabel: "7 days",
  }),
  month: Object.freeze({
    id: "month",
    label: "1 Month Access",
    tokens: 1_000_000,
    durationMs: 30 * DAY_MS,
    durationSeconds: 30 * 24 * 60 * 60,
    durationLabel: "30 days",
  }),
});

const PACKAGE_ALIASES = {
  hour: "hour",
  "1h": "hour",
  "1hr": "hour",
  "1hour": "hour",
  hr: "hour",
  a: "hour",
  optiona: "hour",
  day: "day",
  "1d": "day",
  "1day": "day",
  daily: "day",
  week: "week",
  "7d": "week",
  "1w": "week",
  "1week": "week",
  weekly: "week",
  b: "week",
  optionb: "week",
  month: "month",
  "30d": "month",
  "1m": "month",
  "1mo": "month",
  "1month": "month",
  monthly: "month",
  "1000k": "month",
};

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : "") ||
    process.env.VITE_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

async function rpc(method, params) {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc_error");
  return j.result;
}

export function listPackages() {
  return ["hour", "day", "week", "month"].map((id) => ({
    ...MCP_ACCESS_PACKAGES[id],
    mint: ORBITX_BURN_MINT,
    symbol: "ORBITX",
  }));
}

export function resolvePackage(input) {
  const raw = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (!raw) return null;
  const id = PACKAGE_ALIASES[raw] || (MCP_ACCESS_PACKAGES[raw] ? raw : null);
  return id ? MCP_ACCESS_PACKAGES[id] : null;
}

export function calculateBurnAmount(packageId) {
  const pkg = resolvePackage(packageId);
  if (!pkg) {
    return {
      ok: false,
      error: "invalid_package",
      message: "Choose hour (100), day (1,000), week (10,000), or month (1,000,000 $ORBITX).",
      packages: listPackages(),
    };
  }
  return {
    ok: true,
    packageId: pkg.id,
    label: pkg.label,
    tokens: pkg.tokens,
    durationMs: pkg.durationMs,
    durationSeconds: pkg.durationSeconds,
    durationLabel: pkg.durationLabel,
    mint: ORBITX_BURN_MINT,
    symbol: "ORBITX",
  };
}

export function isAccessActive(expiresAt, now = Date.now()) {
  if (!expiresAt) return false;
  const ms = typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt);
  return Number.isFinite(ms) && ms > now;
}

export function computeExpiresAt(nowMs, currentExpiresAt, durationMs) {
  const currentMs =
    currentExpiresAt == null
      ? 0
      : typeof currentExpiresAt === "number"
        ? currentExpiresAt
        : Date.parse(currentExpiresAt);
  const base = Number.isFinite(currentMs) && currentMs > nowMs ? currentMs : nowMs;
  return new Date(base + durationMs).toISOString();
}

export function formatRemaining(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "Expired";
  const totalMin = Math.floor(n / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m remaining`;
  return "Under 1m remaining";
}

export function remainingMs(expiresAt, now = Date.now()) {
  if (!expiresAt) return 0;
  const ms = typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, ms - now);
}

export function inferPackageFromTokens(tokensBurned) {
  const n = Number(tokensBurned);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ranked = Object.values(MCP_ACCESS_PACKAGES).sort((a, b) => b.tokens - a.tokens);
  for (const pkg of ranked) {
    if (n + 1e-9 >= pkg.tokens) return pkg;
  }
  return null;
}

export function accessBlockedPayload(extra = {}) {
  return {
    ok: false,
    error: "mcp_access_required",
    mint: ORBITX_BURN_MINT,
    packages: listPackages(),
    accessUrl: "https://www.orbitx.world/shop",
    holdUrl: `https://www.orbitx.world/ORBITX_DEX/token/${ORBITX_BURN_MINT}`,
    buyUrl: `https://jup.ag/swap/SOL-${ORBITX_BURN_MINT}`,
    message:
      "MCP access required. Hold ≥$5 ORBITX, or burn 100 (1 hour) / 1,000 (1 day) / 10,000 (1 week) / 1,000,000 (1 month) at /shop.",
    ...extra,
  };
}

function emptyStatus(now = Date.now()) {
  return {
    ok: true,
    active: false,
    expired: false,
    packageId: null,
    expiresAt: null,
    remainingMs: 0,
    remainingLabel: "No burn access",
    tokensBurned: 0,
    lifetimeTokensBurned: 0,
    walletAddress: null,
    lastTxSignature: null,
    packages: listPackages(),
    mint: ORBITX_BURN_MINT,
    checkedAt: new Date(now).toISOString(),
  };
}

export function statusFromRow(row, now = Date.now()) {
  if (!row) return emptyStatus(now);
  const expiresAt = row.expires_at || null;
  const active = isAccessActive(expiresAt, now);
  const left = remainingMs(expiresAt, now);
  return {
    ok: true,
    active,
    expired: Boolean(expiresAt) && !active,
    packageId: row.package_id || null,
    expiresAt,
    remainingMs: left,
    remainingLabel: active ? formatRemaining(left) : expiresAt ? "Expired" : "No burn access",
    tokensBurned: Number(row.tokens_burned || 0),
    lifetimeTokensBurned: Number(row.lifetime_tokens_burned || 0),
    walletAddress: row.wallet_address || null,
    lastTxSignature: row.last_tx_signature || null,
    packages: listPackages(),
    mint: ORBITX_BURN_MINT,
    checkedAt: new Date(now).toISOString(),
  };
}

function isSchemaMissing(e) {
  return /relation|does not exist|42P01|mcp_burn/i.test(String(e?.message || e?.code || e));
}

function normalizeWallet(wallet) {
  return String(wallet || "").trim();
}

function pickBestAccessRow(rows) {
  const list = (rows || []).filter((row) => row && (row.expires_at || row.expiresAt));
  if (!list.length) return null;
  return list.slice().sort((a, b) => {
    const ae = Date.parse(a.expires_at || a.expiresAt || 0) || 0;
    const be = Date.parse(b.expires_at || b.expiresAt || 0) || 0;
    return be - ae;
  })[0];
}

async function getAccessRow(sb, userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  const rows = await sb(
    `mcp_burn_access?user_id=eq.${encodeURIComponent(uid)}&select=*&limit=1`,
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getWalletAccessRow(sb, wallet) {
  const w = normalizeWallet(wallet);
  if (!w) return null;
  try {
    const rows = await sb(
      `mcp_burn_wallet_access?wallet_address=eq.${encodeURIComponent(w)}&select=*&limit=1`,
    );
    if (Array.isArray(rows) && rows[0]) return rows[0];
  } catch (e) {
    if (!isSchemaMissing(e)) throw e;
  }
  try {
    const rows = await sb(
      `mcp_burn_access?wallet_address=eq.${encodeURIComponent(w)}&select=*&order=expires_at.desc&limit=1`,
    );
    if (Array.isArray(rows) && rows[0]) return rows[0];
  } catch (e) {
    if (!isSchemaMissing(e)) throw e;
  }
  return null;
}

export async function findUserIdByWallet(sb, wallet) {
  const w = normalizeWallet(wallet);
  if (!w) return null;
  for (const path of [
    `agents?wallet_address=eq.${encodeURIComponent(w)}&select=user_id&limit=1`,
    `mcp_burn_access?wallet_address=eq.${encodeURIComponent(w)}&select=user_id&limit=1`,
    `mcp_burn_wallet_access?wallet_address=eq.${encodeURIComponent(w)}&select=user_id&limit=1`,
  ]) {
    try {
      const rows = await sb(path);
      if (Array.isArray(rows) && rows[0]?.user_id) return rows[0].user_id;
    } catch {
      /* table may not exist */
    }
  }
  return null;
}

export async function getAccessStatus(sb, userId, { now = Date.now(), wallets = [] } = {}) {
  const uid = String(userId || "").trim();
  const walletList = (Array.isArray(wallets) ? wallets : [wallets])
    .map((w) => normalizeWallet(w))
    .filter(Boolean);
  if (!uid && !walletList.length) return emptyStatus(now);

  const rows = [];
  let schemaMissing = false;
  try {
    if (uid) {
      const row = await getAccessRow(sb, uid);
      if (row) rows.push(row);
    }
  } catch (e) {
    if (isSchemaMissing(e)) schemaMissing = true;
    else throw e;
  }
  for (const wallet of walletList) {
    try {
      const row = await getWalletAccessRow(sb, wallet);
      if (row) rows.push(row);
    } catch (e) {
      if (isSchemaMissing(e)) schemaMissing = true;
      else throw e;
    }
  }

  const status = statusFromRow(pickBestAccessRow(rows), now);
  if (schemaMissing && !status.active) return { ...status, schemaMissing: true };
  return status;
}

export async function hasValidAccess(sb, userId, { now = Date.now() } = {}) {
  const status = await getAccessStatus(sb, userId, { now });
  return Boolean(status.active);
}

/**
 * Combined MCP gate: exempt OR unexpired burn access OR $ORBITX hold.
 */
export async function evaluateMcpAccess({
  sb,
  userId,
  hold = null,
  now = Date.now(),
  wallets = [],
} = {}) {
  const burn = await getAccessStatus(sb, userId, { now, wallets });
  if (hold?.exempt) {
    return { allowed: true, source: "exempt", hold, burn };
  }
  if (burn.active) {
    return { allowed: true, source: "burn", hold, burn };
  }
  if (hold?.meetsRequirement) {
    return { allowed: true, source: "hold", hold, burn };
  }
  return {
    allowed: false,
    source: null,
    hold,
    burn,
    blocked: accessBlockedPayload({
      hold,
      burn,
      remainingLabel: burn.remainingLabel,
    }),
  };
}

/**
 * Quote + ATA lookup for an access burn.
 * Do NOT import mcp-ops / @solana/web3.js here — rpc-websockets requires ESM uuid
 * and crashes the Vercel function (ERR_REQUIRE_ESM). The browser builds the tx.
 */
export async function prepareAccessBurn({ publicKey, packageId }) {
  const quote = calculateBurnAmount(packageId);
  if (!quote.ok) return quote;
  const pk = String(publicKey || "").trim();
  if (!pk || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pk)) {
    return {
      ...quote,
      ok: false,
      error: "wallet_required",
      message: "Connect a Solana wallet, then burn ORBITX for MCP access.",
    };
  }

  let accounts;
  try {
    accounts = await rpc("getTokenAccountsByOwner", [
      pk,
      { mint: ORBITX_BURN_MINT },
      { encoding: "jsonParsed" },
    ]);
  } catch (e) {
    return {
      ...quote,
      ok: false,
      error: "rpc_failed",
      message: e?.message || "Could not read $ORBITX balance",
    };
  }

  let best = null;
  for (const row of accounts?.value || []) {
    const info = row?.account?.data?.parsed?.info;
    if (!info) continue;
    let balanceRaw = 0n;
    try {
      balanceRaw = BigInt(info.tokenAmount?.amount || "0");
    } catch {
      continue;
    }
    if (balanceRaw <= 0n) continue;
    if (!best || balanceRaw > best.balanceRaw) {
      best = {
        tokenAccount: row.pubkey,
        programId: row.account.owner,
        decimals: Number(info.tokenAmount?.decimals || 0),
        balanceRaw,
      };
    }
  }

  if (!best) {
    return prepareAccessBuyAndBurn({ publicKey: pk, quote });
  }

  const amountRaw = BigInt(quote.tokens) * 10n ** BigInt(Math.max(0, best.decimals));
  if (amountRaw > best.balanceRaw) {
    return prepareAccessBuyAndBurn({ publicKey: pk, quote });
  }

  return {
    ok: true,
    ...quote,
    publicKey: pk,
    mint: ORBITX_BURN_MINT,
    tokenAccount: best.tokenAccount,
    programId: best.programId,
    decimals: best.decimals,
    amountRaw: amountRaw.toString(),
    balanceRaw: best.balanceRaw.toString(),
    closesAccount: amountRaw >= best.balanceRaw,
    buildOnClient: true,
    note: `Burn ${quote.tokens} $ORBITX for ${quote.label}. Sign with the holder wallet.`,
  };
}

const JUP_SWAP = "https://lite-api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Jupiter buy exact $ORBITX then burn in the same tx (Token-2022). */
export async function prepareAccessBuyAndBurn({ publicKey, quote }) {
  const pk = String(publicKey || "").trim();
  const amountRaw = BigInt(quote.tokens) * 10n ** BigInt(ORBITX_DECIMALS);
  const quoteUrl =
    `${JUP_SWAP}/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${ORBITX_BURN_MINT}` +
    `&amount=${amountRaw.toString()}&swapMode=ExactOut&slippageBps=200&restrictIntermediateTokens=true`;
  let jupQuote;
  try {
    const quoteRes = await fetch(quoteUrl);
    jupQuote = await quoteRes.json().catch(() => ({}));
    if (!quoteRes.ok || !jupQuote.outAmount) {
      return {
        ...quote,
        ok: false,
        error: "no_route",
        message: "Jupiter could not quote a buy-and-burn for this access package. Try again, or buy $ORBITX first.",
        mint: ORBITX_BURN_MINT,
      };
    }
  } catch (e) {
    return {
      ...quote,
      ok: false,
      error: "quote_failed",
      message: e instanceof Error ? e.message : "Jupiter quote failed",
      mint: ORBITX_BURN_MINT,
    };
  }

  const swapRes = await fetch(`${JUP_SWAP}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: jupQuote,
      userPublicKey: pk,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      asLegacyTransaction: false,
      prioritizationFeeLamports: "auto",
    }),
  });
  const swap = await swapRes.json().catch(() => ({}));
  if (!swapRes.ok || !swap.swapTransaction) {
    return {
      ...quote,
      ok: false,
      error: "swap_build_failed",
      message: swap.error || "Jupiter could not build the buy-and-burn transaction.",
      mint: ORBITX_BURN_MINT,
    };
  }

  try {
    const { attachMemoAndBurn } = await import("./desk-shop.js");
    const transaction = await attachMemoAndBurn(swap.swapTransaction, {
      owner: pk,
      mint: ORBITX_BURN_MINT,
      burnRaw: amountRaw.toString(),
      memo: `orbitx:access:${quote.packageId}`,
    });
    return {
      ok: true,
      ...quote,
      publicKey: pk,
      mint: ORBITX_BURN_MINT,
      transaction,
      buyThenBurn: true,
      buildOnClient: false,
      amountRaw: amountRaw.toString(),
      requiresSignature: true,
      note: `One sign buys ${quote.tokens} $ORBITX and burns them for ${quote.label}. Then /verify the Solscan link.`,
    };
  } catch (e) {
    return {
      ...quote,
      ok: false,
      error: "attach_burn_failed",
      message: e instanceof Error ? e.message : "Could not attach the $ORBITX burn to the Jupiter swap.",
      mint: ORBITX_BURN_MINT,
    };
  }
}

/** Raw sig or Solscan / Explorer / SolanaFM URL. */
export function parseSolanaTxSignature(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(
    /(?:solscan\.io|explorer\.solana\.com|solana\.fm)\/tx\/([1-9A-HJ-NP-Za-km-z]{64,88})/i,
  );
  if (fromUrl?.[1]) return fromUrl[1];
  const bare = raw.match(/[1-9A-HJ-NP-Za-km-z]{64,88}/);
  return bare?.[0] || "";
}

function tokenUiAmount(entry) {
  const t = entry?.uiTokenAmount || {};
  const ui = Number(t.uiAmount);
  if (Number.isFinite(ui)) return ui;
  const raw = Number(t.amount);
  const decimals = Number(t.decimals);
  if (Number.isFinite(raw) && Number.isFinite(decimals) && decimals >= 0) {
    return raw / 10 ** decimals;
  }
  return 0;
}

function collectInstructions(tx) {
  const top = tx?.transaction?.message?.instructions || [];
  const inner = (tx?.meta?.innerInstructions || []).flatMap((batch) => batch.instructions || []);
  return [...top, ...inner];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyOrbitxBurn(
  signature,
  { packageId, wallet, pollAttempts = 8, pollMs = 750 } = {},
) {
  const sig = String(signature || "").trim();
  if (!sig || sig.length < 32) {
    return { ok: false, error: "signature_required", message: "Transaction signature is required" };
  }
  const requested = packageId ? resolvePackage(packageId) : null;
  if (packageId && !requested) {
    return {
      ok: false,
      error: "invalid_package",
      message: "Choose hour (100), day (1,000), week (10,000), or month (1,000,000 $ORBITX).",
      packages: listPackages(),
    };
  }

  const attempts = Math.max(1, Number(pollAttempts) || 1);
  const delay = Math.max(0, Number(pollMs) || 0);
  let tx = null;
  let lastRpcError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      tx = await rpc("getTransaction", [
        sig,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      ]);
      if (tx) break;
    } catch (e) {
      lastRpcError = e;
    }
    if (i < attempts - 1 && delay) await sleep(delay);
  }
  if (!tx) {
    return {
      ok: false,
      error: lastRpcError ? "rpc_failed" : "not_found",
      message: lastRpcError
        ? String(lastRpcError?.message || lastRpcError)
        : "Transaction not found yet — wait for confirmation and retry.",
    };
  }
  if (tx.meta?.err) {
    return { ok: false, error: "tx_failed", message: "On-chain burn transaction failed" };
  }

  const mint = ORBITX_BURN_MINT;
  const pre = (tx.meta?.preTokenBalances || []).filter((b) => b.mint === mint);
  const postByIndex = new Map(
    (tx.meta?.postTokenBalances || []).filter((b) => b.mint === mint).map((b) => [b.accountIndex, b]),
  );

  let burnedUi = 0;
  let owner = null;
  for (const row of pre) {
    const after = postByIndex.get(row.accountIndex);
    const delta = tokenUiAmount(row) - (after ? tokenUiAmount(after) : 0);
    if (delta > burnedUi) {
      burnedUi = delta;
      owner = row.owner || owner;
    }
  }

  let sawBurn = false;
  for (const ix of collectInstructions(tx)) {
    const parsed = ix?.parsed;
    if (!parsed) continue;
    const type = String(parsed.type || "").toLowerCase();
    if (type !== "burn" && type !== "burnchecked") continue;
    const info = parsed.info || {};
    if (info.mint && info.mint !== mint) continue;
    sawBurn = true;
    if (!owner && info.authority) owner = info.authority;
    const parsedUi = Number(info.tokenAmount?.uiAmount);
    if (Number.isFinite(parsedUi) && parsedUi > burnedUi) burnedUi = parsedUi;
    else {
      const raw = Number(info.tokenAmount?.amount ?? info.amount);
      const decimals = Number(info.tokenAmount?.decimals);
      const dec = Number.isFinite(decimals) && decimals >= 0 ? decimals : 6;
      if (Number.isFinite(raw) && raw > 0) {
        const ui = raw / 10 ** dec;
        if (ui > burnedUi) burnedUi = ui;
      }
    }
  }

  if (burnedUi <= 0 && !sawBurn) {
    return {
      ok: false,
      error: "not_a_burn",
      message: "Transaction is not an $ORBITX burn.",
      mint,
    };
  }

  const expectedWallet = String(wallet || "").trim();
  if (expectedWallet && owner && expectedWallet !== owner) {
    return {
      ok: false,
      error: "wallet_mismatch",
      message: "Burn wallet does not match the connected wallet.",
      wallet: owner,
    };
  }

  const resolved = requested || inferPackageFromTokens(burnedUi);
  if (!resolved) {
    return {
      ok: false,
      error: "amount_too_low",
      message: `Burned ${burnedUi} ORBITX — need 100 (1 hour), 1,000 (1 day), 10,000 (1 week), or 1,000,000 (1 month).`,
      tokensBurned: burnedUi,
      mint,
    };
  }
  if (burnedUi + 1e-6 < resolved.tokens * 0.999) {
    return {
      ok: false,
      error: "amount_too_low",
      message: `Burned ${burnedUi} ORBITX — ${resolved.label} requires ${resolved.tokens}.`,
      tokensBurned: burnedUi,
      packageId: resolved.id,
      mint,
    };
  }

  return {
    ok: true,
    signature: sig,
    mint,
    wallet: owner || expectedWallet || null,
    tokensBurned: burnedUi,
    package: resolved,
    explorer: `https://solscan.io/tx/${sig}`,
  };
}

async function upsertWalletAccess(sb, row) {
  let existing = null;
  try {
    const rows = await sb(
      `mcp_burn_wallet_access?wallet_address=eq.${encodeURIComponent(row.wallet_address)}&select=wallet_address&limit=1`,
    );
    existing = Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    if (!isSchemaMissing(e)) throw e;
    throw e;
  }
  if (existing) {
    await sb(`mcp_burn_wallet_access?wallet_address=eq.${encodeURIComponent(row.wallet_address)}`, {
      method: "PATCH",
      body: JSON.stringify(row),
      headers: { Prefer: "return=minimal" },
    });
    return;
  }
  await sb("mcp_burn_wallet_access", {
    method: "POST",
    body: JSON.stringify({ ...row, created_at: row.updated_at }),
    headers: { Prefer: "return=minimal" },
  });
}

async function upsertUserAccess(sb, uid, accessRow, iso) {
  const current = await getAccessRow(sb, uid);
  if (current) {
    await sb(`mcp_burn_access?user_id=eq.${encodeURIComponent(uid)}`, {
      method: "PATCH",
      body: JSON.stringify(accessRow),
      headers: { Prefer: "return=minimal" },
    });
    return current;
  }
  await sb("mcp_burn_access", {
    method: "POST",
    body: JSON.stringify({ ...accessRow, created_at: iso }),
    headers: { Prefer: "return=minimal" },
  });
  return null;
}

export async function confirmAccessBurn(sb, { userId, signature, packageId, wallet } = {}) {
  const verified = await verifyOrbitxBurn(signature, { packageId, wallet });
  if (!verified.ok) return verified;

  const burnWallet = normalizeWallet(verified.wallet || wallet);
  let uid = String(userId || "").trim();
  if (!uid && burnWallet) {
    uid = (await findUserIdByWallet(sb, burnWallet)) || "";
  }
  if (!uid && !burnWallet) {
    return {
      ok: false,
      error: "user_required",
      message: "Pass the burn wallet publicKey so access can be granted immediately.",
    };
  }

  try {
    const existing = await sb(
      `mcp_burn_ledger?tx_signature=eq.${encodeURIComponent(verified.signature)}&select=id,user_id,package_id,expires_at,tokens_burned&limit=1`,
    );
    if (Array.isArray(existing) && existing[0]) {
      const prior = existing[0];
      if (burnWallet) {
        try {
          await upsertWalletAccess(sb, {
            wallet_address: burnWallet,
            user_id: uid || prior.user_id || null,
            package_id: prior.package_id,
            tokens_burned: Number(prior.tokens_burned || verified.tokensBurned),
            expires_at: prior.expires_at,
            last_tx_signature: verified.signature,
            lifetime_tokens_burned: Number(prior.tokens_burned || verified.tokensBurned),
            updated_at: new Date().toISOString(),
          });
        } catch {
          /* wallet table may not exist yet — status can still use user row */
        }
      }
      const status = await getAccessStatus(sb, uid, { wallets: [burnWallet] });
      const shown = status.active
        ? status
        : statusFromRow(
            {
              package_id: prior.package_id,
              expires_at: prior.expires_at,
              tokens_burned: prior.tokens_burned,
              lifetime_tokens_burned: prior.tokens_burned,
              wallet_address: burnWallet,
              last_tx_signature: verified.signature,
            },
          );
      return {
        ok: true,
        alreadyGranted: true,
        ...shown,
        signature: verified.signature,
        packageId: prior.package_id,
        message: shown.active
          ? `This burn already granted MCP access. ${shown.remainingLabel}.`
          : "This burn already granted MCP access.",
        explorer: verified.explorer,
      };
    }
  } catch {
    /* continue — unique check still applies on insert */
  }

  const now = Date.now();
  const currentUser = uid ? await getAccessRow(sb, uid).catch(() => null) : null;
  const currentWallet = burnWallet ? await getWalletAccessRow(sb, burnWallet).catch(() => null) : null;
  const current = pickBestAccessRow([currentUser, currentWallet]);
  const pkg = verified.package;
  const expiresAt = computeExpiresAt(now, current?.expires_at, pkg.durationMs);
  const tokensBurned = Number(verified.tokensBurned);
  const lifetime =
    Number(currentUser?.lifetime_tokens_burned || currentWallet?.lifetime_tokens_burned || 0) +
    tokensBurned;
  const iso = new Date(now).toISOString();

  const accessRow = {
    wallet_address: burnWallet || null,
    package_id: pkg.id,
    tokens_burned: tokensBurned,
    expires_at: expiresAt,
    last_tx_signature: verified.signature,
    lifetime_tokens_burned: lifetime,
    updated_at: iso,
  };

  let wrote = false;
  let schemaMissing = false;
  if (burnWallet) {
    try {
      await upsertWalletAccess(sb, {
        ...accessRow,
        wallet_address: burnWallet,
        user_id: uid || null,
      });
      wrote = true;
    } catch (e) {
      if (isSchemaMissing(e)) schemaMissing = true;
      else throw e;
    }
  }
  if (uid) {
    try {
      await upsertUserAccess(sb, uid, { ...accessRow, user_id: uid }, iso);
      wrote = true;
    } catch (e) {
      if (isSchemaMissing(e)) schemaMissing = true;
      else throw e;
    }
  }

  try {
    await sb("mcp_burn_ledger", {
      method: "POST",
      body: JSON.stringify({
        user_id: uid || null,
        wallet_address: burnWallet || null,
        package_id: pkg.id,
        tokens_burned: tokensBurned,
        duration_seconds: pkg.durationSeconds,
        expires_at: expiresAt,
        tx_signature: verified.signature,
        meta: {
          mint: verified.mint,
          label: pkg.label,
        },
      }),
      headers: { Prefer: "return=minimal" },
    });
    try {
      const { recordVerifiedBurn } = await import("./owner-command.js");
      await recordVerifiedBurn(sb, {
        user_id: uid || null,
        wallet_address: burnWallet || null,
        application: "agent",
        tokens_burned: tokensBurned,
        tx_signature: verified.signature,
        mint: verified.mint,
        source: "mcp_burn",
        metadata: { package_id: pkg.id, label: pkg.label },
      });
    } catch {
      /* owner command tables optional until migration is applied */
    }
  } catch (e) {
    if (/23505|duplicate|unique/i.test(String(e?.code || e?.message || ""))) {
      const status = await getAccessStatus(sb, uid, { wallets: [burnWallet] });
      return {
        ok: true,
        alreadyGranted: true,
        ...status,
        signature: verified.signature,
        explorer: verified.explorer,
        message: status.active
          ? `This burn already granted MCP access. ${status.remainingLabel}.`
          : "This burn already granted MCP access.",
      };
    }
    if (!isSchemaMissing(e) && wrote) {
      /* ledger is optional once the grant row exists */
    } else if (!wrote) {
      throw e;
    } else {
      schemaMissing = schemaMissing || isSchemaMissing(e);
    }
  }

  if (!wrote) {
    return {
      ok: false,
      error: "schema_missing",
      schemaMissing: true,
      message: "Apply sql/Aug_SQL/11_mcp_burn_wallet_access.sql so burns can grant access immediately.",
      signature: verified.signature,
      explorer: verified.explorer,
    };
  }

  const status = statusFromRow(
    {
      package_id: pkg.id,
      expires_at: expiresAt,
      tokens_burned: tokensBurned,
      lifetime_tokens_burned: lifetime,
      wallet_address: burnWallet,
      last_tx_signature: verified.signature,
    },
    now,
  );

  return {
    ok: true,
    alreadyGranted: false,
    ...status,
    signature: verified.signature,
    explorer: verified.explorer,
    schemaMissing: schemaMissing || undefined,
    message: `${pkg.label} granted. ${status.remainingLabel}.`,
  };
}

export function accessBuyPrompt({
  buyTool = "orbitx_mcp_access_buy",
  confirmTool = "orbitx_mcp_access_confirm",
  statusTool = "orbitx_mcp_access_status",
  accessUrl = "https://www.orbitx.world/shop",
} = {}) {
  return {
    ok: true,
    action: "ask_package",
    message: `Ask which access package they want: 1 hour (100 $ORBITX), 1 day (1,000), 1 week (10,000), or 1 month (1,000,000). Then call ${buyTool} with package=hour|day|week|month.`,
    packages: listPackages(),
    mint: ORBITX_BURN_MINT,
    accessUrl,
    tools: { buy: buyTool, confirm: confirmTool, status: statusTool },
  };
}

export function prepareAccessMcpPurchase({
  base = "https://www.orbitx.world",
  wallet,
  packageId,
  confirmMode = "sign",
  preferAuto = false,
  accessUrl = "https://www.orbitx.world/shop",
  buyTool = "orbitx_mcp_access_buy",
  confirmTool = "orbitx_mcp_access_confirm",
} = {}) {
  const quote = calculateBurnAmount(packageId);
  if (!quote.ok) return quote;
  const pk = String(wallet || "").trim();
  if (!pk || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pk)) {
    return {
      ok: false,
      error: "wallet_required",
      message: `Link a Solana wallet on ${accessUrl} (or pass publicKey).`,
      fixUrl: accessUrl,
      ...quote,
    };
  }

  const modeRaw = String(confirmMode || "").toLowerCase();
  const mode =
    preferAuto || modeRaw === "auto" || modeRaw === "automatic" || modeRaw === "chat"
      ? "auto"
      : "sign";

  const qs = new URLSearchParams({
    kind: "mcp-access",
    package: quote.packageId,
    amount: String(quote.tokens),
    mint: ORBITX_BURN_MINT,
    publicKey: pk,
  });
  const signUrl = `${base}/agent/sign?${qs.toString()}`;
  const autoQs = new URLSearchParams(qs);
  autoQs.set("auto", "1");
  const autoSignUrl = `${base}/agent/sign?${autoQs.toString()}`;

  return {
    ok: true,
    status: mode === "auto" ? "awaiting_auto_phantom" : "awaiting_phantom_signature",
    requiresSignature: true,
    confirmMode: mode,
    ...quote,
    wallet: pk,
    signUrl,
    autoSignUrl,
    openUrl: mode === "auto" ? autoSignUrl : signUrl,
    solscanToken: `https://solscan.io/token/${ORBITX_BURN_MINT}`,
    solscanAccount: pk ? `https://solscan.io/account/${pk}` : "",
    instructions:
      mode === "auto"
        ? [
            "Send the user openUrl as a clickable link.",
            `One Jupiter sign buys ${quote.tokens} $ORBITX and burns them for ${quote.label}.`,
            "After the tx lands, they send /verify plus the Solscan link.",
          ]
        : [
            "Send the user signUrl as a clickable link.",
            `One Jupiter sign buys ${quote.tokens} $ORBITX and burns them for ${quote.label}.`,
            "After the tx lands, they send /verify plus the Solscan link.",
          ],
    note: `Non-custodial. Exact burn of ${quote.tokens} $ORBITX unlocks ${quote.label}. Access expires automatically.`,
    accessUrl,
    tools: { buy: buyTool, confirm: confirmTool },
  };
}
