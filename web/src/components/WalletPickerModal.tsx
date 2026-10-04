// OrbitX sign-in modal — X, in-app wallet link, or email.
// The in-app wallet is the only wallet; linking it is one tap, no extension.
import { createPortal } from "react-dom";
import { X, Loader2, Wallet, Mail } from "lucide-react";
import type { PickableWallet } from "@/hooks/useWalletSignIn";
import { XSignInButton } from "@/components/XSignInButton";
import { useAuth } from "@/hooks/useAuth";
import "@/pages/auth.css";

function currentPath(): string {
  if (typeof window === "undefined") return "/app";
  return `${window.location.pathname}${window.location.search}` || "/app";
}

export function WalletPickerModal({ open, onClose, wallets, onPick, busy }: {
  open: boolean; onClose: () => void; wallets: PickableWallet[];
  onPick: (name: string) => void; busy: string | null;
}) {
  const { user } = useAuth();
  if (!open) return null;
  if (typeof document === "undefined") return null;

  const next = currentPath();
  const walletOnly = Boolean(user);
  const rows = wallets.length ? wallets : [
    { name: "In-App", icon: "", readyState: "Installed" as const, adapter: { name: "In-App", icon: "", url: "" } },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ox-auth-picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ox-auth-picker-title">
        <div className="ox-auth-card">
          <button type="button" className="ox-auth-picker-close" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          <div className="ox-auth-kicker">Secure access</div>
          <h3 id="ox-auth-picker-title" className="ox-auth-title ox-auth-title--modal">
            {walletOnly ? "Link your wallet" : "Welcome back"}
          </h3>
          <p className="ox-auth-sub">
            {walletOnly
              ? "Your OrbitX in-app wallet — one link, no extension, no popups after."
              : "Continue with X, your in-app wallet, or email."}
          </p>

          {!walletOnly && (
            <div className="ox-auth-social">
              <XSignInButton next={next} disabled={!!busy} />
            </div>
          )}

          {!walletOnly && <div className="ox-auth-or">or wallet</div>}

          <div className="ox-auth-wallet" style={walletOnly ? { marginTop: 16 } : undefined}>
            {rows.map((w) => (
              <button
                key={w.name}
                type="button"
                onClick={() => onPick(w.name)}
                disabled={!!busy}
                className="ox-auth-btn ox-auth-btn--blue"
              >
                {busy === w.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Link in-app wallet
              </button>
            ))}
          </div>

          {!walletOnly && (
            <>
              <div className="ox-auth-or">or email</div>
              <a className="ox-auth-btn ox-auth-btn--ghost" href={`/auth?next=${encodeURIComponent(next)}`}>
                <Mail className="h-4 w-4" /> Sign in with email
              </a>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
