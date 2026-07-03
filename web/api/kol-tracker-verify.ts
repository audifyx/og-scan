import type { VercelRequest, VercelResponse } from '@vercel/node';

interface VerifyBotResponse {
  success: boolean;
  botId?: string;
  username?: string;
  firstName?: string;
  error?: string;
}

/**
 * Verify Telegram bot token is valid
 * Validates against Telegram Bot API
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse<VerifyBotResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Bot token is required' });
    }

    // Validate token format (basic check)
    if (!token.includes(':') || token.split(':').length !== 2) {
      return res.status(400).json({ success: false, error: 'Invalid token format' });
    }

    // Call Telegram API to verify
    const telegramUrl = `https://api.telegram.org/bot${token}/getMe`;
    const response = await fetch(telegramUrl);

    if (!response.ok) {
      return res.status(400).json({ success: false, error: 'Invalid Telegram bot token' });
    }

    const data = await response.json();

    if (!data.ok || !data.result) {
      return res.status(400).json({ success: false, error: 'Failed to verify bot' });
    }

    return res.status(200).json({
      success: true,
      botId: data.result.id,
      username: data.result.username,
      firstName: data.result.first_name,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
