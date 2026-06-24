import { send, dbSelect, dbInsert, callFn, readBody, cache } from "../_lib.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST") return submit(req, res);
  // GET approved listings
  try {
    cache(res, 20, 60);
    const featuredOnly = url.searchParams.get("featured") === "1";
    let q = "status=eq.approved&order=featured.desc,featured_rank.desc,approved_at.desc&limit=200";
    if (featuredOnly) q = "status=eq.approved&featured=eq.true&order=featured_rank.desc&limit=20";
    const rows = await dbSelect("ogdex_listings", q);
    return send(res, 200, { rows: rows.map(pub) });
  } catch (e) {
    return send(res, 200, { rows: [], error: String(e?.message || e) });
  }
}

async function submit(req, res) {
  try {
    const b = await readBody(req);
    const ca = String(b.contract_address || "").trim();
    if (!ca) return send(res, 400, { ok: false, error: "contract_address required" });
    const tier = b.tier === "express" ? "express" : "standard";
    const chain = String(b.chain || "solana").toLowerCase();
    let symbol = b.symbol || null, project_name = b.project_name || null, logo_url = b.logo_url || null, metadata = {};
    // Auto-scan metadata for Solana mints via the OG Scan backend.
    if (chain === "solana") {
      try {
        const scan = await callFn("og-scan-token", { query: ca });
        if (scan?.ok && scan.token) {
          const t = scan.token;
          symbol = symbol || t.symbol; project_name = project_name || t.name;
          logo_url = logo_url || t.icon || t.image;
          metadata = { score: scan.score?.total ?? null, verdict: scan.verdict ?? null, priceUsd: t.priceUsd ?? null, mcap: t.mcap ?? null, liquidity: t.liquidity ?? null, holderCount: t.holderCount ?? null, banner: t.banner ?? null };
        }
      } catch {}
    }
    const row = {
      contract_address: ca, chain, tier, status: "pending",
      project_name, symbol, logo_url,
      banner_url: b.banner_url || metadata.banner || null,
      description: b.description || null,
      links: b.links || {}, contact: b.contact || null,
      payment_tx: b.payment_tx || null, metadata,
    };
    const ins = await dbInsert("ogdex_listings", row);
    return send(res, 200, { ok: true, listing: pub(ins[0] || row) });
  } catch (e) {
    return send(res, 400, { ok: false, error: String(e?.message || e) });
  }
}

function pub(r) {
  return {
    id: r.id, contract_address: r.contract_address, chain: r.chain,
    project_name: r.project_name, symbol: r.symbol, logo_url: r.logo_url,
    banner_url: r.banner_url, description: r.description, links: r.links,
    tier: r.tier, status: r.status, featured: r.featured, featured_rank: r.featured_rank,
    metadata: r.metadata, views: r.views, created_at: r.created_at, approved_at: r.approved_at,
  };
}
