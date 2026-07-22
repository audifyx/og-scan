// Phase 4 — collection analytics history (daily snapshots).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DailyStat {
  day: string; floor_sol: number | null; volume_sol: number; sales: number;
  holders: number | null; listed: number | null; market_cap_sol: number | null;
}

export async function listCollectionStats(collectionId: string): Promise<DailyStat[]> {
  try {
    const { data } = await supabase.from("orbitx_nft_collection_stats_daily")
      .select("*").eq("collection_id", collectionId).order("day", { ascending: true }).limit(180);
    return (data ?? []) as DailyStat[];
  } catch { return []; }
}

export function useCollectionStats(id?: string) {
  return useQuery({ queryKey: ["nft-col-stats", id], enabled: !!id, staleTime: 60_000, queryFn: () => listCollectionStats(id!) });
}
