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

  // Convert base64 to buffer
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const ext = (imageMimeType || "image/png").split("/")[1] || "png";

  // 1 — pin the image itself to IPFS via Pinata
  const imgForm = new FormData();
  imgForm.append("file", new Blob([imageBuffer], { type: imageMimeType || "image/png" }), `token.${ext}`);
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
    createdOn: "https://orbitx.world",
    website: website || "https://orbitx.world",
    twitter: twitter || "",
    telegram: telegram || "",
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
