// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { toVersionedTransaction } from "./jupiterWalletAdapter";

const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/** A legacy tx that needs the wallet AND an ephemeral signer, e.g. a new mint. */
function legacyWithExtraSigner() {
  const payer = Keypair.generate();
  const extra = Keypair.generate();
  const tx = new Transaction();
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = "11111111111111111111111111111111";
  tx.add(
    new TransactionInstruction({
      programId: MEMO,
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: extra.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from([1, 2, 3]),
    }),
  );
  tx.partialSign(extra);
  return { tx, payer, extra };
}

describe("toVersionedTransaction", () => {
  it("keeps signatures that were already applied", () => {
    const { tx, extra } = legacyWithExtraSigner();
    expect(tx.signatures.filter((s) => s.signature).length).toBe(1);

    const versioned = toVersionedTransaction(tx);
    const idx = versioned.message.staticAccountKeys.findIndex((k) => k.equals(extra.publicKey));
    expect(idx).toBeGreaterThanOrEqual(0);
    // Must survive the conversion, or Jupiter reports "missing signature for
    // public key" and signing fails in the browser.
    expect(versioned.signatures[idx].some((b) => b !== 0)).toBe(true);
  });

  it("passes versioned transactions through untouched", () => {
    const { tx } = legacyWithExtraSigner();
    const versioned = toVersionedTransaction(tx);
    expect(versioned).toBeInstanceOf(VersionedTransaction);
    expect(toVersionedTransaction(versioned)).toBe(versioned);
  });

  it("refuses a legacy transaction that cannot be compiled", () => {
    expect(() => toVersionedTransaction(new Transaction())).toThrow(/feePayer/);
  });
});
