/**
 * Agent MCP LiveKit voice rooms.
 * Named VCs: start → public join URL → anyone with the link (or MCP) can join.
 */
import { createHmac, randomBytes } from "crypto";

const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const HOST = "https://www.orbitx.world";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlStr(str) {
  return b64url(Buffer.from(str, "utf8"));
}

export function mintLiveKitToken({ identity, roomName, name, ttlSec = 3600 }) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("LiveKit is not configured (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET)");
  }
  const header = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlStr(
    JSON.stringify({
      sub: identity,
      iss: LIVEKIT_API_KEY,
      nbf: now,
      exp: now + ttlSec,
      name: name || identity,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
      },
    }),
  );
  const sig = createHmac("sha256", LIVEKIT_API_SECRET).update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${b64url(sig)}`;
}

export function livekitConfigured() {
  return Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

function slugify(name) {
  const base =
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || "vc";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

function publicRoom(row, extra = {}) {
  if (!row) return null;
  const slug = row.slug;
  return {
    slug,
    name: row.name,
    topic: row.topic || null,
    status: row.status,
    host: row.host_label || null,
    createdAt: row.created_at,
    joinUrl: `${HOST}/vc/${encodeURIComponent(slug)}`,
    livekitUrl: LIVEKIT_URL || null,
    livekitRoom: row.livekit_room,
    ...extra,
  };
}

export async function startVoiceRoom(sb, { name, topic, userId, hostLabel } = {}) {
  const title = String(name || "").trim().slice(0, 80);
  if (!title) {
    return {
      ok: false,
      error: "name_required",
      message: "Name the VC. Example: start a VC named alpha desk",
    };
  }
  const slug = slugify(title);
  const livekit_room = `mcp-vc-${slug}`;
  const row = {
    slug,
    name: title,
    topic: String(topic || "").trim().slice(0, 160) || null,
    livekit_room,
    host_user_id: userId || null,
    host_label: String(hostLabel || "").trim().slice(0, 40) || null,
    status: "live",
    is_private: false,
  };
  let inserted;
  try {
    inserted = await sb("mcp_voice_rooms", {
      method: "POST",
      body: JSON.stringify(row),
      prefer: "return=representation",
    });
  } catch (e) {
    return {
      ok: false,
      error: "voice_table_missing",
      message: e?.message || "Could not create the voice room. Apply mcp_voice_rooms migration.",
    };
  }
  const saved = Array.isArray(inserted) ? inserted[0] : inserted;
  const out = publicRoom(saved);
  let token = null;
  try {
    if (livekitConfigured()) {
      token = mintLiveKitToken({
        identity: userId || `host-${slug}`,
        roomName: livekit_room,
        name: hostLabel || title,
      });
    }
  } catch {
    /* join URL still works once env is set */
  }
  return {
    ok: true,
    action: "vc_started",
    message: `VC "${title}" is live. Share ${out.joinUrl} — anyone can join from the MCP or the link.`,
    ...out,
    token,
    livekitConfigured: livekitConfigured(),
  };
}

export async function listOpenVoiceRooms(sb, { limit = 12 } = {}) {
  const n = Math.min(40, Math.max(1, Number(limit) || 12));
  let rows = [];
  try {
    rows = await sb(
      `mcp_voice_rooms?status=eq.live&is_private=eq.false&select=slug,name,topic,livekit_room,host_label,created_at,status&order=created_at.desc&limit=${n}`,
    );
  } catch (e) {
    return { ok: false, error: "voice_list_failed", message: e?.message || "Could not list VCs" };
  }
  const rooms = (Array.isArray(rows) ? rows : []).map((r) => publicRoom(r));
  if (!rooms.length) {
    return {
      ok: true,
      rooms: [],
      message: "No open VCs right now. Say “start a VC named …” to open one.",
    };
  }
  return {
    ok: true,
    rooms,
    message: rooms.map((r) => `• ${r.name} — ${r.joinUrl}`).join("\n"),
  };
}

export async function getVoiceRoom(sb, { slug, name } = {}) {
  const raw = String(slug || name || "").trim();
  if (!raw) return { ok: false, error: "slug_required", message: "Pass a VC name or slug." };
  const needle = raw.toLowerCase();
  let rows = [];
  try {
    const open = await sb(
      "mcp_voice_rooms?status=eq.live&select=slug,name,topic,livekit_room,host_label,created_at,status,host_user_id&order=created_at.desc&limit=40",
    );
    rows = Array.isArray(open) ? open : [];
  } catch {
    rows = [];
  }
  const hit =
    rows.find((r) => r.slug === raw || String(r.name).toLowerCase() === needle) ||
    rows.find((r) => String(r.name).toLowerCase().includes(needle) || r.slug.includes(needle)) ||
    null;
  if (!hit) {
    const open = { rooms: rows.map((r) => publicRoom(r)) };
    return {
      ok: false,
      error: "vc_not_found",
      message: `No live VC matching "${raw}".${open.rooms.length ? `\nOpen:\n${open.rooms.map((r) => `• ${r.name} — ${r.joinUrl}`).join("\n")}` : " Start one with orbitx_vc_start."}`,
      rooms: open.rooms,
    };
  }
  return { ok: true, ...publicRoom(hit) };
}

export async function joinVoiceRoom(sb, { slug, name, userId, displayName } = {}) {
  const found = await getVoiceRoom(sb, { slug, name });
  if (!found.ok) return found;
  let token = null;
  let tokenError = null;
  try {
    if (livekitConfigured()) {
      token = mintLiveKitToken({
        identity: userId || `guest-${randomBytes(4).toString("hex")}`,
        roomName: found.livekitRoom,
        name: displayName || found.name,
      });
    }
  } catch (e) {
    tokenError = e?.message || String(e);
  }
  return {
    ok: true,
    action: "vc_join",
    message: `Join "${found.name}" at ${found.joinUrl}`,
    ...found,
    token,
    livekitUrl: LIVEKIT_URL || null,
    livekitConfigured: livekitConfigured(),
    tokenError,
  };
}

export async function endVoiceRoom(sb, { slug, name, userId } = {}) {
  const found = await getVoiceRoom(sb, { slug, name });
  if (!found.ok) return found;
  try {
    await sb(`mcp_voice_rooms?slug=eq.${encodeURIComponent(found.slug)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }),
      prefer: "return=minimal",
    });
  } catch (e) {
    return { ok: false, error: "vc_end_failed", message: e?.message || "Could not end VC" };
  }
  return { ok: true, action: "vc_ended", slug: found.slug, name: found.name, endedBy: userId || null };
}

export async function dispatchVoiceTool(name, args, { sb, auth } = {}) {
  const a = args || {};
  const userId = auth?.userId || null;
  const hostLabel = auth?.agentName || auth?.email || null;
  if (name === "orbitx_vc_start" || name === "orbitx_vc_open" || name === "orbitx_vc_create") {
    return startVoiceRoom(sb, { name: a.name || a.title || a.room, topic: a.topic, userId, hostLabel });
  }
  if (name === "orbitx_vc_list" || name === "orbitx_vc_open_list" || name === "orbitx_vc_any") {
    return listOpenVoiceRooms(sb, { limit: a.limit });
  }
  if (name === "orbitx_vc_join" || name === "orbitx_vc_link" || name === "orbitx_vc_invite") {
    return joinVoiceRoom(sb, {
      slug: a.slug || a.code,
      name: a.name || a.room,
      userId,
      displayName: a.displayName || a.username || hostLabel,
    });
  }
  if (name === "orbitx_vc_end" || name === "orbitx_vc_close") {
    return endVoiceRoom(sb, { slug: a.slug, name: a.name || a.room, userId });
  }
  if (name === "orbitx_vc_status") {
    return getVoiceRoom(sb, { slug: a.slug, name: a.name || a.room });
  }
  return null;
}
