/**
 * X MCP purchasable credits — pay SOL to PLATFORM_WALLET, get credits.
 * Rate: 10_000 credits per 1 SOL (any amount within min/max).
 *
 * IMPORTANT: Do NOT top-level import @solana/web3.js — it crashes Vercel
 * serverless load for x-mcp / orbitx-hub (same as mcp-ops lazy pattern).
 */

export const PLATFORM_CREDITS_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";
export const CREDITS_PER_SOL = 10_000;
export const MIN_SOL = 0.001;
export const MAX_SOL = 100;

async function loadSolana() {
  return import("@solana/web3.js");
}

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

export function solToCredits(sol) {
  const n = Number(sol);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n * CREDITS_PER_SOL);
}

export function lamportsToCredits(lamports) {
  const n = Number(lamports);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor((n / 1e9) * CREDITS_PER_SOL);
}

export function quoteCredits(solAmount) {
  const sol = Number(solAmount);
  if (!Number.isFinite(sol)) {
    return { ok: false, error: "invalid_amount", message: "solAmount must be a number" };
  }
  if (sol < MIN_SOL) {
    return {
      ok: false,
      error: "amount_too_low",
      message: `Minimum purchase is ${MIN_SOL} SOL`,
      minSol: MIN_SOL,
    };
  }
  if (sol > MAX_SOL) {
    return {
      ok: false,
      error: "amount_too_high",
      message: `Maximum purchase is ${MAX_SOL} SOL`,
      maxSol: MAX_SOL,
    };
  }
  const lamports = Math.round(sol * 1e9);
  const credits = solToCredits(sol);
  return {
    ok: true,
    solAmount: sol,
    lamports,
    credits,
    creditsPerSol: CREDITS_PER_SOL,
    payTo: PLATFORM_CREDITS_WALLET,
    rateLabel: `${CREDITS_PER_SOL.toLocaleString()} credits per 1 SOL`,
    next: "Send SOL to payTo, then call x_credits_confirm with the transaction signature.",
  };
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

/** Build an unsigned SystemProgram.transfer for the buyer to sign. */
export async function buildBuyTransaction({ fromPubkey, solAmount }) {
  const q = quoteCredits(solAmount);
  if (!q.ok) return q;
  const { PublicKey, SystemProgram, Transaction, Connection } = await loadSolana();
  let from;
  try {
    from = new PublicKey(String(fromPubkey));
  } catch {
    return { ok: false, error: "invalid_pubkey", message: "publicKey is not a valid Solana address" };
  }
  const to = new PublicKey(PLATFORM_CREDITS_WALLET);
  const conn = new Connection(rpcUrl(), "confirmed");
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: from,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: q.lamports,
    }),
  );
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  return {
    ...q,
    publicKey: from.toBase58(),
    transactionBase64: Buffer.from(serialized).toString("base64"),
    lastValidBlockHeight,
    recentBlockhash: blockhash,
    explorerPreview: `https://solscan.io/account/${PLATFORM_CREDITS_WALLET}`,
    instructionsForAi: [
      `Ask the user how much SOL they want to spend (any amount from ${MIN_SOL}–${MAX_SOL}).`,
      `Build/sign: they must send ${q.solAmount} SOL to ${PLATFORM_CREDITS_WALLET}.`,
      `After they sign & submit, call x_credits_confirm with the signature — credits credit automatically.`,
      `They can review advanced usage anytime with x_credits_usage.`,
    ],
  };
}

export async function verifySolPayment(signature) {
  const sig = String(signature || "").trim();
  if (!sig || sig.length < 32) {
    return { ok: false, error: "signature_required", message: "tx signature is required" };
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
      message: "Transaction not found yet — wait for confirmation and retry x_credits_confirm",
    };
  }
  if (tx.meta?.err) {
    return { ok: false, error: "tx_failed", message: "On-chain transaction failed" };
  }
  const keys = (tx.transaction?.message?.accountKeys || []).map((k) =>
    typeof k === "string" ? k : k.pubkey,
  );
  const idx = keys.indexOf(PLATFORM_CREDITS_WALLET);
  if (idx < 0) {
    return {
      ok: false,
      error: "wrong_recipient",
      message: `Payment must go to ${PLATFORM_CREDITS_WALLET}`,
    };
  }
  const pre = tx.meta?.preBalances?.[idx] ?? 0;
  const post = tx.meta?.postBalances?.[idx] ?? 0;
  const lamports = post - pre;
  if (lamports <= 0) {
    return { ok: false, error: "no_sol", message: "No SOL received by the OrbitX credits wallet" };
  }
  const solAmount = lamports / 1e9;
  if (solAmount < MIN_SOL * 0.98) {
    return {
      ok: false,
      error: "amount_too_low",
      message: `Received ${solAmount} SOL — minimum is ${MIN_SOL} SOL`,
      lamports,
    };
  }
  const credits = lamportsToCredits(lamports);
  if (credits < 1) {
    return { ok: false, error: "credits_zero", message: "Amount too small to mint credits" };
  }
  return {
    ok: true,
    signature: sig,
    lamports,
    solAmount,
    credits,
    payTo: PLATFORM_CREDITS_WALLET,
  };
}

async function getBalanceRow(sb, userId) {
  const rows = await sb(
    `x_mcp_credits?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function getCreditsBalance(sb, userId) {
  const row = await getBalanceRow(sb, userId);
  return {
    ok: true,
    balance: Number(row?.balance || 0),
    lifetimePurchased: Number(row?.lifetime_purchased || 0),
    lifetimeSpent: Number(row?.lifetime_spent || 0),
    creditsPerSol: CREDITS_PER_SOL,
    payTo: PLATFORM_CREDITS_WALLET,
    usageUrl: "https://www.orbitx.world/x?tab=usage",
    shopUrl: "https://www.orbitx.world/shop",
  };
}

function periodMs(period) {
  const p = String(period || "30d").toLowerCase();
  if (p === "24h" || p === "1d" || p === "day") return 24 * 3600 * 1000;
  if (p === "7d" || p === "week") return 7 * 24 * 3600 * 1000;
  if (p === "30d" || p === "month") return 30 * 24 * 3600 * 1000;
  if (p === "all" || p === "lifetime") return null;
  return 30 * 24 * 3600 * 1000;
}

function dayKey(iso) {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "unknown";
  }
}

function buildUsageMarkdown(report) {
  const a = report.advanced || {};
  const s = a.summary || {};
  const packs = (a.suggestedPacks || [])
    .map((p) => `· ${p.sol} SOL → ${Number(p.credits).toLocaleString()} credits`)
    .join("\n");
  const series = (a.daily || [])
    .slice(-14)
    .map((d) => `${d.day}: +${d.purchased} / −${d.spent} (${d.solIn} SOL)`)
    .join("\n");
  const posts = a.agentPosts
    ? `Daily posts · ${a.agentPosts.remaining}/${a.agentPosts.max} left (used ${a.agentPosts.used}) · replies cap ${a.agentPosts.replyMax ?? "—"}`
    : null;
  return [
    `# OrbitX · Advanced credits usage`,
    ``,
    `**Balance** · ${Number(s.balance || 0).toLocaleString()} credits`,
    `**Period** · ${s.period || "30d"} · bought ${Number(s.periodPurchased || 0).toLocaleString()} · spent ${Number(s.periodSpent || 0).toLocaleString()} · SOL in ${Number(s.periodSolIn || 0).toFixed(4)}`,
    `**Lifetime** · bought ${Number(s.lifetimePurchased || 0).toLocaleString()} · spent ${Number(s.lifetimeSpent || 0).toLocaleString()} · SOL ${Number(s.lifetimeSolIn || 0).toFixed(4)}`,
    s.runwayDays != null ? `**Runway** · ~${s.runwayDays} days at current spend` : `**Runway** · n/a (no spend yet)`,
    `**Rate** · ${Number(s.rate || CREDITS_PER_SOL).toLocaleString()} credits / 1 SOL`,
    `**Desk wallet** · \`${PLATFORM_CREDITS_WALLET}\``,
    posts ? `\n${posts}` : "",
    ``,
    `## Suggested packs`,
    packs || "· 0.1 / 0.5 / 1 SOL",
    ``,
    `## Recent daily`,
    series || "(no activity in period)",
    ``,
    `## How to buy`,
    `Say: buy credits → amount → open sign link → Phantom pays desk wallet → credits apply.`,
    `Dashboard · ${report.usageUrl || "https://www.orbitx.world/x?tab=usage"}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Advanced usage report for dashboard + Grok/Claude.
 * @param {object} [opts]
 * @param {string} [opts.period] 24h|7d|30d|all
 * @param {number} [opts.limit]
 * @param {object} [opts.agentPosts] optional { used, max, remaining, replyMax }
 * @param {'json'|'markdown'|'both'} [opts.format]
 */
export async function getCreditsUsage(sb, userId, { limit = 50, period = "30d", agentPosts = null, format = "both" } = {}) {
  const bal = await getCreditsBalance(sb, userId);
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  const windowMs = periodMs(period);
  const sinceIso = windowMs ? new Date(Date.now() - windowMs).toISOString() : null;

  let ledger = [];
  try {
    let path = `x_mcp_credit_ledger?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${lim}&select=id,kind,amount,balance_after,sol_lamports,tx_signature,description,meta,created_at`;
    if (sinceIso) path += `&created_at=gte.${encodeURIComponent(sinceIso)}`;
    ledger = await sb(path);
  } catch {
    ledger = [];
  }

  // Lifetime SOL from a wider fetch when period-filtered
  let lifetimeSolIn = 0;
  try {
    const life = await sb(
      `x_mcp_credit_ledger?user_id=eq.${encodeURIComponent(userId)}&kind=eq.purchase&select=sol_lamports&limit=500`,
    );
    for (const row of Array.isArray(life) ? life : []) {
      lifetimeSolIn += Number(row.sol_lamports || 0) / 1e9;
    }
  } catch {
    lifetimeSolIn = 0;
  }

  const entries = (Array.isArray(ledger) ? ledger : []).map((e) => ({
    id: e.id,
    kind: e.kind,
    amount: Number(e.amount),
    balanceAfter: e.balance_after != null ? Number(e.balance_after) : null,
    sol: e.sol_lamports != null ? Number(e.sol_lamports) / 1e9 : null,
    txSignature: e.tx_signature || null,
    description: e.description || null,
    createdAt: e.created_at,
    explorer: e.tx_signature ? `https://solscan.io/tx/${e.tx_signature}` : null,
  }));

  const purchased = entries.filter((e) => e.kind === "purchase");
  const spent = entries.filter((e) => e.kind === "spend");
  const periodPurchased = purchased.reduce((n, e) => n + Math.max(0, e.amount), 0);
  const periodSpentAbs = spent.reduce((n, e) => n + Math.abs(Number(e.amount) || 0), 0);
  const periodSolIn = purchased.reduce((n, e) => n + (Number(e.sol) || 0), 0);

  const byDay = new Map();
  for (const e of entries) {
    const k = dayKey(e.createdAt);
    if (!byDay.has(k)) byDay.set(k, { day: k, purchased: 0, spent: 0, solIn: 0, txs: 0 });
    const d = byDay.get(k);
    d.txs += 1;
    if (e.kind === "purchase") {
      d.purchased += Math.max(0, e.amount);
      d.solIn += Number(e.sol) || 0;
    } else if (e.kind === "spend") {
      d.spent += Math.abs(e.amount);
    }
  }
  const daily = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));

  const daysInPeriod =
    windowMs != null ? Math.max(1, windowMs / (24 * 3600 * 1000)) : Math.max(1, daily.length || 1);
  const burnPerDay = periodSpentAbs / daysInPeriod;
  const runwayDays =
    burnPerDay > 0 ? Math.round((bal.balance / burnPerDay) * 10) / 10 : bal.balance > 0 ? null : 0;

  const suggestedPacks = [
    { sol: 0.1, credits: solToCredits(0.1), label: "Starter" },
    { sol: 0.5, credits: solToCredits(0.5), label: "Standard" },
    { sol: 1, credits: solToCredits(1), label: "Pro" },
    { sol: 5, credits: solToCredits(5), label: "Whale" },
  ];

  const periodLabel = String(period || "30d").toLowerCase();
  const report = {
    ok: true,
    ...bal,
    period: periodLabel,
    lifetimeSolIn: Number(lifetimeSolIn.toFixed(6)),
    advanced: {
      summary: {
        balance: bal.balance,
        lifetimePurchased: bal.lifetimePurchased,
        lifetimeSpent: bal.lifetimeSpent,
        lifetimeSolIn: Number(lifetimeSolIn.toFixed(6)),
        period: periodLabel,
        periodPurchased,
        periodSpent: periodSpentAbs,
        periodSolIn: Number(periodSolIn.toFixed(6)),
        purchaseCount: purchased.length,
        spendCount: spent.length,
        avgPurchaseCredits:
          purchased.length > 0 ? Math.round(periodPurchased / purchased.length) : 0,
        burnPerDay: Math.round(burnPerDay * 10) / 10,
        runwayDays,
        rate: bal.creditsPerSol,
        payWallet: PLATFORM_CREDITS_WALLET,
      },
      agentPosts: agentPosts || null,
      suggestedPacks,
      daily,
      howToBuy: [
        "Tell Grok/Claude: buy credits (or buy N credits / 0.5 SOL)",
        "They call x_credits_buy / orbitx_credits_buy → open signUrl",
        "Phantom sends SOL to the OrbitX desk wallet",
        "x_credits_confirm (or sign page) credits your balance",
        "Ask for advanced usage anytime → x_credits_usage",
      ],
      ledger: entries,
    },
    ledger: entries,
  };

  const markdown = buildUsageMarkdown(report);
  report.markdown = markdown;
  report.__mcpFormat = format === "json" ? "json" : "markdown";
  if (format === "markdown") {
    return {
      ok: true,
      __mcpFormat: "markdown",
      markdown,
      balance: bal.balance,
      period: periodLabel,
      usageUrl: bal.usageUrl,
    };
  }
  return report;
}

export async function confirmCreditsPurchase(sb, userId, signature) {
  const verified = await verifySolPayment(signature);
  if (!verified.ok) return verified;

  // Idempotent — same signature never credits twice
  try {
    const existing = await sb(
      `x_mcp_credit_ledger?tx_signature=eq.${encodeURIComponent(verified.signature)}&select=id,user_id,amount,balance_after&limit=1`,
    );
    if (Array.isArray(existing) && existing[0]) {
      const bal = await getCreditsBalance(sb, userId);
      return {
        ok: true,
        alreadyCredited: true,
        creditsAdded: Number(existing[0].amount || 0),
        ...bal,
        signature: verified.signature,
        message: "This payment was already credited",
      };
    }
  } catch {
    /* continue */
  }

  const current = await getBalanceRow(sb, userId);
  const prev = Number(current?.balance || 0);
  const next = prev + verified.credits;
  const lifetimePurchased = Number(current?.lifetime_purchased || 0) + verified.credits;
  const now = new Date().toISOString();

  if (current) {
    await sb(`x_mcp_credits?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        balance: next,
        lifetime_purchased: lifetimePurchased,
        updated_at: now,
      }),
      headers: { Prefer: "return=minimal" },
    });
  } else {
    await sb("x_mcp_credits", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        balance: next,
        lifetime_purchased: verified.credits,
        lifetime_spent: 0,
        updated_at: now,
        created_at: now,
      }),
      headers: { Prefer: "return=minimal" },
    });
  }

  try {
    await sb("x_mcp_credit_ledger", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        kind: "purchase",
        amount: verified.credits,
        balance_after: next,
        sol_lamports: verified.lamports,
        tx_signature: verified.signature,
        description: `Purchased ${verified.credits} credits for ${verified.solAmount} SOL`,
        meta: {
          solAmount: verified.solAmount,
          payTo: PLATFORM_CREDITS_WALLET,
          creditsPerSol: CREDITS_PER_SOL,
        },
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch (e) {
    // Unique constraint race — treat as already credited
    if (String(e?.code || e?.message || "").includes("23505") || /duplicate|unique/i.test(String(e?.message))) {
      const bal = await getCreditsBalance(sb, userId);
      return { ok: true, alreadyCredited: true, ...bal, signature: verified.signature };
    }
    throw e;
  }

  return {
    ok: true,
    alreadyCredited: false,
    creditsAdded: verified.credits,
    solAmount: verified.solAmount,
    signature: verified.signature,
    balance: next,
    lifetimePurchased,
    lifetimeSpent: Number(current?.lifetime_spent || 0),
    creditsPerSol: CREDITS_PER_SOL,
    payTo: PLATFORM_CREDITS_WALLET,
    explorer: `https://solscan.io/tx/${verified.signature}`,
    message: `+${verified.credits} credits added. New balance: ${next}.`,
    usageUrl: "https://www.orbitx.world/x?tab=usage",
  };
}

export function creditsBuyPrompt() {
  return {
    ok: true,
    action: "ask_amount",
    message:
      "Ask how many credits they want (or how much SOL). Then call orbitx_credits_buy / x_credits_buy with credits or solAmount. That starts a Phantom sign link which sends SOL to the OrbitX desk wallet.",
    minSol: MIN_SOL,
    maxSol: MAX_SOL,
    creditsPerSol: CREDITS_PER_SOL,
    payTo: PLATFORM_CREDITS_WALLET,
    examples: [
      "buy 5000 credits → solAmount 0.5",
      "buy 0.1 SOL of credits → 1,000 credits",
      "auto confirm → openUrl with ?auto=1 (Phantom pops)",
    ],
  };
}

/** Accept either SOL or credit count. */
export function resolvePurchaseAmount({ solAmount, credits, amount } = {}) {
  if (solAmount != null && solAmount !== "") {
    return quoteCredits(solAmount);
  }
  const creditN = Number(credits ?? (amount != null && Number(amount) >= 10 ? amount : NaN));
  if (Number.isFinite(creditN) && creditN >= 1) {
    const sol = creditN / CREDITS_PER_SOL;
    const q = quoteCredits(sol);
    if (!q.ok) return q;
    return { ...q, requestedCredits: Math.floor(creditN) };
  }
  const maybeSol = Number(amount);
  if (Number.isFinite(maybeSol) && maybeSol > 0 && maybeSol < 10) {
    return quoteCredits(maybeSol);
  }
  return {
    ok: false,
    error: "amount_required",
    message: "Pass solAmount (SOL) or credits (count). Example: credits: 5000 or solAmount: 0.5",
  };
}

/**
 * MCP handoff — quote + Phantom sign URLs (SOL → desk wallet → auto credit on confirm).
 */
export function prepareCreditsMcpPurchase({
  base = "https://www.orbitx.world",
  wallet,
  solAmount,
  credits,
  amount,
  confirmMode = "sign",
  preferAuto = false,
} = {}) {
  const pk = String(wallet || "").trim();
  if (!pk || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pk)) {
    return {
      ok: false,
      error: "wallet_required",
      message: "Link a Solana wallet on https://www.orbitx.world/agent (or pass publicKey).",
      fixUrl: "https://www.orbitx.world/agent",
      payTo: PLATFORM_CREDITS_WALLET,
    };
  }
  const q = resolvePurchaseAmount({ solAmount, credits, amount });
  if (!q.ok) return q;

  const modeRaw = String(confirmMode || "").toLowerCase();
  const mode =
    preferAuto || modeRaw === "auto" || modeRaw === "automatic" || modeRaw === "chat"
      ? "auto"
      : "sign";

  const qs = new URLSearchParams({
    kind: "credits",
    amount: String(q.solAmount),
    publicKey: pk,
  });
  const signUrl = `${base}/agent/sign?${qs.toString()}`;
  const autoQs = new URLSearchParams(qs);
  autoQs.set("auto", "1");
  const autoSignUrl = `${base}/agent/sign?${autoQs.toString()}`;
  const openUrl = mode === "auto" ? autoSignUrl : signUrl;

  return {
    ok: true,
    status: mode === "auto" ? "awaiting_auto_phantom" : "awaiting_phantom_signature",
    requiresSignature: true,
    confirmMode: mode,
    ...q,
    wallet: pk,
    signUrl,
    autoSignUrl,
    openUrl,
    instructions:
      mode === "auto"
        ? [
            "Send the user openUrl / autoSignUrl as a clickable link.",
            "Opening it auto-prompts Phantom to send SOL to the OrbitX desk wallet.",
            "After Phantom confirms, call orbitx_credits_confirm / x_credits_confirm with the signature (or the sign page credits them if signed in).",
          ]
        : [
            "Send the user signUrl as a clickable link.",
            "They approve the SOL transfer to the desk wallet in Phantom.",
            "If they say yes/confirm/auto — call again with confirmMode=auto, or call orbitx_credits_confirm after they pay.",
          ],
    note: `Non-custodial. SOL goes to ${PLATFORM_CREDITS_WALLET}. Credits apply after the payment is confirmed.`,
    usageUrl: "https://www.orbitx.world/x?tab=usage",
    shopUrl: "https://www.orbitx.world/shop",
  };
}
