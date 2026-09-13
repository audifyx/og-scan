/**
 * OG DEX — token metadata reader for the (non-custodial) Metadata Editor.
 * Reads on-chain authority + mutability via Helius getAsset (through the rpc
 * proxy) so the client can verify the connected wallet is the token's update
 * authority before letting them edit. The actual update tx is built & signed
 * client-side in Phantom — this route only READS.
 */
import { callFn, send, cache } from "../_lib.js";

const SPL = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { method, params, id: 1, provider: "helius" });
  if (r && r.success && r.data) return r.data.result ?? null;
  return null;
}

export default async function handler(req, res) {
  cache(res, 5, 20);
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint");
  if (!mint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return send(res, 400, { ok: false, error: "invalid mint" });
  try {
    const a = await rpc("getAsset", { id: mint });
    if (!a) return send(res, 200, { ok: false, error: "token not found on-chain" });
    const content = a.content || {};
    const md = content.metadata || {};
    const links = content.links || {};
    const ti = a.token_info || {};
    const auths = Array.isArray(a.authorities) ? a.authorities : [];
    const full = auths.find((x) => Array.isArray(x.scopes) && x.scopes.includes("full")) || auths[0] || null;
    const updateAuthority = full?.address || null;
    const tokenProgram = ti.token_program || null;
    const isToken2022 = tokenProgram === T22;
    const isPumpFun = /pump$/i.test(mint) || /pump\.fun/i.test(content.json_uri || "") || auths.length === 0;

    // eligibility (the client still re-checks wallet === updateAuthority)
    let reason = null;
    if (isPumpFun) reason = "pumpfun";
    else if (!updateAuthority) reason = "no_authority";
    else if (a.mutable === false) reason = "immutable";
    else if (isToken2022) reason = "token2022";        // not yet supported by editor
    else if (tokenProgram && tokenProgram !== SPL) reason = "unsupported_program";

    return send(res, 200, {
      ok: true,
      mint,
      name: md.name || null,
      symbol: md.symbol || null,
      description: md.description || null,
      image: links.image || content.files?.[0]?.uri || null,
      uri: content.json_uri || null,
      updateAuthority,
      mutable: a.mutable !== false,
      tokenProgram, isToken2022, isPumpFun,
      standard: md.token_standard || a.interface || null,
      creators: Array.isArray(a.creators) ? a.creators.map((c) => ({ address: c.address, share: c.share || 0, verified: !!c.verified })) : [],
      sellerFeeBasisPoints: a.royalty?.basis_points ?? 0,
      // editableByAuthority means: an authority wallet COULD edit (no hard blockers).
      editableByAuthority: !reason,
      reason,
    });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}
