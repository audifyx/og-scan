import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
process.env.AUTH_LOGIN_TIMEOUT_MS = "40";

const { default: handler } = await import("../../api/auth-web3");

function mockRes() {
  const res = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: null as unknown,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(n: number) {
      this.statusCode = n;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
    end() {
      return this;
    },
  };
  return res as typeof res & VercelResponse;
}

describe("POST /api/auth-web3", () => {
  it("imports the rate-limit helper with a .js specifier so Vercel ESM can bundle it", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../api/auth-web3.ts"),
      "utf8",
    );
    expect(src).toMatch(/from ["']\.\/_authLimit\.js["']/);
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards a SIWS grant to GoTrue without exposing a hung browser token call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "at", refresh_token: "rt" }),
      }),
    );
    const res = mockRes();
    await handler(
      { method: "POST", body: { chain: "solana", message: "siws", signature: "abc" } } as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ access_token: "at", refresh_token: "rt" });
    const url = String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("/auth/v1/token?grant_type=web3");
    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      chain: "solana",
      message: "siws",
      signature: "abc",
    });
  });

  it("maps GoTrue validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error_description: "invalid web3 message" }),
      }),
    );
    const res = mockRes();
    await handler(
      { method: "POST", headers: {}, body: { message: "bad", signature: "nope" } } as unknown as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "invalid web3 message" });
  });

  it("rejects a disallowed Origin", async () => {
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: { message: "siws", signature: "abc" },
      } as unknown as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "origin_not_allowed" });
  });
});
