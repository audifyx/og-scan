import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function validateTelegramBot(token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    return response.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, telegramBotToken, botName, botBio, botImageUrl, trackAllKols, trackedKols } = req.body;

    if (!userId || !telegramBotToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate bot token with Telegram API
    const isValid = await validateTelegramBot(telegramBotToken);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid Telegram bot token' });
    }

    // Encrypt token (in production, use proper encryption)
    const encryptedToken = Buffer.from(telegramBotToken).toString('base64');

    // Save to database
    const { data, error } = await supabase
      .from('kol_tracker_bots')
      .upsert(
        {
          user_id: userId,
          telegram_bot_token: encryptedToken,
          bot_name: botName,
          bot_bio: botBio,
          bot_image_url: botImageUrl,
          track_all_kols: trackAllKols,
          tracked_kols: trackedKols,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to save bot configuration' });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
