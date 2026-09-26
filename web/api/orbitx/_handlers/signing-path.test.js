/**
 * Signing-path audit fixes — F2 (signing-auth provenance) + F3 (tx confirmation).
 *
 * F2 root cause: needAuth() in _mcp-app-wallet.js (and the duplicate in
 * _mcp-app-desk-ops.js) trusted ANY object shaped like { userId } — no
 * provenance. Nothing distinguished a credential minted by the dashboard
 * auth flow from a forged literal. enrichAuth already stamps every real
 * credential with `source` ∈ {bearer, oauth_token, link_auth, link_session};
 * the gate below requires it.
 *
 * F3 root cause: signUserSwap / signAndSendUserTx returned { ok:true } the
 * moment the RPC accepted the broadcast (skipPreflight:true) — no
 * confirmation poll. Callers then reported success for txs that may never
 * have landed. The fix: poll getSignatureStatuses after broadcast and
 * return an honest pending/failed state; the tick families renew the fill
 * claim with the pending signature instead of re-executing blindly
 * (re-execution would double-fill if the first tx lands late).
 *
 * Read-only except for the in-memory fake DB: no network (fetch is mocked),
 * no fills executed. The claim-settle block is sliced out of the handler
 * source and evaluated in isolation (same technique as the qa-* harnesses);
 * if the handler is refactored the extractor throws at collection time and
 * EVERY test fails loudly — never silent green.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSigningAuth,
  SIGNING_AUTH_SOURCES,
  TICK_AUTH_SOURCE,
  pollTxConfirmation,
  getTxConfirmationStatus,
} from "./_user-trading-wallet.js";
import { needAuth } from "./_mcp-app-wallet.js";

// The vitest environment lacks AbortSignal.timeout (present in Node 24 and
// the Vercel runtime, where the handler already relies on it). Polyfill it
// so the confirmation poll is testable here.
if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = (ms) => {
    const c = new AbortController();
    setTimeout(() => c.abort(new Error("TimeoutError")), ms);
    return c.signal;
  };
}

/* ------------------------------------------------------------------ */
/* F2: signing-auth provenance gate                                    */
/* ------------------------------------------------------------------ */

describe("F2: signing-auth provenance gate", () => {
  it("rejects a bare {userId} object with no provenance (the blind-trust bug)", () => {
    // Pre-fix, needAuth({ userId }) passed — a forged literal got signing power.
    expect(isSigningAuth({ userId: "victim-user-123" })).toBe(false);
    expect(needAuth({ userId: "victim-user-123" }).userId).toBeFalsy();
  });

  it("accepts every credential class minted by the dashboard auth flow", () => {
    for (const source of ["bearer", "oauth_token", "link_auth", "link_session"]) {
      expect(isSigningAuth({ userId: "u1", source })).toBe(true);
      expect(needAuth({ userId: "u1", source }).userId).toBe("u1");
    }
  });

  it("accepts the server-side tick source used by the 5-min auto-fill sweep", () => {
    expect(TICK_AUTH_SOURCE).toBe("tick");
    expect(SIGNING_AUTH_SOURCES.has("tick")).toBe(true);
    expect(isSigningAuth({ userId: "u1", source: TICK_AUTH_SOURCE })).toBe(true);
    expect(needAuth({ userId: "u1", source: "tick" }).userId).toBe("u1");
  });

  it("rejects forged, unknown, or missing sources and missing userId", () => {
    expect(isSigningAuth({ userId: "u1", source: "forged" })).toBe(false);
    expect(isSigningAuth({ userId: "u1", source: "" })).toBe(false);
    expect(isSigningAuth({ userId: "u1", source: null })).toBe(false);
    expect(isSigningAuth({ source: "bearer" })).toBe(false);
    expect(isSigningAuth({ userId: "" , source: "bearer" })).toBe(false);
    expect(isSigningAuth(null)).toBe(false);
    expect(isSigningAuth(undefined)).toBe(false);
    expect(isSigningAuth("u1")).toBe(false);
    expect(needAuth({ userId: "u1", source: "forged" }).userId).toBeFalsy();
    expect(needAuth(null).userId).toBeFalsy();
  });

  it("every strategy family marks its synthetic tick auth with the tick source", () => {
    // The 5 families build auth server-side (no user present). If any of them
    // goes back to a bare { userId }, the provenance gate would lock the
    // auto-fill sweep out — this fails loudly instead of silently.
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const families = [
      ["_mcp-app-wallet.js", "tickUserLimits"],
      ["_mcp-copy-engine.js", "mirrorSwap"],
      ["_mcp-trailing.js", "trailing"],
      ["_mcp-sniper.js", "sniper"],
      ["_mcp-alerts.js", "alerts"],
    ];
    for (const [file] of families) {
      const src = readFileSync(path.join(dir, file), "utf8");
      expect(src, `${file} must stamp tick auth`).toMatch(/source:\s*(TICK_AUTH_SOURCE|"tick")/);
    }
  });
});

/* ------------------------------------------------------------------ */
/* F3: confirmation polling after broadcast                            */
/* ------------------------------------------------------------------ */

function mockRpc(statuses, { throwOn = -1 } = {}) {
  let i = 0;
  return async () => {
    const n = i++;
    if (n === throwOn) throw new Error("transport boom");
    const v = n < statuses.length ? statuses[n] : statuses[statuses.length - 1];
    return {
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { value: [v] } }),
    };
  };
}

const SIG = "5".repeat(88);

describe("F3: tx confirmation polling", () => {
  let realFetch;
  beforeEach(() => { realFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

  it("getTxConfirmationStatus maps RPC shapes", async () => {
    globalThis.fetch = mockRpc([{ confirmationStatus: "confirmed", slot: 11 }]);
    expect(await getTxConfirmationStatus(SIG)).toMatchObject({ status: "confirmed", slot: 11 });
    globalThis.fetch = mockRpc([null]);
    expect(await getTxConfirmationStatus(SIG)).toMatchObject({ status: "unknown" });
    globalThis.fetch = mockRpc([{ confirmationStatus: "confirmed", slot: 12, err: { InstructionError: [0, "Custom"] } }]);
    expect(await getTxConfirmationStatus(SIG)).toMatchObject({ status: "confirmed", failed: true });
  });

  it("returns confirmed when the tx lands mid-poll", async () => {
    globalThis.fetch = mockRpc([null, { confirmationStatus: "confirmed", slot: 20 }], {});
    const r = await pollTxConfirmation(SIG, { budgetMs: 5000, intervalMs: 10 });
    expect(r).toMatchObject({ confirmed: true, confirmationStatus: "confirmed", signature: SIG });
  });

  it("accepts finalized", async () => {
    globalThis.fetch = mockRpc([{ confirmationStatus: "finalized", slot: 21 }]);
    const r = await pollTxConfirmation(SIG, { budgetMs: 1000, intervalMs: 10 });
    expect(r.confirmed).toBe(true);
  });

  it("reports on-chain failure instead of success", async () => {
    globalThis.fetch = mockRpc([{ confirmationStatus: "confirmed", slot: 22, err: { InstructionError: [0, "Custom"] } }]);
    const r = await pollTxConfirmation(SIG, { budgetMs: 1000, intervalMs: 10 });
    expect(r).toMatchObject({ confirmed: false, failed: true, signature: SIG });
    expect(r.txError).toBeTruthy();
  });

  it("returns honest unknown when the budget expires without confirmation", async () => {
    globalThis.fetch = mockRpc([null]);
    const r = await pollTxConfirmation(SIG, { budgetMs: 60, intervalMs: 10 });
    expect(r).toMatchObject({ confirmed: false, unknown: true, signature: SIG });
    // Must never look like success.
    expect(r.confirmed).toBe(false);
  });

  it("survives transport errors mid-poll and keeps waiting", async () => {
    globalThis.fetch = mockRpc([null, { confirmationStatus: "confirmed", slot: 23 }], { throwOn: 0 });
    const r = await pollTxConfirmation(SIG, { budgetMs: 5000, intervalMs: 10 });
    expect(r.confirmed).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* F3: stale pending-claim settlement (sliced handler block + fake DB)  */
/* ------------------------------------------------------------------ */

const HANDLER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "_mcp-app-wallet.js"
);
const SRC = readFileSync(HANDLER_PATH, "utf8");

const START_ANCHOR = "/* Fill-claim mutex (double-fill race fix).";
const END_ANCHOR = "// Errors that will never succeed on retry";
const startIdx = SRC.indexOf(START_ANCHOR);
const endIdx = SRC.indexOf(END_ANCHOR);
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  throw new Error(
    "signing-path: mutex block anchors not found in _mcp-app-wallet.js — handler was refactored, update the extractor"
  );
}
const blockStart = SRC.lastIndexOf("/*", startIdx);
const block = SRC.slice(blockStart, endIdx).replace(/^export /gm, "");
const {
  FILL_STATUS,
  FILL_CLAIM_MS,
  PENDING_SIG_MAX_AGE_MS,
  fillClaimIsStale,
  claimFillRow,
  resolveFillRow,
  settlePendingClaim,
  renewFillClaim,
  // eslint-disable-next-line no-new-func
} = new Function(
  `${block}; return { FILL_STATUS, FILL_CLAIM_MS, PENDING_SIG_MAX_AGE_MS, fillClaimIsStale, claimFillRow, resolveFillRow, settlePendingClaim, renewFillClaim };`
)();

if (FILL_STATUS !== "filling") throw new Error("signing-path: FILL_STATUS extraction failed");
if (typeof settlePendingClaim !== "function") throw new Error("signing-path: settlePendingClaim extraction failed");
if (typeof renewFillClaim !== "function") throw new Error("signing-path: renewFillClaim extraction failed");
if (!(PENDING_SIG_MAX_AGE_MS >= 10 * 60 * 1000)) throw new Error("signing-path: PENDING_SIG_MAX_AGE_MS extraction failed");

/* Minimal fake Supabase client with conditional-update semantics. */

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
  if (!m) throw new Error(`signing-path: unparseable clause ${clause}`);
  const [, field, op, raw] = m;
  const v = meta?.[field];
  if (op === "is.null") return v == null;
  if (op === "eq.") return String(v ?? "") === raw;
  if (op === "lt.") return String(v ?? "") < raw; // ISO-8601 strings compare chronologically
  return false;
}

function makeDb(seedRows = []) {
  const rows = new Map(seedRows.map((r) => [r.id, { id: r.id, meta: JSON.parse(JSON.stringify(r.meta || {})) }]));
  const client = {
    rows,
    from() {
      const q = {
        _update: null, _eq: [], _neq: [], _or: null,
        update(p) { q._update = p; return q; },
        eq(c, v) { q._eq.push([c, v]); return q; },
        neq(c, v) { q._neq.push([c, v]); return q; },
        or(c) { q._or = c; return q; },
        async select() {
          const idEq = q._eq.find(([c]) => c === "id");
          const row = idEq ? rows.get(idEq[1]) : null;
          if (!row) return { data: [], error: null };
          const meta = row.meta || {};
          for (const [c, v] of q._eq) {
            if (c === "id") continue;
            const mm = c.match(/^meta->>(\w+)$/);
            if (!mm || String(meta[mm[1]] ?? "") !== String(v)) return { data: [], error: null };
          }
          for (const [c, v] of q._neq) {
            const mm = c.match(/^meta->>(\w+)$/);
            if (mm && String(meta[mm[1]] ?? "") === String(v)) return { data: [], error: null };
          }
          if (q._or && !splitTopLevel(q._or).some((cl) => evalClause(cl, meta))) {
            return { data: [], error: null };
          }
          row.meta = JSON.parse(JSON.stringify(q._update.meta));
          return { data: [{ id: row.id }], error: null };
        },
      };
      return q;
    },
  };
  return client;
}

const staleFillingAt = new Date(Date.now() - FILL_CLAIM_MS - 60_000).toISOString();

function pendingRow(over = {}) {
  return {
    id: "row1",
    meta: {
      status: "filling",
      fillingAt: staleFillingAt,
      pendingSignature: SIG,
      pendingSince: new Date(Date.now() - 60_000).toISOString(),
      ...over,
    },
  };
}

describe("F3: stale pending-claim settlement", () => {
  it("a tx that landed while unwatched settles to filled — never re-executed", async () => {
    const db = makeDb([pendingRow()]);
    const getTxStatus = async () => ({ status: "confirmed", slot: 99, signature: SIG });
    const claimed = await claimFillRow(db, "row1", db.rows.get("row1").meta, { getTxStatus });
    expect(claimed).toBeNull(); // no new claim — the row was settled
    const meta = db.rows.get("row1").meta;
    expect(meta.status).toBe("filled");
    expect(meta.lastFill.signature).toBe(SIG);
    expect(meta.pendingSignature).toBeUndefined();
  });

  it("an on-chain failure allows a clean reap (safe to retry, pending fields cleared)", async () => {
    const db = makeDb([pendingRow()]);
    const getTxStatus = async () => ({ status: "confirmed", failed: true, err: { InstructionError: [0, "Custom"] }, signature: SIG });
    const before = db.rows.get("row1").meta;
    const claimed = await claimFillRow(db, "row1", before, { getTxStatus });
    expect(claimed).not.toBeNull();
    expect(claimed.status).toBe("filling");
    expect(claimed.pendingSignature).toBeUndefined();
    // The reaped claim is fresh, not stale — no infinite settle loop.
    expect(fillClaimIsStale(claimed)).toBe(false);
  });

  it("an unknown-but-recent tx renews the claim — never re-executed blindly", async () => {
    const db = makeDb([pendingRow()]);
    const getTxStatus = async () => ({ status: "unknown", signature: SIG });
    const claimed = await claimFillRow(db, "row1", db.rows.get("row1").meta, { getTxStatus });
    expect(claimed).toBeNull(); // renewed, not reaped
    const meta = db.rows.get("row1").meta;
    expect(meta.status).toBe("filling");
    expect(meta.pendingSignature).toBe(SIG); // still tracked
    expect(fillClaimIsStale(meta)).toBe(false); // claim extended
  });

  it("an unknown tx past the max pending age is reaped (blockhash long dead)", async () => {
    const db = makeDb([pendingRow({ pendingSince: new Date(Date.now() - PENDING_SIG_MAX_AGE_MS - 60_000).toISOString() })]);
    const getTxStatus = async () => ({ status: "unknown", signature: SIG });
    const claimed = await claimFillRow(db, "row1", db.rows.get("row1").meta, { getTxStatus });
    expect(claimed).not.toBeNull();
    expect(claimed.pendingSignature).toBeUndefined();
  });

  it("settlePendingClaim marks a confirmed ladder tranche filled without touching others", async () => {
    const db = makeDb([pendingRow({
      tranches: [
        { mult: 2, pct: 25, status: "open", pendingSignature: SIG, pendingSince: new Date().toISOString() },
        { mult: 3, pct: 25, status: "open" },
      ],
    })]);
    const getTxStatus = async () => ({ status: "finalized", slot: 100, signature: SIG });
    const r = await settlePendingClaim(db, "row1", db.rows.get("row1").meta, getTxStatus);
    expect(r.action).toBe("filled");
    const meta = db.rows.get("row1").meta;
    expect(meta.tranches[0].status).toBe("filled");
    expect(meta.tranches[0].signature).toBe(SIG);
    expect(meta.tranches[1].status).toBe("open");
    expect(meta.status).toBe("open"); // not all tranches done
  });

  it("renewFillClaim renews only a claim we still own", async () => {
    const freshAt = new Date().toISOString();
    const db = makeDb([{ id: "row1", meta: { status: "filling", fillingAt: freshAt } }]);
    expect(await renewFillClaim(db, "row1", { status: "filling", fillingAt: freshAt, pendingSignature: SIG })).toBe(true);
    expect(db.rows.get("row1").meta.pendingSignature).toBe(SIG);
    // Row re-armed by the user meanwhile — renewal must not clobber it.
    db.rows.get("row1").meta = { status: "open", fillingAt: freshAt };
    expect(await renewFillClaim(db, "row1", { status: "filling", fillingAt: freshAt })).toBe(false);
  });

  it("a plain stale claim with no pendingSignature still reaps as before (no regression)", async () => {
    const db = makeDb([{ id: "row1", meta: { status: "filling", fillingAt: staleFillingAt } }]);
    const claimed = await claimFillRow(db, "row1", db.rows.get("row1").meta, {});
    expect(claimed).not.toBeNull();
    expect(claimed.status).toBe("filling");
  });
});
