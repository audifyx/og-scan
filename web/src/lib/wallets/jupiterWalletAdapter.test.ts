import { afterEach, describe, expect, it, vi } from "vitest";
import { Keypair, Transaction } from "@solana/web3.js";
import {
  isJupiterWalletName,
  jupiterSignAndSendTransaction,
  toVersionedTransaction,
} from "./jupiterWalletAdapter";

function unsignedTransfer() {
  const payer = Keypair.generate();
  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
  });
  return { payer, tx };
}

describe("isJupiterWalletName", () => {
  it("matches Jupiter Wallet Standard and legacy adapter names", () => {
    expect(isJupiterWalletName("Jupiter")).toBe(true);
    expect(isJupiterWalletName("Jupiter Wallet")).toBe(true);
    expect(isJupiterWalletName("Phantom")).toBe(false);
  });
});

describe("jupiterSignAndSendTransaction", () => {
  afterEach(() => {
    delete (window as Window & { jupiter?: unknown }).jupiter;
  });

  it("uses object-form signAndSendTransaction (Jupiter Wallet Standard)", async () => {
    const signAndSendTransaction = vi.fn(async (arg: unknown) => {
      if (arg && typeof arg === "object" && "transaction" in (arg as object)) {
        return { signature: "JUP_OBJECT_SIGNATURE_0123456789abcdef" };
      }
      throw new Error("expected object form");
    });
    (window as Window & { jupiter?: { solana: { signAndSendTransaction: typeof signAndSendTransaction } } }).jupiter = {
      solana: { signAndSendTransaction },
    };

    const { tx } = unsignedTransfer();
    const sig = await jupiterSignAndSendTransaction(tx);
    expect(sig).toBe("JUP_OBJECT_SIGNATURE_0123456789abcdef");
    expect(signAndSendTransaction).toHaveBeenCalledTimes(1);
    const arg = signAndSendTransaction.mock.calls[0]?.[0] as { transaction?: unknown };
    expect(arg?.transaction && "version" in arg.transaction).toBe(true);
  });

  it("falls back to positional signAndSendTransaction", async () => {
    const signAndSendTransaction = vi.fn(async (arg: unknown) => {
      if (arg && typeof arg === "object" && "transaction" in (arg as object)) {
        throw new Error("object form not supported");
      }
      return { signature: "JUP_POSITIONAL_SIGNATURE_0123456789ab" };
    });
    (window as Window & { jupiter?: { solana: { signAndSendTransaction: typeof signAndSendTransaction } } }).jupiter = {
      solana: { signAndSendTransaction },
    };

    const { tx } = unsignedTransfer();
    const sig = await jupiterSignAndSendTransaction(toVersionedTransaction(tx));
    expect(sig).toBe("JUP_POSITIONAL_SIGNATURE_0123456789ab");
  });
});
