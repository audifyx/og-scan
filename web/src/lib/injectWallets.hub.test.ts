import { describe, expect, it } from "vitest";
import { hubWalletFromName, subscribeHubWalletSession } from "./injectWallets";

describe("hubWalletFromName", () => {
  it("maps Phantom and Jupiter family names", () => {
    expect(hubWalletFromName("Phantom")).toBe("phantom");
    expect(hubWalletFromName("Phantom Wallet")).toBe("phantom");
    expect(hubWalletFromName("Jupiter")).toBe("jupiter");
    expect(hubWalletFromName("Jupiter Wallet")).toBe("jupiter");
    expect(hubWalletFromName("Mobile Wallet Adapter")).toBe("jupiter");
  });

  it("rejects every other wallet", () => {
    expect(hubWalletFromName("Solflare")).toBeNull();
    expect(hubWalletFromName("Backpack")).toBeNull();
    expect(hubWalletFromName("Ledger")).toBeNull();
  });

  it("subscribeHubWalletSession unsubscribes", () => {
    const unsub = subscribeHubWalletSession(() => {});
    unsub();
    expect(typeof unsub).toBe("function");
  });
});
