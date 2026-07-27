import { supabase } from "@/lib/supabase";
import type { BagworkSubmission, BagworkSubmissionStatus, BagworkTask, BagworkTaskInput } from "./types";

const TASKS = "bagwork_tasks";
const SUBS = "bagwork_submissions";
const PROOF_BUCKET = "bagwork-proofs";

export async function listActiveTasks(): Promise<BagworkTask[]> {
  const { data, error } = await supabase
    .from(TASKS)
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BagworkTask[];
}

export async function listAllTasksAdmin(): Promise<BagworkTask[]> {
  const { data, error } = await supabase
    .from(TASKS)
    .select("*")
    .order("sort_order", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BagworkTask[];
}

export async function upsertTask(input: BagworkTaskInput, id?: string, userId?: string): Promise<BagworkTask> {
  const row = {
    title: input.title.trim(),
    description: input.description.trim(),
    instructions: input.instructions.trim(),
    reward_usdc: input.reward_usdc,
    active: input.active,
    max_submissions_per_user: input.max_submissions_per_user,
    sort_order: input.sort_order,
    ...(userId && !id ? { created_by: userId } : {}),
  };
  if (id) {
    const { data, error } = await supabase.from(TASKS).update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return data as BagworkTask;
  }
  const { data, error } = await supabase.from(TASKS).insert(row).select("*").single();
  if (error) throw error;
  return data as BagworkTask;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from(TASKS).delete().eq("id", id);
  if (error) throw error;
}

export async function listMySubmissions(userId: string): Promise<BagworkSubmission[]> {
  const { data, error } = await supabase
    .from(SUBS)
    .select("*, bagwork_tasks(title, reward_usdc)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BagworkSubmission[];
}

export async function listAllSubmissionsAdmin(): Promise<BagworkSubmission[]> {
  const { data, error } = await supabase
    .from(SUBS)
    .select("*, bagwork_tasks(title, reward_usdc)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BagworkSubmission[];
}

export async function countUserSubmissionsForTask(userId: string, taskId: string): Promise<number> {
  const { count, error } = await supabase
    .from(SUBS)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("task_id", taskId);
  if (error) throw error;
  return count ?? 0;
}

export async function uploadProofFile(userId: string, file: File): Promise<{ url: string; fileName: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, fileName: file.name };
}

export async function createSubmission(opts: {
  taskId: string;
  userId: string;
  walletAddress: string;
  proofText?: string;
  proofUrl?: string;
  proofFileName?: string;
}): Promise<BagworkSubmission> {
  const { data, error } = await supabase
    .from(SUBS)
    .insert({
      task_id: opts.taskId,
      user_id: opts.userId,
      wallet_address: opts.walletAddress.trim(),
      proof_text: opts.proofText?.trim() || null,
      proof_url: opts.proofUrl || null,
      proof_file_name: opts.proofFileName || null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as BagworkSubmission;
}

export async function reviewSubmission(
  id: string,
  status: BagworkSubmissionStatus,
  adminNote: string | null,
  reviewerId: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    admin_note: adminNote?.trim() || null,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  const { error } = await supabase.from(SUBS).update(patch).eq("id", id);
  if (error) throw error;
}

/** Rough Solana address sanity check (base58, 32–44 chars). */
export function isLikelySolanaAddress(addr: string): boolean {
  const a = addr.trim();
  if (a.length < 32 || a.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(a);
}
