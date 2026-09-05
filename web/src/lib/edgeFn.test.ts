import { afterEach, describe, expect, it, vi } from "vitest";
import { edgeFunctionUrls, invokeEdgeFn } from "./edgeFn";

vi.mock("@/lib/supabase", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

describe("edgeFn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tries the same-origin /ai-fn proxy before the direct Supabase URL", () => {
    expect(edgeFunctionUrls("auth-signin")).toEqual([
      "/ai-fn/auth-signin",
      "https://example.supabase.co/functions/v1/auth-signin",
    ]);
  });

  it("falls back to the direct function when /ai-fn returns the SPA HTML", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/ai-fn/")) {
        return new Response("<!doctype html><title>OrbitX</title>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return Response.json({ ok: true, via: "direct" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const json = await invokeEdgeFn("wallet-auth", { action: "nonce", pubkey: "abc" });
    expect(json).toEqual({ ok: true, via: "direct" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/ai-fn/wallet-auth");
  });

  it("surfaces JSON errors from a reachable function without falling through", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Invalid login credentials" }, { status: 400 })));
    await expect(invokeEdgeFn("auth-signin", { email: "a@b.c", password: "x" })).rejects.toThrow(
      /Invalid login credentials/,
    );
  });

  it("maps a hung proxy + hung fallback into a timeout error", async () => {
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }));
    await expect(invokeEdgeFn("auth-signin", { email: "a@b.c", password: "x" }, { timeoutMs: 20 })).rejects.toThrow(
      /timed out/i,
    );
  });
});
