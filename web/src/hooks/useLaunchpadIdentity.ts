import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { canLaunch, identityFromSession, type LaunchIdentity } from "@/lib/launchpad";
import { linkWalletPubkey } from "@/lib/launchpad/registry";

export function useLaunchpadIdentity() {
  const { user, profile, loading } = useAuth();
  const { publicKey, connected } = useWallet();
  const [row, setRow] = useState<{
    twitter_id?: string | null;
    twitter_username?: string | null;
    twitter_avatar?: string | null;
    wallet_pubkey?: string | null;
  } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setRow(null);
      return;
    }
    let alive = true;
    void supabase
      .from("profiles")
      .select("twitter_id, twitter_username, twitter_avatar, wallet_pubkey")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setRow(data as typeof row);
      });
    return () => {
      alive = false;
    };
  }, [user?.id, profile?.id]);

  const connectedWallet = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!user?.id || !connectedWallet) return;
    if (row?.wallet_pubkey === connectedWallet) return;
    let cancelled = false;
    void linkWalletPubkey(user.id, connectedWallet).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setConflict(res.message);
        return;
      }
      setConflict(null);
      setRow((prev) => ({ ...(prev || {}), wallet_pubkey: connectedWallet }));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, connectedWallet, row?.wallet_pubkey]);

  const identity: LaunchIdentity = useMemo(
    () =>
      identityFromSession({
        userId: user?.id,
        identities: (user?.identities ?? []) as Array<{ provider?: string; id?: string; identity_data?: Record<string, unknown> }>,
        userMeta: (user?.user_metadata as Record<string, unknown>) || null,
        profile: {
          twitter_id: row?.twitter_id,
          twitter_username: row?.twitter_username,
          twitter_avatar: row?.twitter_avatar,
          wallet_pubkey: row?.wallet_pubkey,
        },
        connectedWallet,
      }),
    [user, row, connectedWallet],
  );

  return {
    identity,
    ready: canLaunch(identity),
    loading,
    connected,
    conflict,
    userId: user?.id ?? null,
  };
}
