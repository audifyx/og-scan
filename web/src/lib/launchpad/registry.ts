import { supabase } from "@/lib/supabase";
import type { GraduationDest, LaunchStyle, LaunchType, MarketAmm, ResolverKind, RewardsTrack } from "./types";

export type PadLaunchRow = {
  mint: string;
  creator_wallet: string;
  creator_x?: string | null;
  launch_type: LaunchType;
  quote_mint: string;
  quote_symbol?: string | null;
  graduation_dest: GraduationDest;
  name?: string | null;
  symbol?: string | null;
  uri?: string | null;
  holder_rewards: boolean;
  bagwork: boolean;
  created_sig?: string | null;
  created_at?: string;
  launch_style?: LaunchStyle | null;
  rewards_track?: RewardsTrack | null;
  delay_open_unix?: number | null;
  anti_snipe_blocks?: number | null;
};

export async function indexPadLaunch(row: PadLaunchRow): Promise<void> {
  const { error } = await supabase.from("orbitx_pad_launches").upsert(row, { onConflict: "mint" });
  if (error) console.warn("[launchpad] pad launch index failed", error);
}

export async function listPadLaunches(limit = 80): Promise<PadLaunchRow[]> {
  const { data, error } = await supabase
    .from("orbitx_pad_launches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as PadLaunchRow[];
}

export async function getPadLaunch(mint: string): Promise<PadLaunchRow | null> {
  const { data, error } = await supabase.from("orbitx_pad_launches").select("*").eq("mint", mint).maybeSingle();
  if (error) return null;
  return (data as PadLaunchRow) ?? null;
}

export async function listRewardsBalances(owner: string) {
  const { data, error } = await supabase
    .from("orbitx_rewards_claims")
    .select("*")
    .eq("owner", owner)
    .order("claimed_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data ?? [];
}

export async function listRewardsPools() {
  const { data, error } = await supabase.from("orbitx_rewards_pools").select("*");
  if (error) return [];
  return data ?? [];
}

export async function listBounties(mint: string) {
  const { data, error } = await supabase
    .from("orbitx_bagwork_bounties")
    .select("*")
    .eq("mint", mint)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function insertBounty(row: {
  mint: string;
  title: string;
  reward_amount: number;
  reward_mint: string;
  created_by_wallet?: string;
}) {
  const { error } = await supabase.from("orbitx_bagwork_bounties").insert({
    ...row,
    status: "open",
  });
  if (error) throw error;
}

export async function submitBountyProof(id: string, proof_url: string, worker_wallet: string, worker_x?: string) {
  const { error } = await supabase
    .from("orbitx_bagwork_bounties")
    .update({ proof_url, worker_wallet, worker_x, status: "submitted" })
    .eq("id", id);
  if (error) throw error;
}

export async function approveBounty(id: string, payout_sig?: string) {
  const { error } = await supabase
    .from("orbitx_bagwork_bounties")
    .update({ status: "paid", payout_sig: payout_sig ?? null })
    .eq("id", id);
  if (error) throw error;
}

export async function listExtraPools(baseMint: string) {
  const { data, error } = await supabase.from("orbitx_extra_pools").select("*").eq("base_mint", baseMint);
  if (error) return [];
  return data ?? [];
}

export async function indexExtraPool(row: {
  base_mint: string;
  quote_mint: string;
  venue: "raydium_cpmm" | "meteora_dlmm";
  pool_pubkey: string;
  created_by?: string;
}) {
  const { error } = await supabase.from("orbitx_extra_pools").insert(row);
  if (error) throw error;
}

export async function linkWalletPubkey(userId: string, wallet: string): Promise<{ ok: true } | { ok: false; conflict: boolean; message: string }> {
  const { data: taken } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("wallet_pubkey", wallet)
    .maybeSingle();
  if (taken && taken.user_id !== userId) {
    return { ok: false, conflict: true, message: "This wallet is already linked to another X account." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ wallet_pubkey: wallet, wallet_linked_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return { ok: false, conflict: false, message: error.message };
  return { ok: true };
}

export type PadMarketRow = {
  mint: string;
  question: string;
  deadline_unix: number;
  resolver: ResolverKind;
  feed_id?: string | null;
  threshold?: string | null;
  amm: MarketAmm | string;
  quote_mint: string;
  status: string;
  yes_pool?: number | null;
  no_pool?: number | null;
  outcome?: string | null;
  evidence_uri?: string | null;
  resolved_at?: string | null;
};

export async function indexPadMarket(row: PadMarketRow): Promise<void> {
  const { error } = await supabase.from("orbitx_pad_markets").upsert(row, { onConflict: "mint" });
  if (error) console.warn("[launchpad] market index failed", error);
}

export async function getPadMarket(mint: string): Promise<PadMarketRow | null> {
  const { data, error } = await supabase.from("orbitx_pad_markets").select("*").eq("mint", mint).maybeSingle();
  if (error) return null;
  return (data as PadMarketRow) ?? null;
}

export async function listPadMarkets(limit = 80): Promise<PadMarketRow[]> {
  const { data, error } = await supabase
    .from("orbitx_pad_markets")
    .select("*")
    .order("deadline_unix", { ascending: true })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as PadMarketRow[];
}

export async function listOpenMarketsPastDeadline(nowUnix = Math.floor(Date.now() / 1000)): Promise<PadMarketRow[]> {
  const { data, error } = await supabase
    .from("orbitx_pad_markets")
    .select("*")
    .in("status", ["open", "halted", "preview"])
    .lte("deadline_unix", nowUnix)
    .limit(200);
  if (error) return [];
  return (data ?? []) as PadMarketRow[];
}

export async function writeMarketOutcome(mint: string, outcome: "yes" | "no" | "void", evidenceUri?: string): Promise<void> {
  const { error } = await supabase.from("orbitx_pad_markets").update({
    status: outcome === "void" ? "void" : "resolved",
    outcome,
    evidence_uri: evidenceUri ?? null,
    resolved_at: new Date().toISOString(),
  }).eq("mint", mint);
  if (error) console.warn("[launchpad] resolve write failed", error);
}

export async function insertGeoAttest(row: {
  user_id?: string | null;
  wallet?: string | null;
  country: string;
  attest_version: string;
}): Promise<void> {
  const { error } = await supabase.from("orbitx_pad_attests").insert({
    ...row,
    attested_at: new Date().toISOString(),
  });
  if (error) console.warn("[launchpad] attest index failed", error);
}
