import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, Transaction } from "@solana/web3.js";
import {
  serializeSigned,
  sendWalletTransaction,
  shouldUseJupiterInject,
  toVersionedTransaction,
  transactionFeePayer,
  confirmSentTransaction,
} from "./sendWalletTx";
import {
  getJupiterProvider,
  jupiterProviderPublicKey,
  jupiterSignAndSendTransaction,
} from "@/lib/wallets/jupiterWalletAdapter";

vi.mock("@/lib/wallets/jupiterWalletAdapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wallets/jupiterWalletAdapter")>();
  return {
    ...actual,
    getJupiterProvider: vi.fn(() => null),
    jupiterProviderPublicKey: vi.fn(() => null),
    jupiterSignAndSendTransaction: vi.fn(),
  };
});

const OWNER = "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb";

function unsignedTransfer() {
  const payer = Keypair.generate();
  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
  });
  return { payer, tx };
}

describe("toVersionedTransaction", () => {
  it("compiles a legacy burn-style tx so Jupiter does not serialize unsigned legacy bytes", () => {
    const { payer, tx } = unsignedTransfer();
    const vtx = toVersionedTransaction(tx);
    expect("version" in vtx).toBe(true);
    expect(transactionFeePayer(vtx)).toBe(payer.publicKey.toBase58());
  });
});

describe("serializeSigned", () => {
  it("rejects an unsigned legacy tx instead of sending it", () => {
    const { payer, tx } = unsignedTransfer();
    expect(() => serializeSigned(tx)).toThrow(
      new RegExp(`missing signature for ${payer.publicKey.toBase58()}`),
    );
  });

});

describe("shouldUseJupiterInject", () => {
  beforeEach(() => {
    vi.mocked(getJupiterProvider).mockReturnValue(null);
    vi.mocked(jupiterProviderPublicKey).mockReturnValue(null);
  });

  it("uses Jupiter when the adapter name is Jupiter and the inject exists", () => {
    vi.mocked(getJupiterProvider).mockReturnValue({
      signAndSendTransaction: vi.fn(),
    } as never);
    expect(shouldUseJupiterInject({ walletName: "Jupiter Wallet" })).toBe(true);
    expect(shouldUseJupiterInject({ walletName: "Jupiter" })).toBe(true);
  });

  it("uses Jupiter inject when preferJupiter is set — even if Phantom was stored", () => {
    vi.mocked(getJupiterProvider).mockReturnValue({
      signAndSendTransaction: vi.fn(),
    } as never);
    vi.mocked(jupiterProviderPublicKey).mockReturnValue(OWNER);
    expect(shouldUseJupiterInject({ preferJupiter: true, walletName: "Phantom" }, OWNER)).toBe(true);
    expect(shouldUseJupiterInject({ preferJupiter: true, preferPhantom: true, walletName: "Jupiter" })).toBe(true);
  });

  it("never hijacks Phantom unless preferJupiter is set", () => {
    vi.mocked(getJupiterProvider).mockReturnValue({
      signAndSendTransaction: vi.fn(),
    } as never);
    vi.mocked(jupiterProviderPublicKey).mockReturnValue(OWNER);
    expect(shouldUseJupiterInject({ walletName: "Phantom" }, OWNER)).toBe(false);
    expect(shouldUseJupiterInject({ walletName: "Phantom Wallet" }, OWNER)).toBe(false);
    expect(shouldUseJupiterInject({ preferPhantom: true, walletName: "Jupiter" }, OWNER)).toBe(false);
  });

  it("uses Jupiter when the fee payer is the Jupiter inject and the adapter is not Phantom", () => {
    vi.mocked(getJupiterProvider).mockReturnValue({
      signAndSendTransaction: vi.fn(),
    } as never);
    vi.mocked(jupiterProviderPublicKey).mockReturnValue(OWNER);
    expect(shouldUseJupiterInject({ walletName: "Solflare" }, OWNER)).toBe(true);
  });

  it("does not steal Phantom sends when Jupiter is a different key", () => {
    vi.mocked(getJupiterProvider).mockReturnValue({
      signAndSendTransaction: vi.fn(),
    } as never);
    vi.mocked(jupiterProviderPublicKey).mockReturnValue("11111111111111111111111111111111");
    expect(shouldUseJupiterInject({ walletName: "Phantom" }, OWNER)).toBe(false);
  });
});

describe("sendWalletTransaction", () => {
  beforeEach(() => {
    vi.mocked(getJupiterProvider).mockReturnValue(null);
    vi.mocked(jupiterProviderPublicKey).mockReturnValue(null);
    vi.mocked(jupiterSignAndSendTransaction).mockReset();
  });

  it("sends via Jupiter signAndSend — never signTransaction + sendRaw", async () => {
    vi.mocked(getJupiterProvider).mockReturnValue({
      signAndSendTransaction: vi.fn(),
    } as never);
    vi.mocked(jupiterSignAndSendTransaction).mockResolvedValue("JUPITER_SIG");
    const { tx } = unsignedTransfer();
    const connection = { sendRawTransaction: vi.fn() };
    const signTransaction = vi.fn();

    const sig = await sendWalletTransaction(
      connection as never,
      { walletName: "Jupiter", signTransaction },
      tx,
    );

    expect(sig).toBe("JUPITER_SIG");
    expect(jupiterSignAndSendTransaction).toHaveBeenCalled();
    expect(signTransaction).not.toHaveBeenCalled();
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("passes a versioned tx to adapter sendTransaction when Jupiter inject is absent", async () => {
    const { tx } = unsignedTransfer();
    const sendTransaction = vi.fn().mockResolvedValue("ADAPTER_SIG");
    const connection = { sendRawTransaction: vi.fn() };

    const sig = await sendWalletTransaction(
      connection as never,
      { walletName: "Phantom", sendTransaction },
      tx,
    );

    expect(sig).toBe("ADAPTER_SIG");
    const sent = sendTransaction.mock.calls[0]?.[0];
    expect(sent && "version" in sent).toBe(true);
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("sends via Jupiter inject when preferJupiter is set even if Phantom adapter is named", async () => {
    vi.mocked(getJupiterProvider).mockReturnValue({
      signAndSendTransaction: vi.fn(),
    } as never);
    vi.mocked(jupiterProviderPublicKey).mockReturnValue(OWNER);
    vi.mocked(jupiterSignAndSendTransaction).mockResolvedValue("JUPITER_SIG");
    const sendTransaction = vi.fn().mockResolvedValue("PHANTOM_SIG");
    const { tx } = unsignedTransfer();
    const sig = await sendWalletTransaction(
      { sendRawTransaction: vi.fn() } as never,
      { walletName: "Phantom", preferJupiter: true, sendTransaction },
      tx,
    );
    expect(sig).toBe("JUPITER_SIG");
    expect(jupiterSignAndSendTransaction).toHaveBeenCalled();
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it("sends Phantom adapter txs even when Jupiter inject is present", async () => {
    vi.mocked(getJupiterProvider).mockReturnValue({
      signAndSendTransaction: vi.fn(),
    } as never);
    vi.mocked(jupiterProviderPublicKey).mockReturnValue(OWNER);
    vi.mocked(jupiterSignAndSendTransaction).mockResolvedValue("JUPITER_SHOULD_NOT_RUN");
    const sendTransaction = vi.fn().mockResolvedValue("PHANTOM_SIG");
    const { tx } = unsignedTransfer();
    const sig = await sendWalletTransaction(
      { sendRawTransaction: vi.fn() } as never,
      { walletName: "Phantom", preferPhantom: true, sendTransaction },
      tx,
    );
    expect(sig).toBe("PHANTOM_SIG");
    expect(jupiterSignAndSendTransaction).not.toHaveBeenCalled();
    expect(sendTransaction).toHaveBeenCalled();
  });

  it("normalizes Phantom base64 sendTransaction results to base58", async () => {
    const bytes = new Uint8Array(64).fill(9);
    const b64 = btoa(String.fromCharCode(...bytes));
    const sendTransaction = vi.fn().mockResolvedValue(b64);
    const { tx } = unsignedTransfer();
    const sig = await sendWalletTransaction(
      { sendRawTransaction: vi.fn() } as never,
      { walletName: "Phantom", sendTransaction },
      tx,
    );
    expect(sig).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(sig).not.toContain("/");
  });
});

describe("confirmSentTransaction", () => {
  it("confirms with a base58 signature even when Phantom returned base64", async () => {
    const bytes = new Uint8Array(64).fill(3);
    const b64 = btoa(String.fromCharCode(...bytes));
    const confirmTransaction = vi.fn().mockResolvedValue({ value: { err: null } });
    const connection = { confirmTransaction, getSignatureStatus: vi.fn() };
    const sig = await confirmSentTransaction(connection as never, b64);
    expect(sig).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(confirmTransaction.mock.calls[0]?.[0]).toBe(sig);
    expect(String(confirmTransaction.mock.calls[0]?.[0])).not.toContain("/");
  });

  it("treats a landed tx as success when confirm throws the base58 encoding error", async () => {
    const bytes = new Uint8Array(64).fill(4);
    const b64 = btoa(String.fromCharCode(...bytes));
    const confirmTransaction = vi.fn().mockRejectedValue(new Error(`signature must be base58 encoded: ${b64}`));
    const getSignatureStatus = vi.fn().mockResolvedValue({ value: { err: null, confirmationStatus: "confirmed" } });
    const sig = await confirmSentTransaction({ confirmTransaction, getSignatureStatus } as never, b64);
    expect(sig).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
  });
});
