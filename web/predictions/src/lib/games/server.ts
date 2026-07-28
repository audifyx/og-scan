import { createServerSupabase } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomSeed, hashSeed } from '@/lib/games/provably-fair';

export async function getSessionUser() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId: string): Promise<{ username: string | null; wallet: string | null }> {
  const { data } = await supabaseAdmin.from('profiles').select('username, wallet').eq('user_id', userId).maybeSingle();
  return { username: data?.username ?? null, wallet: data?.wallet ?? null };
}

// Get the active provably-fair seed for a user, creating one if needed.
export async function ensureActiveSeed(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from('game_seeds').select('*').eq('user_id', userId).eq('active', true).maybeSingle();
  if (existing) return existing as any;

  const serverSeed = randomSeed();
  const row = {
    user_id: userId,
    server_seed: serverSeed,
    server_seed_hash: hashSeed(serverSeed),
    client_seed: randomSeed(8),
    nonce: 0,
    active: true,
  };
  const { data, error } = await supabaseAdmin.from('game_seeds').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data as any;
}

export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('game_balances').select('balance').eq('user_id', userId).maybeSingle();
  return Number(data?.balance ?? 0);
}
