import { afterEach, describe, expect, it } from "vitest";
import {
  decryptSecretBytes,
  encryptSecretBytes,
  tryAutoExecuteTrade,
} from "../../api/orbitx/telegram-auto-trade.js";

const PREV_KEY = process.env.TELEGRAM_AUTO_TRADE_KEY;
const PREV_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("telegram auto-trade wrap + execute", () => {
  afterEach(() => {
    if (PREV_KEY == null) delete process.env.TELEGRAM_AUTO_TRADE_KEY;
    else process.env.TELEGRAM_AUTO_TRADE_KEY = PREV_KEY;
    if (PREV_SERVICE == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = PREV_SERVICE;
  });

  it("round-trips secret bytes with AES-GCM", () => {
    process.env.TELEGRAM_AUTO_TRADE_KEY = "test-wrap-key-orbitx-auto-trade";
    const secret = new Uint8Array(64).map((_, i) => i + 1);
    const enc = encryptSecretBytes(secret);
    expect(enc.ciphertext).toBeTruthy();
    expect(enc.iv).toBeTruthy();
    const out = decryptSecretBytes(enc.ciphertext, enc.iv);
    expect(Array.from(out)).toEqual(Array.from(secret));
  });

  it("returns null when Auto-buy is off (caller should send a Sign link)", async () => {
    const out = await tryAutoExecuteTrade({
      auto: false,
      userId: "11111111-1111-4111-8111-111111111111",
      sb: async () => [],
    });
    expect(out).toBeNull();
  });

  it("does not return a Sign link when the Auto-buy wallet is new / unfunded", async () => {
    process.env.TELEGRAM_AUTO_TRADE_KEY = "test-wrap-key-orbitx-auto-trade";
    const uuid = "11111111-1111-4111-8111-111111111111";
    const sb = async (_path: string, opts?: { method?: string }) => {
      if (!opts || !opts.method || opts.method === "GET") return [];
      return { ok: true };
    };
    const out = await tryAutoExecuteTrade({
      sb,
      userId: uuid,
      auto: true,
      fetchJson: async () => ({ ok: true, tx: "dGVzdA==" }),
      base: "https://www.orbitx.world",
      mint: "So11111111111111111111111111111111111111112",
      amount: 0.05,
    });
    expect(out).toBeTruthy();
    expect(out?.ok).toBe(false);
    expect(out?.error).toBe("auto_wallet_unfunded");
    expect(out?.requiresSignature).toBe(false);
    expect(out?.signUrl).toBeFalsy();
    expect(out?.openUrl).toBeFalsy();
    expect(String(out?.wallet || "")).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(String(out?.message || "")).toMatch(/Send SOL/i);
  });

  it("skips execute when the dashboard toggle is off even if auto was requested", async () => {
    process.env.TELEGRAM_AUTO_TRADE_KEY = "test-wrap-key-orbitx-auto-trade";
    const uuid = "11111111-1111-4111-8111-111111111111";
    const sb = async () => [{ public_key: "11111111111111111111111111111111", enabled: false }];
    const out = await tryAutoExecuteTrade({
      sb,
      userId: uuid,
      auto: true,
      fetchJson: async () => {
        throw new Error("should not build a swap when Auto-buy is off");
      },
      base: "https://www.orbitx.world",
      mint: "So11111111111111111111111111111111111111112",
      amount: 0.05,
    });
    expect(out).toBeNull();
  });
});
