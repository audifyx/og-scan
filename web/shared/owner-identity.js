/**
 * Server-side owner check. Uses the same allowlist as MCP hold exemption.
 * Do not print email/wallets in client UI — only use this on Vercel functions.
 */
import {
  TOKEN_GATE_EXEMPT_EMAILS_BASE,
  TOKEN_GATE_EXEMPT_WALLETS_BASE,
  isExemptEmailInList,
  isExemptWalletInList,
  walletFromSiwsEmail,
} from "./token-gate-exempt.js";

export function ownerWalletsFromEnv(env = process.env) {
  const extras = String(env.OWNER_WALLETS || env.VITE_OWNER_WALLETS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...TOKEN_GATE_EXEMPT_WALLETS_BASE, ...extras].filter((w, i, arr) => arr.indexOf(w) === i);
}

function envOf(env) {
  if (env) return env;
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}

/** Desk / admin UI: signed-in owner email only. Wallet and SIWS do not count. */
export function isOwnerEmail(email, env) {
  env = envOf(env);
  const extra = String(env.OWNER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const list = [...TOKEN_GATE_EXEMPT_EMAILS_BASE, ...extra].map((e) => String(e).toLowerCase());
  const e = String(email || "").trim().toLowerCase();
  if (!e || e.endsWith("@wallet.orbitx.app")) return false;
  return list.includes(e);
}

export function isOwnerIdentityRecord(opts = {}, env = process.env) {
  const wallets = ownerWalletsFromEnv(env);
  const email = opts.email || null;
  const wallet = opts.wallet || walletFromSiwsEmail(email, wallets);
  if (isOwnerEmail(email, env)) return true;
  if (isExemptWalletInList(wallet, wallets)) return true;
  if (isExemptEmailInList(email, TOKEN_GATE_EXEMPT_EMAILS_BASE, wallets)) return true;
  return false;
}

export function bearerToken(req) {
  const h = req?.headers?.authorization || req?.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export async function supabaseUserFromRequest(req, env = process.env) {
  const token = bearerToken(req);
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  if (!token || !url || !anon) return null;
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

export async function requireOwnerUser(req, env = process.env) {
  const user = await supabaseUserFromRequest(req, env);
  if (!user) return null;
  const wallet =
    (typeof user.user_metadata?.wallet === "string" && user.user_metadata.wallet) ||
    walletFromSiwsEmail(user.email, ownerWalletsFromEnv(env));
  if (!isOwnerIdentityRecord({ email: user.email, wallet }, env)) return null;
  return user;
}

/** Owner desk unlock — email account only, never wallet/SIWS. */
export async function requireOwnerEmailUser(req, env = process.env) {
  const user = await supabaseUserFromRequest(req, env);
  if (!user || !isOwnerEmail(user.email, env)) return null;
  return user;
}
