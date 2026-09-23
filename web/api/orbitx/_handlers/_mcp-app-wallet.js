/**
 * MCP in-app wallet — Launchpad model.
 * Keys are generated in-process, shown ONCE, never written to OrbitX DB.
 * User imports the secret into Super Computer (browser localStorage).
 * We cannot sign their trades server-side because we do not keep the key.
 */
const DASH = "https://www.orbitx.world/supercomputer?tab=inapp";
const SIGN = "https://www.orbitx.world/supercomputer/sign";
const SOL_MINT = "So11111111111111111111111111111111111111112";

function needAuth(auth) {
  if (auth?.userId) return { userId: auth.userId };
  return {
    ok: false,
    error: "auth_required",
    message: "Link OrbitX auth first.",
    dashboard: DASH,
  };
}

async function genWallet() {
  const [{ Keypair }, bs58] = await Promise.all([import("@solana/web3.js"), import("bs58")]);
  const kp = Keypair.generate();
  const publicKey = kp.publicKey.toBase58();
  const enc = bs58.default || bs58;
  const secretKeyBase58 = enc.encode(kp.secretKey);
  kp.secretKey.fill(0);
  return { publicKey, secretKeyBase58 };
}

export async function appWalletStatus(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  return {
    ok: true,
    custody: "user",
    backendHoldsKey: false,
    dashboard: DASH,
    message:
      "OrbitX does not store your private key. Create in this chat (secret shown once) then import it on Super Computer → In-app wallet. That copy lives in your browser, same as Launchpad.",
  };
}

export async function appWalletCreate(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const w = await genWallet();
  return {
    ok: true,
    created: true,
    custody: "user",
    backendHoldsKey: false,
    publicKey: w.publicKey,
    secretKeyBase58: w.secretKeyBase58,
    dashboard: DASH,
    warning:
      "This is the only time OrbitX will show this key. We do not save it. Import it on Super Computer → In-app wallet (or a hardware/backup) before you close this chat.",
    next: "Fund the pubkey with SOL. Then say buy $1 of <CA> — we prepare the swap; you sign from the local wallet page.",
  };
}

export async function appWalletExport() {
  return {
    ok: false,
    error: "not_on_server",
    backendHoldsKey: false,
    dashboard: DASH,
    message: "There is no key on OrbitX servers to export. Open Super Computer → In-app wallet and export from your browser copy.",
  };
}

export async function appWalletRevoke() {
  return {
    ok: true,
    backendHoldsKey: false,
    message: "Nothing to revoke on the server. Delete the wallet on Super Computer → In-app wallet if you want it off this device.",
    dashboard: DASH,
  };
}

function signUrl({ action, mint, usd, fraction }) {
  const u = new URL(SIGN);
  u.searchParams.set("action", action);
  u.searchParams.set("mint", mint);
  if (usd != null) u.searchParams.set("amount", String(usd));
  if (fraction != null) u.searchParams.set("amount", `${Math.round(Number(fraction) * 100)}%`);
  u.searchParams.set("auto", "1");
  u.searchParams.set("wallet", "local");
  return u.toString();
}

export async function appWalletBuy(auth, { mint, usd = 1 } = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const ca = String(mint || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) return { ok: false, error: "bad_mint", message: "Pass the token mint." };
  const url = signUrl({ action: "buy", mint: ca, usd });
  return {
    ok: true,
    side: "buy",
    mint: ca,
    usd: Number(usd) || 1,
    backendHoldsKey: false,
    signUrl: url,
    dashboard: DASH,
    message: "Swap is ready. OrbitX does not have your key. Open signUrl (or In-app wallet on Super Computer) to send it from your local wallet.",
  };
}

export async function appWalletSell(auth, { mint, fraction = 1 } = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const ca = String(mint || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) return { ok: false, error: "bad_mint" };
  const url = signUrl({ action: "sell", mint: ca, fraction });
  return {
    ok: true,
    side: "sell",
    mint: ca,
    fraction: Number(fraction) || 1,
    backendHoldsKey: false,
    signUrl: url,
    dashboard: DASH,
    message: "OrbitX does not have your key. Open signUrl to sell from the local wallet on this device.",
  };
}

export async function dispatchAppWalletTool(name, args, auth) {
  if (name === "orbitx_app_wallet") return appWalletStatus(auth);
  if (name === "orbitx_app_wallet_create") return appWalletCreate(auth);
  if (name === "orbitx_app_wallet_export") return appWalletExport(auth);
  if (name === "orbitx_app_wallet_revoke") return appWalletRevoke(auth);
  if (name === "orbitx_app_buy") return appWalletBuy(auth, args || {});
  if (name === "orbitx_app_sell") return appWalletSell(auth, args || {});
  return null;
}

export function isAppWalletTool(name) {
  return String(name || "").startsWith("orbitx_app_");
}

export const APP_WALLET_CORE_TOOLS = [
  {
    name: "orbitx_app_wallet",
    description: "In-app wallet status. Keys are user-local (Launchpad model). OrbitX never stores the private key.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } } },
  },
  {
    name: "orbitx_app_wallet_create",
    description: "Generate a new Solana wallet. Returns pubkey + private key ONCE. Not saved on OrbitX. User must import on Super Computer.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } } },
  },
  {
    name: "orbitx_app_wallet_export",
    description: "Cannot export from server (no key stored). Points user to Super Computer local export.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } } },
  },
  {
    name: "orbitx_app_wallet_revoke",
    description: "No server key to revoke. Tells user to delete the local copy.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } } },
  },
  {
    name: "orbitx_app_buy",
    description: "Prepare a buy for the user's local in-app wallet. Returns signUrl. OrbitX does not sign (we do not have the key).",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" }, usd: { type: "number" }, authCode: { type: "string" } },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_app_sell",
    description: "Prepare a sell for the local in-app wallet. Returns signUrl. No server-side key.",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" }, fraction: { type: "number" }, authCode: { type: "string" } },
      required: ["mint"],
    },
  },
];
