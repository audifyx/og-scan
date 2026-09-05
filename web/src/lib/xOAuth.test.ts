import { describe, expect, it, vi } from "vitest";
import {
  consumeOAuthHash,
  oauthErrorFromLocation,
  oauthRedirectTo,
  usernameFromSocialMeta,
} from "./xOAuth";

describe("oauthRedirectTo", () => {
  it("uses a short www /auth URL so X state stays under 500 chars", () => {
    expect(oauthRedirectTo("https://orbitx.world/play?next=/app")).toBe("https://www.orbitx.world/auth");
    expect(oauthRedirectTo("https://www.orbitx.world/auth?mode=wallet")).toBe("https://www.orbitx.world/auth");
  });
});

describe("consumeOAuthHash", () => {
  it("reads implicit-grant tokens from the callback hash", () => {
    expect(consumeOAuthHash("#access_token=at&refresh_token=rt&expires_in=3600")).toEqual({
      access_token: "at",
      refresh_token: "rt",
    });
    expect(consumeOAuthHash("#type=recovery")).toBeNull();
  });
});

describe("oauthErrorFromLocation", () => {
  it("surfaces GoTrue error_description", () => {
    expect(oauthErrorFromLocation("?error=access_denied&error_description=User+denied")).toBe("User denied");
  });
});

describe("usernameFromSocialMeta", () => {
  it("prefers the X handle", () => {
    expect(usernameFromSocialMeta({ user_name: "Nova_Trader", full_name: "Nova" })).toBe("nova_trader");
  });
});
