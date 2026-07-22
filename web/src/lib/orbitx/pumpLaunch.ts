// OrbitX — launch a real pump.fun coin (non-custodial) via the existing
// /api/pump-create (Pinata IPFS + PumpPortal) + /api/vanity-mint flow.
// Reused by the token launchpad AND the NFT marketplace (one coin per collection).
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

export interface PumpLaunchInput {
  connection: Connection;
  publicKey: { toBase58: () => string };
  signTransaction: <T extends VersionedTransaction>(tx: T) => Promise<T>;
  imageBase64: string;          // base64 (no data: prefix)
  imageMimeType: string;
  name: string;
  symbol: string;
  description?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  devBuySol?: number;           // optional creator dev-buy
  onStatus?: (msg: string) => void;
}

export interface PumpLaunchResult { mint: string; signature: string; metadataUri: string }

export async function launchPumpCoin(input: PumpLaunchInput): Promise<PumpLaunchResult> {
  const { connection, publicKey, signTransaction, onStatus } = input;
  const say = (m: string) => onStatus?.(m);

  // 1 — IPFS (image + metadata)
  say("Uploading coin image & metadata to IPFS…");
  const ipfsRes = await fetch("/api/pump-create", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step: "ipfs", imageBase64: input.imageBase64, imageMimeType: input.imageMimeType,
      name: input.name, symbol: input.symbol, description: input.description ?? "",
      twitter: input.twitter ?? "", telegram: input.telegram ?? "", website: input.website ?? "",
    }),
  });
  if (!ipfsRes.ok) throw new Error((await ipfsRes.json().catch(() => ({}))).error || "IPFS upload failed");
  const { metadataUri } = await ipfsRes.json();

  // 2 — mint keypair (vanity 'obx', best-effort; falls back to random)
  say("Generating coin mint address…");
  let mintKeypair: Keypair;
  try {
    const v = await fetch("/api/vanity-mint", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suffix: "obx", maxIterations: 4000000 }),
    });
    if (!v.ok) throw new Error("vanity timeout");
    const { secretKey } = await v.json();
    mintKeypair = Keypair.fromSecretKey(new Uint8Array(bs58.decode(secretKey)));
  } catch {
    mintKeypair = Keypair.generate();
  }

  // 3 — build create tx via PumpPortal
  say("Building coin launch transaction…");
  const createRes = await fetch("/api/pump-create", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step: "create", publicKey: publicKey.toBase58(), metadataUri,
      name: input.name, symbol: input.symbol, mintPublicKey: mintKeypair.publicKey.toBase58(),
      devBuySol: input.devBuySol ?? 0, slippage: 15,
    }),
  });
  if (!createRes.ok) throw new Error((await createRes.json().catch(() => ({}))).error || "Coin transaction build failed");
  const { transaction: txBase64 } = await createRes.json();

  // 4 — sign (mint keypair + wallet) and send
  say("Sign the coin launch in your wallet…");
  const txBytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(txBytes);
  tx.sign([mintKeypair]);
  const signed = await signTransaction(tx);
  say("Broadcasting…");
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
  await connection.confirmTransaction(sig, "confirmed");
  return { mint: mintKeypair.publicKey.toBase58(), signature: sig, metadataUri };
}

export async function urlToBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const mime = blob.type || "image/png";
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), mime };
}
