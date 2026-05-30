import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/pump-create
 *
 * Two-step flow called from the Launch page:
 *
 * Step 1 — body.step === "ipfs"
 *   Accepts multipart/form-data with an "image" file + metadata fields.
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

  // Convert base64 to buffer
  const imageBuffer = Buffer.from(imageBase64, "base64");

  // Upload image to PumpPortal's IPFS
  const imgForm = new FormData();
  const ext = (imageMimeType || "image/png").split("/")[1] || "png";
  imgForm.append("file", new Blob([imageBuffer], { type: imageMimeType || "image/png" }), `token.${ext}`);
  imgForm.append("name", name);
  imgForm.append("symbol", symbol);
  imgForm.append("description", description || "");
  imgForm.append("twitter", twitter || "");
  imgForm.append("telegram", telegram || "");
  imgForm.append("website", website || "");
  imgForm.append("showName", "true");

  const ipfsRes = await fetch("https://pump.fun/api/ipfs", {
    method: "POST",
    body: imgForm,
  });

  if (!ipfsRes.ok) {
    const errText = await ipfsRes.text();
    throw new Error(`IPFS upload failed (${ipfsRes.status}): ${errText}`);
  }

  const ipfsData = await ipfsRes.json();
  // Returns { metadata: { name, symbol, description, image, showName, createdOn, ... }, metadataUri: "https://..." }
  const metadataUri = ipfsData.metadataUri;

  if (!metadataUri) {
    throw new Error("No metadataUri returned from IPFS upload");
  }

  return res.status(200).json({ metadataUri, metadata: ipfsData.metadata || ipfsData });
}

/* ─── Step 2: Create token transaction ────────────────────────────── */

async function handleCreate(body: any, res: VercelResponse) {
  const { publicKey, metadataUri, name, symbol, mintPublicKey, devBuySol, slippage } = body;

  if (!publicKey || !metadataUri || !name || !symbol || !mintPublicKey) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const payload: Record<string, any> = {
    publicKey,
    action: "create",
    tokenMetadata: {
      name,
      symbol,
      uri: metadataUri,
    },
    mint: mintPublicKey,
    denominatedInSol: "true",
    amount: devBuySol || 0,
    slippage: slippage || 10,
    priorityFee: 0.0005,
    pool: "pump",
  };

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
