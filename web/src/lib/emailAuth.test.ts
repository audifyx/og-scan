import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailAuthErrorMessage, signInWithEmailPassword } from "./emailAuth";

const invokeEdgeFn = vi.fn();
const setSession = vi.fn();

vi.mock("@/lib/edgeFn", () => ({
  invokeEdgeFn: (...args: unknown[]) => invokeEdgeFn(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      setSession: (...args: unknown[]) => setSession(...args),
    },
  },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

describe("emailAuth", () => {
  beforeEach(() => {
    invokeEdgeFn.mockReset();
    setSession.mockReset();
    setSession.mockResolvedValue({ error: null });
    vi.unstubAllGlobals();
  });

  it("maps GoTrue credential errors to a friendly message", () => {
    expect(emailAuthErrorMessage("Auth error: Invalid login credentials")).toBe("Invalid email or password");
    expect(emailAuthErrorMessage("email not confirmed")).toMatch(/Confirm your email/i);
  });

  it("signs in through GoTrue password grant first", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      access_token: "at",
      refresh_token: "rt",
      user: { id: "u1", email: "you@email.com" },
    })));
    await signInWithEmailPassword("you@email.com", "secret");
    expect(invokeEdgeFn).not.toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
    const url = String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("/auth/v1/token?grant_type=password");
  });

  it("does not fall through to auth-signin on invalid credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ msg: "Invalid login credentials" }, { status: 400 })));
    await expect(signInWithEmailPassword("you@email.com", "nope")).rejects.toThrow("Invalid email or password");
    expect(invokeEdgeFn).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it("falls back to auth-signin when GoTrue is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Failed to fetch");
    }));
    invokeEdgeFn.mockResolvedValue({
      success: true,
      access_token: "at2",
      refresh_token: "rt2",
    });
    await signInWithEmailPassword("you@email.com", "secret");
    expect(invokeEdgeFn).toHaveBeenCalledWith("auth-signin", { email: "you@email.com", password: "secret" }, { timeoutMs: 20_000 });
    expect(setSession).toHaveBeenCalledWith({ access_token: "at2", refresh_token: "rt2" });
  });
});
