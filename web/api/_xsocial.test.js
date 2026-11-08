/**
 * Tests for web/api/_xsocial.js (W2) — the X profile enrichment proxy.
 * Covers user normalization and the no-bearer-token / bad-handle paths.
 * Live X API calls are NOT made here; the live check is a separate probe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler, { normalizeXUserResponse, normalizeXTweetResponse, normalizeXTweetsResponse } from "./_xsocial.js";

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(b) {
      this.body = b;
    },
  };
  return res;
}

describe("normalizeXUserResponse", () => {
  it("normalizes a full X API v2 user", () => {
    expect(
      normalizeXUserResponse({
        id: "1",
        username: "orbitx_wrld",
        name: "OrbitX",
        description: "Trading ecosystem",
        created_at: "2024-01-15T00:00:00.000Z",
        verified: false,
        protected: false,
        profile_image_url: "https://example.com/i.jpg",
        public_metrics: { followers_count: 646, following_count: 120, tweet_count: 900, listed_count: 3 },
      }),
    ).toEqual({
      handle: "orbitx_wrld",
      name: "OrbitX",
      description: "Trading ecosystem",
      followers: 646,
      following: 120,
      tweetCount: 900,
      listed: 3,
      createdAt: "2024-01-15T00:00:00.000Z",
      verified: false,
      protected: false,
      profileImageUrl: "https://example.com/i.jpg",
    });
  });
  it("never invents counts — missing metrics stay null", () => {
    expect(normalizeXUserResponse({ username: "someone" })).toMatchObject({
      handle: "someone",
      followers: null,
      tweetCount: null,
    });
  });
  it("returns null for unusable payloads", () => {
    expect(normalizeXUserResponse(null)).toBeNull();
    expect(normalizeXUserResponse({})).toBeNull();
    expect(normalizeXUserResponse({ username: "" })).toBeNull();
    expect(normalizeXUserResponse("nope")).toBeNull();
  });
});

describe("normalizeXTweetResponse / normalizeXTweetsResponse", () => {
  it("normalizes a full X API v2 tweet", () => {
    expect(
      normalizeXTweetResponse({
        id: "1850000000000000001",
        text: "gm OrbitX",
        created_at: "2026-11-07T12:00:00.000Z",
        public_metrics: { like_count: 42, retweet_count: 5, reply_count: 2 },
      }),
    ).toEqual({
      id: "1850000000000000001",
      text: "gm OrbitX",
      createdAt: "2026-11-07T12:00:00.000Z",
      likeCount: 42,
      repostCount: 5,
      replyCount: 2,
    });
  });
  it("never invents counts — missing metrics stay null", () => {
    expect(normalizeXTweetResponse({ id: "9", text: "hi" })).toMatchObject({
      id: "9",
      likeCount: null,
      repostCount: null,
      replyCount: null,
      createdAt: null,
    });
  });
  it("returns null for unusable tweets", () => {
    expect(normalizeXTweetResponse(null)).toBeNull();
    expect(normalizeXTweetResponse({})).toBeNull();
    expect(normalizeXTweetResponse({ id: "1" })).toBeNull(); // no text
    expect(normalizeXTweetResponse({ text: "no id" })).toBeNull();
  });
  it("normalizeXTweetsResponse accepts { data: [...] }, empty is a real state", () => {
    expect(
      normalizeXTweetsResponse({
        data: [
          { id: "1", text: "a" },
          { id: "bad-no-text" },
          { id: "2", text: "b" },
        ],
      }),
    ).toHaveLength(2); // bad entry dropped
    expect(normalizeXTweetsResponse({ data: [] })).toEqual([]);
    expect(normalizeXTweetsResponse({})).toBeNull();
    expect(normalizeXTweetsResponse(null)).toBeNull();
  });
});

describe("handler", () => {
  const OLD_BEARER = process.env.TWITTER_BEARER_TOKEN;
  const OLD_X_BEARER = process.env.X_BEARER_TOKEN;

  beforeEach(() => {
    delete process.env.TWITTER_BEARER_TOKEN;
    delete process.env.X_BEARER_TOKEN;
  });
  afterEach(() => {
    if (OLD_BEARER !== undefined) process.env.TWITTER_BEARER_TOKEN = OLD_BEARER;
    if (OLD_X_BEARER !== undefined) process.env.X_BEARER_TOKEN = OLD_X_BEARER;
    vi.unstubAllGlobals();
  });

  it("rejects a bad handle with 400", async () => {
    const res = fakeRes();
    await handler({ query: { handle: "not a handle!!" } }, res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).reason).toBe("invalid_handle");
  });

  it("no bearer token -> 200 unavailable with reason no_bearer_token", async () => {
    const res = fakeRes();
    await handler({ query: { handle: "orbitx_wrld" } }, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(false);
    expect(body.status).toBe("unavailable");
    expect(body.reason).toBe("no_bearer_token");
  });

  it("with a bearer token it calls api.twitter.com and returns the profile", async () => {
    process.env.TWITTER_BEARER_TOKEN = "test-bearer";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            username: "orbitx_wrld",
            name: "OrbitX",
            created_at: "2024-01-15T00:00:00.000Z",
            public_metrics: { followers_count: 646, following_count: 120, tweet_count: 900 },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = fakeRes();
    await handler({ query: { handle: "orbitx_wrld" } }, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("available");
    expect(body.profile.followers).toBe(646);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.twitter.com/2/users/by/username/orbitx_wrld");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("test-bearer");
  });

  it("X API 429 -> unavailable rate_limited, still HTTP 200", async () => {
    process.env.TWITTER_BEARER_TOKEN = "test-bearer";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("slow down", { status: 429 })));
    const res = fakeRes();
    await handler({ query: { handle: "orbitx_wrld" } }, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).reason).toBe("rate_limited");
  });

  it("include=timeline fetches profile + 10 recent tweets in one response", async () => {
    process.env.TWITTER_BEARER_TOKEN = "test-bearer";
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (String(url).includes("/tweets")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { id: "1", text: "gm OrbitX", created_at: "2026-11-07T12:00:00.000Z", public_metrics: { like_count: 42, retweet_count: 5, reply_count: 2 } },
                { id: "2", text: "ship it" },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              username: "orbitx_wrld",
              name: "OrbitX",
              created_at: "2024-01-15T00:00:00.000Z",
              public_metrics: { followers_count: 646, following_count: 120, tweet_count: 900 },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = fakeRes();
    await handler({ query: { handle: "orbitx_wrld", include: "timeline" } }, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.profile.followers).toBe(646);
    expect(body.timeline.status).toBe("available");
    expect(body.timeline.posts).toHaveLength(2);
    expect(body.timeline.posts[0]).toMatchObject({ id: "1", likeCount: 42 });
    expect(body.timeline.posts[1]).toMatchObject({ id: "2", likeCount: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/tweets");
    expect(String(fetchMock.mock.calls[1][0])).toContain("max_results=10");
  });

  it("timeline 403 -> profile still available, timeline unavailable forbidden", async () => {
    process.env.TWITTER_BEARER_TOKEN = "test-bearer";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url) => {
        if (String(url).includes("/tweets")) {
          return Promise.resolve(new Response("forbidden", { status: 403 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ data: { username: "orbitx_wrld", public_metrics: {} } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
    const res = fakeRes();
    await handler({ query: { handle: "orbitx_wrld", include: "timeline" } }, res);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.profile.handle).toBe("orbitx_wrld");
    expect(body.timeline.status).toBe("unavailable");
    expect(body.timeline.reason).toBe("forbidden");
  });

  it("timeline network error -> profile still available, timeline unavailable proxy_error", async () => {
    process.env.TWITTER_BEARER_TOKEN = "test-bearer";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url) => {
        if (String(url).includes("/tweets")) {
          return Promise.reject(new Error("boom"));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ data: { username: "orbitx_wrld", public_metrics: {} } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
    const res = fakeRes();
    await handler({ query: { handle: "orbitx_wrld", include: "timeline" } }, res);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.timeline.status).toBe("unavailable");
    expect(body.timeline.reason).toBe("proxy_error");
  });

  it("no bearer token + include=timeline -> timeline unavailable no_bearer_token too", async () => {
    const res = fakeRes();
    await handler({ query: { handle: "orbitx_wrld", include: "timeline" } }, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.reason).toBe("no_bearer_token");
    expect(body.timeline.status).toBe("unavailable");
    expect(body.timeline.reason).toBe("no_bearer_token");
  });

  it("without include=timeline the response is profile-only (one fetch)", async () => {
    process.env.TWITTER_BEARER_TOKEN = "test-bearer";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { username: "orbitx_wrld", public_metrics: {} } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = fakeRes();
    await handler({ query: { handle: "orbitx_wrld" } }, res);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.timeline).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
