import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailAuthErrorMessage, signInWithEmailPassword } from "./emailAuth";

const signInWithPassword = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    },
  },
}));

describe("emailAuth", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
  });

  it("maps GoTrue credential errors to a friendly message", () => {
    expect(emailAuthErrorMessage("Auth error: Invalid login credentials")).toBe("Invalid email or password");
    expect(emailAuthErrorMessage("email not confirmed")).toMatch(/Confirm your email/i);
  });

  it("signs in with supabase.auth.signInWithPassword", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "at" }, user: { id: "u1" } },
      error: null,
    });
    await signInWithEmailPassword("you@email.com", "secret");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "you@email.com", password: "secret" });
  });

  it("maps invalid credentials from GoTrue", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });
    await expect(signInWithEmailPassword("you@email.com", "nope")).rejects.toThrow("Invalid email or password");
  });
});
