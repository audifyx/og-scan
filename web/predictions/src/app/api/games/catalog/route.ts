import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('game_catalog')
    .select('slug,name,mode,engine,live,min_stake,max_stake,description,how_to_play,resolution,why_manual,sort')
    .order('sort', { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, games: data ?? [] });
}
