import { afterEach, describe, expect, it } from "vitest";
import {
  accessStatusFromRow,
  grantMcpBetaAccessBadge,
  isAllowedGatedDmCommand,
  isOrbitXBetaCode,
  LIFETIME_SECONDS,
  looksLikeEarlyAccessCode,
  looksLikeSolanaTxRef,
  normalizeEarlyAccessCode,
  parseSolanaTxSignature,
  redeemEarlyAccessCode,
  resolveBurnPackageFromText,
  telegramDmUnlockState,
} from "./telegram-bot-access.js";

describe("early access codes", () => {
  it("normalizes and accepts 4–24 alphanumeric codes", () => {
    expect(normalizeEarlyAccessCode("  obx-alpha 1 ")).toBe("OBXALPHA1");
    expect(normalizeEarlyAccessCode("ORBITX BETA")).toBe("ORBITXBETA");
    expect(isOrbitXBetaCode("orbitx beta")).toBe(true);
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

  it("labels far-future / lifetime package grants as lifetime", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    const status = accessStatusFromRow(
      {
        expires_at: new Date(now + LIFETIME_SECONDS * 1000).toISOString(),
        source: "code",
        package_id: "lifetime",
      },
      now,
    );
    expect(status.active).toBe(true);
    expect(status.remainingLabel).toBe("lifetime");
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

  it("grants lifetime for ORBITX BETA, skips re-redeem uses, and caps at 25", async () => {
    const codes = {
      code: "ORBITXBETA",
      duration_seconds: 7 * 24 * 3600,
      max_uses: 25,
      uses: 0,
    };
    const access = new Map();
    const sb = async (path, init) => {
      const method = init?.method || "GET";
      if (String(path).startsWith("telegram_early_access_codes")) {
        if (method === "PATCH") {
          codes.uses = JSON.parse(init.body).uses;
          return [codes];
        }
        return [{ ...codes }];
      }
      if (path === "telegram_bot_access" && method === "POST") {
        const row = JSON.parse(init.body);
        access.set(row.telegram_user_id, row);
        return [row];
      }
      if (String(path).startsWith("telegram_bot_access")) {
        const match = /telegram_user_id=eq\.([^&]+)/.exec(String(path));
        const id = match ? decodeURIComponent(match[1]) : "";
        if (method === "PATCH") {
          const row = { ...access.get(id), ...JSON.parse(init.body) };
          access.set(id, row);
          return [row];
        }
        const row = access.get(id);
        return row ? [row] : [];
      }
      return [];
    };

    const first = await redeemEarlyAccessCode(sb, { telegramUserId: "1", code: "ORBITX BETA" });
    expect(first.ok).toBe(true);
    expect(first.remainingLabel).toBe("lifetime");
    expect(first.packageId).toBe("lifetime");
    expect(codes.uses).toBe(1);

    const again = await redeemEarlyAccessCode(sb, { telegramUserId: "1", code: "orbitx beta" });
    expect(again.ok).toBe(true);
    expect(again.already).toBe(true);
    expect(again.remainingLabel).toBe("lifetime");
    expect(codes.uses).toBe(1);

    codes.uses = 25;
    const still = await redeemEarlyAccessCode(sb, { telegramUserId: "1", code: "ORBITX BETA" });
    expect(still.ok).toBe(true);
    expect(still.already).toBe(true);

    const late = await redeemEarlyAccessCode(sb, { telegramUserId: "26", code: "ORBITX BETA" });
    expect(late.ok).toBe(false);
    expect(late.error).toBe("code_exhausted");
  });
});

describe("DM unlock gate", () => {
  it("stays locked until code and linked wallet", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    const none = telegramDmUnlockState(null, null, now);
    expect(none.unlocked).toBe(false);
    expect(none.needsCode).toBe(true);
    const coded = telegramDmUnlockState(
      { expires_at: "2026-08-21T12:00:00.000Z", package_id: "lifetime" },
      null,
      now,
    );
    expect(coded.accessActive).toBe(true);
    expect(coded.needsLogin).toBe(true);
    expect(coded.unlocked).toBe(false);
    const ready = telegramDmUnlockState(
      { expires_at: "2026-08-21T12:00:00.000Z", package_id: "lifetime" },
      { user_id: "u1" },
      now,
    );
    expect(ready.unlocked).toBe(true);
  });

  it("only allows onboarding commands while locked", () => {
    expect(isAllowedGatedDmCommand("token", "token CA")).toBe(false);
    expect(isAllowedGatedDmCommand("ask", "gm")).toBe(false);
    expect(isAllowedGatedDmCommand("help", "/help")).toBe(false);
    expect(isAllowedGatedDmCommand("start", "/start")).toBe(true);
    expect(isAllowedGatedDmCommand("code", "/code ORBITX BETA")).toBe(true);
    expect(isAllowedGatedDmCommand("login", "/login")).toBe(true);
    expect(isAllowedGatedDmCommand("shop", "/shop hour")).toBe(true);
    expect(isAllowedGatedDmCommand("shop", "/shop")).toBe(false);
  });
});

describe("grantMcpBetaAccessBadge", () => {
  it("sets mcp_beta_access and badge beta access when badge is empty", async () => {
    let patched = null;
    const sb = async (path, init) => {
      if (!init?.method) {
        return [{ user_id: "u1", badge: null, mcp_beta_access: false }];
      }
      patched = JSON.parse(init.body);
      return [{ user_id: "u1", ...patched }];
    };
    const out = await grantMcpBetaAccessBadge(sb, "u1");
    expect(out.ok).toBe(true);
    expect(patched).toMatchObject({ mcp_beta_access: true, badge: "beta access" });
  });

  it("does not overwrite whale badges", async () => {
    let patched = null;
    const sb = async (path, init) => {
      if (!init?.method) return [{ user_id: "u1", badge: "whale", mcp_beta_access: false }];
      patched = JSON.parse(init.body);
      return [patched];
    };
    const out = await grantMcpBetaAccessBadge(sb, "u1");
    expect(out.ok).toBe(true);
    expect(patched.mcp_beta_access).toBe(true);
    expect(patched.badge).toBeUndefined();
  });
});
