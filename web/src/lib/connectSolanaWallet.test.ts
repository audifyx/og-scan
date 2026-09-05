import { describe, expect, it, vi } from "vitest";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import {
  collapseDuplicateWallets,
  connectSolanaWallet,
  findConnectableWallet,
  phantomInstallHint,
  waitForPublicKey,
} from "./connectSolanaWallet";

function mockWallet(name: string, ready: WalletReadyState, connected = false) {
  return {
    readyState: ready,
    adapter: {
      name,
      connected,
      publicKey: connected ? { toBase58: () => "Pk111" } : null,
      connect: vi.fn(async function (this: { connected: boolean; publicKey: any }) {
        this.connected = true;
        this.publicKey = { toBase58: () => `${name}Pk` };
      }),
    } as any,
  };
}

describe("connectSolanaWallet", () => {
  it("prefers Phantom when installed", () => {
    const wallets = [
      mockWallet("Jupiter", WalletReadyState.NotDetected),
      mockWallet("Phantom", WalletReadyState.Installed),
      mockWallet("Solflare", WalletReadyState.Loadable),
    ];
    expect(findConnectableWallet(wallets)?.adapter.name).toBe("Phantom");
  });

  it("matches Jupiter Wallet Standard name when UI asks for Jupiter", () => {
    const wallets = [
      mockWallet("Jupiter Wallet", WalletReadyState.Installed),
      mockWallet("Phantom", WalletReadyState.NotDetected),
    ];
    expect(findConnectableWallet(wallets, "Jupiter")?.adapter.name).toBe("Jupiter Wallet");
    expect(findConnectableWallet(wallets, "Jupiter Wallet")?.adapter.name).toBe("Jupiter Wallet");
  });

  it("prefers the Wallet Standard adapter when Jupiter is listed twice", () => {
    const legacy = mockWallet("Jupiter", WalletReadyState.Installed);
    (legacy.adapter as any).isLegacyInject = true;
    const standard = mockWallet("Jupiter Wallet", WalletReadyState.Installed);
    // Legacy inject first in the list — the Standard one must still win.
    expect(findConnectableWallet([legacy, standard], "Jupiter")?.adapter.name).toBe("Jupiter Wallet");
    // And it is still usable when it is the only one present.
    expect(findConnectableWallet([legacy], "Jupiter")?.adapter.name).toBe("Jupiter");
  });

  it("does not fall through to Solflare when preferred wallet is missing", () => {
    const wallets = [
      mockWallet("Phantom", WalletReadyState.NotDetected),
      mockWallet("Jupiter", WalletReadyState.NotDetected),
      mockWallet("Solflare", WalletReadyState.Installed),
    ];
    expect(findConnectableWallet(wallets, "Phantom")).toBeNull();
    expect(findConnectableWallet(wallets, "Solflare")?.adapter.name).toBe("Solflare");
  });

  it("throws a clear install hint when nothing is ready", async () => {
    const wallets = [mockWallet("Phantom", WalletReadyState.NotDetected)];
    await expect(
      connectSolanaWallet({
        wallets,
        select: vi.fn(),
        connect: vi.fn(async () => {}),
        preferredName: "Phantom",
      }),
    ).rejects.toThrow(/isn't detected/);
    expect(phantomInstallHint("Phantom")).toMatch(/Install the Phantom extension/);
  });

  it("times out when a wallet adapter never responds", async () => {
    vi.useFakeTimers();
    try {
      const wallet = mockWallet("Jupiter", WalletReadyState.Installed);
      wallet.adapter.connect = vi.fn(() => new Promise<void>(() => {}));
      const pending = connectSolanaWallet({
        wallets: [wallet],
        select: vi.fn(),
        connect: vi.fn(() => new Promise<void>(() => {})),
        preferredName: "Jupiter",
      });
      const assertion = expect(pending).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(20_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to adapter.connect when context connect no-ops", async () => {
    const phantom = mockWallet("Phantom", WalletReadyState.Installed);
    const select = vi.fn();
    const connect = vi.fn(async () => {
      /* WalletProvider no-op when wallet state not flushed */
    });
    const pk = await connectSolanaWallet({
      wallets: [phantom],
      select,
      connect,
      preferredName: "Phantom",
    });
    expect(select).toHaveBeenCalledWith("Phantom");
    expect(phantom.adapter.connect).toHaveBeenCalled();
    expect(pk).toBe("PhantomPk");
  });

  it("waits for a public key that appears after connect resolves", async () => {
    vi.useFakeTimers();
    try {
      const phantom = mockWallet("Phantom", WalletReadyState.Installed);
      phantom.adapter.connect = vi.fn(async function (this: { connected: boolean; publicKey: unknown }) {
        this.connected = true;
        this.publicKey = null;
        globalThis.setTimeout(() => {
          this.publicKey = { toBase58: () => "LatePhantomPk111111111111111111111111111" };
        }, 200);
      });
      const pending = connectSolanaWallet({
        wallets: [phantom],
        select: vi.fn(),
        connect: vi.fn(async () => {}),
        preferredName: "Phantom",
      });
      await vi.advanceTimersByTimeAsync(3000);
      await expect(pending).resolves.toBe("LatePhantomPk111111111111111111111111111");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reconnects when the adapter is already connected without a public key", async () => {
    const phantom = mockWallet("Phantom", WalletReadyState.Installed, true);
    phantom.adapter.publicKey = null;
    phantom.adapter.disconnect = vi.fn(async function (this: { connected: boolean }) {
      this.connected = false;
    });
    phantom.adapter.connect = vi.fn(async function (this: { connected: boolean; publicKey: unknown }) {
      this.connected = true;
      this.publicKey = { toBase58: () => "ReconnectedPk11111111111111111111111111" };
    });
    const pk = await connectSolanaWallet({
      wallets: [phantom],
      select: vi.fn(),
      connect: vi.fn(async () => {}),
      preferredName: "Phantom",
    });
    expect(phantom.adapter.disconnect).toHaveBeenCalled();
    expect(phantom.adapter.connect).toHaveBeenCalled();
    expect(pk).toBe("ReconnectedPk11111111111111111111111111");
  });

  it("collapseDuplicateWallets keeps Installed Wallet Standard over NotDetected legacy", () => {
    const legacy = mockWallet("Phantom", WalletReadyState.NotDetected);
    (legacy.adapter as { isLegacyInject?: boolean }).isLegacyInject = true;
    const standard = mockWallet("Phantom", WalletReadyState.Installed);
    const collapsed = collapseDuplicateWallets([legacy, standard]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].readyState).toBe(WalletReadyState.Installed);
    expect(collapsed[0].adapter.isLegacyInject).toBeFalsy();
  });

  it("collapseDuplicateWallets merges Jupiter and Jupiter Wallet", () => {
    const legacy = mockWallet("Jupiter", WalletReadyState.NotDetected);
    (legacy.adapter as { isLegacyInject?: boolean }).isLegacyInject = true;
    const standard = mockWallet("Jupiter Wallet", WalletReadyState.Installed);
    const collapsed = collapseDuplicateWallets([legacy, standard]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].adapter.name).toBe("Jupiter Wallet");
  });

  it("waitForPublicKey returns null when the adapter never hydrates", async () => {
    vi.useFakeTimers();
    try {
      const phantom = mockWallet("Phantom", WalletReadyState.Installed);
      phantom.adapter.publicKey = null;
      const pending = waitForPublicKey(phantom.adapter, 250);
      const assertion = expect(pending).resolves.toBeNull();
      await vi.advanceTimersByTimeAsync(400);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
