// OrbitX NFT Marketplace — Launch Drops client (Phase 3). Fails soft until the
// v4 migration is applied.
import { supabase } from "@/lib/supabase";

export type DropPhase = "upcoming" | "whitelist" | "public" | "ended";
export type DropAccess = "public" | "whitelist" | "private";

export interface NftDrop {
  id: string;
  collection_id: string | null;
  creator_wallet: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  mint_price_sol: number;
  supply: number | null;
  minted: number;
  per_wallet_limit: number | null;
  access: DropAccess;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  created_at: string;
}

export async function listDrops(): Promise<NftDrop[]> {
  try {
    const { data } = await supabase.from("orbitx_nft_drops").select("*").order("starts_at", { ascending: true });
    return (data ?? []) as NftDrop[];
  } catch { return []; }
}

export function dropPhase(d: NftDrop, now = Date.now()): DropPhase {
  const start = d.starts_at ? new Date(d.starts_at).getTime() : null;
  const end = d.ends_at ? new Date(d.ends_at).getTime() : null;
  if (end && now >= end) return "ended";
  if (d.supply != null && d.minted >= d.supply) return "ended";
  if (start && now < start) return "upcoming";
  return d.access === "whitelist" ? "whitelist" : "public";
}

export function countdown(toIso?: string | null, now = Date.now()): string {
  if (!toIso) return "—";
  let s = Math.max(0, (new Date(toIso).getTime() - now) / 1000);
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); const sec = Math.floor(s - m * 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}
