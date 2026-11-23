import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clientIp, hitAuthLimit } from "./_authLimit.js";
import { fetchSolUsdPrice } from "./orbitx/_handlers/_buy-orbitx.js";

/**
 * POST /api/pump-create
 *
 * Two-step flow called from the Launch page:
 *
 * Step 1 — body.step === "ipfs"
 *   Accepts image + metadata fields.
 *   Uploads image to IPFS, then uploads the full metadata JSON to IPFS.
 *   Returns { metadataUri: string }.
 *
 * Step 2 — body.step === "create"
 *   Accepts JSON with { publicKey, metadataUri, name, symbol, mintPublicKey, devBuySol, slippage, feeSignature }.
 *   Calls PumpPortal /api/trade-local to get the unsigned transaction.
 *   Returns the serialized transaction as base64 so the browser can sign with Phantom.
 *
 * Security (2026-11-23 audit B7/B10): this handler used to be fully
 * unauthenticated and took devBuy/slippage straight from the body — the
 * platform launch fee existed only in the client flow. Now:
 *   - every numeric input is strictly validated (finite, in range);
 *   - the create step requires the launch fee to be PROVEN on-chain:
 *     `feeSignature` must be a confirmed transaction, signed by
 *     `publicKey`, paying at least the launch fee (in SOL) to the
 *     platform wallet within the last 30 minutes. Paying the fee from
 *     `publicKey` is also the wallet authentication for this flow —
 *     only the wallet's owner can produce that payment.
 *   - both steps are rate-limited per IP (the ipfs step spends the
 *     server's Pinata quota, so it is not free to abuse either).
 * Set LAUNCH_FEE_USD=0 in the server env to run a fee promo (the fee
 * proof is then skipped, matching the client promo flag).
 */

/** Platform wallet that receives the launch fee (mirrors web/src/lib/platformFee.ts). */
const PLATFORM_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";
/** Flat launch fee in USD (mirrors BASE_LAUNCH_FEE_USD in platformFee.ts). */
const LAUNCH_FEE_USD = (() => {
  const n = Number(process.env.LAUNCH_FEE_USD ?? 0.5);
  return Number.isFinite(n) && n >= 0 ? n : 0.5;
})();
const FEE_MAX_AGE_MS = 30 * 60_000;
/** Fee signatures already redeemed for a create on this instance. */
const usedFeeSignatures = new Set<string>();

function isPubkey(v: unknown): v is string {
  return typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());
}

/** Strict numeric validation: present-but-garbage is an error, never a default. */
function validNumber(v: unknown, opts: { min: number; max: number }): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < opts.min || n > opts.max) return null;
  return n;
}

function rpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY ? "https://mainnet.helius-rpc.com/?api-key=" + process.env.HELIUS_API_KEY : "") ||
    "https://api.mainnet-beta.solana.com"
  );
}

async function rpc(method: string, params: unknown[]): Promise<any> {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc_error");
  return j.result;
}

/**
 * Verify the launch-fee payment: a confirmed tx, signed by the launching
 * wallet, that moved at least the fee's worth of SOL to PLATFORM_WALLET
 * recently. Mirrors the desk-shop verification pattern (signer check,
 * >=80% of expected spend to absorb SOL-price drift between the client's
 * quote and the server's).
 */
async function verifyLaunchFee(
  signature: string,
  publicKey: string,
): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  if (usedFeeSignatures.has(signature)) {
    return { ok: false, error: "fee_signature_used", message: "That launch-fee payment was already used for a launch." };
  }
  let tx: any = null;
  for (let attempt = 0; attempt < 3 && !tx; attempt++) {
    try {
      tx = await rpc("getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      ]);
    } catch {
      tx = null;
    }
    if (!tx && attempt < 2) await new Promise((r) => setTimeout(r, 1200));
  }
  if (!tx) {
    return { ok: false, error: "fee_tx_not_found", message: "Couldn't find the launch-fee transaction yet — wait for it to confirm, then retry." };
  }
  if (tx.meta?.err) {
    return { ok: false, error: "fee_tx_failed", message: "The launch-fee transaction failed on-chain." };
  }
  if (tx.blockTime && Date.now() - tx.blockTime * 1000 > FEE_MAX_AGE_MS) {
    return { ok: false, error: "fee_tx_stale", message: "That launch-fee payment is too old — pay the fee again to launch." };
  }
  const keys = (tx.transaction?.message?.accountKeys || []).map((k: any) =>
    typeof k === "string" ? k : k?.pubkey || k,
  );
  const signer = keys.find((_: string, i: number) => {
    const k = tx.transaction?.message?.accountKeys?.[i];
    return typeof k === "object" && k?.signer;
  }) || keys[0];
  if (String(signer) !== publicKey) {
    return { ok: false, error: "fee_signer_mismatch", message: "The launch fee wasn't paid by the launching wallet." };
  }
  const feeIdx = keys.findIndex((k: string) => String(k) === PLATFORM_WALLET);
  if (feeIdx < 0) {
    return { ok: false, error: "fee_recipient_missing", message: "That transaction didn't pay the platform launch fee." };
  }
  const gained = (Number(tx.meta?.postBalances?.[feeIdx] || 0) - Number(tx.meta?.preBalances?.[feeIdx] || 0)) / 1e9;
  const solUsd = (await fetchSolUsdPrice()) || 0;
  if (!solUsd) {
    return { ok: false, error: "verification_unavailable", message: "Couldn't price SOL to verify the launch fee — retry in a few seconds." };
  }
  const expectedSol = LAUNCH_FEE_USD / solUsd;
  if (!(gained >= expectedSol * 0.8)) {
    return { ok: false, error: "fee_too_small", message: `That transaction paid ${gained.toFixed(4)} SOL to the platform wallet — the launch fee is about ${expectedSol.toFixed(4)} SOL.` };
  }
  usedFeeSignatures.add(signature);
  if (usedFeeSignatures.size > 5000) usedFeeSignatures.clear();
  return { ok: true };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ─── Upload validation (security) ─────────────────────────────────────
 * Token images are pinned to IPFS and served to every visitor of the token
 * page — an SVG/HTML payload here is stored XSS. Enforce an image-only
 * allowlist, a size cap, and magic-byte verification (never trust the
 * client-supplied MIME type or extension).
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGES: Record<string, { ext: string; magic: number[][] }> = {
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/gif": { ext: "gif", magic: [[0x47, 0x49, 0x46, 0x38]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF....WEBP (tail checked below)
};

function matchesMagic(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return false;
  return true;
}

export function validateUploadImage(
  imageBase64: string,
  imageMimeType?: string,
): { ok: true; buffer: Buffer; mime: string; ext: string } | { ok: false; error: string } {
  const mime = String(imageMimeType || "image/png").split(";")[0].trim().toLowerCase();
  const rule = ALLOWED_IMAGES[mime];
  if (!rule) {
    return { ok: false, error: "Unsupported image type. Use PNG, JPG, GIF, or WebP." };
  }
  if (typeof imageBase64 !== "string" || !imageBase64.length) {
    return { ok: false, error: "Missing image data" };
  }
  // Reject oversized payloads before decoding (base64 inflates ~4/3).
  if (imageBase64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4096) {
    return { ok: false, error: "Image must be under 5 MB" };
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(imageBase64, "base64");
  } catch {
    return { ok: false, error: "Invalid base64 image data" };
  }
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be under 5 MB" };
  }
  const magicOk = rule.magic.some((sig) => matchesMagic(buf, sig));
  const webpTailOk =
    mime !== "image/webp" ||
    (buf.length >= 12 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50); // "WEBP"
  if (!magicOk || !webpTailOk) {
    return { ok: false, error: "Image content does not match its declared type" };
  }
  return { ok: true, buffer: buf, mime, ext: rule.ext };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).setHeader("Access-Control-Allow-Origin", "*").end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    const step = body?.step;

    // Per-IP rate limits: the ipfs step spends the server's Pinata
    // quota and the create step proxies PumpPortal — neither is free
    // to flood (audit B7).
    const ip = clientIp(req);
    if (step === "ipfs" && hitAuthLimit(`pump-ipfs:${ip}`, 12, 60 * 60_000)) {
      return res.status(429).json({ error: "Too many metadata uploads — try again later." });
    }
    if (step === "create" && hitAuthLimit(`pump-create:${ip}`, 12, 60 * 60_000)) {
      return res.status(429).json({ error: "Too many launches — try again later." });
    }

    if (step === "ipfs") {
      return await handleIpfs(body, res);
    } else if (step === "create") {
      return await handleCreate(body, res);
    } else {
      return res.status(400).json({ error: "Invalid step. Use 'ipfs' or 'create'." });
    }
  } catch (err: any) {
    console.error("pump-create error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}

/* ─── Step 1: IPFS upload ────────────────────────────────────────────── */

async function handleIpfs(body: any, res: VercelResponse) {
  const { imageBase64, imageMimeType, name, symbol, description, twitter, telegram, website } = body;

  if (!imageBase64 || !name || !symbol) {
    return res.status(400).json({ error: "Missing required fields: imageBase64, name, symbol" });
  }

  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT is not configured on the server");
  }

  // Validate the image (allowlist + size + magic bytes) before touching IPFS.
  const validated = validateUploadImage(imageBase64, imageMimeType);
  if (!validated.ok) {
    return res.status(400).json({ error: validated.error });
  }
  const { buffer: imageBuffer, mime: safeMime, ext } = validated;

  // 1 — pin the image itself to IPFS via Pinata
  const imgForm = new FormData();
  imgForm.append("file", new Blob([imageBuffer], { type: safeMime }), `token.${ext}`);
  imgForm.append("pinataMetadata", JSON.stringify({ name: `${symbol}-image` }));

  const imgRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: imgForm,
  });
  if (!imgRes.ok) {
    const errText = await imgRes.text();
    throw new Error(`Pinata image pin failed (${imgRes.status}): ${errText}`);
  }
  const { IpfsHash: imageHash } = await imgRes.json();
  const imageUri = `https://gateway.pinata.cloud/ipfs/${imageHash}`;

  // 2 — build our OWN metadata JSON with OrbitX attribution baked in via
  // `createdOn`. This is the field pump.fun's site, DexScreener-style
  // aggregators, and third-party trading apps read to show a "Launchpad"
  // badge — same convention bonk.fun/Believe use to brand their own launches.
  // Hosting this ourselves (instead of pump.fun's own /api/ipfs, which sets
  // its own attribution) is what lets that badge say OrbitX.
  const metadata = {
    name,
    symbol,
    description: description || "",
    image: imageUri,
    showName: true,
    // Launchpad attribution — aggregators read createdOn / platformId for the
    // "Launchpad" badge. Hosting on Pinata (not pump.fun /api/ipfs) is what
    // lets the badge say OrbitX instead of pump.fun.
    createdOn: "https://www.orbitx.world",
    platformId: "orbitx",
    platform: "OrbitX",
    website: website || "https://www.orbitx.world",
    external_url: website || "https://www.orbitx.world",
    twitter: twitter || "",
    telegram: telegram || "",
    tags: ["orbitx", "orbitx-launch"],
  };

  const metaRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataMetadata: { name: `${symbol}-metadata` }, pinataContent: metadata }),
  });
  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Pinata metadata pin failed (${metaRes.status}): ${errText}`);
  }
  const { IpfsHash: metaHash } = await metaRes.json();
  const metadataUri = `https://gateway.pinata.cloud/ipfs/${metaHash}`;

  return res.status(200).json({ metadataUri, metadata });
}

/* ─── Step 2: Create token transaction ────────────────────────────── */

async function handleCreate(body: any, res: VercelResponse) {
  const { metadataUri, pair, quoteMint } = body;
  const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
  const mintPublicKey = typeof body.mintPublicKey === "string" ? body.mintPublicKey.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 32) : "";
  const symbol = typeof body.symbol === "string" ? body.symbol.trim().slice(0, 10) : "";

  if (!isPubkey(publicKey) || !metadataUri || !name || !symbol || !isPubkey(mintPublicKey)) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Strict numeric validation (audit B10): a NaN / negative / absurd
  // amount is rejected outright — `devBuySol || 0` used to forward
  // garbage straight to PumpPortal.
  let devBuySol = 0;
  if (body.devBuySol != null && body.devBuySol !== "") {
    const v = validNumber(body.devBuySol, { min: 0, max: 1_000 });
    if (v == null) return res.status(400).json({ error: "bad_dev_buy", message: "Invalid dev-buy amount (SOL)." });
    devBuySol = v;
  }
  let devBuyUsdc = 0;
  if (body.devBuyUsdc != null && body.devBuyUsdc !== "") {
    const v = validNumber(body.devBuyUsdc, { min: 0, max: 10_000_000 });
    if (v == null) return res.status(400).json({ error: "bad_dev_buy", message: "Invalid dev-buy amount (USDC)." });
    devBuyUsdc = v;
  }
  let slippage = 10;
  if (body.slippage != null && body.slippage !== "") {
    const v = validNumber(body.slippage, { min: 0.1, max: 50 });
    if (v == null) return res.status(400).json({ error: "bad_slippage", message: "Invalid slippage (0.1–50%)." });
    slippage = v;
  }

  // Launch-fee proof (audit B7): the fee must have been paid on-chain
  // by the launching wallet — that payment is also this flow's wallet
  // authentication. Skipped only during a server-declared promo
  // (LAUNCH_FEE_USD=0), mirroring the client promo flag.
  if (LAUNCH_FEE_USD > 0) {
    const feeSignature = typeof body.feeSignature === "string" ? body.feeSignature.trim() : "";
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(feeSignature)) {
      return res.status(402).json({
        error: "fee_required",
        message: `Pay the $${LAUNCH_FEE_USD.toFixed(2)} launch fee to the platform wallet first, then retry with its transaction signature.`,
      });
    }
    const fee = await verifyLaunchFee(feeSignature, publicKey);
    if (!fee.ok) {
      return res.status(402).json({ error: fee.error, message: fee.message });
    }
  }

  const useUsdc = String(pair || "").toLowerCase().includes("usdc") || String(quoteMint || "").length > 20;
  const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const payload: Record<string, any> = {
    publicKey,
    action: "create",
    tokenMetadata: {
      name,
      symbol,
      uri: metadataUri,
    },
    mint: mintPublicKey,
    denominatedInSol: useUsdc ? "false" : "true",
    amount: useUsdc ? devBuyUsdc : devBuySol,
    slippage,
    priorityFee: 0.0005,
    pool: "pump",
  };
  if (useUsdc) payload.quoteMint = quoteMint || USDC;

  const ppRes = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!ppRes.ok) {
    const errText = await ppRes.text();
    throw new Error(`PumpPortal create failed (${ppRes.status}): ${errText}`);
  }

  // PumpPortal returns raw transaction bytes
  const txBytes = new Uint8Array(await ppRes.arrayBuffer());
  const txBase64 = Buffer.from(txBytes).toString("base64");

  return res.status(200).json({ transaction: txBase64 });
}
