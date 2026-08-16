/** Client helpers for MCP access purchased by burning $ORBITX. */

import { AGENT_API } from "@/lib/orbitxMcp";

export const MCP_BURN_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

export type McpAccessPackageId = "day" | "week";

export type McpAccessPackage = {
  id: McpAccessPackageId;
  label: string;
  tokens: number;
  durationMs: number;
  durationSeconds: number;
  durationLabel: string;
  mint: string;
  symbol: string;
};

export type McpBurnAccessStatus = {
  ok: boolean;
  active: boolean;
  expired: boolean;
  packageId: McpAccessPackageId | null;
  expiresAt: string | null;
  remainingMs: number;
  remainingLabel: string;
  tokensBurned: number;
  lifetimeTokensBurned: number;
  walletAddress?: string | null;
  lastTxSignature?: string | null;
  packages: McpAccessPackage[];
  mint: string;
  message?: string;
  signature?: string;
  explorer?: string;
  alreadyGranted?: boolean;
  schemaMissing?: boolean;
};

async function authHeaders(): Promise<HeadersInit> {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(r.ok ? "Invalid JSON from server" : `Server error (${r.status})`);
  }
}

export async function getMcpBurnAccess(): Promise<McpBurnAccessStatus> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/mcp-access`, { headers });
  const data = await readJson(r);
  if (!r.ok) {
    throw new Error(String(data.message || data.error || `Access status failed (${r.status})`));
  }
  return data as unknown as McpBurnAccessStatus;
}

export async function prepareMcpAccessBurn(opts: {
  packageId: McpAccessPackageId;
  publicKey: string;
}): Promise<{
  ok: boolean;
  packageId: McpAccessPackageId;
  tokens: number;
  label: string;
  transaction: string;
  message?: string;
  error?: string;
}> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/mcp-access/prepare`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      packageId: opts.packageId,
      publicKey: opts.publicKey,
    }),
  });
  const data = await readJson(r);
  if (!r.ok || data.ok === false) {
    throw new Error(String(data.message || data.error || `Prepare burn failed (${r.status})`));
  }
  return data as {
    ok: boolean;
    packageId: McpAccessPackageId;
    tokens: number;
    label: string;
    transaction: string;
  };
}

export async function confirmMcpAccessBurn(opts: {
  signature: string;
  packageId?: McpAccessPackageId;
  publicKey?: string;
}): Promise<McpBurnAccessStatus> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/mcp-access/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      signature: opts.signature,
      packageId: opts.packageId,
      publicKey: opts.publicKey,
    }),
  });
  const data = await readJson(r);
  if (!r.ok || data.ok === false) {
    throw new Error(String(data.message || data.error || `Confirm burn failed (${r.status})`));
  }
  return data as unknown as McpBurnAccessStatus;
}

export function mcpAccessSignUrl(opts: {
  packageId: McpAccessPackageId;
  publicKey: string;
  auto?: boolean;
  origin?: string;
}): string {
  let base = (opts.origin || (typeof window !== "undefined" ? window.location.origin : "https://www.orbitx.world")).replace(
    /\/$/,
    "",
  );
  if (base === "https://orbitx.world" || base === "http://orbitx.world") {
    base = "https://www.orbitx.world";
  }
  const q = new URLSearchParams({
    kind: "mcp-access",
    package: opts.packageId,
    publicKey: opts.publicKey,
    mint: MCP_BURN_MINT,
    amount: opts.packageId === "week" ? "1000" : "100",
  });
  if (opts.auto) q.set("auto", "1");
  return `${base}/agent/sign?${q.toString()}`;
}

export const DEFAULT_MCP_ACCESS_PACKAGES: McpAccessPackage[] = [
  {
    id: "day",
    label: "1 Day Access",
    tokens: 100,
    durationMs: 24 * 60 * 60 * 1000,
    durationSeconds: 24 * 60 * 60,
    durationLabel: "24 hours",
    mint: MCP_BURN_MINT,
    symbol: "ORBITX",
  },
  {
    id: "week",
    label: "1 Week Access",
    tokens: 1000,
    durationMs: 7 * 24 * 60 * 60 * 1000,
    durationSeconds: 7 * 24 * 60 * 60,
    durationLabel: "7 days",
    mint: MCP_BURN_MINT,
    symbol: "ORBITX",
  },
];
