import type { VercelRequest, VercelResponse } from "@vercel/node";

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
 *   Accepts JSON with { publicKey, metadataUri, name, symbol, mintPublicKey, devBuySol, slippage }.
 *   Calls PumpPortal /api/trade-local to get the unsigned transaction.
 *   Returns the serialized transaction as base64 so the browser can sign with Phantom.
 */

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
  const { publicKey, metadataUri, name, symbol, mintPublicKey, devBuySol, devBuyUsdc, slippage, pair, quoteMint } = body;

  if (!publicKey || !metadataUri || !name || !symbol || !mintPublicKey) {
    return res.status(400).json({ error: "Missing required fields" });
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
    amount: useUsdc ? (devBuyUsdc || 0) : (devBuySol || 0),
    slippage: slippage || 10,
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
