import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
process.env.AUTH_LOGIN_TIMEOUT_MS = "40";

const { default: handler } = await import("../../api/auth-login");

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

describe("POST /api/auth-login", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns tokens from GoTrue without exposing a hung browser grant", async () => {
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
      { method: "POST", body: { email: "me@orbitx.world", password: "secret" } } as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ access_token: "at", refresh_token: "rt" });
    const url = String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("/auth/v1/token?grant_type=password");
  });

  it("maps invalid credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error_description: "Invalid login credentials" }),
      }),
    );
    const res = mockRes();
    await handler(
      { method: "POST", headers: {}, body: { email: "me@orbitx.world", password: "nope" } } as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid login credentials" });
  });

  it("returns 503 when GoTrue never answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }),
    );
    const res = mockRes();
    await handler(
      { method: "POST", body: { email: "me@orbitx.world", password: "secret" } } as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "Login service timed out. Please try again." });
  });

  it("rejects a disallowed Origin", async () => {
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: { email: "me@orbitx.world", password: "secret" },
      } as unknown as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "origin_not_allowed" });
  });

  it("rate-limits repeated login attempts for the same email and IP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error_description: "Invalid login credentials" }),
      }),
    );
    let last = mockRes();
    for (let i = 0; i < 9; i++) {
      last = mockRes();
      await handler(
        {
          method: "POST",
          headers: { "x-forwarded-for": "203.0.113.9" },
          body: { email: "ratelimit@orbitx.world", password: "nope" },
        } as unknown as VercelRequest,
        last,
      );
    }
    expect(last.statusCode).toBe(429);
  });
});
