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
  });

  it("maps GoTrue credential errors to a friendly message", () => {
    expect(emailAuthErrorMessage("Auth error: Invalid login credentials")).toBe("Invalid email or password");
    expect(emailAuthErrorMessage("email not confirmed")).toMatch(/Confirm your email/i);
  });

  it("installs the session returned by auth-signin", async () => {
    invokeEdgeFn.mockResolvedValue({
      success: true,
      session: { access_token: "at", refresh_token: "rt" },
    });
    await signInWithEmailPassword("you@email.com", "secret");
    expect(invokeEdgeFn).toHaveBeenCalledWith("auth-signin", { email: "you@email.com", password: "secret" });
    expect(setSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
  });

  it("does not call GoTrue password grant from the browser", async () => {
    invokeEdgeFn.mockResolvedValue({
      success: false,
      error: "Auth error: Invalid login credentials",
    });
    await expect(signInWithEmailPassword("you@email.com", "nope")).rejects.toThrow("Invalid email or password");
    expect(setSession).not.toHaveBeenCalled();
  });
});
