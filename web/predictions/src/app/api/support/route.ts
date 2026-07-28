import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/games/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — fetch the signed-in user's support thread (latest ticket + messages).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const { data: ticket } = await supabaseAdmin
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ticket) return NextResponse.json({ ok: true, ticket: null, messages: [] });

  const { data: messages } = await supabaseAdmin
    .from('support_messages')
    .select('id, sender, body, created_at')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true })
    .limit(500);

  // clear the user's unread flag on read
  if (ticket.user_unread) {
    await supabaseAdmin.from('support_tickets').update({ user_unread: false }).eq('id', ticket.id);
  }

  return NextResponse.json({ ok: true, ticket, messages: messages || [] });
}

// POST — user sends a message (creates/reopens their ticket).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const { body } = (await req.json().catch(() => ({}))) || {};
  const text = String(body || '').trim();
  if (!text) return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ ok: false, error: 'Message too long.' }, { status: 400 });

  // reuse the most recent ticket, else create one
  let { data: ticket } = await supabaseAdmin
    .from('support_tickets').select('*').eq('user_id', user.id)
    .order('last_message_at', { ascending: false }).limit(1).maybeSingle();

  if (!ticket) {
    const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
    const { data: created, error: ce } = await supabaseAdmin.from('support_tickets').insert({
      user_id: user.id,
      profile_id: prof?.id ?? null,
      subject: text.slice(0, 80),
      status: 'open',
      last_sender: 'user',
      admin_unread: true,
      user_unread: false,
    }).select('*').single();
    if (ce) return NextResponse.json({ ok: false, error: ce.message }, { status: 400 });
    ticket = created;
  }

  const { data: msg, error: me } = await supabaseAdmin.from('support_messages').insert({
    ticket_id: ticket.id, sender: 'user', user_id: user.id, body: text,
  }).select('id, sender, body, created_at').single();
  if (me) return NextResponse.json({ ok: false, error: me.message }, { status: 400 });

  await supabaseAdmin.from('support_tickets').update({
    status: 'open',
    last_message_at: new Date().toISOString(),
    last_sender: 'user',
    admin_unread: true,
    user_unread: false,
  }).eq('id', ticket.id);

  return NextResponse.json({ ok: true, ticketId: ticket.id, message: msg });
}
