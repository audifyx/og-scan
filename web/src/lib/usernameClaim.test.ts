import { describe, expect, it } from "vitest";
import {
  autoUsernameFromPubkey,
  needsUsernameClaim,
  validateClaimUsername,
} from "./usernameClaim";

describe("usernameClaim", () => {
  const pk = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

  it("builds the wallet-auth stub", () => {
    expect(autoUsernameFromPubkey(pk)).toBe("7xKXgAsU");
  });

  it("flags missing or stub usernames", () => {
    expect(needsUsernameClaim(null, pk)).toBe(true);
    expect(needsUsernameClaim("", pk)).toBe(true);
    expect(needsUsernameClaim(autoUsernameFromPubkey(pk), pk)).toBe(true);
    expect(needsUsernameClaim("nova_trader", pk)).toBe(false);
  });

  it("validates claimable usernames", () => {
    expect(validateClaimUsername("ab").ok).toBe(false);
    expect(validateClaimUsername("Nova_Trader").ok).toBe(true);
    if (validateClaimUsername("Nova_Trader").ok) {
      expect(validateClaimUsername("Nova_Trader").username).toBe("nova_trader");
    }
  });
});
