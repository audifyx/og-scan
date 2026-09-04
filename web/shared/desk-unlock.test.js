// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  REVOKED_DESK_CODE_DIGESTS,
  adminCredentialOk,
  deskUnlockConfigured,
  deskUnlockSecrets,
  digestDeskCode,
  isRevokedDeskCode,
  issueDeskSession,
  verifyDeskSession,
  verifyDeskUnlockCode,
} from "./desk-unlock.js";

const ENV = { ADMIN_AUTH: "84829107", ADMIN_PASS: "server-admin-pass-ok" };
/** Retired client PIN reconstructed without embedding the leaked literal. */
const RETIRED = String.fromCharCode(48, 49, 50, 57);

describe("desk unlock secrets", () => {
  it("fails closed with no env and rejects retired client PINs even if set", () => {
    expect(deskUnlockConfigured({})).toBe(false);
    expect(deskUnlockSecrets({ ADMIN_AUTH: RETIRED })).toEqual([]);
    expect(isRevokedDeskCode(RETIRED)).toBe(true);
    expect(REVOKED_DESK_CODE_DIGESTS).toContain(digestDeskCode(RETIRED));
    expect(verifyDeskUnlockCode(RETIRED, { ADMIN_AUTH: RETIRED })).toBe(false);
  });

  it("accepts ADMIN_AUTH or legacy ADMIN_PASS / OWNER_DESK_CODE from env only", () => {
    expect(deskUnlockConfigured(ENV)).toBe(true);
    expect(verifyDeskUnlockCode("84829107", ENV)).toBe(true);
    expect(verifyDeskUnlockCode("server-admin-pass-ok", ENV)).toBe(true);
    expect(verifyDeskUnlockCode("legacy-desk", { OWNER_DESK_CODE: "legacy-desk" })).toBe(true);
    expect(verifyDeskUnlockCode("wrong", ENV)).toBe(false);
  });

  it("issues a session token that is not the pin", () => {
    const token = issueDeskSession(Date.now(), ENV);
    expect(token).toMatch(/^oxdesk1\./);
    expect(token).not.toContain("84829107");
    expect(verifyDeskSession(token, Date.now(), ENV)).toBe(true);
    expect(verifyDeskSession(token, Date.now() + 13 * 60 * 60 * 1000, ENV)).toBe(false);
    expect(adminCredentialOk(token, ENV)).toBe(true);
    expect(adminCredentialOk(RETIRED, ENV)).toBe(false);
  });
});
