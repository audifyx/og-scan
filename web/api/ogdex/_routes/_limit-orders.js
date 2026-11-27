// OG DEX — Jupiter Trigger v1 limit orders: create / cancel / list.
//
// Feasibility (verified live 2026-11-27, no API key needed):
//   * GET  /trigger/v1/getTriggerOrders?wallet=&orderStatus=active|history
//   * POST /trigger/v1/createOrder  {inputMint, outputMint, maker, payer, params}
//        -> returns an UNSIGNED transaction; the user signs it on-device,
//           then submits it via their own RPC (same pattern as Jupiter swaps).
//   * POST /trigger/v1/cancelOrder  {maker, order} -> unsigned cancel tx.
//   * POST /trigger/v1/cancelOrders {maker, orders[]} (max 5).
//   * POST /trigger/v1/execute exists but is NOT used here: the backend
//     never submits a user transaction; the app signs + sends, exactly like
//     the existing swap flow.
//
// What this gives the app (report §d #7 — the #1 FOMO feature request):
//   * LIMIT BUYS (buy the dip) and TAKE-PROFIT SELLS — the maker signs once,
//     Jupiter keepers fill on-chain when the price crosses. No server wallet,
//     no custody, no executor needed.
//   * STOP-LOSS is NOT possible on Trigger v1: a limit sell priced below the
//     market fills immediately at the bad price (the program does not
//     validate favourability). True below-price triggers need Trigger v2,
//     which holds funds in a Jupiter custodial (Privy) vault + needs a
//     Jupiter API key + JWT challenge flow — NOT built here; see the
//     feasibility note in the commit message. The honest stop-loss fallback
//     is a price alert (the app's alerts) + one-tap sell.
//
// Safety: createOrder is price-checked server-side. A limit order whose
// implied value is worse than the market by >1% would fill instantly at a
// bad price, so it is REJECTED (limit_below_market). If the price/decimals
// lookup fails the order proceeds with priceCheck:"unavailable" and the
// app's own confirmation screen is the last gate — never silently blocked,
// never silently bad.
import { send, readBody, dbSelect, dbInsert, dbUpdate, resilientRpc, SUPA_URL, ANON } from "../_lib.js";

const TRIGGER_V1 = "https://api.jup.ag/trigger/v1";
const JUP_LITE = "https://lite-api.jup.ag";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SOL = "So11111111111111111111111111111111111111112";

const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");
const isSig = (s) => /^[1-9A-HJ-NP-Za-km-z]{43,128}$/.test(s || "");

async function verifySupabaseUser(req) {
  const auth = String(req.headers.authorization || req.headers.Authorization || "");
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m || !SUPA_URL || !ANON) return null;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${m[1]}`, apikey: ANON },
    });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    return u?.id ? { id: u.id } : null;
  } catch {
    return null;
  }
}

async function walletOwnedBy(userId, wallet) {
  try {
    const rows = await dbSelect(
      "profiles",
      `select=wallet_address&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    return rows?.[0]?.wallet_address === wallet;
  } catch {
    return false;
  }
}

async function jupPrices(mints) {
  try {
    const r = await fetch(`${JUP_LITE}/price/v3?ids=${mints.map(encodeURIComponent).join(",")}`);
    if (!r.ok) return {};
    const d = await r.json();
    const out = {};
    for (const m of mints) if (Number(d?.[m]?.usdPrice) > 0) out[m] = Number(d[m].usdPrice);
    return out;
  } catch {
    return {};
  }
}

async function mintDecimals(mint) {
  try {
    const info = await resilientRpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    const dec = info?.value?.data?.parsed?.info?.decimals;
    return Number.isInteger(dec) ? dec : null;
  } catch {
    return null;
  }
}

/**
 * Price-sanity check for a limit order. The implied USD value the maker
 * RECEIVES per unit of input must not be worse than the market value of
 * that input (a limit order is supposed to execute at a BETTER price, so
 * worse-than-market means "fills instantly at a bad price").
 * Returns {checked, ok, reason?, impliedUsdPerInput?, marketUsdPerInput?}.
 */
export async function checkLimitPrice(inputMint, outputMint, makingAmount, takingAmount) {
  const [inDec, outDec] = await Promise.all([mintDecimals(inputMint), mintDecimals(outputMint)]);
  if (inDec === null || outDec === null) return { checked: false, ok: true, reason: "decimals_unavailable" };
  const prices = await jupPrices([inputMint, outputMint]);
  const inUsd = prices[inputMint];
  const outUsd = prices[outputMint];
  if (!inUsd || !outUsd) return { checked: false, ok: true, reason: "price_unavailable" };
  const making = Number(makingAmount) / 10 ** inDec;
  const taking = Number(takingAmount) / 10 ** outDec;
  if (!(making > 0) || !(taking > 0)) return { checked: false, ok: false, reason: "bad_amounts" };
  const impliedUsdPerInput = (taking * outUsd) / making;
  if (impliedUsdPerInput < inUsd * 0.99) {
    return { checked: true, ok: false, reason: "limit_below_market", impliedUsdPerInput, marketUsdPerInput: inUsd };
  }
  return { checked: true, ok: true, impliedUsdPerInput, marketUsdPerInput: inUsd };
}

async function jupPost(path, body) {
  const r = await fetch(`${TRIGGER_V1}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  return { status: r.status, ok: r.ok, json: j };
}

async function jupGet(path) {
  const r = await fetch(`${TRIGGER_V1}${path}`, { headers: { Accept: "application/json" } });
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  return { status: r.status, ok: r.ok, json: j };
}

function mapHistoryStatus(s) {
  const v = String(s || "").toLowerCase();
  if (/cancel/.test(v)) return "cancelled";
  if (/fill|execut|complet/.test(v)) return "filled";
  if (/expir/.test(v)) return "expired";
  return null;
}

async function handleList(res, wallet, status, page) {
  if (!isAddr(wallet)) return send(res, 400, { ok: false, error: "valid wallet address required" });
  const orderStatus = status === "history" ? "history" : "active";
  const p = Math.min(Math.max(Number(page) || 1, 1), 100);
  const [active, history, recorded] = await Promise.all([
    jupGet(`/getTriggerOrders?wallet=${encodeURIComponent(wallet)}&orderStatus=active&page=${p}`),
    jupGet(`/getTriggerOrders?wallet=${encodeURIComponent(wallet)}&orderStatus=history&page=${p}`),
    dbSelect(
      "user_limit_orders",
      `select=*&wallet_address=eq.${encodeURIComponent(wallet)}&order=created_at.desc&limit=100`
    ).catch(() => []),
  ]);
  // Reconcile recorded rows against Jupiter: an 'open' order that Jupiter
  // now lists in history with an explicit filled/cancelled status gets its
  // DB status updated (best-effort — a failure never breaks the list).
  const activeKeys = new Set(((active.json?.orders) || []).map((o) => String(o.order || o.publicKey || o.id || "")));
  const histByKey = new Map();
  for (const o of (history.json?.orders || [])) {
    histByKey.set(String(o.order || o.publicKey || o.id || ""), o);
  }
  const enriched = await Promise.all((recorded || []).map(async (row) => {
    const key = String(row.order_account || "");
    let jupiterStatus = "unknown";
    if (key && activeKeys.has(key)) jupiterStatus = "open";
    else if (key && histByKey.has(key)) {
      jupiterStatus = "closed";
      const mapped = mapHistoryStatus(histByKey.get(key)?.status ?? histByKey.get(key)?.state);
      if (mapped && row.status === "open") {
        await dbUpdate(
          "user_limit_orders",
          `id=eq.${encodeURIComponent(row.id)}`,
          { status: mapped, updated_at: new Date().toISOString() }
        ).catch(() => {});
        row = { ...row, status: mapped };
      }
    }
    return { ...row, jupiterStatus };
  }));
  return send(res, 200, {
    ok: true,
    wallet,
    status: orderStatus,
    orders: orderStatus === "history" ? (history.json?.orders || []) : (active.json?.orders || []),
    totalPages: orderStatus === "history" ? (history.json?.totalPages ?? 0) : (active.json?.totalPages ?? 0),
    page: p,
    totalItems: orderStatus === "history" ? (history.json?.totalItems ?? 0) : (active.json?.totalItems ?? 0),
    recorded: enriched,
    jupiterOk: orderStatus === "history" ? history.ok : active.ok,
  });
}

async function handleCreate(req, res, body) {
  const inputMint = String(body.inputMint || "").trim();
  const outputMint = String(body.outputMint || "").trim();
  const maker = String(body.maker || "").trim();
  const payer = String(body.payer || "").trim();
  const params = body.params || {};
  if (!isAddr(inputMint) || !isAddr(outputMint)) return send(res, 400, { ok: false, error: "valid inputMint and outputMint required" });
  if (!isAddr(maker) || !isAddr(payer)) return send(res, 400, { ok: false, error: "valid maker and payer required" });
  const makingAmount = params.makingAmount;
  const takingAmount = params.takingAmount;
  if (!/^\d+$/.test(String(makingAmount)) || Number(makingAmount) <= 0) {
    return send(res, 400, { ok: false, error: "params.makingAmount must be a positive integer (raw units)" });
  }
  if (!/^\d+$/.test(String(takingAmount)) || Number(takingAmount) <= 0) {
    return send(res, 400, { ok: false, error: "params.takingAmount must be a positive integer (raw units)" });
  }
  // Price-sanity gate: never hand the app a tx that fills instantly below market.
  const check = await checkLimitPrice(inputMint, outputMint, makingAmount, takingAmount);
  if (check.checked && !check.ok) {
    return send(res, 400, {
      ok: false,
      error: "limit_below_market",
      detail: "This limit price is worse than the current market price — it would fill instantly at a bad price. Set a limit at or better than market.",
      priceCheck: check,
    });
  }
  const fwd = await jupPost("/createOrder", { inputMint, outputMint, maker, payer, params });
  if (!fwd.ok) {
    return send(res, fwd.status >= 400 && fwd.status < 500 ? fwd.status : 502, {
      ok: false, error: "jupiter_create_failed", jupiter: fwd.json, priceCheck: check,
    });
  }
  // Jupiter returns the UNSIGNED transaction for the maker to sign on-device.
  // The backend never signs and never submits it.
  return send(res, 200, { ok: true, priceCheck: check, ...fwd.json });
}

async function handleConfirm(req, res, body) {
  const user = await verifySupabaseUser(req);
  if (!user) return send(res, 401, { ok: false, error: "sign in required" });
  const wallet_address = String(body.wallet_address || "").trim();
  const tx_signature = String(body.tx_signature || "").trim();
  const input_mint = String(body.input_mint || "").trim();
  const output_mint = String(body.output_mint || "").trim();
  const direction = String(body.direction || "").trim().toLowerCase();
  if (!isAddr(wallet_address) || !isAddr(input_mint) || !isAddr(output_mint)) {
    return send(res, 400, { ok: false, error: "valid wallet_address, input_mint and output_mint required" });
  }
  if (!isSig(tx_signature)) return send(res, 400, { ok: false, error: "valid tx_signature required" });
  if (direction !== "buy" && direction !== "sell") return send(res, 400, { ok: false, error: "direction must be buy or sell" });
  if (!/^\d+$/.test(String(body.making_amount)) || Number(body.making_amount) <= 0) {
    return send(res, 400, { ok: false, error: "making_amount must be a positive integer (raw units)" });
  }
  if (!/^\d+$/.test(String(body.taking_amount)) || Number(body.taking_amount) <= 0) {
    return send(res, 400, { ok: false, error: "taking_amount must be a positive integer (raw units)" });
  }
  if (!(await walletOwnedBy(user.id, wallet_address))) {
    return send(res, 403, { ok: false, error: "wallet not linked to this account" });
  }
  try {
    const rows = await dbInsert("user_limit_orders", {
      user_id: user.id,
      wallet_address,
      order_account: body.order_account ? String(body.order_account).trim() : null,
      tx_signature,
      input_mint,
      output_mint,
      making_amount: Number(body.making_amount),
      taking_amount: Number(body.taking_amount),
      target_price_usd: body.target_price_usd !== undefined && body.target_price_usd !== null
        ? Number(body.target_price_usd) : null,
      direction,
      status: "open",
    });
    return send(res, 200, { ok: true, id: rows?.[0]?.id || null, duplicate: false });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/409|duplicate|unique/i.test(msg)) return send(res, 200, { ok: true, duplicate: true });
    return send(res, 500, { ok: false, error: "record failed" });
  }
}

async function handleCancel(req, res, body) {
  const maker = String(body.maker || "").trim();
  const order = String(body.order || "").trim();
  if (!isAddr(maker)) return send(res, 400, { ok: false, error: "valid maker required" });
  if (!order) return send(res, 400, { ok: false, error: "order (order account) required" });
  // Returns the UNSIGNED cancel tx for the maker to sign on-device.
  const fwd = await jupPost("/cancelOrder", { maker, order });
  if (!fwd.ok) {
    return send(res, fwd.status >= 400 && fwd.status < 500 ? fwd.status : 502, {
      ok: false, error: "jupiter_cancel_failed", jupiter: fwd.json,
    });
  }
  return send(res, 200, { ok: true, ...fwd.json });
}

async function handleCancelConfirm(req, res, body) {
  const user = await verifySupabaseUser(req);
  if (!user) return send(res, 401, { ok: false, error: "sign in required" });
  const order_account = String(body.order_account || "").trim();
  if (!order_account) return send(res, 400, { ok: false, error: "order_account required" });
  try {
    const rows = await dbSelect(
      "user_limit_orders",
      `select=id,user_id&order_account=eq.${encodeURIComponent(order_account)}&limit=1`
    );
    const row = rows?.[0];
    if (!row || row.user_id !== user.id) {
      return send(res, 403, { ok: false, error: "order not found for this account" });
    }
    await dbUpdate(
      "user_limit_orders",
      `id=eq.${encodeURIComponent(row.id)}`,
      { status: "cancelled", updated_at: new Date().toISOString() }
    );
    return send(res, 200, { ok: true });
  } catch {
    return send(res, 500, { ok: false, error: "update failed" });
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET") {
    return handleList(
      res,
      (url.searchParams.get("wallet") || "").trim(),
      (url.searchParams.get("status") || "active").trim(),
      url.searchParams.get("page")
    );
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  // Read the body ONCE here — readBody consumes the stream, so handlers
  // must not call it again.
  const body = await readBody(req);
  const action = String(body.action || "create").trim().toLowerCase();
  if (action === "create") return handleCreate(req, res, body);
  if (action === "confirm") return handleConfirm(req, res, body);
  if (action === "cancel") return handleCancel(req, res, body);
  if (action === "cancel-confirm") return handleCancelConfirm(req, res, body);
  return send(res, 400, { ok: false, error: "unknown action (create | confirm | cancel | cancel-confirm)" });
}
