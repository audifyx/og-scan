// FILE: web/src/pages/AlertSettings.tsx
// Alert configuration and rule management

import React, { useState, useEffect } from 'react';
import { Bell, Mail, MessageCircle, Webhook, Save, Plus, Trash2 } from 'lucide-react';
import { alertSystem, type AlertConfig, type AlertChannel } from '@/lib/alert-system';
import { supabase } from '@/lib/supabase';

export default function AlertSettings() {
  const [config, setConfig] = useState<AlertConfig>({
    enabledChannels: [],
    enablePushNotifications: true,
  });
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRule, setNewRule] = useState({
    mint: '',
    type: 'price_spike',
    condition: 'price',
    threshold: 0,
    priority: 'high' as const,
    channels: ['push' as const],
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: configData } = await supabase
        .from('user_alert_configs')
        .select('config')
        .eq('user_id', user.id)
        .single();

      if (configData?.config) {
        setConfig(configData.config);
      }

      const { data: rulesData } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setRules(rulesData || []);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await alertSystem.initializeConfig(config);
      alert('✅ Settings saved');
    } catch (error) {
      alert('❌ Error saving settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.mint || !newRule.threshold) {
      alert('Please fill all fields');
      return;
    }

    try {
      await alertSystem.createAlertRule(newRule);
      setNewRule({
        mint: '',
        type: 'price_spike',
        condition: 'price',
        threshold: 0,
        priority: 'high',
        channels: ['push'],
      });
      await loadSettings();
      alert('✅ Rule created');
    } catch (error) {
      alert('❌ Error creating rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await supabase
        .from('alert_rules')
        .delete()
        .eq('id', ruleId);
      await loadSettings();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const channels: AlertChannel[] = ['email', 'webhook', 'discord', 'telegram', 'push'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Bell className="h-8 w-8 text-og-cyan" />
          <h1 className="text-3xl font-black">Alert Settings</h1>
        </div>

        {/* Notification Channels */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Notification Channels</h2>
          <div className="space-y-3">
            {channels.map(channel => (
              <label key={channel} className="flex items-center gap-3 p-3 hover:bg-foreground/5 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabledChannels.includes(channel)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setConfig({
                        ...config,
                        enabledChannels: [...config.enabledChannels, channel],
                      });
                    } else {
                      setConfig({
                        ...config,
                        enabledChannels: config.enabledChannels.filter(c => c !== channel),
                      });
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="font-bold capitalize">{channel}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Channel Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {config.enabledChannels.includes('email') && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5 text-og-cyan" />
                <h3 className="font-bold">Email</h3>
              </div>
              <input
                type="email"
                placeholder="your@email.com"
                value={config.emailAddress || ''}
                onChange={(e) => setConfig({ ...config, emailAddress: e.target.value })}
                className="w-full px-3 py-2 bg-foreground/10 border border-border rounded-lg"
              />
            </div>
          )}

          {config.enabledChannels.includes('webhook') && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Webhook className="h-5 w-5 text-og-cyan" />
                <h3 className="font-bold">Webhook</h3>
              </div>
              <input
                type="url"
                placeholder="https://webhook.site/..."
                value={config.webhookUrl || ''}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                className="w-full px-3 py-2 bg-foreground/10 border border-border rounded-lg"
              />
            </div>
          )}

          {config.enabledChannels.includes('discord') && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="h-5 w-5 text-og-cyan" />
                <h3 className="font-bold">Discord</h3>
              </div>
              <input
                type="url"
                placeholder="Discord webhook URL"
                value={config.discordWebhook || ''}
                onChange={(e) => setConfig({ ...config, discordWebhook: e.target.value })}
                className="w-full px-3 py-2 bg-foreground/10 border border-border rounded-lg"
              />
            </div>
          )}

          {config.enabledChannels.includes('telegram') && (
            <>
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-bold mb-4">Telegram Bot Token</h3>
                <input
                  type="text"
                  placeholder="Bot token"
                  value={config.telegramBotToken || ''}
                  onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })}
                  className="w-full px-3 py-2 bg-foreground/10 border border-border rounded-lg"
                />
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-bold mb-4">Telegram Chat ID</h3>
                <input
                  type="text"
                  placeholder="Chat ID"
                  value={config.telegramChatId || ''}
                  onChange={(e) => setConfig({ ...config, telegramChatId: e.target.value })}
                  className="w-full px-3 py-2 bg-foreground/10 border border-border rounded-lg"
                />
              </div>
            </>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveConfig}
          disabled={loading}
          className="w-full px-4 py-3 bg-og-cyan text-black rounded-lg font-bold hover:bg-og-cyan/80 disabled:opacity-50 mb-8 flex items-center justify-center gap-2"
        >
          <Save className="h-5 w-5" />
          Save Settings
        </button>

        {/* Alert Rules */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Alert Rules</h2>

          {/* New Rule */}
          <div className="bg-foreground/5 rounded-lg p-4 mb-6">
            <h3 className="font-bold mb-4">Create New Rule</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Token mint"
                value={newRule.mint}
                onChange={(e) => setNewRule({ ...newRule, mint: e.target.value })}
                className="px-3 py-2 bg-foreground/10 border border-border rounded-lg"
              />
              <select
                value={newRule.type}
                onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                className="px-3 py-2 bg-foreground/10 border border-border rounded-lg"
              >
                <option value="price_spike">Price Spike</option>
                <option value="volume_spike">Volume Spike</option>
                <option value="whale_activity">Whale Activity</option>
              </select>
              <input
                type="number"
                placeholder="Threshold"
                value={newRule.threshold}
                onChange={(e) => setNewRule({ ...newRule, threshold: Number(e.target.value) })}
                className="px-3 py-2 bg-foreground/10 border border-border rounded-lg"
              />
              <select
                value={newRule.priority}
                onChange={(e) => setNewRule({ ...newRule, priority: e.target.value as any })}
                className="px-3 py-2 bg-foreground/10 border border-border rounded-lg"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <button
              onClick={handleAddRule}
              className="w-full px-4 py-2 bg-og-lime text-black rounded-lg font-bold hover:bg-og-lime/80 flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Rule
            </button>
          </div>

          {/* Existing Rules */}
          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className="p-4 border border-border/50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold">{rule.alert_type}</p>
                  <p className="text-sm text-foreground/60">
                    {rule.mint.slice(0, 8)}... - {rule.condition} {'>='} {rule.threshold}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-2 hover:bg-og-red/10 rounded-lg text-og-red"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
