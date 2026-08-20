import { describe, expect, it } from "vitest";
import {
  clearStoredJupiterWallet,
  isJupiterAdapterName,
  pickPhantomWallet,
  rankAgentSignWallet,
  shouldClearStoredJupiter,
  shouldSkipWalletAutoConnect,
  sortAgentSignWallets,
  storedAdapterName,
} from "./agentSignWallets";

describe("agentSignWallets", () => {
  it("ranks Phantom first and Jupiter last so auto-connect never prefers Jupiter", () => {
    expect(rankAgentSignWallet("Phantom")).toBeLessThan(rankAgentSignWallet("Solflare"));
    expect(rankAgentSignWallet("Solflare")).toBeLessThan(rankAgentSignWallet("Jupiter"));
    expect(rankAgentSignWallet("Jupiter Wallet")).toBe(2);
  });

  it("picks Phantom only — never falls through to Jupiter", () => {
    expect(pickPhantomWallet([{ name: "Jupiter" }, { name: "Phantom" }])?.name).toBe("Phantom");
    expect(pickPhantomWallet([{ name: "Jupiter" }, { name: "Solflare" }])).toBeNull();
  });

  it("hides Jupiter on auto-sign connect lists", () => {
    const sorted = sortAgentSignWallets(
      [{ name: "Jupiter" }, { name: "Solflare" }, { name: "Phantom" }],
      true,
    );
    expect(sorted.map((w) => w.name)).toEqual(["Phantom", "Solflare"]);
  });

  it("detects WalletProvider's JSON-encoded Jupiter localStorage value", () => {
    expect(storedAdapterName(JSON.stringify("Jupiter"))).toBe("Jupiter");
    expect(shouldClearStoredJupiter(JSON.stringify("Jupiter Wallet"))).toBe(true);
    expect(shouldClearStoredJupiter(JSON.stringify("Phantom"))).toBe(false);
    expect(isJupiterAdapterName("Jupiter")).toBe(true);
  });

  it("skips Jupiter autoConnect only on /agent/sign?auto=1", () => {
    expect(shouldSkipWalletAutoConnect("Jupiter", "/agent/sign", "auto=1")).toBe(true);
    expect(shouldSkipWalletAutoConnect("Jupiter Wallet", "/agent/sign", "?auto=true")).toBe(true);
    expect(shouldSkipWalletAutoConnect("Phantom", "/agent/sign", "auto=1")).toBe(false);
    expect(shouldSkipWalletAutoConnect("Jupiter", "/agent/sign", "")).toBe(false);
    expect(shouldSkipWalletAutoConnect("Jupiter", "/os", "auto=1")).toBe(false);
  });

  it("clears a stored Jupiter adapter name", () => {
    localStorage.setItem("walletName", JSON.stringify("Jupiter"));
    clearStoredJupiterWallet();
    expect(localStorage.getItem("walletName")).toBeNull();
    localStorage.setItem("walletName", JSON.stringify("Phantom"));
    clearStoredJupiterWallet();
    expect(JSON.parse(localStorage.getItem("walletName") || "null")).toBe("Phantom");
  });
});
