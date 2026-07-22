// Connect-anywhere = login. When a wallet connects on any route and there's no
// Supabase session yet, run Sign-In-With-Solana once (one signature). Guarded
// per-pubkey so it never loops or spams prompts.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { signInWithWallet } from "@/lib/walletAuth";

export function WalletAuthBridge() {
  const { publicKey, connected, wallet } = useWallet();
  const { user, loading } = useAuth();
  const location = useLocation();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (loading || user) return;
    if (!connected || !publicKey) return;
    if (location.pathname.startsWith("/auth")) return; // handled explicitly there
    const pk = publicKey.toBase58();
    if (attempted.current === pk) return;
    const flag = `orbitx_siws_${pk}`;
    if (sessionStorage.getItem(flag)) return;
    const adapter = wallet?.adapter as { signMessage?: (m: Uint8Array) => Promise<Uint8Array> } | undefined;
    if (!adapter?.signMessage) return;

    attempted.current = pk;
    sessionStorage.setItem(flag, "1");
    signInWithWallet(pk, (m) => adapter.signMessage!(m))
      .then(() => toast.success("Signed in with wallet"))
      .catch(() => { sessionStorage.removeItem(flag); attempted.current = null; });
  }, [connected, publicKey, user, loading, wallet, location.pathname]);

  return null;
}
