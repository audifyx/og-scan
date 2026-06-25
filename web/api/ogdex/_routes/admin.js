import { send, dbSelect, dbUpdate, dbDelete, dbInsert, readBody, ADMIN_PASS } from "../_lib.js";

function auth(pass) { return pass && String(pass) === String(ADMIN_PASS); }

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST") return action(req, res);
  // GET dashboard data
  const pass = url.searchParams.get("pass");
  if (!auth(pass)) return send(res, 401, { ok: false, error: "unauthorized" });
  try {
    const [pending, approved, rejected, events, kols, boosts, launches] = await Promise.all([
      dbSelect("ogdex_listings", "status=eq.pending&order=created_at.desc&limit=200"),
      dbSelect("ogdex_listings", "status=eq.approved&order=approved_at.desc&limit=200"),
      dbSelect("ogdex_listings", "status=eq.rejected&order=updated_at.desc&limit=100"),
      dbSelect("ogdex_events", "order=created_at.desc&limit=5000"),
      dbSelect("ogdex_kol_directory", "select=kol_id,address,name,x_handle,tags,status&order=name.asc&limit=1000").catch(() => []),
      dbSelect("ogdex_boosts", "order=created_at.desc&limit=200").catch(() => []),
      dbSelect("ogdex_launches", "order=created_at.desc&limit=200").catch(() => []),
    ]);
    const now = Date.now();
    const since = (days) => now - days * 864e5;
    const byDay = {}; const byType = {}; const byToken = {};
    let views24 = 0, views7 = 0;
    for (const e of events) {
      const t = new Date(e.created_at).getTime();
      const day = new Date(e.created_at).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.type === "token_view" && e.token_ref) byToken[e.token_ref] = (byToken[e.token_ref] || 0) + 1;
      if (e.type === "page_view" || e.type === "token_view") {
        if (t >= since(1)) views24++;
        if (t >= since(7)) views7++;
      }
    }
    const series = Object.entries(byDay).sort().slice(-30).map(([d, c]) => ({ day: d, count: c }));
    const topTokens = Object.entries(byToken).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([ref, c]) => ({ ref, views: c }));
    const byPath = {};
    for (const e of events) { if (e.path) byPath[e.path] = (byPath[e.path] || 0) + 1; }
    const topPaths = Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, c]) => ({ path, count: c }));
    const all = [...pending, ...approved, ...rejected];
    const byChain = {}; const byTier = {};
    for (const l of all) { byChain[l.chain] = (byChain[l.chain] || 0) + 1; byTier[l.tier] = (byTier[l.tier] || 0) + 1; }
    const featured = approved.filter((l) => l.featured);
    const revenue = approved.reduce((a, l) => a + (l.tier === "express" ? 60 : 40), 0);
    const now2 = Date.now();
    const subs24 = all.filter((l) => new Date(l.created_at).getTime() >= now2 - 864e5).length;
    const now3 = Date.now();
    const activeBoosts = boosts.filter((b) => !b.expires_at || new Date(b.expires_at).getTime() > now3);
    const boostRevenue = boosts.reduce((a, b) => a + (Number(b.usd_paid) || 0), 0);
    return send(res, 200, {
      ok: true,
      stats: {
        totalEvents: events.length, views24, views7,
        pending: pending.length, approved: approved.length, rejected: rejected.length,
        totalListings: all.length, featured: featured.length, revenue, subs24,
        kols: kols.length, activeKols: kols.filter((k) => k.status !== "disputed").length,
        boosts: boosts.length, activeBoosts: activeBoosts.length, boostRevenue,
        launches: launches.length,
        byType, series, topTokens, topPaths, byChain, byTier,
      },
      pending, approved, rejected, kols, boosts, launches,
    });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

async function action(req, res) {
  try {
    const b = await readBody(req);
    if (!auth(b.pass)) return send(res, 401, { ok: false, error: "unauthorized" });
    const id = b.id;
    if (!id && !(["ping", "add_featured", "add_kol", "remove_kol"].includes(b.action))) return send(res, 400, { ok: false, error: "id required" });
    const q = `id=eq.${id}`;
    switch (b.action) {
      case "ping": return send(res, 200, { ok: true });
      case "approve": await dbUpdate("ogdex_listings", q, { status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }); break;
      case "reject": await dbUpdate("ogdex_listings", q, { status: "rejected", updated_at: new Date().toISOString() }); break;
      case "feature": await dbUpdate("ogdex_listings", q, { featured: true, featured_rank: Number(b.featured_rank) || 1, updated_at: new Date().toISOString() }); break;
      case "unfeature": await dbUpdate("ogdex_listings", q, { featured: false, featured_rank: 0, updated_at: new Date().toISOString() }); break;
      case "update": await dbUpdate("ogdex_listings", q, { ...sanitize(b.patch), updated_at: new Date().toISOString() }); break;
      case "delete": await dbDelete("ogdex_listings", q); break;
      case "add_featured": {
        const mint = String(b.mint || "").trim();
        if (!mint) return send(res, 400, { ok: false, error: "mint required" });
        const row = {
          contract_address: mint,
          chain: String(b.chain || "solana"),
          project_name: String(b.project_name || b.name || b.symbol || ""),
          symbol: String(b.symbol || ""),
          logo_url: String(b.logo_url || b.icon || "") || null,
          description: String(b.description || "Admin featured token"),
          status: "approved",
          featured: true,
          featured_rank: Number(b.featured_rank) || 1,
          tier: "standard",
          approved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await dbInsert("ogdex_listings", row);
        break;
      }
      case "add_kol": {
        const address = String(b.address || "").trim();
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return send(res, 400, { ok: false, error: "valid Solana address required" });
        const tw = b.twitter ? String(b.twitter).replace(/^@/, "") : null;
        const row = { name: b.name || address.slice(0, 6), x_handle: tw, x_url: tw ? `https://x.com/${tw}` : null, wallet_address: address, blockchain: "solana", tags: Array.isArray(b.tags) ? b.tags : ["KOL"], status: b.status || "active", is_active: b.status !== "disputed", source: "admin" };
        const ins = await dbInsert("kol_profiles", row); const kol = ins[0] || row;
        if (kol.id) { try { await dbInsert("kol_wallets", { kol_id: kol.id, wallet_address: address, blockchain: "solana", label: "Primary", is_primary: true }); } catch {} }
        return send(res, 200, { ok: true });
      }
      case "remove_kol": {
        if (b.kol_id) { try { await dbDelete("kol_wallets", `kol_id=eq.${b.kol_id}`); } catch {} try { await dbDelete("kol_profiles", `id=eq.${b.kol_id}`); } catch {} }
        if (b.address) { try { await dbDelete("ogdex_kol_directory", `address=eq.${b.address}`); } catch {} }
        return send(res, 200, { ok: true });
      }
      case "delete_boost": await dbDelete("ogdex_boosts", q); return send(res, 200, { ok: true });
      case "delete_launch": await dbDelete("ogdex_launches", q); return send(res, 200, { ok: true });
      default: return send(res, 400, { ok: false, error: "unknown action" });
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 400, { ok: false, error: String(e?.message || e) });
  }
}
function sanitize(p = {}) {
  const allow = ["project_name", "symbol", "logo_url", "banner_url", "description", "links", "tier", "chain", "featured_rank"];
  const out = {}; for (const k of allow) if (k in p) out[k] = p[k]; return out;
}
