/**
 * OrbitX City — Real Estate: on-chain property registry + buy/sell engine.
 *
 * Flow (desk wallet, backend-signed — no Phantom / injected wallets):
 *  - Primary purchase (unowned, city-listed): the buyer BURNS `price` ORBITX
 *    from their in-app (desk) wallet via orbitx_app_burn (backend signs, no
 *    popup), then POSTs the signature to /api/city-property which validates
 *    the burn on-chain and records the deed in Supabase (service role).
 *  - Secondary purchase (owned, for_sale): NOT supported from the desk
 *    wallet — it needs a direct 95% ORBITX transfer to the seller plus a 5%
 *    burn in one transaction, and the backend exposes no transfer signer.
 *    Callers must show the honest "not supported yet" state, never a fake.
 *  - Listing / unlisting: the owner signs a short message with their wallet;
 *    the desk wallet cannot sign messages, so these are honestly disabled
 *    until a backend signing path exists.
 *
 * Real transactions only. If the wallet is not linked, callers must show
 * "Link in-app wallet" — never a fake deed.
 *
 * Supabase reads go through the city project (anon key, RLS public-read).
 * Writes go through /api/city-property (service role). The client never
 * holds the service key.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { burnOrbitxViaDesk } from "@/tokenomics/mcpClient";

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

/* ── desk-wallet surface (in-app wallet, backend-signed) ────────────── */

export interface DeskWallet {
  /** Desk wallet address (billing.wallet). */
  address: string;
  /** Billing authCode (getBillingAuthCode()). */
  authCode: string;
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
 * Buy a for-sale property with the in-app (desk) wallet.
 * Primary (city-owned): burns the full price via the backend-signed
 * orbitx_app_burn, then the API validates the burn on-chain and records
 * the deed. Secondary (player-owned) is honestly unsupported — it needs a
 * direct ORBITX transfer to the seller that the desk wallet cannot sign.
 */
export async function buyProperty(opts: {
  wallet: DeskWallet;
  buildingKey: string;
}): Promise<BuyResult> {
  const { wallet, buildingKey } = opts;
  if (!wallet.address || !wallet.authCode) throw new Error("Link in-app wallet");

  const row = await fetchProperty(buildingKey);
  if (!row) throw new Error(`Unknown property: ${buildingKey}`);
  if (!row.for_sale) throw new Error(`${row.label} is not for sale.`);
  if (row.owner_wallet && row.owner_wallet === wallet.address) {
    throw new Error("You already own this property.");
  }
  if (row.owner_wallet) {
    throw new Error(
      "Player resales aren't supported from the in-app wallet yet — they need a direct " +
        "ORBITX transfer to the seller that the desk wallet can't sign. City-owned deeds work."
    );
  }

  const price = Math.floor(Number(row.price_orbitx));
  if (!Number.isFinite(price) || price <= 0) throw new Error("This property has no valid price.");

  // Primary: the full price is burned from the desk wallet (backend signs).
  const burn = await burnOrbitxViaDesk({ authCode: wallet.authCode, amount: price });
  if (!burn.ok || !burn.signature) {
    throw new Error(burn.message || burn.error || "ORBITX burn failed.");
  }

  await postDeedApi({
    action: "buy",
    buildingKey,
    wallet: wallet.address,
    signature: burn.signature,
  });

  return {
    signature: burn.signature,
    priceOrbitx: row.price_orbitx,
    burnedOrbitx: row.price_orbitx,
    kind: "primary",
    sellerWallet: null,
  };
}

/* ── list / unlist (honestly disabled: desk wallet can't sign messages) ── */

/**
 * Owner lists their property at a price (whole ORBITX).
 * DISABLED: listing needs an owner-signed message and the desk wallet has
 * no message-signing path. Throws a clear error instead of a fake listing.
 */
export async function listForSale(_opts: {
  wallet: DeskWallet;
  buildingKey: string;
  priceOrbitx: number;
}): Promise<void> {
  throw new Error(
    "Listing isn't supported from the in-app wallet yet — it needs a message signature " +
      "the desk wallet can't produce. Your owned buildings stay yours."
  );
}

/**
 * Owner takes their property off the market.
 * DISABLED: same message-signing limitation as listForSale.
 */
export async function unlistProperty(_opts: {
  wallet: DeskWallet;
  buildingKey: string;
}): Promise<void> {
  throw new Error(
    "Delisting isn't supported from the in-app wallet yet — it needs a message signature " +
      "the desk wallet can't produce."
  );
}
