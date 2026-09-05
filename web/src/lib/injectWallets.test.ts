import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectInjectWallet,
  getJupiterProvider,
  getPhantomProvider,
  injectInstallHint,
  isInjectWalletReady,
} from "./injectWallets";

const VALID_PK = "11111111111111111111111111111111";

describe("injectWallets", () => {
  beforeEach(() => {
    delete (window as unknown as { phantom?: unknown }).phantom;
    delete (window as unknown as { jupiter?: unknown }).jupiter;
    delete (window as unknown as { solana?: unknown }).solana;
  });

  it("detects Phantom on window.phantom.solana", () => {
    (window as unknown as { phantom: { solana: { connect: () => Promise<void> } } }).phantom = {
      solana: { connect: async () => {} },
    };
    expect(isInjectWalletReady("phantom")).toBe(true);
    expect(getPhantomProvider()).toBeTruthy();
    expect(getJupiterProvider()).toBeNull();
  });

  it("detects Jupiter on window.jupiter.solana, not Phantom's window.solana", () => {
    (window as unknown as { solana: { isPhantom: boolean; connect: () => Promise<void> } }).solana = {
      isPhantom: true,
      connect: async () => {},
    };
    (window as unknown as { jupiter: { solana: { connect: () => Promise<void> } } }).jupiter = {
      solana: { connect: async () => {} },
    };
    expect(getPhantomProvider()).toBeTruthy();
    expect(getJupiterProvider()).toBeTruthy();
    expect(isInjectWalletReady("jupiter")).toBe(true);
  });

  it("throws an install hint when the extension is missing", async () => {
    await expect(connectInjectWallet("phantom")).rejects.toThrow(/isn't detected/);
    expect(injectInstallHint("jupiter")).toMatch(/Jupiter Wallet extension/);
  });

  it("connects Phantom and reads publicKey from the connect result", async () => {
    const signMessage = vi.fn(async () => new Uint8Array([1, 2, 3]));
    (window as unknown as { phantom: { solana: {
      publicKey: null;
      connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
      signMessage: typeof signMessage;
    } } }).phantom = {
      solana: {
        publicKey: null,
        connect: async () => ({ publicKey: { toBase58: () => VALID_PK } }),
        signMessage,
      },
    };
    const connected = await connectInjectWallet("phantom");
    expect(connected.publicKey).toBe(VALID_PK);
    const sig = await connected.signMessage(new Uint8Array([9]));
    expect(signMessage).toHaveBeenCalledWith(expect.any(Uint8Array), "utf8");
    expect(Array.from(sig)).toEqual([1, 2, 3]);
  });

  it("connects Jupiter via window.jupiter.solana", async () => {
    const signMessage = vi.fn(async () => new Uint8Array([4, 5]));
    const provider = {
      publicKey: { toBase58: () => VALID_PK },
      connect: vi.fn(async () => {}),
      signMessage,
    };
    (window as unknown as { jupiter: { solana: typeof provider } }).jupiter = { solana: provider };
    const connected = await connectInjectWallet("jupiter");
    expect(provider.connect).toHaveBeenCalled();
    expect(connected.publicKey).toBe(VALID_PK);
    await connected.signMessage(new Uint8Array([1]));
    expect(signMessage).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(signMessage.mock.calls[0][1]).toBeUndefined();
  });
});
