import { callFn, send, cache } from "../_lib.js";
import { computePnl } from "../_pnl.js";

// Phantom-style wallet portfolio: SOL + SPL holdings with live USD values + metadata.
// Sources: rpc-proxy for balances, Jupiter price v3 + DexScreener backfill for prices,
// GeckoTerminal / DexScreener for name/symbol/image. All holdings returned (not just priced).
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const JUP = "https://lite-api.jup.ag";
const GT = "https://api.geckoterminal.com/api/v2";
const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

async function jupPrices(ids) {
  const out = {};
  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const r = await fetch(`${JUP}/price/v3?ids=${chunk.join(",")}`);
        if (r.ok) Object.assign(out, await r.json());
      } catch {}
    }),
  );
  return out;
}

/** DexScreener price + meta backfill for mints Jupiter doesn't price. */
async function dexBackfill(mints) {
  const out = {};
  const chunks = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`);
        if (!r.ok) return;
        const pairs = await r.json();
        for (const p of pairs || []) {
          const mint = p?.baseToken?.address;
          if (!mint || out[mint]) continue;
          out[mint] = {
            usdPrice: Number(p.priceUsd) || 0,
            priceChange24h: p.priceChange?.h24 != null ? Number(p.priceChange.h24) : null,
            name: p.baseToken?.name || null,
            symbol: p.baseToken?.symbol || null,
            image: p.info?.imageUrl || null,
            mcap: Number(p.marketCap || p.fdv) || null,
          };
        }
      } catch {}
    }),
  );
  return out;
}

async function gtMeta(mints) {
  const out = {};
  if (!mints.length) return out;
  const chunks = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));
  // Cap parallel GT calls — 4 at a time keeps us under rate limits while staying fast.
  let idx = 0;
  const workers = Array.from({ length: Math.min(4, chunks.length) }, async () => {
    while (idx < chunks.length) {
      const chunk = chunks[idx++];
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
            mcap: Number(a.market_cap_usd) || Number(a.fdv_usd) || null,
          };
        }
      } catch {}
    }
  });
  await Promise.all(workers);
  return out;
}

function tokenUiAmount(info) {
  if (info?.tokenAmount?.uiAmount != null && Number.isFinite(Number(info.tokenAmount.uiAmount))) {
    return Number(info.tokenAmount.uiAmount);
  }
  const raw = info?.tokenAmount?.amount;
  const decimals = Number(info?.tokenAmount?.decimals || 0);
  if (raw == null) return 0;
  try {
    return Number(raw) / 10 ** decimals;
  } catch {
    return 0;
  }
}

function pctSupply(uiAmount, usdValue, mcap, priceUsd) {
  if (mcap > 0 && usdValue > 0) return (usdValue / mcap) * 100;
  if (mcap > 0 && priceUsd > 0 && uiAmount > 0) return ((uiAmount * priceUsd) / mcap) * 100;
  return null;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const address = (url.searchParams.get("address") || "").trim();
  if (!isAddr(address)) return send(res, 400, { ok: false, error: "valid wallet address required" });
  cache(res, 15, 45);
  try {
    // Holdings + PnL in parallel. PnL uses capped sig history so we stay under
    // the ~30s serverless budget (previously 504'd on large wallets).
    const [lamports, accs1, accs2, pnl] = await Promise.all([
      rpc("getBalance", [address, { commitment: "confirmed" }]).catch(() => null),
      rpc("getTokenAccountsByOwner", [
        address,
        { programId: TOKEN_PROGRAM },
        { encoding: "jsonParsed" },
      ]).catch(() => null),
      rpc("getTokenAccountsByOwner", [
        address,
        { programId: TOKEN_2022 },
        { encoding: "jsonParsed" },
      ]).catch(() => null),
      computePnl(address, { sigLimit: 80 }).catch(() => null),
    ]);
    const sol =
      lamports == null ? 0 : (typeof lamports === "number" ? lamports : lamports.value || 0) / 1e9;
    const raw = [...(accs1?.value || []), ...(accs2?.value || [])];

    const byMint = {};
    for (const a of raw) {
      const info = a?.account?.data?.parsed?.info;
      if (!info) continue;
      if (info.isNative) continue;
      const ui = tokenUiAmount(info);
      if (!(ui > 0)) continue;
      const m = info.mint;
      byMint[m] = byMint[m] || {
        mint: m,
        uiAmount: 0,
        decimals: Number(info.tokenAmount?.decimals || 0),
      };
      byMint[m].uiAmount += ui;
    }
    const mints = Object.keys(byMint);

    const posMints = (pnl?.positions || []).map((p) => p.mint).filter(Boolean);
    const pnlMints = (pnl?.perToken || []).map((p) => p.mint).filter(Boolean);
    const allPriceIds = [...new Set([SOL_MINT, ...mints, ...posMints])];
    const prices = await jupPrices(allPriceIds);
    const solPrice = Number(prices[SOL_MINT]?.usdPrice) || Number(pnl?.solPrice) || 0;

    // Backfill prices for mints Jupiter missed — prioritize largest balances.
    const missing = mints
      .filter((m) => !(Number(prices[m]?.usdPrice) > 0))
      .sort((a, b) => (byMint[b].uiAmount || 0) - (byMint[a].uiAmount || 0))
      .slice(0, 90);
    const dex = missing.length ? await dexBackfill(missing) : {};

    let holdings = mints
      .map((m) => {
        const jupPx = Number(prices[m]?.usdPrice) || 0;
        const dexRow = dex[m];
        const price = jupPx || Number(dexRow?.usdPrice) || 0;
        const change24h = prices[m]?.priceChange24h ?? dexRow?.priceChange24h ?? null;
        const usdValue = price ? byMint[m].uiAmount * price : 0;
        const mcap = dexRow?.mcap ?? null;
        return {
          ...byMint[m],
          priceUsd: price || null,
          usdValue,
          change24h,
          name: dexRow?.name || null,
          symbol: dexRow?.symbol || null,
          image: dexRow?.image || null,
          mcap,
          pctSupply: pctSupply(byMint[m].uiAmount, usdValue, mcap, price),
          unpriced: !(price > 0),
        };
      })
      .sort((a, b) => {
        if ((b.usdValue || 0) !== (a.usdValue || 0)) return (b.usdValue || 0) - (a.usdValue || 0);
        return (b.uiAmount || 0) - (a.uiAmount || 0);
      });

    // Enrich metadata for top holdings + all PnL mints (not every dust mint —
    // fetching hundreds of GT chunks was the main 504 cause).
    const metaTargets = [
      ...new Set([
        ...holdings.slice(0, 80).map((h) => h.mint),
        ...pnlMints,
        ...holdings.filter((h) => h.unpriced && h.uiAmount > 0).slice(0, 40).map((h) => h.mint),
      ]),
    ];
    const meta = await gtMeta(metaTargets);
    holdings = holdings.map((h) => {
      const md = meta[h.mint] || {};
      const mcap = h.mcap ?? md.mcap ?? null;
      const usdValue = h.usdValue || 0;
      return {
        ...h,
        name: h.name || md.name || null,
        symbol: h.symbol || md.symbol || null,
        image: h.image || md.image || null,
        mcap,
        pctSupply: h.pctSupply ?? pctSupply(h.uiAmount, usdValue, mcap, h.priceUsd),
      };
    });

    const holdByMint = {};
    for (const h of holdings) holdByMint[h.mint] = h;

    let trades = [];
    if (pnl && pnl.positions) {
      const enrich = (x) => {
        const h = holdByMint[x.mint];
        const md = meta[x.mint] || {};
        x.symbol = h?.symbol || md.symbol || x.symbol || null;
        x.name = h?.name || md.name || x.name || null;
        x.image = h?.image || md.image || x.image || null;
        x.mcap = h?.mcap ?? md.mcap ?? x.mcap ?? null;
      };
      (pnl.positions || []).forEach(enrich);
      (pnl.perToken || []).forEach(enrich);

      const sp = pnl.solPrice || solPrice;
      const px = (m) => Number(prices[m]?.usdPrice) || Number(dex[m]?.usdPrice) || 0;

      // Refresh open positions with live prices (swap-history remainder).
      for (const p of pnl.positions || []) {
        const cur = px(p.mint);
        if (cur > 0 && p.tokens > 0) {
          p.curPriceUsd = cur;
          p.curValueUsd = p.tokens * cur;
          p.unrealizedUsd = p.curValueUsd - (p.costUsd || 0);
          p.unrealizedPct =
            p.costUsd > 0 ? (p.unrealizedUsd / p.costUsd) * 100 : null;
        }
      }

      for (const t of pnl.perToken || []) {
        const h = holdByMint[t.mint];
        const holdingAmt = h ? h.uiAmount : 0;
        const holdingUsd = h ? h.usdValue || 0 : 0;
        t.holding = holdingAmt > 0;
        t.holdingAmount = holdingAmt || 0;
        t.holdingUsd = holdingAmt > 0 ? holdingUsd : 0;

        // Prefer live chain balance for size / mark.
        if (holdingAmt > 0) {
          t.tokens = holdingAmt;
          t.curValueUsd = holdingUsd || t.curValueUsd;
          if (h?.priceUsd > 0) t.curPriceUsd = h.priceUsd;
        }

        const posTokens =
          holdingAmt > 0 ? holdingAmt : t.open && t.tokens > 0 ? t.tokens : 0;
        const cur = (h?.priceUsd > 0 ? h.priceUsd : null) || t.curPriceUsd || px(t.mint) || 0;

        // Cost basis: rescale avg cost to current size; fall back to boughtUsd
        // when the window shows only buys (still fully held).
        let costUsd = null;
        if (t.avgCostUsd != null && posTokens > 0) {
          costUsd = t.avgCostUsd * posTokens;
        } else if (t.costUsd != null && t.open && posTokens > 0) {
          costUsd = t.costUsd;
        } else if (
          holdingAmt > 0 &&
          (t.sells || 0) === 0 &&
          t.boughtUsd != null &&
          t.boughtUsd > 0
        ) {
          costUsd = t.boughtUsd;
          t.avgCostUsd = holdingAmt > 0 ? costUsd / holdingAmt : t.avgCostUsd;
        }
        if (costUsd != null) {
          t.costUsd = costUsd;
          if (sp > 0) t.costSol = costUsd / sp;
        }

        if (cur > 0 && posTokens > 0) {
          t.curPriceUsd = cur;
          t.curValueUsd = posTokens * cur;
          if (holdingAmt > 0) t.holdingUsd = t.curValueUsd;
          if (t.costUsd != null) {
            t.unrealizedUsd = t.curValueUsd - t.costUsd;
            t.unrealizedPct =
              t.costUsd > 0 ? (t.unrealizedUsd / t.costUsd) * 100 : null;
          }
        }

        // "Pot" = mark-to-market position value (held bag).
        t.potUsd =
          holdingAmt > 0
            ? t.holdingUsd || t.curValueUsd || null
            : t.open
              ? t.curValueUsd ?? null
              : null;

        t.pctSupply =
          h?.pctSupply ??
          pctSupply(
            holdingAmt || posTokens,
            t.holdingUsd || t.curValueUsd || 0,
            t.mcap || h?.mcap,
            t.curPriceUsd || h?.priceUsd,
          );

        const u = t.unrealizedUsd;
        t.totalUsd =
          (t.realizedUsd || 0) + (u != null && Number.isFinite(u) ? u : 0);
      }

      // Aggregates from enriched per-token rows (not stale swap-only positions).
      let unrealUsd = 0;
      let unrealSol = 0;
      for (const t of pnl.perToken || []) {
        if (t.unrealizedUsd == null || !Number.isFinite(t.unrealizedUsd)) continue;
        if (!(t.holding || t.open)) continue;
        unrealUsd += t.unrealizedUsd;
        if (sp > 0 && t.curValueUsd != null) {
          unrealSol += t.curValueUsd / sp - (t.costSol || 0);
        }
      }
      pnl.perToken && pnl.perToken.sort((a, b) => (b.totalUsd || 0) - (a.totalUsd || 0));
      pnl.unrealizedPnlUsd = unrealUsd;
      pnl.unrealizedPnlSol = unrealSol;
      pnl.totalPnlUsd = (pnl.realizedPnlUsd || 0) + unrealUsd;

      // Embed trade tape (enriched) so the UI doesn't need a second /swaps call.
      const spUsd = sp || solPrice;
      trades = (pnl.swaps || []).map((s) => {
        const h = holdByMint[s.mint];
        const md = meta[s.mint] || {};
        return {
          ...s,
          usd: spUsd ? s.solAmount * spUsd : null,
          name: h?.name || md.name || null,
          symbol: h?.symbol || md.symbol || null,
          image: h?.image || md.image || null,
        };
      });
      // Drop raw swaps from pnl payload (already in top-level trades)
      delete pnl.swaps;
    }

    // Append holdings that never appeared in recent swap PnL so the PnL tab
    // can still show currently-held coins with cost/PnL as "—".
    if (pnl) {
      const seen = new Set((pnl.perToken || []).map((t) => t.mint));
      const extras = [];
      for (const h of holdings) {
        if (seen.has(h.mint)) continue;
        if (!(h.usdValue > 0.01) && h.unpriced) continue;
        extras.push({
          mint: h.mint,
          symbol: h.symbol,
          name: h.name,
          image: h.image,
          mcap: h.mcap,
          realizedUsd: 0,
          realizedSol: 0,
          unrealizedUsd: null,
          unrealizedPct: null,
          totalUsd: h.usdValue || 0,
          closedTrades: 0,
          wins: 0,
          losses: 0,
          winRate: null,
          open: false,
          tokens: h.uiAmount,
          holding: true,
          holdingAmount: h.uiAmount,
          holdingUsd: h.usdValue || 0,
          potUsd: h.usdValue || 0,
          pctSupply: h.pctSupply,
          avgCostUsd: null,
          costUsd: null,
          boughtUsd: null,
          boughtSol: null,
          curPriceUsd: h.priceUsd,
          curValueUsd: h.usdValue || 0,
          noTradeHistory: true,
        });
      }
      pnl.perToken = [...(pnl.perToken || []), ...extras];
    }

    const tokenUsd = holdings.reduce((s, h) => s + (h.usdValue || 0), 0);
    const solUsd = sol * solPrice;
    return send(res, 200, {
      ok: true,
      address,
      sol,
      solPrice,
      solUsd,
      totalUsd: tokenUsd + solUsd,
      tokenCount: holdings.length,
      holdings,
      pnl,
      trades,
      tradeCount: trades.length,
    });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}
