/**
 * Sniper Radar + Holder Map data providers.
 */

export async function getSniperRadar(sbQuery, limit = 20) {
  const tokens = await sbQuery(
    "launchpad_tokens", "GET", null,
    `?select=mint,symbol,created_at,sniper_tax_bps,sniper_window_seconds&created_at=gte.${new Date(Date.now() - 24 * 3600 * 1000).toISOString()}&order=created_at.desc&limit=50`
  );

  const events = [];

  for (const t of (tokens || []).slice(0, 10)) {
    try {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${t.mint}`, {
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      if (!res || !res.ok) continue;

      const data = await res.json().catch(() => null);
      if (!data?.[0]?.txns) continue;

      const buys = data[0].txns?.h24?.buys || 0;
      if (buys > 0) {
        events.push({
          mint: t.mint,
          symbol: t.symbol,
          tax_bps: t.sniper_tax_bps || 2500,
          buys_24h: buys,
          timestamp: t.created_at,
        });
      }
    } catch {}
    if (events.length >= limit) break;
  }

  return events;
}

export async function getHolderMap(mint) {
  // Try multiple RPC endpoints
  const rpcs = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
    "https://rpc.ankr.com/solana",
  ];

  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenLargestAccounts",
          params: [mint],
        }),
        signal: AbortSignal.timeout(12000),
      }).catch(() => null);

      if (!res || !res.ok) continue;
      const data = await res.json().catch(() => null);
      const accounts = data?.result?.value || [];
      if (!accounts.length) continue;

      const total = accounts.reduce((sum, a) => sum + Number(a.amount), 0);

      const holders = accounts.slice(0, 20).map((a, i) => ({
        address: a.address,
        pct: total > 0 ? (Number(a.amount) / total) * 100 : 0,
        is_creator: i === 0,
      }));

      return { holders, total_holders: accounts.length, source: rpc };
    } catch {}
  }

  // Fallback: try DexScreener for basic info
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, {
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json().catch(() => null);
      if (data?.[0]) {
        return {
          holders: [],
          total_holders: 0,
          note: "Holder data unavailable — token may be too new or RPC is rate-limited.",
          dexscreener: data[0].url,
        };
      }
    }
  } catch {}

  return null;
}
