import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Keypair, VersionedTransaction, Connection } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * POST /api/pump-create
 *
 * Three flows:
 *
 * Step 1 — body.step === "ipfs"
 *   Uploads image + metadata to IPFS via pump.fun.
 *   Returns { metadataUri: string }.
 *
 * Step 2 — body.step === "create"
 *   Builds an unsigned transaction via PumpPortal /api/trade-local.
 *   Returns the serialized transaction as base64 so the browser can sign with Phantom.
 *
 * Step 3 — body.step === "admin-launch"
 *   Admin-only: performs IPFS upload + token creation + signing + broadcast in one shot.
 *   Uses the project wallet to sign (no browser wallet needed, no fee).
 *   Returns { mintAddress, txSignature, metadataUri }.
 */

/* ─── Admin wallet (project treasury) ─── */
const ADMIN_WALLET_SECRET = "4DZVoc9cEwAGMBrDd66FieHnSFBKccfmxAfPgp3wRaY8xW7CDCZcukvsi3FtDQzRJDTS8pbwPEonwzAHsr6bBEaz";
const ADMIN_EMAIL = "audifyx@gmail.com";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=***REMOVED_HELIUS_KEY***";

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
    } else if (step === "admin-launch") {
      return await handleAdminLaunch(body, res);
    } else {
      return res.status(400).json({ error: "Invalid step. Use 'ipfs', 'create', or 'admin-launch'." });
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

/* ─── Step 3: Admin full launch (IPFS + create + sign + send) ──────── */

async function handleAdminLaunch(body: any, res: VercelResponse) {
  const {
    adminEmail, imageBase64, imageMimeType,
    name, symbol, description,
    twitter, telegram, website,
    devBuySol, slippage,
  } = body;

  // Verify admin email
  if (adminEmail !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Unauthorized — admin only" });
  }

  if (!imageBase64 || !name || !symbol) {
    return res.status(400).json({ error: "Missing required fields: imageBase64, name, symbol" });
  }

  // 1. Reconstruct admin keypair
  const adminKeypair = Keypair.fromSecretKey(bs58.decode(ADMIN_WALLET_SECRET));
  const adminPubkey = adminKeypair.publicKey.toBase58();

  // 2. Generate a fresh mint keypair
  const mintKeypair = Keypair.generate();
  const mintAddress = mintKeypair.publicKey.toBase58();

  // 3. IPFS upload
  const imageBuffer = Buffer.from(imageBase64, "base64");
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
  const metadataUri = ipfsData.metadataUri;
  if (!metadataUri) throw new Error("No metadataUri returned from IPFS upload");

  // 4. Build unsigned transaction via PumpPortal
  const payload: Record<string, any> = {
    publicKey: adminPubkey,
    action: "create",
    tokenMetadata: { name, symbol, uri: metadataUri },
    mint: mintAddress,
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

  // 5. Deserialize + sign with both admin wallet and mint keypair
  const txBytes = new Uint8Array(await ppRes.arrayBuffer());
  const tx = VersionedTransaction.deserialize(txBytes);
  tx.sign([mintKeypair, adminKeypair]);

  // 6. Send to Solana
  const connection = new Connection(HELIUS_RPC, "confirmed");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  // 7. Confirm
  const confirmation = await connection.confirmTransaction(sig, "confirmed");
  if (confirmation.value.err) {
    throw new Error("Transaction failed on-chain: " + JSON.stringify(confirmation.value.err));
  }

  return res.status(200).json({
    mintAddress,
    txSignature: sig,
    metadataUri,
    wallet: adminPubkey,
  });
}
