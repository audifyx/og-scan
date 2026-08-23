import { describe, expect, it, vi } from "vitest";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import {
  connectSolanaWallet,
  findConnectableWallet,
  phantomInstallHint,
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
});
