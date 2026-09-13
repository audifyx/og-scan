import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TOKEN_GATE_EXEMPT_WALLETS_BASE,
  isTokenGateExemptAny,
  isTokenGateExemptEmail,
  isTokenGateExemptWallet,
  normalizeGateWallet,
  verifyTokenHold,
} from "./token-hold.js";

const J = "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb";
const J_LOWER = J.toLowerCase();
const NON_EXEMPT = "11111111111111111111111111111111";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server token-hold exempt", () => {
  it("lists j fee wallet", () => {
    expect(TOKEN_GATE_EXEMPT_WALLETS_BASE).toContain(J);
  });

  it("exact + lowercased wallet exempt", () => {
    expect(isTokenGateExemptWallet(J)).toBe(true);
    expect(isTokenGateExemptWallet(J_LOWER)).toBe(true);
    expect(normalizeGateWallet(J_LOWER)).toBe(J);
  });

  it("lowercased SIWS email exempt", () => {
    expect(isTokenGateExemptEmail(`${J_LOWER}@wallet.orbitx.app`)).toBe(true);
    expect(
      isTokenGateExemptAny({
        wallets: [],
        email: `${J_LOWER}@wallet.orbitx.app`,
      }),
    ).toBe(true);
  });

  it("verifyTokenHold skips chain check for lowercased j-wallet", async () => {
    const hold = await verifyTokenHold(J_LOWER, "https://www.orbitx.world");
    expect(hold.exempt).toBe(true);
    expect(hold.meetsRequirement).toBe(true);
    expect(hold.wallet).toBe(J);
  });

  it("verifyTokenHold skips for lowercased SIWS email with empty wallet", async () => {
    const hold = await verifyTokenHold("", "https://www.orbitx.world", {
      email: `${J_LOWER}@wallet.orbitx.app`,
    });
    expect(hold.exempt).toBe(true);
    expect(hold.meetsRequirement).toBe(true);
  });

  it("fails closed when strict USD pricing is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const href = String(url);
        const payload = href.includes("/balance")
          ? { token: { uiAmount: 500_000 } }
          : {};
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const hold = await verifyTokenHold(NON_EXEMPT, "https://www.orbitx.world", {
      requireUsdPrice: true,
    });

    expect(hold.meetsRequirement).toBe(false);
    expect(hold.error).toBe("price_unavailable");
  });
});
