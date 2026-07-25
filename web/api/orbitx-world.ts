/**
 * OrbitX World API router — backend only.
 *
 * Routes (mounted at /api/orbitx-world?path=... via vercel rewrite, or
 * /api/orbitx-world/<segment> when using filesystem routing):
 *
 *  GET  /health
 *  POST /bootstrap          — oxw_ensure_player
 *  GET  /me/progression
 *  GET  /me/inventory
 *  GET  /me/settings
 *  PATCH /me/settings
 *  GET  /me/notifications
 *  POST /me/notifications/read
 *  GET  /lobbies
 *  POST /lobbies
 *  POST /presence
 *  GET  /quests
 *  GET  /me/quests
 *  POST /trades/record
 *  GET  /trades/history
 *  GET  /token-intel/:mint
 *  POST /token-intel/:mint  (service) upsert cache
 *  GET  /achievements
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  adminClient,
  clientIp,
  handleOptions,
  json,
  memoryRateLimit,
  requireUser,
} from "./orbitx/world/_lib";

function pathParts(req: VercelRequest): string[] {
  const q = req.query.path;
  if (typeof q === "string" && q.length) return q.split("/").filter(Boolean);
  if (Array.isArray(q)) return q.join("/").split("/").filter(Boolean);
  const url = req.url || "";
  const after = url.split("orbitx-world")[1] || "";
  return after.replace(/^\//, "").split("?")[0]!.split("/").filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const parts = pathParts(req);
  const route = parts.join("/") || "health";
  const ip = clientIp(req);
  const rl = memoryRateLimit(`oxw:${ip}:${route}`, 120, 60_000);
  if (rl.limited) {
    return json(res, { error: "rate_limited", retryAfter: rl.retryAfter }, 429);
  }

  try {
    // ---- health ----
    if (route === "health" && req.method === "GET") {
      return json(res, {
        ok: true,
        service: "orbitx-world",
        ts: new Date().toISOString(),
        modules: [
          "progression",
          "inventory",
          "lobbies",
          "presence",
          "trades",
          "quests",
          "notifications",
          "token-intel",
        ],
      });
    }

    // ---- bootstrap ----
    if (route === "bootstrap" && req.method === "POST") {
      const { id, client } = await requireUser(req);
      const { error } = await client.rpc("oxw_ensure_player", { p_user_id: id });
      if (error) return json(res, { error: error.message }, 400);
      const [prog, inv, settings] = await Promise.all([
        client.from("oxw_progression").select("*").eq("user_id", id).maybeSingle(),
        client.from("oxw_inventory").select("*, item:oxw_item_defs(*)").eq("user_id", id),
        client.from("oxw_user_settings").select("*").eq("user_id", id).maybeSingle(),
      ]);
      return json(res, {
        userId: id,
        progression: prog.data,
        inventory: inv.data ?? [],
        settings: settings.data,
      });
    }

    // ---- me/progression ----
    if (route === "me/progression" && req.method === "GET") {
      const { id, client } = await requireUser(req);
      const { data, error } = await client.from("oxw_progression").select("*").eq("user_id", id).maybeSingle();
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { progression: data });
    }

    // ---- me/inventory ----
    if (route === "me/inventory" && req.method === "GET") {
      const { id, client } = await requireUser(req);
      const { data, error } = await client
        .from("oxw_inventory")
        .select("*, item:oxw_item_defs(*)")
        .eq("user_id", id);
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { inventory: data ?? [] });
    }

    // ---- me/settings ----
    if (route === "me/settings" && req.method === "GET") {
      const { id, client } = await requireUser(req);
      const { data, error } = await client.from("oxw_user_settings").select("*").eq("user_id", id).maybeSingle();
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { settings: data });
    }

    if (route === "me/settings" && req.method === "PATCH") {
      const { id, client } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      const patch: Record<string, unknown> = { user_id: id };
      for (const k of ["display_prefs", "privacy", "notifications", "gameplay", "locale", "timezone"]) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      const { data, error } = await client.from("oxw_user_settings").upsert(patch).select("*").single();
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { settings: data });
    }

    // ---- notifications ----
    if (route === "me/notifications" && req.method === "GET") {
      const { id, client } = await requireUser(req);
      const unread = String(req.query.unread || "") === "1";
      let q = client.from("oxw_notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50);
      if (unread) q = q.is("read_at", null);
      const { data, error } = await q;
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { notifications: data ?? [] });
    }

    if (route === "me/notifications/read" && req.method === "POST") {
      const { client } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      const { data, error } = await client.rpc("oxw_mark_notifications_read", {
        p_ids: body.ids ?? null,
      });
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { marked: data });
    }

    // ---- lobbies ----
    if (route === "lobbies" && req.method === "GET") {
      const client = adminClient();
      const city = typeof req.query.city === "string" ? req.query.city : undefined;
      let q = client
        .from("oxw_lobbies")
        .select("id, channel_id, label, city_id, visibility, max_players, player_count, status, created_at")
        .eq("visibility", "public")
        .eq("status", "open")
        .order("player_count", { ascending: false })
        .limit(50);
      if (city) q = q.eq("city_id", city);
      const { data, error } = await q;
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { lobbies: data ?? [] });
    }

    if (route === "lobbies" && req.method === "POST") {
      const { id, client } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      const label = String(body.label || "Custom Lobby").slice(0, 64);
      const city_id = String(body.cityId || "nyc").slice(0, 32);
      const visibility = body.visibility === "private" ? "private" : "public";
      const channel_id = String(body.channelId || `oxc-lobby-${Date.now()}`).slice(0, 120);
      const { data, error } = await client
        .from("oxw_lobbies")
        .insert({
          channel_id,
          label,
          city_id,
          visibility,
          host_id: id,
          password_hash: body.passwordHash ?? null,
          max_players: Math.min(Number(body.maxPlayers) || 64, 256),
        })
        .select("*")
        .single();
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { lobby: data }, 201);
    }

    // ---- presence ----
    if (route === "presence" && req.method === "POST") {
      const { client } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      const { data, error } = await client.rpc("oxw_upsert_presence", {
        p_city_id: body.cityId ?? "nyc",
        p_lobby_id: body.lobbyId ?? null,
        p_status: body.status ?? "online",
        p_meta: body.meta ?? {},
      });
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { presence: data });
    }

    // ---- quests ----
    if (route === "quests" && req.method === "GET") {
      const db = adminClient();
      const { data, error } = await db.from("oxw_quests").select("*").eq("is_active", true);
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { quests: data ?? [] });
    }

    if (route === "me/quests" && req.method === "GET") {
      const { id, client } = await requireUser(req);
      const { data, error } = await client.from("oxw_user_quests").select("*, quest:oxw_quests(*)").eq("user_id", id);
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { quests: data ?? [] });
    }

    // ---- trades ----
    if (route === "trades/record" && req.method === "POST") {
      const { client } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      const { data, error } = await client.rpc("oxw_record_trade", {
        p_wallet: body.wallet,
        p_side: body.side,
        p_input_mint: body.inputMint,
        p_output_mint: body.outputMint,
        p_input_amount: body.inputAmount,
        p_output_amount: body.outputAmount,
        p_signature: body.signature,
        p_venue: body.venue ?? "jupiter",
        p_price_usd: body.priceUsd ?? null,
        p_value_usd: body.valueUsd ?? null,
        p_meta: body.meta ?? {},
      });
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { trade: data }, 201);
    }

    if (route === "trades/history" && req.method === "GET") {
      const { id, client } = await requireUser(req);
      const { data, error } = await client
        .from("oxw_trade_history")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { trades: data ?? [] });
    }

    // ---- token intel ----
    if (parts[0] === "token-intel" && parts[1] && req.method === "GET") {
      const mint = parts[1];
      const db = adminClient();
      const { data, error } = await db.from("oxw_token_intel").select("*").eq("mint", mint).maybeSingle();
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { intel: data });
    }

    if (parts[0] === "token-intel" && parts[1] && req.method === "POST") {
      // Service-role upsert for scanner workers
      const secret = req.headers["x-oxw-worker-secret"];
      if (!process.env.OXW_WORKER_SECRET || secret !== process.env.OXW_WORKER_SECRET) {
        return json(res, { error: "forbidden" }, 403);
      }
      const mint = parts[1];
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      const db = adminClient();
      const { data, error } = await db
        .from("oxw_token_intel")
        .upsert({
          mint,
          chain: body.chain ?? "solana",
          symbol: body.symbol,
          name: body.name,
          risk_score: body.riskScore,
          risk_flags: body.riskFlags ?? [],
          holder_count: body.holderCount,
          top10_pct: body.top10Pct,
          liquidity_usd: body.liquidityUsd,
          mcap_usd: body.mcapUsd,
          dev_wallet: body.devWallet,
          last_scanned_at: new Date().toISOString(),
          raw: body.raw ?? {},
        })
        .select("*")
        .single();
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { intel: data });
    }

    // ---- achievements ----
    if (route === "achievements" && req.method === "GET") {
      const db = adminClient();
      const { data, error } = await db.from("oxw_achievements").select("*").eq("is_active", true);
      if (error) return json(res, { error: error.message }, 400);
      return json(res, { achievements: data ?? [] });
    }

    return json(res, { error: "not_found", route }, 404);
  } catch (e) {
    const err = e as Error & { status?: number };
    const status = err.status || 500;
    return json(res, { error: err.message || "internal_error" }, status);
  }
}
