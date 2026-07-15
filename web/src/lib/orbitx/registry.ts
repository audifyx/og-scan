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
  lp_signature: string | null;
  mint_signature: string | null;
  metadata_uri: string | null;
  logo_url: string | null;
  is_vamp: boolean;
  fee_route: FeeRoute;
  cluster: string;
  created_at: string;
}

export type FeedKind = "new" | "graduated" | "all";

/** List launched tokens. `graduated` = tokens that have a live LP pool. */
export async function listTokens(kind: FeedKind = "new", limit = 60): Promise<OrbitxToken[]> {
  let q = supabase.from("orbitx_tokens").select("*").order("created_at", { ascending: false }).limit(limit);
  if (kind === "graduated") q = q.not("lp_pool_address", "is", null);
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

export interface RegisterTokenInput {
  mint_address: string; name: string; ticker: string; creator_wallet: string;
  decimals: number; supply: number; dex?: string | null; lp_pool_address?: string | null;
  lp_signature?: string | null; mint_signature?: string | null; metadata_uri?: string | null;
  logo_url?: string | null; is_vamp?: boolean; fee_route?: FeeRoute; cluster?: string;
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
