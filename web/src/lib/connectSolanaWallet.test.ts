import { describe, expect, it, vi } from "vitest";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import {
  collapseDuplicateWallets,
  connectInjectedWallet,
  connectSolanaWallet,
  findConnectableWallet,
  isInjectedWalletPresent,
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
    delete (window as unknown as { phantom?: unknown }).phantom;
    delete (window as unknown as { solana?: unknown }).solana;
    await expect(
      connectSolanaWallet({
        select: vi.fn(),
        connect: vi.fn(async () => {}),
        preferredName: "Phantom",
      }),
    ).rejects.toThrow(/isn't detected/);
    expect(phantomInstallHint("Phantom")).toMatch(/Install the Phantom extension/);
  });

  it("rejects wallets other than Phantom and Jupiter", async () => {
    await expect(connectSolanaWallet({ preferredName: "Solflare" })).rejects.toThrow(/Phantom and Jupiter only/);
  });

  it("times out when context connect never responds", async () => {
    vi.useFakeTimers();
    try {
      const pending = connectSolanaWallet({
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

  it("uses context public key when connect hydrates it", async () => {
    const select = vi.fn();
    const pk = await connectSolanaWallet({
      select,
      connect: vi.fn(async () => {}),
      preferredName: "Phantom",
      getContextPublicKey: () => "CtxPk111111111111111111111111111111111",
    });
    expect(select).toHaveBeenCalledWith("Phantom");
    expect(pk).toBe("CtxPk111111111111111111111111111111111");
  });

  it("connects Phantom via inject when context connect returns no key", async () => {
    const VALID = "11111111111111111111111111111111";
    (window as unknown as { phantom: { solana: {
      publicKey: { toBase58: () => string };
      connect: () => Promise<void>;
      signMessage: () => Promise<Uint8Array>;
    } } }).phantom = {
      solana: {
        publicKey: { toBase58: () => VALID },
        connect: async () => {},
        signMessage: async () => new Uint8Array([1]),
      },
    };
    try {
      const pk = await connectSolanaWallet({
        select: vi.fn(),
        connect: vi.fn(async () => {}),
        preferredName: "Phantom",
      });
      expect(pk).toBe(VALID);
    } finally {
      delete (window as unknown as { phantom?: unknown }).phantom;
    }
  });

  it("connectInjectedWallet uses window.phantom.solana and returns a signer", async () => {
    const provider = {
      publicKey: null as { toBase58: () => string } | null,
      connect: vi.fn(async function (this: { publicKey: { toBase58: () => string } | null }) {
        this.publicKey = { toBase58: () => "InjectedPk111111111111111111111111111" };
        return { publicKey: this.publicKey };
      }),
      signMessage: vi.fn(async () => new Uint8Array([9, 8, 7])),
    };
    (window as unknown as { phantom?: { solana: typeof provider } }).phantom = { solana: provider };
    try {
      expect(isInjectedWalletPresent("Phantom")).toBe(true);
      const injected = await connectInjectedWallet("Phantom");
      expect(provider.connect).toHaveBeenCalled();
      expect(injected?.publicKey).toBe("InjectedPk111111111111111111111111111");
      const sig = await injected!.signMessage(new Uint8Array([1]));
      expect(Array.from(sig)).toEqual([9, 8, 7]);
    } finally {
      delete (window as unknown as { phantom?: unknown }).phantom;
    }
  });

  it("connectInjectedWallet returns null when no extension is present", async () => {
    delete (window as unknown as { phantom?: unknown }).phantom;
    delete (window as unknown as { solana?: unknown }).solana;
    expect(isInjectedWalletPresent("Phantom")).toBe(false);
    await expect(connectInjectedWallet("Phantom")).resolves.toBeNull();
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
