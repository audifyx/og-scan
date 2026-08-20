import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MCP_ACCESS_PACKAGES,
  accessBlockedPayload,
  accessBuyPrompt,
  calculateBurnAmount,
  computeExpiresAt,
  confirmAccessBurn,
  evaluateMcpAccess,
  formatRemaining,
  inferPackageFromTokens,
  isAccessActive,
  listPackages,
  prepareAccessBurn,
  prepareAccessMcpPurchase,
  remainingMs,
  resolvePackage,
  statusFromRow,
  verifyOrbitxBurn,
} from "./mcp-burn-access.js";

describe("MCP burn access packages", () => {
  it("prices hour/day/week/month at 100 / 1,000 / 10,000 / 1,000,000 tokens", () => {
    expect(MCP_ACCESS_PACKAGES.hour.tokens).toBe(100);
    expect(MCP_ACCESS_PACKAGES.day.tokens).toBe(1000);
    expect(MCP_ACCESS_PACKAGES.week.tokens).toBe(10_000);
    expect(MCP_ACCESS_PACKAGES.month.tokens).toBe(1_000_000);
    expect(MCP_ACCESS_PACKAGES.hour.durationMs).toBe(60 * 60 * 1000);
    expect(MCP_ACCESS_PACKAGES.day.durationMs).toBe(24 * 60 * 60 * 1000);
    expect(MCP_ACCESS_PACKAGES.week.durationMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(MCP_ACCESS_PACKAGES.month.durationMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("resolves package aliases", () => {
    expect(resolvePackage("hour")?.id).toBe("hour");
    expect(resolvePackage("1h")?.id).toBe("hour");
    expect(resolvePackage("day")?.id).toBe("day");
    expect(resolvePackage("1 Day")?.id).toBe("day");
    expect(resolvePackage("week")?.id).toBe("week");
    expect(resolvePackage("7d")?.id).toBe("week");
    expect(resolvePackage("month")?.id).toBe("month");
    expect(resolvePackage("1000k")?.id).toBe("month");
    expect(resolvePackage("nope")).toBeNull();
  });

  it("calculates the exact burn amount for the selected package", () => {
    expect(calculateBurnAmount("hour")).toMatchObject({
      ok: true,
      tokens: 100,
      packageId: "hour",
    });
    expect(calculateBurnAmount("day")).toMatchObject({
      ok: true,
      tokens: 1000,
      packageId: "day",
    });
    expect(calculateBurnAmount("week")).toMatchObject({
      ok: true,
      tokens: 10_000,
      packageId: "week",
    });
    expect(calculateBurnAmount("month")).toMatchObject({
      ok: true,
      tokens: 1_000_000,
      packageId: "month",
    });
    expect(calculateBurnAmount("lifetime").ok).toBe(false);
  });

  it("lists all purchasable packages", () => {
    const packages = listPackages();
    expect(packages).toHaveLength(4);
    expect(packages.map((p) => p.id)).toEqual(["hour", "day", "week", "month"]);
    expect(packages.map((p) => p.tokens)).toEqual([100, 1000, 10_000, 1_000_000]);
  });

  it("infers package from burned token count", () => {
    expect(inferPackageFromTokens(99)).toBeNull();
    expect(inferPackageFromTokens(100)?.id).toBe("hour");
    expect(inferPackageFromTokens(999)?.id).toBe("hour");
    expect(inferPackageFromTokens(1000)?.id).toBe("day");
    expect(inferPackageFromTokens(10_000)?.id).toBe("week");
    expect(inferPackageFromTokens(1_000_000)?.id).toBe("month");
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

  it("allows a wallet-keyed burn grant without a signed-in user", async () => {
    const access = await evaluateMcpAccess({
      sb: async (path) => {
        if (String(path).includes("mcp_burn_wallet_access")) {
          return [
            {
              package_id: "week",
              expires_at: "2026-08-23T12:00:00.000Z",
              tokens_burned: 1000,
              lifetime_tokens_burned: 1000,
              wallet_address: "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb",
            },
          ];
        }
        return [];
      },
      wallets: ["jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb"],
      hold: { exempt: false, meetsRequirement: false },
      now,
    });
    expect(access.allowed).toBe(true);
    expect(access.source).toBe("burn");
    expect(access.burn.packageId).toBe("week");
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

describe("verifyOrbitxBurn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts an exact 100-token ORBITX burn for the hour package", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            result: {
              meta: {
                err: null,
                preTokenBalances: [
                  {
                    accountIndex: 1,
                    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                    owner: "BurnerWallet111111111111111111111111111",
                    uiTokenAmount: { uiAmount: 250, amount: "250000000", decimals: 6 },
                  },
                ],
                postTokenBalances: [
                  {
                    accountIndex: 1,
                    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                    owner: "BurnerWallet111111111111111111111111111",
                    uiTokenAmount: { uiAmount: 150, amount: "150000000", decimals: 6 },
                  },
                ],
                innerInstructions: [],
              },
              transaction: { message: { instructions: [] } },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const verified = await verifyOrbitxBurn("1".repeat(64), { packageId: "hour" });
    expect(verified.ok).toBe(true);
    expect(verified.tokensBurned).toBe(100);
    expect(verified.package.id).toBe("hour");
  });

  it("rejects a 100-token burn when the week package is selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            result: {
              meta: {
                err: null,
                preTokenBalances: [
                  {
                    accountIndex: 1,
                    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                    owner: "BurnerWallet111111111111111111111111111",
                    uiTokenAmount: { uiAmount: 100, amount: "100000000", decimals: 6 },
                  },
                ],
                postTokenBalances: [],
                innerInstructions: [],
              },
              transaction: { message: { instructions: [] } },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const verified = await verifyOrbitxBurn("2".repeat(64), { packageId: "week" });
    expect(verified.ok).toBe(false);
    expect(verified.error).toBe("amount_too_low");
  });

  it("retries getTransaction until the burn is indexed", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        if (n === 1) {
          return new Response(JSON.stringify({ result: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            result: {
              meta: {
                err: null,
                preTokenBalances: [
                  {
                    accountIndex: 1,
                    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                    owner: "BurnerWallet111111111111111111111111111",
                    uiTokenAmount: { uiAmount: 100, amount: "100000000", decimals: 6 },
                  },
                ],
                postTokenBalances: [],
                innerInstructions: [],
              },
              transaction: { message: { instructions: [] } },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const verified = await verifyOrbitxBurn("3".repeat(64), {
      packageId: "hour",
      pollAttempts: 3,
      pollMs: 0,
    });
    expect(verified.ok).toBe(true);
    expect(verified.tokensBurned).toBe(100);
    expect(n).toBe(2);
  });
});

describe("confirmAccessBurn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("grants timed access from the burn wallet without a signed-in user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            result: {
              meta: {
                err: null,
                preTokenBalances: [
                  {
                    accountIndex: 1,
                    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                    owner: "BurnerWallet111111111111111111111111111",
                    uiTokenAmount: { uiAmount: 100, amount: "100000000", decimals: 6 },
                  },
                ],
                postTokenBalances: [],
                innerInstructions: [],
              },
              transaction: { message: { instructions: [] } },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const writes = [];
    const sb = async (path, init) => {
      writes.push({ path, method: init?.method || "GET" });
      return [];
    };

    const out = await confirmAccessBurn(sb, {
      signature: "4".repeat(64),
      packageId: "hour",
      wallet: "BurnerWallet111111111111111111111111111",
    });

    expect(out.ok).toBe(true);
    expect(out.active).toBe(true);
    expect(out.packageId).toBe("hour");
    expect(out.remainingLabel).toMatch(/remaining/);
    expect(writes.some((w) => w.path === "mcp_burn_wallet_access" && w.method === "POST")).toBe(true);
  });

  it("attaches an already-granted week burn to the wallet so shop can see it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            result: {
              meta: {
                err: null,
                preTokenBalances: [
                  {
                    accountIndex: 2,
                    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                    owner: "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb",
                    uiTokenAmount: { uiAmount: 3006.474628, amount: "3006474628", decimals: 6 },
                  },
                ],
                postTokenBalances: [
                  {
                    accountIndex: 2,
                    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                    owner: "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb",
                    uiTokenAmount: { uiAmount: 2006.474628, amount: "2006474628", decimals: 6 },
                  },
                ],
                innerInstructions: [],
              },
              transaction: {
                message: {
                  instructions: [
                    {
                      parsed: {
                        type: "burn",
                        info: {
                          mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                          authority: "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb",
                          amount: "1000000000",
                        },
                      },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const writes = [];
    const sb = async (path, init) => {
      writes.push({ path, method: init?.method || "GET" });
      if (String(path).startsWith("mcp_burn_ledger?tx_signature")) {
        return [
          {
            id: "led-1",
            user_id: "other-user",
            package_id: "day",
            expires_at: "2026-08-23T10:58:26.392Z",
            tokens_burned: 1000,
          },
        ];
      }
      return [];
    };

    const out = await confirmAccessBurn(sb, {
      signature: "13GCQvvZUGUWb4EAx2JHraKguMqQPuTrSjYGKGaFD74swjJhUVXjpy7DzF4MuApJJoabFU4niicajr68KrCWAkf",
      packageId: "day",
      wallet: "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb",
    });

    expect(out.ok).toBe(true);
    expect(out.alreadyGranted).toBe(true);
    expect(out.active).toBe(true);
    expect(out.packageId).toBe("day");
    expect(writes.some((w) => w.path === "mcp_burn_wallet_access" && w.method === "POST")).toBe(true);
  });
});

describe("MCP access blocked payload", () => {
  it("tells the caller how to unlock MCP", () => {
    const payload = accessBlockedPayload({ tool: "orbitx_prepare_buy" });
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("mcp_access_required");
    expect(payload.packages).toHaveLength(4);
    expect(payload.message).toMatch(/burn 100/);
    expect(payload.accessUrl).toContain("/shop");
    expect(payload.tool).toBe("orbitx_prepare_buy");
  });
});

describe("prepareAccessBurn (no Solana SDK)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ATA metadata so the client can build the burn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            result: {
              value: [
                {
                  pubkey: "TokenAccount11111111111111111111111111111",
                  account: {
                    owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    data: {
                      parsed: {
                        info: {
                          mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
                          tokenAmount: { amount: "500000000", decimals: 6, uiAmount: 500 },
                        },
                      },
                    },
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const out = await prepareAccessBurn({
      publicKey: "11111111111111111111111111111111",
      packageId: "hour",
    });
    expect(out.ok).toBe(true);
    expect(out.tokens).toBe(100);
    expect(out.amountRaw).toBe("100000000");
    expect(out.tokenAccount).toBe("TokenAccount11111111111111111111111111111");
    expect(out.buildOnClient).toBe(true);
    expect(out.transaction).toBeUndefined();
  });

  it("rejects a wallet with no ORBITX", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { value: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const out = await prepareAccessBurn({
      publicKey: "11111111111111111111111111111111",
      packageId: "week",
    });
    expect(out.ok).toBe(false);
    expect(out.error).toBe("no_route");
  });
});

describe("MCP access MCP purchase payloads", () => {
  it("names Agent tools by default and X tools when asked", () => {
    const agent = accessBuyPrompt();
    expect(agent.tools.buy).toBe("orbitx_mcp_access_buy");
    expect(agent.message).toContain("orbitx_mcp_access_buy");

    const x = accessBuyPrompt({
      buyTool: "x_mcp_access_buy",
      confirmTool: "x_mcp_access_confirm",
      statusTool: "x_mcp_access_status",
      accessUrl: "https://www.orbitx.world/x?tab=shop",
    });
    expect(x.tools).toEqual({
      buy: "x_mcp_access_buy",
      confirm: "x_mcp_access_confirm",
      status: "x_mcp_access_status",
    });
    expect(x.message).toContain("x_mcp_access_buy");
    expect(x.accessUrl).toContain("/x");
  });

  it("returns a Phantom signUrl that confirms via the calling MCP", () => {
    const out = prepareAccessMcpPurchase({
      wallet: "11111111111111111111111111111111",
      packageId: "hour",
      accessUrl: "https://www.orbitx.world/x?tab=shop",
      buyTool: "x_mcp_access_buy",
      confirmTool: "x_mcp_access_confirm",
    });
    expect(out.ok).toBe(true);
    expect(out.tokens).toBe(100);
    expect(out.signUrl).toContain("/agent/sign?");
    expect(out.signUrl).toContain("kind=mcp-access");
    expect(out.signUrl).toContain("package=hour");
    expect(out.accessUrl).toContain("/x");
    expect(out.tools.confirm).toBe("x_mcp_access_confirm");
    expect(out.instructions.join(" ")).toContain("/verify");
  });
});
