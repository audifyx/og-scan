'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XIntegration } from './x-integration';
import { AgentSettings } from './agent-settings';
import { AgentAPIKeys } from './agent-api-keys';
import { AgentActivity } from './agent-activity';
import { MCPControlPanel } from './mcp-control-panel';

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: string;
  walletAddress?: string;
  phantomConnected: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentDetailProps {
  agentId: string;
}

export function AgentDetail({ agentId }: AgentDetailProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xConnection, setXConnection] = useState<{ username: string } | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAgent();
    fetchXConnection();
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      setIsLoading(true);
      const apiKey = localStorage.getItem('agent_api_key');
      const response = await fetch(`/api/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch agent');
      const data = await response.json();
      setAgent(data.agent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchXConnection = async () => {
    try {
      const response = await fetch('/api/x/connection');
      if (response.ok) {
        const data = await response.json();
        setXConnection(data.connection);
      }
    } catch (err) {
      console.error('[v0] Failed to fetch X connection:', err);
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">{error}</div>;
  if (!agent) return <div className="text-muted-foreground">Agent not found</div>;

  return (
    <div className="space-y-6">
      <div className="bg-muted p-6 rounded-lg border border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Agent Name</p>
            <p className="text-xl font-bold text-foreground">{agent.name}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Status</p>
            <p className={`font-semibold ${agent.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
              {agent.status.toUpperCase()}
            </p>
          </div>

          {agent.description && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="text-foreground">{agent.description}</p>
            </div>
          )}

          {agent.walletAddress && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Connected Wallet</p>
              <code className="bg-background px-3 py-2 rounded text-sm text-foreground break-all">
                {agent.walletAddress}
              </code>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">Phantom Status</p>
            <p className={agent.phantomConnected ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
              {agent.phantomConnected ? '✓ Connected' : '✗ Not Connected'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Created</p>
            <p className="text-foreground">{new Date(agent.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {!agent.phantomConnected && (
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-4 rounded-lg">
          <p className="text-sm text-orange-800 dark:text-orange-300">
            ⚠ Wallet not connected. Connect your Phantom wallet to enable agent execution.
          </p>
        </div>
      )}

      {/* Tabs for different features */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="x">X/Twitter</TabsTrigger>
          <TabsTrigger value="mcp">MCP Control</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <AgentSettings agentId={agentId} />
        </TabsContent>

        <TabsContent value="x" className="space-y-4">
          <XIntegration
            agentId={agentId}
            xConnected={!!xConnection}
            xUsername={xConnection?.username}
          />
        </TabsContent>

        <TabsContent value="mcp" className="space-y-4">
          <MCPControlPanel agentId={agentId} />
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          <AgentAPIKeys agentId={agentId} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <AgentActivity agentId={agentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
