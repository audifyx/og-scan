/**
 * MCP trailing stops + take-profit ladders — backend signs. No Phantom popup.
 * Reuses the app_limit fill-size persistence + status writeback pattern so
 * double-fills are impossible: rows live in ox_live_events (kinds
 * app_trailing / app_ladder) with meta.status open|filled|failed|cancelled,
 * and the tick only ever acts on rows that are still "open".
 *
 * Wired by the parent via dispatchTrailingTools / TRAILING_TOOLS / tickUserTrailing.
 */
import { needAuth, sb, tokenInfo, walletRow, tokenBalance, appWalletSell, claimFillRow, resolveFillRow, isFillOpen, FILL_STATUS } from "./_mcp-app-wallet.js";

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Errors that will never succeed on retry — fail the row immediately (same set as app_limit).
const TRAILING_FATAL = new Set(["no_balance", "no_wallet", "bad_mint", "size", "need_size"]);
const TRAILING_MAX_ATTEMPTS = 10;

function badMint(mint) {
  if (!MINT_RE.test(String(mint || "").trim())) return { ok: false, error: "bad_mint" };
  return null;
}

async function safeTokenBalance(owner, mint) {
  try {
    return await tokenBalance(owner, mint);
  } catch {
    return 0;
  }
}

async function mintDecimals(mint) {
  try {
    const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
    const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenSupply", params: [mint] }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    const d = Number(j?.result?.value?.decimals);
    return Number.isFinite(d) ? d : 6;
  } catch {
    return 6;
  }
}

function sizeFor(meta) {
  const s = meta?.size || {};
  const out = { mint: meta.mint };
  if (s.fraction != null) out.fraction = Number(s.fraction);
  else if (s.amount != null) out.amount = s.amount;
  else out.fraction = 1;
  return out;
}

function sizeText(s) {
  if (s.fraction != null) return `${Math.round(Number(s.fraction) * 100)}%`;
  return `${s.amount} tokens`;
}

export async function appTrailingStop(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first." };
  const mint = String(args.mint || args.ca || "").trim();
  const bad = badMint(mint);
  if (bad) return bad;
  const info = await tokenInfo(mint);
  if (!info.priceUsd) return { ok: false, error: "price_unavailable", message: `No live price for ${info.symbol} (${mint}) — trailing stop not armed.` };
  let trailPct = Number(args.trailPct ?? 10);
  if (!Number.isFinite(trailPct)) trailPct = 10;
  trailPct = Math.min(50, Math.max(1, trailPct));
  const size = {};
  if (args.amount != null && args.amount !== "") {
    if (Number(args.amount) <= 0) return { ok: false, error: "size", message: "amount must be a positive token amount." };
    size.amount = String(args.amount);
  } else if (args.fraction != null && args.fraction !== "") {
    size.fraction = Math.min(1, Math.max(0.01, Number(args.fraction)));
    if (!Number.isFinite(size.fraction)) return { ok: false, error: "size", message: "fraction must be between 0.01 and 1." };
  } else {
    size.fraction = 1;
  }
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable", message: "Trailing stop could not be armed — order store unreachable. Retry in a minute." };
  const now = new Date().toISOString();
  const meta = {
    mint,
    symbol: info.symbol,
    side: "sell",
    trailPct,
    peakUsd: info.priceUsd,
    entryUsd: info.priceUsd,
    size,
    status: "open",
    attempts: 0,
    createdAt: now,
  };
  await client.from("ox_live_events").insert({
    kind: "app_trailing",
    agent_id: gate.userId,
    mint,
    symbol: info.symbol,
    side: "sell",
    thesis: `trailing ${trailPct}% ${info.symbol}`,
    meta,
  });
  return {
    ok: true,
    signedOn: "backend",
    trailing: meta,
    message: `Trailing stop armed: sells ${sizeText(size)} of ${info.symbol} if price falls ${trailPct}% from its peak (peak $${info.priceUsd}). Backend watches.`,
  };
}

function validateTranches(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) {
    return { ok: false, message: "tranches must be an array of 1–8 {mult, pct} entries." };
  }
  const ts = [];
  for (const t of raw) {
    const mult = Number(t?.mult);
    const pct = Number(t?.pct);
    if (!Number.isFinite(mult) || mult <= 1) return { ok: false, message: `bad mult ${t?.mult} — each mult must be > 1 (e.g. 2 = take profit at 2x).` };
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) return { ok: false, message: `bad pct ${t?.pct} — each pct must be 1–100.` };
    ts.push({ mult, pct });
  }
  for (let i = 1; i < ts.length; i++) {
    if (!(ts[i].mult > ts[i - 1].mult)) return { ok: false, message: "mults must be strictly ascending (e.g. 2, then 3, then 5)." };
  }
  const sum = ts.reduce((s, t) => s + t.pct, 0);
  if (sum > 100) return { ok: false, message: `pct sum is ${sum}% — must be <= 100 (the rest simply stays unsold).` };
  return { ok: true, ts };
}

export async function appTakeProfitLadder(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first." };
  const mint = String(args.mint || args.ca || "").trim();
  const bad = badMint(mint);
  if (bad) return bad;
  const tv = validateTranches(args.tranches);
  if (!tv.ok) return { ok: false, error: "bad_tranches", message: tv.message };
  const info = await tokenInfo(mint);
  let entryUsd = args.entryUsd != null && args.entryUsd !== "" ? Number(args.entryUsd) : NaN;
  if (args.entryUsd != null && args.entryUsd !== "" && (!Number.isFinite(entryUsd) || entryUsd <= 0)) {
    return { ok: false, error: "bad_entry", message: "entryUsd must be a positive number." };
  }
  if (!Number.isFinite(entryUsd)) {
    if (!info.priceUsd) return { ok: false, error: "price_unavailable", message: `No live price for ${info.symbol} (${mint}) — pass entryUsd or retry later.` };
    entryUsd = info.priceUsd;
  }
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable", message: "Ladder could not be armed — order store unreachable. Retry in a minute." };
  const now = new Date().toISOString();
  const tranches = tv.ts.map((t) => ({ mult: t.mult, pct: t.pct, targetUsd: entryUsd * t.mult, status: "open", attempts: 0, filledAt: null, signature: null, priceUsd: null, lastError: null }));
  const meta = {
    mint,
    symbol: info.symbol,
    side: "sell",
    entryUsd,
    tranches,
    status: "open",
    attempts: 0,
    createdAt: now,
  };
  await client.from("ox_live_events").insert({
    kind: "app_ladder",
    agent_id: gate.userId,
    mint,
    symbol: info.symbol,
    side: "sell",
    thesis: `take-profit ladder ${info.symbol} ${tv.ts.map((t) => `x${t.mult}`).join("/")}`,
    meta,
  });
  return {
    ok: true,
    signedOn: "backend",
    ladder: meta,
    message: `Ladder armed on ${info.symbol}: ${tv.ts.map((t) => `${t.pct}% at ${t.mult}x ($${(entryUsd * t.mult).toFixed(8)})`).join(", ")}. Backend watches and signs each tranche.`,
  };
}

export async function appTrailingList(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const { data } = await client
    .from("ox_live_events")
    .select("id,kind,meta,created_at,mint,symbol")
    .in("kind", ["app_trailing", "app_ladder"])
    .eq("agent_id", gate.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  const open = (data || []).filter((r) => (r.meta?.status || "open") === "open");
  const shape = (r) => ({ id: r.id, kind: r.kind, at: r.created_at, ...(r.meta || {}) });
  return {
    ok: true,
    trailing: open.filter((r) => r.kind === "app_trailing").map(shape),
    ladders: open.filter((r) => r.kind === "app_ladder").map(shape),
  };
}

export async function appTrailingCancel(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const idArg = String(args.id || "").trim();
  const mintArg = String(args.mint || args.ca || "").trim();
  if (!idArg && !mintArg) return { ok: false, error: "need_target", message: "Pass id (from orbitx_app_trailing_list) or mint to cancel all open trailing stops and ladders for that mint." };
  const { data } = await client
    .from("ox_live_events")
    .select("id,kind,meta")
    .in("kind", ["app_trailing", "app_ladder"])
    .eq("agent_id", gate.userId)
    .limit(200);
  const targets = (data || []).filter((r) => {
    if ((r.meta?.status || "open") !== "open") return false;
    if (idArg) return String(r.id) === idArg;
    return String(r.meta?.mint || "") === mintArg;
  });
  if (!targets.length) return { ok: false, error: "not_found", message: "No open trailing stop or ladder matches." };
  const now = new Date().toISOString();
  for (const t of targets) {
    await client.from("ox_live_events").update({ meta: { ...(t.meta || {}), status: "cancelled", cancelledAt: now } }).eq("id", t.id);
  }
  return {
    ok: true,
    cancelled: targets.map((t) => ({ id: t.id, kind: t.kind, mint: t.meta?.mint, symbol: t.meta?.symbol })),
  };
}

async function tickTrailingRow(client, r, userId, now, ctx = {}) {
  const m = r.meta || {};
  let info;
  try {
    info = await tokenInfo(m.mint);
  } catch {
    return null; // price feed hiccup — retry next tick, don't burn an attempt
  }
  if (!info.priceUsd) return null;
  const peak = Number(m.peakUsd) || info.priceUsd;
  const trailPct = Number(m.trailPct) || 10;
  if (info.priceUsd > peak) {
    m.peakUsd = info.priceUsd;
    m.lastCheckAt = now;
    // Guarded: never clobber a concurrent "filling" claim's status.
    await client.from("ox_live_events").update({ meta: { ...m } }).eq("id", r.id).neq("meta->>status", FILL_STATUS);
    return null; // new peak — ratchet up, no fill
  }
  if (info.priceUsd > peak * (1 - trailPct / 100)) return null; // still above the trigger
  if (Number(ctx?.deadlineMs || 0) && Date.now() > Number(ctx.deadlineMs)) return null; // don't start a fill we can't resolve
  // Trigger hit — claim before selling so overlapping ticks can't double-fill.
  const claimed = await claimFillRow(client, r.id, m);
  if (!claimed) return null; // lost the race
  const auth = { userId };
  let fill;
  let execPriceUsd = info.priceUsd;
  let estProceedsUsd = null;
  try {
    const wrow = await walletRow(userId);
    const owner = wrow?.public_key || null;
    const balBefore = owner ? await safeTokenBalance(owner, m.mint) : 0;
    fill = await appWalletSell(auth, sizeFor(m));
    if (fill && fill.ok) {
      execPriceUsd = Number(fill.entryUsd) || info.priceUsd;
      if (owner) {
        const balAfter = await safeTokenBalance(owner, m.mint);
        const soldRaw = Math.max(0, balBefore - balAfter);
        if (soldRaw > 0) {
          const dec = await mintDecimals(m.mint);
          estProceedsUsd = (soldRaw / Math.pow(10, dec)) * execPriceUsd;
        }
      }
    }
  } catch (e) {
    fill = { ok: false, error: "fill_threw", message: e?.message || String(e) };
  }
  const attempts = Number(claimed.attempts || 0);
  const fatal = fill && !fill.ok && TRAILING_FATAL.has(String(fill.error || ""));
  const status = fill && fill.ok ? "filled" : fatal || attempts >= TRAILING_MAX_ATTEMPTS ? "failed" : "open";
  const resolved = await resolveFillRow(client, r.id, {
    ...claimed,
    attempts,
    lastCheckAt: now,
    ...(status !== "open"
      ? {
          filledAt: now,
          lastFill: {
            ok: !!fill?.ok,
            error: fill?.error || null,
            message: fill?.message || null,
            signature: fill?.signature || null,
            priceUsd: execPriceUsd,
            estProceedsUsd,
          },
        }
      : { lastError: fill?.error || fill?.message || null }),
  }, status);
  return { id: r.id, mint: m.mint, kind: "app_trailing", status, attempts, resolved, triggerPct: trailPct, fill: { ok: !!fill?.ok, error: fill?.error || null, signature: fill?.signature || null, priceUsd: execPriceUsd, estProceedsUsd } };
}

async function tickLadderRow(client, r, userId, now, ctx = {}) {
  const m = r.meta || {};
  let info;
  try {
    info = await tokenInfo(m.mint);
  } catch {
    return null; // price feed hiccup — retry next tick
  }
  if (!info.priceUsd) return null;
  const tranches = (m.tranches || []).map((t) => ({ ...t }));
  const hittable = tranches.some((t) => t.status === "open" && info.priceUsd >= Number(t.targetUsd));
  if (!hittable) return null;
  if (Number(ctx?.deadlineMs || 0) && Date.now() > Number(ctx.deadlineMs)) return null; // don't start fills we can't resolve
  // Claim the whole row before selling tranches — overlapping ticks can't double-sell.
  const claimed = await claimFillRow(client, r.id, { ...m, tranches }, { bumpAttempts: false });
  if (!claimed) return null; // lost the race
  const auth = { userId };
  const out = [];
  for (const t of tranches) {
    if (t.status !== "open") continue;
    if (info.priceUsd < Number(t.targetUsd)) continue;
    let fill;
    try {
      fill = await appWalletSell(auth, { mint: m.mint, fraction: Number(t.pct) / 100 });
    } catch (e) {
      fill = { ok: false, error: "fill_threw", message: e?.message || String(e) };
    }
    if (fill && fill.ok) {
      t.status = "filled";
      t.filledAt = now;
      t.signature = fill.signature || null;
      t.priceUsd = Number(fill.entryUsd) || info.priceUsd;
      t.lastError = null;
    } else {
      t.attempts = Number(t.attempts || 0) + 1;
      t.lastError = fill?.error || fill?.message || null;
      if (TRAILING_FATAL.has(String(fill?.error || "")) || t.attempts >= TRAILING_MAX_ATTEMPTS) {
        t.status = "failed";
        t.failedAt = now;
      }
    }
    out.push({ id: r.id, mint: m.mint, kind: "app_ladder", status: t.status, tranche: { mult: t.mult, pct: t.pct }, fill: { ok: !!fill?.ok, error: fill?.error || null, signature: fill?.signature || null } });
  }
  const allDone = tranches.length > 0 && tranches.every((t) => t.status === "filled" || t.status === "failed");
  const resolved = await resolveFillRow(client, r.id, {
    ...claimed,
    tranches,
    lastCheckAt: now,
    ...(allDone ? { filledAt: now } : {}),
  }, allDone ? "filled" : "open");
  return out.length ? out.map((o) => ({ ...o, resolved })) : null;
}

/** Tick this user's open trailing stops and take-profit ladders. Per-row failures never stop the tick. */
export async function tickUserTrailing(userId, ctx) {
  void ctx;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const { data } = await client
    .from("ox_live_events")
    .select("id,kind,meta")
    .in("kind", ["app_trailing", "app_ladder"])
    .eq("agent_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const fills = [];
  let checked = 0;
  let truncated = false;
  const deadlineMs = Number(ctx?.deadlineMs || 0);
  const now = new Date().toISOString();
  for (const r of data || []) {
    if (deadlineMs && Date.now() > deadlineMs) { truncated = true; break; }
    const m = r.meta || {};
    if (!isFillOpen(m)) continue;
    if (!m.mint) continue;
    checked += 1;
    try {
      if (r.kind === "app_trailing") {
        const f = await tickTrailingRow(client, r, userId, now, ctx);
        if (f) fills.push(f);
      } else if (r.kind === "app_ladder") {
        const fs = await tickLadderRow(client, r, userId, now, ctx);
        if (fs) fills.push(...fs);
      }
    } catch {
      /* never throw out of the tick */
    }
  }
  return { ok: true, checked, fills, ...(truncated ? { truncated: true } : {}) };
}

export async function appTrailingTick(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  return tickUserTrailing(gate.userId);
}

export async function dispatchTrailingTools(name, args, auth) {
  if (name === "orbitx_app_trailing_stop") return appTrailingStop(auth, args || {});
  if (name === "orbitx_app_take_profit_ladder") return appTakeProfitLadder(auth, args || {});
  if (name === "orbitx_app_trailing_list") return appTrailingList(auth);
  if (name === "orbitx_app_trailing_cancel") return appTrailingCancel(auth, args || {});
  return null;
}

const authCode = { type: "string" };

export const TRAILING_TOOLS = [
  {
    name: "orbitx_app_trailing_stop",
    description:
      "Arm a backend trailing stop: sells a fraction (or fixed token amount) of a holding when its price falls X% below the highest price seen since arming. The peak ratchets up on green ticks and never down; the backend watches every few minutes and signs the sell when the drop hits. Defaults: 10% trail on 100% of the balance. Backend signs — no click.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        trailPct: { type: "number" },
        fraction: { type: "number" },
        amount: { type: ["number", "string"] },
        authCode,
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_app_take_profit_ladder",
    description:
      "Arm a backend take-profit ladder: sells tranches of a holding as the price hits multiples of the entry price, e.g. [{mult:2,pct:25},{mult:3,pct:25},{mult:5,pct:50}]. entryUsd defaults to the current price. The backend watches and signs each tranche fill; other tranches keep working if one fails. pct values are % of the current balance at fill time. Backend signs — no click.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        tranches: { type: "array", items: { type: "object" } },
        entryUsd: { type: "number" },
        authCode,
      },
      required: ["mint", "tranches"],
    },
  },
  {
    name: "orbitx_app_trailing_list",
    description: "List open trailing stops and take-profit ladders with row ids.",
    inputSchema: { type: "object", properties: { authCode } },
  },
  {
    name: "orbitx_app_trailing_cancel",
    description:
      "Cancel a trailing stop or take-profit ladder. Pass id (from orbitx_app_trailing_list) or mint to cancel all open trailing stops and ladders for that mint.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, mint: { type: "string" }, authCode } },
  },
];
