

import React, { useState, useEffect } from 'react';

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface AgentApiKeysProps {
  agentId: string;
}

export function AgentApiKeys({ agentId }: AgentApiKeysProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyName, setKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, [agentId]);

  const fetchApiKeys = async () => {
    try {
      setIsLoading(true);
      const apiKey = localStorage.getItem('agent_api_key');
      const response = await fetch(`/api/agents/${agentId}/api-keys`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch API keys');
      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (err) {
      console.error('[v0] Error fetching API keys:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) return;

    setIsCreating(true);
    try {
      const apiKey = localStorage.getItem('agent_api_key');
      const response = await fetch(`/api/agents/${agentId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ name: keyName }),
      });

      if (!response.ok) throw new Error('Failed to create API key');
      const data = await response.json();
      setNewKey({ key: data.key, name: data.name });
      setKeyName('');
      fetchApiKeys();
    } catch (err) {
      console.error('[v0] Error creating API key:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {newKey && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
          <p className="font-bold text-green-800 dark:text-green-300 mb-2">New API Key Created</p>
          <p className="text-sm text-green-700 dark:text-green-400 mb-3">Save this key securely. You won't see it again.</p>
          <div className="bg-background p-3 rounded font-mono text-sm break-all mb-3 text-foreground">
            {newKey.key}
          </div>
          <button
            onClick={handleCopyKey}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            {copied ? 'Copied!' : 'Copy Key'}
          </button>
        </div>
      )}

      <div className="bg-muted p-6 rounded-lg border border-border">
        <h3 className="text-lg font-bold text-foreground mb-4">Create New API Key</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="e.g., Production Key"
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleCreateKey}
            disabled={!keyName.trim() || isCreating}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No API keys yet. Create one to authenticate your agent.
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-bold text-foreground">Active API Keys</h3>
          {apiKeys.map((key) => (
            <div key={key.id} className="bg-muted p-4 rounded-lg border border-border flex justify-between items-center">
              <div>
                <p className="font-medium text-foreground">{key.name}</p>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button className="px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition">
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
