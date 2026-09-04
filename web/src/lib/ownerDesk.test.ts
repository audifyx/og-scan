import { describe, expect, it } from "vitest";
import { isOwnerEmail, isOwnerIdentity, OWNER_WALLETS } from "./ownerDesk";

describe("owner desk identity", () => {
  it("requires the signed-in owner email and ignores wallets", () => {
    expect(isOwnerEmail("audifyx@gmail.com")).toBe(true);
    expect(isOwnerIdentity({ email: "audifyx@gmail.com", wallet: "anything" })).toBe(true);
    expect(isOwnerIdentity({ email: null, wallet: "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd" })).toBe(false);
    expect(isOwnerIdentity({ email: "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd@wallet.orbitx.app" })).toBe(false);
    expect(OWNER_WALLETS).toEqual([]);
  });
});
