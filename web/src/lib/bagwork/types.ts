export type BagworkSubmissionStatus = "pending" | "approved" | "rejected" | "paid";
export type BagworkDifficulty = "easy" | "medium" | "hard" | "expert";
export type BagworkCategory = "general" | "social" | "content" | "qa" | "onchain" | "design" | "research";

export interface BagworkTask {
  id: string;
  title: string;
  description: string;
  instructions: string;
  reward_usdc: number;
  active: boolean;
  max_submissions_per_user: number | null;
  sort_order: number;
  category?: BagworkCategory | string;
  difficulty?: BagworkDifficulty | string;
  tags?: string[];
  slots?: number | null;
  deadline_at?: string | null;
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
  bagwork_tasks?: Pick<BagworkTask, "title" | "reward_usdc" | "category" | "difficulty"> | null;
}

export interface BagworkTaskInput {
  id?: string;
  title: string;
  description: string;
  instructions: string;
  reward_usdc: number;
  active: boolean;
  max_submissions_per_user: number | null;
  sort_order: number;
  category: string;
  difficulty: string;
  tags?: string[];
}

export interface BagworkStats {
  active_tasks: number;
  total_submissions: number;
  approved_submissions: number;
  paid_usdc: number;
}

export interface BagworkLeaderRow {
  user_id: string;
  wallet: string;
  earned: number;
  count: number;
}

export const BAGWORK_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "social", label: "Social" },
  { id: "content", label: "Content" },
  { id: "qa", label: "QA / Bugs" },
  { id: "onchain", label: "On-chain" },
  { id: "design", label: "Design" },
  { id: "research", label: "Research" },
  { id: "general", label: "General" },
] as const;
