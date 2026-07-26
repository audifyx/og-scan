/**
 * Verify Solana wallet ownership via ed25519 message signature.
 * Message format: `orbitx-dex:${scope}:${wallet}:${ts}`
 * Clients sign with Phantom/Solflare/etc. `signMessage`.
 */
import { ed25519 } from "@noble/curves/ed25519";
import bs58mod from "bs58";

const bs58 = bs58mod.default || bs58mod;
const MAX_SKEW_MS = 5 * 60_000;

export function proofMessage(scope, wallet, ts) {
  return `orbitx-dex:${scope}:${wallet}:${ts}`;
}

export function verifyWalletProof({ wallet, ts, sig, scope }) {
  if (typeof wallet !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) return false;
  if (typeof scope !== "string" || !/^[a-z0-9_-]{2,32}$/i.test(scope)) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > MAX_SKEW_MS) return false;
  if (typeof sig !== "string" || sig.length < 64) return false;

  let pub, signature;
  try {
    pub = bs58.decode(wallet);
    signature = bs58.decode(sig);
  } catch {
    return false;
  }
  if (pub.length !== 32 || signature.length !== 64) return false;

  const msg = new TextEncoder().encode(proofMessage(scope, wallet, t));
  try {
    return ed25519.verify(signature, msg, pub);
  } catch {
    return false;
  }
}

/** Extract proof from body, query, or headers. */
export function extractProof(req, body = {}) {
  const url = new URL(req.url || "/", "http://x");
  const q = url.searchParams;
  const h = req.headers || {};
  return {
    wallet: body.wallet || q.get("wallet") || h["x-orbitx-wallet"] || "",
    ts: body.ts ?? body.proof?.ts ?? q.get("ts") ?? h["x-orbitx-ts"],
    sig: body.sig || body.proof?.sig || q.get("sig") || h["x-orbitx-sig"] || "",
  };
}

/** HTTPS webhook only; block localhost / private / link-local / metadata IPs. */
export function isSafeWebhookUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return false;
  if (host === "metadata.google.internal") return false;
  // IPv4 private / loopback / link-local / CGNAT
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  // IPv6 loopback / ULA / link-local
  if (host === "::1" || host.startsWith("[::1]") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return false;
  }
  return true;
}

export function eqFilter(value) {
  // Encode for PostgREST `col=eq.value` — blocks filter injection via commas/parens.
  return encodeURIComponent(String(value ?? ""))
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}
