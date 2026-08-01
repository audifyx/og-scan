'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: string;
  walletAddress?: string;
  phantomConnected: boolean;
  createdAt: string;
}

interface AgentsListProps {
  refreshTrigger: number;
}

export function AgentsList({ refreshTrigger }: AgentsListProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [refreshTrigger]);

  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const apiKey = localStorage.getItem('agent_api_key');
      if (!apiKey) {
        setError('No API key found. Please generate one first.');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/agents', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error('[v0] Error fetching agents:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg">
        {error}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg mb-4">No agents yet.</p>
        <p className="text-muted-foreground">Create your first agent to get started with autonomous trading.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {agents.map((agent) => (
        <Link key={agent.id} href={`/agent/${agent.id}`}>
          <div className="p-6 border border-border rounded-lg hover:border-primary transition cursor-pointer h-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-foreground">{agent.name}</h3>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  agent.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                }`}
              >
                {agent.status}
              </span>
            </div>

            {agent.description && (
              <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{agent.description}</p>
            )}

            <div className="space-y-2 text-sm">
              {agent.walletAddress && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Wallet:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    {agent.walletAddress.substring(0, 6)}...{agent.walletAddress.substring(-4)}
                  </code>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Phantom:</span>
                <span className="font-semibold">
                  {agent.phantomConnected ? '✓ Connected' : '✗ Not Connected'}
                </span>
              </div>

              <div className="text-muted-foreground text-xs">
                Created {new Date(agent.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
