import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET ?ticketId=  -> messages for a ticket (and marks admin_unread=false)
// GET (no param)  -> list of tickets with identity + last message
export async function GET(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const ticketId = url.searchParams.get('ticketId');

  if (ticketId) {
    const { data: messages } = await supabaseAdmin
      .from('support_messages').select('id, sender, body, created_at')
      .eq('ticket_id', ticketId).order('created_at', { ascending: true }).limit(1000);
    await supabaseAdmin.from('support_tickets').update({ admin_unread: false }).eq('id', ticketId);
    return NextResponse.json({ ok: true, messages: messages || [] });
  }

  const { data: tickets } = await supabaseAdmin
    .from('support_tickets').select('*').order('last_message_at', { ascending: false }).limit(200);

  // attach identity (username / wallet)
  const ids = Array.from(new Set((tickets || []).map((t: any) => t.user_id).filter(Boolean)));
  const idMap: Record<string, any> = {};
  if (ids.length) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('user_id, username, wallet, display_name').in('user_id', ids);
    (profs || []).forEach((p: any) => { idMap[p.user_id] = p; });
  }
  // latest message preview per ticket
  const enriched = await Promise.all((tickets || []).map(async (t: any) => {
    const { data: last } = await supabaseAdmin
      .from('support_messages').select('body, sender, created_at')
      .eq('ticket_id', t.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const p = idMap[t.user_id] || {};
    return {
      ...t,
      who: p.display_name || p.username || (p.wallet ? p.wallet.slice(0, 4) + '…' + p.wallet.slice(-4) : t.user_id.slice(0, 8)),
      username: p.username || null,
      wallet: p.wallet || null,
      preview: last?.body?.slice(0, 120) || '',
      preview_sender: last?.sender || null,
    };
  }));

  const openUnread = enriched.filter((t) => t.admin_unread && t.status === 'open').length;
  return NextResponse.json({ ok: true, tickets: enriched, openUnread });
}

// POST { action: 'reply'|'close', ticketId, body? }
export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { action = 'reply', ticketId, body } = (await req.json().catch(() => ({}))) || {};
  if (!ticketId) return NextResponse.json({ ok: false, error: 'Missing ticketId' }, { status: 400 });

  if (action === 'close') {
    await supabaseAdmin.from('support_tickets').update({ status: 'closed' }).eq('id', ticketId);
    return NextResponse.json({ ok: true });
  }
  if (action === 'reopen') {
    await supabaseAdmin.from('support_tickets').update({ status: 'open' }).eq('id', ticketId);
    return NextResponse.json({ ok: true });
  }

  const text = String(body || '').trim();
  if (!text) return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ ok: false, error: 'Message too long.' }, { status: 400 });

  const { data: msg, error: me } = await supabaseAdmin.from('support_messages').insert({
    ticket_id: ticketId, sender: 'admin', user_id: null, body: text,
  }).select('id, sender, body, created_at').single();
  if (me) return NextResponse.json({ ok: false, error: me.message }, { status: 400 });

  await supabaseAdmin.from('support_tickets').update({
    status: 'open',
    last_message_at: new Date().toISOString(),
    last_sender: 'admin',
    user_unread: true,
    admin_unread: false,
  }).eq('id', ticketId);

  return NextResponse.json({ ok: true, message: msg });
}
