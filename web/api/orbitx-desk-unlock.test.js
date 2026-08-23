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
  it("fails closed when Vercel pin is missing", async () => {
    const prevCode = process.env.OWNER_DESK_CODE;
    const prevPass = process.env.ADMIN_PASS;
    delete process.env.OWNER_DESK_CODE;
    delete process.env.ADMIN_PASS;
    const res = mockRes();
    await handler({ method: "POST", body: { code: "0129" } }, res);
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toBe("not_configured");
    if (prevCode === undefined) delete process.env.OWNER_DESK_CODE;
    else process.env.OWNER_DESK_CODE = prevCode;
    if (prevPass === undefined) delete process.env.ADMIN_PASS;
    else process.env.ADMIN_PASS = prevPass;
  });

  it("rejects the leaked pin and accepts the env pin", async () => {
    const prevCode = process.env.OWNER_DESK_CODE;
    const prevPass = process.env.ADMIN_PASS;
    process.env.OWNER_DESK_CODE = "84829107";
    delete process.env.ADMIN_PASS;
    const denied = mockRes();
    await handler({ method: "POST", body: { code: "0129" } }, denied);
    expect(denied.statusCode).toBe(401);
    expect(JSON.parse(denied.body).error).toBe("revoked");

    const ok = mockRes();
    await handler({ method: "POST", body: { code: "84829107" } }, ok);
    const body = JSON.parse(ok.body);
    expect(ok.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.token).toMatch(/^oxdesk1\./);
    expect(JSON.stringify(body)).not.toContain("84829107");

    if (prevCode === undefined) delete process.env.OWNER_DESK_CODE;
    else process.env.OWNER_DESK_CODE = prevCode;
    if (prevPass === undefined) delete process.env.ADMIN_PASS;
    else process.env.ADMIN_PASS = prevPass;
  });
});
