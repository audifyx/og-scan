import { supabaseClient } from '../lib/supabase';
import { Theme } from '../interfaces/Theme';

const updatePreferredTheme = async (theme: Theme) => {
  const { data, error } = await supabaseClient
    .from('users')
    .update({
      preferred_theme_id: theme.id,
    });

  if (error) {
    throw error;
  }

  return data;
};

export default updatePreferredTheme;
