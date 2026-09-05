import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startSignInWithX } from "@/lib/xOAuth";
import "@/pages/auth.css";

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function XSignInButton({
  next,
  disabled,
}: {
  next?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await startSignInWithX(next);
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error && err.message ? err.message : "X sign-in failed");
    }
  };

  return (
    <button
      type="button"
      className="ox-auth-btn ox-auth-btn--x"
      disabled={disabled || busy}
      onClick={() => void run()}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XMark className="h-4 w-4" />}
      Continue with X
    </button>
  );
}
