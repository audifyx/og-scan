import { send, dbSelect, cache } from "../_lib.js";
import { enrichTokens } from "../_market.js";

/**
 * GET /api/launches  → tokens launched through OG DEX ("Newly Listed").
 * These are UNVERIFIED and carry no boost. Live price/mcap are enriched
 * on read so the section stays current.
 *
 * Query: ?limit=50
 */
export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  cache(res, 15, 60);
  try {
    const rows = await dbSelect(
      "ogdex_launches",
      `status=eq.listed&order=created_at.desc&limit=${limit}`
    );
    let live = {};
    try { live = await enrichTokens(rows.map((r) => r.mint)); } catch {}
    // explorer bases for chain-aware feed links (kept minimal + inline)
    const EXPLORER = {
      solana: "https://solscan.io", robinhood: "https://robinhoodchain.blockscout.com",
      bsc: "https://bscscan.com", base: "https://basescan.org", ethereum: "https://etherscan.io",
      arbitrum: "https://arbiscan.io", polygon: "https://polygonscan.com", avalanche: "https://snowscan.xyz",
      optimism: "https://optimistic.etherscan.io", blast: "https://blastscan.io", sonic: "https://sonicscan.org",
      berachain: "https://berascan.com", linea: "https://lineascan.build", scroll: "https://scrollscan.com",
      zksync: "https://era.zksync.network", mantle: "https://mantlescan.xyz", celo: "https://celoscan.io",
    };
    const out = rows.map((r) => {
      const m = live[r.mint] || {};
      const chain = (r.links && r.links.chain) || "solana";
      const launchpad = (r.links && r.links.launchpad) || (chain === "solana" ? "pumpfun" : null);
      const isEvm = chain !== "solana";
      const explorer = EXPLORER[chain] || EXPLORER.solana;
      const links = isEvm
        ? { explorer: `${explorer}/token/${r.mint}`, ogdex: `/token/${r.mint}?chain=${chain}` }
        : { pumpfun: `https://pump.fun/${r.mint}`, solscan: `https://solscan.io/token/${r.mint}`, ogdex: `/token/${r.mint}` };
      return {
        mint: r.mint,
        symbol: r.symbol || m.symbol || null,
        name: r.name || m.name || null,
        icon: r.icon || m.image || null,
        description: r.description || null,
        creator_wallet: r.creator_wallet || null,
        created_at: r.created_at,
        launch_tx: r.launch_tx || null,
        chain,
        launchpad,
        priceUsd: m.price ?? null,
        mcap: m.mcap ?? null,
        volume24h: m.volume24h ?? null,
        liquidity: m.liquidity ?? null,
        verified: false,
        boosted: false,
        source: "ogdex-launch",
        links,
      };
    });
    return send(res, 200, { ok: true, count: out.length, rows: out });
  } catch (e) {
    return send(res, 200, { ok: true, rows: [], error: String(e?.message || e) });
  }
}
