// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isOwnerIdentityRecord } from "./owner-identity.js";

describe("owner identity", () => {
  it("matches allowlisted email and wallet only", () => {
    expect(isOwnerIdentityRecord({ email: "audifyx@gmail.com" })).toBe(true);
    expect(isOwnerIdentityRecord({ email: "rando@gmail.com" })).toBe(false);
    expect(isOwnerIdentityRecord({ wallet: "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd" })).toBe(true);
    expect(isOwnerIdentityRecord({ wallet: "11111111111111111111111111111111" })).toBe(false);
  });
});
