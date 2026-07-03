import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface TelegramAlert {
  userId: string;
  kolName: string;
  wallet: string;
  transactionType: 'buy' | 'sell';
  tokenSymbol: string;
  tokenMint: string;
  amount: number;
  price: number;
  timestamp: string;
}

async function sendTelegramAlert(botToken: string, chatId: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send Telegram alert:', error);
    return false;
  }
}

function formatAlertMessage(alert: TelegramAlert): string {
  const emoji = alert.transactionType === 'buy' ? '📈' : '📉';
  return `
${emoji} <b>KOL Activity Alert</b>

<b>KOL:</b> ${alert.kolName}
<b>Action:</b> ${alert.transactionType.toUpperCase()}
<b>Token:</b> ${alert.tokenSymbol} (${alert.tokenMint.slice(0, 8)}...)
<b>Amount:</b> ${alert.amount.toLocaleString()}
<b>Price:</b> $${alert.price.toFixed(2)}
<b>Time:</b> ${new Date(alert.timestamp).toLocaleString()}

🔗 Wallet: <code>${alert.wallet}</code>
  `.trim();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const alert: TelegramAlert = req.body;

    // Fetch user's bot config
    const { data: botConfig, error: configError } = await supabase
      .from('kol_tracker_bots')
      .select('telegram_bot_token')
      .eq('user_id', alert.userId)
      .single();

    if (configError || !botConfig) {
      return res.status(404).json({ error: 'Bot configuration not found' });
    }

    // Decode bot token
    const botToken = Buffer.from(botConfig.telegram_bot_token, 'base64').toString();

    // Format and send alert
    const message = formatAlertMessage(alert);
    const success = await sendTelegramAlert(botToken, alert.userId, message);

    if (!success) {
      return res.status(500).json({ error: 'Failed to send Telegram alert' });
    }

    // Log alert in database
    const { error: logError } = await supabase.from('kol_tracker_alerts').insert({
      user_id: alert.userId,
      kol_name: alert.kolName,
      wallet: alert.wallet,
      transaction_type: alert.transactionType,
      token_symbol: alert.tokenSymbol,
      token_mint: alert.tokenMint,
      amount: alert.amount,
      price: alert.price,
      created_at: new Date().toISOString(),
    });

    if (logError) {
      console.error('Failed to log alert:', logError);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
