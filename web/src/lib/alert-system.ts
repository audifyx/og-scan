// FILE: web/src/lib/alert-system.ts
// Comprehensive alert and notification system

import { supabase } from '@/lib/supabase';

export type AlertChannel = 'email' | 'webhook' | 'discord' | 'telegram' | 'push';
export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Alert {
  id?: string;
  mint: string;
  type: string;
  title: string;
  message: string;
  priority: AlertPriority;
  channels: AlertChannel[];
  triggered_at: number;
  status: 'pending' | 'sent' | 'failed';
}

export interface AlertConfig {
  enabledChannels: AlertChannel[];
  emailAddress?: string;
  webhookUrl?: string;
  discordWebhook?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  enablePushNotifications: boolean;
  criticalAlertsOnly?: boolean;
}

class AlertSystem {
  private config: AlertConfig = {
    enabledChannels: [],
    enablePushNotifications: true,
  };

  /**
   * Initialize alert system with config
   */
  async initializeConfig(config: Partial<AlertConfig>) {
    this.config = { ...this.config, ...config };

    // Store config in Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_alert_configs')
        .upsert({
          user_id: user.id,
          config: this.config,
          updated_at: new Date().toISOString(),
        });
    }
  }

  /**
   * Send alert through multiple channels
   */
  async sendAlert(alert: Alert) {
    console.log(`🚨 Sending alert: ${alert.title}`);

    // Check if should send (not just critical)
    if (this.config.criticalAlertsOnly && alert.priority !== 'critical') {
      return;
    }

    // Store alert in database
    await supabase
      .from('alerts_log')
      .insert({
        mint_address: alert.mint,
        alert_type: alert.type,
        title: alert.title,
        message: alert.message,
        priority: alert.priority,
        triggered_at: alert.triggered_at,
      });

    // Send through enabled channels
    const results = await Promise.allSettled([
      this.config.enabledChannels.includes('email') ? this.sendEmail(alert) : null,
      this.config.enabledChannels.includes('webhook') ? this.sendWebhook(alert) : null,
      this.config.enabledChannels.includes('discord') ? this.sendDiscord(alert) : null,
      this.config.enabledChannels.includes('telegram') ? this.sendTelegram(alert) : null,
      this.config.enablePushNotifications ? this.sendPushNotification(alert) : null,
    ]);

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error(`⚠️ ${failed.length} channels failed`);
    } else {
      console.log('✅ Alert sent to all channels');
    }
  }

  /**
   * Send email alert
   */
  private async sendEmail(alert: Alert) {
    if (!this.config.emailAddress) throw new Error('Email not configured');

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: this.config.emailAddress,
        subject: `[${alert.priority.toUpperCase()}] ${alert.title}`,
        html: `
          <h2>${alert.title}</h2>
          <p>${alert.message}</p>
          <p><strong>Token:</strong> ${alert.mint}</p>
          <p><strong>Time:</strong> ${new Date(alert.triggered_at * 1000).toLocaleString()}</p>
        `,
      }),
    });

    if (!response.ok) throw new Error(`Email failed: ${response.status}`);
  }

  /**
   * Send webhook alert
   */
  private async sendWebhook(alert: Alert) {
    if (!this.config.webhookUrl) throw new Error('Webhook not configured');

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'og_scan_alert',
        alert,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
  }

  /**
   * Send Discord message
   */
  private async sendDiscord(alert: Alert) {
    if (!this.config.discordWebhook) throw new Error('Discord not configured');

    const colorMap = {
      critical: 16711680, // Red
      high: 16776960, // Yellow
      medium: 65280, // Green
      low: 12632256, // Gray
    };

    const response = await fetch(this.config.discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: alert.title,
            description: alert.message,
            color: colorMap[alert.priority],
            fields: [
              { name: 'Token', value: alert.mint, inline: true },
              { name: 'Priority', value: alert.priority.toUpperCase(), inline: true },
              {
                name: 'Time',
                value: new Date(alert.triggered_at * 1000).toLocaleString(),
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Discord failed: ${response.status}`);
  }

  /**
   * Send Telegram message
   */
  private async sendTelegram(alert: Alert) {
    if (!this.config.telegramBotToken || !this.config.telegramChatId) {
      throw new Error('Telegram not configured');
    }

    const text = `
🚨 <b>${alert.title}</b>
Priority: <code>${alert.priority.toUpperCase()}</code>

${alert.message}

Token: <code>${alert.mint}</code>
Time: ${new Date(alert.triggered_at * 1000).toLocaleString()}
    `.trim();

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.telegramChatId,
          text,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) throw new Error(`Telegram failed: ${response.status}`);
  }

  /**
   * Send browser push notification
   */
  private async sendPushNotification(alert: Alert) {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    if (Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      new Notification(alert.title, {
        body: alert.message,
        icon: '/og-scan-icon.png',
        tag: alert.mint,
      });
    }
  }

  /**
   * Create rule-based alert
   */
  async createAlertRule(rule: {
    mint: string;
    type: string;
    condition: string;
    threshold: number;
    priority: AlertPriority;
    channels: AlertChannel[];
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    await supabase
      .from('alert_rules')
      .insert({
        user_id: user.id,
        mint_address: rule.mint,
        alert_type: rule.type,
        condition: rule.condition,
        threshold: rule.threshold,
        priority: rule.priority,
        channels: rule.channels,
        enabled: true,
        created_at: new Date().toISOString(),
      });
  }

  /**
   * Evaluate rules against real-time data
   */
  async evaluateRules(mint: string, data: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rules } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('mint_address', mint)
        .eq('enabled', true);

      for (const rule of rules || []) {
        const triggered = this.evaluateCondition(rule.condition, rule.threshold, data);

        if (triggered) {
          await this.sendAlert({
            mint,
            type: rule.alert_type,
            title: `${rule.alert_type}: ${mint.slice(0, 8)}...`,
            message: `Alert triggered: ${rule.condition} > ${rule.threshold}`,
            priority: rule.priority,
            channels: rule.channels,
            triggered_at: Math.floor(Date.now() / 1000),
          });
        }
      }
    } catch (error) {
      console.error('Error evaluating rules:', error);
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(condition: string, threshold: number, data: any): boolean {
    const value = this.getDataValue(condition, data);
    return value > threshold;
  }

  /**
   * Get value from data object using dot notation
   */
  private getDataValue(path: string, obj: any): number {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      value = value[key];
    }
    return Number(value) || 0;
  }
}

export const alertSystem = new AlertSystem();
