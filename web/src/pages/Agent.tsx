import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AgentDashboard } from '../components/agent/agent-dashboard';
import { TokenGatingVerifier } from '../components/agent/token-gating-verifier';
import { isTokenGateExemptWallet, resolveAuthWallet } from '../lib/agentTokenGate';
import { useAuth } from '@/hooks/useAuth';

function AgentPage() {
  const { publicKey } = useWallet();
  const { user, profile, loading: authLoading } = useAuth();

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

  const exempt = isTokenGateExemptWallet(walletAddress);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // DEF wallet bypasses the $10 ORBITX hold requirement
    if (exempt) {
      setHasAccess(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const verifyAccess = async () => {
      try {
        setIsLoading(true);
        const headers: Record<string, string> = {
          Authorization: `Bearer ${localStorage.getItem('agent_api_key') || ''}`,
        };
        if (walletAddress) {
          headers['x-wallet-address'] = walletAddress;
        }

        const response = await fetch('/api/verify-access', { headers });
        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          setHasAccess(Boolean(data.hasAccess));
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('[v0] Token access verification failed:', error);
        if (!cancelled) setHasAccess(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [authLoading, exempt, walletAddress]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">Loading...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return <TokenGatingVerifier />;
  }

  return (
    <main className="min-h-screen bg-background">
      <AgentDashboard />
    </main>
  );
}

export default AgentPage;
