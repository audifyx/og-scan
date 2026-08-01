import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2 } from "lucide-react";
import { AgentDashboard } from "../components/agent/agent-dashboard";
import { TokenGatingVerifier } from "../components/agent/token-gating-verifier";
import { useAuth } from "@/hooks/useAuth";
import {
  isTokenGateExemptWallet,
  resolveAuthWallet,
  verifyAgentHold,
} from "@/lib/agentTokenGate";

/** /agent — MCP hub; non-exempt users must pass the ORBITX hold block. */
function AgentPage() {
  const { publicKey } = useWallet();
  const { user, profile } = useAuth();
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
    if (isTokenGateExemptWallet(walletAddress)) {
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
  }, [walletAddress]);

  useEffect(() => {
    void check();
  }, [check]);

  if (gate === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070d] text-white/50">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        <span className="ml-3 text-sm">Checking ORBITX hold…</span>
      </main>
    );
  }

  if (gate === "blocked") {
    return (
      <main className="min-h-screen bg-[#05070d]">
        <TokenGatingVerifier onUnlocked={() => setGate("open")} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070d]">
      <AgentDashboard />
    </main>
  );
}

export default AgentPage;
