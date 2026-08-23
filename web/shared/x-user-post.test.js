import { describe, expect, it } from "vitest";
import {
  authorizeReplyBotRequest,
  requireUserXAccessToken,
  uploadImageWithUserOAuth2,
  X_NOT_CONNECTED_MESSAGE,
} from "./x-user-post.js";

describe("X user-owned posting", () => {
  it("refuses posts without the caller's X token", () => {
    expect(requireUserXAccessToken("")).toMatchObject({ ok: false, error: "x_not_connected" });
    expect(requireUserXAccessToken(null).message).toBe(X_NOT_CONNECTED_MESSAGE);
    expect(requireUserXAccessToken("user-oauth2")).toEqual({
      ok: true,
      accessToken: "user-oauth2",
    });
  });

  it("fails closed when the reply-bot secret is missing", () => {
    expect(authorizeReplyBotRequest({ authorization: "Bearer anything" }, [])).toBe(false);
    expect(authorizeReplyBotRequest({ authorization: "Bearer anything" }, [""])).toBe(false);
  });

  it("accepts only the internal reply-bot secret", () => {
    const secret = "orbitx-internal-reply";
    expect(
      authorizeReplyBotRequest({ authorization: `Bearer ${secret}` }, [secret]),
    ).toBe(true);
    expect(
      authorizeReplyBotRequest({ "x-orbitx-reply-secret": secret }, [secret]),
    ).toBe(true);
    expect(
      authorizeReplyBotRequest({ authorization: "Bearer attacker" }, [secret]),
    ).toBe(false);
  });

  it("will not upload media without a user token", async () => {
    await expect(uploadImageWithUserOAuth2("", "https://example.com/x.png")).rejects.toThrow(
      /own X account|User X token/i,
    );
  });
});
