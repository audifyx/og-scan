// OG DEX — wallet balance for the trade panel: SOL balance + a specific token's
// holding (so sells are based on what the user actually holds).
import { send, callFn, cache } from "../_lib.js";

const isPubkey = (v) => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { method, params, id: 1, provider: "helius" });
  return r?.data?.result ?? r?.result ?? null;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const owner = url.searchParams.get("owner") || url.searchParams.get("address") || "";
  const mint = url.searchParams.get("mint") || "";
  if (!isPubkey(owner)) return send(res, 400, { ok: false, error: "invalid owner" });
  cache(res, 5, 15);
  try {
    const [bal, accts] = await Promise.all([
      rpc("getBalance", [owner]).catch(() => null),
      isPubkey(mint) ? rpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]).catch(() => null) : Promise.resolve(null),
    ]);
    const sol = bal && bal.value != null ? Number(bal.value) / 1e9 : 0;
    let uiAmount = 0, decimals = 0, raw = "0";
    if (accts?.value?.length) {
      let total = 0n;
      for (const a of accts.value) {
        const ta = a.account?.data?.parsed?.info?.tokenAmount;
        if (ta) { total += BigInt(ta.amount || "0"); decimals = Number(ta.decimals) || decimals; uiAmount += Number(ta.uiAmount || 0); }
      }
      raw = total.toString();
    }
    return send(res, 200, { ok: true, owner, sol, token: { uiAmount, decimals, raw } });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e), sol: 0, token: { uiAmount: 0, decimals: 0, raw: "0" } });
  }
}
