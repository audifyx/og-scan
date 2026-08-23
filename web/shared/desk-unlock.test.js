// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  REVOKED_DESK_CODES,
  adminCredentialOk,
  deskUnlockConfigured,
  deskUnlockSecrets,
  isRevokedDeskCode,
  issueDeskSession,
  verifyDeskSession,
  verifyDeskUnlockCode,
} from "./desk-unlock.js";

const ENV = { OWNER_DESK_CODE: "84829107", ADMIN_PASS: "server-admin-pass-ok" };

describe("desk unlock secrets", () => {
  it("fails closed with no env and rejects the leaked 0129 even if set", () => {
    expect(deskUnlockConfigured({})).toBe(false);
    expect(deskUnlockSecrets({ OWNER_DESK_CODE: "0129" })).toEqual([]);
    expect(isRevokedDeskCode("0129")).toBe(true);
    expect(REVOKED_DESK_CODES).toContain("0129");
    expect(verifyDeskUnlockCode("0129", { OWNER_DESK_CODE: "0129" })).toBe(false);
  });

  it("accepts OWNER_DESK_CODE or ADMIN_PASS from env only", () => {
    expect(deskUnlockConfigured(ENV)).toBe(true);
    expect(verifyDeskUnlockCode("84829107", ENV)).toBe(true);
    expect(verifyDeskUnlockCode("server-admin-pass-ok", ENV)).toBe(true);
    expect(verifyDeskUnlockCode("wrong", ENV)).toBe(false);
  });

  it("issues a session token that is not the pin", () => {
    const token = issueDeskSession(Date.now(), ENV);
    expect(token).toMatch(/^oxdesk1\./);
    expect(token).not.toContain("84829107");
    expect(verifyDeskSession(token, Date.now(), ENV)).toBe(true);
    expect(verifyDeskSession(token, Date.now() + 13 * 60 * 60 * 1000, ENV)).toBe(false);
    expect(adminCredentialOk(token, ENV)).toBe(true);
    expect(adminCredentialOk("0129", ENV)).toBe(false);
  });
});
