import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AgentDashboard } from "../components/agent/agent-dashboard";
import { TokenGatingVerifier } from "../components/agent/token-gating-verifier";
import { useAuth } from "@/hooks/useAuth";
import {
  isAgentHoldExempt,
  resolveAuthWallet,
  verifyAgentHold,
} from "@/lib/agentTokenGate";
import { isOwnerIdentity } from "@/lib/ownerDesk";
import "../components/agent/agent-terminal.css";

/** /agent — MCP hub; terminal UI; non-exempt users must pass ORBITX hold. */
function AgentPage() {
  const { publicKey } = useWallet();
  const { user, profile, loading: authLoading } = useAuth();
  const [gate, setGate] = useState<"loading" | "blocked" | "open">("loading");

  const walletAddress = useMemo(
    () =>
      resolveAuthWallet({
        connectedPk: publicKey?.toBase58() ?? null,
        email: user?.email,
        userMetadata: (user?.user_metadata as Record<string, unknown> | undefined) ?? null,
        profileWallet:
          (profile as { wallet_address?: string | null; sol_wallet?: string | null } | null)
            ?.wallet_address ||
          (profile as { sol_wallet?: string | null } | null)?.sol_wallet ||
          null,
      }),
    [publicKey, user?.email, user?.user_metadata, profile],
  );

  const check = useCallback(async () => {
    // Wait for auth before deciding — owner email exemption needs user.email.
    if (authLoading) {
      setGate("loading");
      return;
    }

    if (
      isAgentHoldExempt({ wallet: walletAddress, email: user?.email }) ||
      isOwnerIdentity({ email: user?.email, wallet: walletAddress })
    ) {
      setGate("open");
      return;
    }
    setGate("loading");
    try {
      const hold = await verifyAgentHold(walletAddress);
      setGate(hold.meetsRequirement || hold.exempt ? "open" : "blocked");
    } catch {
      setGate("blocked");
    }
  }, [walletAddress, user?.email, authLoading]);

  useEffect(() => {
    void check();
  }, [check]);

  if (gate === "loading") {
    return (
      <main className="ox-term__loading">
        <span>checking orbitx hold</span>
        <span className="ox-term__cursor" />
      </main>
    );
  }

  if (gate === "blocked") {
    return (
      <main className="ox-term">
        <TokenGatingVerifier onUnlocked={() => setGate("open")} />
      </main>
    );
  }

  return (
    <main>
      <AgentDashboard />
    </main>
  );
}

export default AgentPage;
