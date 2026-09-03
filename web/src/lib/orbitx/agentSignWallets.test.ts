import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clearStoredPhantomWallet,
  isJupiterAdapterName,
  pickAutoSignWallet,
  pickJupiterWallet,
  pickPhantomWallet,
  parseAgentSignTradeAmount,
  rankAgentSignWallet,
  shouldClearStoredPhantom,
  shouldSkipWalletAutoConnect,
  sortAgentSignWallets,
  storedAdapterName,
} from "./agentSignWallets";

describe("agentSignWallets", () => {
  it("parses sell percents even when the URL double-encodes %", () => {
    expect(parseAgentSignTradeAmount("sell", "100%")).toBe("100%");
    expect(parseAgentSignTradeAmount("sell", "100%25")).toBe("100%");
    expect(parseAgentSignTradeAmount("sell", "50%")).toBe("50%");
    expect(parseAgentSignTradeAmount("buy", "0.05")).toBe(0.05);
  });
  it("ranks Jupiter first and Phantom last so auto-connect never prefers Phantom", () => {
    expect(rankAgentSignWallet("Jupiter")).toBeLessThan(rankAgentSignWallet("Solflare"));
    expect(rankAgentSignWallet("Solflare")).toBeLessThan(rankAgentSignWallet("Phantom"));
    expect(rankAgentSignWallet("Jupiter Wallet")).toBe(0);
  });

  it("picks Jupiter — never falls through to Phantom on auto-sign", () => {
    expect(pickJupiterWallet([{ name: "Phantom" }, { name: "Jupiter" }])?.name).toBe("Jupiter");
    expect(pickJupiterWallet([{ name: "Phantom" }, { name: "Solflare" }])).toBeNull();
    expect(pickPhantomWallet([{ name: "Jupiter" }, { name: "Phantom" }])?.name).toBe("Phantom");
  });

  it("keeps Phantom on the browser connect list (Jupiter first)", () => {
    const sorted = sortAgentSignWallets(
      [{ name: "Jupiter" }, { name: "Solflare" }, { name: "Phantom" }],
    );
    expect(sorted.map((w) => w.name)).toEqual(["Jupiter", "Solflare", "Phantom"]);
    expect(
      sortAgentSignWallets([{ name: "Jupiter" }, { name: "Phantom" }], true).map((w) => w.name),
    ).toEqual(["Jupiter"]);
    expect(pickAutoSignWallet([{ name: "Phantom" }, { name: "Jupiter" }])?.name).toBe("Jupiter");
    expect(pickAutoSignWallet([{ name: "Phantom" }, { name: "Solflare" }])?.name).toBe("Phantom");
  });

  it("detects WalletProvider's JSON-encoded Phantom localStorage value", () => {
    expect(storedAdapterName(JSON.stringify("Phantom"))).toBe("Phantom");
    expect(shouldClearStoredPhantom(JSON.stringify("Phantom"))).toBe(true);
    expect(shouldClearStoredPhantom(JSON.stringify("Jupiter Wallet"))).toBe(false);
    expect(isJupiterAdapterName("Jupiter")).toBe(true);
  });

  it("skips Phantom autoConnect in Telegram in-app, not in desktop Chrome", () => {
    expect(shouldSkipWalletAutoConnect("Phantom", "/supercomputer/sign", "auto=1", "Mozilla/5.0 Chrome")).toBe(false);
    expect(shouldSkipWalletAutoConnect("Phantom", "/supercomputer/sign", "auto=1", "Telegram")).toBe(true);
    expect(shouldSkipWalletAutoConnect("Phantom Wallet", "/supercomputer/sign", "?auto=true", "TelegramBot")).toBe(true);
    expect(shouldSkipWalletAutoConnect("Jupiter", "/supercomputer/sign", "auto=1", "Telegram")).toBe(false);
    expect(shouldSkipWalletAutoConnect("Jupiter Wallet", "/supercomputer/sign", "auto=1")).toBe(false);
    expect(shouldSkipWalletAutoConnect("Phantom", "/supercomputer/sign", "")).toBe(false);
    expect(shouldSkipWalletAutoConnect("Phantom", "/os", "auto=1", "Telegram")).toBe(false);
  });

  it("clears a stored Phantom adapter name so Jupiter can auto-connect", () => {
    localStorage.setItem("walletName", JSON.stringify("Phantom"));
    clearStoredPhantomWallet();
    expect(localStorage.getItem("walletName")).toBeNull();
    localStorage.setItem("walletName", JSON.stringify("Jupiter"));
    clearStoredPhantomWallet();
    expect(JSON.parse(localStorage.getItem("walletName") || "null")).toBe("Jupiter");
  });

  it("lets the sign page use browser wallets — no Jupiter-only lock", () => {
    const src = readFileSync(resolve(__dirname, "../../pages/AgentSignPage.tsx"), "utf8");
    expect(src).not.toContain("Switch to Jupiter Wallet");
    expect(src).not.toContain("OrbitX swaps sign with Jupiter only");
    expect(src).toContain("pickAutoSignWallet");
    expect(src).toContain("Connect a wallet first");
  });
});
