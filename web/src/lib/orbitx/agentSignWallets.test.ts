import { describe, expect, it } from "vitest";
import {
  clearStoredPhantomWallet,
  isJupiterAdapterName,
  pickJupiterWallet,
  rankAgentSignWallet,
  shouldClearStoredPhantom,
  shouldSkipWalletAutoConnect,
  sortAgentSignWallets,
  storedAdapterName,
} from "./agentSignWallets";

describe("agentSignWallets", () => {
  it("ranks Jupiter first and Phantom last so auto-connect never prefers Phantom", () => {
    expect(rankAgentSignWallet("Jupiter")).toBeLessThan(rankAgentSignWallet("Solflare"));
    expect(rankAgentSignWallet("Solflare")).toBeLessThan(rankAgentSignWallet("Phantom"));
    expect(rankAgentSignWallet("Jupiter Wallet")).toBe(0);
  });

  it("picks installed Jupiter only — never falls through to Phantom", () => {
    expect(
      pickJupiterWallet([
        { name: "Phantom", readyState: "Installed" },
        { name: "Jupiter", readyState: "Installed" },
      ])?.name,
    ).toBe("Jupiter");
    expect(pickJupiterWallet([{ name: "Phantom", readyState: "Installed" }])).toBeNull();
    expect(
      pickJupiterWallet([
        { name: "Jupiter", readyState: "NotDetected" },
        { name: "Jupiter Wallet", readyState: "Installed" },
      ])?.name,
    ).toBe("Jupiter Wallet");
  });

  it("hides Phantom on auto-sign connect lists", () => {
    const sorted = sortAgentSignWallets(
      [{ name: "Jupiter" }, { name: "Solflare" }, { name: "Phantom" }],
      true,
    );
    expect(sorted.map((w) => w.name)).toEqual(["Jupiter", "Solflare"]);
  });

  it("detects WalletProvider's JSON-encoded Phantom localStorage value", () => {
    expect(storedAdapterName(JSON.stringify("Phantom"))).toBe("Phantom");
    expect(shouldClearStoredPhantom(JSON.stringify("Phantom Wallet"))).toBe(true);
    expect(shouldClearStoredPhantom(JSON.stringify("Jupiter"))).toBe(false);
    expect(isJupiterAdapterName("Jupiter")).toBe(true);
  });

  it("skips Phantom autoConnect only on /agent/sign?auto=1", () => {
    expect(shouldSkipWalletAutoConnect("Phantom", "/agent/sign", "auto=1")).toBe(true);
    expect(shouldSkipWalletAutoConnect("Phantom Wallet", "/agent/sign", "?auto=true")).toBe(true);
    expect(shouldSkipWalletAutoConnect("Jupiter", "/agent/sign", "auto=1")).toBe(false);
    expect(shouldSkipWalletAutoConnect("Phantom", "/agent/sign", "")).toBe(false);
    expect(shouldSkipWalletAutoConnect("Phantom", "/os", "auto=1")).toBe(false);
  });

  it("clears a stored Phantom adapter name", () => {
    localStorage.setItem("walletName", JSON.stringify("Phantom"));
    clearStoredPhantomWallet();
    expect(localStorage.getItem("walletName")).toBeNull();
    localStorage.setItem("walletName", JSON.stringify("Jupiter"));
    clearStoredPhantomWallet();
    expect(JSON.parse(localStorage.getItem("walletName") || "null")).toBe("Jupiter");
  });
});
