// Connect-anywhere = login. When a wallet connects on any route and there's no
// Supabase session yet, run Sign-In-With-Solana once (one signature).
// NEVER overwrite an existing email (or any) session — that felt like "signed out".
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { signInWithWallet } from "@/lib/walletAuth";
import { supabase } from "@/lib/supabase";
import { normalizeSignatureBytes } from "@/lib/wallets/walletNormalize";

function isWalletEmail(email?: string | null) {
  return !!email && /@wallet\.orbitx\.app$/i.test(email);
}

export function WalletAuthBridge() {
  const { publicKey, connected, wallet } = useWallet();
  const { user, loading } = useAuth();
  const location = useLocation();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (loading) return;
      // Already authenticated — never clobber (especially email sessions).
      if (user) return;
      if (!connected || !publicKey) return;
      if (location.pathname.startsWith("/auth")) return;

      // Double-check persisted session (covers loading race where user is briefly null).
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        // Email sessions must never be replaced by auto-SIWS.
        if (!isWalletEmail(session.user.email)) return;
        return;
      }

      const pk = publicKey.toBase58();
      if (attempted.current === pk) return;
      const flag = `orbitx_siws_${pk}`;
      if (sessionStorage.getItem(flag)) return;
      const adapter = wallet?.adapter as {
        signMessage?: (m: Uint8Array) => Promise<unknown>;
      } | undefined;
      if (!adapter?.signMessage) return;

      attempted.current = pk;
      sessionStorage.setItem(flag, "1");
      try {
        await signInWithWallet(pk, async (m) => {
          return normalizeSignatureBytes(await adapter.signMessage!(m));
        }, { replaceEmailSession: false });
        if (!cancelled) toast.success("Signed in with wallet");
      } catch {
        sessionStorage.removeItem(flag);
        attempted.current = null;
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [connected, publicKey, user, loading, wallet, location.pathname]);

  return null;
}
