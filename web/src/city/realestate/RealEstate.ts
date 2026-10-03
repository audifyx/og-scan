/**
 * OrbitX City — Real Estate: on-chain property registry + buy/sell engine.
 *
 * Flow:
 *  - Primary purchase (unowned, city-listed): the buyer BURNS `price` ORBITX
 *    from their own wallet (real user-signed SPL burn, hub wallet popup),
 *    then POSTs the signature to /api/city-property which validates the burn
 *    on-chain and records the deed in Supabase (service role).
 *  - Secondary purchase (owned, for_sale): one user-signed transaction with
 *    TWO instructions — 95% ORBITX transfer to the current owner + 5% burned
 *    as the city tax — then the API validates both instructions on-chain and
 *    transfers the deed.
 *  - Listing / unlisting: the owner signs a short message with their wallet;
 *    the API verifies the ed25519 signature against the recorded owner.
 *
 * Real transactions only. If the wallet is not connected, callers must show
 * "Connect wallet" — never a fake deed.
 *
 * Supabase reads go through the city project (anon key, RLS public-read).
 * Writes go through /api/city-property (service role). The client never
 * holds the service key.
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createBurnInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ── constants ─────────────────────────────────────────────────────── */

/** Official ORBITX mint (same as OGSCAN_TOKEN_MINT in @/lib/og). */
export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

/** 5% of every secondary sale is burned as the city tax. */
export const CITY_TAX_BPS = 500;

/** Paper rent: owned buildings accrue this many CITY points per hour. */
export const RENT_CITY_PER_HOUR = 1;

export interface PropertyDef {
  key: string;
  label: string;
  /** Default city list price (whole ORBITX). DB price_orbitx is authoritative. */
  priceOrbitx: number;
}

/** Static registry — mirrors the seeded city_properties rows. */
export const PROPERTY_REGISTRY: PropertyDef[] = [
  { key: "mcorbits", label: "McOrbit's", priceOrbitx: 500_000 },
  { key: "wallorbit", label: "WallOrbit", priceOrbitx: 400_000 },
  { key: "hotel", label: "Grand Orbit Hotel", priceOrbitx: 350_000 },
  { key: "officetower2", label: "Meridian Tower II", priceOrbitx: 300_000 },
  { key: "burgerkhan", label: "Burger Khan", priceOrbitx: 200_000 },
  { key: "wendas", label: "Wenda's", priceOrbitx: 150_000 },
  { key: "bank", label: "OrbitX Bank", priceOrbitx: 150_000 },
  { key: "pizzashack", label: "Slice of Orbit Pizza", priceOrbitx: 75_000 },
  { key: "coffeeshop", label: "Cosmo Coffee", priceOrbitx: 60_000 },
  { key: "gasstation", label: "Solana Gas", priceOrbitx: 50_000 },
  { key: "laundromat", label: "SpinCycle Laundromat", priceOrbitx: 25_000 },
];

export function listProperties(): PropertyDef[] {
  return [...PROPERTY_REGISTRY];
}

export function getProperty(key: string): PropertyDef | undefined {
  return PROPERTY_REGISTRY.find((p) => p.key === key);
}

/** Short display form of a wallet address: 4x7f…9Q2m. */
export function shortWallet(addr: string): string {
  return addr && addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/* ── city DB client (anon, read-only) ───────────────────────────────── */

const CITY_DB_URL =
  (import.meta.env.VITE_CITY_SUPABASE_URL as string | undefined)?.trim() ||
  "https://rhqvtqygrjmcuggftrtu.supabase.co";
const CITY_DB_ANON =
  (import.meta.env.VITE_CITY_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";

let _db: SupabaseClient | null = null;

/** Anon Supabase client for the city project. Throws a clear error if the anon key is missing. */
export function cityDb(): SupabaseClient {
  if (!_db) {
    if (!CITY_DB_ANON) {
      throw new Error(
        "Real estate is offline: VITE_CITY_SUPABASE_ANON_KEY is not set on this deployment."
      );
    }
    _db = createClient(CITY_DB_URL, CITY_DB_ANON);
  }
  return _db;
}

export interface PropertyRow {
  id: string;
  building_key: string;
  label: string;
  owner_wallet: string | null;
  price_orbitx: number;
  for_sale: boolean;
  bought_at: string | null;
  tx_sig: string | null;
}

/** All property rows, most expensive first. */
export async function fetchProperties(): Promise<PropertyRow[]> {
  const { data, error } = await cityDb()
    .from("city_properties")
    .select("*")
    .order("price_orbitx", { ascending: false });
  if (error) throw new Error(`Property feed failed: ${error.message}`);
  return (data ?? []) as PropertyRow[];
}

/** Single property row, or null when the key is unknown. */
export async function fetchProperty(key: string): Promise<PropertyRow | null> {
  const { data, error } = await cityDb()
    .from("city_properties")
    .select("*")
    .eq("building_key", key)
    .maybeSingle();
  if (error) throw new Error(`Property lookup failed: ${error.message}`);
  return (data ?? null) as PropertyRow | null;
}

/* ── wallet surface (hub wallet, NOT wallet-adapter-react) ─────────── */

export interface ChainWallet {
  publicKey: PublicKey;
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

/* ── on-chain helpers ───────────────────────────────────────────────── */

async function orbitxDecimals(connection: Connection): Promise<number> {
  const info = await connection.getMint(new PublicKey(ORBITX_MINT));
  return info.decimals;
}

function toRaw(priceOrbitx: number, decimals: number): bigint {
  return BigInt(Math.round(priceOrbitx * 10 ** decimals));
}

async function requireOrbitxBalance(
  connection: Connection,
  ata: PublicKey,
  needRaw: bigint
): Promise<void> {
  let bal: bigint;
  try {
    const r = await connection.getTokenAccountBalance(ata);
    bal = BigInt(r.value.amount);
  } catch {
    throw new Error("No ORBITX token account found in this wallet — buy some ORBITX first.");
  }
  if (bal < needRaw) {
    throw new Error(
      `Insufficient ORBITX balance for this purchase (need ${(Number(needRaw) / 1e9).toFixed(2)} raw units).`
    );
  }
}

async function sendAndConfirm(
  connection: Connection,
  wallet: ChainWallet,
  tx: Transaction
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  const signature = await wallet.sendTransaction(tx, connection);
  const conf = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  if (conf.value.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(conf.value.err)}`);
  return signature;
}

async function postDeedApi(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/city-property", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: { ok: boolean; error?: string };
  try {
    data = await r.json();
  } catch {
    throw new Error(`Deed API returned HTTP ${r.status}`);
  }
  if (!r.ok || !data.ok) throw new Error(data.error || `Deed API rejected the purchase (${r.status})`);
  return data;
}

/* ── buy (primary: burn full price) ─────────────────────────────────── */

export interface BuyResult {
  signature: string;
  priceOrbitx: number;
  burnedOrbitx: number;
  kind: "primary" | "secondary";
  sellerWallet: string | null;
}

/**
 * Buy a for-sale property. Primary (city-owned): burns the full price.
 * Secondary (player-owned): transfers 95% to the owner, burns 5% city tax —
 * both in ONE user-signed transaction. Then the API validates the tx on-chain
 * and records the deed.
 */
export async function buyProperty(opts: {
  connection: Connection;
  wallet: ChainWallet;
  buildingKey: string;
}): Promise<BuyResult> {
  const { connection, wallet, buildingKey } = opts;
  if (!wallet.publicKey) throw new Error("Connect wallet");

  const row = await fetchProperty(buildingKey);
  if (!row) throw new Error(`Unknown property: ${buildingKey}`);
  if (!row.for_sale) throw new Error(`${row.label} is not for sale.`);
  const buyer = wallet.publicKey.toBase58();
  if (row.owner_wallet && row.owner_wallet === buyer) {
    throw new Error("You already own this property.");
  }

  const decimals = await orbitxDecimals(connection);
  const priceRaw = toRaw(row.price_orbitx, decimals);
  const mint = new PublicKey(ORBITX_MINT);
  const buyerAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
  await requireOrbitxBalance(connection, buyerAta, priceRaw);

  const tx = new Transaction();
  let seller: string | null = null;
  if (row.owner_wallet) {
    // Secondary: 95% to the seller, 5% burned as city tax (BigInt — no float dust).
    seller = row.owner_wallet;
    const sellerAta = await getAssociatedTokenAddress(mint, new PublicKey(seller));
    const acct = await connection.getAccountInfo(sellerAta);
    if (!acct) throw new Error("Seller has no ORBITX token account — sale cannot settle.");
    const toSeller = (priceRaw * BigInt(10000 - CITY_TAX_BPS)) / 10000n;
    const toBurn = priceRaw - toSeller;
    tx.add(
      createTransferInstruction(buyerAta, sellerAta, wallet.publicKey, toSeller, [], TOKEN_PROGRAM_ID)
    );
    tx.add(createBurnInstruction(buyerAta, mint, wallet.publicKey, toBurn, [], TOKEN_PROGRAM_ID));
  } else {
    // Primary: the full price is burned.
    tx.add(createBurnInstruction(buyerAta, mint, wallet.publicKey, priceRaw, [], TOKEN_PROGRAM_ID));
  }

  const signature = await sendAndConfirm(connection, wallet, tx);

  await postDeedApi({
    action: row.owner_wallet ? "buyFromOwner" : "buy",
    buildingKey,
    wallet: buyer,
    signature,
  });

  return {
    signature,
    priceOrbitx: row.price_orbitx,
    burnedOrbitx: row.owner_wallet ? row.price_orbitx * 0.05 : row.price_orbitx,
    kind: row.owner_wallet ? "secondary" : "primary",
    sellerWallet: seller,
  };
}

/* ── list / unlist (owner-signed message, API-verified) ─────────────── */

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function listMessage(buildingKey: string, priceOrbitx: number): string {
  return [
    "OrbitX City — list property for sale",
    `key: ${buildingKey}`,
    `price: ${priceOrbitx} ORBITX`,
    `nonce: ${Date.now()}`,
  ].join("\n");
}

/** Owner lists their property at a price (whole ORBITX). */
export async function listForSale(opts: {
  wallet: ChainWallet;
  buildingKey: string;
  priceOrbitx: number;
}): Promise<void> {
  const { wallet, buildingKey, priceOrbitx } = opts;
  if (!wallet.publicKey) throw new Error("Connect wallet");
  if (!wallet.signMessage) throw new Error("This wallet cannot sign messages.");
  if (!Number.isFinite(priceOrbitx) || priceOrbitx < 1000 || priceOrbitx > 10_000_000) {
    throw new Error("List price must be between 1,000 and 10,000,000 ORBITX.");
  }
  const message = listMessage(buildingKey, Math.floor(priceOrbitx));
  const sig = await wallet.signMessage(new TextEncoder().encode(message));
  await postDeedApi({
    action: "list",
    buildingKey,
    wallet: wallet.publicKey.toBase58(),
    priceOrbitx: Math.floor(priceOrbitx),
    messageB64: b64(new TextEncoder().encode(message)),
    sigB64: b64(sig),
  });
}

/** Owner takes their property off the market. */
export async function unlistProperty(opts: {
  wallet: ChainWallet;
  buildingKey: string;
}): Promise<void> {
  const { wallet, buildingKey } = opts;
  if (!wallet.publicKey) throw new Error("Connect wallet");
  if (!wallet.signMessage) throw new Error("This wallet cannot sign messages.");
  const message = [
    "OrbitX City — delist property",
    `key: ${buildingKey}`,
    `nonce: ${Date.now()}`,
  ].join("\n");
  const sig = await wallet.signMessage(new TextEncoder().encode(message));
  await postDeedApi({
    action: "unlist",
    buildingKey,
    wallet: wallet.publicKey.toBase58(),
    messageB64: b64(new TextEncoder().encode(message)),
    sigB64: b64(sig),
  });
}
