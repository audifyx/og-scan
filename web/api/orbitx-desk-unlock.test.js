// @vitest-environment node
import { describe, expect, it } from "vitest";
import handler from "./orbitx-desk-unlock.js";

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
    await handler({ method: "POST", headers: {}, body: { code: "0129" } }, res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe("denied");
  });

  it("rejects the leaked pin and accepts the env pin for an owner JWT", async () => {
    const prevCode = process.env.OWNER_DESK_CODE;
    const prevPass = process.env.ADMIN_PASS;
    const prevUrl = process.env.SUPABASE_URL;
    const prevAnon = process.env.SUPABASE_ANON_KEY;
    const prevFetch = globalThis.fetch;
    process.env.OWNER_DESK_CODE = "84829107";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "test-anon";
    delete process.env.ADMIN_PASS;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ email: "audifyx@gmail.com" }),
    });

    const denied = mockRes();
    await handler(
      { method: "POST", headers: { authorization: "Bearer test" }, body: { code: "0129" } },
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

    globalThis.fetch = prevFetch;
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
