/**
 * OrbitX City — property deed API (Node (req, res) handler).
 *
 * Validates the player's on-chain payment, then writes city_properties with
 * the service role. The client never holds the service key.
 *
 * POST /api/city-property
 *   { action: "buy",          buildingKey, wallet, signature }
 *   { action: "buyFromOwner", buildingKey, wallet, signature }
 *   { action: "list",         buildingKey, wallet, priceOrbitx, messageB64, sigB64 }
 *   { action: "unlist",       buildingKey, wallet, messageB64, sigB64 }
 *
 * Env (Vercel, Production + Preview):
 *   CITY_SUPABASE_SERVICE_KEY — service_role key for the city project (server only)
 *   CITY_SUPABASE_URL         — defaults to the city project
 *   SOLANA_RPC_URL            — defaults to mainnet-beta
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const CITY_DB_URL =
  process.env.CITY_SUPABASE_URL || "https://rhqvtqygrjmcuggftrtu.supabase.co";
const SERVICE_KEY = process.env.CITY_SUPABASE_SERVICE_KEY || "";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const UI_EPS = 1e-6;

/* ── supabase (service role) ─────────────────────────────────────────── */

async function sb(path, { method = "GET", body } = {}) {
  if (!SERVICE_KEY) throw new Error("CITY_SUPABASE_SERVICE_KEY is not configured.");
  const r = await fetch(`${CITY_DB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`DB error (${r.status}): ${JSON.stringify(data)}`);
  return data;
}

const getRow = (key) =>
  sb(`city_properties?building_key=eq.${encodeURIComponent(key)}&select=*`).then((d) => d?.[0] ?? null);

const sigUsed = (sig) =>
  sb(`city_properties?tx_sig=eq.${encodeURIComponent(sig)}&select=id`).then((d) => (d?.length ?? 0) > 0);

const patchRow = (key, patch) =>
  sb(`city_properties?building_key=eq.${encodeURIComponent(key)}`, { method: "PATCH", body: patch }).then(
    (d) => d?.[0] ?? null
  );

/* ── on-chain validation ─────────────────────────────────────────────── */

function connection() {
  return new Connection(RPC_URL, "confirmed");
}

async function parsedTx(signature) {
  const tx = await connection().getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) throw new Error("Transaction not found on-chain — wait for confirmation and retry.");
  if (tx.meta?.err) throw new Error("Transaction failed on-chain.");
  return tx;
}

function allInstructions(tx) {
  const top = tx.transaction.message.instructions ?? [];
  const inner = (tx.meta?.innerInstructions ?? []).flatMap((g) => g.instructions ?? []);
  return [...top, ...inner];
}

function feePayer(tx) {
  const k = tx.transaction.message.accountKeys?.[0];
  return typeof k === "string" ? k : k?.pubkey?.toString?.() ?? "";
}

const uiAmount = (info) => Number(info.uiAmountString ?? info.uiAmount ?? NaN);

function findBurn(ixs, { mint, authority, ui }) {
  return ixs.some(
    (ix) =>
      ix.program === "spl-token" &&
      ix.parsed?.type === "burn" &&
      ix.parsed.info.mint === mint &&
      ix.parsed.info.authority === authority &&
      Math.abs(uiAmount(ix.parsed.info) - ui) < UI_EPS
  );
}

function findTransfer(ixs, { source, destination, authority, ui }) {
  return ixs.some(
    (ix) =>
      ix.program === "spl-token" &&
      (ix.parsed?.type === "transfer" || ix.parsed?.type === "transferChecked") &&
      ix.parsed.info.source === source &&
      ix.parsed.info.destination === destination &&
      ix.parsed.info.authority === authority &&
      Math.abs(uiAmount(ix.parsed.info) - ui) < UI_EPS
  );
}

/* ── ed25519 message verification (list / unlist) ─────────────────────── */

async function verifyWalletMessage(walletB58, messageB64, sigB64) {
  const pub = new PublicKey(walletB58).toBytes();
  const msg = Buffer.from(messageB64, "base64");
  const sig = Buffer.from(sigB64, "base64");
  if (sig.length !== 64 || msg.length === 0 || msg.length > 512) return false;
  const key = await globalThis.crypto.subtle.importKey("raw", pub, { name: "Ed25519" }, false, [
    "verify",
  ]);
  return globalThis.crypto.subtle.verify({ name: "Ed25519" }, key, sig, msg);
}

/* ── handlers ────────────────────────────────────────────────────────── */

async function handleBuy({ buildingKey, wallet, signature }) {
  const row = await getRow(buildingKey);
  if (!row) throw new Error(`Unknown property: ${buildingKey}`);
  if (!row.for_sale) throw new Error(`${row.label} is not for sale.`);
  if (row.owner_wallet) throw new Error("This property already has an owner — use buyFromOwner.");
  if (await sigUsed(signature)) throw new Error("This signature was already used for a deed.");

  const tx = await parsedTx(signature);
  if (feePayer(tx) !== wallet) throw new Error("Signature fee payer does not match the buyer.");
  const ixs = allInstructions(tx);
  if (!findBurn(ixs, { mint: ORBITX_MINT, authority: wallet, ui: Number(row.price_orbitx) })) {
    throw new Error("No matching ORBITX burn found in this transaction.");
  }
  return patchRow(buildingKey, {
    owner_wallet: wallet,
    tx_sig: signature,
    for_sale: false,
    bought_at: new Date().toISOString(),
  });
}

async function handleBuyFromOwner({ buildingKey, wallet, signature }) {
  const row = await getRow(buildingKey);
  if (!row) throw new Error(`Unknown property: ${buildingKey}`);
  if (!row.for_sale || !row.owner_wallet) throw new Error(`${row.label} is not on the market.`);
  if (row.owner_wallet === wallet) throw new Error("You already own this property.");
  if (await sigUsed(signature)) throw new Error("This signature was already used for a deed.");

  const tx = await parsedTx(signature);
  if (feePayer(tx) !== wallet) throw new Error("Signature fee payer does not match the buyer.");
  const mint = new PublicKey(ORBITX_MINT);
  const buyerAta = (await getAssociatedTokenAddress(mint, new PublicKey(wallet))).toBase58();
  const ownerAta = (await getAssociatedTokenAddress(mint, new PublicKey(row.owner_wallet))).toBase58();
  const ixs = allInstructions(tx);
  const price = Number(row.price_orbitx);
  const toOwner = (price * 95) / 100;
  const toBurn = price - toOwner;
  if (!findTransfer(ixs, { source: buyerAta, destination: ownerAta, authority: wallet, ui: toOwner })) {
    throw new Error("No matching 95% ORBITX payment to the owner in this transaction.");
  }
  if (!findBurn(ixs, { mint: ORBITX_MINT, authority: wallet, ui: toBurn })) {
    throw new Error("No matching 5% ORBITX city-tax burn in this transaction.");
  }
  return patchRow(buildingKey, {
    owner_wallet: wallet,
    tx_sig: signature,
    for_sale: false,
    bought_at: new Date().toISOString(),
  });
}

async function handleList({ buildingKey, wallet, priceOrbitx, messageB64, sigB64 }) {
  const row = await getRow(buildingKey);
  if (!row) throw new Error(`Unknown property: ${buildingKey}`);
  if (row.owner_wallet !== wallet) throw new Error("Only the recorded owner can list this property.");
  const price = Math.floor(Number(priceOrbitx));
  if (!Number.isFinite(price) || price < 1000 || price > 10_000_000) {
    throw new Error("List price must be between 1,000 and 10,000,000 ORBITX.");
  }
  const msgText = Buffer.from(messageB64, "base64").toString("utf8");
  if (!msgText.includes(`key: ${buildingKey}`) || !msgText.includes("list property")) {
    throw new Error("Signed message does not match this listing.");
  }
  if (!(await verifyWalletMessage(wallet, messageB64, sigB64))) {
    throw new Error("Wallet signature verification failed.");
  }
  return patchRow(buildingKey, { for_sale: true, price_orbitx: price });
}

async function handleUnlist({ buildingKey, wallet, messageB64, sigB64 }) {
  const row = await getRow(buildingKey);
  if (!row) throw new Error(`Unknown property: ${buildingKey}`);
  if (row.owner_wallet !== wallet) throw new Error("Only the recorded owner can delist this property.");
  const msgText = Buffer.from(messageB64, "base64").toString("utf8");
  if (!msgText.includes(`key: ${buildingKey}`) || !msgText.includes("delist property")) {
    throw new Error("Signed message does not match this delisting.");
  }
  if (!(await verifyWalletMessage(wallet, messageB64, sigB64))) {
    throw new Error("Wallet signature verification failed.");
  }
  return patchRow(buildingKey, { for_sale: false });
}

/* ── entry ───────────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "POST only" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action } = body;
    let row;
    if (action === "buy") row = await handleBuy(body);
    else if (action === "buyFromOwner") row = await handleBuyFromOwner(body);
    else if (action === "list") row = await handleList(body);
    else if (action === "unlist") row = await handleUnlist(body);
    else throw new Error(`Unknown action: ${action}`);
    res.status(200).json({ ok: true, row });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : "Deed API error" });
  }
}
