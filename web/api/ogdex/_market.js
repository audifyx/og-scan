// Token metadata + price enrichment via GeckoTerminal (meta+mcap) and Jupiter (price fallback).
const GT = "https://api.geckoterminal.com/api/v2";
const JUP = "https://lite-api.jup.ag";

export async function enrichTokens(mints) {
  const out = {};
  const uniq = [...new Set(mints.filter(Boolean))];
  if (!uniq.length) return out;
  // GeckoTerminal multi (30/chunk)
  for (let i = 0; i < uniq.length; i += 30) {
    const chunk = uniq.slice(i, i + 30);
    try {
      const r = await fetch(`${GT}/networks/solana/tokens/multi/${chunk.join(",")}`, { headers: { Accept: "application/json;version=20230302" } });
      if (r.ok) { const d = await r.json(); for (const t of d?.data || []) { const a = t.attributes || {}; out[a.address] = { symbol: a.symbol, name: a.name, image: a.image_url && a.image_url !== "missing.png" ? a.image_url : null, price: Number(a.price_usd) || null, mcap: Number(a.market_cap_usd) || Number(a.fdv_usd) || null }; } }
    } catch {}
  }
  // Jupiter price fallback for any missing price
  const missing = uniq.filter((m) => !out[m] || out[m].price == null);
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    try {
      const r = await fetch(`${JUP}/price/v3?ids=${chunk.join(",")}`);
      if (r.ok) { const d = await r.json(); for (const [m, v] of Object.entries(d)) { out[m] = out[m] || {}; out[m].price = out[m].price ?? (Number(v.usdPrice) || null); } }
    } catch {}
  }
  return out;
}
