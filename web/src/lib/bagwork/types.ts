export type BagworkSubmissionStatus = "pending" | "approved" | "rejected" | "paid";

export interface BagworkTask {
  id: string;
  title: string;
  description: string;
  instructions: string;
  reward_usdc: number;
  active: boolean;
  max_submissions_per_user: number | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BagworkSubmission {
  id: string;
  task_id: string;
  user_id: string;
  wallet_address: string;
  proof_text: string | null;
  proof_url: string | null;
  proof_file_name: string | null;
  status: BagworkSubmissionStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  bagwork_tasks?: Pick<BagworkTask, "title" | "reward_usdc"> | null;
}

export interface BagworkTaskInput {
  title: string;
  description: string;
  instructions: string;
  reward_usdc: number;
  active: boolean;
  max_submissions_per_user: number | null;
  sort_order: number;
}
