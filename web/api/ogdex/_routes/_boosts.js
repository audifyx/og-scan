import { send, cache, dbSelect, dbInsert, dbUpdate, readBody, PAY_WALLET } from "../_lib.js";

// Boost tiers
const TIERS = [
  { id: "6h",  label: "6-Hour Boost",   hours: 6,  usd: 20 },
  { id: "24h", label: "24-Hour Boost",  hours: 24, usd: 60 },
];

export default async function handler(req, res) {
  if (req.method === "POST") return submit(req, res);
  const url = new URL(req.url, "http://x");
  if (url.searchParams.get("tiers")) return send(res, 200, { tiers: TIERS, payWallet: PAY_WALLET });
  return list(res);
}

async function list(res) {
  cache(res, 10, 30);
  try {
    const now = new Date().toISOString();
    const rows = await dbSelect(
      "ogdex_boosts",
      `select=*&status=eq.active&expires_at=gt.${now}&order=featured_rank.asc,created_at.desc&limit=50`
    );
    return send(res, 200, { ok: true, count: rows.length, boosts: rows.map(pub) });
  } catch (e) {
    return send(res, 200, { ok: true, boosts: [], error: String(e?.message || e) });
  }
}

async function submit(req, res) {
  try {
    const b = await readBody(req);
    const mint = String(b.mint || "").trim();
    const tier = TIERS.find((t) => t.id === b.tier);
    if (!mint) return send(res, 400, { ok: false, error: "mint required" });
    if (!tier) return send(res, 400, { ok: false, error: `tier must be one of: ${TIERS.map(t=>t.id).join(", ")}` });
    if (!b.payment_tx) return send(res, 400, { ok: false, error: "payment_tx required" });

    const expiresAt = new Date(Date.now() + tier.hours * 3600 * 1000).toISOString();
    const row = {
      mint,
      tier: tier.id,
      payment_tx: b.payment_tx,
      payer_wallet: b.payer_wallet || null,
      symbol: b.symbol || null,
      name: b.name || null,
      icon: b.icon || null,
      chain: b.chain || "solana",
      status: "pending",      // admin approves → active
      expires_at: expiresAt,
      usd_paid: tier.usd,
      featured_rank: 999,
    };
    const ins = await dbInsert("ogdex_boosts", row);
    return send(res, 200, { ok: true, boost: pub(ins[0] || row) });
  } catch (e) {
    return send(res, 400, { ok: false, error: String(e?.message || e) });
  }
}

function pub(r) {
  return {
    id: r.id, mint: r.mint, symbol: r.symbol, name: r.name, icon: r.icon,
    chain: r.chain, tier: r.tier, status: r.status,
    expires_at: r.expires_at, featured_rank: r.featured_rank,
    usd_paid: r.usd_paid, created_at: r.created_at,
  };
}
