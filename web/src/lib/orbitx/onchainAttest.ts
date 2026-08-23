import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { contentHash, encodeMemo, MEMO_PROGRAM_ID } from "../../../shared/orbitx-onchain.js";
import { confirmSentTransaction, sendWalletTransaction, type WalletSendCaps } from "./sendWalletTx";

export { contentHash, encodeMemo, solscanTxUrl, parseMemo } from "../../../shared/orbitx-onchain.js";

export type AttestKind =
  | "launch"
  | "burn"
  | "claim"
  | "bagwork"
  | "post"
  | "vote"
  | "referral"
  | "reward"
  | "campaign"
  | "game"
  | "swap";

export async function buildMemoAttestationTx(input: {
  connection: Connection;
  payer: PublicKey;
  kind: AttestKind;
  payload: Record<string, unknown>;
}): Promise<{ tx: Transaction; memo: string; hash: string }> {
  const hash = await contentHash(input.payload);
  const memo = encodeMemo({ kind: input.kind, hash });
  const ix = new TransactionInstruction({
    keys: [{ pubkey: input.payer, isSigner: true, isWritable: false }],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(memo, "utf8"),
  });
  const { blockhash, lastValidBlockHeight } = await input.connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: input.payer,
    blockhash,
    lastValidBlockHeight,
  }).add(ix);
  return { tx, memo, hash };
}

export async function sendMemoAttestation(input: {
  connection: Connection;
  payer: PublicKey;
  wallet: WalletSendCaps;
  kind: AttestKind;
  payload: Record<string, unknown>;
}): Promise<{ signature: string; hash: string; memo: string }> {
  const built = await buildMemoAttestationTx(input);
  const raw = await sendWalletTransaction(input.connection, input.wallet, built.tx);
  const signature = await confirmSentTransaction(input.connection, raw, { commitment: "confirmed" });
  return { signature, hash: built.hash, memo: built.memo };
}

export async function indexAttestation(input: {
  signature: string;
  kind?: AttestKind;
  expect_hash?: string;
  ref_id?: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch("/api/orbitx-onchain?action=index", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || `Index failed (${res.status})`);
  return json;
}

/** Index a confirmed economic tx. Never invents a signature — RPC must already have it. */
export async function indexConfirmedTx(input: {
  signature: string;
  kind: AttestKind;
  expect_hash?: string;
  ref_id?: string;
}): Promise<void> {
  try {
    await indexAttestation(input);
  } catch {
    /* index is a cache — the chain remains the authority */
  }
}

export async function verifyOnChain(signature: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/orbitx-onchain?action=verify&signature=${encodeURIComponent(signature)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || "Verification failed");
  return json;
}
