import { supabase } from "@/lib/supabase";
import type {
  BagworkLeaderRow,
  BagworkStats,
  BagworkSubmission,
  BagworkSubmissionStatus,
  BagworkTask,
  BagworkTaskInput,
} from "./types";

const PROOF_BUCKET = "bagwork-proofs";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet<T>(action: string): Promise<T> {
  const headers = await authHeader();
  const r = await fetch(`/api/bagwork?action=${encodeURIComponent(action)}`, { headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}

async function apiPost<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  const r = await fetch(`/api/bagwork?action=${encodeURIComponent(action)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}

/** Prefer API; fall back to direct Supabase when API is unavailable locally. */
export async function listActiveTasks(): Promise<BagworkTask[]> {
  try {
    const j = await apiGet<{ tasks: BagworkTask[] }>("tasks");
    return j.tasks ?? [];
  } catch {
    const { data, error } = await supabase
      .from("bagwork_tasks")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as BagworkTask[];
  }
}

export async function fetchBagworkStats(): Promise<BagworkStats> {
  try {
    return await apiGet<BagworkStats>("stats");
  } catch {
    return { active_tasks: 0, total_submissions: 0, approved_submissions: 0, paid_usdc: 0 };
  }
}

export async function fetchLeaderboard(): Promise<BagworkLeaderRow[]> {
  try {
    const j = await apiGet<{ leaderboard: BagworkLeaderRow[] }>("leaderboard");
    return j.leaderboard ?? [];
  } catch {
    return [];
  }
}

export async function listAllTasksAdmin(): Promise<BagworkTask[]> {
  try {
    const j = await apiGet<{ tasks: BagworkTask[] }>("admin_tasks");
    return j.tasks ?? [];
  } catch {
    const { data, error } = await supabase.from("bagwork_tasks").select("*").order("sort_order", { ascending: false });
    if (error) throw error;
    return (data ?? []) as BagworkTask[];
  }
}

export async function upsertTask(input: BagworkTaskInput, id?: string, _userId?: string): Promise<BagworkTask> {
  try {
    const j = await apiPost<{ task: BagworkTask }>("upsert_task", { ...input, id });
    return j.task;
  } catch (e) {
    // Local fallback via RLS
    const row = {
      title: input.title.trim(),
      description: input.description.trim(),
      instructions: input.instructions.trim(),
      reward_usdc: input.reward_usdc,
      active: input.active,
      max_submissions_per_user: input.max_submissions_per_user,
      sort_order: input.sort_order,
      category: input.category,
      difficulty: input.difficulty,
      tags: input.tags ?? [],
    };
    if (id) {
      const { data, error } = await supabase.from("bagwork_tasks").update(row).eq("id", id).select("*").single();
      if (error) throw e instanceof Error ? e : error;
      return data as BagworkTask;
    }
    const { data, error } = await supabase.from("bagwork_tasks").insert(row).select("*").single();
    if (error) throw e instanceof Error ? e : error;
    return data as BagworkTask;
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    await apiPost("delete_task", { id });
  } catch {
    const { error } = await supabase.from("bagwork_tasks").delete().eq("id", id);
    if (error) throw error;
  }
}

export async function listMySubmissions(userId: string): Promise<BagworkSubmission[]> {
  try {
    const j = await apiGet<{ submissions: BagworkSubmission[] }>("my_submissions");
    return j.submissions ?? [];
  } catch {
    const { data, error } = await supabase
      .from("bagwork_submissions")
      .select("*, bagwork_tasks(title, reward_usdc, category, difficulty)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as BagworkSubmission[];
  }
}

export async function listAllSubmissionsAdmin(): Promise<BagworkSubmission[]> {
  try {
    const j = await apiGet<{ submissions: BagworkSubmission[] }>("admin_submissions");
    return j.submissions ?? [];
  } catch {
    const { data, error } = await supabase
      .from("bagwork_submissions")
      .select("*, bagwork_tasks(title, reward_usdc, category)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as BagworkSubmission[];
  }
}

export async function countUserSubmissionsForTask(userId: string, taskId: string): Promise<number> {
  const { count, error } = await supabase
    .from("bagwork_submissions")
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
  try {
    const j = await apiPost<{ submission: BagworkSubmission }>("submit", {
      task_id: opts.taskId,
      wallet_address: opts.walletAddress,
      proof_text: opts.proofText,
      proof_url: opts.proofUrl,
      proof_file_name: opts.proofFileName,
    });
    return j.submission;
  } catch {
    const { data, error } = await supabase
      .from("bagwork_submissions")
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
}

export async function reviewSubmission(
  id: string,
  status: BagworkSubmissionStatus,
  adminNote: string | null,
  _reviewerId: string,
  txSignature?: string | null,
): Promise<void> {
  try {
    await apiPost("review", { id, status, admin_note: adminNote, tx_signature: txSignature });
  } catch {
    const patch: Record<string, unknown> = {
      status,
      admin_note: adminNote?.trim() || null,
      reviewed_at: new Date().toISOString(),
    };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("bagwork_submissions").update(patch).eq("id", id);
    if (error) throw error;
  }
}

export function isLikelySolanaAddress(addr: string): boolean {
  const a = addr.trim();
  if (a.length < 32 || a.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(a);
}

export function shortWallet(a: string, n = 4) {
  if (!a) return "—";
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}
