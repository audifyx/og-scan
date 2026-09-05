// OrbitX sign-in modal — same Supabase methods as /auth (X, Web3 SIWS, email).
// Phantom/Jupiter still sign a free SIWS message; this is not wallet-adapter.
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
  const rows = (wallets.length ? wallets : [
    { name: "Phantom", icon: "", readyState: "Loadable" as const, adapter: { name: "Phantom", icon: "", url: "https://phantom.app" } },
    { name: "Jupiter", icon: "", readyState: "Loadable" as const, adapter: { name: "Jupiter", icon: "", url: "https://jup.ag" } },
  ]).filter((w) => /phantom|jupiter/i.test(w.name));

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ox-auth-picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ox-auth-picker-title">
        <div className="ox-auth-card">
          <button type="button" className="ox-auth-picker-close" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          <div className="ox-auth-kicker">Secure access</div>
          <h3 id="ox-auth-picker-title" className="ox-auth-title ox-auth-title--modal">
            {walletOnly ? "Connect a wallet" : "Welcome back"}
          </h3>
          <p className="ox-auth-sub">
            {walletOnly
              ? "Phantom or Jupiter. You'll sign a free message — no transaction, no fees."
              : "Continue with X, a Solana wallet, or email."}
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
                className={/jupiter/i.test(w.name) ? "ox-auth-btn" : "ox-auth-btn ox-auth-btn--blue"}
              >
                {busy === w.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Connect {w.name}
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
