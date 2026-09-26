/**
 * QA harness — fill-claim mutex / double-fill race fix (F1).
 *
 * The mutex helpers are module-level in
 * web/api/orbitx/_handlers/_mcp-app-wallet.js, so this file slices their
 * declaration block out of the handler source and evaluates it in isolation
 * (same technique as the other qa-* harnesses). If the handler is refactored
 * (block moved/renamed), the extractor throws at collection time and EVERY
 * test fails loudly — never silent green.
 *
 * Read-only: no network, no real DB (supabase client is faked in-memory),
 * no fills executed. The fake emulates PostgREST conditional-update
 * semantics: the .or()/.eq() guards are evaluated against the row's CURRENT
 * meta at write time, so a "loser" claim gets back zero rows — the same
 * atomicity the real Supabase update relies on.
 *
 * Covers: isFillOpen family conventions, stale-claim reaping, claim
 * winner/loser serialization (the F1 repro), resolve guarding (never
 * clobbers a row it no longer owns), transport-error retry, and the exact
 * shape of the conditional-update filter string.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HANDLER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../api/orbitx/_handlers/_mcp-app-wallet.js"
);
const SRC = readFileSync(HANDLER_PATH, "utf8");

const START_ANCHOR = "/* Fill-claim mutex (double-fill race fix).";
const END_ANCHOR = "// Errors that will never succeed on retry";
const startIdx = SRC.indexOf(START_ANCHOR);
const endIdx = SRC.indexOf(END_ANCHOR);
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  throw new Error(
    "qa-fill-claim: mutex block anchors not found in _mcp-app-wallet.js — handler was refactored, update the extractor"
  );
}
// Banner comment line precedes START_ANCHOR; include from the line start.
const blockStart = SRC.lastIndexOf("/*", startIdx);
let block = SRC.slice(blockStart, endIdx).replace(/^export /gm, "");
const {
  FILL_STATUS,
  FILL_CLAIM_MS,
  fillClaimIsStale,
  isFillOpen,
  claimFillRow,
  resolveFillRow,
  // eslint-disable-next-line no-new-func
} = new Function(`${block}; return { FILL_STATUS, FILL_CLAIM_MS, fillClaimIsStale, isFillOpen, claimFillRow, resolveFillRow };`)();

if (FILL_STATUS !== "filling") throw new Error("qa-fill-claim: FILL_STATUS extraction failed");

/* ------------------------------------------------------------------ */
/* Fake Supabase client with conditional-update semantics              */
/* ------------------------------------------------------------------ */

function splitTopLevel(s) {
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

function evalClause(clause, meta) {
  clause = clause.trim();
  const andM = clause.match(/^and\((.*)\)$/);
  if (andM) return splitTopLevel(andM[1]).every((c) => evalClause(c, meta));
  const m = clause.match(/^meta->>(\w+)\.(is\.null|eq\.|lt\.)(.*)$/);
  if (!m) throw new Error(`qa-fill-claim: unparseable clause ${clause}`);
  const [, field, op, raw] = m;
  const v = meta?.[field];
  if (op === "is.null") return v == null;
  if (op === "eq.") return String(v ?? "") === raw;
  if (op === "lt.") return String(v ?? "") < raw; // ISO-8601 strings compare chronologically
  return false;
}

function makeDb(seedRows = [], { failTimes = 0 } = {}) {
  const rows = new Map(seedRows.map((r) => [r.id, { id: r.id, meta: JSON.parse(JSON.stringify(r.meta || {})) }]));
  const seenOrConds = [];
  let failuresLeft = failTimes;
  const client = {
    seenOrConds,
    from() {
      const q = {
        _update: null, _eq: [], _neq: [], _or: null,
        update(patch) { q._update = patch; return q; },
        eq(col, val) { q._eq.push([col, val]); return q; },
        neq(col, val) { q._neq.push([col, val]); return q; },
        or(cond) { q._or = cond; seenOrConds.push(cond); return q; },
        async select() {
          if (failuresLeft > 0) { failuresLeft--; throw new Error("transport boom"); }
          const idEq = q._eq.find(([c]) => c === "id");
          const row = idEq ? rows.get(idEq[1]) : null;
          if (!row) return { data: [], error: null };
          const meta = row.meta || {};
          for (const [col, val] of q._eq) {
            if (col === "id") continue;
            const mm = col.match(/^meta->>(\w+)$/);
            if (!mm || String(meta[mm[1]] ?? "") !== String(val)) return { data: [], error: null };
          }
          for (const [col, val] of q._neq) {
            const mm = col.match(/^meta->>(\w+)$/);
            if (!mm || String(meta[mm[1]] ?? "") === String(val)) return { data: [], error: null };
          }
          if (q._or && !splitTopLevel(q._or).some((c) => evalClause(c, meta))) {
            return { data: [], error: null };
          }
          if (q._update) row.meta = JSON.parse(JSON.stringify(q._update.meta));
          return { data: [{ id: row.id }], error: null };
        },
      };
      return q;
    },
  };
  return { client, rows };
}

const isoAgoMin = (min) => new Date(Date.now() - min * 60_000).toISOString();

/* ------------------------------------------------------------------ */
/* isFillOpen / fillClaimIsStale conventions                           */
/* ------------------------------------------------------------------ */

describe("isFillOpen family conventions", () => {
  it("missing status counts as open (limits/trailing/ladder/alerts)", () => {
    expect(isFillOpen({})).toBe(true);
    expect(isFillOpen({ status: "open" })).toBe(true);
  });
  it("copy/sniper use openValue 'active'", () => {
    expect(isFillOpen({ status: "active" }, "active")).toBe(true);
    expect(isFillOpen({ status: "active" })).toBe(false); // wrong family
    expect(isFillOpen({}, "active")).toBe(true); // missing counts as the family's open value
  });
  it("fresh 'filling' claim is not open", () => {
    expect(isFillOpen({ status: "filling", fillingAt: new Date().toISOString() })).toBe(false);
  });
  it("stale 'filling' claim is reaped as open", () => {
    expect(isFillOpen({ status: "filling", fillingAt: isoAgoMin(11) })).toBe(true);
    expect(isFillOpen({ status: "filling", fillingAt: isoAgoMin(9) })).toBe(false);
  });
  it("terminal states are never open", () => {
    for (const s of ["filled", "failed", "triggered", "cancelled", "stopped"]) {
      expect(isFillOpen({ status: s })).toBe(false);
    }
  });
});

describe("fillClaimIsStale", () => {
  it("fresh / missing fillingAt is not stale", () => {
    expect(fillClaimIsStale({ fillingAt: new Date().toISOString() })).toBe(false);
    expect(fillClaimIsStale({})).toBe(false);
  });
  it("older than FILL_CLAIM_MS (10 min) is stale", () => {
    expect(FILL_CLAIM_MS).toBe(10 * 60 * 1000);
    expect(fillClaimIsStale({ fillingAt: isoAgoMin(11) })).toBe(true);
    expect(fillClaimIsStale({ fillingAt: isoAgoMin(9) })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* claimFillRow                                                        */
/* ------------------------------------------------------------------ */

describe("claimFillRow", () => {
  let db;
  beforeEach(() => {
    db = makeDb([
      { id: "r-open", meta: { status: "open", mint: "M1" } },
      { id: "r-missing", meta: { mint: "M2" } },
      { id: "r-filling", meta: { status: "filling", fillingAt: new Date().toISOString() } },
      { id: "r-stale", meta: { status: "filling", fillingAt: isoAgoMin(30) } },
      { id: "r-filled", meta: { status: "filled" } },
      { id: "r-cancelled", meta: { status: "cancelled" } },
      { id: "r-active", meta: { status: "active" } },
    ]);
  });

  it("winner: open row flips to 'filling' and returns the claim patch", async () => {
    const patch = await claimFillRow(db.client, "r-open", { status: "open", mint: "M1" });
    expect(patch).not.toBeNull();
    expect(patch.status).toBe("filling");
    expect(patch.mint).toBe("M1"); // original meta carried through
    expect(typeof patch.fillingAt).toBe("string");
    expect(db.rows.get("r-open").meta.status).toBe("filling");
  });

  it("bumps attempts by default; bumpAttempts:false skips it", async () => {
    const p1 = await claimFillRow(db.client, "r-open", { status: "open", attempts: 2 });
    expect(p1.attempts).toBe(3);
    const db2 = makeDb([{ id: "x", meta: { status: "open", attempts: 2 } }]);
    const p2 = await claimFillRow(db2.client, "x", { status: "open", attempts: 2 }, { bumpAttempts: false });
    expect(p2.attempts).toBe(2);
  });

  it("F1 repro: two overlapping ticks serialize — exactly one winner", async () => {
    // Tick A and tick B both read the row as open, then both claim.
    const winner = await claimFillRow(db.client, "r-open", { status: "open" });
    const loser = await claimFillRow(db.client, "r-open", { status: "open" });
    expect(winner).not.toBeNull();
    expect(loser).toBeNull(); // lost the race — must NOT execute
    expect(db.rows.get("r-open").meta.fillingAt).toBe(winner.fillingAt); // winner's claim intact
  });

  it("missing status is claimed as open (family convention)", async () => {
    const patch = await claimFillRow(db.client, "r-missing", { mint: "M2" });
    expect(patch).not.toBeNull();
    expect(patch.status).toBe("filling");
  });

  it("stale 'filling' claim is reaped by a later tick", async () => {
    const patch = await claimFillRow(db.client, "r-stale", { status: "filling", fillingAt: isoAgoMin(30) });
    expect(patch).not.toBeNull();
    expect(patch.status).toBe("filling");
    // fillingAt refreshed — the reap is a new claim, not the dead one
    expect(Date.parse(patch.fillingAt)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("terminal / foreign states are never claimed", async () => {
    expect(await claimFillRow(db.client, "r-filled", { status: "filled" })).toBeNull();
    expect(await claimFillRow(db.client, "r-cancelled", { status: "cancelled" })).toBeNull();
    expect(await claimFillRow(db.client, "r-active", { status: "active" })).toBeNull(); // openValue defaults to "open"
  });

  it("openValue 'active' claims copy/sniper rows", async () => {
    const patch = await claimFillRow(db.client, "r-active", { status: "active" }, { openValue: "active" });
    expect(patch).not.toBeNull();
    expect(patch.status).toBe("filling");
  });

  it("transport error fails closed (null, no phantom claim)", async () => {
    const bad = makeDb([{ id: "r-open", meta: { status: "open" } }], { failTimes: 99 });
    expect(await claimFillRow(bad.client, "r-open", { status: "open" })).toBeNull();
    expect(bad.rows.get("r-open").meta.status).toBe("open"); // untouched
  });

  it("the conditional-update filter has all three alternatives", async () => {
    await claimFillRow(db.client, "r-open", { status: "open" });
    const cond = db.client.seenOrConds.at(-1);
    expect(cond).toContain("meta->>status.is.null");
    expect(cond).toContain("meta->>status.eq.open");
    expect(cond).toContain("meta->>status.eq.filling");
    expect(cond).toContain("meta->>fillingAt.lt.");
  });
});

/* ------------------------------------------------------------------ */
/* resolveFillRow                                                      */
/* ------------------------------------------------------------------ */

describe("resolveFillRow", () => {
  it("resolves a held claim: status flips, fillingAt removed", async () => {
    const db = makeDb([{ id: "r", meta: { status: "filling", fillingAt: new Date().toISOString(), mint: "M" } }]);
    const ok = await resolveFillRow(db.client, "r", { status: "filling", mint: "M", attempts: 3 }, "filled");
    expect(ok).toBe(true);
    const meta = db.rows.get("r").meta;
    expect(meta.status).toBe("filled");
    expect(meta.fillingAt).toBeUndefined();
    expect(meta.attempts).toBe(3);
  });

  it("never clobbers a row it no longer owns (user cancelled mid-flight)", async () => {
    const db = makeDb([{ id: "r", meta: { status: "cancelled", cancelledAt: new Date().toISOString() } }]);
    const ok = await resolveFillRow(db.client, "r", { status: "filling", attempts: 1 }, "filled");
    expect(ok).toBe(false);
    expect(db.rows.get("r").meta.status).toBe("cancelled"); // untouched
    expect(db.rows.get("r").meta.cancelledAt).toBeDefined();
  });

  it("retries transport errors, then gives up", async () => {
    const db = makeDb([{ id: "r", meta: { status: "filling" } }], { failTimes: 2 });
    expect(await resolveFillRow(db.client, "r", { x: 1 }, "filled")).toBe(true);
    expect(db.rows.get("r").meta.status).toBe("filled");

    const db2 = makeDb([{ id: "r", meta: { status: "filling" } }], { failTimes: 99 });
    expect(await resolveFillRow(db2.client, "r", { x: 1 }, "filled")).toBe(false);
    expect(db2.rows.get("r").meta.status).toBe("filling"); // still filling → reaped later, not silently resolved
  });

  it("full cycle: claim → execute → resolve is single-winner end to end", async () => {
    const db = makeDb([{ id: "r", meta: { status: "open", attempts: 0 } }]);
    const a = await claimFillRow(db.client, "r", { status: "open", attempts: 0 });
    const b = await claimFillRow(db.client, "r", { status: "open", attempts: 0 });
    expect(a && !b).toBe(true);
    // Only the winner "executes"; the loser never touches the row.
    const resolved = await resolveFillRow(db.client, "r", { ...a, attempts: a.attempts }, "filled");
    expect(resolved).toBe(true);
    expect(db.rows.get("r").meta.status).toBe("filled");
    expect(db.rows.get("r").meta.attempts).toBe(1);
  });
});
