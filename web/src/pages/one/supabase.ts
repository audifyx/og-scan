import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config";

let client: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export const supabase = client;
export { isSupabaseConfigured };

export interface BountyTask {
  id: string;
  title: string;
  description: string;
  reward_usdc: number;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  active: boolean;
  sort_order: number;
}

export async function fetchBounties(): Promise<{ tasks: BountyTask[]; live: boolean }> {
  if (!client) return { tasks: [], live: false };
  const { data, error } = await client
    .from("bagwork_tasks")
    .select("id,title,description,reward_usdc,difficulty,category,active,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return { tasks: (data ?? []) as BountyTask[], live: true };
}

export async function submitProof(taskId: string, wallet: string, proofText: string, proofUrl: string) {
  if (!client) throw new Error("Backend not configured");
  const { error } = await client.from("bagwork_submissions").insert({
    task_id: taskId,
    wallet_address: wallet,
    proof_text: proofText,
    proof_url: proofUrl || null,
    status: "pending",
  });
  if (error) throw error;
}
