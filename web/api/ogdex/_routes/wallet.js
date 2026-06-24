import { callFn, send, cache } from "../_lib.js";
import { computePnl } from "../_pnl.js";

// Phantom-style wallet portfolio: SOL + SPL holdings with live USD values + metadata.
// Sources: rpc-proxy (Alchemy) for balances, Jupiter price v3 for prices,
// GeckoTerminal multi for name/symbol/image/mcap. All via existing keys, no new secrets.
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const JUP = "https://lite-api.jup.ag";
const GT = "https://api.geckoterminal.com/api/v2";
const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  // rpc-proxy wraps: { success, data: { result }, provider }
  return r?.data?.result ?? r?.result ?? null;
}

async function jupPrices(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const r = await fetch(`${JUP}/price/v3?ids=${chunk.join(",")}`);
      if (r.ok) Object.assign(out, await r.json());
    } catch {}
  }
  return out;
}

async function gtMeta(mints) {
  const out = {};
  for (let i = 0; i < mints.length; i += 30) {
    const chunk = mints.slice(i, i + 30);
    try {
      const r = await fetch(`${GT}/networks/solana/tokens/multi/${chunk.join(",")}`, { headers: { Accept: "application/json;version=20230302" } });
      if (!r.ok) continue;
      const d = await r.json();
      for (const t of d?.data || []) {
        const a = t.attributes || {};
        out[a.address] = { name: a.name, symbol: a.symbol, image: a.image_url && a.image_url !== "missing.png" ? a.image_url : null, mcap: Number(a.market_cap_usd) || Number(a.fdv_usd) || null };
      }
    } catch {}
  }
  return out;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const address = (url.searchParams.get("address") || "").trim();
  if (!isAddr(address)) return send(res, 400, { ok: false, error: "valid wallet address required" });
  cache(res, 15, 45);
  try {
    const [lamports, accs1, accs2, pnl] = await Promise.all([
      rpc("getBalance", [address, { commitment: "confirmed" }]).catch(() => null),
      rpc("getTokenAccountsByOwner", [address, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }]).catch(() => null),
      rpc("getTokenAccountsByOwner", [address, { programId: TOKEN_2022 }, { encoding: "jsonParsed" }]).catch(() => null),
      computePnl(address).catch(() => null),
    ]);
    const sol = lamports == null ? 0 : (typeof lamports === "number" ? lamports : lamports.value || 0) / 1e9;
    const raw = [...((accs1?.value) || []), ...((accs2?.value) || [])];

    // aggregate by mint (a wallet can have multiple accounts per mint)
    const byMint = {};
    for (const a of raw) {
      const info = a?.account?.data?.parsed?.info; if (!info) continue;
      const ui = Number(info.tokenAmount?.uiAmount || 0);
      if (ui <= 0) continue;
      const m = info.mint;
      byMint[m] = byMint[m] || { mint: m, uiAmount: 0, decimals: Number(info.tokenAmount?.decimals || 0) };
      byMint[m].uiAmount += ui;
    }
    const mints = Object.keys(byMint);

    // prices (incl SOL + any open-position mints from swap history)
    const posMints = (pnl?.positions || []).map((p) => p.mint);
    const prices = await jupPrices([...new Set([SOL_MINT, ...mints, ...posMints])]);
    const solPrice = Number(prices[SOL_MINT]?.usdPrice) || 0;

    let holdings = mints.map((m) => {
      const price = Number(prices[m]?.usdPrice) || 0;
      return { ...byMint[m], priceUsd: price || null, usdValue: price ? byMint[m].uiAmount * price : 0, change24h: prices[m]?.priceChange24h ?? null };
    }).sort((a, b) => b.usdValue - a.usdValue);

    // enrich metadata for the top holdings (cap to keep it fast)
    const top = holdings.slice(0, 60);
    const meta = await gtMeta(top.map((h) => h.mint));
    holdings = holdings.map((h) => {
      const md = meta[h.mint] || {};
      return {
        ...h,
        name: md.name || null,
        symbol: md.symbol || null,
        image: md.image || null,
        mcap: md.mcap ?? null,
      };
    });

    // Value open positions (unrealized) against live prices.
    if (pnl && pnl.positions) {
      const metaByMint = {};
      for (const h of holdings) metaByMint[h.mint] = { symbol: h.symbol, name: h.name, image: h.image };
      const enrich = (x) => { const m = metaByMint[x.mint]; if (m) { x.symbol = m.symbol; x.name = m.name; x.image = m.image; } };
      (pnl.positions || []).forEach(enrich);
      (pnl.perToken || []).forEach(enrich);
      let unrealUsd = 0, unrealSol = 0;
      const sp = pnl.solPrice || solPrice;
      const px = (m) => Number(prices[m]?.usdPrice) || 0;
      for (const p of pnl.positions) {
        const cur = px(p.mint);
        if (cur > 0) {
          p.curPriceUsd = cur;
          p.curValueUsd = p.tokens * cur;
          p.unrealizedUsd = p.curValueUsd - (p.costUsd || 0);
          unrealUsd += p.unrealizedUsd;
          if (sp > 0) unrealSol += p.curValueUsd / sp - (p.costSol || 0);
        }
      }
      for (const t of (pnl.perToken || [])) {
        if (!t.open) continue;
        const cur = px(t.mint);
        if (cur > 0) {
          t.curPriceUsd = cur;
          t.curValueUsd = t.tokens * cur;
          t.unrealizedUsd = t.curValueUsd - ((t.avgCostUsd || 0) * t.tokens);
          t.totalUsd = (t.realizedUsd || 0) + (t.unrealizedUsd || 0);
        }
      }
      pnl.perToken && pnl.perToken.sort((a, b) => (b.totalUsd || 0) - (a.totalUsd || 0));
      pnl.unrealizedPnlUsd = unrealUsd;
      pnl.unrealizedPnlSol = unrealSol;
      pnl.totalPnlUsd = (pnl.realizedPnlUsd || 0) + unrealUsd;
    }

    const tokenUsd = holdings.reduce((s, h) => s + (h.usdValue || 0), 0);
    const solUsd = sol * solPrice;
    return send(res, 200, {
      ok: true,
      address,
      sol, solPrice, solUsd,
      totalUsd: tokenUsd + solUsd,
      tokenCount: holdings.length,
      holdings,
      pnl,
    });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}
