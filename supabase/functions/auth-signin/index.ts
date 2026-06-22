import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');
    // Sign in user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (error) {
      throw new Error(`Auth error: ${error.message}`);
    }
    if (!data.session) {
      throw new Error('No session created');
    }
    // Get user profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', data.user.id).single();
    return new Response(JSON.stringify({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || email.split('@')[0]
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
