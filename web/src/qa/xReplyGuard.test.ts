import { describe, expect, it } from "vitest";
import {
  authorizeXReplyRequest,
  createRateLimiter,
  validateMentionPayload,
  xReplySecrets,
} from "../../../supabase/functions/_shared/x-reply-guard.js";

function req(headers: Record<string, string> = {}) {
  return new Request("https://example.test/x-reply-bot", { method: "POST", headers });
}

describe("x-reply-bot auth guard", () => {
  it("fails closed when no secret is configured", () => {
    const r = authorizeXReplyRequest(req({ authorization: "Bearer anything" }), {});
    expect(r).toEqual({ ok: false, status: 401, error: "not_configured" });
    expect(xReplySecrets({})).toEqual([]);
  });

  it("rejects missing or wrong bearer", () => {
    const env = { X_REPLY_BOT_SECRET: "correct-secret-value" };
    expect(authorizeXReplyRequest(req({}), env).status).toBe(401);
    expect(authorizeXReplyRequest(req({ authorization: "Bearer wrong" }), env).status).toBe(401);
    expect(authorizeXReplyRequest(req({ authorization: "Bearer correct-secret-value" }), env).ok).toBe(true);
    expect(
      authorizeXReplyRequest(req({ "x-orbitx-reply-secret": "correct-secret-value" }), env).ok,
    ).toBe(true);
  });

  it("accepts OXW_WORKER_SECRET as a legacy alias", () => {
    const env = { OXW_WORKER_SECRET: "worker-secret" };
    expect(authorizeXReplyRequest(req({ authorization: "Bearer worker-secret" }), env).ok).toBe(true);
  });

  it("validates mention payloads strictly", () => {
    expect(validateMentionPayload({ type: "mention", tweet: { id: "1234567890", text: "hi" } }).ok).toBe(true);
    expect(validateMentionPayload({ mention_id: "1234567890", tweet_text: "hi" }).ok).toBe(true);
    expect(validateMentionPayload({ type: "mention", tweet: { id: "not-an-id", text: "hi" } }).ok).toBe(false);
    expect(validateMentionPayload({ type: "mention", tweet: { id: "1", text: "hi" } }).ok).toBe(false);
    expect(validateMentionPayload({ type: "promo", tweet: { id: "1234567890", text: "hi" } }).ok).toBe(false);
    expect(validateMentionPayload({ type: "mention", tweet: { id: "1234567890", text: "" } }).ok).toBe(false);
    expect(
      validateMentionPayload({ type: "mention", tweet: { id: "1234567890", text: "x".repeat(561) } }).ok,
    ).toBe(false);
  });

  it("rate limits a key after 8 hits in a minute", () => {
    const lim = createRateLimiter({ windowMs: 60_000, max: 8 });
    for (let i = 0; i < 8; i++) expect(lim.allow("1.1.1.1")).toBe(true);
    expect(lim.allow("1.1.1.1")).toBe(false);
    expect(lim.allow("2.2.2.2")).toBe(true);
  });
});
