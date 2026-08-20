/**
 * Dashboard auto-sign: when the Telegram /telegram toggle is on, send the
 * quoted swap from the already-connected wallet. OrbitX must not show a
 * second "Sign in Phantom" step. Phantom itself may still confirm the send.
 */
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  buildMcpAccessBurnTransaction,
  confirmMcpAccessBurnUntilGranted,
  isMcpAccessPackageId,
  rememberPendingMcpBurn,
  type McpAccessPackageId,
} from "@/lib/mcpBurnAccess";
import { fetchTimeoutSignal } from "@/lib/orbitx/agentSignWallets";
import {
  confirmSentTransaction,
  sendWalletTransaction,
  type WalletSendCaps,
} from "@/lib/orbitx/sendWalletTx";

const DEFAULT_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

export function isDashboardAutoBuyTool(tool: string): boolean {
  return /buy|trade|swap|confirm_buy|mcp_access|credits/.test(String(tool || ""));
}

export function ensureAutoSignUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "https://www.orbitx.world");
    parsed.searchParams.set("auto", "1");
    if (/^https?:\/\//i.test(raw)) return parsed.toString();
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    if (/[?&]auto=/.test(raw)) return raw;
    return `${raw}${raw.includes("?") ? "&" : "?"}auto=1`;
  }
}

export function pickBuySignHref(payload: Record<string, unknown>, autoSign: boolean): string {
  const auto = typeof payload.autoSignUrl === "string" ? payload.autoSignUrl : "";
  const open = typeof payload.openUrl === "string" ? payload.openUrl : "";
  const sign = typeof payload.signUrl === "string" ? payload.signUrl : "";
  if (autoSign) return ensureAutoSignUrl(auto || open || sign);
  return open || sign || auto;
}

/** Same-app path so the connected wallet stays mounted (no new-tab Sign page). */
export function agentSignPath(href: string): string | null {
  const raw = String(href || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw, "https://www.orbitx.world");
    if (!/\/agent\/sign/i.test(parsed.pathname)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return raw.startsWith("/agent/sign") ? raw : null;
  }
}

export function isAutoBuyResult(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload || typeof payload !== "object") return false;
  const mode = String(payload.confirmMode || "").toLowerCase();
  const status = String(payload.status || payload.action || "").toLowerCase();
  return mode === "auto" || status === "awaiting_auto_phantom" || payload.autoBuy === true;
}

function decodeTx(b64: string): VersionedTransaction | Transaction {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

export type DashboardAutoBuyInput = {
  connection: Connection;
  walletCaps: WalletSendCaps;
  publicKey: PublicKey;
  tool: string;
  args: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

export type DashboardAutoBuyResult = {
  signature: string;
  note: string;
  solscan: string;
};

export async function sendDashboardAutoBuy(input: DashboardAutoBuyInput): Promise<DashboardAutoBuyResult> {
  const pk = input.publicKey.toBase58();
  const sendOpts = { skipPreflight: true as const };
  const sendOne = async (b64: string) =>
    sendWalletTransaction(input.connection, input.walletCaps, decodeTx(b64), sendOpts);

  const tool = String(input.tool || "");
  if (/mcp_access/.test(tool)) {
    const packageIdRaw = String(
      input.args.package || input.args.packageId || input.payload?.package || input.payload?.packageId || "hour",
    ).toLowerCase();
    const pkg: McpAccessPackageId = isMcpAccessPackageId(packageIdRaw) ? packageIdRaw : "hour";
    const res = await fetch("/api/orbitx-agent/mcp-access/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey: pk, packageId: pkg }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || data?.message || "Could not quote access burn"));
    }
    let signature: string;
    if (typeof data.transaction === "string" && data.transaction) {
      signature = await sendOne(data.transaction);
    } else if (data.tokenAccount && data.amountRaw && data.programId) {
      const tx = await buildMcpAccessBurnTransaction(input.connection, input.publicKey, {
        tokenAccount: String(data.tokenAccount),
        mint: String(data.mint || DEFAULT_MINT),
        programId: String(data.programId),
        amountRaw: String(data.amountRaw),
        closesAccount: Boolean(data.closesAccount),
      });
      signature = await sendWalletTransaction(input.connection, input.walletCaps, tx, sendOpts);
    } else {
      throw new Error(String(data?.message || "Could not build access burn"));
    }
    await confirmSentTransaction(input.connection, signature);
    rememberPendingMcpBurn({ signature, publicKey: pk, packageId: pkg });
    const granted = await confirmMcpAccessBurnUntilGranted({
      signature,
      publicKey: pk,
      packageId: pkg,
    });
    return {
      signature,
      note: granted.message || `${granted.remainingLabel || "Access granted"}. Timed MCP access is active now.`,
      solscan: `https://solscan.io/tx/${signature}`,
    };
  }

  const mint = String(input.payload?.mint || input.args.mint || input.args.ca || DEFAULT_MINT).trim() || DEFAULT_MINT;
  const amountSol = Number(input.payload?.amountSol ?? input.args.amountSol ?? input.args.amount);
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    throw new Error("Missing SOL amount for auto-sign buy");
  }
  const slippage = Math.min(Math.max(Number(input.args.slippage || input.payload?.slippage) || 10, 1), 50);
  const pool = String(input.args.pool || input.payload?.pool || "auto");
  const res = await fetch("/api/ogdex/trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: fetchTimeoutSignal(20_000),
    body: JSON.stringify({
      publicKey: pk,
      action: "buy",
      mint,
      amount: amountSol,
      denominatedInSol: true,
      slippage,
      pool,
      platformFee: true,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data?.ok || !data?.tx) {
    throw new Error(String(data?.error || "Could not build trade transaction"));
  }
  if (typeof data.feeTx === "string" && data.feeTx.length > 0) {
    const feeSig = await sendOne(data.feeTx);
    await confirmSentTransaction(input.connection, feeSig);
  }
  const signature = await sendOne(String(data.tx));
  await confirmSentTransaction(input.connection, signature);
  return {
    signature,
    note: `Buy sent. ${signature.slice(0, 8)}…`,
    solscan: `https://solscan.io/tx/${signature}`,
  };
}
