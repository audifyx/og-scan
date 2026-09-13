import { callFn, send } from "../_lib.js";
import { normToken, num } from "../_normalize.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return send(res, 200, { rows: [] });

  // ── EVM address lookup (0x…) ──────────────────────────────────────────────
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
    try {
      const d = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${q}`, {
        headers: { Accept: "application/json" },
      }).then(r => r.ok ? r.json() : null).catch(() => null);
      const pairs = (d?.pairs || []).filter(p =>
        p.baseToken?.address?.toLowerCase() === q.toLowerCase()
      );
      // Collapse to unique tokens (one result per baseToken address)
      const tokenMap = {};
      for (const p of pairs) {
        const addr = p.baseToken?.address || q;
        if (!tokenMap[addr] || (num(p.liquidity?.usd) || 0) > (num(tokenMap[addr].liquidity?.usd) || 0)) {
          tokenMap[addr] = p;
        }
      }
      const rows = Object.values(tokenMap)
        .sort((a, b) => (num(b.liquidity?.usd) || 0) - (num(a.liquidity?.usd) || 0))
        .slice(0, 10)
        .map(p => ({
          mint:       p.baseToken?.address || q,
          name:       p.baseToken?.name    || null,
          symbol:     p.baseToken?.symbol  || null,
          icon:       p.info?.imageUrl     || p.info?.header || null,
          priceUsd:   num(p.priceUsd),
          mcap:       num(p.marketCap),
          liquidity:  num(p.liquidity?.usd),
          volume:     num(p.volume?.h24),
          change24h:  num(p.priceChange?.h24),
          chain:      p.chainId || "ethereum",
          holderCount: null, isVerified: false,
          audit: {}, stats: { "5m": {}, "1h": {}, "6h": {}, "24h": {} },
        }));
      return send(res, 200, { rows });
    } catch (e) {
      return send(res, 200, { rows: [], error: String(e?.message || e) });
    }
  }

  // ── Solana / Jupiter search ───────────────────────────────────────────────
  try {
    const d = await callFn("jupiter-tokens", { query: q.trim() });
    const list = Array.isArray(d.tokens) ? d.tokens : (d.tokens?.tokens || []);
    const rows = list.map((t) => normToken(t, "24h")).filter(Boolean).slice(0, 20);
    return send(res, 200, { rows });
  } catch (e) {
    return send(res, 200, { rows: [], error: String(e?.message || e) });
  }
}
