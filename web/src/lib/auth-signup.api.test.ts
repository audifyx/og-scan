import { describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "anon-key";

const { default: handler } = await import("../../api/auth/signup");

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

describe("POST /api/auth/signup", () => {
  it("requires a device fingerprint instead of creating the user locally", async () => {
    const res = mockRes();
    await handler(
      { method: "POST", headers: {}, body: { email: "a@orbitx.world", password: "longpassword1" } } as unknown as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "device_fingerprint_required" });
  });

  it("proxies to signup-guard with the fingerprint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, user: { id: "u1" } }),
      }),
    );
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: { origin: "https://www.orbitx.world" },
        body: { email: "a@orbitx.world", password: "longpassword1", fingerprint: "fp1" },
      } as unknown as VercelRequest,
      res,
    );
    expect(res.statusCode).toBe(200);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toContain("/functions/v1/signup-guard");
    expect(JSON.parse(call[1].body)).toMatchObject({
      email: "a@orbitx.world",
      fingerprint: "fp1",
    });
  });
});
