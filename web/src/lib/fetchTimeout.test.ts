import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  isAuthApiUrl,
  supabaseAwareFetch,
} from "./fetchTimeout";

describe("fetchTimeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("recognizes GoTrue auth URLs", () => {
    expect(isAuthApiUrl("https://ffjipnkhcebjvttliptb.supabase.co/auth/v1/token?grant_type=password")).toBe(true);
    expect(isAuthApiUrl("https://ffjipnkhcebjvttliptb.supabase.co/rest/v1/profiles")).toBe(false);
  });

  it("aborts when the server never responds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }));
    const pending = fetchWithTimeout("https://example.test/hang", { method: "POST" }, 50);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it("turns a hung auth token grant into a login timeout error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }));
    const pending = supabaseAwareFetch("https://example.supabase.co/auth/v1/token?grant_type=password", {
      method: "POST",
    });
    const assertion = expect(pending).rejects.toThrow(/Login service timed out/i);
    await vi.advanceTimersByTimeAsync(AUTH_FETCH_TIMEOUT_MS + 20);
    await assertion;
  });
});
