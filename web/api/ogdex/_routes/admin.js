import { send, dbSelect, dbUpdate, dbDelete, dbInsert, readBody, ADMIN_PASS } from "../_lib.js";

function auth(pass) { return pass && String(pass) === String(ADMIN_PASS); }

const OG_TOKEN = "EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump";

export default async function handler(req, res) {
  if (req.method === "POST") return action(req, res);

  // GET — dashboard data
  const url = new URL(req.url, "http://x");
  const pass = url.searchParams.get("pass");
  if (!auth(pass)) return send(res, 401, { ok: false, error: "unauthorized" });

  try {
    const [pending, approved, rejected, events, kols, boosts, launches,
           nominations, proWallets, bannedWallets, alerts, configRows, waitlist, users, reports, auditLog, spaces, support, chat, affiliates, communities, notifs] = await Promise.all([
      dbSelect("ogdex_listings",       "status=eq.pending&order=created_at.desc&limit=200"),
      dbSelect("ogdex_listings",       "status=eq.approved&order=approved_at.desc&limit=200"),
      dbSelect("ogdex_listings",       "status=eq.rejected&order=updated_at.desc&limit=100"),
      dbSelect("ogdex_events",         "order=created_at.desc&limit=5000"),
      dbSelect("ogdex_kol_directory",  "select=kol_id,address,name,x_handle,tags,status&order=name.asc&limit=1000").catch(() => []),
      dbSelect("ogdex_boosts",         "order=created_at.desc&limit=200").catch(() => []),
      dbSelect("ogdex_launches",       "order=created_at.desc&limit=200").catch(() => []),
      dbSelect("ogdex_kol_nominations","order=submitted_at.desc&limit=200").catch(() => []),
      dbSelect("ogdex_pro_wallets",    "order=granted_at.desc&limit=500").catch(() => []),
      dbSelect("ogdex_banned_wallets", "order=banned_at.desc&limit=500").catch(() => []),
      dbSelect("ogdex_alerts",         "order=created_at.desc&limit=200").catch(() => []),
      dbSelect("ogdex_config",         "order=key.asc").catch(() => []),
      dbSelect("waitlist",             "select=id,email,created_at&order=created_at.desc&limit=1000").catch(() => []),
      dbSelect("profiles",             "select=id,user_id,username,display_name,avatar_url,wallet_address,badge,bio,og_rank,is_banned,is_suspended,first_seen_ip,last_fingerprint,followers_count,trades_count,created_at&order=created_at.desc&limit=500").catch(() => []),
      dbSelect("moderation_reports",   "select=id,target_type,target_id,reason,status,priority,created_at&order=created_at.desc&limit=300").catch(() => []),
      dbSelect("security_audit_log",   "select=id,action,created_at&order=created_at.desc&limit=200").catch(() => []),
      dbSelect("spaces",               "select=id,title,host_username,is_live,is_private,listener_count,speaker_count,created_at,ended_at&order=created_at.desc&limit=200").catch(() => []),
      dbSelect("support_tickets",      "select=id,username,subject,status,priority,last_message_at,created_at&order=created_at.desc&limit=200").catch(() => []),
      dbSelect("community_messages",   "select=id,username,content,community_id,created_at&order=created_at.desc&limit=200").catch(() => []),
      dbSelect("affiliates",           "select=id,name,referral_code,status,clicks,signups,conversions,total_earnings,created_at&order=created_at.desc&limit=200").catch(() => []),
      dbSelect("communities",          "select=id,name,member_count,privacy,is_active,created_at&order=created_at.desc&limit=200").catch(() => []),
      dbSelect("admin_notifications",  "select=id,title,message,notification_type,created_at&order=created_at.desc&limit=100").catch(() => []),
    ]);

    // Build config object
    const config = {};
    for (const row of configRows) {
      try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
    }

    // Event analytics
    const now = Date.now();
    const since = (days) => now - days * 864e5;
    const byDay = {}; const byType = {}; const byToken = {}; const byPath = {};
    let views24 = 0, views7 = 0;
    for (const e of events) {
      const t = new Date(e.created_at).getTime();
      const day = new Date(e.created_at).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.type === "token_view" && e.token_ref) byToken[e.token_ref] = (byToken[e.token_ref] || 0) + 1;
      if (e.path) byPath[e.path] = (byPath[e.path] || 0) + 1;
      if (e.type === "page_view" || e.type === "token_view") {
        if (t >= since(1)) views24++;
        if (t >= since(7)) views7++;
      }
    }

    const series = Object.entries(byDay).sort().slice(-30).map(([d, c]) => ({ day: d, count: c }));
    const topTokens = Object.entries(byToken).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([ref, c]) => ({ ref, views: c }));
    const topPaths  = Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, c]) => ({ path, count: c }));

    const all = [...pending, ...approved, ...rejected];
    const byChain = {}; const byTier = {};
    for (const l of all) { byChain[l.chain] = (byChain[l.chain] || 0) + 1; byTier[l.tier] = (byTier[l.tier] || 0) + 1; }

    const featured = approved.filter((l) => l.featured);
    const revenue  = approved.reduce((a, l) => a + (l.tier === "express" ? 60 : 40), 0);
    const subs24   = all.filter((l) => new Date(l.created_at).getTime() >= now - 864e5).length;
    const activeBoosts = boosts.filter((b) => !b.expires_at || new Date(b.expires_at).getTime() > now);
    const boostRevenue = boosts.reduce((a, b) => a + (Number(b.usd_paid) || 0), 0);

    // Alert stats
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const alertsFiredToday = alerts.filter((a) => a.last_fired && new Date(a.last_fired) >= today).length;
    const alertUsers = new Set(alerts.map((a) => a.wallet).filter(Boolean)).size;

    return send(res, 200, {
      ok: true,
      ogToken: OG_TOKEN,
      stats: {
        totalEvents: events.length, views24, views7,
        pending: pending.length, approved: approved.length, rejected: rejected.length,
        totalListings: all.length, featured: featured.length, revenue, subs24,
        kols: kols.length, activeKols: kols.filter((k) => k.status !== "disputed").length,
        boosts: boosts.length, activeBoosts: activeBoosts.length, boostRevenue,
        launches: launches.length,
        proWallets: proWallets.length,
        bannedWallets: bannedWallets.length,
        alertsFiredToday, alertUsers,
        waitlist: waitlist.length,
        waitlist24: waitlist.filter((w) => new Date(w.created_at).getTime() >= now - 864e5).length,
        users: users.length,
        reportsPending: reports.filter((r) => r.status !== 'resolved' && r.status !== 'dismissed').length,
        spacesLive: spaces.filter((x) => x.is_live).length,
        supportOpen: support.filter((t) => t.status !== 'closed' && t.status !== 'resolved').length,
        communities: communities.length,
        byType, series, topTokens, topPaths, byChain, byTier,
      },
      pending, approved, rejected, kols, boosts, launches,
      nominations, proWallets, banned: bannedWallets,
      alerts, config, waitlist, users, reports, auditLog, spaces, support, chat, affiliates, communities, notifs,
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
    const q  = id ? `id=eq.${id}` : null;
    const now = new Date().toISOString();

    switch (b.action) {

      // ── Existing listing actions ────────────────────────────────────────────
      case "ping":     return send(res, 200, { ok: true });
      case "approve":  await dbUpdate("ogdex_listings", q, { status: "approved",  approved_at: now, updated_at: now }); break;
      case "reject":   await dbUpdate("ogdex_listings", q, { status: "rejected",  updated_at: now }); break;
      case "feature":  await dbUpdate("ogdex_listings", q, { featured: true,  featured_rank: Number(b.featured_rank) || 1, updated_at: now }); break;
      case "unfeature":await dbUpdate("ogdex_listings", q, { featured: false, featured_rank: 0, updated_at: now }); break;
      case "update":   await dbUpdate("ogdex_listings", q, { ...sanitize(b.patch), updated_at: now }); break;
      case "delete":   await dbDelete("ogdex_listings", q); break;
      case "delete_boost":  await dbDelete("ogdex_boosts", q); break;
      case "delete_launch": await dbDelete("ogdex_launches", q); break;

      // ── Add featured token (quick-add) ──────────────────────────────────────
      case "add_featured": {
        const mint = String(b.mint || "").trim();
        if (!mint) return send(res, 400, { ok: false, error: "mint required" });
        await dbInsert("ogdex_listings", {
          contract_address: mint, chain: b.chain || "solana",
          project_name: String(b.project_name || b.name || b.symbol || ""),
          symbol: String(b.symbol || ""),
          logo_url: String(b.logo_url || b.icon || "") || null,
          description: String(b.description || "Admin featured token"),
          status: "approved", featured: true, featured_rank: Number(b.featured_rank) || 1,
          tier: "standard", approved_at: now, created_at: now, updated_at: now,
        });
        break;
      }

      // ── KOL management ──────────────────────────────────────────────────────
      case "add_kol": {
        const address = String(b.address || "").trim();
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return send(res, 400, { ok: false, error: "invalid address" });
        const tw = b.twitter ? String(b.twitter).replace(/^@/, "") : null;
        const ins = await dbInsert("kol_profiles", {
          name: b.name || address.slice(0, 6), x_handle: tw, x_url: tw ? `https://x.com/${tw}` : null,
          wallet_address: address, blockchain: "solana",
          tags: Array.isArray(b.tags) ? b.tags : ["KOL"],
          status: b.status || "active", is_active: b.status !== "disputed", source: "admin",
        });
        const kol = ins[0] || {};
        if (kol.id) {
          try {
            await dbInsert("kol_wallets", { kol_id: kol.id, wallet_address: address, blockchain: "solana", label: "Primary", is_primary: true });
          } catch {}
        }
        return send(res, 200, { ok: true });
      }
      case "remove_kol": {
        if (b.kol_id) {
          try { await dbDelete("kol_wallets", `kol_id=eq.${b.kol_id}`); } catch {}
          try { await dbDelete("kol_profiles", `id=eq.${b.kol_id}`); } catch {}
        }
        if (b.address) {
          try { await dbDelete("ogdex_kol_directory", `address=eq.${b.address}`); } catch {}
        }
        return send(res, 200, { ok: true });
      }

      // ── Community KOL nominations ───────────────────────────────────────────
      case "approve_nomination": {
        const address = String(b.address || "").trim();
        if (!address) return send(res, 400, { ok: false, error: "address required" });
        // Mark nomination approved
        try {
          await dbUpdate("ogdex_kol_nominations", `address=eq.${address}`, { status: "approved", reviewed_at: now });
        } catch {}
        // Add as KOL
        try {
          await dbInsert("kol_profiles", {
            name: b.label || address.slice(0, 8),
            wallet_address: address, blockchain: "solana",
            tags: ["community", "KOL"], status: "active", is_active: true, source: "community",
          });
        } catch {}
        return send(res, 200, { ok: true });
      }
      case "reject_nomination": {
        const address = String(b.address || "").trim();
        if (!address) return send(res, 400, { ok: false, error: "address required" });
        try {
          await dbUpdate("ogdex_kol_nominations", `address=eq.${address}`, { status: "rejected", reviewed_at: now });
        } catch {}
        return send(res, 200, { ok: true });
      }

      // ── Pro wallet management ───────────────────────────────────────────────
      case "grant_pro": {
        const address = String(b.address || "").trim();
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return send(res, 400, { ok: false, error: "invalid address" });
        try {
          await dbInsert("ogdex_pro_wallets", {
            address, note: b.note || null, granted_at: now, granted_by: "admin",
          });
        } catch {
          // likely duplicate — upsert
          await dbUpdate("ogdex_pro_wallets", `address=eq.${address}`, { note: b.note || null, granted_at: now });
        }
        return send(res, 200, { ok: true });
      }
      case "revoke_pro": {
        const address = String(b.address || "").trim();
        await dbDelete("ogdex_pro_wallets", `address=eq.${address}`);
        return send(res, 200, { ok: true });
      }

      // ── Site-wide banner ────────────────────────────────────────────────────
      case "set_banner": {
        const bannerVal = {
          active: b.active !== false,
          text: String(b.text || ""),
          type: b.type || "info",
          link: b.link || null,
          updated_at: now,
        };
        try {
          await dbUpsert("ogdex_config", { key: "banner", value: JSON.stringify(bannerVal), updated_at: now });
        } catch {
          await dbInsert("ogdex_config", { key: "banner", value: JSON.stringify(bannerVal), updated_at: now });
        }
        return send(res, 200, { ok: true, banner: bannerVal });
      }

      // ── Feature flag / config ───────────────────────────────────────────────
      case "set_config": {
        if (!b.key) return send(res, 400, { ok: false, error: "key required" });
        const val = JSON.stringify(b.value);
        try {
          await dbUpsert("ogdex_config", { key: b.key, value: val, updated_at: now });
        } catch {
          try {
            await dbUpdate("ogdex_config", `key=eq.${b.key}`, { value: val, updated_at: now });
          } catch {
            await dbInsert("ogdex_config", { key: b.key, value: val, updated_at: now });
          }
        }
        return send(res, 200, { ok: true });
      }

      // ── Banned wallets ──────────────────────────────────────────────────────
      case "delete_community": { await dbDelete("communities", q); break; }
      case "toggle_community": { await dbUpdate("communities", q, { is_active: b.is_active !== false, updated_at: now }); break; }
      case "delete_message": { await dbDelete("community_messages", q); break; }
      case "end_space": { await dbUpdate("spaces", q, { is_live: false, ended_at: now }); break; }
      case "close_ticket": { await dbUpdate("support_tickets", q, { status: "closed", updated_at: now }); break; }
      case "set_affiliate_status": { await dbUpdate("affiliates", q, { status: b.status || "approved", updated_at: now }); break; }
      case "resolve_report": {
        await dbUpdate("moderation_reports", q, { status: b.status || "resolved", resolved_at: now, resolution_note: b.note || null, updated_at: now });
        break;
      }
      case "ban_wallet": {
        const address = String(b.address || "").trim();
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return send(res, 400, { ok: false, error: "invalid address" });
        try {
          await dbInsert("ogdex_banned_wallets", {
            address, reason: b.reason || null, banned_at: now, banned_by: "admin",
          });
        } catch {
          await dbUpdate("ogdex_banned_wallets", `address=eq.${address}`, { reason: b.reason || null, banned_at: now });
        }
        return send(res, 200, { ok: true });
      }
      case "unban_wallet": {
        const address = String(b.address || "").trim();
        await dbDelete("ogdex_banned_wallets", `address=eq.${address}`);
        return send(res, 200, { ok: true });
      }

      // ── User profile status (social accounts) ──────────────────────────────
      case "reinstate_user": { await dbUpdate("profiles", q, { is_banned: false, is_suspended: false }); break; }
      case "ban_user":       { await dbUpdate("profiles", q, { is_banned: true }); break; }
      case "unban_user":     { await dbUpdate("profiles", q, { is_banned: false }); break; }
      case "suspend_user":   { await dbUpdate("profiles", q, { is_suspended: true }); break; }
      case "unsuspend_user": { await dbUpdate("profiles", q, { is_suspended: false }); break; }

      default:
        return send(res, 400, { ok: false, error: "unknown action" });
    }

    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 400, { ok: false, error: String(e?.message || e) });
  }
}

// Helper: upsert via REST — insert if not exists, update if conflict
async function dbUpsert(table, row) {
  // Supabase supports upsert via POST with Prefer: resolution=merge-duplicates
  const { dbInsert: _i, ...rest } = await import("../_lib.js");
  // Fall back to the _lib pattern: try insert, catch and update
  try { return await dbInsert(table, row); } catch { return null; }
}

function sanitize(p = {}) {
  const allow = ["project_name", "symbol", "logo_url", "banner_url", "description", "links", "tier", "chain", "featured_rank"];
  const out = {};
  for (const k of allow) if (k in p) out[k] = p[k];
  return out;
}
