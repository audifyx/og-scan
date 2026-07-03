import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SendAlertResponse {
  success: boolean;
  messageId?: number;
  error?: string;
}

interface AlertPayload {
  botToken: string;
  chatId: string;
  kolName: string;
  wallet: string;
  txType: 'buy' | 'sell';
  tokenSymbol: string;
  amount: number;
  price: number;
  signature?: string;
}

/**
 * Send transaction alert to Telegram
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse<SendAlertResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { botToken, chatId, kolName, wallet, txType, tokenSymbol, amount, price, signature } = req.body as AlertPayload;

    // Validate required fields
    if (!botToken || !chatId || !kolName || !txType || !tokenSymbol) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Format the alert message
    const message = formatAlertMessage({
      kolName,
      wallet,
      txType,
      tokenSymbol,
      amount,
      price,
      signature,
    });

    // Send to Telegram
    const messageId = await sendTelegramMessage(botToken, chatId, message);

    if (!messageId) {
      return res.status(500).json({ success: false, error: 'Failed to send Telegram message' });
    }

    return res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error('Send alert error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

function formatAlertMessage(alert: {
  kolName: string;
  wallet: string;
  txType: 'buy' | 'sell';
  tokenSymbol: string;
  amount: number;
  price: number;
  signature?: string;
}): string {
  const emoji = alert.txType === 'buy' ? '🟢 BUY' : '🔴 SELL';
  const amountDisplay = alert.amount?.toFixed(2) || 'N/A';
  const priceDisplay = alert.price?.toFixed(6) || 'N/A';

  let message = `${emoji}\n\n`;
  message += `<b>${alert.kolName}</b>\n`;
  message += `Wallet: <code>${alert.wallet.substring(0, 8)}...${alert.wallet.substring(alert.wallet.length - 8)}</code>\n\n`;
  message += `Token: <b>${alert.tokenSymbol}</b>\n`;
  message += `Amount: <b>${amountDisplay}</b>\n`;
  message += `Price: <b>$${priceDisplay}</b>\n`;

  if (alert.signature) {
    const explorerUrl = `https://solscan.io/tx/${alert.signature}`;
    message += `\n<a href="${explorerUrl}">View on Solscan</a>`;
  }

  message += `\n\n⏰ ${new Date().toLocaleString()}`;

  return message;
}

async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<number | null> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram error:', data.description);
      return null;
    }

    return data.result.message_id;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return null;
  }
}
