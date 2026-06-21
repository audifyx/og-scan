// Shared catalog of free NVIDIA-hosted chat models that bot owners can pick from.
// Kept in one place so the webhook, connect handler, and intelligence fn agree.
// All ids are served by our NVIDIA endpoint (integrate.api.nvidia.com/v1).

export interface BotModel {
  id: string;
  label: string;
  desc: string;
}

export const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

export const BOT_MODELS: BotModel[] = [
  { id: "meta/llama-3.3-70b-instruct",                 label: "Llama 3.3 70B",        desc: "Balanced default — great all-rounder" },
  { id: "meta/llama-3.1-8b-instruct",                  label: "Llama 3.1 8B",         desc: "Fastest, lightweight replies" },
  { id: "meta/llama-4-maverick-17b-128e-instruct",     label: "Llama 4 Maverick",     desc: "Newest Llama, fast MoE" },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",    label: "Nemotron Super 49B",   desc: "NVIDIA-tuned reasoning" },
  { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",     label: "Nemotron Ultra 253B",  desc: "Most powerful, deepest reasoning" },
  { id: "deepseek-ai/deepseek-v4-pro",                 label: "DeepSeek V4 Pro",      desc: "Strong reasoning + analysis" },
  { id: "mistralai/mistral-nemotron",                  label: "Mistral Nemotron",     desc: "Efficient and sharp" },
  { id: "moonshotai/kimi-k2.6",                        label: "Kimi K2",              desc: "Long-context generalist" },
  { id: "minimaxai/minimax-m3",                        label: "MiniMax M3",           desc: "Fast and capable" },
];

const MODEL_IDS = new Set(BOT_MODELS.map((m) => m.id));

export function isValidModel(id?: string | null): boolean {
  return !!id && MODEL_IDS.has(id);
}

// Always returns a safe, supported model id (falls back to the default).
export function resolveModel(requested?: string | null): string {
  return isValidModel(requested) ? (requested as string) : DEFAULT_MODEL;
}
