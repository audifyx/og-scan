/**
 * Temporary Agent MCP access by burning $ORBITX.
 * Option A: 1 day  = 100 tokens
 * Option B: 1 week = 1,000 tokens
 *
 * Do NOT top-level import @solana/web3.js — same cold-start rule as x-credits / mcp-ops.
 */

export const ORBITX_BURN_MINT =
  process.env.AGENT_GATE_MINT || "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

const DAY_MS = 24 * 60 * 60 * 1000;

export const MCP_ACCESS_PACKAGES = Object.freeze({
  day: Object.freeze({
    id: "day",
    label: "1 Day Access",
    tokens: 100,
    durationMs: DAY_MS,
    durationSeconds: 24 * 60 * 60,
    durationLabel: "24 hours",
  }),
  week: Object.freeze({
    id: "week",
    label: "1 Week Access",
    tokens: 1000,
    durationMs: 7 * DAY_MS,
    durationSeconds: 7 * 24 * 60 * 60,
    durationLabel: "7 days",
  }),
});

const PACKAGE_ALIASES = {
  day: "day",
  "1d": "day",
  "1day": "day",
  daily: "day",
  a: "day",
  optiona: "day",
  week: "week",
  "7d": "week",
  "1w": "week",
  "1week": "week",
  weekly: "week",
  b: "week",
  optionb: "week",
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
  return [MCP_ACCESS_PACKAGES.day, MCP_ACCESS_PACKAGES.week].map((pkg) => ({
    ...pkg,
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
      message: "Choose package day (100 ORBITX) or week (1,000 ORBITX).",
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
  if (n + 1e-9 >= MCP_ACCESS_PACKAGES.week.tokens) return MCP_ACCESS_PACKAGES.week;
  if (n + 1e-9 >= MCP_ACCESS_PACKAGES.day.tokens) return MCP_ACCESS_PACKAGES.day;
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
      "MCP access required. Hold ≥$5 ORBITX, or burn 100 ORBITX (1 day) / 1,000 ORBITX (1 week) at /shop.",
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

async function getAccessRow(sb, userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  const rows = await sb(
    `mcp_burn_access?user_id=eq.${encodeURIComponent(uid)}&select=*&limit=1`,
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function getAccessStatus(sb, userId, { now = Date.now() } = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return emptyStatus(now);
  try {
    return statusFromRow(await getAccessRow(sb, uid), now);
  } catch (e) {
    if (/relation|does not exist|42P01|mcp_burn_access/i.test(String(e?.message || e))) {
      return { ...emptyStatus(now), schemaMissing: true };
    }
    throw e;
  }
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
} = {}) {
  const burn = userId ? await getAccessStatus(sb, userId, { now }) : emptyStatus(now);
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

export async function prepareAccessBurn({ publicKey, packageId }) {
  const quote = calculateBurnAmount(packageId);
  if (!quote.ok) return quote;
  const pk = String(publicKey || "").trim();
  if (!pk || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pk)) {
    return {
      ok: false,
      error: "wallet_required",
      message: "Connect a Solana wallet, then burn ORBITX for MCP access.",
      ...quote,
    };
  }
  const { prepareBurn } = await import("./mcp-ops.js");
  const built = await prepareBurn(pk, ORBITX_BURN_MINT, String(quote.tokens), null);
  return {
    ok: true,
    ...quote,
    publicKey: pk,
    amountRaw: built.amountRaw,
    closesAccount: Boolean(built.closesAccount),
    transaction: built.transaction,
    note: `Unsigned burn of ${quote.tokens} $ORBITX for ${quote.label}. Sign with the holder wallet.`,
  };
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

export async function verifyOrbitxBurn(signature, { packageId, wallet } = {}) {
  const sig = String(signature || "").trim();
  if (!sig || sig.length < 32) {
    return { ok: false, error: "signature_required", message: "Transaction signature is required" };
  }
  const requested = packageId ? resolvePackage(packageId) : null;
  if (packageId && !requested) {
    return {
      ok: false,
      error: "invalid_package",
      message: "Choose package day (100 ORBITX) or week (1,000 ORBITX).",
      packages: listPackages(),
    };
  }

  let tx;
  try {
    tx = await rpc("getTransaction", [
      sig,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
  } catch (e) {
    return { ok: false, error: "rpc_failed", message: String(e?.message || e) };
  }
  if (!tx) {
    return {
      ok: false,
      error: "not_found",
      message: "Transaction not found yet — wait for confirmation and retry.",
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
      message: `Burned ${burnedUi} ORBITX — need 100 (1 day) or 1,000 (1 week).`,
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

export async function confirmAccessBurn(sb, { userId, signature, packageId, wallet } = {}) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { ok: false, error: "user_required", message: "Sign in on /agent, then confirm the burn." };
  }

  const verified = await verifyOrbitxBurn(signature, { packageId, wallet });
  if (!verified.ok) return verified;

  try {
    const existing = await sb(
      `mcp_burn_ledger?tx_signature=eq.${encodeURIComponent(verified.signature)}&select=id,user_id,package_id,expires_at,tokens_burned&limit=1`,
    );
    if (Array.isArray(existing) && existing[0]) {
      const status = await getAccessStatus(sb, uid);
      return {
        ok: true,
        alreadyGranted: true,
        ...status,
        signature: verified.signature,
        packageId: existing[0].package_id,
        message: "This burn already granted MCP access.",
        explorer: verified.explorer,
      };
    }
  } catch {
    /* continue — unique check still applies on insert */
  }

  const now = Date.now();
  const current = await getAccessRow(sb, uid);
  const pkg = verified.package;
  const expiresAt = computeExpiresAt(now, current?.expires_at, pkg.durationMs);
  const tokensBurned = Number(verified.tokensBurned);
  const lifetime = Number(current?.lifetime_tokens_burned || 0) + tokensBurned;
  const iso = new Date(now).toISOString();
  const burnWallet = verified.wallet || String(wallet || "").trim() || current?.wallet_address || null;

  const accessRow = {
    user_id: uid,
    wallet_address: burnWallet,
    package_id: pkg.id,
    tokens_burned: tokensBurned,
    expires_at: expiresAt,
    last_tx_signature: verified.signature,
    lifetime_tokens_burned: lifetime,
    updated_at: iso,
  };

  if (current) {
    await sb(`mcp_burn_access?user_id=eq.${encodeURIComponent(uid)}`, {
      method: "PATCH",
      body: JSON.stringify(accessRow),
      headers: { Prefer: "return=minimal" },
    });
  } else {
    await sb("mcp_burn_access", {
      method: "POST",
      body: JSON.stringify({ ...accessRow, created_at: iso }),
      headers: { Prefer: "return=minimal" },
    });
  }

  try {
    await sb("mcp_burn_ledger", {
      method: "POST",
      body: JSON.stringify({
        user_id: uid,
        wallet_address: burnWallet,
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
  } catch (e) {
    if (/23505|duplicate|unique/i.test(String(e?.code || e?.message || ""))) {
      const status = await getAccessStatus(sb, uid);
      return {
        ok: true,
        alreadyGranted: true,
        ...status,
        signature: verified.signature,
        explorer: verified.explorer,
      };
    }
    throw e;
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
    message: `Ask which MCP access package they want: 1 day (100 $ORBITX) or 1 week (1,000 $ORBITX). Then call ${buyTool} with package=day or package=week.`,
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
    instructions:
      mode === "auto"
        ? [
            "Send the user openUrl as a clickable link.",
            `Opening it auto-prompts Phantom to burn ${quote.tokens} $ORBITX.`,
            `After Phantom confirms, call ${confirmTool} with the signature.`,
          ]
        : [
            "Send the user signUrl as a clickable link.",
            `They approve burning ${quote.tokens} $ORBITX in Phantom.`,
            `Then call ${confirmTool} with the signature (the sign page confirms if they are signed in).`,
          ],
    note: `Non-custodial. Exact burn of ${quote.tokens} $ORBITX unlocks ${quote.label}. Access expires automatically.`,
    accessUrl,
    tools: { buy: buyTool, confirm: confirmTool },
  };
}
