/* ══════════════════════════════════════════════════════════════
   DEX ads / boosts / listings — public read layer
   Mirrors the app's boot-without-env-vars rule (web/src/lib/supabase.ts):
   when Supabase is unconfigured every helper resolves to an empty
   result instead of throwing, so the DEX renders exactly as if no
   ad/boost/listing existed. No writes happen here — writes are
   admin-only and live in the DexAdsSection admin UI.
   Flow: admin saves ad + placement in the dashboard → this module
   queries dex_ad_placements joined to dex_ads (RLS already restricts
   the anon key to ACTIVE, in-window rows) → DexAdSlot renders the
   highest-priority row for its placement. No code change needed.
   ══════════════════════════════════════════════════════════════ */
import { supabase, SUPABASE_URL } from "@/lib/supabase";

export type DexPlacement = "home-top" | "home-feed" | "trending" | "token-detail";

export const DEX_PLACEMENTS: DexPlacement[] = ["home-top", "home-feed", "trending", "token-detail"];

export const PLACEMENT_META: Record<DexPlacement, { label: string; where: string }> = {
  "home-top": { label: "Home top", where: "Above the token list on Trade home" },
  "home-feed": { label: "Home feed", where: "Inline inside the Trade home feed" },
  trending: { label: "Trending", where: "Top of the Trending tab on Trade home" },
  "token-detail": { label: "Token detail", where: "On the token page, under the chart" },
};

export type DexBoostTier = "standard" | "premium" | "turbo";

export interface DexAd {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  target_type: "token" | "section" | "global";
  target_mint: string | null;
  target_section: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

export interface DexAdPlacementRow {
  id: string;
  ad_id: string;
  placement: DexPlacement;
  section: string | null;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  ad: DexAd | null;
}

export interface DexBoost {
  id: string;
  mint: string;
  tier: DexBoostTier;
  starts_at: string;
  ends_at: string | null;
  status: string;
}

export interface DexListing {
  id: string;
  mint: string;
  symbol: string | null;
  name: string | null;
  status: "pending" | "approved" | "rejected";
  listed_at: string | null;
  source: string;
}

export interface DexSavedFilter {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
}

const PLACEMENT_SELECT =
  "id, ad_id, placement, section, priority, starts_at, ends_at, active, ad:dex_ads(id, title, body, image_url, link_url, target_type, target_mint, target_section, status, starts_at, ends_at)";

/** False when the deployment has no Supabase env vars — read layer stays silent. */
export function isDexAdsConfigured(): boolean {
  return Boolean(SUPABASE_URL);
}

function inWindow(row: { starts_at: string | null; ends_at: string | null }): boolean {
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false;
  return true;
}

/**
 * Highest-priority ACTIVE ad for a placement. When `mint` is given
 * (token-detail slot), an ad targeted at that mint wins over a generic
 * one; otherwise the top-priority row wins. Returns null when nothing
 * is live — the slot then renders nothing.
 */
export async function getActiveAdForPlacement(
  placement: DexPlacement,
  mint?: string,
): Promise<DexAd | null> {
  if (!isDexAdsConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from("dex_ad_placements")
      .select(PLACEMENT_SELECT)
      .eq("placement", placement)
      .eq("active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    if (error || !data) return null;
    const rows = (data as unknown as DexAdPlacementRow[]).filter(
      (r) => r.ad && r.ad.status === "active" && inWindow(r) && inWindow(r.ad),
    );
    if (!rows.length) return null;
    if (mint) {
      const targeted = rows.find((r) => r.ad?.target_type === "token" && r.ad.target_mint === mint);
      if (targeted?.ad) return targeted.ad;
    }
    return rows[0].ad;
  } catch {
    return null;
  }
}

/** Active boost for one mint, or null. */
export async function getBoostForMint(mint: string): Promise<DexBoost | null> {
  if (!isDexAdsConfigured() || !mint) return null;
  try {
    const { data, error } = await supabase
      .from("dex_boosts")
      .select("id, mint, tier, starts_at, ends_at, status")
      .eq("mint", mint)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as DexBoost;
    return inWindow(row) ? row : null;
  } catch {
    return null;
  }
}

/** Active boosts for a batch of mints, keyed by mint. */
export async function getBoostsForMints(mints: string[]): Promise<Record<string, DexBoost>> {
  if (!isDexAdsConfigured() || !mints.length) return {};
  try {
    const { data, error } = await supabase
      .from("dex_boosts")
      .select("id, mint, tier, starts_at, ends_at, status")
      .in("mint", mints)
      .eq("status", "active");
    if (error || !data) return {};
    const out: Record<string, DexBoost> = {};
    for (const row of data as DexBoost[]) {
      if (inWindow(row) && !out[row.mint]) out[row.mint] = row;
    }
    return out;
  } catch {
    return {};
  }
}

/** Approved listings, newest first (public storefront read). */
export async function listActiveListings(limit = 100): Promise<DexListing[]> {
  if (!isDexAdsConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from("dex_listings")
      .select("id, mint, symbol, name, status, listed_at, source")
      .eq("status", "approved")
      .order("listed_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as DexListing[];
  } catch {
    return [];
  }
}

/** The signed-in user's own saved DEX filters (empty when signed out). */
export async function listMySavedFilters(): Promise<DexSavedFilter[]> {
  if (!isDexAdsConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from("dex_saved_filters")
      .select("id, user_id, name, filters, is_default, created_at")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as DexSavedFilter[];
  } catch {
    return [];
  }
}
