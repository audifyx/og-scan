/** Client helpers for MCP access purchased by burning $ORBITX. */

import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import { createBurnInstruction, createCloseAccountInstruction } from "@solana/spl-token";
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

export async function getMcpBurnAccess(wallet?: string | null): Promise<McpBurnAccessStatus> {
  const headers = await authHeaders();
  const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
  const r = await fetch(`${AGENT_API}/mcp-access${q}`, { headers });
  const data = await readJson(r);
  if (!r.ok) {
    if (r.status === 401 && wallet) {
      return {
        ok: true,
        active: false,
        expired: false,
        packageId: null,
        expiresAt: null,
        remainingMs: 0,
        remainingLabel: "Connect or paste the burn tx to unlock",
        tokensBurned: 0,
        lifetimeTokensBurned: 0,
        packages: DEFAULT_MCP_ACCESS_PACKAGES,
        mint: MCP_BURN_MINT,
        message: "Paste the burn transaction below to grant access for this wallet.",
      };
    }
    throw new Error(String(data.message || data.error || `Access status failed (${r.status})`));
  }
  return data as unknown as McpBurnAccessStatus;
}

const PENDING_BURN_KEY = "orbitx.mcpBurn.pending";

export function rememberPendingMcpBurn(payload: {
  signature: string;
  publicKey?: string;
  packageId?: McpAccessPackageId;
}): void {
  try {
    localStorage.setItem(
      PENDING_BURN_KEY,
      JSON.stringify({ ...payload, at: Date.now() }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function takePendingMcpBurn(): {
  signature: string;
  publicKey?: string;
  packageId?: McpAccessPackageId;
} | null {
  try {
    const raw = localStorage.getItem(PENDING_BURN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      signature?: string;
      publicKey?: string;
      packageId?: McpAccessPackageId;
      at?: number;
    };
    if (!data?.signature) return null;
    if (Date.now() - Number(data.at || 0) > 30 * 60 * 1000) {
      localStorage.removeItem(PENDING_BURN_KEY);
      return null;
    }
    return {
      signature: data.signature,
      publicKey: data.publicKey,
      packageId: data.packageId,
    };
  } catch {
    return null;
  }
}

export function clearPendingMcpBurn(): void {
  try {
    localStorage.removeItem(PENDING_BURN_KEY);
  } catch {
    /* ignore */
  }
}

export type McpAccessBurnPrepare = {
  ok: boolean;
  packageId: McpAccessPackageId;
  tokens: number;
  label: string;
  mint: string;
  publicKey: string;
  tokenAccount: string;
  programId: string;
  decimals: number;
  amountRaw: string;
  balanceRaw: string;
  closesAccount: boolean;
  buildOnClient?: boolean;
  transaction?: string;
  message?: string;
  error?: string;
};

export async function prepareMcpAccessBurn(opts: {
  packageId: McpAccessPackageId;
  publicKey: string;
}): Promise<McpAccessBurnPrepare> {
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
  return data as unknown as McpAccessBurnPrepare;
}

/** Browser-only: build the unsigned SPL burn. Never do this in a Vercel function. */
export async function buildMcpAccessBurnTransaction(
  connection: Connection,
  owner: PublicKey,
  prepared: Pick<
    McpAccessBurnPrepare,
    "tokenAccount" | "mint" | "programId" | "amountRaw" | "closesAccount"
  >,
): Promise<Transaction> {
  const programId = new PublicKey(prepared.programId);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: owner, recentBlockhash: blockhash });
  tx.add(
    createBurnInstruction(
      new PublicKey(prepared.tokenAccount),
      new PublicKey(prepared.mint),
      owner,
      BigInt(prepared.amountRaw),
      [],
      programId,
    ),
  );
  if (prepared.closesAccount) {
    tx.add(
      createCloseAccountInstruction(
        new PublicKey(prepared.tokenAccount),
        owner,
        owner,
        [],
        programId,
      ),
    );
  }
  return tx;
}

/** Accept a raw sig or a Solscan / Explorer / SolanaFM URL. */
export function parseBurnTxSignature(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(
    /(?:solscan\.io|explorer\.solana\.com|solana\.fm)\/tx\/([1-9A-HJ-NP-Za-km-z]{64,88})/i,
  );
  if (fromUrl?.[1]) return fromUrl[1];
  const bare = raw.match(/[1-9A-HJ-NP-Za-km-z]{64,88}/);
  return bare?.[0] || raw.replace(/\s+/g, "");
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

function isRetryableConfirmError(message: string): boolean {
  return /not found|not_found|rpc|index|confirm|schema/i.test(message);
}

/** After Jupiter sends the burn, poll confirm until access is written. */
export async function confirmMcpAccessBurnUntilGranted(opts: {
  signature: string;
  packageId?: McpAccessPackageId;
  publicKey?: string;
  attempts?: number;
  delayMs?: number;
}): Promise<McpBurnAccessStatus> {
  const attempts = Math.max(1, opts.attempts ?? 8);
  const delayMs = Math.max(0, opts.delayMs ?? 700);
  let lastError = "Could not grant access from this burn";
  for (let i = 0; i < attempts; i++) {
    try {
      const granted = await confirmMcpAccessBurn(opts);
      if (granted.ok && (granted.active || granted.alreadyGranted)) {
        clearPendingMcpBurn();
        return granted;
      }
      lastError = granted.message || lastError;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (!isRetryableConfirmError(lastError) && i > 0) break;
    }
    if (i < attempts - 1 && delayMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(lastError);
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
