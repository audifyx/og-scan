/**
 * OrbitX living on-chain intelligence API.
 * Route: /api/on-chain  (NOT /api/orbitx/* — that rewrites to orbitx-hub)
 *
 * Solana / Helius is authority. This process indexes, never invents.
 */
import { createClient } from "@supabase/supabase-js";
import {
  ORBITX_MINT,
  SOL_MINT,
  JUPITER_V6,
  PUMP_FUN,
  addressKind,
  asNumber,
  classifyHeliusTx,
  classifyRpcTx,
  detectQueryKind,
  isLikelyAddress,
  isLikelySignature,
  isOrbitxMint,
  statusFromLag,
  summarizeEvents,
} from "../shared/orbitx-chain-intel.js";

export const config = { maxDuration: 60 };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Wallet",
};

const buckets = new Map();
const metaCache = new Map();
let solUsdCache = { at: 0, value: null };
let ingestLock = 0;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL
    || process.env.HELIUS_RPC_URL
    || (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "")
    || "https://api.mainnet-beta.solana.com"
  );
}

function heliusKey() {
  return process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY || "";
}

function clientIp(req) {
  const xf = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.socket?.remoteAddress || "unknown";
}

function rateLimit(req, max, windowMs) {
  const key = `${clientIp(req)}:${Math.floor(Date.now() / windowMs)}`;
  const n = (buckets.get(key) || 0) + 1;
  buckets.set(key, n);
  if (buckets.size > 4000) {
    const first = buckets.keys().next().value;
    buckets.delete(first);
  }
  return n <= max;
}

function pathOf(req) {
  const q = req.query || {};
  if (q.path) return String(q.path).replace(/^\/+/, "");
  const url = String(req.url || "");
  const after = url.split("/api/on-chain")[1] || "";
  return after.split("?")[0].replace(/^\/+/, "");
}

function bodyOf(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }
  return req.body && typeof req.body === "object" ? req.body : {};
}

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return req.headers?.["user-agent"]?.includes("vercel-cron") || false;
  return String(req.headers?.authorization || "") === `Bearer ${secret}`;
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

async function heliusEnhanced(address, limit = 25) {
  const key = heliusKey();
  if (!key || !address) return [];
  const url = `https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/transactions?api-key=${encodeURIComponent(key)}&limit=${Math.min(limit, 50)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`helius ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function heliusParse(signatures) {
  const key = heliusKey();
  const sigs = (signatures || []).filter(isLikelySignature).slice(0, 20);
  if (!key || !sigs.length) return [];
  const r = await fetch(`https://api.helius.xyz/v0/transactions?api-key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions: sigs }),
  });
  if (!r.ok) throw new Error(`helius_parse ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function heliusBalances(address) {
  const key = heliusKey();
  if (!key || !isLikelyAddress(address)) return null;
  const r = await fetch(`https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/balances?api-key=${encodeURIComponent(key)}`);
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function solUsd() {
  if (Date.now() - solUsdCache.at < 30_000 && solUsdCache.value != null) return solUsdCache.value;
  try {
    const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + SOL_MINT);
    const j = await r.json();
    const pair = (j.pairs || []).find((p) => p?.chainId === "solana" && p?.priceUsd) || (j.pairs || [])[0];
    const n = asNumber(pair?.priceUsd);
    if (n != null) solUsdCache = { at: Date.now(), value: n };
  } catch {
    /* price optional */
  }
  return solUsdCache.value;
}

async function tokenMeta(mint) {
  if (!mint) return {};
  const hit = metaCache.get(mint);
  if (hit && Date.now() - hit.at < 120_000) return hit.value;
  if (isOrbitxMint(mint)) {
    const base = { symbol: "ORBITX", name: "OrbitX", decimals: 6, mint };
    metaCache.set(mint, { at: Date.now(), value: base });
  }
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`);
    const j = await r.json();
    const pair = (j.pairs || []).find((p) => p?.chainId === "solana") || (j.pairs || [])[0];
    if (!pair) return metaCache.get(mint)?.value || {};
    const value = {
      mint,
      symbol: pair.baseToken?.symbol || null,
      name: pair.baseToken?.name || null,
      image: pair.info?.imageUrl || null,
      website: pair.info?.websites?.[0]?.url || null,
      twitter: (pair.info?.socials || []).find((s) => s.type === "twitter")?.url || null,
      telegram: (pair.info?.socials || []).find((s) => s.type === "telegram")?.url || null,
      price_usd: asNumber(pair.priceUsd),
      market_cap: asNumber(pair.marketCap) ?? asNumber(pair.fdv),
      liquidity_usd: asNumber(pair.liquidity?.usd),
      volume_24h: asNumber(pair.volume?.h24),
      launch_platform: pair.dexId || null,
    };
    metaCache.set(mint, { at: Date.now(), value });
    return value;
  } catch {
    return metaCache.get(mint)?.value || {};
  }
}

async function searchDex(symbol) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`);
    const j = await r.json();
    return (j.pairs || []).filter((p) => p.chainId === "solana").slice(0, 8);
  } catch {
    return [];
  }
}

async function loadTracked(sb) {
  if (!sb) return {};
  const { data } = await sb.from("ox_chain_tracked").select("address,label,label_kind");
  const map = {};
  for (const row of data || []) map[row.address] = row;
  return map;
}

function eventRow(event) {
  return {
    event_id: event.event_id,
    signature: event.signature,
    slot: event.slot,
    block_time: event.block_time,
    event_type: event.event_type,
    status: event.status,
    chain: event.chain,
    program: event.program,
    source: event.source,
    attribution: event.attribution,
    wallet: event.wallet,
    counterparty: event.counterparty,
    source_wallet: event.source_wallet,
    destination_wallet: event.destination_wallet,
    token_ca: event.token_ca,
    token_symbol: event.token_symbol,
    token_name: event.token_name,
    token_image: event.token_image,
    token_decimals: event.token_decimals,
    amount: event.amount,
    sol_amount: event.sol_amount,
    usd_value: event.usd_value,
    market_cap: event.market_cap,
    wallet_balance_before: event.wallet_balance_before,
    wallet_balance_after: event.wallet_balance_after,
    transaction_fee: event.transaction_fee,
    orbitx_related: event.orbitx_related,
    orbitx_event_type: event.orbitx_event_type,
    kol_related: event.kol_related,
    whale_related: event.whale_related,
    importance: event.importance,
    confidence: event.confidence,
    description: event.description,
    metadata: event.metadata || {},
  };
}

async function persistEvents(sb, events, tokenMetaMap) {
  if (!sb || !events.length) return 0;
  const rows = events.map((e) => {
    const meta = e.token_ca ? tokenMetaMap[e.token_ca] : null;
    return eventRow({
      ...e,
      token_symbol: e.token_symbol || meta?.symbol || null,
      token_name: e.token_name || meta?.name || null,
      token_image: e.token_image || meta?.image || null,
      market_cap: e.market_cap ?? meta?.market_cap ?? null,
    });
  });
  const { error } = await sb.from("ox_chain_events").upsert(rows, { onConflict: "event_id" });
  if (error) throw new Error(error.message);
  await rollup(sb, events);
  return rows.length;
}

async function rollup(sb, events) {
  for (const e of events) {
    const t = e.block_time || new Date().toISOString();
    if (e.wallet) {
      const { data: existing } = await sb.from("ox_chain_wallets").select("*").eq("address", e.wallet).maybeSingle();
      const solIn = e.event_type === "SOL_TRANSFER" && e.destination_wallet === e.wallet ? (asNumber(e.sol_amount) || 0) : 0;
      const solOut = e.event_type === "SOL_TRANSFER" && e.source_wallet === e.wallet ? (asNumber(e.sol_amount) || 0) : 0;
      await sb.from("ox_chain_wallets").upsert({
        address: e.wallet,
        first_seen: existing?.first_seen || t,
        last_seen: t,
        tx_count: (existing?.tx_count || 0) + 1,
        sol_received: Number(existing?.sol_received || 0) + solIn,
        sol_sent: Number(existing?.sol_sent || 0) + solOut,
        sol_volume: Number(existing?.sol_volume || 0) + (asNumber(e.sol_amount) || 0),
        estimated_usd_volume: Number(existing?.estimated_usd_volume || 0) + (asNumber(e.usd_value) || 0),
        updated_at: new Date().toISOString(),
      });
    }
    if (e.wallet && e.token_ca) {
      const { data: wt } = await sb.from("ox_chain_wallet_tokens").select("*").eq("wallet", e.wallet).eq("token_ca", e.token_ca).maybeSingle();
      const buy = /BUY/.test(e.event_type);
      const sell = /SELL/.test(e.event_type);
      const burn = /BURN/.test(e.event_type);
      const amt = asNumber(e.amount) || 0;
      const usd = asNumber(e.usd_value) || 0;
      await sb.from("ox_chain_wallet_tokens").upsert({
        wallet: e.wallet,
        token_ca: e.token_ca,
        token_symbol: e.token_symbol,
        bought_amount: Number(wt?.bought_amount || 0) + (buy ? amt : 0),
        sold_amount: Number(wt?.sold_amount || 0) + (sell ? amt : 0),
        burned_amount: Number(wt?.burned_amount || 0) + (burn ? amt : 0),
        bought_usd: Number(wt?.bought_usd || 0) + (buy ? usd : 0),
        sold_usd: Number(wt?.sold_usd || 0) + (sell ? usd : 0),
        last_event_at: t,
      });
    }
    const from = e.source_wallet;
    const to = e.destination_wallet || e.counterparty;
    if (from && to && from !== to) {
      const { data: flow } = await sb
        .from("ox_chain_flows")
        .select("*")
        .eq("from_address", from)
        .eq("to_address", to)
        .is("token_ca", e.token_ca || null)
        .maybeSingle();
      if (flow) {
        await sb.from("ox_chain_flows").update({
          transfer_count: (flow.transfer_count || 0) + 1,
          total_amount: Number(flow.total_amount || 0) + (asNumber(e.amount) || 0),
          total_sol: Number(flow.total_sol || 0) + (asNumber(e.sol_amount) || 0),
          total_usd: Number(flow.total_usd || 0) + (asNumber(e.usd_value) || 0),
          last_seen: t,
          last_signature: e.signature,
        }).eq("id", flow.id);
      } else {
        await sb.from("ox_chain_flows").insert({
          from_address: from,
          to_address: to,
          token_ca: e.token_ca || null,
          token_symbol: e.token_symbol || null,
          transfer_count: 1,
          total_amount: asNumber(e.amount) || 0,
          total_sol: asNumber(e.sol_amount) || 0,
          total_usd: asNumber(e.usd_value) || 0,
          first_seen: t,
          last_seen: t,
          last_signature: e.signature,
        });
      }
    }
    if (e.orbitx_related && e.block_time) {
      const day = e.block_time.slice(0, 10);
      const { data: daily } = await sb.from("ox_chain_orbitx_daily").select("*").eq("day", day).maybeSingle();
      const buy = /BUY/.test(e.event_type);
      const sell = /SELL/.test(e.event_type);
      const burn = /BURN/.test(e.event_type);
      await sb.from("ox_chain_orbitx_daily").upsert({
        day,
        buys: (daily?.buys || 0) + (buy ? 1 : 0),
        sells: (daily?.sells || 0) + (sell ? 1 : 0),
        burns: (daily?.burns || 0) + (burn ? 1 : 0),
        transfers: (daily?.transfers || 0) + (/TRANSFER/.test(e.event_type) ? 1 : 0),
        buy_amount: Number(daily?.buy_amount || 0) + (buy ? asNumber(e.amount) || 0 : 0),
        sell_amount: Number(daily?.sell_amount || 0) + (sell ? asNumber(e.amount) || 0 : 0),
        burn_amount: Number(daily?.burn_amount || 0) + (burn ? asNumber(e.amount) || 0 : 0),
        buy_usd: Number(daily?.buy_usd || 0) + (buy ? asNumber(e.usd_value) || 0 : 0),
        sell_usd: Number(daily?.sell_usd || 0) + (sell ? asNumber(e.usd_value) || 0 : 0),
        updated_at: new Date().toISOString(),
      });
    }
    if (e.token_ca) {
      const meta = await tokenMeta(e.token_ca);
      if (meta.symbol || meta.price_usd) {
        await sb.from("ox_chain_tokens").upsert({
          mint: e.token_ca,
          symbol: meta.symbol || e.token_symbol,
          name: meta.name || e.token_name,
          image: meta.image || e.token_image,
          decimals: e.token_decimals,
          website: meta.website || null,
          twitter: meta.twitter || null,
          telegram: meta.telegram || null,
          launch_platform: meta.launch_platform || null,
          price_usd: meta.price_usd ?? null,
          market_cap: meta.market_cap ?? null,
          liquidity_usd: meta.liquidity_usd ?? null,
          volume_24h: meta.volume_24h ?? null,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }
}

async function ingestAddresses(sb, addresses, opts = {}) {
  const tracked = await loadTracked(sb);
  const price = await solUsd();
  const tokenMetaMap = { [ORBITX_MINT]: await tokenMeta(ORBITX_MINT) };
  let txs = 0;
  let failed = 0;
  let stored = 0;
  const seen = new Set();
  for (const address of addresses) {
    if (!address) continue;
    try {
      const parsed = await heliusEnhanced(address, opts.limit || 20);
      txs += parsed.length;
      for (const tx of parsed) {
        if (!tx?.signature || seen.has(tx.signature)) continue;
        seen.add(tx.signature);
        const mintNeed = new Set();
        for (const t of tx.tokenTransfers || []) if (t.mint) mintNeed.add(t.mint);
        for (const mint of mintNeed) {
          if (!tokenMetaMap[mint]) tokenMetaMap[mint] = await tokenMeta(mint);
        }
        const events = classifyHeliusTx(tx, { tracked, solUsd: price, tokenMeta: tokenMetaMap });
        stored += await persistEvents(sb, events, tokenMetaMap);
      }
    } catch {
      failed += 1;
    }
  }
  return { txs, failed, stored, signatures: seen.size };
}

async function ingestNow(sb, extra = []) {
  if (Date.now() - ingestLock < 7000) return { skipped: true, reason: "throttled" };
  ingestLock = Date.now();
  const { data: trackedRows } = await sb.from("ox_chain_tracked").select("address");
  const watch = [
    ORBITX_MINT,
    JUPITER_V6,
    PUMP_FUN,
    ...((trackedRows || []).map((r) => r.address)),
    ...extra.filter(isLikelyAddress),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 12);
  let chainSlot = null;
  try { chainSlot = await rpc("getSlot", [{ commitment: "confirmed" }]); } catch { /* lag optional */ }
  let result;
  try {
    result = await ingestAddresses(sb, watch, { limit: 18 });
  } catch (e) {
    await sb.from("ox_chain_index_state").upsert({
      id: "solana-mainnet",
      rpc_failures: undefined,
      last_error: e instanceof Error ? e.message : "ingest_failed",
      updated_at: new Date().toISOString(),
    });
    throw e;
  }
  const { data: state } = await sb.from("ox_chain_index_state").select("*").eq("id", "solana-mainnet").maybeSingle();
  const lastSlot = result.signatures ? chainSlot : state?.last_slot;
  await sb.from("ox_chain_index_state").upsert({
    id: "solana-mainnet",
    last_slot: lastSlot ?? chainSlot,
    chain_slot: chainSlot,
    last_ingest_at: new Date().toISOString(),
    events_indexed: Number(state?.events_indexed || 0) + result.stored,
    txs_processed: Number(state?.txs_processed || 0) + result.txs,
    txs_failed: Number(state?.txs_failed || 0) + result.failed,
    lag_slots: chainSlot != null && lastSlot != null ? Math.max(0, chainSlot - lastSlot) : state?.lag_slots ?? null,
    websocket_status: "polling",
    last_error: result.failed ? `${result.failed} address fetch(es) failed` : null,
    updated_at: new Date().toISOString(),
  });
  return { skipped: false, watch, chain_slot: chainSlot, ...result };
}

function applyEventFilters(q, query) {
  const type = String(query.type || "").trim();
  const wallet = String(query.wallet || "").trim();
  const token = String(query.token || "").trim();
  const source = String(query.source || "").trim();
  const minUsd = asNumber(query.min_usd);
  const orbitx = query.orbitx === "1" || query.orbitx === "true";
  const whale = query.whale === "1" || query.whale === "true";
  const kol = query.kol === "1" || query.kol === "true";
  const since = String(query.since || "").trim();
  if (type) q = q.eq("event_type", type.toUpperCase());
  if (wallet) q = q.or(`wallet.eq.${wallet},source_wallet.eq.${wallet},destination_wallet.eq.${wallet}`);
  if (token) q = q.eq("token_ca", token);
  if (source) q = q.ilike("source", source);
  if (minUsd != null) q = q.gte("usd_value", minUsd);
  if (orbitx) q = q.eq("orbitx_related", true);
  if (whale) q = q.eq("whale_related", true);
  if (kol) q = q.eq("kol_related", true);
  if (since) q = q.gte("block_time", since);
  return q;
}

async function handleLive(req, res, sb) {
  if (sb) {
    try { await ingestNow(sb); } catch { /* still serve cache */ }
  }
  const limit = Math.min(Number(req.query?.limit) || 80, 200);
  let q = sb
    .from("ox_chain_events")
    .select("*")
    .order("importance", { ascending: false })
    .order("block_time", { ascending: false })
    .limit(limit);
  q = applyEventFilters(q, req.query || {});
  const { data: events, error } = await q;
  if (error) return json(res, 503, { ok: false, error: error.message });
  const { data: state } = await sb.from("ox_chain_index_state").select("*").eq("id", "solana-mainnet").maybeSingle();
  const live = statusFromLag(state?.lag_slots, state?.last_ingest_at);
  const stats = summarizeEvents(events || []);
  return json(res, 200, {
    ok: true,
    live: live.live,
    live_label: live.label,
    live_reason: live.reason,
    chain_slot: state?.chain_slot ?? null,
    last_slot: state?.last_slot ?? null,
    lag_slots: state?.lag_slots ?? null,
    last_ingest_at: state?.last_ingest_at ?? null,
    websocket_status: state?.websocket_status || "polling",
    sol_usd: await solUsd(),
    stats,
    events: events || [],
    note: "Events are reconstructed from observed Solana transactions. Empty means nothing indexed yet — not synthetic activity.",
  });
}

async function handleEvents(req, res, sb) {
  const limit = Math.min(Number(req.query?.limit) || 50, 200);
  const cursor = String(req.query?.cursor || "").trim();
  let q = sb.from("ox_chain_events").select("*").order("block_time", { ascending: false }).limit(limit + 1);
  q = applyEventFilters(q, req.query || {});
  if (cursor) q = q.lt("block_time", cursor);
  const { data, error } = await q;
  if (error) return json(res, 503, { ok: false, error: error.message });
  const rows = data || [];
  const page = rows.slice(0, limit);
  return json(res, 200, {
    ok: true,
    events: page,
    next_cursor: rows.length > limit ? page[page.length - 1]?.block_time || null : null,
  });
}

async function handleWallet(req, res, sb, address) {
  if (!isLikelyAddress(address)) return json(res, 400, { ok: false, error: "Valid wallet address required." });
  try { await ingestAddresses(sb, [address], { limit: 40 }); } catch { /* serve what we have */ }
  const [{ data: wallet }, { data: events }, { data: tokens }, { data: flows }, { data: tracked }, balances] = await Promise.all([
    sb.from("ox_chain_wallets").select("*").eq("address", address).maybeSingle(),
    sb.from("ox_chain_events").select("*").or(`wallet.eq.${address},source_wallet.eq.${address},destination_wallet.eq.${address}`).order("block_time", { ascending: false }).limit(80),
    sb.from("ox_chain_wallet_tokens").select("*").eq("wallet", address),
    sb.from("ox_chain_flows").select("*").or(`from_address.eq.${address},to_address.eq.${address}`).order("last_seen", { ascending: false }).limit(40),
    sb.from("ox_chain_tracked").select("*").eq("address", address).maybeSingle(),
    heliusBalances(address),
  ]);
  const holdings = [];
  if (balances?.tokens) {
    for (const t of balances.tokens.slice(0, 40)) {
      const meta = await tokenMeta(t.mint);
      holdings.push({
        mint: t.mint,
        amount: t.amount,
        decimals: t.decimals,
        symbol: meta.symbol || (isOrbitxMint(t.mint) ? "ORBITX" : "UNKNOWN"),
        name: meta.name || null,
        image: meta.image || null,
        price_usd: meta.price_usd ?? null,
      });
    }
  }
  return json(res, 200, {
    ok: true,
    address,
    kind: addressKind(address, { tracked: tracked ? { [address]: tracked } : {} }),
    label: tracked?.label || wallet?.label || null,
    label_kind: tracked?.label_kind || "Wallet",
    sol: balances?.nativeBalance != null ? balances.nativeBalance / 1e9 : null,
    wallet,
    tokens: tokens || [],
    holdings,
    events: events || [],
    flows: (flows || []).map((f) => ({
      ...f,
      from_kind: addressKind(f.from_address),
      to_kind: addressKind(f.to_address),
    })),
    note: "Balances come from Helius when configured. Missing fields are UNKNOWN, not estimated.",
  });
}

async function handleToken(req, res, sb, mint) {
  if (!isLikelyAddress(mint)) return json(res, 400, { ok: false, error: "Valid token mint required." });
  try { await ingestAddresses(sb, [mint], { limit: 40 }); } catch { /* cache */ }
  const meta = await tokenMeta(mint);
  const [{ data: stored }, { data: events }, { data: buyers }] = await Promise.all([
    sb.from("ox_chain_tokens").select("*").eq("mint", mint).maybeSingle(),
    sb.from("ox_chain_events").select("*").eq("token_ca", mint).order("block_time", { ascending: false }).limit(80),
    sb.from("ox_chain_wallet_tokens").select("*").eq("token_ca", mint).order("bought_usd", { ascending: false }).limit(20),
  ]);
  return json(res, 200, {
    ok: true,
    mint,
    token: { ...meta, ...stored, mint },
    events: events || [],
    buyers: buyers || [],
  });
}

async function handleTransaction(req, res, sb, signature) {
  if (!isLikelySignature(signature)) return json(res, 400, { ok: false, error: "Valid transaction signature required." });
  const { data: cached } = await sb.from("ox_chain_events").select("*").eq("signature", signature);
  let parsed = [];
  let raw = null;
  try {
    parsed = await heliusParse([signature]);
  } catch { /* rpc fallback */ }
  try {
    raw = await rpc("getTransaction", [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
  } catch { /* keep cached */ }
  const tracked = await loadTracked(sb);
  const price = await solUsd();
  let events = cached || [];
  if (parsed[0]) {
    events = classifyHeliusTx(parsed[0], { tracked, solUsd: price });
    try { await persistEvents(sb, events, {}); } catch { /* read-only still ok */ }
  } else if (raw && !events.length) {
    events = classifyRpcTx(signature, raw, { tracked, solUsd: price });
  }
  if (!raw && !parsed[0] && !events.length) {
    return json(res, 404, { ok: false, error: "Signature not found on-chain." });
  }
  return json(res, 200, {
    ok: true,
    signature,
    slot: raw?.slot ?? events[0]?.slot ?? null,
    block_time: raw?.blockTime ? new Date(raw.blockTime * 1000).toISOString() : events[0]?.block_time ?? null,
    status: raw?.meta?.err ? "FAILED" : events[0]?.status || "confirmed",
    fee: raw?.meta?.fee != null ? raw.meta.fee / 1e9 : events[0]?.transaction_fee ?? null,
    events,
    raw: raw || null,
    parsed: parsed[0] || null,
  });
}

async function handleBlock(req, res, slot) {
  const n = Number(slot);
  if (!Number.isFinite(n) || n < 0) return json(res, 400, { ok: false, error: "Valid slot required." });
  try {
    const block = await rpc("getBlock", [n, { transactionDetails: "signatures", rewards: false, maxSupportedTransactionVersion: 0 }]);
    if (!block) return json(res, 404, { ok: false, error: "Slot not found." });
    return json(res, 200, {
      ok: true,
      slot: n,
      block_time: block.blockTime ? new Date(block.blockTime * 1000).toISOString() : null,
      signatures: (block.signatures || []).slice(0, 80),
      transaction_count: (block.signatures || []).length,
    });
  } catch (e) {
    return json(res, 502, { ok: false, error: e instanceof Error ? e.message : "RPC failed." });
  }
}

async function handleOrbitx(req, res, sb, sub) {
  try { await ingestAddresses(sb, [ORBITX_MINT], { limit: 40 }); } catch { /* cache */ }
  const mint = ORBITX_MINT;
  const { data: events } = await sb.from("ox_chain_events").select("*").eq("orbitx_related", true).order("block_time", { ascending: false }).limit(120);
  const { data: daily } = await sb.from("ox_chain_orbitx_daily").select("*").order("day", { ascending: false }).limit(31);
  const { data: tokens } = await sb.from("ox_chain_wallet_tokens").select("*").eq("token_ca", mint);
  const { data: token } = await sb.from("ox_chain_tokens").select("*").eq("mint", mint).maybeSingle();
  const meta = await tokenMeta(mint);
  const rows = events || [];
  const burns = rows.filter((e) => /BURN/.test(e.event_type || ""));
  const buys = rows.filter((e) => /BUY/.test(e.event_type || ""));
  const sells = rows.filter((e) => /SELL/.test(e.event_type || ""));
  const burners = [...(tokens || [])].sort((a, b) => Number(b.burned_amount || 0) - Number(a.burned_amount || 0)).slice(0, 20);
  const buyers = [...(tokens || [])].sort((a, b) => Number(b.bought_usd || 0) - Number(a.bought_usd || 0)).slice(0, 20);
  const payload = {
    ok: true,
    mint,
    token: { ...meta, ...token, mint },
    events: sub === "burns" ? burns : sub === "buyers" ? buys : rows,
    burns,
    buys,
    sells,
    burners,
    buyers,
    daily: daily || [],
    totals: {
      burned: burns.reduce((s, e) => s + (asNumber(e.amount) || 0), 0) || (tokens || []).reduce((s, t) => s + Number(t.burned_amount || 0), 0),
      burn_events: burns.length,
      largest_burn: burns.reduce((m, e) => Math.max(m, asNumber(e.amount) || 0), 0),
      unique_wallets: new Set(rows.map((e) => e.wallet).filter(Boolean)).size,
      buy_usd: buys.reduce((s, e) => s + (asNumber(e.usd_value) || 0), 0),
      sell_usd: sells.reduce((s, e) => s + (asNumber(e.usd_value) || 0), 0),
    },
  };
  return json(res, 200, payload);
}

async function handleSearch(req, res, sb) {
  const q = String(req.query?.q || bodyOf(req).q || "").trim();
  const kind = detectQueryKind(q);
  if (kind.kind === "empty") return json(res, 400, { ok: false, error: "Search query required." });
  if (kind.kind === "signature") {
    return handleTransaction(req, res, sb, kind.value);
  }
  if (kind.kind === "slot") {
    return handleBlock(req, res, kind.value);
  }
  if (kind.kind === "address") {
    const meta = await tokenMeta(kind.value);
    const looksToken = Boolean(meta.symbol || meta.price_usd || isOrbitxMint(kind.value));
    if (looksToken) return handleToken(req, res, sb, kind.value);
    return handleWallet(req, res, sb, kind.value);
  }
  if (kind.kind === "symbol") {
    if (kind.value === "ORBITX" || kind.value === "OX") return handleToken(req, res, sb, ORBITX_MINT);
    const pairs = await searchDex(kind.value);
    const { data: local } = await sb.from("ox_chain_tokens").select("*").ilike("symbol", kind.value).limit(8);
    return json(res, 200, {
      ok: true,
      kind: "symbol",
      query: kind.value,
      tokens: local || [],
      pairs: pairs.map((p) => ({
        mint: p.baseToken?.address,
        symbol: p.baseToken?.symbol,
        name: p.baseToken?.name,
        price_usd: asNumber(p.priceUsd),
        market_cap: asNumber(p.marketCap) ?? asNumber(p.fdv),
        dex: p.dexId,
      })),
    });
  }
  return json(res, 200, { ok: true, kind: kind.kind, query: kind.value, events: [] });
}

async function handleFlows(req, res, sb, address) {
  if (!isLikelyAddress(address)) return json(res, 400, { ok: false, error: "Valid address required." });
  const { data, error } = await sb
    .from("ox_chain_flows")
    .select("*")
    .or(`from_address.eq.${address},to_address.eq.${address}`)
    .order("last_seen", { ascending: false })
    .limit(80);
  if (error) return json(res, 503, { ok: false, error: error.message });
  return json(res, 200, {
    ok: true,
    address,
    flows: (data || []).map((f) => ({
      ...f,
      from_kind: addressKind(f.from_address),
      to_kind: addressKind(f.to_address),
    })),
  });
}

async function handleStatus(req, res, sb) {
  const { data: state } = await sb.from("ox_chain_index_state").select("*").eq("id", "solana-mainnet").maybeSingle();
  const live = statusFromLag(state?.lag_slots, state?.last_ingest_at);
  let chainSlot = state?.chain_slot ?? null;
  try { chainSlot = await rpc("getSlot", [{ commitment: "confirmed" }]); } catch { /* keep */ }
  return json(res, 200, {
    ok: true,
    ...live,
    state,
    chain_slot: chainSlot,
    helius: Boolean(heliusKey()),
    rpc: Boolean(rpcUrl()),
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.end();
  }
  if (!rateLimit(req, cronAuthorized(req) ? 120 : 60, 60_000)) {
    return json(res, 429, { ok: false, error: "Rate limited." });
  }
  const sb = admin();
  if (!sb) return json(res, 503, { ok: false, error: "Supabase is not configured." });
  const path = pathOf(req);
  const [head, a] = path.split("/");
  try {
    if (!head || head === "live") return await handleLive(req, res, sb);
    if (head === "events") return await handleEvents(req, res, sb);
    if (head === "wallet" && a) return await handleWallet(req, res, sb, a);
    if (head === "token" && a) return await handleToken(req, res, sb, a);
    if ((head === "transaction" || head === "tx") && a) return await handleTransaction(req, res, sb, a);
    if (head === "block" && a) return await handleBlock(req, res, a);
    if (head === "orbitx" && !a) return await handleOrbitx(req, res, sb, "");
    if (head === "orbitx" && a === "burns") return await handleOrbitx(req, res, sb, "burns");
    if (head === "orbitx" && a === "buyers") return await handleOrbitx(req, res, sb, "buyers");
    if (head === "search") return await handleSearch(req, res, sb);
    if (head === "flows" && a) return await handleFlows(req, res, sb, a);
    if (head === "status") return await handleStatus(req, res, sb);
    if (head === "ingest" && (req.method === "POST" || cronAuthorized(req) || req.query?.force === "1")) {
      const extra = [String(req.query?.address || bodyOf(req).address || "")];
      const result = await ingestNow(sb, extra);
      return json(res, 200, { ok: true, ...result });
    }
    if (head === "ingest") return json(res, 405, { ok: false, error: "Ingest is cron/POST only." });
    return json(res, 404, { ok: false, error: `Unknown on-chain path: ${path || "/"}` });
  } catch (e) {
    return json(res, 500, { ok: false, error: e instanceof Error ? e.message : "On-chain API failed." });
  }
}
