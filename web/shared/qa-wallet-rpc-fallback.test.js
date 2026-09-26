/**
 * QA harness — wallet RPC read path with public fallback.
 *
 * Root cause: `orbitx_get_wallet` (GET /api/ogdex/wallet) read SOL balances,
 * token holdings, and swap history ONLY through the keyed Supabase
 * `rpc-proxy` hop. Any failure there (unconfigured provider, quota, outage)
 * was swallowed — `.catch(() => null)` at the call sites plus
 * `lamports == null ? 0` turned it into `"sol": 0, ok: true`,
 * indistinguishable from a genuinely empty wallet. A funded wallet kept
 * reading 0 for minutes after the deposit finalized on-chain (reproduced
 * live: getBalance 27818042 lamports on-chain, tool returned sol: 0).
 *
 * Fix: the local `rpc()` in web/api/ogdex/_routes/_wallet.js and
 * web/api/ogdex/_pnl.js now falls back to a direct public Solana RPC read
 * when the proxy yields nothing. Proxy stays primary; the public read is a
 * last resort and the function still resolves null (never throws) when both
 * paths fail, preserving every caller's contract.
 *
 * Read-only: no network, no DB. `callFn` and `fetch` are stubbed; the block
 * under test is sliced out of the handler sources between the anchors below
 * (same technique as the other qa-* harnesses). If a handler is refactored
 * (block moved/renamed), the extractor throws at collection time and EVERY
 * test fails loudly.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const START = "/* RPC read path with public fallback (qa-wallet-rpc-fallback).";
const END = "/* End RPC read path (qa-wallet-rpc-fallback). */";

function extractBlock(src, label) {
  const s = src.indexOf(START);
  const e = src.indexOf(END);
  if (s < 0 || e < 0 || e <= s) {
    throw new Error(
      `${label}: anchors not found — handler was refactored, update the extractor`
    );
  }
  return src.slice(s, e);
}

const SOURCES = {
  "web/api/ogdex/_routes/_wallet.js": readFileSync(
    path.resolve(HERE, "../api/ogdex/_routes/_wallet.js"),
    "utf8"
  ),
  "web/api/ogdex/_pnl.js": readFileSync(
    path.resolve(HERE, "../api/ogdex/_pnl.js"),
    "utf8"
  ),
};

// The block references callFn / fetch / AbortSignal as free variables; inject
// stubs so the test never touches the network.
function loadRpc(label, src, { callFn, fetchImpl }) {
  const block = extractBlock(src, label);
  const factory = new Function(
    "callFn",
    "fetch",
    "AbortSignal",
    block + "\nreturn { rpc, rpcDirect, PUBLIC_RPC_URL };"
  );
  return factory(callFn, fetchImpl, { timeout: () => undefined });
}

const LAMPORTS = 27818042;
const ADDR = "HfoAjPKZrfuNJ3QRJNZwXvpNZZAR6ekoyUWtzmY7rW9t";

function directRpcStub(calls, result) {
  return async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { json: async () => result };
  };
}

for (const [label, src] of Object.entries(SOURCES)) {
  describe(`wallet rpc fallback [${label}]`, () => {
    it("falls back to direct public RPC when the proxy yields nothing", async () => {
      const calls = [];
      // Today's outage shape: proxy answers, but with no usable result.
      const callFn = async () => ({ success: false });
      const fetchImpl = directRpcStub(calls, {
        jsonrpc: "2.0",
        id: 1,
        result: { context: { slot: 450760044 }, value: LAMPORTS },
      });
      const { rpc } = loadRpc(label, src, { callFn, fetchImpl });
      const out = await rpc("getBalance", [ADDR, { commitment: "confirmed" }]);
      expect(out).toEqual({ context: { slot: 450760044 }, value: LAMPORTS });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://api.mainnet-beta.solana.com");
      expect(calls[0].body.method).toBe("getBalance");
      expect(calls[0].body.params[0]).toBe(ADDR);
    });

    it("falls back when the proxy throws outright", async () => {
      const calls = [];
      const callFn = async () => {
        throw new Error("proxy down");
      };
      const fetchImpl = directRpcStub(calls, {
        jsonrpc: "2.0",
        id: 1,
        result: { context: { slot: 1 }, value: LAMPORTS },
      });
      const { rpc } = loadRpc(label, src, { callFn, fetchImpl });
      const out = await rpc("getBalance", [ADDR]);
      expect(out.value).toBe(LAMPORTS);
      expect(calls).toHaveLength(1);
    });

    it("prefers the proxy when healthy and never touches public RPC", async () => {
      let fetchCalls = 0;
      const callFn = async () => ({
        success: true,
        data: { jsonrpc: "2.0", id: 1, result: { value: 999 } },
      });
      const fetchImpl = async () => {
        fetchCalls += 1;
        throw new Error("public RPC must not be called");
      };
      const { rpc } = loadRpc(label, src, { callFn, fetchImpl });
      const out = await rpc("getBalance", [ADDR]);
      expect(out).toEqual({ value: 999 });
      expect(fetchCalls).toBe(0);
    });

    it("still resolves null (never throws) when both paths fail", async () => {
      const callFn = async () => ({ success: false });
      const fetchImpl = async () => ({
        json: async () => ({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "down" } }),
      });
      const { rpc } = loadRpc(label, src, { callFn, fetchImpl });
      await expect(rpc("getBalance", [ADDR])).resolves.toBeNull();
    });
  });
}
