// Orbitx Launchpad — token registry client (anti-vamp backed).
// Talks to the same Supabase project the app already uses (ffjipnkhcebjvttliptb).
// Table `orbitx_tokens` enforces unique CA / name / ticker at the DB level and
// exposes an `orbitx_vamp_check` RPC for look-alike (vamp) detection.
import { supabase } from "@/lib/supabase";

export type FeeRoute = "creator" | "orbitx_buyback" | "og";

export interface OrbitxToken {
  id: string;
  mint_address: string;
  name: string;
  ticker: string;
  creator_wallet: string;
  decimals: number;
  supply: number;
  dex: string | null;
  lp_pool_address: string | null;
  graduated_at: string | null;
  lp_signature: string | null;
  mint_signature: string | null;
  metadata_uri: string | null;
  logo_url: string | null;
  is_vamp: boolean;
  fee_route: FeeRoute;
  cluster: string;
  launch_type: "custom" | "pump";
  created_at: string;
}

export type FeedKind = "new" | "graduated" | "all";

/** List launched tokens. `graduated` = tokens that have a live LP pool. */
export async function listTokens(kind: FeedKind = "new", limit = 60): Promise<OrbitxToken[]> {
  let q = supabase.from("orbitx_tokens").select("*").order("created_at", { ascending: false }).limit(limit);
  if (kind === "graduated") q = q.not("lp_pool_address", "is", null);
  // Hide Orbitx Pro token
  q = q.neq("mint_address", "wmo3LPaLuaqZZVngh7YLDugMTBGYRKz14QzWvmKaarc");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as OrbitxToken[];
}

export async function getToken(mint: string): Promise<OrbitxToken | null> {
  const { data, error } = await supabase.from("orbitx_tokens").select("*").eq("mint_address", mint).maybeSingle();
  if (error) throw error;
  return (data as OrbitxToken) ?? null;
}

export async function listByCreator(wallet: string, limit = 60): Promise<OrbitxToken[]> {
  const { data, error } = await supabase
    .from("orbitx_tokens").select("*").eq("creator_wallet", wallet)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as OrbitxToken[];
}

export interface VampMatch {
  id: string; name: string; ticker: string; mint_address: string; is_vamp: boolean; sim: number;
}

/**
 * Anti-vamp pre-check. Returns look-alike existing tokens for a proposed
 * name/ticker (leetspeak-normalized exact match OR trigram similarity).
 * A returned row with sim >= 0.85 (or an exact normalized hit) is a hard clone.
 */
export async function vampCheck(name: string, ticker: string): Promise<VampMatch[]> {
  const { data, error } = await supabase.rpc("orbitx_vamp_check", { p_name: name, p_ticker: ticker });
  if (error) throw error;
  return (data ?? []) as VampMatch[];
}

/**
 * Comprehensive name duplication check across all major token sources.
 * Scans pump.fun, DexScreener, OG Scanner, and our registry.
 * Returns true if name exists anywhere, false if name is original.
 */
export async function isNameTaken(name: string): Promise<boolean> {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;

  try {
    // 1. Check our orbitx_tokens registry
    const { data: orbitxData, error: orbitxErr } = await supabase
      .from("orbitx_tokens")
      .select("id")
      .ilike("name", trimmed)
      .limit(1);
    if (!orbitxErr && orbitxData && orbitxData.length > 0) return true;

    // 2. Check pump.fun (search by name in their API)
    try {
      const pumpRes = await fetch(`https://api.pump.fun/search?q=${encodeURIComponent(trimmed)}`);
      if (pumpRes.ok) {
        const pumpData = await pumpRes.json();
        if (Array.isArray(pumpData) && pumpData.some((t: any) => t.name?.toLowerCase() === trimmed)) {
          return true;
        }
      }
    } catch (e) {
      console.error("pump.fun check failed:", e);
    }

    // 3. Check DexScreener for tokens with matching name
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(trimmed)}`);
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        if (dexData.pairs && dexData.pairs.some((p: any) => p.baseToken?.name?.toLowerCase() === trimmed)) {
          return true;
        }
      }
    } catch (e) {
      console.error("DexScreener check failed:", e);
    }

    // 4. Check OG Scanner API
    try {
      const ogRes = await fetch(`/api/ogdex/_routes/search.js?q=${encodeURIComponent(trimmed)}`);
      if (ogRes.ok) {
        const ogData = await ogRes.json();
        if (Array.isArray(ogData) && ogData.some((t: any) => t.name?.toLowerCase() === trimmed)) {
          return true;
        }
      }
    } catch (e) {
      console.error("OG Scanner check failed:", e);
    }

    return false;
  } catch (err) {
    console.error("Comprehensive name check failed:", err);
    // On error, assume name is taken to be safe (don't let duplicates through)
    return true;
  }
}

export interface AntiVampSourceMatch { source: "orbitx" | "pumpfun" | "dexscreener"; name: string; ticker: string; sim: number }
export interface AntiVampResult {
  blocked: boolean;
  flagged: boolean;
  hardMatch: { name: string; ticker: string; source: string } | null;
  matches: AntiVampSourceMatch[];
  message?: string;
}

/**
 * Unified OrbitX Anti-Vamp check — the single source of truth used by both
 * the pump.fun lane and the custom SPL lane, live (debounced, as-you-type)
 * and again right before any fee/on-chain action. Runs server-side (Vercel
 * function) so the pump.fun / DexScreener cross-checks aren't dropped by
 * browser CORS — scans OrbitX's own registry AND pump.fun AND DexScreener
 * (i.e. effectively all Solana tokens with any market presence), not just
 * tokens launched through OrbitX. `blocked` must hard-stop the launch;
 * `flagged` (soft match) still allows launch but routes creator fees to the
 * OBX buyback wallet. On a network/server failure the endpoint fails CLOSED
 * (blocked: true) — an unverifiable name must never be allowed to launch.
 */
export async function checkAntiVamp(name: string, ticker: string): Promise<AntiVampResult> {
  const res = await fetch("/api/orbitx/anti-vamp-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ticker }),
  });
  if (!res.ok) {
    return { blocked: true, flagged: true, hardMatch: null, matches: [], message: "Originality verification failed — please try again." };
  }
  return (await res.json()) as AntiVampResult;
}

export interface RegisterTokenInput {
  mint_address: string; name: string; ticker: string; creator_wallet: string;
  decimals: number; supply: number; dex?: string | null; lp_pool_address?: string | null;
  lp_signature?: string | null; mint_signature?: string | null; metadata_uri?: string | null;
  logo_url?: string | null; is_vamp?: boolean; fee_route?: FeeRoute; cluster?: string; launch_type?: "custom" | "pump";
}

/**
 * Register a launched token. The DB unique indexes on mint / normalized name /
 * normalized ticker are the final backstop: a duplicate throws a unique-violation
 * (Postgres code 23505), which is surfaced as a friendly "already taken" error.
 */
export async function registerToken(input: RegisterTokenInput): Promise<OrbitxToken> {
  const { data, error } = await supabase.from("orbitx_tokens").insert(input).select("*").single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("That name, ticker, or contract address is already taken — pick a unique one (anti-vamp).");
    }
    throw error;
  }
  return data as OrbitxToken;
}

/**
 * Permanently mark a token graduated once its market cap first reaches the
 * graduation threshold. Sticky: graduated_at never clears, even if the market
 * cap later falls. Best-effort and idempotent — safe to call repeatedly.
 */
export async function markGraduated(mint: string): Promise<void> {
  const { error } = await supabase.rpc("orbitx_mark_graduated", { p_mint: mint });
  if (error) console.error("markGraduated failed:", error);
}


/* ─────────────────────── wallet profiles ─────────────────────── */

export interface OrbitxProfile {
  wallet: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  twitter: string | null;
  website: string | null;
}

/** Fetch one wallet profile. Fails soft (returns null) if the table isn't set up yet. */
export async function getProfile(wallet: string): Promise<OrbitxProfile | null> {
  try {
    const { data, error } = await supabase.from("orbitx_profiles").select("*").eq("wallet", wallet).maybeSingle();
    if (error) return null;
    return (data as OrbitxProfile) ?? null;
  } catch {
    return null;
  }
}

/** Batch-fetch profiles keyed by wallet. Fails soft to an empty map. */
export async function getProfiles(wallets: string[]): Promise<Record<string, OrbitxProfile>> {
  if (!wallets.length) return {};
  try {
    const { data, error } = await supabase.from("orbitx_profiles").select("*").in("wallet", wallets);
    if (error || !data) return {};
    const map: Record<string, OrbitxProfile> = {};
    (data as OrbitxProfile[]).forEach((p) => { map[p.wallet] = p; });
    return map;
  } catch {
    return {};
  }
}

/** Create/update the connected wallet's profile via the upsert RPC. */
export async function upsertProfile(p: Partial<OrbitxProfile> & { wallet: string }): Promise<void> {
  const { error } = await supabase.rpc("orbitx_upsert_profile", {
    p_wallet: p.wallet,
    p_username: p.username ?? null,
    p_display_name: p.display_name ?? null,
    p_bio: p.bio ?? null,
    p_avatar_url: p.avatar_url ?? null,
    p_banner_url: p.banner_url ?? null,
    p_twitter: p.twitter ?? null,
    p_website: p.website ?? null,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new Error("That username is already taken.");
    throw error;
  }
}
