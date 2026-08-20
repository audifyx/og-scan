import { afterEach, describe, expect, it } from "vitest";
import {
  accessStatusFromRow,
  looksLikeEarlyAccessCode,
  looksLikeSolanaTxRef,
  normalizeEarlyAccessCode,
  parseSolanaTxSignature,
  redeemEarlyAccessCode,
  resolveBurnPackageFromText,
} from "./telegram-bot-access.js";

describe("early access codes", () => {
  it("normalizes and accepts 4–24 alphanumeric codes", () => {
    expect(normalizeEarlyAccessCode("  obx-alpha 1 ")).toBe("OBXALPHA1");
    expect(looksLikeEarlyAccessCode("OBX7")).toBe(true);
    expect(looksLikeEarlyAccessCode("no")).toBe(false);
  });
});

describe("burn package text", () => {
  it("picks hour/day/week/month from Telegram copy", () => {
    expect(resolveBurnPackageFromText("/burn hour")?.id).toBe("hour");
    expect(resolveBurnPackageFromText("burn 100")?.id).toBe("hour");
    expect(resolveBurnPackageFromText("/shop day")?.id).toBe("day");
    expect(resolveBurnPackageFromText("1k tokens")?.id).toBe("day");
    expect(resolveBurnPackageFromText("burn 10k")?.id).toBe("week");
    expect(resolveBurnPackageFromText("1000k for a month")?.id).toBe("month");
    expect(resolveBurnPackageFromText("/burn")).toBeNull();
  });
});

describe("Solscan /verify input", () => {
  const sig = `${"1".repeat(32)}${"2".repeat(32)}abcd`;

  it("parses a raw signature or explorer URL before mint regex can steal a prefix", () => {
    expect(parseSolanaTxSignature(`https://solscan.io/tx/${sig}`)).toBe(sig);
    expect(parseSolanaTxSignature(`https://explorer.solana.com/tx/${sig}?cluster=mainnet`)).toBe(sig);
    expect(parseSolanaTxSignature(sig)).toBe(sig);
    expect(looksLikeSolanaTxRef(`https://solscan.io/tx/${sig}`)).toBe(true);
    expect(looksLikeSolanaTxRef(sig)).toBe(true);
    expect(looksLikeSolanaTxRef("13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9")).toBe(false);
  });
});

describe("telegram bot access status", () => {
  it("reports remaining time from a grant row", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    const status = accessStatusFromRow(
      { expires_at: "2026-08-20T13:00:00.000Z", source: "burn", package_id: "hour" },
      now,
    );
    expect(status.active).toBe(true);
    expect(status.remainingLabel).toBe("1h 0m remaining");
  });
});

describe("redeemEarlyAccessCode", () => {
  afterEach(() => {
    delete process.env.TELEGRAM_EARLY_ACCESS_CODES;
    delete process.env.TELEGRAM_EARLY_ACCESS_SECONDS;
  });

  it("redeems an env fallback code when the table is missing", async () => {
    process.env.TELEGRAM_EARLY_ACCESS_CODES = "ORBITX7,BETA42";
    process.env.TELEGRAM_EARLY_ACCESS_SECONDS = String(60 * 60);
    const calls = [];
    const sb = async (path, init) => {
      calls.push({ path, method: init?.method || "GET" });
      if (String(path).startsWith("telegram_early_access_codes")) {
        throw new Error("relation does not exist");
      }
      return [];
    };
    const out = await redeemEarlyAccessCode(sb, {
      telegramUserId: "99",
      code: "orbitx7",
    });
    expect(out.ok).toBe(true);
    expect(out.source).toBe("code");
    expect(out.remainingLabel).toMatch(/remaining/);
    expect(calls.some((c) => c.path === "telegram_bot_access" && c.method === "POST")).toBe(true);
  });

  it("rejects unknown codes", async () => {
    process.env.TELEGRAM_EARLY_ACCESS_CODES = "ORBITX7";
    const sb = async (path) => {
      if (String(path).startsWith("telegram_early_access_codes")) throw new Error("missing");
      return [];
    };
    const out = await redeemEarlyAccessCode(sb, { telegramUserId: "1", code: "NOPE99" });
    expect(out.ok).toBe(false);
    expect(out.error).toBe("unknown_code");
  });
});
