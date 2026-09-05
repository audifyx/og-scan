import { describe, expect, it } from "vitest";
import {
  dispatchGroupChatTool,
  isGcLeaveUtterance,
  maybeRelayGroupChat,
  resolveGcNaturalTool,
  slugifyGcName,
} from "./mcp-group-chat.js";

function parsePath(path) {
  const [tablePart, query = ""] = String(path).split("?");
  const table = tablePart.split("?")[0];
  const params = new URLSearchParams(query);
  return { table, params };
}

function matchRow(row, params) {
  for (const [key, raw] of params.entries()) {
    if (key === "select" || key === "order" || key === "limit" || key === "on_conflict") continue;
    let field = key;
    let op = "eq";
    let val = raw;
    const dot = raw.indexOf(".");
    if (dot > 0 && ["eq", "is", "neq"].includes(raw.slice(0, dot))) {
      op = raw.slice(0, dot);
      val = raw.slice(dot + 1);
    } else if (key.includes(".")) {
      [field, op] = key.split(".");
    }
    if (op === "eq" && String(row[field]) !== val) return false;
    if (op === "is" && val === "null" && row[field] != null) return false;
  }
  return true;
}

function memorySb() {
  const db = {
    mcp_group_chats: [],
    mcp_group_members: [],
    mcp_group_messages: [],
    mcp_group_focus: [],
  };
  let n = 0;
  const sb = async (path, init = {}) => {
    const method = String(init.method || "GET").toUpperCase();
    const { table, params } = parsePath(path);
    const rows = db[table];
    if (!rows) throw new Error(`unknown table ${table}`);
    if (method === "GET") {
      let out = rows.filter((r) => matchRow(r, params));
      const order = params.get("order") || "";
      if (order.startsWith("created_at.desc") || order.startsWith("joined_at.desc")) {
        const field = order.split(".")[0];
        out = out.slice().sort((a, b) => String(b[field]).localeCompare(String(a[field])));
      }
      const limit = Number(params.get("limit") || 0);
      if (limit) out = out.slice(0, limit);
      return out;
    }
    if (method === "POST") {
      const body = JSON.parse(init.body);
      n += 1;
      const row = { id: body.id || `id-${n}`, created_at: body.created_at || new Date().toISOString(), ...body };
      const conflict = params.get("on_conflict");
      if (conflict) {
        const keys = conflict.split(",");
        const idx = rows.findIndex((r) => keys.every((k) => String(r[k]) === String(row[k])));
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...row };
          return [rows[idx]];
        }
      }
      rows.push(row);
      return [row];
    }
    if (method === "PATCH") {
      const body = JSON.parse(init.body);
      const hits = rows.filter((r) => matchRow(r, params));
      for (const h of hits) Object.assign(h, body);
      return hits;
    }
    if (method === "DELETE") {
      const keep = [];
      const removed = [];
      for (const r of rows) {
        if (matchRow(r, params)) removed.push(r);
        else keep.push(r);
      }
      db[table] = keep;
      return removed;
    }
    return [];
  };
  sb._db = db;
  return sb;
}

const auth = { userId: "11111111-1111-1111-1111-111111111111", email: "ada@orbitx.world" };

describe("mcp group chats", () => {
  it("requires a name to start", async () => {
    const out = await dispatchGroupChatTool("orbitx_gc_start", {}, { sb: memorySb(), auth });
    expect(out.ok).toBe(false);
    expect(out.error).toBe("name_required");
  });

  it("lists empty rooms with a start hint", async () => {
    const out = await dispatchGroupChatTool("orbitx_gc_list", {}, { sb: memorySb(), auth: {} });
    expect(out.ok).toBe(true);
    expect(out.chats).toEqual([]);
    expect(String(out.message)).toMatch(/start a group chat named/i);
  });

  it("creates, lists, joins, focuses, relays search, then leaves", async () => {
    const sb = memorySb();
    const started = await dispatchGroupChatTool("orbitx_gc_start", { name: "Orbitx" }, { sb, auth });
    expect(started.ok).toBe(true);
    expect(started.slug).toBe("orbitx");

    const listed = await dispatchGroupChatTool("orbitx_gc_list", {}, { sb, auth: {} });
    expect(listed.chats.map((c) => c.name)).toContain("Orbitx");

    const guest = { mcpSessionId: "sess-guest-99" };
    const joined = await dispatchGroupChatTool("orbitx_gc_join", { name: "Orbitx" }, { sb, auth: guest });
    expect(joined.ok).toBe(true);

    const focused = await dispatchGroupChatTool("orbitx_gc_focus", {}, { sb, auth: guest });
    expect(focused.ok).toBe(true);
    expect(focused.focused).toBe(true);

    const relayed = await maybeRelayGroupChat({
      name: "search",
      args: { query: "gm from MCP" },
      auth: guest,
      sb,
    });
    expect(relayed?.ok).toBe(true);
    expect(relayed.posted.body).toBe("gm from MCP");
    expect(String(relayed.message)).toMatch(/gm from MCP/);

    const left = await dispatchGroupChatTool("orbitx_gc_leave", {}, { sb, auth: guest });
    expect(left.ok).toBe(true);
    expect(left.focused).toBe(false);

    const blocked = await dispatchGroupChatTool("orbitx_gc_send", { text: "after leave" }, { sb, auth: guest });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe("not_in_gc");

    const rejoin = await dispatchGroupChatTool("orbitx_gc_join", { name: "Orbitx" }, { sb, auth: guest });
    expect(rejoin.ok).toBe(true);
    const refocus = await dispatchGroupChatTool("orbitx_gc_chat", {}, { sb, auth: guest });
    expect(refocus.ok).toBe(true);
  });

  it("detects leave GC phrases and natural tool names", () => {
    expect(isGcLeaveUtterance("leave GC")).toBe(true);
    expect(isGcLeaveUtterance("okay use tool leave GC")).toBe(true);
    expect(isGcLeaveUtterance("leave_gc")).toBe(true);
    expect(isGcLeaveUtterance("gm everyone")).toBe(false);
    expect(resolveGcNaturalTool("start a group chat named Orbitx")?.name).toBe("orbitx_gc_start");
    expect(resolveGcNaturalTool("hey any group chats")?.name).toBe("orbitx_gc_list");
    expect(resolveGcNaturalTool("join Orbitx")?.args?.name).toBe("Orbitx");
    expect(resolveGcNaturalTool("I want to chat in the group chat")?.name).toBe("orbitx_gc_focus");
    expect(slugifyGcName("Orbitx")).toBe("orbitx");
  });
});
