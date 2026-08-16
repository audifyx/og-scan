import { describe, expect, it } from "vitest";
import {
  MCP_ACCESS_PACKAGES,
  accessBlockedPayload,
  calculateBurnAmount,
  computeExpiresAt,
  evaluateMcpAccess,
  formatRemaining,
  inferPackageFromTokens,
  isAccessActive,
  listPackages,
  remainingMs,
  resolvePackage,
  statusFromRow,
} from "./mcp-burn-access.js";

describe("MCP burn access packages", () => {
  it("prices 1 day at 100 tokens and 1 week at 1,000 tokens", () => {
    expect(MCP_ACCESS_PACKAGES.day.tokens).toBe(100);
    expect(MCP_ACCESS_PACKAGES.week.tokens).toBe(1000);
    expect(MCP_ACCESS_PACKAGES.day.durationMs).toBe(24 * 60 * 60 * 1000);
    expect(MCP_ACCESS_PACKAGES.week.durationMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("resolves package aliases", () => {
    expect(resolvePackage("day")?.id).toBe("day");
    expect(resolvePackage("1 Day")?.id).toBe("day");
    expect(resolvePackage("option-a")?.id).toBe("day");
    expect(resolvePackage("week")?.id).toBe("week");
    expect(resolvePackage("7d")?.id).toBe("week");
    expect(resolvePackage("option_b")?.id).toBe("week");
    expect(resolvePackage("nope")).toBeNull();
  });

  it("calculates the exact burn amount for the selected package", () => {
    expect(calculateBurnAmount("day")).toMatchObject({
      ok: true,
      tokens: 100,
      packageId: "day",
    });
    expect(calculateBurnAmount("week")).toMatchObject({
      ok: true,
      tokens: 1000,
      packageId: "week",
    });
    expect(calculateBurnAmount("lifetime").ok).toBe(false);
  });

  it("lists both purchasable packages", () => {
    const packages = listPackages();
    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.id)).toEqual(["day", "week"]);
    expect(packages[0].tokens).toBe(100);
    expect(packages[1].tokens).toBe(1000);
  });

  it("infers package from burned token count", () => {
    expect(inferPackageFromTokens(99)).toBeNull();
    expect(inferPackageFromTokens(100)?.id).toBe("day");
    expect(inferPackageFromTokens(999)?.id).toBe("day");
    expect(inferPackageFromTokens(1000)?.id).toBe("week");
  });
});

describe("MCP burn access expiration", () => {
  const now = Date.parse("2026-08-16T12:00:00.000Z");

  it("treats missing or past timestamps as expired", () => {
    expect(isAccessActive(null, now)).toBe(false);
    expect(isAccessActive("2026-08-16T11:59:59.000Z", now)).toBe(false);
    expect(isAccessActive("2026-08-16T12:00:01.000Z", now)).toBe(true);
  });

  it("extends unexpired access instead of resetting the clock", () => {
    const current = "2026-08-17T12:00:00.000Z";
    const next = computeExpiresAt(now, current, MCP_ACCESS_PACKAGES.day.durationMs);
    expect(next).toBe("2026-08-18T12:00:00.000Z");
  });

  it("starts expired or missing access from now", () => {
    const next = computeExpiresAt(now, "2026-08-16T10:00:00.000Z", MCP_ACCESS_PACKAGES.day.durationMs);
    expect(next).toBe("2026-08-17T12:00:00.000Z");
  });

  it("formats remaining time for the status display", () => {
    expect(formatRemaining(0)).toBe("Expired");
    expect(formatRemaining(-1)).toBe("Expired");
    expect(formatRemaining(45 * 60 * 1000)).toBe("45m remaining");
    expect(formatRemaining(5 * 60 * 60 * 1000 + 12 * 60 * 1000)).toBe("5h 12m remaining");
    expect(formatRemaining(2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)).toBe("2d 3h remaining");
  });

  it("builds an inactive status after expiry", () => {
    const status = statusFromRow(
      {
        package_id: "day",
        expires_at: "2026-08-16T11:00:00.000Z",
        tokens_burned: 100,
        lifetime_tokens_burned: 100,
      },
      now,
    );
    expect(status.active).toBe(false);
    expect(status.expired).toBe(true);
    expect(status.remainingMs).toBe(0);
    expect(status.remainingLabel).toBe("Expired");
    expect(remainingMs(status.expiresAt, now)).toBe(0);
  });

  it("builds an active status with remaining time", () => {
    const status = statusFromRow(
      {
        package_id: "week",
        expires_at: "2026-08-17T12:00:00.000Z",
        tokens_burned: 1000,
        lifetime_tokens_burned: 1100,
      },
      now,
    );
    expect(status.active).toBe(true);
    expect(status.expired).toBe(false);
    expect(status.remainingMs).toBe(24 * 60 * 60 * 1000);
    expect(status.remainingLabel).toBe("1d 0h remaining");
  });
});

describe("evaluateMcpAccess middleware", () => {
  const now = Date.parse("2026-08-16T12:00:00.000Z");

  it("allows exempt wallets without a burn or hold", async () => {
    const access = await evaluateMcpAccess({
      sb: async () => [],
      userId: "user-1",
      hold: { exempt: true, meetsRequirement: true },
      now,
    });
    expect(access.allowed).toBe(true);
    expect(access.source).toBe("exempt");
  });

  it("allows unexpired burn access when the hold is missing", async () => {
    const access = await evaluateMcpAccess({
      sb: async () => [
        {
          package_id: "day",
          expires_at: "2026-08-17T12:00:00.000Z",
          tokens_burned: 100,
          lifetime_tokens_burned: 100,
        },
      ],
      userId: "user-1",
      hold: { exempt: false, meetsRequirement: false },
      now,
    });
    expect(access.allowed).toBe(true);
    expect(access.source).toBe("burn");
    expect(access.burn.active).toBe(true);
  });

  it("blocks expired burn access when the hold is also missing", async () => {
    const access = await evaluateMcpAccess({
      sb: async () => [
        {
          package_id: "day",
          expires_at: "2026-08-16T11:00:00.000Z",
          tokens_burned: 100,
          lifetime_tokens_burned: 100,
        },
      ],
      userId: "user-1",
      hold: { exempt: false, meetsRequirement: false },
      now,
    });
    expect(access.allowed).toBe(false);
    expect(access.burn.expired).toBe(true);
    expect(access.blocked.error).toBe("mcp_access_required");
  });

  it("allows a valid token hold after burn access expires", async () => {
    const access = await evaluateMcpAccess({
      sb: async () => [
        {
          package_id: "week",
          expires_at: "2026-08-16T11:00:00.000Z",
          tokens_burned: 1000,
          lifetime_tokens_burned: 1000,
        },
      ],
      userId: "user-1",
      hold: { exempt: false, meetsRequirement: true },
      now,
    });
    expect(access.allowed).toBe(true);
    expect(access.source).toBe("hold");
  });
});

describe("MCP access blocked payload", () => {
  it("tells the caller how to unlock MCP", () => {
    const payload = accessBlockedPayload({ tool: "orbitx_prepare_buy" });
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("mcp_access_required");
    expect(payload.packages).toHaveLength(2);
    expect(payload.message).toMatch(/burn 100 ORBITX/);
    expect(payload.tool).toBe("orbitx_prepare_buy");
  });
});
