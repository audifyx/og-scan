import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectInjectWallet,
  getJupiterProvider,
  getPhantomProvider,
  injectInstallHint,
  isInjectWalletReady,
} from "./injectWallets";
import { startWalletStandardDiscovery, resetWalletStandardForTests } from "./walletStandard";

const VALID_PK = "11111111111111111111111111111111";

describe("injectWallets", () => {
  beforeEach(() => {
    resetWalletStandardForTests();
    delete (window as unknown as { phantom?: unknown }).phantom;
    delete (window as unknown as { jupiter?: unknown }).jupiter;
    delete (window as unknown as { solana?: unknown }).solana;
    startWalletStandardDiscovery();
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

  it("treats generic window.solana as Jupiter (in-app browser, no isJupiter flag)", () => {
    (window as unknown as { solana: { connect: () => Promise<void> } }).solana = {
      connect: async () => {},
    };
    expect(isInjectWalletReady("jupiter")).toBe(true);
    expect(getJupiterProvider()).toBeTruthy();
    expect(getPhantomProvider()).toBeNull();
  });

  it("treats a signMessage-only inject as ready (connect may be missing)", () => {
    (window as unknown as { phantom: { solana: { signMessage: () => Promise<Uint8Array>; publicKey: { toBase58: () => string } } } }).phantom = {
      solana: {
        publicKey: { toBase58: () => VALID_PK },
        signMessage: async () => new Uint8Array([1]),
      },
    };
    expect(isInjectWalletReady("phantom")).toBe(true);
  });

  it("detects Jupiter via Wallet Standard when window.jupiter is missing", () => {
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
      detail: (register: (wallet: unknown) => void) => register({
        name: "Jupiter Wallet",
        accounts: [],
        features: { "standard:connect": { connect: async () => ({ accounts: [] }) } },
      }),
    }));
    expect(isInjectWalletReady("jupiter")).toBe(true);
    expect(getJupiterProvider()).toBeNull();
  });

  it("detects Phantom via Wallet Standard when window.phantom is missing", () => {
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
      detail: (register: (wallet: unknown) => void) => register({
        name: "Phantom",
        accounts: [],
        features: { "standard:connect": { connect: async () => ({ accounts: [] }) } },
      }),
    }));
    expect(isInjectWalletReady("phantom")).toBe(true);
  });

  it("throws an install hint when the extension is missing", async () => {
    await expect(connectInjectWallet("phantom")).rejects.toThrow(/isn't detected/);
    expect(injectInstallHint("jupiter")).toMatch(/Jupiter/);
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

  it("connects generic window.solana as Jupiter", async () => {
    const signMessage = vi.fn(async () => new Uint8Array([7]));
    (window as unknown as { solana: {
      publicKey: { toBase58: () => string };
      connect: () => Promise<void>;
      signMessage: typeof signMessage;
    } }).solana = {
      publicKey: { toBase58: () => VALID_PK },
      connect: async () => {},
      signMessage,
    };
    const connected = await connectInjectWallet("jupiter");
    expect(connected.publicKey).toBe(VALID_PK);
  });

  it("connects Jupiter through Wallet Standard even when a generic window.solana exists", async () => {
    (window as unknown as { solana: { connect: () => Promise<void> } }).solana = {
      connect: async () => {},
    };
    const connect = vi.fn(async () => ({ accounts: [{ address: VALID_PK }] }));
    const signMessage = vi.fn(async () => [{ signature: new Uint8Array([3, 3]) }]);
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
      detail: (register: (wallet: unknown) => void) => register({
        name: "Jupiter Wallet",
        accounts: [],
        features: {
          "standard:connect": { connect },
          "solana:signMessage": { signMessage },
        },
      }),
    }));
    const connected = await connectInjectWallet("jupiter");
    expect(connect).toHaveBeenCalled();
    expect(connected.publicKey).toBe(VALID_PK);
  });

  it("does not treat a Jupiter swap-widget connect() as a wallet", () => {
    (window as unknown as { jupiter: { connect: () => Promise<void>; init: () => void } }).jupiter = {
      connect: async () => {},
      init: () => {},
    };
    expect(getJupiterProvider()).toBeNull();
    expect(isInjectWalletReady("jupiter")).toBe(false);
  });

  it("connects Phantom through Wallet Standard", async () => {
    const connect = vi.fn(async () => ({ accounts: [{ address: VALID_PK }] }));
    const signMessage = vi.fn(async () => [{ signature: new Uint8Array([9, 8]) }]);
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
      detail: (register: (wallet: unknown) => void) => register({
        name: "Phantom",
        accounts: [],
        features: {
          "standard:connect": { connect },
          "solana:signMessage": { signMessage },
        },
      }),
    }));
    const connected = await connectInjectWallet("phantom");
    expect(connect).toHaveBeenCalled();
    expect(connected.publicKey).toBe(VALID_PK);
    const sig = await connected.signMessage(new Uint8Array([1]));
    expect(Array.from(sig)).toEqual([9, 8]);
  });
});
