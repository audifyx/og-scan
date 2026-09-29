/**
 * Minimal JSON-RPC client for the Supercomputer MCP.
 *
 * The /api/supercomputer-mcp endpoint answers tools/call directly from the
 * POST body (no MCP initialize handshake required) and is CORS-open, so the
 * browser can call backend-signed tools like orbitx_app_burn with the
 * user's authCode. The backend desk wallet signs — never a popup.
 */
import { SUPERCOMPUTER_MCP_URL, ORBITX_MINT } from "./constants";

export type McpToolResult = {
  ok: boolean;
  signature?: string | null;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

let rpcId = 1;

function parseToolPayload(raw: unknown): McpToolResult {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    // Standard MCP envelope: result.content[0].text is JSON.
    const content = (o.result as { content?: Array<{ text?: string }> } | undefined)?.content;
    const text = content?.[0]?.text;
    if (typeof text === "string") {
      try {
        return JSON.parse(text) as McpToolResult;
      } catch {
        return { ok: false, error: "bad_tool_payload", message: text.slice(0, 300) };
      }
    }
    // Some tools return structuredContent at top level.
    const sc = (o.result as { structuredContent?: unknown } | undefined)?.structuredContent;
    if (sc && typeof sc === "object") return sc as McpToolResult;
    if (typeof o.ok === "boolean") return o as unknown as McpToolResult;
  }
  return { ok: false, error: "bad_response", message: "Unexpected MCP response shape." };
}

/** Call a supercomputer MCP tool with the user's authCode. Backend signs. */
export async function callSupercomputerTool(
  name: string,
  args: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<McpToolResult> {
  const timeoutMs = opts?.timeoutMs ?? 45000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(SUPERCOMPUTER_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: rpcId++,
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    // Handle SSE (data: {...}) as well as plain JSON.
    const payloadLine = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .find((l) => l && l !== "[DONE]");
    const raw = payloadLine ? JSON.parse(payloadLine) : text ? JSON.parse(text) : {};
    if (!r.ok && !(raw as { result?: unknown }).result) {
      return {
        ok: false,
        error: "mcp_http_error",
        message: `Supercomputer MCP HTTP ${r.status}`,
      };
    }
    const parsed = parseToolPayload(raw);
    if (
      (raw as { result?: { isError?: boolean } }).result?.isError &&
      parsed.ok !== false
    ) {
      return { ...parsed, ok: false, error: parsed.error || "tool_error" };
    }
    return parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg.includes("abort") ? "timeout" : "network_error",
      message: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type DeskWalletInfo = {
  ok: boolean;
  exists: boolean;
  publicKey: string | null;
  sol: number;
  usdc: number;
  error?: string;
  message?: string;
};

/** Desk wallet status (backend-signed, no popup). Carries the wallet pubkey. */
export async function fetchDeskWallet(authCode: string): Promise<DeskWalletInfo> {
  const res = await callSupercomputerTool("orbitx_app_wallet", { authCode });
  return {
    ok: res.ok === true,
    exists: res.exists === true,
    publicKey: typeof res.publicKey === "string" ? res.publicKey : null,
    sol: Number(res.sol || 0),
    usdc: Number(res.usdc || 0),
    error: res.error,
    message: res.message,
  };
}

export type BurnResult = {
  ok: boolean;
  signature: string | null;
  error?: string;
  message?: string;
  closesAccount?: boolean;
};

/**
 * Backend-signed ORBITX burn from the user's desk wallet.
 * Same primitive the Agent MCP dev-tier uses (orbitx_app_burn → prepareBurn
 * → createBurnInstruction → signAndSendUserTx). No wallet popup, ever.
 */
export async function burnOrbitxViaDesk(params: {
  authCode: string;
  amount: number; // whole ORBITX tokens
}): Promise<BurnResult> {
  const amount = Math.floor(Number(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, signature: null, error: "bad_amount", message: "Amount must be a positive whole number of ORBITX." };
  }
  const res = await callSupercomputerTool("orbitx_app_burn", {
    mint: ORBITX_MINT,
    amount: String(amount),
    authCode: params.authCode,
  });
  if (!res.ok) {
    return {
      ok: false,
      signature: typeof res.signature === "string" ? res.signature : null,
      error: res.error || "burn_failed",
      message: res.message || "The burn did not complete.",
    };
  }
  return {
    ok: true,
    signature: typeof res.signature === "string" ? res.signature : null,
    message: res.message,
    closesAccount: res.closesAccount === true,
  };
}
