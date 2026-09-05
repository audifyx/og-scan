import { describe, expect, it } from "vitest";
import {
  buildSolanaSiwsMessage,
  bytesToBase64Url,
  canonicalAuthUrl,
  isLikelyNewAuthUser,
  WEB3_STATEMENT,
} from "./web3Auth";

describe("canonicalAuthUrl", () => {
  it("rewrites apex orbitx.world to www so SIWS matches the live Site URL", () => {
    const url = canonicalAuthUrl("https://orbitx.world/auth?next=/app#frag");
    expect(url.hostname).toBe("www.orbitx.world");
    expect(url.pathname).toBe("/auth");
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
  });

  it("keeps www.orbitx.world", () => {
    expect(canonicalAuthUrl("https://www.orbitx.world/play").href).toBe("https://www.orbitx.world/play");
  });
});

describe("buildSolanaSiwsMessage", () => {
  it("matches the supabase-js SIWS fields GoTrue validates", () => {
    const msg = buildSolanaSiwsMessage(
      "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "https://www.orbitx.world/auth?mode=wallet",
      "2026-09-05T19:00:00.000Z",
    );
    expect(msg).toContain("www.orbitx.world wants you to sign in with your Solana account:");
    expect(msg).toContain("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
    expect(msg).toContain(WEB3_STATEMENT);
    expect(msg).toContain("Version: 1");
    expect(msg).toContain("URI: https://www.orbitx.world/auth");
    expect(msg).toContain("Issued At: 2026-09-05T19:00:00.000Z");
    expect(msg).not.toMatch(/\n\n\n/);
  });
});

describe("bytesToBase64Url", () => {
  it("encodes without plus, slash, or padding", () => {
    const out = bytesToBase64Url(new Uint8Array([251, 255, 191]));
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(out).not.toMatch(/[+/=]/);
  });
});

describe("isLikelyNewAuthUser", () => {
  it("treats a just-created user as new", () => {
    expect(isLikelyNewAuthUser({ created_at: new Date().toISOString() })).toBe(true);
  });

  it("treats an old account as returning", () => {
    expect(isLikelyNewAuthUser({ created_at: "2024-01-01T00:00:00.000Z", last_sign_in_at: "2026-09-01T00:00:00.000Z" })).toBe(false);
  });
});
