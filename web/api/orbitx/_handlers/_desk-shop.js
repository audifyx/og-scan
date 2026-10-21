/**
 * OrbitX desk shop — Jupiter buy $ORBITX + 90% burn + memo in the same tx.
 * Catalog matches the Solana-betting /shop SKUs.
 *
 * GET  /api/orbitx/shop
 * POST /api/orbitx/shop/prepare  { wallet, sku, mint? }
 * POST /api/orbitx/shop          { wallet, sku, signature, mint, name, ticker, details }
 */

import {
  ORBITX_MINT,
  ORBITX_SHOP_CATEGORIES,
  ORBITX_SHOP_GC,
  ORBITX_SHOP_SKUS,
  SHOP_BURN_BPS,
  formatShopTeamMessage,
  getShopSku,
  shopMemo,
  usdToShopSol,
} from "../../../src/lib/orbitx/desk-shop-catalog.js";
import { fetchSolUsdPrice } from "./_buy-orbitx.js";

const SOL = "So11111111111111111111111111111111111111112";
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const JUP = "https://lite-api.jup.ag";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPA = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ibojtmeqgzabgeiwbvhf.supabase.co";

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "") ||
    process.env.VITE_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

async function rpc(method, params) {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc_error");
  return j.result;
}

function isPubkey(v) {
  return typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());
}

async function sb(path, init = {}) {
  if (!SRK) return null;
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text.slice(0, 240) || `supabase ${r.status}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function attachMemoAndBurn(txB64, { owner, mint, burnRaw, memo }) {
  const {
    PublicKey,
    VersionedTransaction,
    TransactionMessage,
    AddressLookupTableAccount,
    TransactionInstruction,
  } = await import("@solana/web3.js");
  const {
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    createBurnInstruction,
  } = await import("@solana/spl-token");

  const raw = Buffer.from(txB64, "base64");
  const tx = VersionedTransaction.deserialize(raw);
  const lookups = tx.message.addressTableLookups || [];
  const altAccounts = [];
  for (const lu of lookups) {
    const key = lu.accountKey.toBase58?.() || String(lu.accountKey);
    const acc = await rpc("getAccountInfo", [key, { encoding: "base64" }]);
    const b64 = acc?.value?.data?.[0];
    if (!b64) continue;
    const data = Buffer.from(b64, "base64");
    altAccounts.push(
      new AddressLookupTableAccount({
        key: new PublicKey(key),
        state: AddressLookupTableAccount.deserialize(data),
      }),
    );
  }

  const decompiled = TransactionMessage.decompile(tx.message, {
    addressLookupTableAccounts: altAccounts,
  });
  const ownerPk = new PublicKey(owner);
  const mintPk = new PublicKey(mint);
  const ata = getAssociatedTokenAddressSync(mintPk, ownerPk, false, TOKEN_2022_PROGRAM_ID);
  const memoIx = new TransactionInstruction({
    keys: [{ pubkey: ownerPk, isSigner: true, isWritable: false }],
    programId: new PublicKey(MEMO_PROGRAM),
    data: Buffer.from(String(memo || ""), "utf8"),
  });
  decompiled.instructions = [
    ...decompiled.instructions,
    createAssociatedTokenAccountIdempotentInstruction(ownerPk, ata, ownerPk, mintPk, TOKEN_2022_PROGRAM_ID),
    memoIx,
    createBurnInstruction(ata, mintPk, ownerPk, BigInt(burnRaw), [], TOKEN_2022_PROGRAM_ID),
  ];
  const compiled = decompiled.compileToV0Message(altAccounts);
  const next = new VersionedTransaction(compiled);
  return Buffer.from(next.serialize()).toString("base64");
}

export async function prepareDeskShopBuy({ wallet, skuId, mint }) {
  const item = getShopSku(skuId);
  if (!item) {
    return { ok: false, error: "unknown_sku", message: "That shop item is not in the catalog." };
  }
  if (!isPubkey(wallet)) {
    return { ok: false, error: "wallet_required", message: "Connect Phantom to check out." };
  }
  if (item.needsMint && mint && !isPubkey(mint)) {
    return { ok: false, error: "mint_invalid", message: "Paste a valid contract address in the listing dock." };
  }
  if (item.needsMint && !mint) {
    return { ok: false, error: "mint_required", message: "Paste a CA in the listing dock to list or spotlight." };
  }

  const solUsd = await fetchSolUsdPrice();
  const sol = usdToShopSol(item.usd, solUsd);
  const lamports = Math.floor(sol * 1e9);
  if (lamports <= 0) {
    return { ok: false, error: "quote_failed", message: "Could not price this item in SOL." };
  }

  const quoteUrl = `${JUP}/swap/v1/quote?inputMint=${SOL}&outputMint=${ORBITX_MINT}&amount=${lamports}&slippageBps=150&restrictIntermediateTokens=true`;
  const quoteRes = await fetch(quoteUrl);
  const quote = await quoteRes.json().catch(() => ({}));
  if (!quoteRes.ok || !quote.outAmount) {
    return { ok: false, error: "no_route", message: "Jupiter could not quote $ORBITX for this checkout." };
  }

  const swapRes = await fetch(`${JUP}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      asLegacyTransaction: false,
      prioritizationFeeLamports: "auto",
    }),
  });
  const swap = await swapRes.json().catch(() => ({}));
  if (!swapRes.ok || !swap.swapTransaction) {
    return { ok: false, error: "swap_build_failed", message: swap.error || "Jupiter swap build failed." };
  }

  const out = BigInt(quote.otherAmountThreshold || quote.outAmount || "0");
  if (out <= 0n) {
    return { ok: false, error: "no_output", message: "Jupiter could not quote $ORBITX for this checkout." };
  }
  const burnRaw = out <= 100n ? out : (out * BigInt(SHOP_BURN_BPS)) / 100n;
  const memo = shopMemo(item.sku, item.needsMint && mint ? mint : wallet);
  let transaction;
  try {
    transaction = await attachMemoAndBurn(swap.swapTransaction, {
      owner: wallet,
      mint: ORBITX_MINT,
      burnRaw: burnRaw.toString(),
      memo,
    });
  } catch (e) {
    return {
      ok: false,
      error: "attach_burn_failed",
      message: e instanceof Error ? e.message : "Could not attach burn to the Jupiter swap.",
    };
  }

  return {
    ok: true,
    sku: item.sku,
    name: item.name,
    usd: item.usd,
    sol,
    solUsd: solUsd || 0,
    outAmount: quote.outAmount,
    burnRaw: burnRaw.toString(),
    orbitxBurned: Number(burnRaw) / 1e6,
    memo,
    mint: ORBITX_MINT,
    transaction,
    needsMint: Boolean(item.needsMint),
    requiresSignature: true,
    solscanToken: `https://solscan.io/token/${ORBITX_MINT}`,
    solscanAccount: `https://solscan.io/account/${wallet}`,
    message: `One Phantom sign buys $${item.usd} of $ORBITX and burns ${SHOP_BURN_BPS}% in the same tx.`,
  };
}

/**
 * Verify a claimed shop purchase ON-CHAIN (security fix 2026-10-21).
 * confirmDeskShopBuy used to trust the request body — any fake signature
 * string "unlocked" any SKU. Now the transaction itself must prove:
 * it landed successfully, the claiming wallet signed it, the wallet
 * actually spent ~the SKU's SOL amount, $ORBITX actually arrived, and
 * the burn actually happened in the same tx. One signature redeems once.
 */
async function verifyShopPurchaseTx({ signature, wallet, item, solUsd }) {
  const existing = await sb(
    `orbitx_shop_orders?signature=eq.${encodeURIComponent(signature)}&select=id&limit=1`,
  ).catch(() => null);
  if (Array.isArray(existing) && existing.length) {
    return { ok: false, error: "signature_already_used", message: "That transaction was already redeemed for an order." };
  }
  let tx;
  try {
    tx = await rpc("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
    ]);
  } catch {
    return { ok: false, error: "verification_unavailable", message: "Couldn't verify that transaction on-chain yet — wait a few seconds and confirm again." };
  }
  if (!tx) {
    return { ok: false, error: "tx_not_found", message: "That transaction isn't on-chain yet — wait for it to confirm, then confirm the purchase again." };
  }
  if (tx.meta?.err) {
    return { ok: false, error: "tx_failed", message: "That transaction failed on-chain." };
  }
  const keys = tx.transaction?.message?.accountKeys || [];
  const signer = keys.find((k) => k.signer)?.pubkey || keys[0]?.pubkey;
  if (signer !== wallet) {
    return { ok: false, error: "signer_mismatch", message: "That transaction wasn't signed by the claiming wallet." };
  }
  const wIdx = keys.findIndex((k) => k.pubkey === wallet);
  const pre = tx.meta?.preBalances || [];
  const post = tx.meta?.postBalances || [];
  const solSpent = wIdx >= 0 ? (pre[wIdx] - post[wIdx]) / 1e9 : 0;
  const expectedSol = usdToShopSol(item.usd, solUsd);
  if (!(solSpent >= expectedSol * 0.8)) {
    return { ok: false, error: "amount_too_small", message: `That transaction spent ${solSpent.toFixed(4)} SOL — a ${item.name} purchase needs about ${expectedSol.toFixed(4)} SOL of $ORBITX bought in one transaction.` };
  }
  const tokBal = (arr, owner) =>
    (arr || [])
      .filter((b) => b.mint === ORBITX_MINT && (!owner || b.owner === owner))
      .reduce((s, b) => s + Number(b.uiTokenAmount?.amount || 0), 0);
  const preTok = tx.meta?.preTokenBalances || [];
  const postTok = tx.meta?.postTokenBalances || [];
  const walletGainRaw = tokBal(postTok, wallet) - tokBal(preTok, wallet);
  if (!(walletGainRaw > 0)) {
    return { ok: false, error: "no_orbitx_received", message: "That transaction didn't deliver $ORBITX to the claiming wallet." };
  }
  // Burned tokens vanish from every account: the net ORBITX delta across
  // all accounts is negative by exactly the burned amount.
  const netDeltaRaw = tokBal(postTok, null) - tokBal(preTok, null);
  const burnedRaw = netDeltaRaw < 0 ? -netDeltaRaw : 0;
  if (!(burnedRaw >= walletGainRaw * 4)) {
    return { ok: false, error: "burn_not_found", message: "That transaction didn't burn $ORBITX the way a shop purchase must (90% burn in the same transaction)." };
  }
  return { ok: true, solSpent, orbitxBurned: burnedRaw / 1e6 };
}

export async function confirmDeskShopBuy(body) {
  const item = getShopSku(body.sku);
  if (!item) {
    return { ok: false, error: "unknown_sku", message: "That shop item is not in the catalog." };
  }
  const wallet = String(body.wallet || "").trim();
  const signature = String(body.signature || "").trim();
  if (!isPubkey(wallet) || signature.length < 64) {
    return { ok: false, error: "signature_required", message: "Sign the Jupiter buy-and-burn, then send the signature." };
  }

  const solUsd = (await fetchSolUsdPrice()) || 0;
  if (!solUsd) {
    return { ok: false, error: "verification_unavailable", message: "Price feed is unavailable — try confirming again in a moment." };
  }
  const verdict = await verifyShopPurchaseTx({ signature, wallet, item, solUsd });
  if (!verdict.ok) return verdict;
  const sol = verdict.solSpent;
  const orbitxBurned = verdict.orbitxBurned;
  const mint = item.needsMint ? String(body.mint || "").trim() : "";
  const name = String(body.name || "").trim();
  const ticker = String(body.ticker || "").trim().toUpperCase();
  const details = String(body.details || "").trim();

  const receipt = formatShopTeamMessage({
    usd: item.usd,
    sol,
    orbitxBurned: Number.isFinite(orbitxBurned) ? orbitxBurned : undefined,
    itemName: item.name,
    sku: item.sku,
    signature,
    mint,
    name,
    ticker,
    wallet,
    details,
  });

  let saved = false;
  try {
    await sb("orbitx_shop_orders", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify({
        wallet,
        sku: item.sku,
        item_name: item.name,
        usd: item.usd,
        sol,
        orbitx_burned: Number.isFinite(orbitxBurned) ? orbitxBurned : null,
        signature,
        mint: mint || null,
        project_name: name || null,
        ticker: ticker || null,
        project_details: details || null,
      }),
    });
    saved = true;
  } catch {
    saved = false;
  }

  return {
    ok: true,
    sku: item.sku,
    name: item.name,
    usd: item.usd,
    sol,
    signature,
    explorer: `https://solscan.io/tx/${signature}`,
    receipt,
    gc: ORBITX_SHOP_GC,
    saved,
    message: `${item.name} unlocked. Copy the note and send it to the OrbitX group.`,
  };
}

export async function listDeskShop({ wallet } = {}) {
  const solUsd = await fetchSolUsdPrice();
  let owned = [];
  if (wallet && isPubkey(wallet) && SRK) {
    try {
      owned = (await sb(`orbitx_shop_orders?wallet=eq.${encodeURIComponent(wallet)}&select=sku,signature,mint,created_at&order=created_at.desc&limit=80`)) || [];
    } catch {
      owned = [];
    }
  }
  return {
    ok: true,
    mint: ORBITX_MINT,
    burnBps: SHOP_BURN_BPS,
    solUsd: solUsd || 0,
    gc: ORBITX_SHOP_GC,
    categories: ORBITX_SHOP_CATEGORIES,
    count: ORBITX_SHOP_SKUS.length,
    items: ORBITX_SHOP_SKUS,
    owned,
  };
}

export async function handleDeskShop(req, res, parts, json) {
  const sub = parts[1] || "";
  if (req.method === "GET") {
    const u = new URL(req.url || "/", "http://x");
    const wallet = u.searchParams.get("wallet") || "";
    return json(res, await listDeskShop({ wallet }));
  }
  if (req.method !== "POST") {
    return json(res, { ok: false, error: "method_not_allowed" }, 405);
  }
  let body = {};
  if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    body = req.body;
  } else {
    const chunks = [];
    for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
  }
  if (sub === "prepare") {
    const out = await prepareDeskShopBuy({
      wallet: body.wallet || body.publicKey,
      skuId: body.sku || body.id || body.item,
      mint: body.mint,
    });
    return json(res, out, out.ok ? 200 : 400);
  }
  const out = await confirmDeskShopBuy(body);
  return json(res, out, out.ok ? 200 : 400);
}
