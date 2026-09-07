import { afterEach, describe, expect, it } from "vitest";
import {
  MCP_OPEN_UNTIL_DEFAULT,
  decorateAccessStatus,
  isMcpOpenTesting,
  mcpOpenUntilIso,
  mcpOpenWindow,
} from "./mcp-open-window.js";

describe("MCP open testing window", () => {
  afterEach(() => {
    delete process.env.MCP_OPEN_TESTING;
    delete process.env.MCP_OPEN_UNTIL;
  });

  it("is free from 7 Sep 2026 through 7 Nov 2026", () => {
    expect(MCP_OPEN_UNTIL_DEFAULT).toBe("2026-11-07T00:00:00.000Z");
    expect(isMcpOpenTesting(Date.parse("2026-09-07T12:00:00.000Z"))).toBe(true);
    expect(isMcpOpenTesting(Date.parse("2026-11-06T23:59:59.000Z"))).toBe(true);
    expect(isMcpOpenTesting(Date.parse("2026-11-07T00:00:00.000Z"))).toBe(false);
    expect(isMcpOpenTesting(Date.parse("2026-12-01T00:00:00.000Z"))).toBe(false);
  });

  it("can be closed with MCP_OPEN_TESTING=0", () => {
    process.env.MCP_OPEN_TESTING = "0";
    expect(isMcpOpenTesting(Date.parse("2026-09-07T12:00:00.000Z"))).toBe(false);
  });

  it("decorates burn status so clients see the free window", () => {
    const now = Date.parse("2026-09-07T12:00:00.000Z");
    const decorated = decorateAccessStatus({ ok: true, active: false, remainingLabel: "No burn access" }, now);
    expect(decorated.openTesting).toBe(true);
    expect(decorated.allowed).toBe(true);
    expect(decorated.source).toBe("open_testing");
    expect(decorated.openUntil).toBe(mcpOpenUntilIso());
    expect(decorated.message).toMatch(/free for everyone/i);
    const closed = decorateAccessStatus({ ok: true, active: false }, Date.parse("2026-12-01T00:00:00.000Z"));
    expect(closed.openTesting).toBe(false);
    expect(closed.allowed).toBe(false);
    expect(mcpOpenWindow(now).active).toBe(true);
  });
});
