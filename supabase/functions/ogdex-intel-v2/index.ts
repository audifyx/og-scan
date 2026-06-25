// ogdex-intel-v2 — token holder + trade + safety intelligence for OG DEX.
// Contract-compatible with the original ogdex-intel (holders/trades/safety) and
// ADDS deeper KOL & whale coverage: every holder and trade is cross-referenced
// against the tracked KOL directory and a public-wallet label registry, so the
// token page can show *who* is actually holding (KOLs, exchanges, AMMs, burn).
//
// Sources: Birdeye (holders + trades, Helius DAS fallback) · Rugcheck (safety).
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") || "";
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const BURN = new Set([
  "1nc1nerator11111111111111111111111111111111",
  "11111111111111111111111111111111",
]);
// Public infrastructure / custodial wallets (name + kind).
const PUBLIC_LABELS: Record<string, { name: string; kind: string }> = {
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j": { name: "Raydium Authority V4", kind: "amm" },
  "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg": { name: "Pump.fun AMM Authority", kind: "launchpad" },
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": { name: "Pump.fun Fee", kind: "launchpad" },
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": { name: "Binance", kind: "exchange" },
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": { name: "Coinbase", kind: "exchange" },
  "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": { name: "Coinbase Custody", kind: "exchange" },
  "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2": { name: "Bybit", kind: "exchange" },
  "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE": { name: "Kraken", kind: "exchange" },
  "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD": { name: "OKX", kind: "exchange" },
};

const beHeaders = { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana", accept: "application/json" };

async function birdeyeHolders(mint: string) {
  try {
    const r = await fetch(`https://public-api.birdeye.so/defi/v3/token/holder?address=${mint}&offset=0&limit=100`, { headers: beHeaders });
    if (!r.ok) return null;
    const j = await r.json();
    const items = j?.data?.items || [];
    if (!items.length) return null;
    return items.map((it: any) => ({
      owner: it.owner, tokenAccount: it.token_account || null,
      uiAmount: num(it.ui_amount) ?? (num(it.amount) != null && num(it.decimals) != null ? Number(it.amount) / 10 ** Number(it.decimals) : null),
      decimals: num(it.decimals),
    }));
  } catch { return null; }
}

// Helius DAS fallback for holders.
async function heliusHolders(mint: string, decimals: number | null) {
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccounts", params: { mint, limit: 100, page: 1, options: { showZeroBalance: false } } }),
    });
    const j = await r.json();
    const accts = j?.result?.token_accounts || [];
    const dec = decimals ?? 0;
    return accts.map((a: any) => ({ owner: a.owner, tokenAccount: a.address || null, uiAmount: Number(a.amount) / 10 ** dec, decimals: dec }))
      .sort((x: any, y: any) => (y.uiAmount || 0) - (x.uiAmount || 0)).slice(0, 100);
  } catch { return []; }
}

async function heliusTokenSupply(mint: string) {
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenSupply", params: [mint] }),
    });
    const v = (await r.json())?.result?.value;
    if (!v) return { supply: null, decimals: null };
    return { supply: num(v.uiAmount) ?? (num(v.amount) != null && num(v.decimals) != null ? Number(v.amount) / 10 ** Number(v.decimals) : null), decimals: num(v.decimals) };
  } catch { return { supply: null, decimals: null }; }
}
async function tokenSupply(mint: string) {
  // True on-chain total supply (matches Jupiter / Solscan) — Birdeye "supply" is
  // circulating and understates the denominator, inflating holder %.
  const h = await heliusTokenSupply(mint);
  if (h.supply) return { supply: h.supply, decimals: h.decimals, holders: null };
  try {
    const r = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${mint}`, { headers: beHeaders });
    if (!r.ok) return { supply: null, decimals: h.decimals, holders: null };
    const d = (await r.json())?.data || {};
    return { supply: num(d.supply) ?? num(d.totalSupply), decimals: num(d.decimals) ?? h.decimals, holders: num(d.holder) };
  } catch { return { supply: null, decimals: h.decimals, holders: null }; }
}

let _tradesDebug: any = null;
async function birdeyeTrades(mint: string) {
  try {
    const r = await fetch(`https://public-api.birdeye.so/defi/txs/token?address=${mint}&offset=0&limit=50&tx_type=swap&sort_type=desc`, { headers: beHeaders });
    const jr = await r.json().catch(() => null);
    _tradesDebug = { status: r.status, keys: jr ? Object.keys(jr) : null, dataKeys: jr?.data ? Object.keys(jr.data) : null, itemsLen: jr?.data?.items?.length ?? null, sample: (jr?.data?.items || [])[0] || null };
    if (!r.ok) return [];
    const items = jr?.data?.items || [];
    return items.map((t: any) => {
      // Determine the side relative to the target token.
      let side = t.side || null;
      const from = t.from || {}, to = t.to || {};
      const baseIsTo = (to.address === mint);
      if (!side) side = baseIsTo ? "buy" : "sell";
      const tokenLeg = baseIsTo ? to : from;
      return {
        side, time: (num(t.blockUnixTime) || 0) * 1000,
        volumeUsd: num(t.volumeUSD) ?? num(t.volume_usd) ?? num(t.volumeUsd),
        tokenAmount: num(tokenLeg.uiAmount) ?? num(tokenLeg.amount),
        priceUsd: num(tokenLeg.price) ?? num(t.priceUsd),
        owner: t.owner || t.from?.owner || null,
        txHash: t.txHash || t.tx_hash || null,
        dex: t.source || t.dex || null,
      };
    }).filter((t: any) => t.txHash);
  } catch { return []; }
}

async function rugcheck(mint: string) {
  try {
    const r = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const d = await r.json();
    const market = (d.markets || [])[0] || {};
    const lpLockedPct = num(market?.lp?.lpLockedPct) ?? num(d.lpLockedPct) ?? 0;
    return {
      riskScore: num(d.score_normalised) ?? num(d.score),
      rugged: !!d.rugged,
      mintAuthorityRenounced: d.mintAuthority == null ? true : !d.mintAuthority,
      freezeAuthorityRenounced: d.freezeAuthority == null ? true : !d.freezeAuthority,
      lpLockedPct,
      launchpad: d.launchpad || null,
      isPumpFun: /pump$/i.test(mint) || /pump/i.test(d.tokenProgram || ""),
      creator: d.creator || null,
      creatorTokensCount: null,
      totalHolders: num(d.totalHolders),
      risks: (d.risks || []).map((x: any) => ({ name: x.name, level: x.level, desc: x.description || x.value || "", score: num(x.score) })),
    };
  } catch { return null; }
}

const GT_HDR = { Accept: "application/json;version=20230302" };
async function geckoTrades(mint: string) {
  try {
    const pr = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools`, { headers: GT_HDR }).then((r) => r.ok ? r.json() : null).catch(() => null);
    const pools = (pr?.data || []).map((p: any) => ({ addr: p.attributes?.address, liq: Number(p.attributes?.reserve_in_usd) || 0 })).filter((p: any) => p.addr).sort((a: any, b: any) => b.liq - a.liq);
    const pool = pools[0]?.addr; if (!pool) return [];
    const tr = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/trades`, { headers: GT_HDR }).then((r) => r.ok ? r.json() : null).catch(() => null);
    return (tr?.data || []).slice(0, 50).map((it: any) => {
      const a = it.attributes || {};
      const buy = a.kind === "buy";
      return {
        side: a.kind || (buy ? "buy" : "sell"),
        time: a.block_timestamp ? new Date(a.block_timestamp).getTime() : 0,
        volumeUsd: num(a.volume_in_usd),
        tokenAmount: num(buy ? a.to_token_amount : a.from_token_amount),
        priceUsd: num(a.price_to_in_usd) ?? num(a.price_from_in_usd),
        owner: a.tx_from_address || null,
        txHash: a.tx_hash || null,
        dex: pools[0]?.dex || "geckoterminal",
      };
    }).filter((t: any) => t.txHash);
  } catch { return []; }
}

function labelHolder(h: any, pct: number, pub: any, isKol: boolean) {
  if (isKol) return "kol";
  if (BURN.has(h.owner)) return "burn";
  if (pub) return pub.kind === "amm" || pub.kind === "launchpad" ? "liquidity pool" : pub.kind;
  if (pct >= 1) return "whale";
  if (pct >= 0.5) return "large holder";
  return "holder";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const mint = String(body.mint || url.searchParams.get("mint") || "");
    if (!mint) return json({ ok: false, error: "mint required" }, 400);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const [overview, safety, kolRows] = await Promise.all([
      tokenSupply(mint),
      rugcheck(mint),
      sb.from("ogdex_kol_directory").select("address,name,x_handle,tags,status").then((r) => r.data || []).catch(() => []),
    ]);

    let holders = await birdeyeHolders(mint);
    const sourcesHolders = holders ? "birdeye" : "helius";
    if (!holders) holders = await heliusHolders(mint, overview.decimals);
    holders = holders || [];

    let trades = await birdeyeTrades(mint);
    let tradesSource = "birdeye";
    if (!trades.length) { trades = await geckoTrades(mint); tradesSource = trades.length ? "geckoterminal" : "none"; }

    const totalSupply = overview.supply ?? ((holders.reduce((s: number, h: any) => s + (h.uiAmount || 0), 0)) || null);
    const kolMap: Record<string, any> = {};
    for (const k of kolRows as any[]) kolMap[k.address] = { name: k.name, twitter: k.x_handle, tags: k.tags || [], status: k.status };

    const ranked = holders.map((h: any, i: number) => {
      const pct = totalSupply ? (h.uiAmount / totalSupply) * 100 : null;
      const pub = PUBLIC_LABELS[h.owner] || null;
      const kol = kolMap[h.owner] || null;
      return {
        rank: i + 1, owner: h.owner, tokenAccount: h.tokenAccount,
        uiAmount: h.uiAmount, pct, decimals: h.decimals,
        label: labelHolder(h, pct ?? 0, pub, !!kol),
        kol: kol ? { name: kol.name, twitter: kol.twitter } : null,
        publicLabel: pub ? { name: pub.name, kind: pub.kind } : null,
      };
    });

    // Deeper KOL & whale rollups.
    const kolHolders = ranked.filter((h) => h.kol).map((h) => ({ owner: h.owner, name: h.kol!.name, twitter: h.kol!.twitter, pct: h.pct }));
    const whaleHolders = ranked.filter((h) => h.label === "whale").map((h) => ({ owner: h.owner, pct: h.pct, uiAmount: h.uiAmount }));
    const tradesEnriched = trades.map((t: any) => ({
      ...t,
      kol: kolMap[t.owner] ? { name: kolMap[t.owner].name, twitter: kolMap[t.owner].x_handle } : null,
      publicLabel: PUBLIC_LABELS[t.owner] ? { name: PUBLIC_LABELS[t.owner].name, kind: PUBLIC_LABELS[t.owner].kind } : null,
    }));

    return json({
      ok: true, mint, totalSupply,
      holders: ranked, holderCount: ranked.length,
      trades: tradesEnriched, tradeCount: tradesEnriched.length,
      kolHolders, whaleHolders,
      kolHolderCount: kolHolders.length, whaleCount: whaleHolders.length,
      safety: safety || {},
      sources: { holders: sourcesHolders, trades: tradesSource, safety: safety ? "rugcheck" : "none", kol: "ogdex_kol_directory" },
      _debug: body.debug ? { trades: _tradesDebug, supply: totalSupply } : undefined,
    });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
