import { describe, expect, it } from "vitest";
import {
  findStandardWallet,
  resetWalletStandardForTests,
  startWalletStandardDiscovery,
  announceWalletsReady,
} from "./walletStandard";

describe("walletStandard discovery", () => {
  it("registers Jupiter via app-ready detail.register (not CustomEvent)", () => {
    resetWalletStandardForTests();
    window.addEventListener("wallet-standard:app-ready", (event: Event) => {
      expect(event).not.toBeInstanceOf(CustomEvent);
      const detail = (event as { detail?: { register?: (w: unknown) => void } | ((w: unknown) => void) }).detail;
      const wallet = { name: "Jupiter Wallet", accounts: [], features: {} };
      if (typeof detail === "function") detail(wallet);
      else detail?.register?.(wallet);
    });
    startWalletStandardDiscovery();
    announceWalletsReady();
    expect(findStandardWallet("jupiter")?.name).toBe("Jupiter Wallet");
  });
});
