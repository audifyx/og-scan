import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { XSignInButton } from "@/components/XSignInButton";

const start = vi.fn();
vi.mock("@/lib/xOAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/xOAuth")>("@/lib/xOAuth");
  return { ...actual, startSignInWithX: (...args: unknown[]) => start(...args) };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("XSignInButton", () => {
  it("starts the X OAuth redirect with the next path", async () => {
    start.mockResolvedValue(undefined);
    render(<XSignInButton next="/os/dashboard" />);
    screen.getByRole("button", { name: /continue with x/i }).click();
    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledWith("/os/dashboard");
    });
  });
});
