import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-supabase-url.supabase.io';
const supabaseKey = 'your-supabase-key';

const supabaseClient = createClient(supabaseUrl, supabaseKey);

export default supabaseClient;
