import { supabase } from "@/lib/supabase";
import { defaultFlywheel } from "../../../shared/launchpad-v2.js";

export type LaunchKind = "standard" | "flywheel" | "bagworking";

export type FlywheelAlloc = {
  community: number;
  buyBurn: number;
  creator: number;
  rewards: number;
};

export async function launchpadAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

export async function launchpadV2<T = Record<string, unknown>>(
  action: string,
  opts: { method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, unknown> } = {},
): Promise<T> {
  const method = opts.method || (opts.body ? "POST" : "GET");
  const qs = new URLSearchParams({ action, ...(opts.query || {}) });
  const headers = await launchpadAuthHeaders();
  const res = await fetch(`/api/launchpad-v2?${qs.toString()}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify({ action, ...(opts.body || {}) }) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `Launchpad V2 ${res.status}`);
  }
  return json;
}

export async function registerLaunch(input: {
  mint: string;
  signature: string;
  creator_wallet: string;
  name: string;
  ticker: string;
  kind: LaunchKind;
  lane?: "pump" | "custom";
  image_url?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  metadata_uri?: string | null;
  flywheel?: FlywheelAlloc;
  budget_usd?: number;
}): Promise<{ launch: Record<string, unknown>; campaign: Record<string, unknown> | null }> {
  return launchpadV2("register_launch", {
    method: "POST",
    body: {
      mint: input.mint,
      signature: input.signature,
      creator_wallet: input.creator_wallet,
      name: input.name,
      ticker: input.ticker,
      kind: input.kind,
      lane: input.lane || "pump",
      image_url: input.image_url,
      website: input.website,
      twitter: input.twitter,
      telegram: input.telegram,
      metadata_uri: input.metadata_uri,
      community: input.flywheel?.community,
      buyBurn: input.flywheel?.buyBurn,
      creator: input.flywheel?.creator,
      rewards: input.flywheel?.rewards,
      budget_usd: input.budget_usd,
    },
  });
}

export function kindFromSearch(raw: string | null | undefined): LaunchKind {
  const k = String(raw || "").toLowerCase();
  if (k === "flywheel" || k === "bagworking") return k;
  return "standard";
}

export { defaultFlywheel };
