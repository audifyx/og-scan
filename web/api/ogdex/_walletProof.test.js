/**
 * Unit tests for wallet proof + webhook SSRF guards (Node).
 */
import { ed25519 } from "@noble/curves/ed25519";
import bs58mod from "bs58";
import { proofMessage, verifyWalletProof, isSafeWebhookUrl, eqFilter } from "./_walletProof.js";

const bs58 = bs58mod.default || bs58mod;

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

const priv = ed25519.utils.randomPrivateKey();
const pub = ed25519.getPublicKey(priv);
const wallet = bs58.encode(pub);
const ts = Date.now();
const msg = new TextEncoder().encode(proofMessage("ogdex-wallet", wallet, ts));
const sig = bs58.encode(ed25519.sign(msg, priv));

assert(verifyWalletProof({ wallet, ts, sig, scope: "ogdex-wallet" }), "valid proof should pass");
assert(!verifyWalletProof({ wallet, ts: ts - 10 * 60_000, sig, scope: "ogdex-wallet" }), "stale proof should fail");
assert(!verifyWalletProof({ wallet, ts, sig: bs58.encode(ed25519.sign(msg, ed25519.utils.randomPrivateKey())), scope: "ogdex-wallet" }), "wrong sig");
assert(!verifyWalletProof({ wallet, ts, sig, scope: "other" }), "wrong scope");

assert(isSafeWebhookUrl("https://discord.com/api/webhooks/x/y"), "discord https ok");
assert(!isSafeWebhookUrl("http://discord.com/api/webhooks/x/y"), "http blocked");
assert(!isSafeWebhookUrl("https://127.0.0.1/hook"), "loopback blocked");
assert(!isSafeWebhookUrl("https://10.0.0.5/hook"), "private blocked");
assert(!isSafeWebhookUrl("https://169.254.169.254/latest/meta-data"), "metadata blocked");
assert(!isSafeWebhookUrl("https://user:pass@evil.com/x"), "creds blocked");

assert(eqFilter("a,b") === "a%2Cb", "eqFilter encodes commas");
assert(!String(eqFilter("x)")).includes(")"), "eqFilter encodes parens");

console.log("walletProof tests: PASS");
