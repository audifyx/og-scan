'use client';

import React, { useState } from 'react';
import { AgentDetail } from '@/components/agent/agent-detail';
import { AgentSettings } from '@/components/agent/agent-settings';
import { AgentApiKeys } from '@/components/agent/agent-api-keys';
import { AgentActivity } from '@/components/agent/agent-activity';
import { McpControlPanel } from '@/components/agent/mcp-control-panel';

type TabType = 'overview' | 'settings' | 'api-keys' | 'mcp' | 'activity';

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Settings' },
    { id: 'api-keys', label: 'API Keys' },
    { id: 'mcp', label: 'MCP Control' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <a href="/agent" className="text-primary hover:underline mb-4 inline-block">
            ← Back to Agents
          </a>
          <h1 className="text-3xl font-bold text-foreground">Agent Details</h1>
        </div>

        <div className="border-b border-border mb-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {activeTab === 'overview' && <AgentDetail agentId={params.id} />}
          {activeTab === 'settings' && <AgentSettings agentId={params.id} />}
          {activeTab === 'api-keys' && <AgentApiKeys agentId={params.id} />}
          {activeTab === 'mcp' && <McpControlPanel agentId={params.id} />}
          {activeTab === 'activity' && <AgentActivity agentId={params.id} />}
        </div>
      </div>
    </div>
  );
}
