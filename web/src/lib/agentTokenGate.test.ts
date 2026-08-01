import { describe, expect, it } from "vitest";
import {
  TOKEN_GATE_EXEMPT_WALLETS,
  isAgentHoldExempt,
  isTokenGateExemptEmail,
  isTokenGateExemptWallet,
  normalizeExemptWallet,
  resolveAuthWallet,
} from "./agentTokenGate";
import {
  TOKEN_GATE_EXEMPT_WALLETS_BASE,
  canonicalizeExemptWallet,
  isExemptWalletInList,
} from "../../shared/token-gate-exempt.js";

const J_WALLET = "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb";
const J_LOWER = J_WALLET.toLowerCase();

describe("token gate exempt — j fee wallet", () => {
  it("shared list includes canonical j-wallet exactly once among owner trio", () => {
    expect(TOKEN_GATE_EXEMPT_WALLETS_BASE).toContain(J_WALLET);
    expect(TOKEN_GATE_EXEMPT_WALLETS).toContain(J_WALLET);
    expect(TOKEN_GATE_EXEMPT_WALLETS_BASE).toHaveLength(3);
  });

  it("exempts canonical j-wallet", () => {
    expect(isTokenGateExemptWallet(J_WALLET)).toBe(true);
    expect(isAgentHoldExempt({ wallet: J_WALLET })).toBe(true);
  });

  it("exempts Supabase-lowercased j-wallet (SIWS mangling)", () => {
    expect(isTokenGateExemptWallet(J_LOWER)).toBe(true);
    expect(isExemptWalletInList(J_LOWER, TOKEN_GATE_EXEMPT_WALLETS_BASE)).toBe(true);
    expect(isAgentHoldExempt({ wallet: J_LOWER })).toBe(true);
  });

  it("exempts lowercased SIWS email for j-wallet", () => {
    const email = `${J_LOWER}@wallet.orbitx.app`;
    expect(isTokenGateExemptEmail(email)).toBe(true);
    expect(isAgentHoldExempt({ email })).toBe(true);
  });

  it("canonicalizes lowercased j-wallet back to allowlist spelling", () => {
    expect(canonicalizeExemptWallet(J_LOWER)).toBe(J_WALLET);
    expect(normalizeExemptWallet(J_LOWER)).toBe(J_WALLET);
    expect(
      resolveAuthWallet({
        email: `${J_LOWER}@wallet.orbitx.app`,
      }),
    ).toBe(J_WALLET);
  });

  it("exempts audifyx owner email", () => {
    expect(isAgentHoldExempt({ email: "audifyx@gmail.com" })).toBe(true);
    expect(isAgentHoldExempt({ email: "Audifyx@Gmail.com" })).toBe(true);
  });

  it("does not exempt random wallets", () => {
    expect(isTokenGateExemptWallet("So11111111111111111111111111111111111111112")).toBe(false);
    expect(isAgentHoldExempt({ wallet: "So11111111111111111111111111111111111111112" })).toBe(false);
  });
});
