// @vitest-environment node
import { describe, expect, it } from "vitest";
import handler from "./orbitx-desk-unlock.js";

const RETIRED = String.fromCharCode(48, 49, 50, 57);

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(s) {
      this.body = s || "";
    },
  };
  return res;
}

describe("POST /api/orbitx-desk-unlock", () => {
  it("rejects callers without an owner session", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { code: RETIRED } }, res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe("denied");
  });

  it("rejects the leaked pin and accepts the env pin for an owner JWT", async () => {
    const prevAuth = process.env.ADMIN_AUTH;
    const prevCode = process.env.OWNER_DESK_CODE;
    const prevPass = process.env.ADMIN_PASS;
    const prevUrl = process.env.SUPABASE_URL;
    const prevAnon = process.env.SUPABASE_ANON_KEY;
    const prevFetch = globalThis.fetch;
    process.env.ADMIN_AUTH = "84829107";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "test-anon";
    delete process.env.OWNER_DESK_CODE;
    delete process.env.ADMIN_PASS;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ email: "audifyx@gmail.com" }),
    });

    const denied = mockRes();
    await handler(
      { method: "POST", headers: { authorization: "Bearer test" }, body: { code: RETIRED } },
      denied,
    );
    expect(denied.statusCode).toBe(401);
    expect(JSON.parse(denied.body).error).toBe("revoked");

    const ok = mockRes();
    await handler(
      { method: "POST", headers: { authorization: "Bearer test" }, body: { code: "84829107" } },
      ok,
    );
    const body = JSON.parse(ok.body);
    expect(ok.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.token).toMatch(/^oxdesk1\./);
    expect(JSON.stringify(body)).not.toContain("84829107");

    const maint = mockRes();
    await handler({ method: "POST", headers: {}, body: { code: "84829107", purpose: "maintenance" } }, maint);
    expect(maint.statusCode).toBe(200);
    expect(JSON.parse(maint.body).ok).toBe(true);
    expect(JSON.parse(maint.body).token).toBeUndefined();

    const probe = mockRes();
    await handler({ method: "GET", headers: {} }, probe);
    expect(probe.statusCode).toBe(404);
    expect(JSON.parse(probe.body)).not.toHaveProperty("configured");

    globalThis.fetch = prevFetch;
    if (prevAuth === undefined) delete process.env.ADMIN_AUTH;
    else process.env.ADMIN_AUTH = prevAuth;
    if (prevCode === undefined) delete process.env.OWNER_DESK_CODE;
    else process.env.OWNER_DESK_CODE = prevCode;
    if (prevPass === undefined) delete process.env.ADMIN_PASS;
    else process.env.ADMIN_PASS = prevPass;
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
  });
});
