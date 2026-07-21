// OrbitX NFT Hub — client for the atomic, delegated-authority marketplace
// settlement (nft-execute-sale edge function). See that function's header
// comment for the full trust model. This module never touches a private
// key other than the connected wallet's, via wallet-adapter's signTransaction.
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createApproveInstruction } from "@solana/spl-token";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const FN_URL = `${SUPABASE_URL}/functions/v1/nft-execute-sale`;

async function callFn(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Marketplace request failed");
  return json;
}

export async function getMarketplaceAuthority(): Promise<{ authorityPubkey: string; feeWallet: string }> {
  return callFn({ action: "authority" });
}

/**
 * Seller-side, one-time (per listing) step: approves the OrbitX marketplace
 * authority as an SPL Token delegate over exactly 1 unit of this NFT. This
 * is a normal, revocable `approve` instruction the seller signs themselves —
 * the NFT never leaves the seller's wallet. Required before a buyer can
 * complete a purchase without the seller being online.
 */
export async function approveMarketplaceDelegate(
  connection: Connection,
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>,
  ownerWallet: PublicKey,
  mintAddress: string
): Promise<string> {
  const { authorityPubkey } = await getMarketplaceAuthority();
  const mint = new PublicKey(mintAddress);
  const ownerAta = getAssociatedTokenAddressSync(mint, ownerWallet);
  const tx = new Transaction().add(createApproveInstruction(ownerAta, new PublicKey(authorityPubkey), ownerWallet, 1));
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerWallet;
  const signed = await signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

export interface SaleBreakdown { sellerAmountSol: number; creatorRoyaltySol: number; platformFeeSol: number; totalSol: number }

/**
 * Full buy flow: ask the server to build the canonical settlement
 * transaction, sign it with the connected wallet, then hand the fully
 * signed transaction back to the server to submit + confirm on-chain and
 * record. Returns the on-chain transaction signature once confirmed.
 */
export async function executeSale(
  connection: Connection,
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>,
  mode: "listing" | "offer" | "auction",
  sourceId: string,
  buyerWallet: PublicKey
): Promise<{ signature: string; breakdown: SaleBreakdown }> {
  const built = await callFn({ action: "build", mode, sourceId, buyerWallet: buyerWallet.toString() });
  const raw = Uint8Array.from(atob(built.transactionBase64), (c) => c.charCodeAt(0));
  const tx = Transaction.from(raw);
  const signed = await signTransaction(tx);
  const signedBase64 = signed.serialize({ requireAllSignatures: false }).toString("base64");
  const submitted = await callFn({ action: "submit", pendingSaleId: built.pendingSaleId, signedTransactionBase64: signedBase64 });
  return { signature: submitted.signature, breakdown: built.breakdown };
}
