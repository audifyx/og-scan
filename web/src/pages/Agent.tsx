import React, { useState, useEffect } from 'react';
import { AgentDashboard } from '../components/agent/agent-dashboard';
import { TokenGatingVerifier } from '../components/agent/token-gating-verifier';

function AgentPage() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        setIsLoading(true);
        // Check if user has token access via API
        const response = await fetch('/api/verify-access', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('agent_api_key') || ''}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHasAccess(data.hasAccess);
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
  }, []);

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
