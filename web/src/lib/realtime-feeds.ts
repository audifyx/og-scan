// FILE: web/src/lib/realtime-feeds.ts
// WebSocket integration for real-time price, trades, anomalies

import { supabase } from '@/lib/supabase';

export interface RealTimePrice {
  mint: string;
  price: number;
  timestamp: number;
  change24h: number;
  volume24h: number;
}

export interface RealTimeTrade {
  signature: string;
  mint: string;
  buyer: string;
  seller: string;
  amount: number;
  price: number;
  timestamp: number;
  dex: string;
}

export interface DetectedAnomaly {
  type: 'price_spike' | 'volume_spike' | 'whale_dump' | 'whale_buy' | 'liquidation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  mint: string;
  value: number;
  change: number;
  timestamp: number;
}

class RealtimeFeeds {
  private priceSubscriptions = new Map<string, WebSocket>();
  private tradeSubscriptions = new Map<string, WebSocket>();
  private priceHistory = new Map<string, number[]>();
  private volumeHistory = new Map<string, number[]>();

  /**
   * Subscribe to real-time price updates from DexScreener
   */
  subscribeToPrice(mint: string, callback: (price: RealTimePrice) => void) {
    try {
      // Using DexScreener WebSocket
      const ws = new WebSocket('wss://api.dexscreener.com/ws');

      ws.onopen = () => {
        ws.send(JSON.stringify({
          action: 'subscribe',
          chainId: 'solana',
          mint,
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.price) {
            const priceData: RealTimePrice = {
              mint,
              price: parseFloat(data.price),
              timestamp: Date.now(),
              change24h: parseFloat(data.change24h || 0),
              volume24h: parseFloat(data.volume24h || 0),
            };

            // Detect anomalies
            await this.detectPriceAnomalies(mint, priceData);

            // Store price candle data
            await this.updatePriceCandle(mint, priceData);

            callback(priceData);
          }
        } catch (error) {
          console.error('Error processing price update:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        this.priceSubscriptions.delete(mint);
        // Attempt reconnect after 5 seconds
        setTimeout(() => this.subscribeToPrice(mint, callback), 5000);
      };

      this.priceSubscriptions.set(mint, ws);
    } catch (error) {
      console.error('Error subscribing to price:', error);
    }
  }

  /**
   * Subscribe to real-time trades (using Birdeye API)
   */
  subscribeToTrades(mint: string, callback: (trade: RealTimeTrade) => void) {
    try {
      // Birdeye real-time trades
      const ws = new WebSocket('wss://api.birdeye.so/ws');

      ws.onopen = () => {
        ws.send(JSON.stringify({
          action: 'subscribe',
          type: 'trades',
          mint,
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'trade') {
            const trade: RealTimeTrade = {
              signature: data.signature,
              mint,
              buyer: data.buyer,
              seller: data.seller,
              amount: parseFloat(data.amount),
              price: parseFloat(data.price),
              timestamp: Date.now(),
              dex: data.dex || 'Unknown',
            };

            // Detect whale activity
            await this.detectWhaleActivity(mint, trade);

            // Update transaction extended table
            await this.storeRealtimeTrade(trade);

            callback(trade);
          }
        } catch (error) {
          console.error('Error processing trade:', error);
        }
      };

      this.tradeSubscriptions.set(mint, ws);
    } catch (error) {
      console.error('Error subscribing to trades:', error);
    }
  }

  /**
   * Detect price anomalies
   */
  private async detectPriceAnomalies(mint: string, priceData: RealTimePrice) {
    try {
      if (!this.priceHistory.has(mint)) {
        this.priceHistory.set(mint, []);
      }

      const history = this.priceHistory.get(mint)!;
      history.push(priceData.price);

      // Keep last 100 prices
      if (history.length > 100) {
        history.shift();
      }

      if (history.length < 20) return;

      // Calculate moving average
      const recentPrices = history.slice(-20);
      const avgPrice = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
      const priceChange = Math.abs((priceData.price - avgPrice) / avgPrice) * 100;

      // Detect spike
      if (priceChange > 30) {
        const anomaly: DetectedAnomaly = {
          type: 'price_spike',
          severity: priceChange > 50 ? 'critical' : 'high',
          mint,
          value: priceData.price,
          change: priceChange,
          timestamp: priceData.timestamp,
        };

        await this.storeAnomaly(anomaly);
        await this.sendAlert(anomaly);
      }
    } catch (error) {
      console.error('Error detecting price anomalies:', error);
    }
  }

  /**
   * Detect whale activity
   */
  private async detectWhaleActivity(mint: string, trade: RealTimeTrade) {
    try {
      // Get current token price for USD calculation
      const { data: token } = await supabase
        .from('tokens')
        .select('usdPrice')
        .eq('mint', mint)
        .single();

      const usdVolume = trade.amount * (token?.usdPrice || trade.price);

      // Detect large trades (whale activity)
      if (usdVolume > 100000) {
        const anomaly: DetectedAnomaly = {
          type: trade.buyer ? 'whale_buy' : 'whale_dump',
          severity: usdVolume > 500000 ? 'critical' : 'high',
          mint,
          value: usdVolume,
          change: (trade.amount / 1000000) * 100,
          timestamp: trade.timestamp,
        };

        await this.storeAnomaly(anomaly);
        await this.sendAlert(anomaly);
      }
    } catch (error) {
      console.error('Error detecting whale activity:', error);
    }
  }

  /**
   * Update price candles every 5 minutes
   */
  private async updatePriceCandle(mint: string, priceData: RealTimePrice) {
    try {
      const fiveMinutesAgo = Math.floor(Date.now() / 1000 / 300) * 300;

      const { data: existing } = await supabase
        .from('price_candles_extended')
        .select('*')
        .eq('mint_address', mint)
        .eq('timeframe', '5m')
        .eq('candle_timestamp', fiveMinutesAgo)
        .single();

      if (existing) {
        // Update existing candle
        await supabase
          .from('price_candles_extended')
          .update({
            close_price: priceData.price,
            high_price: Math.max(existing.high_price || priceData.price, priceData.price),
            volume_usd: (existing.volume_usd || 0) + priceData.volume24h,
          })
          .eq('id', existing.id);
      } else {
        // Create new candle
        await supabase
          .from('price_candles_extended')
          .insert({
            mint_address: mint,
            timeframe: '5m',
            candle_timestamp: fiveMinutesAgo,
            open_price: priceData.price,
            high_price: priceData.price,
            low_price: priceData.price,
            close_price: priceData.price,
            volume_usd: priceData.volume24h,
          });
      }
    } catch (error) {
      console.error('Error updating price candle:', error);
    }
  }

  /**
   * Store real-time trade
   */
  private async storeRealtimeTrade(trade: RealTimeTrade) {
    try {
      await supabase
        .from('transactions_extended')
        .insert({
          signature: trade.signature,
          blockchain_timestamp: Math.floor(trade.timestamp / 1000),
          tx_type: 'swap',
          direction: 'buy',
          buyer_address: trade.buyer,
          seller_address: trade.seller,
          mint_address: trade.mint,
          token_amount: BigInt(Math.floor(trade.amount * 1e6)),
          token_price: trade.price,
          usd_volume: trade.amount * trade.price,
          dex_name: trade.dex,
        });
    } catch (error) {
      console.error('Error storing trade:', error);
    }
  }

  /**
   * Store detected anomaly
   */
  private async storeAnomaly(anomaly: DetectedAnomaly) {
    try {
      await supabase
        .from('real_time_alerts')
        .insert({
          mint_address: anomaly.mint,
          alert_type: anomaly.type,
          severity: anomaly.severity,
          metric_value: anomaly.value,
          percent_change: anomaly.change,
          triggered_timestamp: Math.floor(anomaly.timestamp / 1000),
          is_resolved: false,
        });
    } catch (error) {
      console.error('Error storing anomaly:', error);
    }
  }

  /**
   * Send alert (email, webhook, notification)
   */
  private async sendAlert(anomaly: DetectedAnomaly) {
    try {
      // Send to webhook
      const webhookUrl = process.env.REACT_APP_ALERT_WEBHOOK;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: anomaly.type,
            severity: anomaly.severity,
            mint: anomaly.mint,
            value: anomaly.value,
            change: anomaly.change,
            timestamp: new Date(anomaly.timestamp).toISOString(),
          }),
        });
      }

      // Send email notification for critical alerts
      if (anomaly.severity === 'critical') {
        await fetch('/api/send-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(anomaly),
        });
      }
    } catch (error) {
      console.error('Error sending alert:', error);
    }
  }

  /**
   * Unsubscribe from price updates
   */
  unsubscribePrice(mint: string) {
    const ws = this.priceSubscriptions.get(mint);
    if (ws) {
      ws.close();
      this.priceSubscriptions.delete(mint);
    }
  }

  /**
   * Unsubscribe from trades
   */
  unsubscribeTrades(mint: string) {
    const ws = this.tradeSubscriptions.get(mint);
    if (ws) {
      ws.close();
      this.tradeSubscriptions.delete(mint);
    }
  }
}

export const realtimeFeeds = new RealtimeFeeds();
