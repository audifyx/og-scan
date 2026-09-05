import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InjectWalletButtons } from "@/components/InjectWalletButtons";
import { WalletPickerModal } from "@/components/WalletPickerModal";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/xOAuth", () => ({
  startSignInWithX: vi.fn(),
}));

describe("wallet connect labels", () => {
  it("auth buttons always say Connect, never Install", () => {
    render(<InjectWalletButtons />);
    expect(screen.getByRole("button", { name: /connect phantom/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect jupiter/i })).toBeInTheDocument();
    expect(screen.queryByText(/install phantom/i)).toBeNull();
    expect(screen.queryByText(/install jupiter/i)).toBeNull();
  });

  it("picker is the supabase auth surface, not a wallet-adapter install modal", () => {
    render(
      <WalletPickerModal
        open
        onClose={() => {}}
        wallets={[]}
        onPick={() => {}}
        busy={null}
      />,
    );
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with x/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect phantom/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect jupiter/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in with email/i })).toBeInTheDocument();
    expect(screen.queryByText(/install phantom/i)).toBeNull();
    expect(screen.queryByText(/install jupiter/i)).toBeNull();
    expect(screen.queryByText(/^get phantom$/i)).toBeNull();
    expect(screen.queryByText(/^get jupiter$/i)).toBeNull();
  });
});
