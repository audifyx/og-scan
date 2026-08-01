

import React, { useState, useEffect } from 'react';

interface Settings {
  id: string;
  tradingEnabled: boolean;
  nftMintingEnabled: boolean;
  tokenLaunchEnabled: boolean;
  socialPostingEnabled: boolean;
  maxTradeSizeUsd: number;
  maxDailyVolumeUsd: number;
}

interface AgentSettingsProps {
  agentId: string;
}

export function AgentSettings({ agentId }: AgentSettingsProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [agentId]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const apiKey = localStorage.getItem('agent_api_key');
      const response = await fetch(`/api/agents/${agentId}/settings`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data.settings);
    } catch (err) {
      console.error('[v0] Error fetching settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const apiKey = localStorage.getItem('agent_api_key');
      const response = await fetch(`/api/agents/${agentId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      alert('Settings saved successfully');
    } catch (err) {
      console.error('[v0] Error saving settings:', err);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !settings) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-muted p-6 rounded-lg border border-border space-y-6">
        <h3 className="text-xl font-bold text-foreground">Agent Capabilities</h3>

        <div className="space-y-4">
          {[
            { key: 'tradingEnabled', label: 'Trading' },
            { key: 'nftMintingEnabled', label: 'NFT Minting' },
            { key: 'tokenLaunchEnabled', label: 'Token Launches' },
            { key: 'socialPostingEnabled', label: 'Social Posting' },
          ].map((item) => (
            <label key={item.key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(settings as any)[item.key]}
                onChange={(e) =>
                  setSettings({ ...settings, [item.key]: e.target.checked })
                }
                className="w-5 h-5 rounded"
              />
              <span className="font-medium text-foreground">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-muted p-6 rounded-lg border border-border space-y-6">
        <h3 className="text-xl font-bold text-foreground">Trade Limits</h3>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Max Trade Size (USD): ${settings.maxTradeSizeUsd}
          </label>
          <input
            type="range"
            min="10"
            max="100000"
            step="10"
            value={settings.maxTradeSizeUsd}
            onChange={(e) =>
              setSettings({ ...settings, maxTradeSizeUsd: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-border rounded-lg cursor-pointer"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Maximum amount per trade transaction
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Max Daily Volume (USD): ${settings.maxDailyVolumeUsd}
          </label>
          <input
            type="range"
            min="100"
            max="1000000"
            step="100"
            value={settings.maxDailyVolumeUsd}
            onChange={(e) =>
              setSettings({ ...settings, maxDailyVolumeUsd: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-border rounded-lg cursor-pointer"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Maximum total trading volume per day
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition"
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
