import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AgentDashboard } from '../components/agent/agent-dashboard';
import { TokenGatingVerifier } from '../components/agent/token-gating-verifier';
import { isTokenGateExemptWallet } from '../lib/agentTokenGate';

function AgentPage() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // DEF wallet bypasses the $10 ORBITX hold requirement
    if (isTokenGateExemptWallet(walletAddress)) {
      setHasAccess(true);
      setIsLoading(false);
      return;
    }

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

        if (response.ok) {
          const data = await response.json();
          setHasAccess(Boolean(data.hasAccess));
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('[v0] Token access verification failed:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAccess();
  }, [walletAddress]);

  if (isLoading) {
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
