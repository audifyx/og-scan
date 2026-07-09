import type { VercelRequest, VercelResponse } from "@vercel/node";
import { VersionedTransaction } from "@solana/web3.js";
import { loadVanityConfig, resolveVanityMint } from "./_lib/vanityMint";

/**
 * POST /api/pump-create
 *
 * Steps called from the Launch page:
 *
 * Step 1 — body.step === "ipfs"
 *   Uploads image + metadata JSON to IPFS. Returns { metadataUri }.
 *
 * Step 2 — body.step === "create"
 *   Accepts { publicKey, metadataUri, name, symbol, devBuySol, slippage }.
 *   - Generates a VANITY mint keypair SERVER-SIDE (address ends in the
 *     configured suffix, e.g. ...orb). The secret key never leaves the server.
 *   - Calls PumpPortal /api/trade-local for the unsigned create transaction.
 *   - Partial-signs that transaction with the mint keypair server-side.
 *   Returns { transaction (base64, mint-signed), mintAddress, vanitySource }.
 *   The browser then adds the wallet (fee-payer) signature and broadcasts.
 *
 * Step 3 — body.step === "record"  (optional, best-effort)
 *   Persists the confirmed launch to Supabase after the client broadcasts.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).setHeader("Access-Control-Allow-Origin", "*").end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body;
    switch (body?.step) {
      case "ipfs":
        return await handleIpfs(body, res);
      case "create":
        return await handleCreate(body, res);
      case "record":
        return await handleRecord(body, res);
      default:
        return res.status(400).json({ error: "Invalid step. Use 'ipfs', 'create', or 'record'." });
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

  const ipfsRes = await fetch("https://pump.fun/api/ipfs", { method: "POST", body: imgForm });
  if (!ipfsRes.ok) {
    const errText = await ipfsRes.text();
    throw new Error(`IPFS upload failed (${ipfsRes.status}): ${errText}`);
  }
  const ipfsData = await ipfsRes.json();
  const metadataUri = ipfsData.metadataUri;
  if (!metadataUri) throw new Error("No metadataUri returned from IPFS upload");

  return res.status(200).json({ metadataUri, metadata: ipfsData.metadata || ipfsData });
}

/* ─── Step 2: Create token transaction (vanity mint, server-signed) ──── */

async function handleCreate(body: any, res: VercelResponse) {
  const { publicKey, metadataUri, name, symbol, devBuySol, slippage } = body;
  if (!publicKey || !metadataUri || !name || !symbol) {
    return res.status(400).json({ error: "Missing required fields: publicKey, metadataUri, name, symbol" });
  }

  // 1) Get a vanity mint keypair (pool or live grind) — secret stays here.
  const cfg = loadVanityConfig();
  const mint = await resolveVanityMint(cfg);

  // 2) Ask PumpPortal to build the unsigned create transaction for this mint.
  const payload: Record<string, any> = {
    publicKey,
    action: "create",
    tokenMetadata: { name, symbol, uri: metadataUri },
    mint: mint.address,
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

  // 3) Partial-sign with the mint keypair server-side. The wallet (fee payer)
  //    signature is added later in the browser via Phantom.
  const txBytes = new Uint8Array(await ppRes.arrayBuffer());
  const tx = VersionedTransaction.deserialize(txBytes);
  tx.sign([mint.keypair]);
  const txBase64 = Buffer.from(tx.serialize()).toString("base64");

  return res.status(200).json({
    transaction: txBase64,
    mintAddress: mint.address,
    vanitySource: mint.source,
    vanitySuffix: cfg.suffix,
  });
}

/* ─── Step 3: Persist launch record (best-effort) ────────────────────── */

async function handleRecord(body: any, res: VercelResponse) {
  const { mintAddress, txSignature, name, symbol, launcherWallet, metadataUri } = body;
  if (!mintAddress || !txSignature) {
    return res.status(400).json({ error: "Missing required fields: mintAddress, txSignature" });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    // Not fatal — client keeps its own localStorage copy.
    return res.status(200).json({ recorded: false, reason: "supabase-not-configured" });
  }

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/token_launches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify({
      mint_address: mintAddress,
      tx_signature: txSignature,
      name: name || null,
      symbol: symbol || null,
      launcher_wallet: launcherWallet || null,
      metadata_uri: metadataUri || null,
    }),
  });
  if (!insertRes.ok) {
    console.error("token_launches insert failed:", insertRes.status, await insertRes.text().catch(() => ""));
    return res.status(200).json({ recorded: false });
  }
  return res.status(200).json({ recorded: true });
}
