// OG DEX — a wallet's recent on-chain trades (buy/sell swaps), enriched with
// token name/symbol/image so the UI can render a feed with 1-tap "Ape" links.
// Uses the same balance-delta swap parser as PnL; no indexer, no new secrets.
import { callFn, send, cache } from "../_lib.js";
import { parseSwap } from "../_swap.js";
import { mapPool } from "../_pnl.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag";
const GT = "https://api.geckoterminal.com/api/v2";
const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

async function rpcTx(signature) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const t = await rpc("getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (t) return t;
    } catch {
      /* retry */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

async function gtMeta(mints) {
  const out = {};
  const uniq = [...new Set(mints.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 30) {
    const chunk = uniq.slice(i, i + 30);
    try {
      const r = await fetch(`${GT}/networks/solana/tokens/multi/${chunk.join(",")}`, {
        headers: { Accept: "application/json;version=20230302" },
      });
      if (!r.ok) continue;
      const d = await r.json();
      for (const t of d?.data || []) {
        const a = t.attributes || {};
        out[a.address] = {
          name: a.name,
          symbol: a.symbol,
          image: a.image_url && a.image_url !== "missing.png" ? a.image_url : null,
        };
      }
    } catch {}
  }
  return out;
}

async function solPrice() {
  try {
    const r = await fetch(`${JUP}/price/v3?ids=${SOL_MINT}`);
    const d = await r.json();
    return Number(d[SOL_MINT]?.usdPrice) || 0;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const address = (url.searchParams.get("address") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 40, 1), 100);
  if (!isAddr(address)) return send(res, 400, { ok: false, error: "valid wallet address required" });
  cache(res, 15, 45);
  try {
    // Fetch more signatures than the trade limit — many txs aren't swaps.
    const sigLimit = Math.min(Math.max(limit * 2, 40), 100);
    const sigs = (await rpc("getSignaturesForAddress", [address, { limit: sigLimit }])) || [];
    // Concurrency-capped fetches (unbounded Promise.all was rate-limited → empty tape).
    const txs = await mapPool(sigs, 8, (s) => rpcTx(s.signature));
    let swaps = txs
      .map((t) => parseSwap(t, address))
      .filter((s) => s && s.solAmount > 0)
      .sort((a, b) => b.time - a.time)
      .slice(0, limit);

    const [meta, sp] = await Promise.all([
      gtMeta(swaps.map((s) => s.mint)),
      solPrice(),
    ]);

    const trades = swaps.map((s) => {
      const md = meta[s.mint] || {};
      return {
        ...s,
        usd: sp ? s.solAmount * sp : null,
        name: md.name || null,
        symbol: md.symbol || null,
        image: md.image || null,
      };
    });

    return send(res, 200, { ok: true, address, solPrice: sp, count: trades.length, trades });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}
