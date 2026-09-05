import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailAuthErrorMessage, signInWithEmailPassword } from "./emailAuth";

const install = vi.fn();
vi.mock("@/lib/authSession", async () => {
  const actual = await vi.importActual<typeof import("./authSession")>("./authSession");
  return {
    ...actual,
    installSupabaseSession: (...args: unknown[]) => install(...args),
  };
});

describe("signInWithEmailPassword", () => {
  beforeEach(() => {
    install.mockReset();
    install.mockResolvedValue(undefined);
    vi.unstubAllGlobals();
  });

  it("posts to same-origin /api/auth-login and persists tokens without calling GoTrue from the browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "at",
        refresh_token: "rt",
        user: { id: "u1", email: "me@orbitx.world" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await signInWithEmailPassword("me@orbitx.world", "secret");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth-login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({ email: "me@orbitx.world", password: "secret" });
    expect(install).toHaveBeenCalledWith(
      { access_token: "at", refresh_token: "rt" },
      { id: "u1", email: "me@orbitx.world" },
    );
  });

  it("throws a short error when the login API times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")),
    );
    await expect(signInWithEmailPassword("me@orbitx.world", "secret")).rejects.toThrow(
      /timed out/i,
    );
    expect(install).not.toHaveBeenCalled();
  });

  it("maps invalid credentials from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "INVALID_CREDENTIALS" }),
      }),
    );
    await expect(signInWithEmailPassword("me@orbitx.world", "bad")).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("falls back to /ai-fn/auth-signin when /api/auth-login returns a platform 500", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
        headers: { get: () => "text/plain" },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          access_token: "at2",
          refresh_token: "rt2",
          user: { id: "u2", email: "me@orbitx.world" },
        }),
        headers: { get: () => "application/json" },
      });
    vi.stubGlobal("fetch", fetchMock);

    await signInWithEmailPassword("me@orbitx.world", "secret");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth-login");
    expect(fetchMock.mock.calls[1][0]).toBe("/ai-fn/auth-signin");
    expect(install).toHaveBeenCalledWith(
      { access_token: "at2", refresh_token: "rt2" },
      { id: "u2", email: "me@orbitx.world" },
    );
  });
});

describe("emailAuthErrorMessage", () => {
  it("maps invalid-login-credentials to a friendly sentence", () => {
    expect(emailAuthErrorMessage({ message: "Invalid login credentials" })).toBe(
      "Invalid email or password",
    );
  });

  it("maps email-not-confirmed without dumping raw GoTrue text", () => {
    expect(emailAuthErrorMessage({ message: "Email not confirmed" })).toBe(
      "Confirm your email first — check your inbox",
    );
  });

  it("falls back to a short unknown-error line", () => {
    expect(emailAuthErrorMessage(null)).toBe("Sign-in failed");
  });
});
